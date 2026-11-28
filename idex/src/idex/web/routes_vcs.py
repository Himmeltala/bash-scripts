# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\routes_vcs.py
# @Description: 变更、日志与同步的网页接口。

from web import ApiError
from netutil import is_loopback_address as is_loopback
from browse_fs import read_unversioned
from server_common import inside, safe_rel, workspace_lock
from vcs_cli import git, svn

from vcs_query import (
    LOG_DEFAULT,
    LOG_MAX,
    LOG_SKIP_MAX,
    clean_paths,
    clip,
    git_change_diff,
    git_remote_sync,
    svn_status_state,
    change_diff,
    git_commit_detail,
    git_log,
    git_original,
    git_revision_diff,
    git_stage_args,
    git_sync_info,
    git_unstage_args,
    revision_diff,
    svn_add_args,
    svn_add_paths,
    svn_commit_detail,
    svn_log_meta,
    svn_original,
    svn_sync_info,
    svn_unadd_args,
    svn_unadd_paths,
)
from vcs_summary import (
    workspace_paths,
    changes_payload,
)
from vcs_hunks import find_hunk, reverse_patch


class VcsRoutes:
    """路由表里变更、日志、同步与暂存那几条的实现，靠 MRO 混进 Handler。"""

    def _diff(self, query):
        ws = self._ws(query)
        rel = safe_rel((query.get("path") or [""])[0])
        rev = (query.get("rev") or [""])[0] or None
        item = (query.get("item") or [""])[0]
        scope = (query.get("scope") or [""])[0]
        full = (query.get("full") or ["0"])[0] == "1"
        # 未纳入版本控制的文件没有差异，读整份内容按新增显示；暂存区那段没有它。
        if not rev and item == "unversioned" and scope != "staged":
            text, truncated = clip(read_unversioned(workspace_paths(ws), rel))
            return {"kind": "file", "path": rel, "text": text, "truncated": truncated}
        if ws.get("vcs") == "git":
            # 冲突文件只有对 HEAD 的差异能看，合并在工作区里的 --cc 格式不好读。
            if item == "conflicted":
                scope = "head"
            result = git_change_diff(ws["root"], rel, full, scope)
        else:
            result = change_diff(ws["root"], rel, rev, full)
        result.update({"kind": "diff", "path": rel})
        return result

    def _original(self, query):
        ws = self._ws(query)
        rel = safe_rel((query.get("path") or [""])[0])
        scope = (query.get("scope") or ["worktree"])[0]
        rev = (query.get("rev") or [""])[0] or None
        # SVN 日志里的远端版本要用仓库根相对路径；只读，且不允许 .. 跳出仓库。
        repo_path = (query.get("repo") or [""])[0]
        if ws.get("vcs") == "svn" and repo_path:
            parts = repo_path.split("/")
            if not repo_path.startswith("/") or ".." in parts:
                raise ApiError(400, "仓库路径不对：%s" % repo_path)
            result = svn_original(ws["root"], repo_path, rev)
        elif ws.get("vcs") == "git":
            result = git_original(ws["root"], rel, scope, rev)
        elif ws.get("vcs") == "svn":
            result = svn_original(ws["root"], rel, rev)
        else:
            result = {"text": "", "truncated": False}
        return {"path": rel, **result}

    def _commit_detail(self, query):
        ws = self._ws(query)
        rev = (query.get("rev") or [""])[0]
        if ws.get("vcs") == "git":
            data = git_commit_detail(ws["root"], rev)
        else:
            data = svn_commit_detail(ws["root"], rev)
        return {"workspace": ws, **data}

    def _log(self, query):
        ws = self._ws(query)
        try:
            limit = int((query.get("limit") or [str(LOG_DEFAULT)])[0])
        except ValueError:
            limit = LOG_DEFAULT
        limit = max(1, min(LOG_MAX, limit))
        try:
            skip = int((query.get("skip") or ["0"])[0] or 0)
        except ValueError:
            skip = 0
        skip = max(0, min(LOG_SKIP_MAX, skip))
        # 翻下一页时不必再连远端同步一次。
        sync = (query.get("sync") or ["1"])[0] != "0"
        # 时间线默认连本地分支、远端跟踪分支与标签一起列；只要当前分支时传 all=0。
        all_refs = (query.get("all") or ["1"])[0] != "0"
        if ws.get("vcs") == "git":
            remote = git_remote_sync(ws["root"], fetch=sync and skip == 0)
            entries = git_log(ws["root"], limit, remote["upstream"], skip, all_refs)
            return {"workspace": ws, "entries": entries, "remote": remote}
        entries, remote = svn_log_meta(ws["root"], limit, skip)
        return {"workspace": ws, "entries": entries, "remote": remote}

    def _svn_unadd(self, body):
        ws = self._index_ws(body)
        if ws.get("vcs") != "svn":
            raise ApiError(400, "这个工作区不是 SVN 工作副本")
        root = ws["root"]
        paths = body.get("paths") or []
        lock = self._index_lock(ws)
        try:
            clean = clean_paths(root, paths)
            state = svn_status_state(root)
            rc, _, err = svn(svn_unadd_args(root, svn_unadd_paths(state, clean)), cwd=root)
            if rc != 0:
                raise ApiError(400, err or "svn revert 失败")
            return {"workspace": ws, **changes_payload(ws)}
        finally:
            lock.release()

    def _unstage(self, body):
        ws = self._index_ws(body)
        if ws.get("vcs") != "git":
            raise ApiError(400, "这个工作区不是 Git 仓库")
        root = ws["root"]
        paths = body.get("paths") or []
        lock = self._index_lock(ws)
        try:
            # 先读 status 把重命名的原路径展开，再连原路径一起取消暂存。
            rc, _, err = git(git_unstage_args(root, paths), cwd=root)
            if rc != 0:
                raise ApiError(400, err or "git restore 失败")
            return {"workspace": ws, **changes_payload(ws)}
        finally:
            lock.release()

    def _svn_add(self, body):
        ws = self._index_ws(body)
        if ws.get("vcs") != "svn":
            raise ApiError(400, "这个工作区不是 SVN 工作副本")
        root = ws["root"]
        paths = body.get("paths") or []
        lock = self._index_lock(ws)
        try:
            clean = clean_paths(root, paths)
            state = svn_status_state(root)
            rc, _, err = svn(svn_add_args(root, svn_add_paths(state, clean)), cwd=root)
            if rc != 0:
                raise ApiError(400, err or "svn add 失败")
            return {"workspace": ws, **changes_payload(ws)}
        finally:
            lock.release()

    def _sync_info(self, query):
        ws = self._ws(query)
        if ws.get("vcs") == "git":
            data = git_sync_info(ws["root"])
        else:
            data = svn_sync_info(ws["root"])
        # 让页面提前知道能不能写，省得从别的机器点完按钮才吃到 403。
        writable = self.allow_write or is_loopback(self.client_address[0])
        return {"workspace": ws, **data, "writable": writable}

    def _changes(self, query):
        ws = self._ws(query)
        return {"workspace": ws, **changes_payload(ws)}

    def _stage(self, body):
        ws = self._index_ws(body)
        if ws.get("vcs") != "git":
            raise ApiError(400, "这个工作区不是 Git 仓库")
        root = ws["root"]
        paths = body.get("paths") or []
        lock = self._index_lock(ws)
        try:
            rc, _, err = git(git_stage_args(root, paths), cwd=root)
            if rc != 0:
                raise ApiError(400, err or "git add 失败")
            return {"workspace": ws, **changes_payload(ws)}
        finally:
            lock.release()

    def _restore_hunk(self, body):
        """把编辑器里选中的一块改动还原成暂存区里的样子；只认未暂存的那段差异。"""
        ws = self._index_ws(body)
        if ws.get("vcs") != "git":
            raise ApiError(400, "这个工作区不是 Git 仓库")
        root = ws["root"]
        rel = safe_rel(body.get("path") or "")
        raw = body.get("hunk")
        if not isinstance(raw, str) or not raw.strip():
            raise ApiError(400, "没有指定要还原的改动块")
        if len(raw) > 200000:
            raise ApiError(400, "改动块太大，不处理")
        lock = self._index_lock(ws)
        try:
            # 用工作区对暂存区的差异核对：暂存过的块不能在这里还原。
            text = git_change_diff(root, rel, scope="worktree")["text"]
            hunk = find_hunk(text, raw)
            if hunk is None:
                raise ApiError(409, "这块改动已经变了、已经暂存，或者文件不在仓库里，刷新后再试")
            patch = reverse_patch(rel, hunk).encode("utf-8")
            rc, _, err = git(
                ["apply", "-R", "--whitespace=nowarn", "-"], cwd=root, data=patch
            )
            if rc != 0:
                raise ApiError(400, err or "git apply 失败")
            return {"workspace": ws, "path": rel, **changes_payload(ws)}
        finally:
            lock.release()

    def _revision(self, query):
        ws = self._ws(query)
        rev = (query.get("rev") or [""])[0]
        repo_path = (query.get("path") or [""])[0]
        full = (query.get("full") or ["0"])[0] == "1"
        if ws.get("vcs") == "git":
            result = git_revision_diff(ws["root"], rev, repo_path, full)
        else:
            result = revision_diff(ws["root"], rev, repo_path, full)
        result.update({"kind": "diff", "rev": rev, "path": repo_path})
        return result

    def _index_ws(self, body):
        """暂存类接口的公共前置：先挡住别处来的写请求，再找登记的工作区。"""
        self._check_write()
        ws = self.store.find(str(body.get("ws", "")))
        if ws is None:
            raise ApiError(404, "没有这个工作区")
        return ws


    def _index_lock(self, ws):
        lock = workspace_lock(ws["id"])
        # 同一个工作副本同时只跑一个写操作，撞上了让用户等前一个跑完。
        if not lock.acquire(blocking=False):
            raise ApiError(409, "这个工作副本正有一个操作在执行")
        return lock

