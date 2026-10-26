# 会话扫描：把 ~/.claude/projects 下的正文与关联数据收成平行数组，按修改时间倒序。

declare -a S_ID=()
declare -a S_PROJECT=()
declare -a S_CWD=()
declare -a S_TITLE=()
declare -a S_MTIME=()
declare -a S_SIZE=()
declare -a S_ACTIVE=()
declare -a S_PATH=()
declare -a S_SDIR=()
declare -a S_HIST=()
declare -a S_ENV=()
declare -A S_INDEX=()

declare -A ACTIVE_IDS=()
SESSION_MATCHES=()
SESSION_PICKED=''
S_CUR=-1

json_field() {
  local file=$1 key=$2
  grep -m1 -o "\"${key}\":\"[^\"]*\"" "$file" 2>/dev/null | head -n1 | cut -d'"' -f4
}

# 只认 UUID 形态的会话 id，防止以后目录里出现奇怪的 jsonl 被拿来拼路径。
session_id_safe() {
  [[ $1 =~ ^[0-9a-fA-F][0-9a-fA-F-]{7,}$ ]]
}

# 运行中的会话以 sessions/*.json 里的 pid 为准，并要求进程命令行含 claude，避免 pid 复用误判。
session_active_ids() {
  local f id pid cmd
  ACTIVE_IDS=()
  for f in "${CLAUDE_ROOT}"/sessions/*.json; do
    [[ -f $f ]] || continue
    id=$(grep -m1 -o '"sessionId"[[:space:]]*:[[:space:]]*"[^"]*"' "$f" 2>/dev/null | cut -d'"' -f4)
    pid=$(grep -m1 -o '"pid"[[:space:]]*:[[:space:]]*[0-9]*' "$f" 2>/dev/null | grep -o '[0-9]*$')
    [[ -n $id && -n $pid ]] || continue
    kill -0 "$pid" 2>/dev/null || continue
    cmd=$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null) || continue
    [[ $cmd == *claude* ]] || continue
    ACTIVE_IDS[$id]=1
  done
}

# scope 为 all 时扫全部；为 current 时只留 cwd 等于当前目录的会话。
session_scan() {
  local scope=${1:-all}
  local want_cwd=''
  local proj_dir file id cwd cwd_cmp title mtime size sdir hist env part sz
  local -a t_id=() t_project=() t_cwd=() t_title=() t_mtime=() t_size=()
  local -a t_active=() t_path=() t_sdir=() t_hist=() t_env=()
  local -a order=()

  S_ID=(); S_PROJECT=(); S_CWD=(); S_TITLE=(); S_MTIME=(); S_SIZE=()
  S_ACTIVE=(); S_PATH=(); S_SDIR=(); S_HIST=(); S_ENV=()
  S_INDEX=()
  S_CUR=-1

  [[ $scope == current ]] && want_cwd=$(realpath -m -- "$PWD")
  session_active_ids

  for proj_dir in "${SESSION_ROOT}"/*/; do
    [[ -d $proj_dir ]] || continue
    proj_dir=${proj_dir%/}
    for file in "$proj_dir"/*.jsonl; do
      [[ -f $file ]] || continue
      id=${file##*/}
      id=${id%.jsonl}
      session_id_safe "$id" || continue
      cwd=$(json_field "$file" cwd)
      title=$(json_field "$file" aiTitle)
      [[ -n $title ]] || title=${id:0:8}

      sdir="${proj_dir}/${id}"
      [[ -d $sdir ]] || sdir=''
      hist="${CLAUDE_ROOT}/file-history/${id}"
      [[ -d $hist ]] || hist=''
      env="${CLAUDE_ROOT}/session-env/${id}"
      [[ -d $env ]] || env=''

      sz=$(stat -c %s -- "$file" 2>/dev/null) || sz=0
      for part in "$sdir" "$hist" "$env"; do
        [[ -n $part ]] || continue
        size=$(du -sb -- "$part" 2>/dev/null | awk '{print $1}')
        [[ -n $size ]] && sz=$((sz + size))
      done
      mtime=$(stat -c %Y -- "$file" 2>/dev/null) || mtime=0

      if [[ $scope == current ]]; then
        cwd_cmp=$(realpath -m -- "$cwd" 2>/dev/null) || cwd_cmp=$cwd
        [[ -n $cwd && $cwd_cmp == "$want_cwd" ]] || continue
      fi

      t_id+=("$id")
      t_project+=("${proj_dir##*/}")
      t_cwd+=("$cwd")
      t_title+=("$title")
      t_mtime+=("$mtime")
      t_size+=("$sz")
      if [[ -n ${ACTIVE_IDS[$id]:-} ]]; then t_active+=(1); else t_active+=(0); fi
      t_path+=("$file")
      t_sdir+=("$sdir")
      t_hist+=("$hist")
      t_env+=("$env")
    done
  done

  if ((${#t_id[@]})); then
    while IFS=$'\t' read -r _mtime idx_tmp; do
      order+=("$idx_tmp")
    done < <(
      for idx_tmp in "${!t_id[@]}"; do
        printf '%s\t%s\n' "${t_mtime[$idx_tmp]}" "$idx_tmp"
      done | sort -rn -k1,1
    )
  fi

  local i
  for i in "${order[@]}"; do
    S_INDEX[${t_id[$i]}]=${#S_ID[@]}
    S_ID+=("${t_id[$i]}")
    S_PROJECT+=("${t_project[$i]}")
    S_CWD+=("${t_cwd[$i]}")
    S_TITLE+=("${t_title[$i]}")
    S_MTIME+=("${t_mtime[$i]}")
    S_SIZE+=("${t_size[$i]}")
    S_ACTIVE+=("${t_active[$i]}")
    S_PATH+=("${t_path[$i]}")
    S_SDIR+=("${t_sdir[$i]}")
    S_HIST+=("${t_hist[$i]}")
    S_ENV+=("${t_env[$i]}")
  done
  ((${#S_ID[@]}))
}

session_index_of() {
  local id=$1
  [[ -n ${S_INDEX[$id]:-} ]] || return 1
  S_CUR=${S_INDEX[$id]}
  return 0
}

# 前缀至少 4 位；精确命中优先，多个前缀命中时报歧义并列出候选。
session_match_prefix() {
  local prefix=$1 i id
  SESSION_MATCHES=()
  SESSION_PICKED=''
  ((${#prefix} >= 4)) || usage_error "会话 id 前缀至少 4 位：$prefix"

  for i in "${!S_ID[@]}"; do
    id=${S_ID[$i]}
    if [[ $id == "$prefix" ]]; then
      SESSION_PICKED=$id
      return 0
    fi
  done
  for i in "${!S_ID[@]}"; do
    id=${S_ID[$i]}
    [[ $id == "$prefix"* ]] && SESSION_MATCHES+=("$id")
  done

  case ${#SESSION_MATCHES[@]} in
    0) usage_error "找不到会话 $prefix" ;;
    1) SESSION_PICKED=${SESSION_MATCHES[0]} ;;
    *)
      warn "会话前缀 $prefix 匹配到多个："
      printf '  %s\n' "${SESSION_MATCHES[@]}" >&2
      return 2
      ;;
  esac
}

session_is_active() { [[ -n ${ACTIVE_IDS[$1]:-} ]]; }
