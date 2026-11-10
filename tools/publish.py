#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
作业票助手 · 在线更新发布脚本

做四件事：
  1. 把网页产物（index.html / manifest.json / sw.js / assets）打成
     update/web/www-<规则版本>.zip
  2. 必要时把 android/build/permit-guard-<安装包版本>.apk 复制到 update/apk/
  3. 生成 update/latest.json（含 size / sha256 / 说明），App 靠它判断要不要更新
  4. 把 update/ 提交推送到 GitHub（默认推）

两套版本号（见 assets/js/data.js 顶部）：
  RULE_VERSION —— 规则版本，只改规则/文案/界面时升。**日常发布用它**，
                  用户热更新网页就生效，不用重装 App。
  APP_VERSION  —— 安装包版本，只有改了原生（Java / 清单 / 权限）才升，
                  升了就必须重新构建 APK，用户要装一次包。

用法：
  # 日常：只改规则或界面
  python tools/publish.py --notes "改了什么"            # 自动只发网页
  python tools/publish.py --web-only --notes "..."      # 同上，显式写法

  # 改了原生代码：先构建，再发布
  python tools/publish.py --notes "..."                 # 检测到新 APK 会一起发

  # 只发安装包
  python tools/publish.py --apk-only --notes "..."

注意：
  * 仓库必须是**公开**的，App 才能直接拉到更新（私有仓库需要令牌，不能内置到 APK）。
  * `minApk` 默认自动算：发了新包就是新包的 versionCode；
    只发网页则**沿用上一版网页的 minApk**（网页对原生的真实要求，不跟着安装包涨），
    否则老包手机会被迫装包，违背"非必要不重装"。
  * 只发网页时如果 android/build 里没有对应版本的 APK，会沿用清单里的安装包，不会报错。
