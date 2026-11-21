#!/usr/bin/env python3
"""idex 网页模式的转发进程：静态页面加 SVN / Git 查询与操作接口，只用标准库。

页面要的东西都由这里现跑 svn 或 git 命令取：工作副本变更、单个文件的差异、
提交日志、某次提交的完整说明，以及直接浏览工作副本的目录与文件内容。
查询只读；拉取、推送、切换分支、更新与提交会动工作副本或远端，只接受本机请求，
要放开到其他机器得用 --allow-write 启动。工作副本变化与操作输出走 SSE。
"""

import argparse
import hashlib
import json
import os
import queue
import re
import shlex
import shutil
import subprocess
import sys
import time
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote, urlparse

# 共用骨架在仓库根的 lib/py-shared 下，源码与安装后的相对层级一致。
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "lib" / "py-shared" / "commons"))
sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "lib" / "py-shared" / "services"))
# 同目录下的 LSP 桥接；按文件加载本模块时也能找到。
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lsp_client import LspError, LspManager, LspUnavailable, apply_workspace_edit
from fileio import PreviewError, read_json, read_text_preview, write_json, write_text_preserve_newlines
from metrics import Metrics
from netutil import is_loopback_address as is_loopback
from pathutil import PathError, safe_relative, within
from runtime import check_static, serve as serve_web, start_streams
from sse import MetricsStream
from stores import LayoutStore
from routes_lsp import LspRoutes
from web import ApiError, STREAMED, WebHandler, zip_dir
from server_common import MAX_FILE, inside, log, safe_rel, workspace_lock
from vcs_cli import GIT_TIMEOUT, SVN_TIMEOUT, git, svn
from browse_fs import browse_file, browse_files, browse_list, browse_rel, browse_search, delete_entry, make_entry, read_unversioned, rename_entry, save_file, save_upload
from routes_browse import BrowseRoutes
from vcs_query import (
    svn_revision,
    svn_log,
    FETCH_TIMEOUT,
    LOG_DEFAULT,
    LOG_FMT,
    LOG_MAX,
    LOG_SKIP_MAX,
    MAX_TEXT,
    STATUS_ORDER,
    UNVERSIONED_MAX,
    UNVERSIONED_SKIP,
    WIDE_LINE,
    change_diff,
    clean_paths,
    clip,
    column_item,
    diff_of,
    expand_unversioned,
    git_ahead_behind,
    git_branch,
    git_branches,
    git_change_diff,
    git_changes,
    git_commit_detail,
    git_diff_of,
    git_head,
    git_info,
    git_item,
    git_log,
    git_op_env,
    git_ref_exists,
    git_ref_labels,
    git_remote_sync,
    git_remotes,
    git_revision_diff,
    git_stage_args,
    git_sync_info,
    git_unstage_args,
    git_upstream,
    is_wide,
    node_text,
    parse_git_log,
    parse_git_status,
    parse_log,
    parse_name_status,
    parse_status,
    revision_diff,
    split_status,
    svn_add_args,
    svn_add_paths,
    svn_commit_detail,
    svn_entry_local,
    svn_info,
    svn_log_meta,
    svn_status_state,
    svn_sync_info,
    svn_unadd_args,
    svn_unadd_paths,
    svn_working_revisions,
    unversioned_files,
    xml_of,
)
from vcs_ops import (
    COMMIT_MESSAGE_MAX,
    git_checkout_args,
    git_commit_commands,
    git_pull_args,
    git_push_args,
    operation_plan,
    svn_commit_args,
    svn_update_args,
    git_op,
    git_pull,
    git_push,
    svn_op,
    svn_update,
    svn_commit,
)
from vcs_summary import (
    changes_signature,
    changes_payload,
    workspace_paths,
    detect_vcs,
)
from routes_vcs import VcsRoutes
from routes_stream import StreamRoutes
from routes_jobs import JobRoutes
from routes_workspaces import WorkspacesRoutes, _add_workspace, _forget_workspace, _save_groups, _save_settings, _set_alias, list_dirs
from server_stores import SEARCH_IGNORE_DEFAULTS, SEARCH_IGNORE_MAX, SEARCH_IGNORE_LEN, Settings, Workspaces, clean_search_ignore
from event_hub import HUB, SSE_HEARTBEAT, WATCH_INTERVAL, EventHub, StateStream

# 一次回给页面的文本上限：大文件的整份差异撑不住页面，截断后照样能看开头。
# 单行超过这个宽度按大文件处理：压缩过的 JS/CSS 一行几十万字符，页面渲染不动。
# 未纳入版本控制的文件没有差异可算，直接读内容预览，超过这个大小就不给。
SVN_TIMEOUT = 30
GIT_TIMEOUT = 30
# fetch 是取日志前顺手同步远端，等太久就把页面拖住了，超时先按本地记录出。
# 浏览目录时一层最多回这么多项，再多的目录列出来也翻不动。
# 快速打开要一次列出工作副本里的文件，到上限就停。
# 浏览目录的搜索：命中与扫过的文件都设上限，大工作副本不至于把页面拖住。
# 搜索默认跳过的目录名，按名字在工作副本里任何一层匹配；设置页可以改。
# 拉取、推送、更新与提交都要连远端，超时比查询宽松。
# 任务跑完之后还留一段时间，页面晚连上来也能看到完整输出。
# SSE 心跳与工作副本状态检查的间隔。
# 登记表很小，变了就推，稍快一点页面也不觉得有延迟。
# 页面头部的性能指标只采一份给所有页面。
METRICS = Metrics()


















