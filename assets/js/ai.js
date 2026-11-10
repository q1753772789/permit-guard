/* ============================================================
 * AI 能力层 · 多厂商可配置接入
 * ------------------------------------------------------------
 * 参考 weclaws 的做法：不把模型写死在环境变量里，
 * 而是让每个用户在界面里保存多套「服务商 + 模型 + Key + 网关」，随时切换。
 *
 * 支持的接口类型：
 *   - openai-completions   （OpenAI / GLM / DeepSeek / 通义 / Kimi / 任意兼容网关）
 *   - anthropic-messages   （Claude）
 *   - google-generative-ai （Gemini）
 *   - builtin              （WorkBuddy 云服务免密钥通道）
 * ============================================================ */

const AI = (function () {
  const LS_KEY = 'tz_ai_cfg_v2';

  /* -------------------------------------------------- 厂商预设 */
  const PROVIDERS = [
    {
      id: 'glm', label: '智谱 GLM', apiType: 'openai',
      baseURL: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      models: ['glm-4.6', 'glm-4.5v', 'glm-4.5', 'glm-4.5-air', 'glm-4v-plus', 'glm-4v-flash'],
      visionModel: 'glm-4.5v',
      hint: '在 open.bigmodel.cn 控制台创建 API Key'
    },
    {
      id: 'deepseek', label: 'DeepSeek', apiType: 'openai',
      baseURL: 'https://api.deepseek.com/v1/chat/completions',
      models: ['deepseek-chat', 'deepseek-reasoner'],
      visionModel: '',
      hint: '在 platform.deepseek.com 创建 API Key（不支持图片识别）'
    },
    {
      id: 'qwen', label: '通义千问', apiType: 'openai',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      models: ['qwen-plus', 'qwen-max', 'qwen-vl-max', 'qwen3-vl-plus'],
      visionModel: 'qwen-vl-max',
      hint: '阿里云百炼控制台，使用 compatible-mode 兼容接口'
    },
    {
      id: 'kimi', label: 'Kimi（月之暗面）', apiType: 'openai',
      baseURL: 'https://api.moonshot.cn/v1/chat/completions',
      models: ['kimi-k2-0905-preview', 'moonshot-v1-32k', 'moonshot-v1-8k-vision-preview'],
      visionModel: 'moonshot-v1-8k-vision-preview',
      hint: '在 platform.moonshot.cn 创建 API Key'
    },
    {
      id: 'openai', label: 'OpenAI', apiType: 'openai',
      baseURL: 'https://api.openai.com/v1/chat/completions',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
      visionModel: '',
      hint: '在 platform.openai.com 创建 API Key'
    },
    {
      id: 'claude', label: 'Claude', apiType: 'anthropic',
      baseURL: 'https://api.anthropic.com/v1/messages',
      models: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1'],
      visionModel: '',
      hint: '在 console.anthropic.com 创建 API Key'
    },
    {
      id: 'gemini', label: 'Gemini', apiType: 'google',
      baseURL: 'https://generativelanguage.googleapis.com',
      models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
      visionModel: '',
      hint: '在 aistudio.google.com 获取 API Key'
    },
    {
      id: 'custom', label: '自定义（OpenAI 兼容）', apiType: 'openai',
      baseURL: '', models: [], visionModel: '',
      hint: '填写完整地址，如 https://your-gateway.com/v1/chat/completions；也可填自建代理解决跨域'
    },
    {
      id: 'builtin', label: '内置通道（免密钥）', apiType: 'builtin',
      baseURL: '', models: [], visionModel: '',
      hint: 'WorkBuddy 云服务，无需填写 Key；需通过正式域名打开应用'
    }
  ];

  const PUBLIC_CONFIG = {
    endpoint: 'https://permit-guard.app.workbuddy.host',
    oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
    publishableKey: 'wbpk_vzSInZk141gM142sJYpIvQ_tE6Iba6R3yyDWFK5TOccxorzgavO0lsj'
  };

  /* -------------------------------------------------- 人设与规则 */
  const DEFAULT_ROLE = [
    '你是「作业票助手」的 AI 专家，服务于化工企业现场，精通特殊作业票（动火、受限空间、高处、吊装、临时用电、动土、盲板抽堵、断路）的办理规则、风险辨识与安全措施落实。',
    '',
    '回答纪律：',
    '1. 只依据下方【官方规则摘要】作答。规则里没写的，明确说"标准未明确，需向属地 HSE 确认"，绝不编造条款编号。',
    '2. 用简体中文，语气像一位耐心的老师傅，先给结论再给依据。',
    '3. 每次回答必须主动点出"最容易错的地方"，这是用户最需要的。',
    '4. 涉及签批权限、级别判定时，要把判定依据（高度/吨位/介质/区域）写清楚。',
    '5. 不要输出与安全问题无关的寒暄。',
    '6. 安全措施按票面勾选方式分三类，不要混为一谈：①必须勾选——无条件条目，票面一律打√。里面有两种，都是打√：要动手落实的（配灭火器、设警戒、加盲板），和"现场核实"型的（如确认周边 30m 内无排放、确认没拿管道当锚点、沿动火点走一圈看有无孔洞窨井地沟）。现场核实型核实结果是"没有"也照样打√，绝不能建议用户标不适用；App 里这类条目带"勾选原因"，就是告诉用户为什么必须勾，回答时也要讲清这个道理。②核查确认——原文带"如有/涉及…时"或只在特定设施、敷设方式、介质、作业级别下才存在的措施（如"动火设备内部构件清理干净、蒸汽吹扫或水洗合格"），票面方框先留空，由办票人逐条核实：涉及就打√，确实不涉及的在备注写明理由后标"不适用"，不能替人下"不涉及"结论。③明确未涉及——只有随关联作业票联动、且本次没办那张票时才成立（如只办动火票、没办高处票，动火措施 4 才可判明确未涉及）。用户问"哪些不用勾"时，只有③能说不勾，②一律要求现场核实后自行勾选，不能替人下结论。'
  ].join('\n');

  const REVIEW_INSTRUCTION = [
    '',
    '',
    '================ 当前任务：审票 ================',
    '用户上传了一张（或多张）作业票截图。请严格按下列格式输出审核报告：',
    '',
    '## 一、识别结果',
    '用 3–5 行说明你从截图中读到的：作业票类型、票号、作业内容、作业地点、作业级别、作业单位/负责人。',
    '若某字段看不清或被遮挡，写"截图未显示/不清晰"，不要猜。',
    '',
    '## 二、审核结论',
    '直接给结论：**【可通过】/【需整改后通过】/【不建议通过】**，并用一句话说明最关键的理由。',
    '',
    '## 三、问题清单',
    '按严重程度排序，每条用如下格式（没有问题的部分不要凑数）：',
    '- 🔴 严重 ｜ 字段/位置：xxx ｜ 问题：xxx ｜ 依据：xxx ｜ 整改：xxx',
    '- 🟠 一般 ｜ 同上格式',
    '- 🟡 提示 ｜ 同上格式',
    '重点检查：作业内容是否具体、级别判定是否正确、风险辨识必选项是否勾全、必选安全措施是否勾选或有"未涉及"、',
    '互锁措施（如临电措施5与7）是否同时勾选、签字人是否存在同一人兼任、特种作业证号/司索人/监护人是否缺失、',
    '【】内数字是否留空、关联作业票状态是否一致。',
    '',
    '## 四、缺失的必填项',
    '列出截图中明显空白或未下拉填写的必填栏位。',
    '',
    '## 五、下一步',
    '用 2–4 条可执行的行动项收尾。',
    '',
    '注意：你只能看到截图，看不到现场。凡是涉及现场实际状态的判断（如监护人是否在场、气体浓度、接地是否可靠），',
    '必须注明"需现场核实"。'
  ].join('\n');

  /* -------------------------------------------------- 配置存储 */
  function newId() {
    return 'p' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);
  }

  function guessVision(provider, model) {
    if (provider === 'claude' || provider === 'gemini' || provider === 'openai') return true;
    const m = String(model || '').toLowerCase();
    if (/vision|omni|multimodal|image|-vl|vl-|4o|gpt-4\.1/.test(m)) return true;
    if (/\d+(\.\d+)?v($|[-_ ])/.test(m)) return true;              // glm-4.5v / glm-4v-plus
    if (/deepseek|reasoner|kimi-k2|moonshot-v1-32k|glm-4(\.\d+)?(-air)?$|qwen-(plus|max|turbo)$/.test(m)) return false;
    return true;
  }

  function providerOf(id) {
    return PROVIDERS.filter(p => p.id === id)[0] || PROVIDERS[0];
  }

  function newProfile(providerId, name) {
    const pv = providerOf(providerId || 'glm');
    const model = pv.models[0] || '';
    return {
      id: newId(),
      name: name || pv.label,
      provider: pv.id,
      apiType: pv.apiType,
      model: model,
      apiKey: '',
      baseURL: pv.baseURL || '',
      vision: pv.id === 'builtin' ? true : guessVision(pv.id, model),
      visionModel: pv.visionModel || '',
      temperature: 0.4
    };
  }

  function defaultConfig() {
    const p = newProfile('glm');
    return { enabled: true, activeId: p.id, systemPrompt: '', profiles: [p] };
  }

  let cfg = null;

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return defaultConfig();
    const out = {
      enabled: raw.enabled !== false,
      activeId: '',
      systemPrompt: typeof raw.systemPrompt === 'string' ? raw.systemPrompt : '',
      profiles: []
    };
    if (Array.isArray(raw.profiles)) {
      raw.profiles.forEach(p => {
        if (!p || !p.id) return;
        const pv = PROVIDERS.filter(x => x.id === p.provider)[0];
        out.profiles.push({
          id: p.id,
          name: p.name || (pv ? pv.label : '配置'),
          provider: pv ? pv.id : 'custom',
          apiType: ['openai', 'anthropic', 'google', 'builtin'].indexOf(p.apiType) >= 0 ? p.apiType : 'openai',
          model: p.model || '',
          apiKey: p.apiKey || '',
          baseURL: p.baseURL || '',
          vision: p.vision !== false,
          visionModel: p.visionModel || '',
          temperature: typeof p.temperature === 'number' ? p.temperature : 0.4
        });
      });
    }
    if (!out.profiles.length) out.profiles = [newProfile('glm')];
    out.activeId = raw.activeId && out.profiles.some(p => p.id === raw.activeId) ? raw.activeId : out.profiles[0].id;
    return out;
  }

  function load() {
    if (cfg) return cfg;
    try {
      const raw = Store.get(LS_KEY);
      if (raw) cfg = normalize(JSON.parse(raw));
    } catch (e) { /* ignore */ }
    if (!cfg) cfg = defaultConfig();
    return cfg;
  }

  function persist() {
    try { Store.set(LS_KEY, JSON.stringify(cfg)); } catch (e) { /* quota */ }
  }

  function getConfig() { return load(); }

  function activeProfile() {
    const c = load();
    return c.profiles.filter(p => p.id === c.activeId)[0] || c.profiles[0] || null;
  }

  function getProfile(id) {
    return load().profiles.filter(p => p.id === id)[0] || null;
  }

  function upsertProfile(p) {
    const c = load();
    const i = c.profiles.findIndex(x => x.id === p.id);
    if (i >= 0) c.profiles[i] = p; else c.profiles.push(p);
    c.activeId = p.id;
    persist();
    cfg = c;
    return c;
  }

  function removeProfile(id) {
    const c = load();
    if (c.profiles.length <= 1) return false;
    c.profiles = c.profiles.filter(p => p.id !== id);
    if (c.activeId === id) c.activeId = c.profiles[0].id;
    persist();
    cfg = c;
    return true;
  }

  function setActive(id) {
    const c = load();
    if (!c.profiles.some(p => p.id === id)) return;
    c.activeId = id;
    persist();
    cfg = c;
  }

  function patchConfig(patch) {
    const c = load();
    Object.keys(patch || {}).forEach(k => { c[k] = patch[k]; });
    persist();
    cfg = c;
  }

  function configured() {
    const c = load();
    const p = activeProfile();
    if (!c.enabled || !p) return false;
    if (p.provider === 'builtin' || p.apiType === 'builtin') return true;
    return !!(p.apiKey && p.model);
  }

  function summary() {
    const c = load();
    const p = activeProfile();
    if (!p) return '未配置';
    const label = providerOf(p.provider).label;
    const m = p.provider === 'builtin' ? '自动选择' : (p.model || '未选模型');
    return label + ' · ' + m + (c.enabled ? '' : '（已关闭）');
  }

  /* -------------------------------------------------- 云服务内置通道 */
  let cloud = null;
  let modelCache = null;

  function initCloud() {
    if (cloud) return cloud;
    try {
      if (!window.WorkBuddyCloud || typeof window.WorkBuddyCloud.createWorkBuddyCloud !== 'function') {
        throw new Error('内置通道未加载（需要联网加载 SDK）');
      }
      cloud = window.WorkBuddyCloud.createWorkBuddyCloud({
        endpoint: PUBLIC_CONFIG.endpoint,
        oauthRelayBaseUrl: PUBLIC_CONFIG.oauthRelayBaseUrl,
        publishableKey: PUBLIC_CONFIG.publishableKey
      });
    } catch (e) {
      console.warn('[AI] cloud init failed', e);
    }
    return cloud;
  }

  async function cloudModel(needVision) {
    const c = initCloud();
    if (!c) throw new Error('内置通道未就绪，请检查网络或改用自填 API Key');
    if (!modelCache) {
      const list = await c.llm.models.list();
      if (!list || !list.length) throw new Error('当前暂无可用的内置模型');
      modelCache = list.filter(m => m.disabled !== true && m.enabled !== false);
      if (!modelCache.length) throw new Error('暂无已启用的内置模型');
    }
    if (needVision) {
      const vm = modelCache.filter(m => m.supportsImages === true)[0];
      if (vm) return vm;
      if (!modelCache.some(m => m.supportsImages !== false)) return modelCache[0];
      throw new Error('内置模型均不支持图片识别，请改用文字描述，或在设置里填入支持视觉的模型');
    }
    return modelCache[0];
  }

  /* -------------------------------------------------- 提示词组装 */
  function rolePrompt() {
    const c = load();
    const t = (c.systemPrompt || '').trim();
    return t || DEFAULT_ROLE;
  }

  function systemPrompt() {
    return rolePrompt() + '\n\n【官方规则摘要】\n\n' + buildRuleDigest();
  }

  /* -------------------------------------------------- 转发通道 */
  /* 安卓壳里页面来自 http://127.0.0.1:PORT，厂商接口的 OPTIONS 预检会被拒，
     导致 fetch 抛 Failed to fetch。改由原生层代发（同源，无预检）。 */
  function xurl(u) {
    const base = (typeof window !== 'undefined' && window.__RELAY_BASE) ? window.__RELAY_BASE : '';
    if (!base || !u || u.indexOf('http') !== 0) return u;
    if (u.indexOf(base) === 0) return u;
    return base + '?u=' + encodeURIComponent(u);
  }

  /* -------------------------------------------------- URL 归一化 */
  /* 留空时回退到「当前厂商」的默认地址，而不是一律回退到 OpenAI */
  function baseOf(prof) {
    const own = String(prof.baseURL || '').trim();
    if (own) return own;
    return String(providerOf(prof.provider).baseURL || '').trim();
  }

  function resolveOpenAIURL(base) {
    let u = String(base || '').trim();
    if (!u) u = 'https://api.openai.com/v1/chat/completions';
    u = u.replace(/\/+$/, '');
    if (/\/chat\/completions$/.test(u)) return u;
    if (/\/completions$/.test(u)) return u;
    if (/\/v\d+(\.\d+)?$/.test(u)) return u + '/chat/completions';
    if (/^https?:\/\/[^/]+$/.test(u)) return u + '/v1/chat/completions';
    return u + '/chat/completions';
  }

  /* 把「配置」换算成真正要请求的地址，供设置页回显与排错 */
  function resolveURL(prof) {
    const p = prof || activeProfile();
    if (!p) return '';
    if (p.provider === 'builtin' || p.apiType === 'builtin') return '内置免密钥通道';
    const base = baseOf(p);
    if (p.apiType === 'anthropic') return resolveAnthropicURL(base);
    if (p.apiType === 'google') return geminiURL(base, p.model, 'REDACTED', false);
    return resolveOpenAIURL(base);
  }

  function resolveAnthropicURL(base) {
    let u = String(base || '').trim();
    if (!u) u = 'https://api.anthropic.com/v1/messages';
    u = u.replace(/\/+$/, '');
    if (/\/messages$/.test(u)) return u;
    if (/\/v\d+$/.test(u)) return u + '/messages';
    if (/^https?:\/\/[^/]+$/.test(u)) return u + '/v1/messages';
    return u + '/messages';
  }

  function geminiURL(base, model, key, stream) {
    let u = String(base || '').trim() || 'https://generativelanguage.googleapis.com';
    u = u.replace(/\/+$/, '');
    if (!/\/v1(beta)?$/.test(u)) u += '/v1beta';
    return u + '/models/' + encodeURIComponent(model) +
      (stream ? ':streamGenerateContent?alt=sse&key=' : ':generateContent?key=') +
      encodeURIComponent(key);
  }

  /* -------------------------------------------------- SSE 解析 */
  async function pipeSSE(resp, onData) {
    if (!resp.body || !resp.body.getReader) {
      const txt = await resp.text();
      txt.split(/\r?\n/).forEach(line => {
        const t = line.trim();
        if (t.indexOf('data:') === 0) onData(t.slice(5).trim());
      });
      return;
    }
    const reader = resp.body.getReader();
    const dec = new TextDecoder('utf-8');
    let buf = '';
    const handle = block => {
      block.split('\n').forEach(line => {
        const t = line.trim();
        if (!t || t.indexOf(':') === 0) return;
        if (t.indexOf('event:') === 0 || t.indexOf('id:') === 0) return;
        if (t.indexOf('data:') === 0) onData(t.slice(5).trim());
      });
    };
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      buf = buf.replace(/\r\n/g, '\n');
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        handle(buf.slice(0, i));
        buf = buf.slice(i + 2);
      }
    }
    if (buf.trim()) handle(buf);
  }

  async function ensureOk(resp) {
    if (resp.ok) return;
    let detail = '';
    try {
      const text = await resp.text();
      try {
        const j = JSON.parse(text);
        detail = (j.error && (j.error.message || j.error.type)) || j.message || text.slice(0, 300);
      } catch (e) {
        detail = text.slice(0, 300);
      }
    } catch (e) { /* ignore */ }
    const err = new Error(detail || ('HTTP ' + resp.status));
    err.status = resp.status;
    throw err;
  }

  /* -------------------------------------------------- 各协议实现 */
  function toImageBlocks(images) {
    const out = [];
    (images || []).forEach(u => {
      const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(String(u));
      if (m) out.push({ mime: m[1], data: m[2] });
    });
    return out;
  }

  function mergeRoles(hist) {
    const out = [];
    hist.forEach(m => {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      const content = String(m.content || '').trim();
      if (!content) return;
      const last = out[out.length - 1];
      if (last && last.role === role) last.content += '\n\n' + content;
      else out.push({ role: role, content: content });
    });
    while (out.length && out[0].role !== 'user') out.shift();
    return out;
  }

  async function streamOpenAI(prof, sys, hist, prompt, images, push, signal) {
    const url = resolveOpenAIURL(baseOf(prof));
    const userContent = images.length
      ? [{ type: 'text', text: prompt }].concat(images.map(u => ({ type: 'image_url', image_url: { url: u } })))
      : prompt;

    const body = {
      model: prof.model,
      stream: true,
      temperature: prof.temperature == null ? 0.4 : prof.temperature,
      messages: [{ role: 'system', content: sys }]
        .concat(hist.map(m => ({ role: m.role, content: m.content })))
        .concat([{ role: 'user', content: userContent }])
    };

    const resp = await fetch(xurl(url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + prof.apiKey },
      body: JSON.stringify(body),
      signal: signal
    });
    await ensureOk(resp);

    await pipeSSE(resp, data => {
      if (!data || data === '[DONE]') return;
      let j;
      try { j = JSON.parse(data); } catch (e) { return; }
      const ch = j.choices && j.choices[0];
      if (!ch) return;
      const d = ch.delta || ch.message;
      if (!d) return;
      if (typeof d.content === 'string' && d.content) push(d.content);
      else if (Array.isArray(d.content)) {
        d.content.forEach(part => { if (part && part.text) push(part.text); });
      }
    });
  }

  async function streamAnthropic(prof, sys, hist, prompt, images, push, signal) {
    const url = resolveAnthropicURL(baseOf(prof));
    const blocks = toImageBlocks(images).map(img => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mime, data: img.data }
    }));
    blocks.push({ type: 'text', text: prompt });

    const msgs = mergeRoles(hist);
    msgs.push({ role: 'user', content: blocks });

    const resp = await fetch(xurl(url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': prof.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: prof.model,
        max_tokens: 4096,
        temperature: prof.temperature == null ? 0.4 : prof.temperature,
        system: sys,
        stream: true,
        messages: msgs
      }),
      signal: signal
    });
    await ensureOk(resp);

    await pipeSSE(resp, data => {
      if (!data || data === '[DONE]') return;
      let j;
      try { j = JSON.parse(data); } catch (e) { return; }
      if (j.type === 'content_block_delta' && j.delta && j.delta.type === 'text_delta' && j.delta.text) {
        push(j.delta.text);
      }
    });
  }

  async function streamGemini(prof, sys, hist, prompt, images, push, signal) {
    const url = geminiURL(baseOf(prof), prof.model, prof.apiKey, true);
    const parts = toImageBlocks(images).map(img => ({ inline_data: { mime_type: img.mime, data: img.data } }));
    parts.push({ text: prompt });

    const contents = mergeRoles(hist).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    contents.push({ role: 'user', parts: parts });

    const resp = await fetch(xurl(url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sys }] },
        contents: contents,
        generationConfig: {
          temperature: prof.temperature == null ? 0.4 : prof.temperature,
          maxOutputTokens: 4096
        }
      }),
      signal: signal
    });
    await ensureOk(resp);

    await pipeSSE(resp, data => {
      if (!data || data === '[DONE]') return;
      let j;
      try { j = JSON.parse(data); } catch (e) { return; }
      const cand = j.candidates && j.candidates[0];
      const ps = cand && cand.content && cand.content.parts;
      if (!ps) return;
      ps.forEach(p => { if (p && typeof p.text === 'string') push(p.text); });
    });
  }

  async function streamBuiltin(prof, sys, hist, prompt, images, push, signal) {
    const c = initCloud();
    if (!c) throw new Error('内置通道未就绪，请检查网络，或在设置里改用自填 API Key');
    const model = await cloudModel(images.length > 0);

    const content = [];
    if (prompt) content.push({ type: 'text', text: prompt });
    images.forEach(src => content.push({ type: 'image_url', image_url: { url: src } }));

    const payload = [{ role: 'system', content: sys }]
      .concat(hist.map(m => ({ role: m.role, content: m.content })))
      .concat([{ role: 'user', content: content.length === 1 && content[0].type === 'text' ? content[0].text : content }]);

    for await (const chunk of c.llm.chat.completions.create({
      model: model.id,
      messages: payload,
      stream: true,
      stream_options: { include_usage: true },
      temperature: 0.4,
      signal: signal
    })) {
      const d = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
      if (d && d.content) push(d.content);
    }
  }

  /* -------------------------------------------------- 对外：流式对话 */
  async function stream(opts) {
    const messages = opts.messages || [];
    const images = opts.images || [];
    const onDelta = opts.onDelta;
    const onDone = opts.onDone;
    const onError = opts.onError;
    const signal = opts.signal;

    const conf = load();
    if (!conf.enabled) {
      onError && onError(new Error('AI 已关闭，请在「设置」中开启'));
      return;
    }
    let prof = activeProfile();
    if (!prof) {
      onError && onError(new Error('尚未配置 AI，请到「设置」添加一套模型配置'));
      return;
    }

    /* 文字模型 + 视觉模型分工：
       有图片而这套配置的主模型不支持读图时，临时切到它配置的「审票视觉模型」，
       这样「问答用强模型、审票用视觉模型」可以共用一把 Key。 */
    let switchedModel = '';
    if (images.length && !prof.vision && prof.visionModel) {
      switchedModel = prof.visionModel;
      prof = Object.assign({}, prof, { model: prof.visionModel, vision: true });
    }
    if (prof.provider !== 'builtin' && prof.apiType !== 'builtin' && !prof.apiKey) {
      onError && onError(new Error('缺少 API Key，请到「设置」中填写'));
      return;
    }
    if (!prof.model && prof.provider !== 'builtin') {
      onError && onError(new Error('尚未选择模型，请到「设置」中填写模型名'));
      return;
    }

    const last = messages[messages.length - 1] || {};
    const text = String(last.content || '').trim();
    const hist = messages.slice(0, -1)
      .filter(m => m && m.content && String(m.content).trim())
      .map(m => ({ role: m.role, content: String(m.content) }));

    const sys = systemPrompt() + (images.length ? REVIEW_INSTRUCTION : '');
    const prompt = text || '请审核这张作业票截图，逐项核对我填写的是否规范。';

    let acc = '';
    const push = d => { acc += d; onDelta && onDelta(d, acc); };

    try {
      if (prof.provider === 'builtin' || prof.apiType === 'builtin') {
        await streamBuiltin(prof, sys, hist, prompt, images, push, signal);
      } else if (prof.apiType === 'anthropic') {
        await streamAnthropic(prof, sys, hist, prompt, images, push, signal);
      } else if (prof.apiType === 'google') {
        await streamGemini(prof, sys, hist, prompt, images, push, signal);
      } else {
        await streamOpenAI(prof, sys, hist, prompt, images, push, signal);
      }
      onDone && onDone(acc);
    } catch (e) {
      if (e && (e.name === 'AbortError' || e.code === 'ABORT_ERR')) {
        onDone && onDone(acc, true);
        return;
      }
      onError && onError(e, acc);
    }
  }

  /* -------------------------------------------------- 对外：连通性测试 */
  async function ping(prof) {
    const p = prof || activeProfile();
    if (!p) throw new Error('没有可测试的配置');
    const sys = '你是连通性测试助手，只回复"连接成功"四个字。';
    const ask = [{ role: 'user', content: '连通性测试，请回复"连接成功"' }];

    if (p.provider === 'builtin' || p.apiType === 'builtin') {
      const list = await (initCloud() ? initCloud().llm.models.list() : Promise.reject(new Error('内置通道未就绪')));
      if (!list || !list.length) throw new Error('内置通道无可用模型');
      return '内置通道可用，共 ' + list.length + ' 个模型';
    }

    if (p.apiType === 'anthropic') {
      const resp = await fetch(xurl(resolveAnthropicURL(baseOf(p))), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': p.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({ model: p.model, max_tokens: 32, system: sys, messages: ask })
      });
      await ensureOk(resp);
      const j = await resp.json();
      const t = j.content && j.content[0] && j.content[0].text;
      return t || '已连接';
    }

    if (p.apiType === 'google') {
      const resp = await fetch(xurl(geminiURL(baseOf(p), p.model, p.apiKey, false)), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sys }] },
          contents: [{ role: 'user', parts: [{ text: ask[0].content }] }],
          generationConfig: { maxOutputTokens: 32, temperature: 0 }
        })
      });
      await ensureOk(resp);
      const j = await resp.json();
      const cand = j.candidates && j.candidates[0];
      const t = cand && cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
      return t || '已连接';
    }

    const resp = await fetch(xurl(resolveOpenAIURL(baseOf(p))), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + p.apiKey },
      body: JSON.stringify({
        model: p.model,
        temperature: 0,
        max_tokens: 32,
        messages: [{ role: 'system', content: sys }].concat(ask)
      })
    });
    await ensureOk(resp);
    const j = await resp.json();
    const t = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    return t || '已连接';
  }

  /* -------------------------------------------------- 错误文案 */
  function friendlyError(e) {
    const msg = (e && e.message) || '';
    const st = e && e.status;
    const code = (e && e.error && e.error.code) || (e && e.code) || '';

    if (String(code).indexOf('auth_') === 0) return 'AI 凭证校验未通过（内置通道需通过正式域名打开应用），请改用自填 API Key。';
    if (String(code).indexOf('quota_') === 0) return 'AI 额度用尽或请求过于频繁，请稍后再试。';
    if (e && e.name === 'TypeError' && /fetch|network/i.test(msg)) {
      if (typeof window !== 'undefined' && window.__RELAY_BASE) {
        return '转发通道没通：请确认手机能正常上网（可先用浏览器打开 https://open.bigmodel.cn 试试）。';
      }
      return '网络请求失败：厂商接口不响应浏览器的跨域预检（OPTIONS），浏览器里直连必然被拦。请用安卓 App 版（已内置转发通道），或在 BASE URL 填写你自己的转发地址。';
    }
    if (st === 401) return 'API Key 无效或已过期，请到「设置」中检查密钥。';
    if (st === 403) return '该 Key 无权访问此模型，或模型未开通。';
    if (st === 404) return '接口地址或模型不存在：请检查 BASE URL 是否需要带 /v1，以及模型名是否正确。';
    if (st === 429) return '请求过于频繁或余额不足，请稍后重试。';
    if (st >= 500) return '模型服务端错误，请稍后重试或换一个模型。';
    if (/vision|image|多模态|unsupported.*image/i.test(msg)) {
      return '当前模型不支持图片识别。请在「设置」中换成带视觉的模型（如 glm-4v-plus、qwen-vl-max、gpt-4o、claude、gemini）。';
    }
    if (/Failed to fetch|Load failed/i.test(msg)) {
      return '网络请求失败：可能是跨域限制。试试把 BASE URL 换成可直连的网关，或使用内置通道。';
    }
    return msg ? msg : '调用失败，请检查网络与配置。';
  }

  /* -------------------------------------------------- 图片压缩 */
  function compressImage(file, maxSide, quality) {
    maxSide = maxSide || 1400;
    quality = quality || 0.82;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          const scale = Math.min(1, maxSide / Math.max(w, h));
          w = Math.round(w * scale);
          h = Math.round(h * scale);
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(cv.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('图片解析失败'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  }

  return {
    PROVIDERS: PROVIDERS,
    DEFAULT_ROLE: DEFAULT_ROLE,
    provider: providerOf,
    guessVision: guessVision,
    newProfile: newProfile,
    getConfig: getConfig,
    activeProfile: activeProfile,
    getProfile: getProfile,
    upsertProfile: upsertProfile,
    removeProfile: removeProfile,
    setActive: setActive,
    patchConfig: patchConfig,
    configured: configured,
    summary: summary,
    defaultPrompt: function () { return DEFAULT_ROLE; },
    rolePrompt: rolePrompt,
    stream: stream,
    ping: ping,
    resolveURL: resolveURL,
    compressImage: compressImage,
    friendlyError: friendlyError,
    init: initCloud,
    get ready() { return configured(); }
  };
})();
