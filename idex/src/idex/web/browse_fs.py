# @Author: Himmeltala
# @Date: 2026-11-26 09:29:54
# @LastEditors: Himmeltala
# @LastEditTime: 2026-11-26 09:29:54
# @FilePath: \idex\src\idex\web\browse_fs.py
# @Description: 浏览目录的读写：列目录、取文件、搜索、保存，以及新建、改名、删除。

import grp
import io
import os
import pwd
import shutil
import stat
import tempfile
import threading
import time
from pathlib import Path

from web import ApiError
from fileio import PreviewError, read_text_preview, write_text_preserve_newlines

from server_common import MAX_FILE, inside, safe_rel
from vcs_cli import git, svn

# 一层最多列这么多条，再多就分页看。
BROWSE_MAX = 500
# 快速打开的文件清单上限。
FILES_MAX = 20000
# 搜索命中与扫过的文件上限，防止在特别大的工作副本里扫太久。
SEARCH_MAX = 200
SEARCH_FILES_MAX = 20000
# 一条命中行回给页面的最多字数。
SEARCH_LINE_MAX = 400


def browse_rel(rel):
    """浏览接口的路径：空串表示登记的目录本身，其余按工作副本内相对路径校验。"""
    rel = (rel or "").strip()
    if not rel:
        return ""
    return safe_rel(rel)


def browse_list(root, rel):
    """列一层目录，目录在前、文件在后；先收名字排序，只给真正显示的那段取大小，大目录不必逐个 stat。"""
    rel = browse_rel(rel).rstrip("/")
    target = os.path.join(root, rel) if rel else root
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    if not os.path.isdir(target):
        raise ApiError(404, "目录不存在：%s" % (rel or "根目录"))
    entries = []
    try:
        with os.scandir(target) as it:
            for entry in it:
                try:
                    is_dir = entry.is_dir(follow_symlinks=True)
                except OSError:
                    is_dir = False
                entries.append(
                    {
                        "name": entry.name,
                        "path": (rel + "/" + entry.name) if rel else entry.name,
                        "type": "dir" if is_dir else "file",
                    }
                )
    except OSError as exc:
        raise ApiError(403, "读不了目录：%s" % exc)
    entries.sort(key=lambda e: (e["type"] != "dir", e["name"].lower()))
    truncated = len(entries) > BROWSE_MAX
    shown = entries[:BROWSE_MAX]
    for item in shown:
        if item["type"] == "file":
            try:
                item["size"] = os.stat(os.path.join(target, item["name"]), follow_symlinks=True).st_size
            except OSError:
                item["size"] = 0
    return {"path": rel, "entries": shown, "truncated": truncated}


def _contains_bytes(data, needle, chunk=64 * 1024):
    """整份里有没有这个 ASCII 片段；按块比，别为了一次预筛复制整份文件。"""
    overlap = max(0, len(needle) - 1)
    start = 0
    size = len(data)
    while start < size:
        part = data[start:start + chunk + overlap].lower()
        if needle in part:
            return True
        start += chunk
    return False


def search_lines(path, needle, should_stop=None, needle_bytes=None):
    """逐行找内容，跳过二进制、超大与非 UTF-8 文件；纯 ASCII 查询先用字节预筛，整份未命中就不解码。"""
    try:
        if os.path.getsize(path) > MAX_FILE:
            return
        data = Path(path).read_bytes()
    except OSError:
        return
    if b"\x00" in data:
        return
    if needle_bytes is not None and not _contains_bytes(data, needle_bytes):
        return
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return
    # 逐行给，不先建整份行列表：几万行的大文件只占一份文本。
    for number, line in enumerate(io.StringIO(text), 1):
        if should_stop is not None and number % 200 == 0 and should_stop():
            return
        line = line.rstrip("\r\n")
        if needle in line.lower():
            yield number, line.strip()[:SEARCH_LINE_MAX]


# 快速打开的文件清单缓存：同一工作区连续用不必每次全量扫。
FILES_CACHE_TTL = 30
FILES_CACHE_MAX = 32
_FILES_CACHE = {}
_FILES_LOCK = threading.Lock()


def _ignored_path(relpath, skip):
    if not skip:
        return False
    return any(part in skip for part in relpath.split("/")[:-1])


