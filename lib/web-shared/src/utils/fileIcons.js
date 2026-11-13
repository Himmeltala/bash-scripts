// 文件图标按文件名与扩展名映射：图标取自 MDI，颜色仿常见编辑器的语言配色。

const DEFAULT = { icon: 'mdi-file-outline', color: '' }

// 少数文件名比扩展名更能说明类型，先按整个名字查。
const BY_NAME = {
  'package.json': { icon: 'mdi-npm', color: '#cb3837' },
  'package-lock.json': { icon: 'mdi-npm', color: '#cb3837' },
  dockerfile: { icon: 'mdi-docker', color: '#2496ed' },
  makefile: { icon: 'mdi-hammer-wrench', color: '#8d6e63' },
  '.gitignore': { icon: 'mdi-git', color: '#f14e32' },
  '.gitattributes': { icon: 'mdi-git', color: '#f14e32' },
  '.gitmodules': { icon: 'mdi-git', color: '#f14e32' },
  'pom.xml': { icon: 'mdi-xml', color: '#e37933' },
}

const BY_EXT = {
  js: { icon: 'mdi-language-javascript', color: '#f1e05a' },
  mjs: { icon: 'mdi-language-javascript', color: '#f1e05a' },
  cjs: { icon: 'mdi-language-javascript', color: '#f1e05a' },
  jsx: { icon: 'mdi-react', color: '#61dafb' },
  ts: { icon: 'mdi-language-typescript', color: '#3178c6' },
  tsx: { icon: 'mdi-react', color: '#61dafb' },
  vue: { icon: 'mdi-vuejs', color: '#41b883' },
  html: { icon: 'mdi-language-html5', color: '#e34f26' },
  htm: { icon: 'mdi-language-html5', color: '#e34f26' },
  xml: { icon: 'mdi-xml', color: '#e37933' },
  svg: { icon: 'mdi-file-image-outline', color: '#ffb13b' },
  css: { icon: 'mdi-language-css3', color: '#42a5f5' },
  scss: { icon: 'mdi-sass', color: '#cf649a' },
  sass: { icon: 'mdi-sass', color: '#cf649a' },
  less: { icon: 'mdi-language-css3', color: '#1d365d' },
  json: { icon: 'mdi-code-json', color: '#cbcb41' },
  md: { icon: 'mdi-language-markdown', color: '#519aba' },
  markdown: { icon: 'mdi-language-markdown', color: '#519aba' },
  py: { icon: 'mdi-language-python', color: '#3572a5' },
  java: { icon: 'mdi-language-java', color: '#b07219' },
  yml: { icon: 'mdi-file-cog-outline', color: '#cb171e' },
  yaml: { icon: 'mdi-file-cog-outline', color: '#cb171e' },
  toml: { icon: 'mdi-file-cog-outline', color: '#9e9e9e' },
  ini: { icon: 'mdi-file-cog-outline', color: '#9e9e9e' },
  conf: { icon: 'mdi-file-cog-outline', color: '#9e9e9e' },
  properties: { icon: 'mdi-file-cog-outline', color: '#9e9e9e' },
  env: { icon: 'mdi-file-cog-outline', color: '#9e9e9e' },
  sh: { icon: 'mdi-bash', color: '#89e051' },
  bash: { icon: 'mdi-bash', color: '#89e051' },
  zsh: { icon: 'mdi-bash', color: '#89e051' },
  sql: { icon: 'mdi-database', color: '#e38c00' },
  png: { icon: 'mdi-file-image-outline', color: '#26a69a' },
  jpg: { icon: 'mdi-file-image-outline', color: '#26a69a' },
  jpeg: { icon: 'mdi-file-image-outline', color: '#26a69a' },
  gif: { icon: 'mdi-file-image-outline', color: '#26a69a' },
  webp: { icon: 'mdi-file-image-outline', color: '#26a69a' },
  bmp: { icon: 'mdi-file-image-outline', color: '#26a69a' },
  ico: { icon: 'mdi-file-image-outline', color: '#26a69a' },
  pdf: { icon: 'mdi-file-pdf-box', color: '#e53935' },
  zip: { icon: 'mdi-zip-box-outline', color: '#afb42b' },
  gz: { icon: 'mdi-zip-box-outline', color: '#afb42b' },
  tar: { icon: 'mdi-zip-box-outline', color: '#afb42b' },
  rar: { icon: 'mdi-zip-box-outline', color: '#afb42b' },
  '7z': { icon: 'mdi-zip-box-outline', color: '#afb42b' },
  doc: { icon: 'mdi-file-word-outline', color: '#2b579a' },
  docx: { icon: 'mdi-file-word-outline', color: '#2b579a' },
  xls: { icon: 'mdi-file-excel-outline', color: '#217346' },
  xlsx: { icon: 'mdi-file-excel-outline', color: '#217346' },
  csv: { icon: 'mdi-file-table-outline', color: '#217346' },
  ppt: { icon: 'mdi-file-powerpoint-outline', color: '#d24726' },
  pptx: { icon: 'mdi-file-powerpoint-outline', color: '#d24726' },
  txt: { icon: 'mdi-file-document-outline', color: '#90a4ae' },
  log: { icon: 'mdi-file-document-outline', color: '#90a4ae' },
  lock: { icon: 'mdi-lock-outline', color: '#9e9e9e' },
  ttf: { icon: 'mdi-format-font', color: '#7e57c2' },
  otf: { icon: 'mdi-format-font', color: '#7e57c2' },
  woff: { icon: 'mdi-format-font', color: '#7e57c2' },
  woff2: { icon: 'mdi-format-font', color: '#7e57c2' },
  mp3: { icon: 'mdi-file-music-outline', color: '#ab47bc' },
  wav: { icon: 'mdi-file-music-outline', color: '#ab47bc' },
  mp4: { icon: 'mdi-file-video-outline', color: '#5c6bc0' },
  avi: { icon: 'mdi-file-video-outline', color: '#5c6bc0' },
  mov: { icon: 'mdi-file-video-outline', color: '#5c6bc0' },
  mkv: { icon: 'mdi-file-video-outline', color: '#5c6bc0' },
}

export function fileIcon(name) {
  const base = String(name || '')
    .split('/')
    .pop()
    .toLowerCase()
  const exact = BY_NAME[base]
  if (exact) return exact
  const dot = base.lastIndexOf('.')
  if (dot < 0) return DEFAULT
  return BY_EXT[base.slice(dot + 1)] || DEFAULT
}
