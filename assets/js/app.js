/* ============================================================
 * 作业票助手 · 应用主逻辑
 * ============================================================ */

/* -------------------------------------------------------- 图标 */
const IC = {
  search: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  back: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  alert: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9.5 17H2.5L12 3z"/><path d="M12 9v5"/><circle cx="12" cy="17.6" r=".9" fill="currentColor" stroke="none"/></svg>',
  warn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 8v5"/><circle cx="12" cy="16.6" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9"/></svg>',
  sparkle: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l1.9 5.1 5.1 1.9-5.1 1.9L12 16.6l-1.9-5.1L5 9.6l5.1-1.9L12 2.6z"/><path d="M18.6 15.2l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4z" opacity=".55"/></svg>',
  send: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4l17.5-8.4c.6-.3.6-1.2 0-1.5L3.4 2.1c-.5-.2-1 .2-.9.7l1.5 6.3c.1.4.4.6.8.7l8.9 1.6-8.9 1.6c-.4.1-.7.3-.8.7l-1.5 6.3c-.1.5.4.9.9.7z"/></svg>',
  image: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3.5"/><circle cx="8.6" cy="9.6" r="1.7"/><path d="M3.6 17.2l4.6-4.3a2 2 0 0 1 2.7 0l3 2.8"/><path d="M14.2 14.6l1.9-1.7a2 2 0 0 1 2.7 0l1.7 1.6"/></svg>',
  stop: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="3"/></svg>',
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6a3 3 0 0 0-3 3v6.5A2.5 2.5 0 0 0 5.5 15"/></svg>',
  check: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',

  flame: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5s5.5 4.2 5.5 9.5a5.5 5.5 0 0 1-11 0c0-2 .9-3.6 1.9-4.8.6 1.6 1.5 2.5 2.4 2.8C11.6 7.6 12 4.9 12 2.5z"/><path d="M12 21v-3"/></svg>',
  box: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l9-5 9 5v7l-9 5-9-5v-7z"/><path d="M3 8.5l9 5 9-5"/><path d="M12 13.5V21"/></svg>',
  up: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V5"/><path d="M5.5 11.5L12 5l6.5 6.5"/><path d="M4 21h16"/></svg>',
  hook: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9a5 5 0 0 0 10 0"/><path d="M12 3a2 2 0 1 0 0-.001z"/><path d="M7 20h10"/><path d="M12 17v3"/><circle cx="7" cy="6" r="2.2"/></svg>',
  plug: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3v5"/><path d="M15 3v5"/><path d="M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0V8z"/><path d="M12 17v4"/></svg>',
  shovel: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3.5l6 6"/><path d="M17.5 6.5L9 15"/><path d="M9 15l-4.5 1.2a1 1 0 0 0-.7 1.4l3.6 3.6a1 1 0 0 0 1.4-.7L10 16"/><path d="M3 21l2-2"/></svg>',
  disc: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/><path d="M12 3.5v3.4M12 17.1v3.4M3.5 12h3.4M17.1 12h3.4"/></svg>',
  road: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 3L4 21"/><path d="M16.5 3L20 21"/><path d="M12 4.5v2.5M12 10.5V13M12 16.5V19"/></svg>',

  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5L12 4l8 6.5V20a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20v-9.5z"/><path d="M9.5 21.5v-6h5v6"/></svg>',
  gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a1.9 1.9 0 1 1-3.8 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a1.9 1.9 0 1 1 0-3.8h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a1.9 1.9 0 1 1 3.8 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a1.9 1.9 0 1 1 0 3.8h-.2a1.6 1.6 0 0 0-1.4 1z"/></svg>',
  wand: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20L15 9"/><path d="M17.5 3l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5z"/><path d="M6.5 4l.7 1.8L9 6.5l-1.8.7L6.5 9l-.7-1.8L4 6.5l1.8-.7L6.5 4z"/></svg>',
  chat: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8 8 0 0 1-8 8H8l-4 2.5v-4.2A8 8 0 0 1 13 3.5a8 8 0 0 1 8 8z"/><path d="M9 11.5h8"/><path d="M9 15h5"/></svg>',
  shield: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7.5 3v6c0 4.4-3 7.6-7.5 9-4.5-1.4-7.5-4.6-7.5-9V6L12 3z"/><path d="M12 8.5v4"/><circle cx="12" cy="15.6" r="1" fill="currentColor" stroke="none"/></svg>',
  clock: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 2"/></svg>'
};

function permitIcon(p, size) {
  const svg = IC[p.icon] || IC.flame;
  return svg.replace('width="22" height="22"', `width="${size || 22}" height="${size || 22}"`);
}

/* -------------------------------------------------------- 工具 */
const $ = sel => document.querySelector(sel);
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * (1 + amt))));
  g = Math.max(0, Math.min(255, Math.round(g * (1 + amt))));
  b = Math.max(0, Math.min(255, Math.round(b * (1 + amt))));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* 轻量 Markdown → HTML（流式安全） */
function md(src) {
  let t = esc(src || '');
  t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

  const lines = t.split('\n');
  const out = [];
  let list = null;

  const closeList = () => { if (list) { out.push('</' + list + '>'); list = null; } };

  for (let raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }

    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      closeList();
      const lv = Math.min(4, m[1].length + 1);
      out.push(`<h${lv}>${m[2]}</h${lv}>`);
      continue;
    }
    if ((m = line.match(/^\s*[-*·]\s+(.*)$/))) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push('<li>' + m[1] + '</li>');
      continue;
    }
    if ((m = line.match(/^\s*(\d+)[.、)]\s+(.*)$/))) {
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push('<li>' + m[2] + '</li>');
      continue;
    }
    if (line.startsWith('&gt;')) {
      closeList();
      out.push('<p style="opacity:.75;border-left:3px solid var(--hairline-strong);padding-left:10px;margin:8px 0">' + line.replace(/^&gt;\s?/, '') + '</p>');
      continue;
    }
    closeList();
    out.push('<p>' + line + '</p>');
  }
  closeList();
  return out.join('');
}

/* -------------------------------------------------------- 状态 */
const STATE = {
  route: '',
  detailTab: 'overview',
  measureFilter: 'all',
  search: '',
  wz: { permit: 'hot', sel: {}, rel: {} },
  chat: [],
  attached: [],
  streaming: false,
  abort: null
};