def browse_files(root, ignore=(), vcs="none"):
    """快速打开用的文件清单：跳过 ignore 目录，按路径排序，到上限就停；Git 工作区用 git ls-files，结果缓存一小段时间。"""
    skip = {str(name) for name in ignore if name}
    key = (root, tuple(sorted(skip)), vcs)
    now = time.time()
    with _FILES_LOCK:
        hit = _FILES_CACHE.get(key)
        if hit is not None and now - hit[0] < FILES_CACHE_TTL:
            return hit[1]
    result = None
    real_root = os.path.realpath(root)
    if vcs == "git":
        rc, out, _ = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=root)
        if rc == 0:
            files = [item for item in out.decode("utf-8", "replace").split("\0") if item]
            files = sorted(item for item in files if not _ignored_path(item, skip))
            result = (files[:FILES_MAX], len(files) > FILES_MAX)
    if result is None:
        out = []
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = sorted(name for name in dirnames if name not in skip)
            for name in sorted(filenames):
                path = os.path.join(dirpath, name)
                if os.path.islink(path) and not os.path.realpath(path).startswith(real_root + os.sep):
                    continue
                out.append(os.path.relpath(path, root).replace(os.sep, "/"))
                if len(out) >= FILES_MAX:
                    result = (out, True)
                    break
            if result is not None:
                break
        if result is None:
            result = (out, False)
    with _FILES_LOCK:
        if len(_FILES_CACHE) >= FILES_CACHE_MAX:
            oldest = min(_FILES_CACHE, key=lambda item: _FILES_CACHE[item][0])
            _FILES_CACHE.pop(oldest, None)
        _FILES_CACHE[key] = (now, result)
    return result


def _file_size(path):
    try:
        return os.path.getsize(path)
    except OSError:
        return 0


def browse_search(root, rel, query, mode, ignore=(), should_stop=None):
    """按文件名或内容搜索，跳过 ignore 目录与二进制；命中或扫过的文件到上限就停，should_stop 由调用方控制。"""
    base = browse_rel(rel).rstrip("/")
    target = os.path.join(root, base) if base else root
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    if not os.path.isdir(target):
        raise ApiError(404, "目录不存在：%s" % (rel or "根目录"))
    needle = (query or "").strip()
    if mode not in ("name", "content"):
        mode = "name"
    if not needle:
        return {"query": "", "mode": mode, "matches": [], "truncated": False}
    low = needle.lower()
    needle_bytes = low.encode("utf-8") if low.isascii() else None
    skip = {str(name) for name in ignore if name}
    real_root = os.path.realpath(root)
    matches = []
    scanned = 0
    truncated = False
    cancelled = False
    for dirpath, dirnames, filenames in os.walk(target):
        if should_stop is not None and should_stop():
            cancelled = True
            break
        dirnames[:] = sorted(name for name in dirnames if name not in skip)
        for name in sorted(filenames):
            if should_stop is not None and scanned % 200 == 0 and should_stop():
                cancelled = True
                break
            path = os.path.join(dirpath, name)
            # os.walk 不跟目录软链，正常条目一定在根内；只有文件软链可能指到外面，
            # 这时才解析一次，别给每个文件都做一遍 realpath。
            if os.path.islink(path) and not os.path.realpath(path).startswith(real_root + os.sep):
                continue
            relpath = os.path.relpath(path, root).replace(os.sep, "/")
            scanned += 1
            if mode == "name":
                if low in name.lower():
                    matches.append(
                        {"path": relpath, "name": name, "size": _file_size(path)}
                    )
            else:
                for number, line in search_lines(path, low, should_stop, needle_bytes):
                    matches.append(
                        {
                            "path": relpath,
                            "name": name,
                            "size": _file_size(path),
                            "line": number,
                            "text": line,
                        }
                    )
                    if len(matches) > SEARCH_MAX:
                        break
            if len(matches) > SEARCH_MAX or scanned >= SEARCH_FILES_MAX:
                truncated = True
                break
        if truncated or cancelled:
            break
    return {
        "query": needle,
        "mode": mode,
        "matches": matches[:SEARCH_MAX],
        "truncated": truncated,
        "cancelled": cancelled,
        "scanned": scanned,
    }


def browse_file(root, rel):
    """读工作副本里的一个文件，大小、编码与二进制的限制跟未纳管文件预览一致。"""
    rel = browse_rel(rel)
    if not rel:
        raise ApiError(400, "没给文件路径")
    return read_unversioned(root, rel)


