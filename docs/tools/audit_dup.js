const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'assets/js/data.js'), 'utf8');
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(src + '\n;globalThis.__X={APP_VERSION,PERMITS,GLOBAL_ERRORS,CROSS};', ctx);
const { APP_VERSION, PERMITS, GLOBAL_ERRORS } = ctx.__X;

function bigrams(s) {
  const t = String(s || '').replace(/[\s，。、；：""''（）()《》\/·\-—,.%（）]/g, '');
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  if (t.length === 1) set.add(t);
  return set;
}
function jac(a, b) {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}
function contain(a, b) { // 一方几乎被另一方包含
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / Math.min(A.size, B.size);
}

const out = [];
function pairReport(scope, list, getText, thresh) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = getText(list[i]), b = getText(list[j]);
      const s = jac(a, b), c = contain(a, b);
      if (s >= thresh || c >= 0.72) {
        out.push({ scope, i, j, jac: +s.toFixed(2), contain: +c.toFixed(2), a, b,
                   la: list[i].__label || '', lb: list[j].__label || '' });
      }
    }
  }
}

// 1) 票内 fields 两两比对（req + good + bad + tip）
PERMITS.forEach(p => {
  const f = (p.fields || []).map((x, k) => ({ ...x, __label: `${p.short}·要点${k + 1}` }));
  pairReport(`fields/${p.short}`, f, x => [x.name, x.req, x.good, x.bad, x.tip].join(' '), 0.35);
});

// 2) 跨票种 fields（同名同义要点）
const allF = [];
PERMITS.forEach(p => (p.fields || []).forEach((x, k) => allF.push({ ...x, __label: `${p.short}·要点${k + 1}`, __permit: p.short })));
pairReport('fields/跨票种', allF, x => [x.name, x.req].join(' '), 0.55);

// 3) 票内 measures
PERMITS.forEach(p => {
  const m = (p.measures || []).map((x, k) => ({ ...x, __label: `${p.short}·措施${x.no || k + 1}` }));
  pairReport(`measures/${p.short}`, m, x => x.text, 0.6);
});

// 4) 票内 errors + 全局
PERMITS.forEach(p => {
  const e = (p.errors || []).map((x, k) => ({ ...x, __label: `${p.short}·易错${k + 1}` }));
  pairReport(`errors/${p.short}`, e, x => [x.title||x.t, x.detail||x.d||x.text||""].join(" "), 0.38);
});
{
  const g = GLOBAL_ERRORS.map((x, k) => ({ ...x, __label: `全局·红线${k + 1}` }));
  pairReport('errors/全局', g, x => [x.title || x.t, x.detail || x.d || x.text || ''].join(' '), 0.5);
}

console.log(JSON.stringify({ version: APP_VERSION, count: out.length, pairs: out }, null, 1));