/* -------------------------------------------------------- 路由 */
function parseHash() {
  const h = (location.hash || '#/').replace(/^#/, '') || '/';
  return h;
}

function navigate(path) {
  location.hash = '#' + path;
}

/* -------------------------------------------------------- 顶栏 */
function renderTopbar(route) {
  const el = $('#tb-row');
  if (route === '/' || route === '') {
    el.innerHTML = `
      <div style="flex:1">
        <div class="tb-title">作业票助手</div>
        <div class="tb-sub">8 类特殊作业票 · 官方填写标准</div>
      </div>
      <button class="icon-btn ghost" onclick="navigate('/update')" aria-label="最近更新">${IC.clock}</button>
      <button class="icon-btn ghost" onclick="goSettings()" aria-label="设置">${IC.gear}</button>
    `;
    return;
  }
  if (route.startsWith('/p/')) {
    const p = PERMIT_MAP[route.split('/')[2]];
    el.innerHTML = `
      <button class="icon-btn ghost" onclick="history.back()" aria-label="返回">${IC.back}</button>
      <div style="flex:1;min-width:0">
        <div class="tb-title small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p ? p.name : ''}</div>
      </div>
      <button class="icon-btn ghost" onclick="askAI('${p ? p.id : ''}')" aria-label="问 AI">${IC.sparkle}</button>
    `;
    return;
  }
  if (route === '/ai') {
    el.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="tb-title small">AI 审票助手</div>
        <div class="tb-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(AI.summary())}</div>
      </div>
      <button class="icon-btn ghost" onclick="newChat()" aria-label="新对话">${IC.copy}</button>
      <button class="icon-btn ghost" onclick="goSettings()" aria-label="设置">${IC.gear}</button>
    `;
    return;
  }
  if (route === '/settings') {
    el.innerHTML = `
      <button class="icon-btn ghost" onclick="history.back()" aria-label="返回">${IC.back}</button>
      <div style="flex:1"><div class="tb-title small">设置</div></div>
    `;
    return;
  }
  if (route === '/wizard') {
    el.innerHTML = `
      <div style="flex:1">
        <div class="tb-title small">智能填票向导</div>
        <div class="tb-sub">勾选场景，自动给出该勾的风险与措施</div>
      </div>
    `;
    return;
  }
  if (route === '/errors') {
    el.innerHTML = `
      <button class="icon-btn ghost" onclick="history.back()" aria-label="返回">${IC.back}</button>
      <div style="flex:1"><div class="tb-title small">易错红线</div></div>
    `;
    return;
  }
  if (route === '/update') {
    el.innerHTML = `
      <button class="icon-btn ghost" onclick="history.back()" aria-label="返回">${IC.back}</button>
      <div style="flex:1"><div class="tb-title small">更新</div></div>
    `;
    return;
  }
  el.innerHTML = `<div class="tb-title small">作业票助手</div>`;
}

/* -------------------------------------------------------- 底部导航 */
function renderTabbar(route) {
  const tabs = [
    { path: '/', label: '速查', ic: 'home' },
    { path: '/wizard', label: '填票向导', ic: 'wand' },
    { path: '/ai', label: 'AI 助手', ic: 'chat' },
    { path: '/errors', label: '红线', ic: 'shield' }
  ];
  const active = route.startsWith('/p/') ? '/' : route;
  $('#tabbar').innerHTML = tabs.map(t => `
    <button class="tab ${active === t.path ? 'active' : ''}" onclick="navigate('${t.path}')">
      <span class="tab-ic">${IC[t.ic]}</span>
      <span class="tab-label">${t.label}</span>
    </button>
  `).join('');
}

/* ============================================================ 首页 */
function viewHome() {
  const q = STATE.search.trim();
  const results = q ? searchAll(q) : null;

  const grid = PERMITS.map(p => `
    <button class="type-card" onclick="navigate('/p/${p.id}')">
      <div class="tc-icon" style="background:${p.accentSoft};color:${p.accent}">${permitIcon(p, 23)}</div>
      <div class="tc-name">${p.name}</div>
      <div class="tc-desc">${esc(p.tagline)}</div>
      <div class="tc-meta">
        <span class="dot-tag">${p.measures.filter(m => mKind(m) === 'must').length} 项必须勾选</span>
      </div>
    </button>
  `).join('');

  const top3 = GLOBAL_ERRORS.slice(0, 3);

  return `
    <div class="hero">
      <div class="hero-eyebrow">${IC.sparkle} AI 已接入官方标准</div>
      <div class="hero-title">今天要办哪张票？<br><em>先看红线，再填票。</em></div>
      <div class="hero-sub">8 类特殊作业票的填写要点、必须勾选与核查确认的措施、高频退票原因，一页看完。</div>
      <div class="hero-actions">
        <button class="btn primary" onclick="navigate('/ai')">${IC.sparkle} 让 AI 帮我判断</button>
        <button class="btn ghost" onclick="navigate('/wizard')">智能填票</button>
      </div>
    </div>

    ${(typeof UPD !== 'undefined') ? UPD.homeBar() : ''}

    <div style="margin-top:18px">
      <div class="searchbar">
        <span class="sicon">${IC.search}</span>
        <input id="q" type="search" placeholder="搜作业票、字段、措施或错误…" value="${esc(q)}" oninput="onSearch(this.value)">
      </div>
    </div>

    ${results ? renderSearchResults(results) : `
      <div class="sec">
        <div class="sec-head"><div class="sec-title">作业票类型</div><div class="sec-desc">点击查看完整标准</div></div>
        <div class="grid-2">${grid}</div>
      </div>

      <div class="sec">
        <div class="sec-head">
          <div class="sec-title">最近被通报的红线</div>
          <div class="sec-more" onclick="navigate('/errors')">全部 ${GLOBAL_ERRORS.length} 条</div>
        </div>
        <div style="display:grid;gap:10px">
          ${top3.map(e => `
            <div class="alert-card">
              <div class="alert-ic">${IC.alert}</div>
              <div>
                <div class="alert-t">${esc(e.title)}</div>
                <div class="alert-d">${esc(e.detail)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="sec">
        <div class="sec-head"><div class="sec-title">快捷入口</div></div>
        <div class="row-list">
          <button class="row-item" onclick="navigate('/ai')">
            <div class="tc-icon" style="background:var(--brand-soft);color:var(--brand)">${IC.sparkle}</div>
            <div class="ri-main">
              <div class="ri-t">发一张办票截图，让 AI 审一遍</div>
              <div class="ri-d">自动识别票种、逐项比对标准、列出需更正处</div>
            </div>
            <span class="ri-arrow">${IC.arrow}</span>
          </button>
          <button class="row-item" onclick="navigate('/wizard')">
            <div class="tc-icon" style="background:var(--info-soft);color:var(--info)">${IC.wand}</div>
            <div class="ri-main">
              <div class="ri-t">勾选场景，生成应勾的风险与措施</div>
              <div class="ri-d">回答 5–8 个问题，直接给出必选项清单</div>
            </div>
            <span class="ri-arrow">${IC.arrow}</span>
          </button>
          <button class="row-item" onclick="goSettings()">
            <div class="tc-icon" style="background:var(--ok-soft);color:var(--ok)">${IC.gear}</div>
            <div class="ri-main">
              <div class="ri-t">配置 AI 模型</div>
              <div class="ri-d">填自己的 API Key，支持 GLM / Claude / Gemini 等 8 家</div>
            </div>
            <span class="ri-arrow">${IC.arrow}</span>
          </button>
        </div>
      </div>
    `}

    <div class="footer-note">
      规则依据：《特殊作业许可证填写标准》《作业票风险辨识及防控措施填写模板》《近三年被中化通报问题》<br>
      本工具用于辅助填写，最终以属地 HSE 审核意见为准<br>
      <span style="opacity:.75">规则版本 v${RULE_VERSION}</span>
    </div>
  `;
}

/* -------------------------------------------------------- 搜索 */
let SEARCH_INDEX = null;
function buildIndex() {
  if (SEARCH_INDEX) return SEARCH_INDEX;
  const idx = [];
  PERMITS.forEach(p => {
    idx.push({ pid: p.id, kind: '作业票类型', title: p.name, sub: p.tagline, tab: 'overview' });
    p.fields.forEach(f => idx.push({ pid: p.id, kind: '字段', title: f.name, sub: f.req, tab: 'fields' }));
    p.measures.forEach(m => idx.push({ pid: p.id, kind: '安全措施 ' + m.no, title: m.text, sub: m.cond || ({ must: '必须勾选', verify: '核查确认', cond: '关联票条件' })[mKind(m)], tab: 'measures' }));
    p.errors.forEach(e => idx.push({ pid: p.id, kind: e.kind === 'onsite' ? '现场落实' : '易错点', title: e.title, sub: e.detail, tab: 'errors' }));
  });
  GLOBAL_ERRORS.forEach(e => idx.push({ pid: null, kind: e.kind === 'onsite' ? '现场落实' : '跨票红线', title: e.title, sub: e.detail, tab: 'errors' }));
  SEARCH_INDEX = idx;
  return idx;
}

function searchAll(q) {
  const kw = q.toLowerCase();
  return buildIndex()
    .filter(it => (it.title + ' ' + it.sub + ' ' + it.kind).toLowerCase().includes(kw))
    .slice(0, 40);
}

function renderSearchResults(list) {
  if (!list.length) {
    return `<div class="empty">
      <div class="empty-ic">${IC.search}</div>
      <div class="empty-t">没有匹配的规则</div>
      <div class="empty-d">换个关键词试试，比如"盲板""监护人""措施 5"<br>或者直接问 AI</div>
    </div>`;
  }
  return `<div class="sec">
    <div class="sec-head"><div class="sec-title">找到 ${list.length} 条</div></div>
    <div class="row-list">
      ${list.map(it => {
        const p = it.pid ? PERMIT_MAP[it.pid] : null;
        return `<button class="row-item" onclick="${it.pid ? `openPermit('${it.pid}','${it.tab}')` : `navigate('/errors')`}">
          <div style="width:8px;height:8px;border-radius:50%;background:${p ? p.accent : 'var(--danger)'};flex:none"></div>
          <div class="ri-main">
            <div class="ri-t" style="font-size:13.5px">${esc(it.title)}</div>
            <div class="ri-d">${p ? p.name + ' · ' : ''}${esc(it.kind)}${it.sub ? ' · ' + esc(it.sub) : ''}</div>
          </div>
          <span class="ri-arrow">${IC.arrow}</span>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

let searchTimer = null;
function onSearch(v) {
  STATE.search = v;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const vw = $('#view');
    const scroll = window.scrollY;
    vw.innerHTML = viewHome();
    const inp = $('#q');
    if (inp) { inp.focus(); inp.setSelectionRange(v.length, v.length); }
    window.scrollTo(0, scroll);
  }, 140);
}

/* ============================================================ 详情 */
function openPermit(id, tab) {
  STATE.detailTab = tab || 'overview';
  STATE.measureFilter = 'all';
  navigate('/p/' + id);
}

function viewDetail(id) {
  const p = PERMIT_MAP[id];
  if (!p) return '<div class="empty"><div class="empty-t">找不到该作业票</div></div>';

  const tabs = [
    { k: 'overview', label: '概览' },
    { k: 'fields', label: '填写要点' },
    { k: 'measures', label: '安全措施' },
    { k: 'errors', label: '易错点' },
    { k: 'flow', label: '签批流程' }
  ];

  return `
    <div class="detail-hero" style="background:linear-gradient(140deg, ${shade(p.accent, -0.12)} 0%, ${shade(p.accent, -0.42)} 100%)">
      <div class="dh-top">
        <div class="dh-icon">${permitIcon(p, 24)}</div>
        <div style="flex:1">
          <div class="dh-name">${p.name}</div>
          <div class="dh-code">许可证编号前缀 ${p.code}-25-……</div>
        </div>
      </div>
      <div class="dh-tagline">${esc(p.tagline)}</div>
      <div class="dh-levels">${p.levels.map(l => `<span class="dh-chip">${esc(l.name)}</span>`).join('')}</div>
    </div>

    <div style="margin-top:16px;position:sticky;top:64px;z-index:30">
      <div class="segmented">
        ${tabs.map(t => `<button class="seg-btn ${STATE.detailTab === t.k ? 'active' : ''}" onclick="setTab('${t.k}')">${t.label}</button>`).join('')}
      </div>
    </div>

    <div style="margin-top:16px" class="fade-in">
      ${renderTabBody(p)}
    </div>

    <div class="sec">
      <button class="btn primary block" onclick="askAI('${p.id}')">${IC.sparkle} 就这张票问 AI</button>
    </div>
  `;
}

function setTab(k) {
  STATE.detailTab = k;
  render(true);
}

function renderTabBody(p) {
  switch (STATE.detailTab) {
    case 'fields':
      return p.fields.map((f, i) => `
        <div class="field-card">
          <div class="fc-head">
            <div class="fc-idx">${i + 1}</div>
            <div class="fc-name">${esc(f.name)}</div>
          </div>
          <div class="fc-req">${esc(f.req)}</div>
          ${(f.good || f.bad) ? `<div class="compare">
            ${f.good ? `<div class="cmp-line good"><span class="cmp-mark">✓</span><span>${esc(f.good)}</span></div>` : ''}
            ${f.bad ? `<div class="cmp-line bad"><span class="cmp-mark">✕</span><span>${esc(f.bad)}</span></div>` : ''}
          </div>` : ''}
          ${f.tip ? `<div class="tip-line">${esc(f.tip)}</div>` : ''}
        </div>
      `).join('');

    case 'measures': {
      const mustN = p.measures.filter(m => mKind(m) === 'must').length;
      const vfyN = p.measures.filter(m => mKind(m) === 'verify').length;
      const condN = p.measures.length - mustN - vfyN;
      const f = STATE.measureFilter;
      const list = p.measures.filter(m => f === 'all' || mKind(m) === f);
      const segCss = k => `background:${f === k ? 'var(--card)' : 'transparent'};box-shadow:${f === k ? '0 1px 3px rgba(0,0,0,.1)' : 'none'};border:1px solid var(--hairline)`;
      return `
        <div style="display:flex;gap:8px;margin-bottom:12px;overflow-x:auto" class="no-scrollbar">
          <button class="seg-btn" style="${segCss('all')}" onclick="setFilter('all')">全部 ${p.measures.length}</button>
          <button class="seg-btn" style="${segCss('must')}" onclick="setFilter('must')">必须勾选 ${mustN}</button>
          <button class="seg-btn" style="${segCss('verify')}" onclick="setFilter('verify')">核查确认 ${vfyN}</button>
          <button class="seg-btn" style="${segCss('cond')}" onclick="setFilter('cond')">关联票条件 ${condN}</button>
        </div>
        <div class="row-list">
          ${list.map(m => `
            <div class="measure ${mKind(m) === 'must' ? 'must' : ''}">
              <div class="m-no">${m.no}</div>
              <div class="m-body">
                <div class="m-text">${esc(m.text)}</div>
                <div class="m-meta">
                  ${({ must: '<span class="badge must">必须勾选</span>', verify: '<span class="badge verify">核查确认</span>', cond: '<span class="badge cond">关联票条件</span>' })[mKind(m)]}
                  ${m.cross ? `<span class="badge info">关联票联动</span>` : ''}
                  ${m.cond ? `<span class="m-cond" style="margin:0">↳ ${esc(m.cond)}</span>` : ''}
                </div>
                ${m.why ? `<div class="m-why"><span class="why-k">勾选原因</span>${esc(m.why)}</div>` : ''}
                ${m.note ? `<div class="m-cond" style="margin-top:4px">↳ ${esc(m.note)}</div>` : ''}
                ${byTag(m)}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="tip-line" style="margin-top:12px">勾选规则：票面只有"必须勾选"和"本次涉及"打"√"。"必须勾选"里带"勾选原因"的是现场核实型——核实结论为"没有"也照样打√。"核查确认"是原文带"如有/涉及…时"的条件项，先留空，现场核实后自己在 App 里逐条勾选：涉及就勾上，确实不涉及的在备注写明理由再标"不适用"。只有"关联票条件"里、本次没办那张票的条目，才算明确不涉及。</div>
      `;
    }

    case 'errors': {
      const paperE = p.errors.filter(e => e.kind !== 'onsite');
      const onsiteE = p.errors.filter(e => e.kind === 'onsite');
      /* 本票已有同名条目时不再重复列全局那条（如动火与本票都写了"监护人不在现场"） */
      const localTitles = new Set(p.errors.map(e => e.title));
      const gOnsiteE = GLOBAL_ERRORS.filter(e => e.kind === 'onsite' && errFits(e, p) && !localTitles.has(e.title));
      const gPaperE = GLOBAL_ERRORS.filter(e => e.kind !== 'onsite' && !localTitles.has(e.title));
      const card = (e, global) => `
        <div class="err-item ${e.level}">
          <div class="err-ic">${global ? IC.alert : IC.warn}</div>
          <div style="flex:1">
            <div class="err-t">${esc(e.title)}</div>
            <div class="err-d">${esc(e.detail)}</div>
            <div class="err-src">${global ? '适用 · ' + esc(e.scope) : '来源 · ' + esc(e.src)}</div>
          </div>
        </div>`;
      const onsiteTotal = onsiteE.length + gOnsiteE.length;
      return `
        ${paperE.map(e => card(e, false)).join('')}
        ${onsiteTotal ? `
          <div class="sec" style="margin-top:20px">
            <div class="sec-head"><div class="sec-title">现场落实</div><div class="sec-desc">${onsiteTotal} 条</div></div>
            ${onsiteE.map(e => card(e, false)).join('')}
            ${gOnsiteE.map(e => card(e, true)).join('')}
          </div>` : ''}
        <div class="sec" style="margin-top:20px">
          <div class="sec-head"><div class="sec-title">跨票证通用红线</div><div class="sec-desc">${gPaperE.length} 条</div></div>
          ${gPaperE.slice(0, 4).map(e => card(e, true)).join('')}
          <button class="btn block" style="margin-top:6px" onclick="navigate('/errors')">查看全部 ${GLOBAL_ERRORS.length} 条红线</button>
        </div>
      `;
    }

    case 'flow':
      return `
        <div class="card pad" style="margin-bottom:14px">
          <div class="sec-title" style="margin-bottom:10px">签字链（自上而下）</div>
          <div class="chain">
            ${p.approvals.map(a => `
              <div class="chain-item">
                <div class="chain-role">${esc(a.role)}</div>
                <div class="chain-who">${a.who}</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="tip-line">同一张票上，申请人不得同时是审核人、审批人或完工验收人。系统会比对签字人身份，这是被通报最多的一类问题。</div>
      `;

    default:
      return `
        <div class="card pad" style="margin-bottom:12px">
          <div class="sec-title" style="margin-bottom:8px">什么时候需要办</div>
          <div class="fc-req" style="margin:0">${esc(p.when)}</div>
        </div>

        <div class="card pad" style="margin-bottom:12px">
          <div class="sec-title" style="margin-bottom:10px">分级与审批层级</div>
          ${p.levels.map(l => `
            <div style="padding:9px 0;border-bottom:1px solid var(--hairline)">
              <div style="font-size:13.5px;font-weight:700">${esc(l.name)}</div>
              <div style="font-size:12.5px;color:var(--t2);margin-top:3px;line-height:1.6">${l.desc || ''}</div>
            </div>
          `).join('')}
        </div>

        <div class="card pad" style="margin-bottom:12px">
          <div class="sec-title" style="margin-bottom:10px">风险辨识 · 必选项</div>
          <div class="tag-wrap">
            ${p.risks.must.map(r => `<span class="tag" style="--risk-bg:var(--danger-soft);--risk-fg:#B02830">${esc(r)}</span>`).join('')}
          </div>
          <div class="sec-title" style="margin:16px 0 10px;font-size:14px">条件项（按实际勾选）</div>
          <div class="tag-wrap">
            ${p.risks.cond.map(r => `<span class="tag">${esc(r)}</span>`).join('')}
          </div>
        </div>

        <div class="alert-card" style="margin-bottom:12px">
          <div class="alert-ic" style="background:${p.accent}">${IC.warn}</div>
          <div>
            <div class="alert-t" style="color:var(--t1)">一句话记住这张票</div>
            <div class="alert-d" style="color:var(--t2)">${esc(p.quote)}</div>
          </div>
        </div>

        <div class="card pad">
          <div class="sec-title" style="margin-bottom:10px">同时办理的关联票证</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${(p.wizard.related || []).map(id => {
              const r = PERMIT_MAP[id];
              if (!r) return '';
              return `<button class="tag" style="--risk-bg:${r.accentSoft};--risk-fg:${shade(r.accent, -0.25)};font-weight:650" onclick="navigate('/p/${r.id}')">${esc(r.name)}</button>`;
            }).join('')}
          </div>
          <div class="m-cond" style="margin-top:12px">关联票证必须逐张确认状态：主票关闭前，关联票应全部关闭。</div>
        </div>
      `;
  }
}

function setFilter(f) {
  STATE.measureFilter = f;
  render(true);
}

/* 全局红线的 scope 是文字列表（如"动火、受限空间、高处、临电、吊装、断路"），判断是否适用当前票种 */
function errFits(e, p) {
  const s = e.scope || '';
  if (/全部/.test(s)) return true;
  const alias = { 临电: '临时用电', 盲板: '盲板抽堵', 受限: '受限空间' };
  return s.split(/[、，,\/]/).map(x => x.trim()).filter(Boolean)
    .some(x => (alias[x] || x) === p.short || p.short.includes(x) || x.includes(p.short));
}

/* ============================================================ 易错红线 */
function viewErrors() {
  const crit = GLOBAL_ERRORS.filter(e => e.level === 'critical');
  const major = GLOBAL_ERRORS.filter(e => e.level !== 'critical');
  const onsiteN = GLOBAL_ERRORS.filter(e => e.kind === 'onsite').length;
  const item = e => `
    <div class="err-item ${e.level}">
      <div class="err-ic">${IC.warn}</div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          <span class="badge ${e.level}">${e.level === 'critical' ? '否决项' : '常见扣分'}</span>
          ${e.kind === 'onsite' ? '<span class="badge onsite">现场落实</span>' : '<span class="badge paper">票面办理</span>'}
        </div>
        <div class="err-t" style="margin-top:6px">${esc(e.title)}</div>
        <div class="err-d">${esc(e.detail)}</div>
        <div class="err-src">适用 · ${esc(e.scope)} ｜ 来源 · ${esc(e.src)}</div>
      </div>
    </div>`;

  return `
    <div class="hero" style="background:linear-gradient(160deg,#FFFFFF,#FFF4F3);border-color:rgba(229,72,77,.1)">
      <div class="hero-eyebrow" style="background:var(--danger-soft);color:#A3272C">${IC.alert} 集团通报 + HSE 在线监控日报</div>
      <div class="hero-title">${GLOBAL_ERRORS.length} 条红线，<em style="color:var(--danger)">踩一条就是废票</em></div>
      <div class="hero-sub">这些不是理论风险，是真实被通报、被退回、被考核的问题清单。${crit.length} 条属于否决项；另有 ${onsiteN} 条属<b>现场落实</b>类，已在卡片上单独标出。</div>
    </div>

    <div class="sec">
      <div class="sec-head"><div class="sec-title">否决项</div><div class="sec-desc">${crit.length} 条</div></div>
      ${crit.map(item).join('')}
    </div>

    <div class="sec">
      <div class="sec-head"><div class="sec-title">常见扣分项</div><div class="sec-desc">${major.length} 条</div></div>
      ${major.map(item).join('')}
    </div>

    <div class="sec">
      <button class="btn primary block" onclick="navigate('/ai')">${IC.sparkle} 发截图让 AI 逐条核对</button>
    </div>
  `;
}

/* ============================================================ 智能填票向导 */
function wzBag(pid) {
  STATE.wz.sel = STATE.wz.sel || {};
  STATE.wz.rel = STATE.wz.rel || {};
  STATE.wz.m = STATE.wz.m || {};
  STATE.wz.sel[pid] = STATE.wz.sel[pid] || {};
  STATE.wz.rel[pid] = STATE.wz.rel[pid] || [];
  STATE.wz.m[pid] = STATE.wz.m[pid] || {};
  return { sel: STATE.wz.sel[pid], rel: STATE.wz.rel[pid], m: STATE.wz.m[pid] };
}

/* 本次涉及的票种：主票 + 手动勾选的关联票 + 场景题隐式关联的票 */
function wzContext(pid) {
  const p = PERMIT_MAP[pid];
  const bag = wzBag(pid);
  const picked = p.wizard.questions.filter(q => bag.sel[q.id]);
  const relIds = [];
  const push = id => { if (id && id !== pid && PERMIT_MAP[id] && relIds.indexOf(id) < 0) relIds.push(id); };
  bag.rel.forEach(push);
  picked.forEach(q => { if (q.rel) push(q.rel); });
  return { p, bag, picked, relIds, involved: [pid].concat(relIds) };
}

/* 措施的四类状态 */
const MST = {
  must:   { label: '必须勾选', cls: 'must' },
  verify: { label: '核查确认', cls: 'verify' },
  on:     { label: '本次涉及', cls: 'on' },
  off:    { label: '未涉及', cls: 'off' }
};

/* 静态分类（详情页用）：must / verify / cond
 * must = 无条件条目，票面一律打√（含 kind=verify 的"现场核实"型：核实结论为"没有"也照样打√）
 * verify = 原文带"如有/涉及…时"的条件项，先留空、现场核实后自己勾选
 * cond = 随关联票联动，本次没办那张票时可判"明确未涉及" */
function mKind(m) {
  if (m.must) return 'must';
  if (m.cond && !m.cross) return 'verify';
  return 'cond';
}

/* 单条措施状态：手动标记 > 关联票联动 > 场景题 > 默认未涉及 */
function evalMeasure(m, selfId, ctx, extraAdd) {
  /* m.must = 无条件条目，票面一律打√。kind=verify 的是"现场核实"型（核实结论为"没有"也照样勾），
   * 为什么必须勾写在 m.why 里，跟条目一起显示，不能只给一个状态标签。 */
  if (m.must) return { st: 'must', src: '' };
  if (ctx.bag.m[m.no] === true) return { st: 'on', src: '手动标记' };
  if (ctx.bag.m[m.no] === false) return { st: 'off', src: '' };
  if (m.cross) {
    const hit = m.cross.indexOf('*') >= 0
      ? ctx.involved.filter(x => x !== selfId)
      : m.cross.filter(id => ctx.involved.indexOf(id) >= 0);
    if (hit.length) return { st: 'on', src: hit.map(id => (PERMIT_MAP[id] || {}).short || id).join(' + ') + '票联动' };
  }
  if (extraAdd && extraAdd.indexOf(m.no) >= 0) return { st: 'on', src: '关联票联动' };
  const q = (ctx.picked || []).find(x => (x.add || []).indexOf(m.no) >= 0);
  if (q) return { st: 'on', src: '场景 · ' + q.label };
  /* 兜底只有一种情况算"明确不涉及"：该项由关联票触发，而本次没勾那张票。
   * 其余情形（票面上"如有/涉及…时"这类）一律进"核查确认"——要不要勾必须到现场核实后自己定，
   * 不能由 App 替人下"不涉及"的结论。 */
  if (m.cross) return { st: 'off', src: '' };
  return { st: 'verify', src: '' };
}

function countRows(rows) {
  const c = { total: rows.length, must: 0, verify: 0, on: 0, off: 0 };
  rows.forEach(r => { c[r.st] += 1; });
  /* 只有"必须勾选"和"本次涉及"在票面上打√；核查确认留空，由现场核实后自己勾选 */
  c.tick = c.must + c.on;
  return c;
}

/* 依据"主票 + 场景题 + 关联票"列出全部措施并算出各自状态 */
function wzCompute(pid) {
  const ctx = wzContext(pid);
  const p = ctx.p;

  const risks = new Set(p.risks.must);
  const poolP = p.risks.must.concat(p.risks.cond);
  ctx.picked.forEach(q => { if (q.risk && poolP.indexOf(q.risk) >= 0) risks.add(q.risk); });

  const mainExtra = [];
  const groups = ctx.relIds.map(rid => {
    const r = PERMIT_MAP[rid];
    const c = (r.cross && r.cross[pid]) || {};
    const rctx = { bag: wzBag(rid), picked: [], involved: ctx.involved };
    const extra = (c.add || []).concat(r.relNo ? [r.relNo] : []);
    (c.mainAdd || []).forEach(n => mainExtra.push(n));

    const rows = r.measures.map(m => {
      const e = evalMeasure(m, rid, rctx, extra);
      return { m, st: e.st, src: e.src };
    });

    const rrisks = new Set(r.risks.must);
    const poolR = r.risks.must.concat(r.risks.cond);
    (c.risk || []).forEach(x => { if (poolR.indexOf(x) >= 0) rrisks.add(x); });
    (c.mainRisk || []).forEach(x => { if (poolP.indexOf(x) >= 0) risks.add(x); });

    return {
      p: r,
      rows,
      counts: countRows(rows),
      risks: Array.from(rrisks),
      note: c.note || ''
    };
  });

  const rows = p.measures.map(m => {
    const e = evalMeasure(m, pid, ctx, mainExtra);
    return { m, st: e.st, src: e.src };
  });
  const counts = countRows(rows);

  return {
    p,
    picked: ctx.picked,
    relIds: ctx.relIds,
    risks: Array.from(risks),
    rows,
    counts,
    total: counts.total + groups.reduce((n, g) => n + g.counts.total, 0),
    tick: counts.tick + groups.reduce((n, g) => n + g.counts.tick, 0),
    groups
  };
}

/* 确认人：该项措施落实后在票面签字确认的人 */
function byTag(m) {
  return `<div class="m-by"><span class="m-by-k">确认人</span>${esc(m.by)}</div>`;
}

/* 全部措施逐条渲染：勾选框 + 编号 + 原文 + 状态标签 + 确认人 */
function measureLine(row, tid) {
  const m = row.m, st = row.st, meta = MST[st];
  const tick = st === 'must' || st === 'on';   /* 票面打√的只有这两类 */
  const on = st !== 'off';
  const tap = m.must ? '' : ` onclick="toggleMeasure('${tid}',${m.no},'${st}')"`;
  return `
    <div class="ml ${st}${m.must ? '' : ' tap'}"${tap}>
      <div class="ml-box${st === 'verify' ? ' open' : ''}">${tick ? IC.check : ''}</div>
      <div class="ml-main">
        <div class="ml-text"><span class="ml-no">${m.no}</span>${esc(m.text)}</div>
        <div class="ml-meta">
          <span class="mstat ${meta.cls}">${meta.label}</span>
          ${row.src ? `<span class="ml-src">${esc(row.src)}</span>` : ''}
        </div>
        ${on && m.why ? `<div class="ml-note why"><span class="why-k">勾选原因</span>${esc(m.why)}</div>` : ''}
        ${on && m.cond ? `<div class="ml-note">↳ ${esc(m.cond)}</div>` : ''}
        ${on && m.note ? `<div class="ml-note">↳ ${esc(m.note)}</div>` : ''}
        ${on ? byTag(m) : ''}
      </div>
    </div>`;
}

function toggleMeasure(pid, no, st) {
  const bag = wzBag(pid);
  const m = PERMIT_MAP[pid].measures.find(x => x.no === no);
  if (!m || m.must) return;
  bag.m[no] = st !== 'on';
  render(true);
}

function toggleOnly() {
  STATE.wz.only = !STATE.wz.only;
  render(true);
}

function viewWizard() {
  const pid = STATE.wz.permit;
  const bag = wzBag(pid);
  const p = PERMIT_MAP[pid];
  const r = wzCompute(pid);

  const toggles = p.wizard.questions.map(q => `
    <button class="wz-q ${bag.sel[q.id] ? 'on' : ''}" onclick="toggleWz('${q.id}')">
      <span class="wz-q-text">${esc(q.label)}</span>
      <span class="switch"></span>
    </button>
  `).join('');

  const others = PERMITS.filter(x => x.id !== pid);
  const relPanel = `
    <div class="wz-rel ${r.relIds.length ? 'on' : ''}">
      <div class="wz-rel-h">
        <span class="wz-rel-t">${IC.shield} 同时涉及其他特殊作业</span>
        <span class="wz-rel-n">${r.relIds.length ? '已选 ' + r.relIds.length + ' 类' : '不限'}</span>
      </div>
      <div class="wz-rel-hint">${r.relIds.length
        ? '主票与下列关联票的措施、风险已合并计算'
        : '勾选现场同时发生的作业类型，自动合并对应票证的风险与措施'}</div>
      <div class="wz-rel-wrap">
        ${others.map(x => `
          <button class="rel-chip ${r.relIds.indexOf(x.id) >= 0 ? 'on' : ''}"
            style="--c:${x.accent};--cs:${x.accentSoft};--cd:${shade(x.accent, -0.34)}" onclick="toggleWzRel('${x.id}')">
            <span class="rc-dot"></span>${esc(x.short)}
          </button>
        `).join('')}
      </div>
    </div>`;

  /* 每条易错点都要带上所属票种：关联票的"措施 13"混在主票列表里，
   * 不标票种用户根本不知道是哪张票的第 13 条（曾被指出表述不明） */
  const scenarioErrors = p.errors.slice(0, 3).map(e => Object.assign({}, e, { _p: p }));
  r.groups.forEach(g => {
    const e = g.p.errors.find(x => x.level === 'critical');
    if (e && scenarioErrors.length < 5 && !scenarioErrors.some(s => s.title === e.title)) {
      scenarioErrors.push(Object.assign({}, e, { _p: g.p }));
    }
  });

  return `
    <div class="hero" style="background:linear-gradient(160deg,#FFFFFF,#F5F3FF);border-color:rgba(124,92,255,.10)">
      <div class="hero-eyebrow" style="background:rgba(124,92,255,.12);color:#5B3FD6">${IC.wand} 规则引擎 · 即时生成</div>
      <div class="hero-title">说清场景，<em style="color:#7C5CFF">该勾什么一目了然</em></div>
      <div class="hero-sub">不用回忆标准，勾选现场实际情形，自动算出必须勾选与待核查的措施、风险辨识项和每项措施的确认人。</div>
    </div>

    <div class="sec">
      <div class="sec-head"><div class="sec-title">1 · 选择作业类型</div></div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px" class="no-scrollbar">
        ${PERMITS.map(x => `
          <button class="qchip" style="${x.id === pid ? `background:${x.accent};color:#fff;border-color:transparent` : ''}" onclick="setWzPermit('${x.id}')">${esc(x.short)}</button>
        `).join('')}
      </div>
    </div>

    <div class="sec">
      <div class="sec-head"><div class="sec-title">2 · 现场实际情形</div><div class="sec-desc">${r.picked.length} 项已选</div></div>
      <div class="wz-step" style="display:grid;gap:9px">${toggles}</div>
      <div style="margin-top:9px">${relPanel}</div>
    </div>

    <div class="sec">
      <div class="sec-head"><div class="sec-title">3 · 生成结果</div><div class="sec-desc">要勾 ${r.tick} 条 / 共 ${r.total} 条${r.groups.length ? '（含关联票）' : ''}</div></div>

      <div class="result-block">
        <div class="rb-head"><span style="color:var(--danger)">${IC.warn}</span> 风险辨识 · ${esc(p.short)}票必须勾选</div>
        <div class="rb-body">
          <div class="tag-wrap">
            ${r.risks.map(x => `<span class="tag" style="--risk-bg:var(--danger-soft);--risk-fg:#B02830">${esc(x)}</span>`).join('')}
          </div>
        </div>
      </div>

      <div class="result-block">
        <div class="rb-head">
          <span style="color:var(--brand)">${IC.check}</span>
          <span style="flex:1;min-width:0">安全措施 · ${esc(p.short)}票 全部 ${r.counts.total} 条</span>
          <button class="ml-filter${STATE.wz.only ? ' on' : ''}" onclick="toggleOnly()">${STATE.wz.only ? '显示全部' : '只看要勾'}</button>
        </div>
        <div class="rb-body" style="padding:10px 16px 8px">
          <div class="ml-legend">
            <span class="ml-lg"><span class="mstat must">必须勾选</span>${r.counts.must}</span>
            <span class="ml-lg"><span class="mstat verify">核查确认</span>${r.counts.verify}</span>
            <span class="ml-lg"><span class="mstat on">本次涉及</span>${r.counts.on}</span>
            <span class="ml-lg"><span class="mstat off">未涉及</span>${r.counts.off}</span>
          </div>
          <div class="ml-legend-t">票面打√的只有"必须勾选"和"本次涉及"。"必须勾选"含两种：要动手落实的，和要到现场核实后打√的（核实结论是"没有"也照样打√，灰框里写了"勾选原因"）。"核查确认"原文带"如有/涉及…时"，只在特定设施、介质、方式下才有，先留空，现场核实后自己在 App 里勾选；只有由关联票触发的条目才显示"未涉及"，点一下可改为涉及。</div>
          ${(STATE.wz.only ? r.rows.filter(x => x.st === 'must' || x.st === 'on') : r.rows).map(row => measureLine(row, p.id)).join('')}
          ${STATE.wz.only && (r.counts.off + r.counts.verify) ? `<div class="ml-hidden">已隐藏 ${r.counts.verify + r.counts.off} 条（核查确认 ${r.counts.verify} · 未涉及 ${r.counts.off}）· 点上方"显示全部"查看</div>` : ''}
        </div>
      </div>

      ${r.groups.map(g => `
        <div class="result-block rel" style="--c:${g.p.accent};--cs:${g.p.accentSoft};--cd:${shade(g.p.accent, -0.34)}">
          <div class="rb-head">
            <span class="rb-rel-badge">关联票</span>
            <span class="rb-rel-t">${esc(g.p.name)} · 需同时办理</span>
            <button class="rb-go" onclick="navigate('/p/${g.p.id}')">填写要点 ${IC.arrow}</button>
          </div>
          <div class="rb-body">
            <div class="rb-k">风险辨识 · 必须勾选</div>
            <div class="tag-wrap" style="margin-top:7px">
              ${g.risks.map(x => `<span class="tag" style="--risk-bg:var(--danger-soft);--risk-fg:#B02830">${esc(x)}</span>`).join('')}
            </div>
            <div class="rb-k" style="margin-top:14px">安全措施 · 全部 ${g.counts.total} 条（要勾 ${g.counts.tick} · 待核实 ${g.counts.verify} · 未涉及 ${g.counts.off}）</div>
            <div style="margin-top:2px">
              ${(STATE.wz.only ? g.rows.filter(x => x.st === 'must' || x.st === 'on') : g.rows).map(row => measureLine(row, g.p.id)).join('')}
            </div>
            ${g.note ? `<div class="rb-note">${IC.alert}<span>${esc(g.note)}</span></div>` : ''}
          </div>
        </div>
      `).join('')}

      <div class="result-block">
        <div class="rb-head"><span style="color:var(--warn)">${IC.alert}</span> 这个场景最容易错</div>
        <div class="rb-body" style="padding:6px 16px">
          ${scenarioErrors.map(e => `
            <div class="rb-line">
              <div class="rb-num" style="background:var(--warn-soft);color:#A56A00">!</div>
              <div class="rb-main">
                <div class="err-h">
                  <span class="err-permit" style="--c:${e._p.accent};--cs:${e._p.accentSoft};--cd:${shade(e._p.accent, -0.34)}">${esc(e._p.short)}票${e._p.id === p.id ? ' · 本票' : ' · 关联票'}</span>
                  <b>${esc(e.title)}</b>
                </div>
                <div class="m-cond" style="margin-top:3px">${esc(e.detail)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="tip-line" style="margin-bottom:12px">
        确认人 = 该项措施落实后在票面签字确认的人：属地监护人管现场条件（隔离、清场、检测、警戒），作业负责人管本单位作业行为（人员、工具、交底）。
      </div>

      <div style="display:flex;gap:9px;margin-top:4px">
        <button class="btn ghost" style="flex:1" onclick="copyWizard()">${IC.copy} 复制清单</button>
        <button class="btn primary" style="flex:1" onclick="askAI('${pid}')">${IC.sparkle} 问 AI 细节</button>
      </div>
    </div>
  `;
}

function setWzPermit(id) {
  STATE.wz.permit = id;
  render(true);
}

function syncRel(bag, id, on) {
  const i = bag.rel.indexOf(id);
  if (on && i < 0) bag.rel.push(id);
  if (!on && i >= 0) bag.rel.splice(i, 1);
}

function toggleWz(qid) {
  const pid = STATE.wz.permit;
  const bag = wzBag(pid);
  const p = PERMIT_MAP[pid];
  const q = p.wizard.questions.find(x => x.id === qid);
  const on = !bag.sel[qid];
  bag.sel[qid] = on;
  /* 场景题与"同时涉及其他特殊作业"保持同步：勾了高处，对应票自动选中 */
  if (q && q.rel) syncRel(bag, q.rel, on);
  render(true);
}

function toggleWzRel(id) {
  const pid = STATE.wz.permit;
  const p = PERMIT_MAP[pid];
  const bag = wzBag(pid);
  const on = bag.rel.indexOf(id) < 0;
  syncRel(bag, id, on);
  p.wizard.questions.forEach(q => { if (q.rel === id) bag.sel[q.id] = on; });
  render(true);
}

function copyWizard() {
  const r = wzCompute(STATE.wz.permit);
  const L = [];
  const dump = (rows, title, withHint) => {
    const hit = rows.filter(x => x.st !== 'off');
    if (!hit.length) return;
    L.push('【' + title + '】');
    hit.forEach(x => L.push('  ' + x.m.no + '. ' + x.m.text + '　[' + MST[x.st].label + ']　确认人：' + x.m.by
      + (withHint && x.m.why ? '\n     　↳ 勾选原因：' + x.m.why : '')
      + (withHint && x.m.cond ? '\n     　↳ ' + x.m.cond : '')));
    L.push('');
  };
  const seg = (rows, name) => {
    dump(rows.filter(x => x.st === 'must'), name + '票 · 必须勾选（无条件落实，一律打√）', true);
    dump(rows.filter(x => x.st === 'verify'), name + '票 · 核查确认（方框留空，逐条核实：涉及打√、不涉及在备注注明后标"不适用"）', true);
    dump(rows.filter(x => x.st === 'on'), name + '票 · 本次涉及（要打√）', true);
    const off = rows.filter(x => x.st === 'off');
    if (off.length) {
      L.push('【' + name + '票 · 明确未涉及，不勾】' + off.map(x => x.m.no + '. ' + x.m.text).join('；'));
      L.push('');
    }
  };
  L.push(r.p.name + ' · 填票清单');
  L.push('共 ' + r.counts.total + ' 条：必须勾选 ' + r.counts.must + ' · 核查确认 ' + r.counts.verify + ' · 本次涉及 ' + r.counts.on + ' · 未涉及 ' + r.counts.off);
  L.push('说明：票面只有"必须勾选"和"本次涉及"打√。"必须勾选"里带"勾选原因"的是现场核实型，核实结论为"没有"也照样打√；"核查确认"是条件项，先留空，现场核实后自行勾选。');
  L.push('');
  L.push('【风险辨识必勾】' + r.risks.join('、'));
  L.push('');
  seg(r.rows, r.p.short);
  r.groups.forEach(g => {
    L.push('【关联】' + g.p.name + ' —— 需同时办理');
    L.push('  风险辨识必勾：' + g.risks.join('、'));
    L.push('  共 ' + g.counts.total + ' 条：必须勾选 ' + g.counts.must + ' · 核查确认 ' + g.counts.verify + ' · 本次涉及 ' + g.counts.on + ' · 未涉及 ' + g.counts.off);
    seg(g.rows, g.p.short);
    if (g.note) L.push('  现场提示：' + g.note);
    L.push('');
  });
  const txt = L.join('\n').trim();
  navigator.clipboard.writeText(txt).then(
    () => toast('清单已复制（含状态标签与确认人）'),
    () => toast('复制失败，请长按选择')
  );
}

function toast(msg) {
  const d = document.createElement('div');
  d.textContent = msg;
  d.style.cssText = 'position:fixed;left:50%;bottom:calc(var(--nav-h) + 40px);transform:translateX(-50%);background:rgba(20,20,22,.9);color:#fff;font-size:13px;padding:9px 16px;border-radius:999px;z-index:999;animation:viewIn .2s';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1800);
}

/* ============================================================ AI 对话 */
function viewAI() {
  const cfg = AI.getConfig();
  const ready = AI.configured();
  const banner = ready ? '' : `
    <button class="ai-banner" onclick="goSettings()">
      <span class="ab-ic">${IC.alert}</span>
      <span class="ab-main">
        <span class="ab-t">${cfg.enabled ? '还差一步：配置 AI 模型' : 'AI 助手已关闭'}</span>
        <span class="ab-d">${cfg.enabled ? '填入厂商、模型和 API Key 即可对话与审票' : '打开总开关并选择模型后即可使用'}</span>
      </span>
      <span class="ab-go">去设置 ${IC.arrow}</span>
    </button>`;

  return `
    ${banner}
    <div class="chat-wrap">
      <div class="chat-scroll" id="chat-scroll">
        ${STATE.chat.length ? STATE.chat.map(m => renderMsg(m)).join('') : renderChatEmpty()}
      </div>
      <div class="quick-chips" id="quick">
        ${[
          '我要办动火票，需要准备什么？',
          '高处作业 12 米算几级？',
          '临时用电最容易退票的是哪几条？',
          '动火 + 高处 + 临电同时作业，票怎么关联？'
        ].map(t => `<button class="qchip" onclick="quickAsk(${JSON.stringify(t).replace(/"/g, '&quot;')})">${t}</button>`).join('')}
      </div>
      <div id="attach-area"></div>
      <div class="composer">
        <button class="cbtn" onclick="pickImage()" aria-label="上传截图">${IC.image}</button>
        <textarea id="input" rows="1" placeholder="描述作业场景，或上传办票截图…"></textarea>
        <button class="cbtn send" id="send-btn" onclick="sendMsg()" aria-label="发送">${IC.send}</button>
      </div>
      <input type="file" id="file" accept="image/*" multiple style="display:none" onchange="onFiles(this.files)">
    </div>
  `;
}

function renderChatEmpty() {
  return `
    <div class="empty" style="padding-top:30px">
      <div class="empty-ic">${IC.sparkle}</div>
      <div class="empty-t">说人话就行，我来对标准</div>
      <div class="empty-d" style="max-width:290px;margin:8px auto 0">
        告诉我你要办什么票、什么场景，我会列出该填的字段、该勾的措施、以及最容易错的地方。<br><br>
        办完票把界面截图发过来，我逐项帮你核对。
      </div>
      <div style="display:grid;gap:8px;margin-top:22px;text-align:left">
        <div class="card pad" style="padding:13px 15px;text-align:left">
          <div style="font-size:12.5px;font-weight:700;color:var(--brand-ink)">示例 1 · 咨询</div>
          <div style="font-size:12.5px;color:var(--t2);margin-top:4px;line-height:1.6">"我要在反应釜里清釜，釜里原来装的是稀盐酸，需要办哪些票？"</div>
        </div>
        <div class="card pad" style="padding:13px 15px;text-align:left">
          <div style="font-size:12.5px;font-weight:700;color:var(--brand-ink)">示例 2 · 审票</div>
          <div style="font-size:12.5px;color:var(--t2);margin-top:4px;line-height:1.6">上传一张动火票截图 → 自动识别填写是否规范、有哪些要改</div>
        </div>
      </div>
    </div>
  `;
}

function renderMsg(m, enter) {
  const isMe = m.role === 'user';
  const imgs = (m.images || []).map(src => `<img class="chat-img" src="${src}" alt="上传的截图">`).join('');
  let body;
  if (isMe) {
    body = imgs + (m.content ? `<div>${esc(m.content)}</div>` : '');
  } else if (!m.content) {
    body = m.streaming ? '<span class="typing"><i></i><i></i><i></i></span>' : '';
  } else {
    /* 正文单独一层 .md-body：流式输出时只换这一层的内容，气泡和动画都不重建 */
    body = `<div class="md-body">${md(m.content)}</div>`;
  }
  return `<div class="msg ${isMe ? 'me' : 'bot'}${enter ? ' enter' : ''}">
    <div class="avatar ${isMe ? 'me' : 'bot'}">${isMe ? '我' : '智'}</div>
    <div class="bubble">${body}</div>
  </div>`;
}

/* 取最后一条 AI 气泡，供流式输出做局部更新 */
function lastBotEl() {
  const el = $('#chat-scroll');
  if (!el) return null;
  const bots = el.querySelectorAll('.msg.bot');
  return bots.length ? bots[bots.length - 1] : null;
}

function botBodyEl(bubble, content) {
  let body = bubble.querySelector('.md-body');
  if (body) return body;
  if (!content) return null;
  const typing = bubble.querySelector('.typing');
  if (typing) typing.remove();
  body = document.createElement('div');
  body.className = 'md-body';
  bubble.appendChild(body);
  return body;
}

/* 流式过程中：只更新最后一条气泡的正文，不重排整页 */
function patchStreamingBot(m) {
  const last = lastBotEl();
  if (!last) return false;
  const bubble = last.querySelector('.bubble');
  if (!bubble) return false;
  const body = botBodyEl(bubble, m.content);
  if (body) body.innerHTML = m.content ? md(m.content) : '';
  return true;
}

/* 收尾：清掉等待中的三点，写入最终正文 */
function finishStreamingBot(m) {
  const last = lastBotEl();
  if (!last) return false;
  const bubble = last.querySelector('.bubble');
  if (!bubble) return false;
  const typing = bubble.querySelector('.typing');
  if (typing) typing.remove();
  const body = botBodyEl(bubble, m.content);
  if (body) body.innerHTML = m.content ? md(m.content) : '';
  return true;
}

function scrollChat(force) {
  const doc = document.documentElement;
  const y = window.pageYOffset || doc.scrollTop || 0;
  const gap = doc.scrollHeight - window.innerHeight - y;
  /* 只有已经贴底（或主动要求）才跟随，免得用户回看历史时被拽回去 */
  if (force || gap < 160) window.scrollTo(0, doc.scrollHeight);
}

function refreshChat(newCount) {
  const el = $('#chat-scroll');
  if (!el) return;
  const n = STATE.chat.length;
  el.innerHTML = n
    ? STATE.chat.map((m, i) => renderMsg(m, newCount && i >= n - newCount)).join('')
    : renderChatEmpty();
}

function renderAttach() {
  const box = $('#attach-area');
  if (!box) return;
  if (!STATE.attached.length) { box.innerHTML = ''; return; }
  box.innerHTML = `<div class="attach-preview">
    ${STATE.attached.map((a, i) => `<div class="ap-item"><img src="${a}"><div class="ap-x" onclick="removeAttach(${i})">✕</div></div>`).join('')}
  </div>`;
}

function pickImage() { $('#file').click(); }

async function onFiles(files) {
  if (!files || !files.length) return;
  for (const f of Array.from(files).slice(0, 4)) {
    try {
      const d = await AI.compressImage(f);
      STATE.attached.push(d);
    } catch (e) { toast('图片处理失败'); }
  }
  renderAttach();
  const sendBtn = $('#send-btn');
  if (sendBtn) sendBtn.disabled = false;
  $('#file').value = '';
}

function removeAttach(i) {
  STATE.attached.splice(i, 1);
  renderAttach();
}

function quickAsk(text) {
  const inp = $('#input');
  if (inp) inp.value = text;
  sendMsg();
}

function newChat() {
  if (STATE.chat.length && !confirm('清空当前对话？')) return;
  STATE.chat = [];
  STATE.attached = [];
  saveChat();
  refreshChat();
  renderAttach();
}

function saveChat() {
  try {
    const keep = 6; // 只给最近 6 条消息留截图，图片是 base64，留多了记录文件会膨胀到十几 MB
    const arr = STATE.chat.slice(-20);
    const slim = arr.map((m, i) => ({
      role: m.role,
      content: m.content,
      images: i >= arr.length - keep ? (m.images || []).slice(0, 2) : []
    }));
    Store.set('tz_chat_v1', JSON.stringify(slim));
  } catch (e) { /* quota */ }
}

function loadChat() {
  try {
    const raw = Store.get('tz_chat_v1');
    if (raw) STATE.chat = JSON.parse(raw) || [];
  } catch (e) { STATE.chat = []; }
}

async function sendMsg() {
  if (STATE.streaming) return;
  if (!AI.configured()) {
    toast(AI.getConfig().enabled ? '请先在设置里填写模型配置' : 'AI 已关闭，请到设置中开启');
    goSettings();
    return;
  }
  const inp = $('#input');
  const text = (inp.value || '').trim();
  const images = STATE.attached.slice();
  if (!text && !images.length) return;

  inp.value = '';
  inp.style.height = 'auto';
  STATE.attached = [];
  renderAttach();

  STATE.chat.push({ role: 'user', content: text, images });
  saveChat();

  const bot = { role: 'assistant', content: '', streaming: true };
  STATE.chat.push(bot);
  refreshChat(2);
  scrollChat(true);

  STATE.streaming = true;
  const sendBtn = $('#send-btn');
  if (sendBtn) { sendBtn.innerHTML = IC.stop; sendBtn.onclick = stopStream; }

  const history = STATE.chat
    .slice(0, -1)
    .filter(m => m.content && m.content.trim())
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content }));

  if (!history.length) history.push({ role: 'user', content: text || '请审核这张作业票截图' });

  const ctrl = new AbortController();
  STATE.abort = ctrl;

  let last = 0;
  AI.stream({
    messages: history,
    images,
    signal: ctrl.signal,
    onDelta: (d, full) => {
      bot.content = full;
      const now = Date.now();
      if (now - last > 80) {
        last = now;
        patchStreamingBot(bot);
        scrollChat();
      }
    },
    onDone: () => {
      bot.streaming = false;
      STATE.streaming = false;
      STATE.abort = null;
      saveChat();
      finishStreamingBot(bot);
      scrollChat();
      resetSendBtn();
    },
    onError: (e, partial) => {
      bot.streaming = false;
      if (partial) bot.content = partial;
      bot.content = (bot.content ? bot.content + '\n\n' : '') + '⚠️ ' + AI.friendlyError(e);
      STATE.streaming = false;
      STATE.abort = null;
      saveChat();
      finishStreamingBot(bot);
      resetSendBtn();
    }
  });
}

function resetSendBtn() {
  const b = $('#send-btn');
  if (b) { b.innerHTML = IC.send; b.onclick = sendMsg; }
}

function stopStream() {
  if (STATE.abort) STATE.abort.abort();
}

function askAI(permitId) {
  const p = PERMIT_MAP[permitId];
  navigate('/ai');
  setTimeout(() => {
    const inp = $('#input');
    if (!inp) return;
    inp.value = p ? `我要办理${p.name}，请告诉我：1) 必须填哪些关键字段；2) 风险辨识该勾哪些项；3) 必选安全措施有哪些；4) 最容易出错的地方。` : '';
    inp.focus();
    autosize(inp);
  }, 120);
}

function autosize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(108, el.scrollHeight) + 'px';
}

/* ============================================================ 渲染 */
function render(keepScroll) {
  const prevY = keepScroll ? window.scrollY : 0;
  const route = parseHash();
  STATE.route = route;

  renderTopbar(route);
  renderTabbar(route);

  let html = '';
  if (route === '/' || route === '') html = viewHome();
  else if (route.startsWith('/p/')) html = viewDetail(route.split('/')[2]);
  else if (route === '/wizard') html = viewWizard();
  else if (route === '/ai') html = viewAI();
  else if (route === '/errors') html = viewErrors();
  else if (route === '/settings') html = viewSettings();
  else if (route === '/update') html = (typeof UPD !== 'undefined') ? UPD.view() : viewHome();
  else html = viewHome();

  const v = $('#view');
  v.innerHTML = html;
  /* keepScroll = 就地刷新（勾选措施、切换场景题）：不重播整页入场动画，滚动位置随后还原 */
  if (!keepScroll) {
    v.style.animation = 'none';
    void v.offsetWidth;
    v.style.animation = '';
  }

  if (route === '/ai') {
    refreshChat();
    renderAttach();
    const inp = $('#input');
    if (inp) {
      inp.addEventListener('input', () => autosize(inp));
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 720) {
          e.preventDefault();
          sendMsg();
        }
      });
      setTimeout(() => scrollChat(), 60);
    }
  }
  window.scrollTo(0, prevY);
}

/* -------------------------------------------------------- 启动 */
window.addEventListener('hashchange', render);
window.addEventListener('scroll', () => {
  const tb = $('#topbar');
  if (tb) tb.classList.toggle('scrolled', window.scrollY > 6);
});

document.addEventListener('DOMContentLoaded', () => {
  loadChat();
  const prof = AI.activeProfile();
  if (prof && (prof.provider === 'builtin' || prof.apiType === 'builtin')) AI.init();
  if (!location.hash) location.hash = '#/';
  render();

  // 安装到桌面（PWA）：仅在 http(s) 下注册
  // 安卓原生壳走本机回环地址，资源本来就打包在 APK 里，不需要 SW 缓存
  const loopback = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !loopback) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  /* 在线更新：静默检查（有结果才在首页弹提示条，检查本身不打扰） */
  if (typeof UPD !== 'undefined') {
    UPD.onChange = function () {
      const r = (location.hash || '').replace(/^#/, '') || '/';
      if (r === '/' && (UPD.state.web || UPD.state.apk) && !STATE._updShown) {
        STATE._updShown = true;
        render(true);
      }
    };
    UPD.autoMaybe();
  }
});
