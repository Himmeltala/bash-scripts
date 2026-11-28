#!/usr/bin/env bash
# deps: LibreOffice（writer/calc/impress）与中文字体，Office 预览需要
# 幂等：已经能执行 soffice 就跳过。
set -euo pipefail

info() { printf '%s\n' "$*"; }
die() { printf '错误: %s\n' "$*" >&2; exit 1; }

if command -v soffice >/dev/null 2>&1; then
  info 'LibreOffice 已安装，跳过'
  soffice --version 2>/dev/null | head -1 || true
  exit 0
fi

sudo_cmd=()
if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  command -v sudo >/dev/null 2>&1 || die '需要 root 权限安装 LibreOffice，但没有 sudo'
  sudo_cmd=(sudo)
fi

if command -v apt-get >/dev/null 2>&1; then
  info '用 apt 安装 LibreOffice 与中文字体'
  "${sudo_cmd[@]}" env DEBIAN_FRONTEND=noninteractive apt-get update -qq
  "${sudo_cmd[@]}" env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    libreoffice-writer libreoffice-calc libreoffice-impress fonts-noto-cjk
elif command -v dnf >/dev/null 2>&1; then
  info '用 dnf 安装 LibreOffice 与中文字体'
  "${sudo_cmd[@]}" dnf install -y libreoffice-writer libreoffice-calc libreoffice-impress \
    google-noto-sans-cjk-fonts
elif command -v pacman >/dev/null 2>&1; then
  info '用 pacman 安装 LibreOffice 与中文字体'
  "${sudo_cmd[@]}" pacman -S --needed --noconfirm libreoffice-fresh noto-fonts-cjk
else
  die '没有 apt-get、dnf 或 pacman，请手动安装 LibreOffice'
fi

command -v soffice >/dev/null 2>&1 || die '装完仍找不到 soffice'
soffice --version 2>/dev/null | head -1
info 'LibreOffice 安装完成'