def browse_file_info(root, rel):
    """读文件内容并带上修改时间与大小，页面据此判断磁盘上那份换没换。"""
    rel = browse_rel(rel)
    text = browse_file(root, rel)
    info = os.stat(os.path.join(root, rel))
    return {"text": text, "size": info.st_size, "mtime_ns": info.st_mtime_ns}


def read_unversioned(root, rel):
    """未纳入版本控制的文件没有差异，读内容当整份新增显示。"""
    target = os.path.join(root, rel)
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    if os.path.isdir(target):
        raise ApiError(400, "这是目录，里面没有可直接预览的文件")
    if not os.path.isfile(target):
        raise ApiError(404, "文件不存在：%s" % rel)
    try:
        return read_text_preview(target, MAX_FILE)
    except PreviewError as exc:
        if exc.kind == "too_large":
            raise ApiError(413, "文件有 %d 字节，超过预览上限 %d" % (exc.size, exc.max_bytes))
        if exc.kind == "binary":
            raise ApiError(415, "这是二进制文件，看不了内容")
        raise ApiError(415, "这个文件的编码不是 UTF-8，看不了内容")


def save_file(root, rel, text):
    """把浏览目录里改过的文件按 UTF-8 写回，换行风格跟原来保持一致。"""
    rel = browse_rel(rel)
    if not rel:
        raise ApiError(400, "没给文件路径")
    target = os.path.join(root, rel)
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    if os.path.isdir(target):
        raise ApiError(400, "这是目录，不能按文件保存")
    if not os.path.isfile(target):
        raise ApiError(404, "文件不存在：%s" % rel)
    try:
        old = Path(target).read_bytes()
    except OSError as exc:
        raise ApiError(403, "读不了这个文件：%s" % exc)
    # 只覆盖能被预览的文本，二进制与别的编码不碰。
    if b"\x00" in old:
        raise ApiError(415, "这是二进制文件，不能按文本保存")
    try:
        old.decode("utf-8")
    except UnicodeDecodeError:
        raise ApiError(415, "这个文件的编码不是 UTF-8，不能按文本保存")
    try:
        size = write_text_preserve_newlines(target, text, old=old)
    except OSError as exc:
        raise ApiError(403, "写不了这个文件：%s" % exc)
    return {"path": rel, "size": size}


def entry_name(name):
    """新建与改名只认单个名字：不能带路径分隔符，不能是 . 或 ..。"""
    name = (name or "").strip()
    if not name:
        raise ApiError(400, "没给名字")
    if name in (".", "..") or "/" in name or "\\" in name or "\x00" in name:
        raise ApiError(400, "名字里不能带路径分隔符：%s" % name)
    return name


def join_rel(parent, name):
    return "%s/%s" % (parent, name) if parent else name


def browse_parent(root, rel):
    """取一个要在里面新建东西的目录，空串表示登记的目录本身。"""
    rel = browse_rel(rel).rstrip("/")
    target = os.path.join(root, rel) if rel else root
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    if not os.path.isdir(target):
        raise ApiError(404, "目录不存在：%s" % (rel or "根目录"))
    return rel, target


def browse_target(root, rel):
    """取一个要改名或删除的条目；不允许动登记的目录本身。"""
    rel = browse_rel(rel)
    if not rel:
        raise ApiError(400, "不能对工作副本的根目录做这个操作")
    target = os.path.join(root, rel)
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    if not os.path.lexists(target):
        raise ApiError(404, "文件或目录不存在：%s" % rel)
    return rel, target


def entry_kind(target):
    return "dir" if os.path.isdir(target) else "file"


def git_tracks(root, rel):
    """Git 认得这个路径下的文件就算纳管；目录只要里面有已跟踪的文件也算。"""
    rc, out, _ = git(["ls-files", "-z", "--", ":(literal)" + rel], cwd=root)
    return rc == 0 and bool(out.strip(b"\0"))


def svn_tracks(root, rel):
    rc, _, _ = svn(["info", "--", rel], cwd=root)
    return rc == 0