# 工作副本登记







# svn 查询









# 状态字母与中文名的对应只在页面上用，这里原样给 svn 的 item 值。




# svn status 只报未纳入版本控制的目录本身，页面要能点到里面的文件，这里展开一层层。
# 依赖与产物目录不展开：它们动辄上千个文件，列出来也没人一个个看。






























































# 浏览目录的增删改：新建、改名、删除。已纳管的交给 svn 与 git，保住历史；
# 未纳管的直接动磁盘。新建只落盘，要不要纳入版本控制留给提交页决定。



























# git 查询





















































































# HTTP

# 路由表：路径 → 处理函数，处理函数收（handler, method, query, body）。
# 只读接口任何方法都回；settings 与 operations 的读法只认 GET，其余方法交给写表。
_NOT_HANDLED = object()












READ_ROUTES = {
    "state": lambda h, m, q, b: {"workspaces": h.store.workspaces(), "groups": h._group_nodes()},
    "dirs": lambda h, m, q, b: list_dirs((q.get("path") or [""])[0]),
    "changes": lambda h, m, q, b: h._changes(q),
    "diff": lambda h, m, q, b: h._diff(q),
    "log": lambda h, m, q, b: h._log(q),
    "revision": lambda h, m, q, b: h._revision(q),
    "commit": lambda h, m, q, b: h._commit_detail(q),
    "sync-info": lambda h, m, q, b: h._sync_info(q),
    "tree": lambda h, m, q, b: h._tree(q),
    "stat": lambda h, m, q, b: h._stat(q),
    "file": lambda h, m, q, b: h._file(q),
    "search": lambda h, m, q, b: h._search(q),
    "files": lambda h, m, q, b: h._files(q),
    "settings": lambda h, m, q, b: h._settings_payload() if m == "GET" else _NOT_HANDLED,
    "lsp/status": lambda h, m, q, b: h._lsp_status(),
    "download": lambda h, m, q, b: h._download(q, head=(m == "HEAD")),
    "operations": lambda h, m, q, b: h._latest_job(q) if m == "GET" else _NOT_HANDLED,
}

WRITE_ROUTES = {
    "workspaces": lambda h, m, q, b: _add_workspace(h, b),
    "forget": lambda h, m, q, b: _forget_workspace(h, b),
    "alias": lambda h, m, q, b: _set_alias(h, b),
    "lsp/definition": lambda h, m, q, b: h._lsp_definition(b),
    "lsp/query": lambda h, m, q, b: h._lsp_query(b, str(b.get("action") or "definition")),
    "lsp/symbols": lambda h, m, q, b: h._lsp_symbols(b),
    "lsp/diagnostics": lambda h, m, q, b: h._lsp_diagnostics(b),
    "lsp/hover": lambda h, m, q, b: h._lsp_hover(b),
    "lsp/completion": lambda h, m, q, b: h._lsp_completion(b),
    "lsp/format": lambda h, m, q, b: h._lsp_format(b),
    "lsp/rename": lambda h, m, q, b: h._lsp_rename(b),
    "lsp/rename-apply": lambda h, m, q, b: h._lsp_rename(b, apply=True),
    "settings": lambda h, m, q, b: _save_settings(h, b),
    "groups": lambda h, m, q, b: _save_groups(h, b),
    "save": lambda h, m, q, b: h._save(b),
    "mkdir": lambda h, m, q, b: h._browse_create(b, "dir"),
    "newfile": lambda h, m, q, b: h._browse_create(b, "file"),
    "rename": lambda h, m, q, b: h._browse_rename(b),
    "delete": lambda h, m, q, b: h._browse_delete(b),
    "stage": lambda h, m, q, b: h._stage(b),
    "unstage": lambda h, m, q, b: h._unstage(b),
    "restore-hunk": lambda h, m, q, b: h._restore_hunk(b),
    "svn-add": lambda h, m, q, b: h._svn_add(b),
    "svn-unadd": lambda h, m, q, b: h._svn_unadd(b),
    "operations": lambda h, m, q, b: h._start_operation(b),
}


