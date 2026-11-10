# -*- coding: utf-8 -*-
"""一次性把仓库建好并把代码推上去（走 GitHub API，不需要 git push）。

用法：
  python tools/gh_setup.py --token ghp_xxx --repo permit-guard
  python tools/gh_setup.py --token ghp_xxx --user yourname --repo permit-guard

token 也可以先写进项目根的 .github_token（已在 .gitignore 里），
之后就不必每次带 --token。
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import ghapi

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser(description='创建 GitHub 仓库并推送（API 方式）')
    ap.add_argument('--token', help='GitHub token（也可放到 .github_token 或环境变量 GITHUB_TOKEN）')
    ap.add_argument('--user', help='仓库所有者，默认用 token 对应的账号')
    ap.add_argument('--repo', default='permit-guard', help='仓库名，默认 permit-guard')
    ap.add_argument('--desc', default='作业票助手 · 在线更新仓库（公开）', help='仓库简介')
    ap.add_argument('--private', action='store_true', help='建私有仓库（注意：App 将无法拉取更新）')
    ap.add_argument('--no-create', action='store_true', help='不建仓库，只往已有仓库推')
    args = ap.parse_args()

    token = ghapi.find_token(args.token)
    if not token:
        sys.exit('缺少 token：加 --token，或把它写进项目根 .github_token')

    s = ghapi.session(token)
    try:
        login, info = ghapi.whoami(s)
    except ghapi.GhError as e:
        sys.exit('token 校验失败（%s）。检查是否复制完整、是否已过期。' % e)

    owner = args.user or login
    name = args.repo
    print('\n=== GitHub 配置 ===')
    print('  账号：%s（%s）' % (login, info.get('name') or '未填昵称'))
    print('  目标：%s/%s' % (owner, name))

    if args.private:
        print('  ⚠ 私有仓库：App 无法免令牌拉取，在线更新不会生效。')

    created = False
    if not args.no_create:
        try:
            repo, created = ghapi.ensure_repo(s, owner, name, private=args.private,
                                              desc=args.desc, login=login)
        except ghapi.GhError as e:
            sys.exit('建仓库失败：%s\n若 token 没有 Administration 权限，'
                     '请先在网页手动建一个空仓库，然后加 --no-create 再跑一次。' % e)
        print('  仓库：%s' % ('刚创建' if created else '已存在，直接复用'))
        print('  地址：%s' % repo.get('html_url', ''))
    else:
        print('  跳过建仓库，直接推送')

    print('\n=== 上传文件（API）===')
    msg = 'release: 作业票助手 v%s' % _app_version()
    try:
        sha, up, skip, dele, br = ghapi.push(s, owner, name, PROJ, msg, log=lambda x: print(x))
    except ghapi.GhError as e:
        sys.exit('推送失败：%s' % e)
    print('  提交 %s：新上传 %d，未变 %d，删除 %d' % (sha[:8], up, skip, dele))

    print('\n=== 验证 App 实际会访问的地址 ===')
    ok, url, sample = ghapi.check_raw(owner, name, 'update/latest.json', branch=br)
    print('  %s  %s' % ('✓ 可访问' if ok else '✗ 打不开', url))
    if ok:
        print('  内容前 200 字：%s' % sample.replace('\n', ' ')[:200])

    print('\n=== 下一步 ===')
    print('  1) 把仓库地址写进 App 并重新发布：')
    print('     python tools/publish.py --repo %s/%s --notes "首次接入在线更新"' % (owner, name))
    print('  2) 按提示重新装一次 APK，之后就一直能在线更新了。')
    if not ok:
        print('\n  raw 打不开时不要急着发版：App 会拉不到清单。先确认仓库是 public 且 main 分支有文件。')


def _app_version():
    import io
    import re
    p = os.path.join(PROJ, 'assets', 'js', 'data.js')
    if os.path.isfile(p):
        m = re.search(r"APP_VERSION\s*=\s*'([^']+)'", io.open(p, encoding='utf-8').read())
        if m:
            return m.group(1)
    return '?'


if __name__ == '__main__':
    main()