def make_entry(root, rel, name, kind):
    """在指定目录下新建目录或空文件；同名已存在时拒绝，不覆盖。"""
    parent_rel, parent = browse_parent(root, rel)
    name = entry_name(name)
    target = os.path.join(parent, name)
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % join_rel(parent_rel, name))
    if os.path.lexists(target):
        raise ApiError(409, "已经有同名的文件或目录：%s" % name)
    try:
        if kind == "dir":
            os.mkdir(target)
        else:
            # x 模式带排他性：检查与创建之间被别人抢建也只会报错，不会覆盖。
            with open(target, "x", encoding="utf-8"):
                pass
    except FileExistsError:
        raise ApiError(409, "已经有同名的文件或目录：%s" % name)
    except OSError as exc:
        raise ApiError(403, "建不了：%s" % exc)
    return {"path": join_rel(parent_rel, name), "name": name, "type": kind}


# 上传按块从连接里读，边收边写，多大都不占内存。
UPLOAD_CHUNK = 64 * 1024
# 单个文件上传上限；超过直接拒绝，别把磁盘写满。
UPLOAD_MAX = 512 * 1024 * 1024


def _owner_name(uid):
    try:
        return pwd.getpwuid(uid).pw_name
    except KeyError:
        return str(uid)


def _group_name(gid):
    try:
        return grp.getgrgid(gid).gr_name
    except KeyError:
        return str(gid)


def entry_stat(root, rel):
    """右键属性要的基础信息：类型、大小、修改时间、权限与所有者。"""
    rel = browse_rel(rel).rstrip("/") if rel else ""
    target = os.path.join(root, rel) if rel else root
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % rel)
    if not os.path.lexists(target):
        raise ApiError(404, "文件或目录不存在：%s" % (rel or "根目录"))
    info = os.lstat(target)
    if os.path.islink(target):
        kind = "link"
    elif os.path.isdir(target):
        kind = "dir"
    else:
        kind = "file"
    return {
        "path": rel,
        "name": os.path.basename(target) if rel else os.path.basename(os.path.abspath(root)),
        "abs": os.path.abspath(target),
        "type": kind,
        "size": None if kind == "dir" else info.st_size,
        "mtime": info.st_mtime,
        "mtime_ns": info.st_mtime_ns,
        "mode": "%04o" % stat.S_IMODE(info.st_mode),
        "mode_text": stat.filemode(info.st_mode),
        "owner": _owner_name(info.st_uid),
        "group": _group_name(info.st_gid),
        "link_target": os.readlink(target) if kind == "link" else "",
    }


