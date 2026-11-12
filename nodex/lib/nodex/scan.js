// 扫描 Node 工作区：包管理器、工作区里的包与各自的脚本，按行输出给 bash 读。
// 输出用 \x1f 分列：meta<FS>包管理器，pkg<FS>相对路径<FS>包名<FS>启动脚本<FS>构建脚本。
// 脚本列可以是空格分隔的多个名字，表示这个包有多个同义脚本；为空表示没有，不参与那一类动作。

const fs = require('fs')
const path = require('path')

const FS = '\x1f'
const root = path.resolve(process.argv[2] || '.')
// 锁文件与 packageManager 可能在工作区根上，扫描根只负责圈定这一轮看哪些包。
const pmRoot = path.resolve(process.argv[3] || root)

// 不往这些目录里找包：依赖、版本库与构建产物里就算有 package.json 也不是工作区成员。
const SKIP = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'coverage',
  '.next', '.nuxt', '.output', '.cache', '.idea', '.vscode',
])

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    return null
  }
}

function detectPM(pkg) {
  const roots = pmRoot === root ? [root] : [root, pmRoot]
  for (const dir of roots) {
    const own = dir === root ? pkg : readJson(path.join(dir, 'package.json'))
    const field = own && typeof own.packageManager === 'string' ? own.packageManager.split('@')[0].trim() : ''
    if (field === 'pnpm' || field === 'yarn' || field === 'npm') return field
  }
  // 装过依赖才有的痕迹，比锁文件更贴近实际：锁文件常常留着过时的那一份。
  for (const dir of roots) {
    const pm = installedPM(dir)
    if (pm) return pm
  }
  for (const dir of roots) {
    // 有多个锁文件时按 pnpm、yarn、npm 的先后取：pnpm 工程里常常也留着 npm 的旧锁。
    if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm'
    if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn'
    if (fs.existsSync(path.join(dir, 'package-lock.json'))) return 'npm'
  }
  return 'npm'
}

// node_modules 里留下的标记：npm 写 .package-lock.json，yarn 写 .yarn-integrity，pnpm 建 .pnpm。
const INSTALL_MARKERS = [
  ['.package-lock.json', 'npm'],
  ['.yarn-integrity', 'yarn'],
  ['.pnpm', 'pnpm'],
]

function installedPM(dir) {
  for (const [marker, pm] of INSTALL_MARKERS) {
    if (fs.existsSync(path.join(dir, 'node_modules', marker))) return pm
  }
  return ''
}

function patternsOf(pkg) {
  const out = []
  const ws = pkg && pkg.workspaces
  if (Array.isArray(ws)) out.push(...ws)
  else if (ws && Array.isArray(ws.packages)) out.push(...ws.packages)

  const yamlFile = path.join(root, 'pnpm-workspace.yaml')
  if (fs.existsSync(yamlFile)) {
    let inList = false
    for (const raw of fs.readFileSync(yamlFile, 'utf8').split('\n')) {
      const line = raw.replace(/\r$/, '')
      if (/^packages\s*:/.test(line)) {
        inList = true
        continue
      }
      if (!inList) continue
      const hit = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*(?:#.*)?$/)
      if (hit) out.push(hit[1].trim())
      else if (/^\S/.test(line)) inList = false
    }
  }
  return out.filter(Boolean)
}

// glob 只用到 *、** 与 ?：**/ 可以没有，** 跨层，* 与 ? 不跨目录分隔符。
function globRe(glob) {
  let body = ''
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]
    if (ch === '*' && glob[i + 1] === '*') {
      i++
      if (glob[i + 1] === '/') {
        i++
        body += '(?:.*/)?'
      } else {
        body += '.*'
      }
    } else if (ch === '*') {
      body += '[^/]*'
    } else if (ch === '?') {
      body += '[^/]'
    } else {
      body += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp('^' + body + '$')
}

function walk(dir, rel, out) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (err) {
    return
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP.has(entry.name)) continue
    const childRel = rel ? rel + '/' + entry.name : entry.name
    if (fs.existsSync(path.join(dir, entry.name, 'package.json'))) out.push(childRel)
    walk(path.join(dir, entry.name), childRel, out)
  }
}

// 一个包可能有多个同类脚本：精确名字优先，没有就收带冒号的变体（dev:pcsp-web 这种）。
function scriptsOf(scripts, names) {
  if (!scripts || typeof scripts !== 'object') return []
  for (const name of names) {
    if (typeof scripts[name] === 'string' && scripts[name].trim()) return [name]
  }
  const heads = names.map((name) => name + ':')
  return Object.keys(scripts)
    .filter((name) => {
      if (typeof scripts[name] !== 'string' || !scripts[name].trim()) return false
      return heads.some((head) => name.startsWith(head))
    })
    .sort()
}

const rootPkg = readJson(path.join(root, 'package.json'))
if (!rootPkg) {
  process.stderr.write('nodex: ' + root + ' 下没有 package.json\n')
  process.exit(1)
}

const pm = detectPM(rootPkg)
const patterns = patternsOf(rootPkg)
const includes = patterns.filter((p) => !p.startsWith('!')).map((p) => globRe(p.replace(/^\.\//, '')))
const excludes = patterns.filter((p) => p.startsWith('!')).map((p) => globRe(p.slice(1).replace(/^\.\//, '')))

const found = []
if (includes.length) {
  const dirs = []
  walk(root, '', dirs)
  for (const rel of dirs) {
    if (!includes.some((re) => re.test(rel))) continue
    if (excludes.some((re) => re.test(rel))) continue
    found.push(rel)
  }
}

// 根自己也算一个包：单包工程只有它，工作区根也可能带脚本。
if (!found.includes('.')) found.unshift('.')

const rows = []
for (const rel of found) {
  const pkg = rel === '.' ? rootPkg : readJson(path.join(root, rel, 'package.json'))
  if (!pkg) continue
  const name = typeof pkg.name === 'string' && pkg.name.trim() ? pkg.name.trim() : (rel === '.' ? path.basename(root) : rel)
  const dev = scriptsOf(pkg.scripts, ['dev', 'start', 'serve']).join(' ')
  const build = scriptsOf(pkg.scripts, ['build']).join(' ')
  rows.push([rel, name, dev, build])
}

// 根排最前，其余按路径排，页面上顺序稳定。
rows.sort((a, b) => (a[0] === '.' ? -1 : b[0] === '.' ? 1 : a[0].localeCompare(b[0])))

const lines = ['meta' + FS + pm]
for (const row of rows) lines.push(['pkg', ...row].join(FS))
process.stdout.write(lines.join('\n') + '\n')
