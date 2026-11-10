/* ============================================================
 * 设置页 · AI 配置
 * ------------------------------------------------------------
 * 每套配置 = 服务商 + 接口类型 + 模型 + API Key + 自定义 BASE URL
 * 可保存多套并随时切换；密钥只存放在本机（经 Store 落本机文件，不上传）。
 * ============================================================ */

const SETTINGS = (function () {
  let draft = null;      // 正在编辑的配置副本
  let isNew = false;     // 是否是新建
  let showKey = false;   // 是否明文显示 Key
  let promptDraft = '';  // System Prompt 草稿

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function reset(pid) {
    const cfg = AI.getConfig();
    if (pid === 'new') {
      draft = AI.newProfile('glm');
      isNew = true;
    } else if (pid) {
      const p = AI.getProfile(pid);
      draft = p ? clone(p) : clone(AI.activeProfile());
      isNew = !p;
    } else {
      const p = AI.activeProfile();
      draft = p ? clone(p) : AI.newProfile('glm');
      isNew = !p;
    }
    showKey = false;
    promptDraft = cfg.systemPrompt || AI.defaultPrompt();
  }

  function ensure() {
    if (!draft) reset();
    if (!promptDraft) promptDraft = AI.getConfig().systemPrompt || AI.defaultPrompt();
    return draft;
  }

  /* -------------------------------------------------- 交互 */
  function field(k, v) {
    ensure();
    draft[k] = v;
    if (k === 'model') draft.vision = guessVisionFor(draft.provider, v);
    if (k === 'baseURL') {
      const h = document.querySelector('#url-hint');
      if (h) h.innerHTML = urlHint(draft);
    }
  }

  function guessVisionFor(provider, model) {
    return AI.guessVision(provider, model);
  }

  /* BASE URL 下方提示：把「最终会请求哪个地址」直接写出来，填错一眼能看出 */
  function urlHint(d) {
    const own = String(d.baseURL || '').trim();
    if (own && !/^https?:\/\//i.test(own)) {
      return '<span class="danger-text">地址缺少 https:// ，浏览器会当成相对路径导致「网络请求失败」。请补成 https://' + esc(own) + '</span>';
    }
    if (!own && d.provider === 'custom') {
      return '<span class="danger-text">「自定义」必须填 BASE URL。留空会去请求 https://api.openai.com，国内一般不通，表现就是「网络请求失败」。</span>';
    }
    let final = '';
    try { final = AI.resolveURL(d); } catch (e) { final = ''; }
    if (!final) return '留空则用该厂商默认地址；填了就以你填的为准。';
    return (own ? '实际请求：' : '留空，实际请求：') + '<span class="mono-hint">' + esc(final) + '</span>';
  }

  function changeProvider(id) {
    ensure();
    const pv = AI.provider(id);
    const oldLabel = AI.provider(draft.provider).label;
    const keepName = !draft.name || draft.name === oldLabel;
    draft.provider = pv.id;
    draft.apiType = pv.apiType;
    if (pv.baseURL) draft.baseURL = pv.baseURL;
    else if (!draft.baseURL) draft.baseURL = '';
    if (pv.models.length) draft.model = pv.models[0];
    else draft.model = '';
    draft.vision = pv.apiType === 'builtin' ? true : guessVisionFor(pv.id, draft.model);
    draft.visionModel = pv.visionModel || '';
    if (keepName) draft.name = pv.label;
    render();
  }

  function pick(id) {
    saveDraftQuiet();
    reset(id);
    render();
  }

  function toggleAI() {
    const cfg = AI.getConfig();
    AI.patchConfig({ enabled: !cfg.enabled });
    render();
  }

  function toggleVision() {
    ensure();
    draft.vision = !draft.vision;
    render();
  }

  function eye() {
    showKey = !showKey;
    const el = document.querySelector('#api-key');
    if (el) el.type = showKey ? 'text' : 'password';
    const b = document.querySelector('#eye-btn');
    if (b) b.textContent = showKey ? '隐藏' : '显示';
  }

  function prompt(v) { promptDraft = v; }

  function resetPrompt() {
    promptDraft = AI.defaultPrompt();
    render();
  }

  /* -------------------------------------------------- 保存 */
  function saveDraftQuiet() {
    if (!draft) return;
    // 只在用户主动点保存时落盘；这里用于切换配置前把输入框的值带走
    const el = document.querySelector('#cfg-name');
    if (el && el.value.trim()) draft.name = el.value.trim();
  }

  function save() {
    ensure();
    const el = document.querySelector('#cfg-name');
    if (el && el.value.trim()) draft.name = el.value.trim();
    if (!draft.name) draft.name = AI.provider(draft.provider).label;

    if (draft.apiType !== 'builtin' && draft.provider !== 'builtin') {
      if (!draft.model) { toast('请填写模型名'); return; }
      if (!draft.apiKey) { toast('请填写 API Key'); return; }
    }

    AI.upsertProfile(clone(draft));
    AI.patchConfig({ systemPrompt: promptDraft === AI.defaultPrompt() ? '' : promptDraft, activeId: draft.id });
    isNew = false;
    toast('已保存并启用');
    render();
  }

  function remove() {
    ensure();
    if (!AI.removeProfile(draft.id)) { toast('至少保留一套配置'); return; }
    reset();
    toast('已删除');
    render();
  }

  async function test() {
    ensure();
    const box = document.querySelector('#test-out');
    if (box) box.innerHTML = '<span class="test-pending">正在连接 ' + esc(AI.provider(draft.provider).label) + ' · ' + esc(draft.model || '自动选择') + ' …</span>';

    const probe = clone(draft);
    if (probe.apiType !== 'builtin' && probe.provider !== 'builtin') {
      if (!probe.model) { if (box) box.innerHTML = '<span class="test-bad">请先填写模型名</span>'; return; }
      if (!probe.apiKey) { if (box) box.innerHTML = '<span class="test-bad">请先填写 API Key</span>'; return; }
    }

    try {
      const t = await AI.ping(probe);
      const u = safeURL(probe);
      if (box) box.innerHTML = '<span class="test-ok">✓ 连接成功</span><span class="test-msg">' + esc(String(t).slice(0, 120)) + '</span>'
        + (u ? '<div class="test-url">请求地址：' + esc(u) + '</div>' : '');
    } catch (e) {
      const m = AI.friendlyError(e);
      const u = safeURL(probe);
      if (box) box.innerHTML = '<span class="test-bad">✕ 连接失败</span><span class="test-msg">' + esc(m) + '</span>'
        + (u ? '<div class="test-url">请求地址：' + esc(u) + '</div>' : '')
        + '<div class="test-url">原始报错：' + esc(((e && e.message) || '').slice(0, 160)) + '</div>';
    }
  }

  function safeURL(p) {
    try { return AI.resolveURL(p) || ''; } catch (e) { return ''; }
  }

  /* -------------------------------------------------- 视图 */
  function view() {
    const d = ensure();
    const cfg = AI.getConfig();
    const pv = AI.provider(d.provider);
    const builtin = pv.apiType === 'builtin';
    const active = cfg.enabled && AI.configured();

    const chips = cfg.profiles.map(p => `
      <button class="chip ${p.id === d.id ? 'on' : ''}" onclick="SETTINGS.pick('${p.id}')">
        ${esc(p.name || p.model || '配置')}
        ${p.id === cfg.activeId ? '<span class="chip-dot"></span>' : ''}
      </button>
    `).join('');

    const modelChips = (pv.models || []).length
      ? `<div class="mini-row">${pv.models.slice(0, 4).map(m => `<button class="mini-chip" onclick="SETTINGS.field('model','${esc(m)}');SETTINGS.repaint()">${esc(m)}</button>`).join('')}</div>`
      : '';

    return `
    <div class="set-card ${cfg.enabled ? '' : 'off'}">
      <div class="set-row">
        <div class="set-ic">${IC.sparkle}</div>
        <div style="flex:1;min-width:0">
          <div class="set-t">AI 助手</div>
          <div class="set-d">${cfg.enabled ? (AI.configured() ? '已启用 · ' + esc(AI.summary()) : '已开启，但配置还不完整') : '已关闭，AI 页暂不可用'}</div>
        </div>
        <button class="switch big ${cfg.enabled ? 'on' : ''}" onclick="SETTINGS.toggleAI()" aria-label="AI 开关"></button>
      </div>
      ${active ? `<div class="set-foot">${IC.check}<span>规则库已注入：8 类作业票 · 填写标准全文</span></div>` : ''}
    </div>

    <div class="sec">
      <div class="sec-head">
        <div class="sec-title">模型配置</div>
        <div class="sec-desc">可保存多套，随时切换</div>
      </div>
      <div class="chip-row">
        ${chips}
        <button class="chip add" onclick="SETTINGS.pick('new')">＋ 新建</button>
      </div>
      <div class="fld-hint" style="padding:8px 2px 0">带圆点的是当前使用中的配置。不同设备各自保存，不会上传。</div>
    </div>

    <div class="setting-card">
      <label class="fld">
        <span class="fld-label">配置名称</span>
        <input id="cfg-name" class="fld-input" value="${esc(d.name)}" placeholder="例如：公司网关 / 我的 GLM"
               oninput="SETTINGS.field('name', this.value)">
      </label>

      <label class="fld">
        <span class="fld-label">AI 厂商</span>
        <div class="select-wrap">
          <select class="fld-input" onchange="SETTINGS.changeProvider(this.value)">
            ${AI.PROVIDERS.map(p => `<option value="${p.id}" ${p.id === d.provider ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}
          </select>
          <span class="select-arrow">${IC.arrow}</span>
        </div>
      </label>

      <label class="fld">
        <span class="fld-label">模型</span>
        <input class="fld-input" value="${esc(d.model)}" placeholder="${builtin ? '自动选择（优先支持图片的模型）' : '如 glm-4.6'}"
               ${builtin ? 'disabled' : ''} oninput="SETTINGS.field('model', this.value)">
        ${builtin ? '' : modelChips}
      </label>

      ${builtin ? '' : `
      <label class="fld">
        <span class="fld-label">API KEY（必填）</span>
        <div class="fld-inline">
          <input id="api-key" class="fld-input" type="${showKey ? 'text' : 'password'}" value="${esc(d.apiKey)}"
                 placeholder="粘贴你的 API Key" autocomplete="off" spellcheck="false"
                 oninput="SETTINGS.field('apiKey', this.value)">
          <button id="eye-btn" class="fld-btn" onclick="SETTINGS.eye()">${showKey ? '隐藏' : '显示'}</button>
        </div>
        <div class="fld-hint">${esc(pv.hint)}。不填 API Key 则无法使用 AI 助手。</div>
      </label>

      <label class="fld">
        <span class="fld-label">自定义 BASE URL（可选）</span>
        <input class="fld-input" value="${esc(d.baseURL)}" placeholder="${esc(pv.baseURL || 'https://your-gateway.com/v1/chat/completions')}"
               spellcheck="false" oninput="SETTINGS.field('baseURL', this.value)">
        <div class="fld-hint" id="url-hint">${urlHint(d)}</div>
      </label>
      `}

      <div class="toggle-row">
        <div class="tr-main">
          <div class="tr-t">该模型支持图片识别</div>
          <div class="tr-d">审票功能依赖视觉能力，关掉后只能做文字问答</div>
        </div>
        <button class="switch ${d.vision ? 'on' : ''}" onclick="SETTINGS.toggleVision()" aria-label="图片识别开关"></button>
      </div>

      ${(!d.vision && !builtin) ? `
      <label class="fld" style="margin-top:14px">
        <span class="fld-label">审票用视觉模型（可选）</span>
        <input class="fld-input" value="${esc(d.visionModel || '')}" placeholder="${esc(pv.visionModel || '如 glm-4.5v')}"
               spellcheck="false" oninput="SETTINGS.field('visionModel', this.value)">
        <div class="fld-hint">${pv.visionModel
          ? '你选了文字模型做题，这块填一个同厂商的视觉模型：发截图时自动切过去审票，平时问答仍用上面的模型，共用一把 Key。'
          : '该厂商没有可用的视觉模型。想审票请换到智谱 / 通义 / Kimi 的视觉模型，或用支持读图的厂商。'}</div>
      </label>` : ''}
    </div>

    <div class="setting-card" style="margin-top:12px">
      <div class="fld">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px">
          <span class="fld-label" style="margin:0">SYSTEM PROMPT</span>
          <button class="link-btn" onclick="SETTINGS.resetPrompt()">恢复默认</button>
        </div>
        <textarea class="fld-input fld-area" rows="7" spellcheck="false"
                  oninput="SETTINGS.prompt(this.value)">${esc(promptDraft)}</textarea>
        <div class="fld-hint">8 类作业票的《填写标准》摘要会自动追加在这段提示词之后，不需要你手动贴进来。</div>
      </div>
    </div>

    <div class="setting-actions">
      <button class="btn ghost" onclick="SETTINGS.test()">测试连接</button>
      <button class="btn primary" onclick="SETTINGS.save()">${isNew ? '保存并启用' : '保存修改'}</button>
    </div>

    <div id="test-out" class="test-out"></div>

    ${cfg.profiles.length > 1 ? `<button class="btn ghost block danger-text" style="margin-top:12px" onclick="SETTINGS.remove()">删除这套配置</button>` : ''}

    ${(typeof UPD !== 'undefined') ? (() => {
      const ui = UPD.info();
      const web = ui.webVersion || (APP_VERSION + '（内置）');
      const apk = (ui.apkVersionName || APP_VERSION) + (ui.apkVersionCode ? '（' + ui.apkVersionCode + '）' : '');
      return `
    <div class="sec">
      <div class="sec-head"><div class="sec-title">应用更新</div><div class="sec-desc">网页可热更新，不用重装</div></div>
      <div class="row-list">
        <div class="row-item" onclick="navigate('/update')">
          <div class="note-ic">${IC.up}</div>
          <div class="ri-main">
            <div class="ri-t">检查更新</div>
            <div class="ri-d">安装包 ${esc(apk)} · 网页 ${esc(web)}</div>
          </div>
          <span class="ri-arrow">${IC.arrow}</span>
        </div>
      </div>
    </div>
      `;
    })() : ''}

    <div class="sec">
      <div class="sec-head"><div class="sec-title">几点说明</div></div>
      <div class="row-list">
        <div class="row-item" style="cursor:default">
          <div class="note-ic">${IC.shield}</div>
          <div class="ri-main">
            <div class="ri-t">API Key 必填</div>
            <div class="ri-d" style="white-space:normal">不填 API Key 就无法使用 AI 助手。应用本身不含任何密钥，需要用自己厂商账号里的 Key。</div>
          </div>
        </div>
        <div class="row-item" style="cursor:default">
          <div class="note-ic">${IC.shield}</div>
          <div class="ri-main">
            <div class="ri-t">密钥只存在本机</div>
            <div class="ri-d" style="white-space:normal">API Key 只保存在本机，不会上传到任何服务器；换设备或清除应用数据后需重新填。</div>
          </div>
        </div>
        <div class="row-item" style="cursor:default">
          <div class="note-ic">${IC.alert}</div>
          <div class="ri-main">
            <div class="ri-t">如果提示网络失败</div>
            <div class="ri-d" style="white-space:normal">多为供应商的浏览器跨域（CORS）限制。可改用内置通道，或在 BASE URL 填一个自己的转发地址。</div>
          </div>
        </div>
        <div class="row-item" style="cursor:default">
          <div class="note-ic">${IC.wand}</div>
          <div class="ri-main">
            <div class="ri-t">审票请选带视觉的模型</div>
            <div class="ri-d" style="white-space:normal">如 glm-4v-plus、qwen-vl-max、gpt-4o、claude-sonnet、gemini-flash；纯文本模型只能聊天。</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-note">
      AI 输出仅作辅助，最终以属地 HSE 审核意见为准<br>
      <span style="opacity:.75">作业票助手 v${typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''} · 规则库 8 类票 · 125 条措施</span>
    </div>
    `;
  }

  function repaint() { render(); }

  return {
    reset: reset,
    ensure: ensure,
    view: view,
    field: field,
    changeProvider: changeProvider,
    pick: pick,
    toggleAI: toggleAI,
    toggleVision: toggleVision,
    eye: eye,
    prompt: prompt,
    resetPrompt: resetPrompt,
    save: save,
    remove: remove,
    test: test,
    repaint: repaint
  };
})();

function viewSettings() {
  return SETTINGS.view();
}

function goSettings(pid) {
  SETTINGS.reset(pid);
  navigate('/settings');
}
