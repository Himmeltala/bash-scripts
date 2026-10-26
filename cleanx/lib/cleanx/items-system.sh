# 系统包缓存与日志，全部需要 sudo。

apt_exists() { command -v apt-get >/dev/null 2>&1; }

measure_apt() {
  local size
  [[ -d /var/cache/apt/archives ]] || return 1
  size=$(du -sb -- /var/cache/apt/archives 2>/dev/null | awk '{print $1}')
  [[ -n $size ]] || return 1
  printf '%s\n' "$size"
}

clean_apt() { run_root_cmd apt-get clean; }

register_item sys.apt system 'APT 包缓存' \
  '已下载的 deb 安装包，删除后重装时重新下载' \
  func clean_apt measure_apt 1 1 apt_exists

journal_exists() { command -v journalctl >/dev/null 2>&1; }

measure_journal() {
  local out token
  out=$(LC_ALL=C journalctl --disk-usage 2>/dev/null) || return 1
  token=$(printf '%s\n' "$out" | grep -oE '[0-9]+(\.[0-9]+)?[KMGTP]?B?' | head -n1)
  [[ -n $token ]] || return 1
  human_to_bytes "$token"
}

clean_journal() { run_root_cmd journalctl --vacuum-time=14d; }

register_item sys.journal system '系统日志（保留 14 天）' \
  '清理 14 天前的 systemd journal，当前日志不动' \
  func clean_journal measure_journal 1 1 journal_exists

tmpfiles_exists() { command -v systemd-tmpfiles >/dev/null 2>&1; }

# 按发行版自带的 tmpfiles 规则清理，不自己拼 find /tmp -delete。
clean_tmp() { run_root_cmd systemd-tmpfiles --clean; }

register_item sys.tmp system '临时目录旧文件' \
  '按 systemd-tmpfiles 规则清理 /tmp；可能影响长期未退出的旧程序，默认不勾选' \
  func clean_tmp '' 1 0 tmpfiles_exists
