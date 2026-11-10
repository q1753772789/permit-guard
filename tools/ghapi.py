# -*- coding: utf-8 -*-
"""GitHub API 推送客户端（不依赖 git push）。

为什么不用 git push：本机访问 github.com 主站会超时（10 秒无响应），
而 api.github.com / raw.githubusercontent.com / cdn.jsdelivr.net 都正常。
所以建仓库、传文件全部走 REST API（Git Data API），效果与 push 相同：
一个 commit、main 分支、文件内容一致。

Token 权限（fine-grained）：Contents = Read and write；
若要脚本自动建仓库，再加 Administration = Read and write。
Classic token 勾 repo 即可。
"""

import base64
import hashlib
import json
import os
import sys
import time

import requests

API = 'https://api.github.com'
TIMEOUT = 40


class GhError(Exception):
    pass


def find_token(explicit=None):
    """按优先级找 token：命令行 > 环境变量 > 项目根 .github_token 文件。"""
    if explicit and explicit.strip():
        return explicit.strip()
    for k in ('GITHUB_TOKEN', 'GH_TOKEN'):
        v = os.environ.get(k)
        if v and v.strip():
            return v.strip()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    p = os.path.join(root, '.github_token')
    if os.path.isfile(p):
        with open(p, 'r', encoding='utf-8') as f:
            v = f.read().strip()
        if v:
            return v
    return None


def session(token):
    s = requests.Session()
    s.headers.update({
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'permit-guard-publisher',
    })
    return s


def call(s, method, path, **kw):
    r = s.request(method, API + path, timeout=TIMEOUT, **kw)
    body = None
    if r.text.strip():
        try:
            body = r.json()
        except ValueError:
            body = r.text[:300]
    if r.status_code >= 400:
        msg = body.get('message') if isinstance(body, dict) else str(body)
        raise GhError('%s %s -> HTTP %d：%s' % (method, path, r.status_code, msg))
    return body if body is not None else {}


def whoami(s):
    u = call(s, 'GET', '/user')
    return u.get('login', ''), u


def repo_exists(s, owner, name):
    try:
        return call(s, 'GET', '/repos/%s/%s' % (owner, name))
    except GhError as e:
        if 'HTTP 404' in str(e):
            return None
        raise


def ensure_repo(s, owner, name, private=False, desc='', login=''):
    """仓库不存在就建；返回 (repo_json, created)。"""
    got = repo_exists(s, owner, name)
    if got:
        return got, False
    body = {
        'name': name,
        'description': desc,
        'private': private,
        'has_issues': False,
        'has_wiki': False,
        'has_projects': False,
        'auto_init': False,
    }
    if login and owner.lower() != login.lower():
        call(s, 'POST', '/orgs/%s/repos' % owner, json=body)
    else:
        call(s, 'POST', '/user/repos', json=body)
    # 建仓库偶尔有延迟，重试几次
    for _ in range(6):
        got = repo_exists(s, owner, name)
        if got:
            return got, True
        time.sleep(1)
    raise GhError('仓库已提交创建请求，但读取不到，稍后重试即可')


def git_blob_sha(data):
    """Git 对象 id（与 git hash-object 一致），用于判断文件是否真的变了。"""
    h = hashlib.sha1()
    h.update(b'blob %d\0' % len(data))
    h.update(data)
    return h.hexdigest()


