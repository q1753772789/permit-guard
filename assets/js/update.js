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
    base: ''        // 本次成功拉取清单的源
  };

  /* -------------------------------------------------------- 小工具 */

  function e(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hasNative() {
    return !!bridge && typeof bridge.info === 'function' && typeof bridge.httpGet === 'function';
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

  function bases() {
    var list = [];
    var custom = '';
    try { custom = Store.get(K_BASE) || ''; } catch (err) { custom = ''; }
    if (custom) list.push(String(custom).replace(/\/+$/, '') + '/');

    if (REPO && REPO.indexOf('@@') < 0 && REPO.indexOf('/') > 0) {
      var owner = REPO.split('/')[0];
      var repo = REPO.split('/')[1];
      // raw 最新但要能连上 github；jsDelivr 国内通常更快（分支缓存最多 12 小时，作为备选）
      list.push('https://raw.githubusercontent.com/' + REPO + '/main/');
      list.push('https://cdn.jsdelivr.net/gh/' + REPO + '@main/');
      list.push('https://' + owner + '.github.io/' + repo + '/');
    }
    return list;
  }

  function bust(url) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
  }

  function fetchJson(url, cb) {
    if (hasNative()) {
      var txt = '';
      try { txt = bridge.httpGet(url); } catch (err) { txt = '__ERR__:' + err; }
      if (txt && txt.indexOf('__ERR__') === 0) { cb(txt.slice(7)); return; }
      try {
        cb(null, JSON.parse(txt));
      } catch (err) {
        cb('返回内容不是有效 JSON');
      }
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

  /** 依次尝试各个源，第一个成功的胜出 */
  function fetchManifest(list, idx, cb) {
    if (idx >= list.length) { cb('所有更新源都连不上'); return; }
    var base = list[idx];
    fetchJson(bust(base + MANIFEST), function (err, data) {
      if (!err && data && data.web) { cb(null, data, base); return; }
      fetchManifest(list, idx + 1, cb);
    });
  }

  /** 把清单里的相对路径补成完整地址（跟随本次成功的源） */
  function urlOf(base, rel, altBase) {
    if (!rel) return '';
    if (/^https?:\/\//.test(rel)) return rel;
    return (base || altBase || '') + rel.replace(/^\/+/, '');
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
    if (typeof render === 'function' && location.hash === '#/update') render(true);
    if (typeof UPD.onChange === 'function') UPD.onChange();

    fetchManifest(list, 0, function (err, data, base) {
      state.checking = false;
      state.checkedAt = Date.now();
      try { Store.set(K_LAST, String(state.checkedAt)); } catch (err2) { /* ignore */ }
      if (err) {
        state.error = err;
        state.manifest = null;
        state.web = null;
        state.apk = null;
      } else {
        state.manifest = data;
        state.base = base;
        evaluate(data);
      }
      if (typeof render === 'function' && location.hash === '#/update') render(true);
      if (typeof UPD.onChange === 'function') UPD.onChange();
      if (cb) cb();
    });
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
      + '<div class="sec">'
      + '<div class="sec-head"><div class="sec-title">更新设置</div></div>'
      + '<div class="row-list">'
      + '<div class="row-item" style="cursor:default">'
      + '<div class="ri-main"><div class="ri-t">启动时自动检查</div>'
      + '<div class="ri-d">最多每 6 小时查一次，只提示不自动安装</div></div>'
      + '<button class="switch ' + (autoOn() ? 'on' : '') + '" onclick="UPD.toggleAuto()" aria-label="自动检查"></button>'
      + '</div>'
      + '<div class="row-item" style="cursor:default">'
      + '<div class="ri-main"><div class="ri-t">更新源</div>'
      + '<div class="ri-d" style="white-space:normal">' + e(state.base || (bases()[0] || '未配置')) + '</div></div>'
      + '</div>'
      + '</div></div>'
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
    homeBar: homeBar,
    setBase: function (u) { try { Store.set(K_BASE, String(u || '')); } catch (err) { /* ignore */ } },
    onChange: null
  };
})();
