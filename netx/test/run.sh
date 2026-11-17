#!/usr/bin/env bash
# 跑 netx 的单元测试；不需要 root，也不碰真实流量。
set -uo pipefail

repo=$(cd "${BASH_SOURCE[0]%/*}/../.." && pwd)
cd "$repo" || exit 1
exec python3 -m unittest discover -s netx/test -p 'test_*.py' -v