def local_files(root, only=None):
    """按 .gitignore 之外已提交的文件清单取工作区文件（用 git ls-files 最准）。"""
    import subprocess
    args = ['git', 'ls-files', '-z']
    if only:
        args += ['--', ] + list(only)
    r = subprocess.run(args, cwd=root, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    names = [n for n in r.stdout.decode('utf-8', 'ignore').split('\0') if n.strip()]
    out = []
    for n in names:
        p = os.path.join(root, n.replace('/', os.sep))
        if os.path.isfile(p):
            with open(p, 'rb') as f:
                out.append((n, f.read()))
    return out


def remote_tree(s, owner, name, branch='main'):
    """返回 (commit_sha, base_tree_sha, {path: blob_sha})；仓库为空返回 (None, None, {})。"""
    repo = '%s/%s' % (owner, name)
    try:
        ref = call(s, 'GET', '/repos/%s/git/ref/heads/%s' % (repo, branch))
    except GhError as e:
        # 空仓库：GitHub 返回 409 "Git Repository is empty"（不是 404），此时从零开始
        if 'HTTP 404' in str(e) or 'HTTP 409' in str(e):
            return None, None, {}
        raise
    csha = ref['object']['sha']
    commit = call(s, 'GET', '/repos/%s/git/commits/%s' % (repo, csha))
    tsha = commit['tree']['sha']
    tree = call(s, 'GET', '/repos/%s/git/trees/%s?recursive=1' % (repo, tsha))
    flat = {}
    for item in tree.get('tree', []):
        if item.get('type') == 'blob':
            flat[item['path']] = item['sha']
    return csha, tsha, flat


def repo_default_branch(s, owner, name):
    r = call(s, 'GET', '/repos/%s/%s' % (owner, name))
    return r.get('default_branch') or 'main'


def init_empty(s, owner, name, log=print):
    """空仓库不能直接建 blob（409 Git Repository is empty）。

    先用 Contents API 写一个文件把仓库「点亮」，它会自动建出默认分支和首个提交。
    写 .gitignore 是为了随后被本地版本覆盖，不留下多余文件。
    注意：这里不能指定 branch，空仓库还没有任何分支。
    """
    repo = '%s/%s' % (owner, name)
    body = {
        'message': 'init',
        'content': base64.b64encode(b'# placeholder\n').decode('ascii'),
    }
    try:
        call(s, 'PUT', '/repos/%s/contents/.gitignore' % repo, json=body)
    except GhError as e:
        if 'HTTP 409' not in str(e) and 'HTTP 422' not in str(e):
            raise
        log('  初始化返回：%s（继续尝试）' % e)


def push(s, owner, name, root, message, branch='main', log=print):
    """把工作区文件同步成一个 commit。返回 (commit_sha, 上传数, 跳过数, 删除数, 分支名)。"""
    repo = '%s/%s' % (owner, name)
    parent, base_tree, existing = remote_tree(s, owner, name, branch)

    if parent is None:
        log('  仓库还是空的，先写入首个文件…')
        init_empty(s, owner, name, log=log)
        branch = repo_default_branch(s, owner, name)
        parent, base_tree, existing = remote_tree(s, owner, name, branch)
        if parent is None:
            raise GhError('仓库初始化后仍读不到分支，稍等几秒重试')
        log('  已初始化分支 %s' % branch)

    files = local_files(root)
    log('  本地文件 %d 个，远端已有 %d 个' % (len(files), len(existing)))

    entries = []
    uploaded = skipped = 0
    for i, (path, data) in enumerate(files):
        sha = git_blob_sha(data)
        if existing.get(path) == sha:
            skipped += 1
            continue
        blob = call(s, 'POST', '/repos/%s/git/blobs' % repo, json={
            'content': base64.b64encode(data).decode('ascii'),
            'encoding': 'base64',
        })
        entries.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
        uploaded += 1

    # 本地删掉的文件，远端也要删（否则旧版本页面还活着）
    deleted = 0
    for path in existing:
        if path not in dict(files):
            entries.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': None})
            deleted += 1

    if not entries:
        log('  远端已是最新，无需提交')
        return parent, 0, skipped, 0, branch

    payload = {'tree': entries}
    if base_tree:
        payload['base_tree'] = base_tree
    tree = call(s, 'POST', '/repos/%s/git/trees' % repo, json=payload)

    cbody = {'message': message, 'tree': tree['sha']}
    if parent:
        cbody['parents'] = [parent]
    commit = call(s, 'POST', '/repos/%s/git/commits' % repo, json=cbody)

    if parent:
        call(s, 'PATCH', '/repos/%s/git/refs/heads/%s' % (repo, branch),
             json={'sha': commit['sha'], 'force': False})
    else:
        call(s, 'POST', '/repos/%s/git/refs' % repo,
             json={'ref': 'refs/heads/%s' % branch, 'sha': commit['sha']})
        # 空仓库首个分支即默认分支，这里再显式设一次，避免个别账号默认 master
        try:
            call(s, 'PATCH', '/repos/%s' % repo, json={'default_branch': branch})
        except GhError:
            pass

    return commit['sha'], uploaded, skipped, deleted, branch


def check_raw(owner, name, path, branch='main', tries=8):
    """确认 raw 上真的能读到（App 拉更新就是打这个地址）。"""
    url = 'https://raw.githubusercontent.com/%s/%s/%s/%s' % (owner, name, branch, path)
    for i in range(tries):
        try:
            r = requests.get(url, timeout=15, headers={'Cache-Control': 'no-cache'})
            if r.status_code == 200:
                return True, url, r.text[:400]
        except Exception:
            pass
        time.sleep(1.5)
    return False, url, ''