"""

import argparse
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.dirname(HERE)
OUT = os.path.join(PROJ, 'update')

WEB_FILES = ['index.html', 'manifest.json', 'sw.js']
WEB_DIRS = ['assets']

SKIP_DIRS = {'.git', 'update', 'android', 'docs', 'node_modules', '.workbuddy', '__pycache__'}


def read_text(p):
    with io.open(p, encoding='utf-8') as f:
        return f.read()


def write_text(p, s):
    d = os.path.dirname(p)
    if d and not os.path.isdir(d):
        os.makedirs(d)
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(s)


def app_version():
    s = read_text(os.path.join(PROJ, 'assets', 'js', 'data.js'))
    m = re.search(r"APP_VERSION\s*=\s*'([^']+)'", s)
    if not m:
        sys.exit('读不到 APP_VERSION（assets/js/data.js）')
    return m.group(1)


def rule_version(app_v):
    """规则版本：只改规则/界面时升它，用户热更新即可，不用重装 App。
    没有这个变量时退回 APP_VERSION（兼容老版本）。"""
    s = read_text(os.path.join(PROJ, 'assets', 'js', 'data.js'))
    m = re.search(r"RULE_VERSION\s*=\s*'([^']+)'", s)
    return m.group(1) if m else app_v


def load_old_manifest():
    p = os.path.join(OUT, 'latest.json')
    if not os.path.isfile(p):
        return {}
    try:
        return json.loads(read_text(p))
    except Exception:
        return {}


def build_version_code():
    s = read_text(os.path.join(PROJ, 'android', 'build_apk.py'))
    m = re.search(r"VERSION_CODE\s*=\s*'(\d+)'", s)
    return int(m.group(1)) if m else 0


def code_of(ver):
    """把 3.1 变成 301，与前端 codeOf() 保持一致"""
    parts = re.split(r'[^0-9]', ver)
    nums = [p for p in parts if p]
    a = int(nums[0]) if len(nums) > 0 else 0
    b = int(nums[1]) if len(nums) > 1 else 0
    return a * 100 + b


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        while True:
            b = f.read(1 << 16)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def zip_web(ver):
    """把网页产物打成一个 zip，index.html 位于压缩包根目录"""
    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    web_dir = os.path.join(OUT, 'web')
    if not os.path.isdir(web_dir):
        os.makedirs(web_dir)

    dst = os.path.join(web_dir, 'www-%s.zip' % ver)
    if os.path.exists(dst):
        os.remove(dst)

    count = 0
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name in WEB_FILES:
            p = os.path.join(PROJ, name)
            if os.path.isfile(p):
                z.write(p, name)
                count += 1
        for d in WEB_DIRS:
            root = os.path.join(PROJ, d)
            for cur, dirs, files in os.walk(root):
                dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
                for f in files:
                    p = os.path.join(cur, f)
                    rel = os.path.relpath(p, PROJ).replace('\\', '/')
                    z.write(p, rel)
                    count += 1
    return dst, count


def prune(web_ver, apk_ver, keep=2):
    """删掉过旧的网页包与安装包，只留最近 keep 个版本。

    web 包按**规则版本**命名，apk 按**安装包版本**命名，两者各清各的——
    规则版本升得比安装包快得多，混在一起清会把还在用的安装包删掉。
    """
    for sub, pat, ver in (('web', r'www-(\d+(?:\.\d+)?)\.zip', web_ver),
                          ('apk', r'permit-guard-(\d+(?:\.\d+)?)\.apk', apk_ver)):
        d = os.path.join(OUT, sub)
        if not os.path.isdir(d):
            continue
        items = []
        for name in os.listdir(d):
            m = re.match(pat, name)
            if m:
                items.append((m.group(1), os.path.join(d, name)))
        items.sort(key=lambda x: [int(n) for n in x[0].split('.')])

        def code(v):
            parts = [int(n) for n in v.split('.')]
            return parts[0] * 100 + (parts[1] if len(parts) > 1 else 0)

        alive = [x for x in items if code(x[0]) >= code(ver) - 1]   # 当前版 + 上一版
        for v, path in items:
            if (v, path) not in alive:
                try:
                    os.remove(path)
                    print('  清理旧产物：%s/%s' % (sub, os.path.basename(path)))
                except Exception as e:
                    print('  清理失败 %s：%s' % (path, e))


def copy_apk(ver):
    src = os.path.join(PROJ, 'android', 'build', 'permit-guard-%s.apk' % ver)
    if not os.path.isfile(src):
        return None
    apk_dir = os.path.join(OUT, 'apk')
    if not os.path.isdir(apk_dir):
        os.makedirs(apk_dir)
    dst = os.path.join(apk_dir, 'permit-guard-%s.apk' % ver)
    shutil.copy2(src, dst)
    return dst


def write_repo(repo):
    """把仓库地址写进 assets/js/update.js（App 里靠它拼清单地址）"""
    p = os.path.join(PROJ, 'assets', 'js', 'update.js')
    s = read_text(p)
    s2 = re.sub(r"var REPO = '[^']*';", "var REPO = '%s';" % repo, s, count=1)
    if s2 != s:
        write_text(p, s2)
        print('  已写入更新源仓库：%s' % repo)
    return s2 != s


def current_repo():
    """读 update.js 里已配置的仓库地址；占位符视为未配置。"""
    p = os.path.join(PROJ, 'assets', 'js', 'update.js')
    if not os.path.isfile(p):
        return ''
    m = re.search(r"var REPO = '([^']*)'", read_text(p))
    if not m:
        return ''
    v = m.group(1)
    if '@@' in v or '/' not in v:
        return ''
    return v


def git(args, cwd=None, check=True):
    return subprocess.run(['git'] + args, cwd=cwd or PROJ, check=check,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


def push(repo, remote, notes, ver):
    """先提交到本地 git，再上传到 GitHub。

    上传默认走 REST API（api.github.com）：本机访问 github.com 主站会超时，
    git push 一定失败；API 通，效果相同（一个 commit、main 分支）。
    没有 token 时才退回 git push。
    """
    if not os.path.isdir(os.path.join(PROJ, '.git')):
        print('  初始化 git 仓库…')
        git(['init', '-q'])
        git(['branch', '-M', 'main'], check=False)
    remotes = git(['remote'], check=False).stdout.decode('utf-8', 'ignore')
    if 'origin' not in remotes.split():
        url = remote or ('https://github.com/%s.git' % repo)
        git(['remote', 'add', 'origin', url], check=False)

    git(['add', '-A'])
    msg = 'release v%s' % ver
    if notes:
        msg += '：' + notes.split('\n')[0][:80]
    git(['commit', '-m', msg], check=False)

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import ghapi

    token = ghapi.find_token()
    if token:
        owner, _, name = repo.partition('/')
        print('  上传到 %s（API 通道）…' % repo)
        try:
            s = ghapi.session(token)
            sha, up, skip, dele, br = ghapi.push(s, owner, name, PROJ, msg)
            print('  提交 %s：上传 %d，未变 %d，删除 %d' % (sha[:8], up, skip, dele))
            ok, url, _ = ghapi.check_raw(owner, name, 'update/latest.json', branch=br)
            print('  清单验证：%s %s' % ('可访问' if ok else '暂时打不开（CDN 有延迟，稍等再试）', url))
            return True
        except ghapi.GhError as e:
            print('  API 上传失败：%s' % e)
            print('  检查 token 是否有 Contents 写权限、仓库是否存在。')
            return False

    print('  没有找到 token，退回 git push…')
    r = git(['push', '-u', 'origin', 'main'], check=False)
    txt = r.stdout.decode('utf-8', 'ignore')
    if r.returncode != 0:
        print('  推送失败（本机访问 github.com 常常超时）：')
        print('  ' + txt.strip().replace('\n', '\n  ')[:600])
        print('  改用：python tools/gh_setup.py --token <你的token> 先跑一次，之后发布就不再需要 git push')
        return False
    return True


def main():
    ap = argparse.ArgumentParser(description='生成并发布在线更新包')
    ap.add_argument('--repo', help='GitHub 仓库，如 zhangsan/permit-guard（公开仓库）')
    ap.add_argument('--notes', default='', help='更新说明，会显示在 App 更新页')
    ap.add_argument('--min-apk', type=int, default=0,
                    help='网页包要求的最低安装包 versionCode。默认自动：本次发了安装包就取它的 code，'
                         '否则沿用清单里已发布的安装包 code（= 装了当前包的手机能直接热更新）。'
                         '只有"网页用了老包没有的原生接口"时才需要手动指定')
    ap.add_argument('--web-only', action='store_true', help='只发网页热更新（规则/界面改动用它）')
    ap.add_argument('--apk-only', action='store_true', help='只发安装包')
    ap.add_argument('--force-apk', action='store_true',
                    help='安装包内容没变也重新发布（一般不需要）')
    ap.add_argument('--no-push', dest='push', action='store_false',
                    help='只生成产物，不提交推送（默认会推送）')
    ap.add_argument('--push', dest='push', action='store_true', help='（默认行为，留作兼容）')
    ap.add_argument('--remote', help='git 远程地址（默认按 --repo 拼 GitHub 地址）')
    ap.set_defaults(push=True)
    args = ap.parse_args()

    app_v = app_version()                 # 安装包版本：只在必须重装时才升
    rule_v = rule_version(app_v)          # 规则版本：每次发网页都升
    rule_code = code_of(rule_v)
    vcode = build_version_code()
    old = load_old_manifest()
    old_apk = old.get('apk') or {}
    old_web = old.get('web') or {}

    print('\n=== 发布 规则 v%s（code %d）/ 安装包 v%s（code %d）===\n'
          % (rule_v, rule_code, app_v, vcode))

    changed = False
    if args.repo:
        changed = write_repo(args.repo)

    # 仓库地址改了，安装包里那份 update.js 还是旧的，必须重新打包（否则用户装上仍连旧地址/占位符）
    if changed and not args.web_only:
        print('  仓库地址变化，重新构建 APK…')
        r = subprocess.run([sys.executable, os.path.join(PROJ, 'android', 'build_apk.py')],
                           cwd=PROJ, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        out = r.stdout.decode('utf-8', 'ignore')
        tail = [x for x in out.strip().split('\n') if x.strip()][-3:]
        for line in tail:
            print('    ' + line.strip())
        if r.returncode != 0:
            sys.exit('构建 APK 失败，先解决再发布')

    # ---------- 安装包：只有内容真的变了才发，否则让用户白装一遍 ----------
    apk_file = None
    if args.apk_only:
        apk_file = copy_apk(app_v)
        if not apk_file:
            sys.exit('--apk-only 找不到 android/build/permit-guard-%s.apk，先构建' % app_v)
    elif not args.web_only:
        src = os.path.join(PROJ, 'android', 'build', 'permit-guard-%s.apk' % app_v)
        if os.path.isfile(src):
            sha_now = sha256_file(src)
            newer = vcode > int(old_apk.get('versionCode') or 0)
            if args.force_apk or not old_apk or newer or sha_now != old_apk.get('sha256'):
                apk_file = copy_apk(app_v)
            else:
                print('  安装包没变化，跳过（清单沿用上一版，用户不用重装）')
        elif old_apk:
            print('  android/build 里没有 permit-guard-%s.apk，安装包沿用清单里的 v%s'
                  % (app_v, old_apk.get('versionName', '')))
        else:
            print('  没有找到 android/build/permit-guard-%s.apk，本次只发网页' % app_v)

    # ---------- 网页包要求的最低安装包 ----------
    # 发新包 → 要求新包（新网页可能用了新原生接口）；
    # 只发网页 → 沿用上一版网页的 minApk：网页对原生的真实要求没变就不该涨，
    #            否则老包手机明明能热更新，却被要求先装包。
    if args.min_apk:
        min_apk = args.min_apk
    elif apk_file:
        min_apk = vcode
    elif old_web.get('minApk'):
        min_apk = int(old_web['minApk'])
    elif old_apk.get('versionCode'):
        min_apk = int(old_apk['versionCode'])
    else:
        min_apk = vcode

    manifest = {
        'schema': 1,
        'generated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'notes': args.notes
    }

    if not args.apk_only:
        zip_path, n = zip_web(rule_v)
        size = os.path.getsize(zip_path)
        sha = sha256_file(zip_path)
        print('  网页包：%s（%d 个文件，%.0f KB）' % (os.path.basename(zip_path), n, size / 1024.0))
        manifest['web'] = {
            'version': rule_v,
            'code': rule_code,
            'minApk': min_apk,
            'size': size,
            'sha256': sha,
            'path': 'update/web/www-%s.zip' % rule_v,
            'notes': args.notes
        }
    elif old_web:
        manifest['web'] = old_web

    if apk_file:
        size = os.path.getsize(apk_file)
        manifest['apk'] = {
            'versionName': app_v,
            'versionCode': vcode,
            'size': size,
            'sha256': sha256_file(apk_file),
            'path': 'update/apk/permit-guard-%s.apk' % app_v,
            'notes': args.notes
        }
        print('  安装包：%s（%.0f KB）' % (os.path.basename(apk_file), size / 1024.0))
    elif old_apk:
        manifest['apk'] = old_apk          # 沿用上次发布的安装包

    if 'web' not in manifest and 'apk' not in manifest:
        sys.exit('没有任何可发布的内容')

    latest = os.path.join(OUT, 'latest.json')
    write_text(latest, json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    prune(rule_v, app_v)
    print('  清单：update/latest.json（web %s / minApk %d / apk %s code %s）'
          % (manifest.get('web', {}).get('version', '—'), min_apk,
             manifest.get('apk', {}).get('versionName', '—'),
             manifest.get('apk', {}).get('versionCode', '—')))
    if apk_file:
        print('  ⚠ 本次发布了安装包：装了更老安装包的手机需要先装包（minApk=%d）' % min_apk)
    else:
        print('  ✓ 本次只发网页：装了 v%s 及以上安装包的手机点一下就热更新，不用重装' % app_v)

    if args.push:
        target = args.repo or current_repo()
        if not target:
            sys.exit('还没配置仓库：先跑一次 python tools/publish.py --repo 用户名/仓库名')
        args.repo = target
        print('\n  提交并推送…')
        ok = push(args.repo, args.remote, args.notes, rule_v)
        if ok:
            print('\n=== 发布完成 ===')
            print('  清单地址（App 会依次尝试这几处）：')
            print('    https://raw.githubusercontent.com/%s/main/update/latest.json' % args.repo)
            print('    https://cdn.jsdelivr.net/gh/%s@main/update/latest.json' % args.repo)
        sys.exit(0 if ok else 1)

    print('\n=== 生成完成（还没推送）===')
    print('  update/ 下三个东西要一起提交：latest.json、web/、apk/')
    print('  推送：python tools/publish.py --repo %s --push' % (args.repo or '用户名/仓库名'))
    print('  （推送走 GitHub API，token 放项目根 .github_token 或环境变量 GITHUB_TOKEN）')
    print('  或者手动：git add -A && git commit -m "release v%s" && git push' % rule_v)


if __name__ == '__main__':
    main()