class Handler(JobRoutes, WorkspacesRoutes, StreamRoutes, VcsRoutes, BrowseRoutes, LspRoutes, WebHandler):
    server_version = "idex-web"

    static = None
    store = None
    # 左侧工作副本的分组结构，存在 state.json 旁边。
    groups = None
    # 全局设置（搜索跳过的目录等），同样存在 state.json 旁边。
    settings = None
    # 代码索引的语言服务器管理器；没起来时这两个接口都说不支持。
    lsp = None
    state_stream = None
    metrics_stream = None
    api_prefix = "/__idex/api"
    # 写操作默认只认本机；--allow-write 把它放开给所有能打开页面的人。
    allow_write = False

    def _error_log(self, msg):
        # 这一侧的日志带时间戳，骨架里的默认写法没有。
        log(msg)



    def _stream_routes(self, route, query):
        # SSE 自己写响应头与数据流，不走一次性回 JSON 的路。
        if route == "state/stream":
            self._sse_state()
            return True
        if route == "events":
            self._sse_workspace(query)
            return True
        if route == "metrics/stream":
            self._sse_metrics()
            return True
        match = re.fullmatch(r"operations/([0-9a-zA-Z_-]+)/events", route)
        if match:
            self._sse_job(match.group(1))
            return True
        return False

    def _dispatch(self, method, route, query, body):
        handler = READ_ROUTES.get(route)
        if handler is not None:
            result = handler(self, method, query, body)
            if result is not _NOT_HANDLED:
                return result
        match = re.fullmatch(r"operations/([0-9a-zA-Z_-]+)", route)
        if match and method == "GET":
            return self._job_json(match.group(1))
        if method != "POST":
            raise ApiError(405, "这个接口只接受 POST")
        handler = WRITE_ROUTES.get(route)
        if handler is not None:
            return handler(self, method, query, body)
        match = re.fullmatch(r"operations/([0-9a-zA-Z_-]+)/cancel", route)
        if match:
            return self._cancel_job(match.group(1))
        raise ApiError(404, "没有这个接口：%s" % route)

    def _ws(self, query):
        wid = (query.get("ws") or [""])[0]
        item = self.store.find(wid)
        if item is None:
            raise ApiError(404, "没有这个工作区：%s" % wid)
        return item



























    # SSE









    # 安全与请求体

    def _check_write(self):
        if self.allow_write or is_loopback(self.client_address[0]):
            return
        raise ApiError(403, "写操作只允许本机发起；要放开给其他机器，用 --allow-write 启动")

    # 上传：请求体是文件原始字节，目录与文件名走查询参数，不走 JSON 那一套。

    def _raw_post(self, route, query):
        if route != "upload":
            return False
        try:
            result = self._upload(query)
        except ApiError as exc:
            self._json(exc.status, {"error": exc.message})
            return True
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return True
        except Exception as exc:
            self._error_log("上传出错 %s：%r" % (self.path, exc))
            self._json(500, {"error": "服务端出错：%s" % exc})
            return True
        self._json(200, result)
        return True

    def _upload(self, query):
        self._check_write()
        ws = self.store.find((query.get("ws") or [""])[0])
        if ws is None:
            raise ApiError(404, "没有这个工作区")
        length = self.headers.get("Content-Length")
        if length is None:
            raise ApiError(411, "上传必须带 Content-Length")
        try:
            length = int(length)
        except ValueError:
            raise ApiError(400, "Content-Length 不对")
        rel = (query.get("dir") or [""])[0]
        name = (query.get("name") or [""])[0]
        overwrite = (query.get("overwrite") or [""])[0] == "1"
        return save_upload(ws["root"], rel, name, self.rfile, length, overwrite)


def serve(args):
    static = check_static(args.static)
    if static is None:
        return 3
    if not (shutil.which("svn") or shutil.which("git")):
        log("找不到 svn 与 git 命令，装上其中一个再试")
        return 3

    Handler.static = static
    Handler.store = Workspaces(args.state)
    Handler.groups = LayoutStore(Path(args.state).parent / "groups.json")
    Handler.settings = Settings(Path(args.state).parent / "settings.json")
    Handler.lsp = LspManager()
    Handler.api_prefix = args.api
    Handler.allow_write = args.allow_write
    Handler.state_stream = StateStream(
        [args.state, Path(args.state).parent / "groups.json"],
        lambda: {"workspaces": Handler.store.workspaces(), "groups": Handler.groups.nodes()},
    )
    Handler.metrics_stream = MetricsStream(METRICS)
    start_streams(Handler.state_stream, Handler.metrics_stream)

    return serve_web(
        Handler,
        args.host,
        args.port,
        ready="IDEX_WEB_READY",
        title="idex 网页",
        open_browser=args.open,
        cleanup=Handler.lsp.stop_all,
        label="idex",
    )


def main(argv=None):
    parser = argparse.ArgumentParser(prog="idex-web", description="idex 网页模式的转发进程")
    parser.add_argument("--static", required=True, help="打包好的页面目录")
    parser.add_argument("--state", required=True, help="工作区登记文件")
    parser.add_argument("--api", default="/__idex/api", help="接口前缀")
    parser.add_argument("--host", default="0.0.0.0", help="监听地址，默认所有网卡")
    parser.add_argument("--port", type=int, default=8100, help="监听端口，默认 8100")
    parser.add_argument(
        "--allow-write",
        action="store_true",
        help="允许其他机器发起拉取、推送、切换分支、更新与提交；默认只认本机",
    )
    parser.add_argument("--open", action="store_true", help="起来后打开浏览器")
    return serve(parser.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
