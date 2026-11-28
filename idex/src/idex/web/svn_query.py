# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\svn_query.py
# @Description: SVN 的查询：状态、差异、日志、提交详情与同步信息。

from web import ApiError
import os
import xml.etree.ElementTree as ET
from urllib.parse import unquote, urlparse

from vcs_cli import svn

from vcs_common import (
    MAX_TEXT,
    STATUS_ORDER,
    clean_paths,
    clip,
    expand_unversioned,
)


def node_text(parent, name):
    node = parent.find(name) if parent is not None else None
    return (node.text or "").strip() if node is not None and node.text else ""


def parse_log(out):
    entries = []
    for entry in xml_of(out).iter("logentry"):
        paths = []
        for item in entry.iter("path"):
            paths.append(
                {
                    "action": item.get("action", ""),
                    "kind": item.get("kind", ""),
                    "path": (item.text or "").strip(),
                    "copyfrom": item.get("copyfrom-path", ""),
                }
            )
        entries.append(
            {
                "revision": entry.get("revision", ""),
                "author": node_text(entry, "author"),
                "date": node_text(entry, "date"),
                "message": node_text(entry, "msg"),
                "paths": paths,
            }
        )
    return entries


def parse_status(out):
    files = []
    for entry in xml_of(out).iter("entry"):
        wc = entry.find("wc-status")
        if wc is None:
            continue
        item = wc.get("item", "normal")
        props = wc.get("props", "none")
        # 只有属性变了的照 svn 的说法也是 normal，单独标出来，否则页面上看不见。
        if item == "normal" and props != "modified":
            continue
        files.append(
            {
                "path": entry.get("path", ""),
                "item": item,
                "props": props,
                "revision": wc.get("revision", ""),
            }
        )
    files.sort(key=lambda f: (STATUS_ORDER.get(f["item"], 99), f["path"]))
    return files


def svn_add_args(root, paths):
    # --parents 让新加的目录连同上级一起纳管，省得页面逐层选。
    return ["add", "--parents", "--", *clean_paths(root, paths)]


def svn_add_paths(state, paths):
    """纳入版本控制只接受未纳管的路径；已纳管或本地缺失的先让用户看清楚。"""
    if not paths:
        raise ApiError(400, "没有选中要纳入版本控制的路径")
    clean = []
    for rel in paths:
        if state.get(rel) != "unversioned":
            raise ApiError(400, "只能纳入未纳入版本控制的路径：%s" % rel)
        if rel not in clean:
            clean.append(rel)
    return clean


def svn_commit_detail(root, rev):
    """一个版本的完整信息；svn log 本来就给整段提交说明。"""
    if not (rev or "").isdigit():
        raise ApiError(400, "版本号不对：%s" % rev)
    rc, out, err = svn(["log", "--xml", "-v", "-r", rev], cwd=root)
    if rc != 0:
        raise ApiError(400, err or "读不了这个版本")
    entries = parse_log(out)
    if not entries:
        raise ApiError(404, "没有这个版本：%s" % rev)
    entry = entries[0]
    return {
        "revision": entry["revision"],
        "short": "r" + entry["revision"],
        "author": entry["author"],
        "email": "",
        "date": entry["date"],
        "parents": [],
        "refs": [],
        "message": entry["message"],
        "paths": entry["paths"],
    }


def svn_entry_local(entry, prefix, revs, top, base_rev):
    """根已更新到这一版或更新时整棵树都算本地已有；否则按文件各自版本看，新加后又被删的文件不在 revs 里，不能判成未更新。"""
    try:
        rev = int(entry["revision"])
    except (TypeError, ValueError):
        return False
    if rev <= base_rev:
        return True
    checked = 0
    for item in entry["paths"]:
        # 目录的版本不随提交往前走，拿它判断会把刚提交的改动误判成远程。
        if item.get("kind") == "dir":
            continue
        path = item.get("path") or ""
        if prefix:
            if not path.startswith(prefix + "/"):
                continue
            rel = path[len(prefix) + 1:]
        else:
            rel = path.lstrip("/")
        checked += 1
        if rel in revs:
            if revs[rel] < rev:
                return False
        elif item.get("action") != "D":
            # 这一版新加或改名的文件本地还没有，说明还没更新到这一版。
            return False
    if checked:
        return True
    # 这一版只动了目录：按工作副本里最新的版本判断。
    return top >= rev


def svn_info(root):
    rc, out, err = svn(["info", "--xml"], cwd=root)
    if rc != 0:
        raise ApiError(400, "这个目录不是 SVN 工作副本：%s" % (err or root))
    entry = xml_of(out).find("entry")
    if entry is None:
        raise ApiError(500, "svn info 没有给出条目：%s" % root)
    wc = entry.find("wc-info")
    # svn 给的是百分号编码的地址，中文项目名在页面上要看原文。
    return {
        "root": node_text(wc, "wcroot-abspath") or os.path.abspath(root),
        "revision": entry.get("revision", ""),
        "url": unquote(node_text(entry, "url")),
        "repo_root": unquote(node_text(entry.find("repository"), "root")),
        "last_changed_rev": node_text(entry.find("commit"), "revision"),
        "last_changed_author": node_text(entry.find("commit"), "author"),
    }