def save_upload(root, rel, name, stream, length, overwrite=False):
    """先写同目录临时文件，收全了再原子改名；断网、取消、写盘失败都不会在目标位置留下半截文件。"""
    parent_rel, parent = browse_parent(root, rel)
    name = entry_name(name)
    target = os.path.join(parent, name)
    if not inside(root, target):
        raise ApiError(400, "路径要在工作副本里：%s" % join_rel(parent_rel, name))
    if os.path.isdir(target):
        raise ApiError(409, "这里是目录，不能覆盖：%s" % name)
    if os.path.lexists(target) and not overwrite:
        raise ApiError(409, "已经有同名的文件或目录：%s" % name)
    if length <= 0:
        raise ApiError(400, "上传内容为空")
    if length > UPLOAD_MAX:
        raise ApiError(413, "文件太大：%d MB，上限 %d MB" % (length // (1024 * 1024), UPLOAD_MAX // (1024 * 1024)))
    fd, tmp = tempfile.mkstemp(prefix=".upload-", suffix=".part", dir=parent)
    total = 0
    try:
        with os.fdopen(fd, "wb") as out:
            remain = length
            while remain > 0:
                chunk = stream.read(min(UPLOAD_CHUNK, remain))
                if not chunk:
                    raise ApiError(400, "上传中断：只收到 %d/%d 字节" % (total, length))
                out.write(chunk)
                total += len(chunk)
                remain -= len(chunk)
        # 不带 overwrite 时用硬链接落位：目标名已存在会原子失败，不会盖掉别人刚建的同名文件。
        if overwrite:
            os.replace(tmp, target)
        else:
            try:
                os.link(tmp, target)
            except FileExistsError:
                raise ApiError(409, "已经有同名的文件或目录：%s" % name)
            except OSError:
                # 有的文件系统不支持硬链接：退回改名，前面的存在性检查仍然先挡一遍。
                if os.path.lexists(target):
                    raise ApiError(409, "已经有同名的文件或目录：%s" % name)
                os.replace(tmp, target)
            else:
                os.unlink(tmp)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    return {"path": join_rel(parent_rel, name), "name": name, "size": total}


def rename_entry(root, vcs, rel, name):
    """同目录改名：已纳管的走 git mv / svn mv，未纳管的直接改名。"""
    rel, src = browse_target(root, rel)
    name = entry_name(name)
    dest_rel = join_rel(os.path.dirname(rel), name)
    dest = os.path.join(root, dest_rel)
    if not inside(root, dest):
        raise ApiError(400, "路径要在工作副本里：%s" % dest_rel)
    if src == dest:
        return {"path": rel, "name": os.path.basename(rel), "type": entry_kind(src)}
    if os.path.lexists(dest):
        raise ApiError(409, "已经有同名的文件或目录：%s" % name)
    try:
        if vcs == "git" and git_tracks(root, rel):
            rc, _, err = git(["mv", "--", rel, dest_rel], cwd=root)
            if rc != 0:
                raise ApiError(400, err or "git mv 失败")
        elif vcs == "svn" and svn_tracks(root, rel):
            rc, _, err = svn(["mv", "--", rel, dest_rel], cwd=root)
            if rc != 0:
                raise ApiError(400, err or "svn mv 失败")
        else:
            os.rename(src, dest)
    except OSError as exc:
        raise ApiError(403, "改名失败：%s" % exc)
    return {"path": dest_rel, "name": name, "type": entry_kind(dest)}


def move_entry(root, vcs, rel, dest_dir):
    """把文件或目录移到另一层目录；已纳管的走 git mv / svn mv，未纳管的直接改名。"""
    rel, src = browse_target(root, rel)
    parent_rel, parent = browse_parent(root, dest_dir)
    name = os.path.basename(rel)
    dest_rel = join_rel(parent_rel, name)
    if dest_rel == rel:
        return {"path": rel, "name": name, "type": entry_kind(src)}
    dest = os.path.join(root, dest_rel)
    if not inside(root, dest):
        raise ApiError(400, "路径要在工作副本里：%s" % dest_rel)
    # 目录不能移进自己或自己的子目录里。
    real_src = os.path.realpath(src)
    real_parent = os.path.realpath(parent)
    if real_parent == real_src or real_parent.startswith(real_src + os.sep):
        raise ApiError(400, "不能把目录移动到它自己里面")
    if os.path.lexists(dest):
        raise ApiError(409, "目标目录里已经有同名文件或目录：%s" % name)
    try:
        if vcs == "git" and git_tracks(root, rel):
            rc, _, err = git(["mv", "--", rel, dest_rel], cwd=root)
            if rc != 0:
                raise ApiError(400, err or "git mv 失败")
        elif vcs == "svn" and svn_tracks(root, rel):
            rc, _, err = svn(["mv", "--", rel, dest_rel], cwd=root)
            if rc != 0:
                raise ApiError(400, err or "svn mv 失败")
        else:
            os.rename(src, dest)
    except OSError as exc:
        raise ApiError(403, "移动失败：%s" % exc)
    return {"path": dest_rel, "name": name, "type": entry_kind(dest)}


def delete_entry(root, vcs, rel):
    """删除文件或整个目录：已纳管的走 git rm / svn rm，未纳管的直接删磁盘。"""
    rel, target = browse_target(root, rel)
    tracked = False
    if vcs == "git" and git_tracks(root, rel):
        tracked = True
        rc, _, err = git(["rm", "-r", "-f", "--", rel], cwd=root)
        if rc != 0:
            raise ApiError(400, err or "git rm 失败")
    elif vcs == "svn" and svn_tracks(root, rel):
        tracked = True
        rc, _, err = svn(["rm", "--force", "--", rel], cwd=root)
        if rc != 0:
            raise ApiError(400, err or "svn rm 失败")
    else:
        try:
            if os.path.islink(target) or not os.path.isdir(target):
                os.remove(target)
            else:
                shutil.rmtree(target)
        except OSError as exc:
            raise ApiError(403, "删不了：%s" % exc)
        return {"path": rel, "removed": True, "tracked": False}
    # git 只删已跟踪的文件，目录里剩下的未纳管内容按整目录删除一并清掉。
    if os.path.lexists(target):
        try:
            if os.path.islink(target) or not os.path.isdir(target):
                os.remove(target)
            else:
                shutil.rmtree(target)
        except OSError as exc:
            raise ApiError(403, "删不了剩下的内容：%s" % exc)
    return {"path": rel, "removed": True, "tracked": tracked}

