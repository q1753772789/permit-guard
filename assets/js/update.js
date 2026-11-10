/* ============================================================
 * 在线更新（window.UPD）
 *
 * 两条通道，由原生层 NativeUpdater 执行，这里只负责判断和界面：
 *   1) 热更新：下载新的网页包（index.html + assets）解到本机，
 *      重载页面即生效，用户不用装 APK；
 *   2) 安装包升级：下载 APK 交给系统安装器（原生能力变化时才需要）。
 *
 * 版本清单放在 update/latest.json，由 tools/publish.py 生成并推到 GitHub。
 * 仓库地址 REPO 由发布脚本自动写入；也可以在设置里手填镜像地址。
 * ============================================================ */
(function () {
  'use strict';

  /* 发布脚本会把这里替换成 "owner/repo"；保持占位符表示还没配置 */
  var REPO = 'q1753772789/permit-guard';
  var MANIFEST = 'update/latest.json';

  var K_LAST = 'tz_upd_last';      // 上次检查时间（毫秒）
  var K_AUTO = 'tz_upd_auto';      // 是否自动检查
  var K_BASE = 'tz_upd_base';      // 自定义更新源（企业内网镜像时用）
  var K_GOOD = 'tz_upd_good';      // 上次连通的那个源，下次优先试它

  var bridge = (typeof window !== 'undefined') ? window.NativeUpdater : null;
  var pollTimer = null;

  var state = {
    checking: false,
    checkedAt: 0,
    error: '',
    manifest: null,
    info: { apkVersionName: '', apkVersionCode: 0, webVersion: '', webApplied: false },
    web: null,      // 可用的网页更新
    apk: null,      // 可用的安装包更新
    task: null,     // 正在进行/刚结束的任务
    base: '',       // 本次成功拉取清单的源
    tag: '',        // 本次成功的源叫什么（gh-proxy / jsDelivr ...）
    diag: [],       // 各源连通性测试结果
    diagBusy: false,
    editingBase: false,
    baseInput: '',
    notesTab: 'app' // 更新说明当前看哪块：app（应用）/ rule（规则）
  };

  /* -------------------------------------------------------- 小工具 */

  function e(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hasNative() {
    if (!bridge || typeof bridge.info !== 'function') return false;
    if (typeof bridge.httpGet === 'function') return true;   // 老安装包
    return typeof bridge.httpGetStart === 'function' && typeof bridge.httpGetTake === 'function';
  }

  function readInfo() {
    if (!hasNative()) {
      state.info = {
        apkVersionName: (typeof APP_VERSION === 'string' ? APP_VERSION : ''),
        apkVersionCode: 0,
        webVersion: '',
        webApplied: false,
        browser: true
      };
      return state.info;
    }
    try {
      state.info = JSON.parse(bridge.info() || '{}');
    } catch (err) {
      state.info = { apkVersionName: '', apkVersionCode: 0, webVersion: '', webApplied: false };
    }
    return state.info;
  }

  /** "3.1" → 301；用于和清单里的 code 比较 */
  function codeOf(v) {
    var s = String(v == null ? '' : v).replace(/[^0-9.]/g, '');
    if (!s) return 0;
    var parts = s.split('.');
    var a = parseInt(parts[0], 10) || 0;
    var b = parseInt(parts[1], 10) || 0;
    return a * 100 + b;
  }

  /** 当前正在跑的网页版本号：应用过热更新就用更新包里的，否则等于 APK 内置 */
  function currentWebVersion() {
    var info = readInfo();
    if (info.webVersion) return info.webVersion;
    return String(typeof APP_VERSION === 'string' ? APP_VERSION : '0');
  }

  function sizeText(n) {
    n = Number(n) || 0;
    if (!n) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  function timeText(ms) {
    if (!ms) return '尚未检查';
    try {
      var d = new Date(ms);
      var p = function (x) { return (x < 10 ? '0' : '') + x; };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
        + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    } catch (err) {
      return '';
    }
  }

  /* -------------------------------------------------------- 清单获取 */

  /**
   * 候选源，按"国内手机能不能连上"排序。
   *
   * GitHub 的 raw / api / *.github.io 在国内手机上是连不上的，所以主力是两类：
   *   1) 公开反代：把原始 GitHub 地址原样拼在域名后面（gh-proxy.com/https://raw...）
   *   2) jsDelivr 的几个 CDN 节点：正规 CDN，国内有节点，但对 @main 有最长 12 小时缓存
   * 直连源放最后，给挂梯子或海外的用户。
   */
  function bases() {
    var list = [];
    var custom = '';
    try { custom = String(Store.get(K_BASE) || '').trim(); } catch (err) { custom = ''; }
    if (custom) {
      if (!/^https:\/\//i.test(custom)) custom = 'https://' + custom.replace(/^\/+/, '');
      var c = custom.replace(/\/+$/, '') + '/';
      list.push({ tag: '自定义', base: c, dl: c });
    }

    if (!(REPO && REPO.indexOf('@@') < 0 && REPO.indexOf('/') > 0)) return list;

    var owner = REPO.split('/')[0];
    var repo = REPO.split('/')[1];
    var raw = 'https://raw.githubusercontent.com/' + REPO + '/main/';
    var jd = 'https://cdn.jsdelivr.net/gh/' + REPO + '@main/';

    // 反代组：国内实测可用，把原始地址整段拼在后面。
    // 反代直连 raw，不缓存，清单永远是当前的，所以排最前。
    list.push({ tag: 'gh-proxy', base: 'https://gh-proxy.com/' + raw, dl: 'https://gh-proxy.com/' + raw });
    list.push({ tag: 'ghfast', base: 'https://ghfast.top/' + raw, dl: 'https://ghfast.top/' + raw });
    list.push({ tag: 'llkk', base: 'https://gh.llkk.cc/' + raw, dl: 'https://gh.llkk.cc/' + raw });

    // jsDelivr 组：不同边缘节点缓存差异极大——实测 cdn 主节点可能拿到两天前的清单，
    // fastly / gcore 反而是最新的。所以主节点放最后，且这几个源拿到清单后一律用 API 核对。
    list.push({ tag: 'jsDelivr-fastly', base: 'https://fastly.jsdelivr.net/gh/' + REPO + '@main/', dl: 'https://fastly.jsdelivr.net/gh/' + REPO + '@main/', cached: true });
    list.push({ tag: 'jsDelivr-gcore', base: 'https://gcore.jsdelivr.net/gh/' + REPO + '@main/', dl: 'https://gcore.jsdelivr.net/gh/' + REPO + '@main/', cached: true });
    list.push({ tag: 'jsDelivr', base: jd, dl: jd, cached: true });

    // 直连组：国内基本不通，海外/挂代理时最快
    list.push({ tag: 'GitHub 直连', base: raw, dl: raw });
    // 内容接口无 CDN 缓存，用来复核"是不是真的没有更新"
    list.push({ tag: 'GitHub API', base: 'https://api.github.com/repos/' + REPO, dl: raw, kind: 'api' });
    list.push({ tag: 'GitHub Pages', base: 'https://' + owner + '.github.io/' + repo + '/', dl: 'https://' + owner + '.github.io/' + repo + '/' });

    return list;
  }

  function bust(url) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
  }

  /** contents 接口返回的 base64 → UTF-8 文本 */
  function b64utf8(b64) {
    try {
      var bin = atob(String(b64).replace(/\s+/g, ''));
      if (typeof TextDecoder === 'function') {
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new TextDecoder('utf-8').decode(arr);
      }
      return decodeURIComponent(escape(bin));
    } catch (err) {
      return '';
    }
  }

  /**
   * 原生异步取文本：启动请求 + 轮询结果，两段都用同步 JS 接口，
   * 但每段都是"立即返回"，不会像 httpGet 那样把页面卡到网络返回为止。
   */
  function nativeGet(url, timeoutMs, cb) {
    var canAsync = typeof bridge.httpGetStart === 'function' && typeof bridge.httpGetTake === 'function';
    if (!canAsync) {
      // 老安装包只有同步接口：至少让出一帧，别在绘制前就阻塞
      setTimeout(function () {
        var txt = '';
        try { txt = bridge.httpGet(url); } catch (err) { txt = '__ERR__:' + err; }
        if (txt && txt.indexOf('__ERR__') === 0) { cb(txt.slice(7)); return; }
        cb(null, txt);
      }, 0);
      return;
    }

    var token = '';
    try { token = bridge.httpGetStart(url); } catch (err) { cb(String(err)); return; }
    if (!token || token.indexOf('__ERR__') === 0) { cb(token ? token.slice(7) : '启动请求失败'); return; }

    var started = Date.now();
    var timer = setInterval(function () {
      var done = false, text = '', fail = '';
      try {
        var r = JSON.parse(bridge.httpGetTake(token) || '{}');
        done = !!r.done;
        text = r.text || '';
      } catch (err) { done = true; fail = '读取结果失败'; }

      if (!done && Date.now() - started > timeoutMs) { done = true; fail = '请求超时'; }
      if (!done) return;

      clearInterval(timer);
      if (fail) { cb(fail); return; }
      if (text && text.indexOf('__ERR__') === 0) { cb(text.slice(7)); return; }
      cb(null, text);
    }, 120);
  }

  function fetchJson(url, cb, timeoutMs) {
    if (hasNative()) {
      nativeGet(url, timeoutMs || 15000, function (err, txt) {
        if (err) { cb(err); return; }
        try {
          cb(null, JSON.parse(txt));
        } catch (e2) {
          cb('返回内容不是有效 JSON');
        }
      });
      return;
    }
    if (typeof fetch !== 'function') { cb('当前环境不支持网络请求'); return; }
    fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (t) {
      cb(null, JSON.parse(t));
    }).catch(function (err) {
      cb(String(err && err.message ? err.message : err));
    });
  }

  /** 单源取清单；回调里的 base 是可下载的地址 */
  function fetchOne(item, timeoutMs, cb) {
    var dl = item.dl || item.base;

    if (item.kind === 'api') {
      fetchJson(item.base + '/contents/' + MANIFEST + '?ref=main&t=' + Date.now(), function (err, data) {
        if (err || !data || !data.content) { cb(err || '无内容'); return; }
        var obj = null;
        try { obj = JSON.parse(b64utf8(data.content)); } catch (e2) { obj = null; }
        if (!obj || !obj.web) { cb('清单格式不对'); return; }
        cb(null, obj, dl);
      }, timeoutMs);
      return;
    }

    fetchJson(bust(item.base + MANIFEST), function (err, data) {
      if (err) { cb(err); return; }
      if (!data || !data.web) { cb('清单格式不对'); return; }
      cb(null, data, dl);
    }, timeoutMs);
  }

  /**
   * 一组源同时请求，最快成功的胜出。
   *
   * 串行试 6 个源、每个等 6 秒，最坏要 30 秒以上——用户早以为死机了。
   * 并发之后最坏只等一个超时（约 6 秒），而且慢的源不拖累快的。
   */
  function raceOne(items, timeoutMs, cb) {
    if (!items.length) { cb('无可用源'); return; }
    var settled = false;
    var left = items.length;
    var lastErr = '';

    for (var i = 0; i < items.length; i++) {
      (function (it) {
        fetchOne(it, timeoutMs, function (err, data, dl) {
          left--;
          if (settled) return;
          if (!err && data) {
            settled = true;
            state.tag = it.tag;
            cb(null, data, dl, it);
            return;
          }
          lastErr = err || '失败';
          if (left <= 0) cb(lastErr);
        });
      })(items[i]);
    }
  }

  /**
   * 取清单，两批就够：
   *   1) 上次通的那个源单独试一下（能用就只发一个请求，最省事）
   *   2) 国内通道整批并发：自定义 + 反代 + jsDelivr，谁先回用谁
   *   3) 直连 GitHub 兜底（挂梯子/海外才可能通）
   *
   * 以前是分三四组串行试，全都不通时要等 26 秒；国内通道合成一批后最坏 14 秒。
   */
  function fetchManifest(deadline, cb) {
    var all = bases();
    if (!all.length) { cb('还没有配置更新源'); return; }

    var good = '';
    try { good = String(Store.get(K_GOOD) || ''); } catch (e0) { good = ''; }

    var fast = [];     // 国内通道
    var slow = [];     // 直连 GitHub
    var first = null;

    for (var i = 0; i < all.length; i++) {
      var it = all[i];
      if (good && it.tag === good && !first) { first = it; continue; }
      if (it.kind === 'api' || it.tag === 'GitHub 直连' || it.tag === 'GitHub Pages') slow.push(it);
      else fast.push(it);
    }

    var groups = [];
    if (first) groups.push({ list: [first], tmo: 4500 });
    if (fast.length) groups.push({ list: fast, tmo: 6000 });
    if (slow.length) groups.push({ list: slow, tmo: 4000 });

    var idx = 0;
    function next() {
      if (idx >= groups.length) { cb('所有更新源都连不上'); return; }
      var left = deadline - Date.now();
      if (left < 2500) { cb('网络太慢，检查超时'); return; }

      var g = groups[idx++];
      raceOne(g.list, Math.min(left, g.tmo), function (err, data, dl, item) {
        if (err || !data) { next(); return; }
        try { Store.set(K_GOOD, item.tag); } catch (e1) { /* ignore */ }
        cb(null, data, dl, item);
      });
    }
    next();
  }

  /** 把清单里的相对路径补成完整地址（跟随本次成功的源）
   *  清单里的 path 以仓库根为基准（update/web/xxx.zip）。早期清单写的是 web/xxx.zip，
   *  这里统一补上 update/，否则下载地址会少一层目录直接 404。 */
  function urlOf(base, rel, altBase) {
    if (!rel) return '';
    if (/^https?:\/\//.test(rel)) return rel;
    var r = String(rel).replace(/^\/+/, '');
    if (!/^update\//.test(r)) r = 'update/' + r;
    return (base || altBase || '') + r;
  }

  /* -------------------------------------------------------- 检查更新 */

  function evaluate(manifest) {
    readInfo();
    var apkCode = Number(state.info.apkVersionCode) || 0;
    var webCode = codeOf(currentWebVersion());

    var web = null;
    var apk = null;

    var mw = manifest && manifest.web;
    if (mw && mw.code && Number(mw.code) > webCode && Number(mw.minApk || 0) <= apkCode) {
      web = {
        version: String(mw.version || ''),
        code: Number(mw.code),
        size: Number(mw.size || 0),
        sha256: String(mw.sha256 || ''),
        path: String(mw.path || ''),
        notes: String(mw.notes || manifest.notes || '')
      };
    }

    var ma = manifest && manifest.apk;
    if (ma && ma.versionCode && Number(ma.versionCode) > apkCode) {
      apk = {
        versionName: String(ma.versionName || ''),
        versionCode: Number(ma.versionCode),
        size: Number(ma.size || 0),
        sha256: String(ma.sha256 || ''),
        path: String(ma.path || ''),
        notes: String(ma.notes || manifest.notes || '')
      };
    }

    state.web = web;
    state.apk = apk;
    return !!(web || apk);
  }

  function check(force, cb) {
    if (state.checking) { if (cb) cb(); return; }
    if (!hasNative() && typeof fetch !== 'function') {
      state.error = '当前环境不支持检查更新';
      if (typeof render === 'function' && location.hash === '#/update') render(true);
      if (cb) cb();
      return;
    }
    var list = bases();
    if (!list.length) {
      state.error = '还没有配置更新源，先运行 tools/publish.py --repo 用户名/仓库名';
      state.checking = false;
      readInfo();
      if (typeof render === 'function' && location.hash === '#/update') render(true);
      if (cb) cb();
      return;
    }
    state.checking = true;
    state.error = '';
    state.tag = '';      // 别把上一次的源带进来，否则"要不要复核"会判断错
    if (typeof render === 'function' && location.hash === '#/update') render(true);
    if (typeof UPD.onChange === 'function') UPD.onChange();

    function apiSources() {
      var all = bases(), out = [];
      for (var i = 0; i < all.length; i++) {
        if (all[i].kind === 'api') out.push(all[i]);
      }
      return out;
    }

    function done(err, data, base) {
      state.checking = false;
      state.checkedAt = Date.now();
      try { Store.set(K_LAST, String(state.checkedAt)); } catch (e3) { /* ignore */ }
      if (err) {
        state.error = err;
        state.manifest = null;
        state.web = null;
        state.apk = null;
      } else {
        state.manifest = data;
        state.base = base;
        evaluate(data);   // 统一在这里算：复核换成 API 那份清单后，结论要跟着变
      }
      if (typeof render === 'function' && location.hash === '#/update') render(true);
      if (typeof UPD.onChange === 'function') UPD.onChange();
      if (cb) cb();
    }

    // 关键：render 之后必须让出主线程，浏览器才有机会把这帧画出来。
    // 之前是 render 紧接着同步发网络请求，用户点完按钮看到的还是旧界面，
    // 表现就是"点了没反应、整页卡死"。
    var deadline = Date.now() + 18000;
    setTimeout(function () {
      fetchManifest(deadline, function (err, data, base) {
        if (err) { done(err); return; }
        state.base = base;
        var found = evaluate(data);

        // 需要复核的两种情况：
        //   1) 说"没有更新"——可能是缓存在作祟，漏了新版本（假阴性）；
        //   2) 用的是 jsDelivr 这类会缓存的源——实测主节点能返回两天前的清单，
        //      照着它"更新"等于把人送回旧版本（假阳性）。
        // 反代是直连 raw 的、不缓存，有更新时就直接信它，不多发请求。
        var cachedSrc = !!state.tag && /jsdelivr|Pages/i.test(state.tag);
        if ((!found || cachedSrc) && base.indexOf('api.github.com') < 0) {
          var again = apiSources();
          if (again.length) {
            raceOne(again, Math.min(Math.max(deadline - Date.now(), 3000), 8000), function (e2, d2, b2) {
              // API 不走 CDN，它的清单是准的：能拿到就以它为准
              if (!e2 && d2 && d2.web) {
                done(null, d2, b2);
                return;
              }
              done(null, data, base);
            });
            return;
          }
        }
        done(null, data, base);
      });
    }, 20);
  }

  /** 逐个测速：给"为什么连不上"一个看得见的答案 */
  function diag() {
    if (state.diagBusy) return;
    var all = bases();
    if (!all.length) return;

    state.diagBusy = true;
    state.diag = [];
    for (var i = 0; i < all.length; i++) {
      state.diag.push({ tag: all[i].tag, state: 'wait', ms: 0, err: '' });
    }
    if (typeof render === 'function' && location.hash === '#/update') render(true);

    var idx = 0;
    function step() {
      if (idx >= all.length) {
        state.diagBusy = false;
        if (typeof render === 'function' && location.hash === '#/update') render(true);
        return;
      }
      var n = idx++;
      var t0 = Date.now();
      fetchOne(all[n], 8000, function (err) {
        state.diag[n].state = err ? 'fail' : 'ok';
        state.diag[n].ms = Date.now() - t0;
        state.diag[n].err = err || '';
        if (typeof render === 'function' && location.hash === '#/update') render(true);
        step();
      });
    }
    step();
  }

  function editBase() {
    state.editingBase = !state.editingBase;
    if (state.editingBase) {
      try { state.baseInput = String(Store.get(K_BASE) || ''); } catch (e) { state.baseInput = ''; }
    }
    if (typeof render === 'function') render(true);
  }

  function typeBase(v) {
    state.baseInput = v;       // 只存值，不重绘，否则输入框会失焦
  }

  function saveBase() {
    var v = String(state.baseInput || '').trim();
    try {
      Store.set(K_BASE, v);
      Store.remove(K_GOOD);    // 换了源，之前那个"可用源"的记录作废
    } catch (e) { /* ignore */ }
    state.editingBase = false;
    state.base = '';
    state.tag = '';
    state.diag = [];
    if (typeof render === 'function') render(true);
  }

  /** 启动时静默检查：有原生桥、距上次超过 6 小时才查，失败不打扰 */
  function autoMaybe() {
    try {
      if (!hasNative()) return;
      if (Store.get(K_AUTO) === '0') return;
      var last = Number(Store.get(K_LAST) || 0) || 0;
      if (Date.now() - last < 6 * 3600 * 1000) return;
      setTimeout(function () { check(false); }, 2500);
    } catch (err) { /* ignore */ }
  }

  function autoOn() {
    try { return Store.get(K_AUTO) !== '0'; } catch (err) { return true; }
  }

  function toggleAuto() {
    try { Store.set(K_AUTO, autoOn() ? '0' : '1'); } catch (err) { /* ignore */ }
    if (typeof render === 'function') render(true);
  }

  /* -------------------------------------------------------- 执行更新 */

  function parseRes(s) {
    try { return JSON.parse(s || '{}'); } catch (err) { return { ok: false, message: '返回内容异常' }; }
  }

  function startPoll() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      var p = null;
      try { p = JSON.parse(bridge.progress() || '{}'); } catch (err) { p = null; }
      if (!p) return;
      state.task = p;
      if (p.phase === 'done' || p.phase === 'error') {
        clearInterval(pollTimer);
        pollTimer = null;
        onTaskEnd(p);
      }
      if (typeof render === 'function' && location.hash === '#/update') render(true);
      if (typeof UPD.onChange === 'function') UPD.onChange();
    }, 400);
  }

  var pending = '';   // 任务结束后要做的事：reload | install

  function onTaskEnd(p) {
    if (p.phase === 'error') {
      state.error = p.message || '更新失败';
      return;
    }
    if (p.kind === 'web') {
      state.error = '';
      pending = 'reload';
      // 让用户先看到"已完成"，随后整页重载（页面重载后本函数上下文消失，属正常）
      setTimeout(function () {
        if (hasNative()) { readInfo(); try { bridge.reloadPage(); } catch (err) { location.reload(); } }
        else location.reload();
      }, 700);
    } else if (p.kind === 'apk') {
      pending = 'install';
    }
  }

  function applyWeb() {
    if (!state.web) return;
    var u = urlOf(state.base, state.web.path);
    state.error = '';
    var r = parseRes(bridge.startWebUpdate(u, state.web.sha256, state.web.version, state.web.size));
    if (!r.ok) { state.error = r.message || '无法开始下载'; render(true); return; }
    state.task = { kind: 'web', phase: 'download', pct: 0, message: '正在下载' };
    render(true);
    startPoll();
  }

  function applyApk() {
    if (!state.apk) return;
    var u = urlOf(state.base, state.apk.path);
    state.error = '';
    var r = parseRes(bridge.startApkUpdate(u, state.apk.sha256, state.apk.versionName, state.apk.size));
    if (!r.ok) { state.error = r.message || '无法开始下载'; render(true); return; }
    state.task = { kind: 'apk', phase: 'download', pct: 0, message: '正在下载' };
    render(true);
    startPoll();
  }

  function install() {
    if (!hasNative()) return;
    var r = parseRes(bridge.installApk());
    if (r.needPermission) {
      state.error = '请先允许本应用安装应用，再点一次安装';
      render(true);
      return;
    }
    if (!r.ok) { state.error = r.message || '调起安装失败'; render(true); }
  }

  function rollback() {
    if (!hasNative()) return;
    var r = parseRes(bridge.clearWeb());
    if (!r.ok) { state.error = r.message || '回退失败'; render(true); return; }
    setTimeout(function () { try { bridge.reloadPage(); } catch (err) { location.reload(); } }, 300);
  }

  function busy() {
    var p = state.task;
    return !!p && (p.phase === 'download' || p.phase === 'verify' || p.phase === 'extract');
  }

  /* -------------------------------------------------------- 界面 */

  function versionRows() {
    var info = readInfo();
    var webV = info.webVersion || (String(typeof APP_VERSION === 'string' ? APP_VERSION : '') + '（内置）');
    var rows = [
      ['安装包版本', (info.apkVersionName || '—') + (info.apkVersionCode ? '（' + info.apkVersionCode + '）' : '')],
      ['网页版本', webV],
      ['上次检查', timeText(state.checkedAt || Number(Store.get(K_LAST) || 0))]
    ];
    return rows.map(function (r) {
      return '<div class="upd-kv"><span>' + e(r[0]) + '</span><span>' + e(r[1]) + '</span></div>';
    }).join('');
  }

  function progressBlock() {
    var p = state.task;
    if (!p) return '';
    if (p.phase === 'done') {
      if (pending === 'install') {
        return '<div class="upd-panel ok">'
          + '<div class="upd-panel-t">安装包已下载</div>'
          + '<div class="upd-panel-d">点下面的按钮调起系统安装界面；装完打开就是新版本。</div>'
          + '<button class="btn primary block" style="margin-top:12px" onclick="UPD.install()">安装新版本</button>'
          + '</div>';
      }
      return '<div class="upd-panel ok"><div class="upd-panel-t">网页已更新</div>'
        + '<div class="upd-panel-d">正在重新加载页面…</div></div>';
    }
    if (p.phase === 'error') return '';
    var pct = Math.max(2, Math.min(100, Number(p.pct) || 0));
    return '<div class="upd-panel">'
      + '<div class="upd-panel-t">' + e(p.message || '处理中') + '</div>'
      + '<div class="upd-prog"><i style="width:' + pct + '%"></i></div>'
      + '<div class="upd-panel-d">' + pct + '%</div>'
      + '</div>';
  }

  function card(title, verLine, meta, notes, action, actionText, hint) {
    return '<div class="upd-card">'
      + '<div class="upd-card-h"><div class="upd-card-t">' + e(title) + '</div>'
      + '<div class="upd-badge">' + e(verLine) + '</div></div>'
      + (meta ? '<div class="upd-card-m">' + meta + '</div>' : '')
      + (notes ? '<div class="upd-note">' + e(notes) + '</div>' : '')
      + '<button class="btn primary block" style="margin-top:12px"' + (action ? ' onclick="' + action + '"' : ' disabled') + '>'
      + e(actionText) + '</button>'
      + (hint ? '<div class="upd-card-m" style="margin-top:8px">' + hint + '</div>' : '')
      + '</div>';
  }

  /** 更新源那一行的说明文字 */
  function srcDesc() {
    if (state.base) return (state.tag ? state.tag + ' · ' : '') + state.base;

    var custom = '';
    try { custom = String(Store.get(K_BASE) || '').trim(); } catch (e) { custom = ''; }
    if (custom) return '自定义：' + custom;

    var n = bases().length;
    return '自动选择（' + n + ' 个候选，优先国内通道）';
  }

  function baseEditor() {
    return '<div class="upd-edit">'
      + '<input class="upd-input" type="url" inputmode="url" spellcheck="false"'
      + ' placeholder="https://你的镜像地址/"'
      + ' value="' + e(state.baseInput || '') + '"'
      + ' oninput="UPD.typeBase(this.value)">'
      + '<div class="upd-edit-d">填到能取到 <b>latest.json</b> 的那一层（一般是 <code>…/update/</code>）。'
      + '留空 = 用内置的国内通道自动选。公司内网镜像、自建反向代理都填这里。</div>'
      + '<div class="upd-edit-btns">'
      + '<button class="btn ghost" onclick="UPD.editBase()">取消</button>'
      + '<button class="btn primary" onclick="UPD.saveBase()">保存</button>'
      + '</div></div>';
  }

  /** 把网络异常翻译成一句人话——"不通"两个字没法判断该换网络还是换源 */
  function errText(err) {
    var s = String(err || '');
    if (!s) return '不通';
    if (/白名单/.test(s)) return '被应用拦下';
    if (/timeout|超时/i.test(s)) return '连接超时';
    if (/UnknownHost|resolve|解析/i.test(s)) return '域名解析失败';
    if (/SSL|Cert|证书/i.test(s)) return '证书校验失败';
    if (/refused|拒绝/i.test(s)) return '连接被拒绝';
    var m = s.match(/HTTP\s*(\d{3})/i);
    if (m) return '服务器返回 ' + m[1];
    return s.length > 22 ? s.slice(0, 22) + '…' : s;
  }

  /** 网络诊断：把每个通道的连通性和耗时列出来 */
  function diagBlock() {
    var rows = '';
    for (var i = 0; i < state.diag.length; i++) {
      var d = state.diag[i];
      var cls = d.state === 'ok' ? 'ok' : (d.state === 'fail' ? 'fail' : 'wait');
      var right = d.state === 'ok' ? (d.ms + ' ms') : (d.state === 'fail' ? errText(d.err) : '测试中');
      rows += '<div class="upd-diag-row ' + cls + '"' + (d.err ? ' title="' + e(d.err) + '"' : '') + '>'
        + '<span class="upd-diag-tag">' + e(d.tag) + '</span>'
        + '<span class="upd-diag-r">' + e(right) + '</span>'
        + '</div>';
    }

    return '<div class="sec">'
      + '<div class="sec-head"><div class="sec-title">网络诊断</div>'
      + '<div class="sec-desc">' + (state.diagBusy ? '测试中…' : '看哪个通道能用') + '</div></div>'
      + '<div class="upd-card">'
      + '<div class="upd-card-m">国内网络直连 GitHub 通常不通，App 会自动改用加速通道。'
      + '这里能看出每条通道卡在哪一步：「连接超时」是网络拦了，「域名解析失败」是运营商 DNS 不给解析。'
      + '全部都不通就说明这条线路上这些域名被拦了，换个网络（比如开热点）再试。</div>'
      + '<button class="btn ghost block" style="margin-top:12px"'
      + (state.diagBusy ? ' disabled' : ' onclick="UPD.diag()"') + '>'
      + (state.diagBusy ? '正在测试…' : '测试各通道') + '</button>'
      + (rows ? '<div class="upd-diag-list">' + rows + '</div>' : '')
      + '</div></div>';
  }

  /* ====================================================== 更新说明
   * 两块分开写：
   *   应用更新说明（APP_NOTES）—— 界面 / 性能 / 修 BUG / 更新链路
   *   规则更新说明（RULE_UPDATES）—— 公司办理规定的更正、通报里学到的经验
   * 混在一起用户就分不清"是我的票要改，还是软件变了"。
   */
  function noteDate(d) {
    var a = String(d || '').split('-');
    if (a.length < 3) return String(d || '');
    return (+a[1]) + ' 月 ' + (+a[2]) + ' 日';
  }

  function noteDateFull(d) {
    var a = String(d || '').split('-');
    if (a.length < 3) return { main: String(d || ''), sub: '' };
    var y = +a[0], m = +a[1], day = +a[2];
    var wk = '日一二三四五六'[new Date(y, m - 1, day).getDay()];
    return { main: m + ' 月 ' + day + ' 日', sub: y + ' 年 · 周' + wk };
  }

  function bulletList(items) {
    if (!items || !items.length) return '';
    return '<ul class="tl-list">' + items.map(function (x) {
      return '<li>' + e(x) + '</li>';
    }).join('') + '</ul>';
  }

  /** 应用更新说明的内容：只讲 App 自己变了什么 */
  function appNotesBody() {
    var list = (typeof APP_NOTES === 'undefined' || !APP_NOTES) ? [] : APP_NOTES.slice();
    if (!list.length) return '';
    list.sort(function (a, b) {
      return a.ver < b.ver ? 1 : (a.ver > b.ver ? -1 : 0);
    });

    return list.map(function (n) {
      return '<div class="upd-card">'
        + '<div class="upd-card-h"><div class="upd-card-t">v' + e(n.ver) + '</div>'
        + '<div class="upd-badge">' + e(noteDate(n.date)) + '</div></div>'
        + '<div class="an-t">' + e(n.title) + '</div>'
        + bulletList(n.items)
        + '</div>';
    }).join('');
  }

  /** 规则更新说明：公司规定更正 + 从通报里学到的 */
  var R_TAG = { '新增': 'new', '修订': 'fix', '口径': 'cal', '审计': 'audit' };

  function ruleCard(u) {
    var cls = R_TAG[u.tag] || 'fix';
    var chips = '';
    if (typeof PERMIT_MAP !== 'undefined') {
      var ids = (u.scope || []).filter(function (id) { return PERMIT_MAP[id]; });
      chips = ids.length
        ? ids.map(function (id) {
          return '<button class="tl-chip on" onclick="openPermit(\'' + id + '\',\'overview\')">'
            + e(PERMIT_MAP[id].short) + '</button>';
        }).join('')
        : '<span class="tl-chip">全票种</span>';
    }
    return '<div class="tl-item ' + cls + '">'
      + '<div class="tl-card">'
      + '<div class="tl-top"><span class="tl-tag ' + cls + '">' + e(u.tag) + '</span>'
      + '<span class="tl-ver">v' + e(u.ver) + '</span></div>'
      + '<div class="tl-t">' + e(u.title) + '</div>'
      + '<div class="tl-d">' + e(u.detail) + '</div>'
      + bulletList(u.items)
      + (chips ? '<div class="tl-scope">' + chips + '</div>' : '')
      + '<div class="tl-src">来源 · ' + e(u.src) + '</div>'
      + '</div></div>';
  }

  /** 规则更新说明的内容：公司规定更正 + 从通报里学到的 */
  function ruleNotesBody() {
    var list = (typeof RULE_UPDATES === 'undefined' || !RULE_UPDATES) ? [] : RULE_UPDATES.slice();
    if (!list.length) return '';
    list.sort(function (a, b) {
      return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0);
    });

    /* 同一天的改动收在一个日期标题下面 */
    var groups = [];
    for (var i = 0; i < list.length; i++) {
      var g = groups[groups.length - 1];
      if (g && g.date === list[i].date) g.list.push(list[i]);
      else groups.push({ date: list[i].date, list: [list[i]] });
    }

    return groups.map(function (grp) {
      var d = noteDateFull(grp.date);
      return '<div style="margin-bottom:20px">'
        + '<div class="tl-date"><b>' + e(d.main) + '</b><span>' + e(d.sub) + '</span>'
        + '<span class="tl-date-n">' + grp.list.length + ' 条</span></div>'
        + '<div class="tl-flow">' + grp.list.map(ruleCard).join('') + '</div>'
        + '</div>';
    }).join('');
  }

  /* 两块说明用分段控件左右切换，和票种详情页的「概览 / 填写要点」一个做法 */
  function setNotesTab(k) {
    if (state.notesTab === k) return;
    state.notesTab = k;
    if (typeof render === 'function') render(true);
  }

  function notesBlock() {
    var n = {
      app: (typeof APP_NOTES !== 'undefined' && APP_NOTES) ? APP_NOTES.length : 0,
      rule: (typeof RULE_UPDATES !== 'undefined' && RULE_UPDATES) ? RULE_UPDATES.length : 0
    };
    if (!n.app && !n.rule) return '';
    var cur = state.notesTab === 'rule' ? 'rule' : 'app';

    var tabs = [
      { k: 'app', label: '应用更新说明' },
      { k: 'rule', label: '规则更新说明' }
    ].map(function (t) {
      if (!n[t.k]) return '';
      return '<button class="seg-btn ' + (cur === t.k ? 'active' : '') + '"'
        + ' onclick="UPD.setNotesTab(\'' + t.k + '\')">' + e(t.label)
        + '<i class="seg-n">' + n[t.k] + '</i></button>';
    }).join('');

    var body = cur === 'rule' ? ruleNotesBody() : appNotesBody();
    var desc = cur === 'rule'
      ? '公司规定更正 · 通报里学到的经验'
      : '界面 · 性能 · 问题修复';

    return '<div class="sec">'
      + '<div class="segmented block">' + tabs + '</div>'
      + '<div class="upd-tab-desc">' + desc + '</div>'
      + body + '</div>';
  }

  function view() {
    readInfo();
    var info = state.info;
    var head;

    if (!hasNative()) {
      head = '<div class="upd-card"><div class="upd-card-t">网页版</div>'
        + '<div class="upd-note">浏览器里打开的版本不需要装包：刷新页面就是最新。'
        + '安装包只在安卓 App 内可以下载。</div></div>';
    } else {
      head = '';
    }

    var statusLine = '';
    if (state.checking) {
      statusLine = '<div class="upd-card-m" style="margin-top:10px">正在检查…</div>';
    } else if (state.error) {
      statusLine = '<div class="upd-card-m err" style="margin-top:10px">' + e(state.error) + '</div>';
    } else if (state.checkedAt) {
      statusLine = '<div class="upd-card-m" style="margin-top:10px">'
        + (state.web || state.apk ? '有新版本可用' : '已是最新版本') + '</div>';
    }

    var body = '';
    if (busy() || (state.task && state.task.phase === 'done')) {
      body = progressBlock();
    } else if (state.apk) {
      var a = state.apk;
      body = card('安装包升级', 'v' + a.versionName + '（' + a.versionCode + '）',
        '大小 ' + sizeText(a.size) + ' · 装完自动带最新网页内容', a.notes,
        'UPD.applyApk()', '下载安装包');
    } else if (state.web) {
      var w = state.web;
      body = card('网页热更新', 'v' + w.version,
        '大小 ' + sizeText(w.size) + ' · 几秒完成，不用装包', w.notes,
        'UPD.applyWeb()', '立即更新（推荐）');
    }

    /* 有安装包更新时，热更新只作为备选 */
    var secondary = '';
    if (state.apk && state.web && !busy()) {
      secondary = '<div class="upd-card">'
        + '<div class="upd-card-t">也可以只更新网页</div>'
        + '<div class="upd-note">v' + e(state.web.version) + ' 的网页包（' + e(sizeText(state.web.size)) + '）。'
        + '不装包就能用上新规则、新文案；但原生相关的变化要等安装包升级才生效。</div>'
        + '<button class="btn ghost block" style="margin-top:12px" onclick="UPD.applyWeb()">只更新网页</button>'
        + '</div>';
    }

    var adv = '';
    if (info.webApplied) {
      adv = '<div class="sec">'
        + '<div class="sec-head"><div class="sec-title">高级</div></div>'
        + '<div class="row-list">'
        + '<div class="row-item" onclick="UPD.rollback()" style="cursor:pointer">'
        + '<div class="ri-main"><div class="ri-t">回退到内置版本</div>'
        + '<div class="ri-d">删掉已应用的热更新，回到安装包自带的网页</div></div>'
        + '<span class="ri-arrow">' + (window.IC && IC.arrow ? IC.arrow : '›') + '</span></div>'
        + '</div></div>';
    }

    return ''
      + '<div class="sec" style="margin-top:6px">'
      + '<div class="card pad">'
      + '<div class="upd-ver">作业票助手</div>'
      + '<div class="upd-kvs">' + versionRows() + '</div>'
      + '<button class="btn ' + (state.checking ? '' : 'primary') + ' block" style="margin-top:14px"'
      + (state.checking ? ' disabled' : ' onclick="UPD.check(true)"') + '>'
      + (state.checking ? '正在检查…' : '检查更新') + '</button>'
      + statusLine
      + '</div></div>'
      + head
      + (body ? '<div class="sec">' + body + '</div>' : '')
      + (secondary ? '<div class="sec">' + secondary + '</div>' : '')
      + notesBlock()
      + '<div class="sec">'
      + '<div class="sec-head"><div class="sec-title">更新设置</div></div>'
      + '<div class="row-list">'
      + '<div class="row-item" style="cursor:default">'
      + '<div class="ri-main"><div class="ri-t">启动时自动检查</div>'
      + '<div class="ri-d">最多每 6 小时查一次，只提示不自动安装</div></div>'
      + '<button class="switch ' + (autoOn() ? 'on' : '') + '" onclick="UPD.toggleAuto()" aria-label="自动检查"></button>'
      + '</div>'
      + '<div class="row-item" style="cursor:pointer" onclick="UPD.editBase()">'
      + '<div class="ri-main"><div class="ri-t">更新源</div>'
      + '<div class="ri-d" style="white-space:normal">' + e(srcDesc()) + '</div></div>'
      + '<span class="ri-arrow">' + ((window.IC && IC.arrow) ? IC.arrow : '›') + '</span>'
      + '</div>'
      + (state.editingBase ? baseEditor() : '')
      + '</div></div>'
      + diagBlock()
      + adv
      + '<div class="sec"><div class="upd-foot">更新只改网页文件或安装包本身，'
      + '不会动你的模型配置和对话记录（它们存在本机文件里）。</div></div>';
  }

  /** 首页提示条：检查到更新时显示 */
  function homeBar() {
    if (!(state.web || state.apk)) return '';
    var txt = state.apk
      ? ('发现新版本 ' + state.apk.versionName)
      : ('网页可热更新到 ' + state.web.version);
    return '<button class="upd-bar" onclick="navigate(\'/update\')">'
      + '<span class="upd-bar-ic">' + (window.IC && IC.up ? IC.up : '↑') + '</span>'
      + '<span class="upd-bar-t">' + e(txt) + '</span>'
      + '<span class="upd-bar-a">查看</span>'
      + '</button>';
  }

  window.UPD = {
    version: '1.0',
    state: state,
    hasNative: hasNative,
    info: readInfo,
    currentWebVersion: currentWebVersion,
    check: function (force) { check(force); },
    autoMaybe: autoMaybe,
    autoOn: autoOn,
    toggleAuto: toggleAuto,
    applyWeb: applyWeb,
    applyApk: applyApk,
    install: install,
    rollback: rollback,
    busy: busy,
    view: view,
    setNotesTab: setNotesTab,
    homeBar: homeBar,
    setBase: function (u) { try { Store.set(K_BASE, String(u || '')); } catch (err) { /* ignore */ } },
    diag: diag,
    editBase: editBase,
    typeBase: typeBase,
    saveBase: saveBase,
    onChange: null
  };
})();