def svn_log_meta(root, limit, skip=0):
    """日志连同工作副本的版本位置：文件里最高的版本号。"""
    # 工作副本根目录本身的 BASE 往往是 r0，直接 svn log 会一条都没有；从 HEAD 往回想。
    # svn log 没有跳过多少条的参数，多取 skip 条再切掉前面已有的。
    fetch = limit + skip
    rc, out, err = svn(["log", "--xml", "-v", "-l", str(fetch), "-r", "HEAD:1"], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "svn log 失败")
    entries = parse_log(out)
    revs = svn_working_revisions(root)
    top = max(revs.values(), default=0)
    info = svn_info(root)
    try:
        base_rev = int(info["revision"])
    except (TypeError, ValueError):
        base_rev = 0
    # svn log 给的路径相对仓库根，工作副本在仓库里的位置要从这两个地址里减出来。
    url_path = urlparse(info["url"]).path.rstrip("/")
    repo_path = urlparse(info["repo_root"]).path.rstrip("/")
    prefix = url_path[len(repo_path):].rstrip("/") if repo_path and url_path.startswith(repo_path) else url_path
    for entry in entries:
        entry["local"] = svn_entry_local(entry, prefix, revs, top, base_rev)
        # 页面按工作区相对路径打开文件；仓库根相对路径留在 repoPath 给版本差异用。
        for item in entry.get("paths") or []:
            item["repoPath"] = item.get("path") or ""
            item["path"] = svn_workspace_path(item["repoPath"], prefix)
            if item.get("copyfrom"):
                item["copyfromRepo"] = item["copyfrom"]
                item["copyfrom"] = svn_workspace_path(item["copyfrom"], prefix)
    return entries[skip:], {"wc_revision": top}


def svn_workspace_path(path, prefix):
    """仓库根相对路径换成工作区相对路径；工作区外的路径按仓库根相对原样返回。"""
    rel = (path or "").lstrip("/")
    root_prefix = (prefix or "").strip("/")
    if not root_prefix:
        return rel
    if rel == root_prefix:
        return ""
    head = root_prefix + "/"
    return rel[len(head):] if rel.startswith(head) else rel


def svn_status_state(root):
    """路径到状态的对照表；未纳管目录按文件展开，与页面列的一致。"""
    rc, out, err = svn(["status", "--xml"], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "svn status 失败")
    files, _ = expand_unversioned(root, parse_status(out))
    return {item["path"]: item["item"] for item in files}


def svn_sync_info(root):
    info = svn_info(root)
    rc, out, err = svn(["status", "--xml"], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "svn status 失败")
    files = [item for item in parse_status(out) if item["item"] != "unversioned"]
    return {
        **info,
        "vcs": "svn",
        "files": files,
        "conflicts": [item["path"] for item in files if item["item"] == "conflicted"],
    }


def svn_original(root, rel, rev=None):
    """差异编辑器左栏要的原始版本：默认 BASE，也可指定版本；未纳管返回空。"""
    # 日志里的仓库根相对路径以 / 开头，用 ^/ 让 svn 按仓库根取，不当作本地绝对路径。
    target = "^" + rel if rel.startswith("/") else rel
    args = ["cat", "-r", str(rev) if rev else "BASE", "--", target]
    rc, out, err = svn(args, cwd=root)
    if rc != 0:
        if not rev:
            return {"text": "", "truncated": False}
        raise ApiError(400, err or "取原始版本失败")
    text = out.decode("utf-8", "replace").replace("\r\n", "\n").replace("\r", "\n")
    if len(text) > MAX_TEXT:
        return {"text": text[:MAX_TEXT] + "\n…（文件太长，后面的没有显示）\n", "truncated": True}
    return {"text": text, "truncated": False}


def svn_unadd_args(root, paths):
    # 撤回纳入用 svn revert：文件留着，只把待提交的新增标记去掉。
    # 目录必须连子项一起撤，只撤目录本身 svn 会报 E155038。
    return ["revert", "--depth", "infinity", "--", *clean_paths(root, paths)]


def svn_unadd_paths(state, paths):
    """取消纳入只认刚纳入、还没提交的路径；改过或已提交的不在这里撤。"""
    if not paths:
        raise ApiError(400, "没有选中要取消纳入版本控制的路径")
    clean = []
    for rel in paths:
        if state.get(rel) != "added":
            raise ApiError(400, "只能取消还没提交的纳入：%s" % rel)
        if rel not in clean:
            clean.append(rel)
    return clean


def svn_working_revisions(root):
    """工作副本里每个条目各自的版本；根目录版本只记上次更新位置，判断“这一版在本地”要按文件各自的版本看。"""
    rc, out, err = svn(["info", "--xml", "-R"], cwd=root)
    if rc != 0:
        raise ApiError(500, err or "svn info 失败")
    revs = {}
    for entry in xml_of(out).iter("entry"):
        try:
            revs[entry.get("path", "")] = int(entry.get("revision", ""))
        except ValueError:
            continue
    return revs


def xml_of(out):
    try:
        return ET.fromstring(out)
    except ET.ParseError as exc:
        raise ApiError(500, "svn 返回的 XML 读不懂：%s" % exc)


def svn_revision(root):
    """工作副本记着的版本号；查不到就返回 None，别把一次失败当成版本变了。"""
    try:
        rc, out, _ = svn(["info", "--xml"], cwd=root)
        if rc != 0:
            return None
        entry = xml_of(out).find("entry")
    except ApiError:
        return None
    return entry.get("revision", "") if entry is not None else None


def svn_log(root, limit):
    """读日志，并标出哪些提交已经随工作副本更新到了本地。"""
    entries, _ = svn_log_meta(root, limit)
    return entries

