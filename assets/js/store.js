/* ============================================================
 * 本机存储（Store）
 *
 * 为什么要这一层：
 * 安卓壳用本机回环服务（http://127.0.0.1:<端口>）打开页面，
 * 而 localStorage 是按「协议 + 域名 + 端口」隔离的。
 * 只要端口变了，就等于换了一个存储空间，之前存的东西全部读不到
 * （表现为：设置和对话记录在重启后"消失"）。
 *
 * 所以这里做两层：
 *   1) 优先读原生文件备份（window.NativeStore，由安卓壳注入），完全不受端口影响；
 *   2) localStorage 只做镜像/缓存，浏览器里没有原生桥时仍然可用。
 *
 * 所有业务代码统一走 Store.get / Store.set / Store.remove，
 * 不要再直接调 localStorage。
 * ============================================================ */
(function () {
  var bridge = (typeof window !== 'undefined') ? window.NativeStore : null;

  function hasBridge() {
    return !!bridge && typeof bridge.get === 'function';
  }

  function safeLsGet(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function safeLsSet(k, v) {
    try { localStorage.setItem(k, v); } catch (e) { /* 配额满或隐私模式 */ }
  }
  function safeLsDel(k) {
    try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
  }

  var Store = {
    /** 读取；原生备份优先，localStorage 兜底 */
    get: function (key) {
      if (hasBridge()) {
        try {
          var nv = bridge.get(key);
          if (nv !== null && nv !== undefined && nv !== '') {
            // 顺手镜像一份，浏览器调试时也能看到
            if (safeLsGet(key) !== nv) safeLsSet(key, nv);
            return nv;
          }
        } catch (e) { /* 桥异常，走下面的兜底 */ }
      }
      return safeLsGet(key);
    },

    /** 写入：先落原生文件（同步），再写 localStorage 镜像 */
    set: function (key, value) {
      if (value === null || value === undefined) { Store.remove(key); return; }
      var v = String(value);
      if (hasBridge()) {
        try { bridge.set(key, v); } catch (e) { /* ignore */ }
      }
      safeLsSet(key, v);
    },

    remove: function (key) {
      if (hasBridge()) {
        try { bridge.remove(key); } catch (e) { /* ignore */ }
      }
      safeLsDel(key);
    },

    /** 启动时把原生备份里 localStorage 缺的 key 补回来（防守：万一有代码漏改直接用了 localStorage） */
    hydrate: function () {
      if (!hasBridge()) return;
      var keys = [];
      try { keys = JSON.parse(bridge.keys() || '[]'); } catch (e) { return; }
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (safeLsGet(k) !== null) continue;
        try {
          var v = bridge.get(k);
          if (v) safeLsSet(k, v);
        } catch (e) { /* ignore */ }
      }
    },

    /** 是否有原生备份（设置页用来提示"已本机保存"） */
    native: function () { return hasBridge(); }
  };

  window.Store = Store;
  Store.hydrate();
})();
