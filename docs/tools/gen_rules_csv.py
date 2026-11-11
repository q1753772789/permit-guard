# -*- coding: utf-8 -*-
"""从 assets/js/data.js 生成规则库快照 CSV（docs/规则库-安全措施-vX.Y.csv、docs/规则库-易错点-vX.Y.csv）。

用法（在项目根目录执行）：
    python docs/tools/gen_rules_csv.py

改完 data.js 后跑一次，CSV 会自动带上新的 APP_VERSION；把 CSV 重新导入资料库即可保持同步。
"""
import io, json, os, subprocess, sys, csv
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(ROOT, 'assets', 'js', 'data.js')
DOCS = os.path.join(ROOT, 'docs')

NODE_DUMP = r"""
const fs=require('fs'),vm=require('vm');
const code=fs.readFileSync(process.argv[1],'utf8')+';({PERMITS,PERMIT_MAP,GLOBAL_ERRORS,APP_VERSION})';
const d=vm.runInNewContext(code,{console});
fs.writeFileSync(process.argv[2], JSON.stringify({v:d.APP_VERSION,permits:d.PERMITS,globals:d.GLOBAL_ERRORS}));
"""


def dump():
    out = os.path.join(DOCS, '.dump.json')
    subprocess.run(['node', '-e', NODE_DUMP, DATA, out], check=True)
    d = json.load(io.open(out, encoding='utf-8'))
    os.remove(out)
    return d


def cat(m):
    if m.get('must'):
        return '必须勾选'
    if m.get('cross'):
        return '关联票条件'
    return '核查确认'


def cross_txt(m, permits):
    ids = m.get('cross') or []
    if not ids:
        return ''
    names = []
    for x in ids:
        if x == '*':
            names.append('任一其他作业票')
        else:
            p = next((q for q in permits if q['id'] == x), None)
            names.append((p['short'] if p else x) + '票')
    return '、'.join(names)


def main():
    d = dump()
    permits, ver = d['permits'], d['v']

    rows = []
    for p in permits:
        for m in p['measures']:
            rows.append({
                '版本': 'v' + ver,
                '票种': p['short'],
                '票种ID': p['id'],
                '措施序号': m['no'],
                '措施原文': m['text'],
                '分类': cat(m),
                '核实型': '是' if (m.get('must') and m.get('kind') == 'verify') else '',
                '勾选原因': m.get('why', ''),
                '条件提示': m.get('cond', ''),
                '关联票联动': cross_txt(m, permits),
                '确认人': m.get('by', ''),
                '补充说明': m.get('note', ''),
            })
    cols = ['版本', '票种', '票种ID', '措施序号', '措施原文', '分类', '核实型',
            '勾选原因', '条件提示', '关联票联动', '确认人', '补充说明']
    f1 = os.path.join(DOCS, '规则库-安全措施-v%s.csv' % ver)
    with io.open(f1, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)

    erows = []
    for p in permits:
        for i, e in enumerate(p['errors'], 1):
            erows.append({
                '版本': 'v' + ver, '范围': p['short'], '范围ID': p['id'], '序号': i,
                '等级': '否决项' if e['level'] == 'critical' else '常见扣分',
                '类型': '现场落实' if e.get('kind') == 'onsite' else '票面办理',
                '标题': e['title'], '说明': e['detail'], '来源': e.get('src', ''),
            })
    for i, e in enumerate(d['globals'], 1):
        erows.append({
            '版本': 'v' + ver, '范围': '跨票证通用', '范围ID': 'global', '序号': i,
            '等级': '否决项' if e['level'] == 'critical' else '常见扣分',
            '类型': '现场落实' if e.get('kind') == 'onsite' else '票面办理',
            '标题': e['title'], '说明': e['detail'], '来源': e.get('src', ''),
        })
    ecols = ['版本', '范围', '范围ID', '序号', '等级', '类型', '标题', '说明', '来源']
    f2 = os.path.join(DOCS, '规则库-易错点-v%s.csv' % ver)
    with io.open(f2, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=ecols)
        w.writeheader()
        w.writerows(erows)

    print('v%s | 措施 %d 条 %s | 易错点 %d 条 %s' % (ver, len(rows), dict(Counter(r['分类'] for r in rows)), len(erows), dict(Counter(r['类型'] for r in erows))))
    print('->', f1)
    print('->', f2)


if __name__ == '__main__':
    sys.exit(main())
