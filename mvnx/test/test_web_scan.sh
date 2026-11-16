#!/usr/bin/env bash
# 网页扫描回归：单体项目也要出 install 服务，聚合项目只列子模块。
set -uo pipefail

repo=$(cd "${BASH_SOURCE[0]%/*}/.." && pwd)
fail=0
ok() { printf 'ok - %s\n' "$*"; }
bad() { printf 'FAIL - %s\n' "$*" >&2; fail=1; }

td=$(mktemp -d)
trap 'rm -rf "$td"' EXIT

mkdir -p "$td/standalone" "$td/agg/m1"
cat > "$td/standalone/pom.xml" <<'EOF'
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>demo</groupId>
  <artifactId>demo-standalone</artifactId>
  <version>1.0.0</version>
</project>
EOF
cat > "$td/agg/pom.xml" <<'EOF'
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>demo</groupId>
  <artifactId>demo-parent</artifactId>
  <version>1.0.0</version>
  <packaging>pom</packaging>
  <modules>
    <module>m1</module>
  </modules>
</project>
EOF
cat > "$td/agg/m1/pom.xml" <<'EOF'
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>demo</groupId>
  <artifactId>demo-m1</artifactId>
  <version>1.0.0</version>
</project>
EOF

scan() {
  bash -c 'source "$1/lib/mvnx-core.sh"; web_scan ws1 "$2"' _ "$repo" "$1"
}

# 服务行的第二列是服务 id，第一条是类型。
has_service() {
  awk -F $'\x1f' -v id="$2" '$1 == "svc" && $2 == id { found = 1 } END { exit !found }' <<<"$1"
}

standalone=$(scan "$td/standalone")
has_service "$standalone" 'ws1.install.demo-standalone' \
  && ok '单体项目出 install 服务' || bad '单体项目没有 install 服务'

agg=$(scan "$td/agg")
has_service "$agg" 'ws1.install.demo-parent/demo-m1' \
  && ok '聚合项目的子模块出 install 服务' || bad '聚合项目的子模块没有 install 服务'
has_service "$agg" 'ws1.install.demo-parent' \
  && bad '聚合项目本身不该出 install 服务' || ok '聚合项目本身不出 install 服务'

((fail)) && exit 1
printf '全部通过\n'
