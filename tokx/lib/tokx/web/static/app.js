"use strict";

// 页面只管画：数据全部来自 /api/usage，口径与 tokx --json 一致。
// 自动刷新由浏览器定时发请求，服务端每轮现扫，不用长连接。

const SOURCE_NAMES = { claude: "Claude Code", opencode: "opencode", dsh: "DeepSeek Harness" };
const SOURCE_MARKS = { claude: "C", opencode: "O", dsh: "D" };
// 每列：标题、取值、是否右对齐、合计怎么来。
const COLUMNS = {
  daily: [
    { key: "source", label: "来源", width: 9 },
    { key: "origin", label: "出处", width: 6 },
    { key: "date", label: "日期", width: 10 },
    { key: "model", label: "模型", width: 22 },
    { key: "api", label: "API 地址", width: 15 },
    { key: "requests", label: "请求", num: true },
    { key: "input", label: "输入", num: true },
    { key: "cache_read", label: "缓存读", num: true },
    { key: "output", label: "输出", num: true },
    { key: "total_tokens", label: "总 token", num: true },
    { key: "cost_peak", label: "高峰费用", money: true },
    { key: "cost_off", label: "空闲费用", money: true },
    { key: "cost", label: "合计", money: true, strong: true },
  ],
  session: [
    { key: "source", label: "来源", width: 9 },
    { key: "origin", label: "出处", width: 6 },
    { key: "session", label: "会话", width: 11, mono: true },
    { key: "project", label: "项目", width: 12 },
    { key: "start", label: "开始", width: 12 },
    { key: "end", label: "结束", width: 12 },
    { key: "model", label: "模型", width: 20 },
    { key: "api", label: "API 地址", width: 15 },
    { key: "requests", label: "请求", num: true },
    { key: "input", label: "输入", num: true },
    { key: "cache_read", label: "缓存读", num: true },
    { key: "output", label: "输出", num: true },
    { key: "total_tokens", label: "总 token", num: true },
    { key: "cost_peak", label: "高峰费用", money: true },
    { key: "cost_off", label: "空闲费用", money: true },
    { key: "cost", label: "合计", money: true, strong: true },
  ],
  hour: [
    { key: "slot", label: "小时", width: 8 },
    { key: "label", label: "时段", width: 12 },
    { key: "model", label: "模型", width: 22 },
    { key: "api", label: "API 地址", width: 15 },
    { key: "requests", label: "请求", num: true },
    { key: "input", label: "输入", num: true },
    { key: "cache_read", label: "缓存读", num: true },
    { key: "output", label: "输出", num: true },
    { key: "total_tokens", label: "总 token", num: true },
    { key: "cost_peak", label: "高峰费用", money: true },
    { key: "cost_off", label: "空闲费用", money: true },
    { key: "cost", label: "合计", money: true, strong: true },
  ],
};
// hour 报表没有按天图表，按天图表只在 daily 下画。
const MONEY_KEYS = new Set(COLUMNS.daily.filter((c) => c.money).map((c) => c.key));

const el = (id) => document.getElementById(id);
const state = { sort: null, desc: true, data: null, timer: 0, busy: false };

const nf = new Intl.NumberFormat("zh-CN");
const cf = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (v) => nf.format(Math.round(Number(v) || 0));
const fmtMoney = (v) => cf.format(Number(v) || 0);
const fmtTokens = (v) => {
  const n = Number(v) || 0;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return fmtNum(n);
};

function query() {
  const params = new URLSearchParams();
  params.set("command", el("command").value);
  const range = el("range").value;
  if (range === "custom") {
    if (el("since").value) params.set("since", el("since").value);
    if (el("until").value) params.set("until", el("until").value);
  } else if (range === "all") {
    // 全部历史不带窗口，与命令行的 --all 一致。
  } else {
    params.set("days", range);
  }
  const sources = [...document.querySelectorAll("#sources input:checked")].map((box) => box.value);
  if (sources.length && sources.length < Object.keys(SOURCE_NAMES).length) params.set("source", sources.join(","));
  return params.toString();
}

async function load() {
  if (state.busy) return;
  state.busy = true;
  el("stamp").textContent = "正在读取…";
  try {
    const res = await fetch(`/api/usage?${query()}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || res.statusText);
    state.data = data;
    render(data);
    el("stamp").textContent = `刷新于 ${data.now.replace("T", " ")} · ${data.timezone}`;
  } catch (err) {
    el("stamp").textContent = "读取失败";
    showNotice(`读取失败：${err.message}`);
  } finally {
    state.busy = false;
  }
}

function showNotice(text) {
  const box = el("notice");
  box.textContent = text || "";
  box.hidden = !text;
}

function render(data) {
  const command = data.command;
  const rows = sorted(data.rows);
  showNotice(data.unpriced_models && data.unpriced_models.length
    ? `这些模型没有价格，只算 token 不算钱：${data.unpriced_models.join("、")}`
    : "");
  renderCards(data.totals);
  renderTable(command, rows, data.totals);
  renderChartDay(data);
  el("charts").hidden = false;
  el("chart-hour-box").hidden = command !== "hour";
  el("chart-slot-box").hidden = command !== "hour";
  if (command === "hour") {
    renderChartClock(data.rows);
    renderChartHour(data);
  }
}

function sorted(rows) {
  if (!state.sort) return rows;
  const { key, text } = state.sort;
  const sign = state.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (text) return sign * String(a[key] || "").localeCompare(String(b[key] || ""), "zh-CN");
    return sign * ((Number(a[key]) || 0) - (Number(b[key]) || 0));
  });
}

function renderCards(totals) {
  const cards = [
    ["请求", fmtNum(totals.requests)],
    ["总 token", fmtTokens(totals.total_tokens)],
    ["高峰费用", `¥${fmtMoney(totals.cost_peak)}`],
    ["空闲费用", `¥${fmtMoney(totals.cost_off)}`],
    ["合计", `¥${fmtMoney(totals.cost)}`, true],
  ];
  el("cards").replaceChildren(...cards.map(([label, value, strong]) => {
    const box = document.createElement("div");
    box.className = strong ? "card strong" : "card";
    box.innerHTML = `<span class="k">${label}</span><span class="v">${value}</span>`;
    if (totals.unpriced) box.title = `另有 ${fmtNum(totals.unpriced)} 个请求所在模型没有登记价格`;
    return box;
  }));
}

function cellValue(col, value) {
  if (col.key === "source") return SOURCE_NAMES[value] || value || "-";
  if (col.key === "origin") return value === "cache" ? "缓存" : "现扫";
  if (col.money) return fmtMoney(value);
  if (col.num) return fmtNum(value);
  return value === "" || value == null ? "-" : String(value);
}

function renderTable(command, rows, totals) {
  const cols = COLUMNS[command];
  const thead = el("table").querySelector("thead");
  const tbody = el("table").querySelector("tbody");
  const tfoot = el("table").querySelector("tfoot");

  const headRow = document.createElement("tr");
  for (const col of cols) {
    const th = document.createElement("th");
    th.textContent = col.label;
    if (col.num || col.money) th.className = "num";
    if (state.sort && state.sort.key === col.key) th.classList.add(state.desc ? "desc" : "asc");
    th.addEventListener("click", () => {
      if (state.sort && state.sort.key === col.key) state.desc = !state.desc;
      else state.sort = { key: col.key, text: !(col.num || col.money) };
      if (state.data) renderTable(state.data.command, sorted(state.data.rows), state.data.totals);
    });
    headRow.append(th);
  }
  thead.replaceChildren(headRow);

  const cells = (row) => cols.map((col) => {
    const td = document.createElement("td");
    if (col.num || col.money) td.className = "num";
    if (col.strong) td.classList.add("strong");
    if (col.mono) td.className = "mono";
    if (col.width) td.style.maxWidth = `${col.width}rem`;
    if (col.key === "source") {
      // 来源用缩写标记加全名，窄窗口下也不会把后面的列挤掉。
      const short = { claude: "Claude", opencode: "oc", dsh: "Harness" }[row.source] || row.source || "-";
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.textContent = SOURCE_MARKS[row.source] || "?";
      td.append(mark, short);
      td.title = SOURCE_NAMES[row.source] || row.source;
    } else {
      td.textContent = cellValue(col, row[col.key]);
      if (col.key === "api") td.title = row.api || "";
    }
    return td;
  });

  tbody.replaceChildren(...rows.map((row) => {
    const tr = document.createElement("tr");
    if (row.origin === "cache") tr.className = "cached";
    if (row.unpriced) tr.title = "这一行里有模型没有登记价格";
    tr.append(...cells(row));
    return tr;
  }));

  if (rows.length < 2) {
    tfoot.replaceChildren();
    return;
  }
  const tr = document.createElement("tr");
  for (const col of cols) {
    const td = document.createElement("th");
    if (col.num || col.money) td.className = "num";
    if (col === cols[0]) td.textContent = "合计";
    else if (MONEY_KEYS.has(col.key) || col.num) td.textContent = cellValue(col, totals[col.key]);
    tr.append(td);
  }
  tfoot.replaceChildren(tr);
}

// 只有按天报表才有日期，另外两种报表的按天图没有意义，直接收起。
function renderChartDay(data) {
  const svg = el("chart-day");
  const box = svg.closest("figure");
  const show = data.command === "daily";
  box.hidden = !show;
  if (!show) return;
  svg.replaceChildren();
  const byDay = new Map();
  for (const row of data.rows) {
    byDay.set(row.date, (byDay.get(row.date) || 0) + (Number(row.cost) || 0));
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  drawBars(svg, days, "天");
}

function renderChartHour(data) {
  const svg = el("chart-hour");
  svg.replaceChildren();
  const byHour = new Map();
  for (const row of data.rows) {
    byHour.set(row.slot, (byHour.get(row.slot) || 0) + (Number(row.cost) || 0));
  }
  const hours = [...byHour.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  drawBars(svg, hours, "时");
}

// 24 个小时各自的合计，高峰窗口用另一种颜色，一眼看清钱堆在哪些点钟。
// 时段以行自带的高峰/空闲标记为准，没计价的行也算进柱高，只按它所在的时段上色。
function renderChartClock(rows) {
  const svg = el("chart-clock");
  svg.replaceChildren();
  const sums = Array.from({ length: 24 }, () => ({ cost: 0, tokens: 0, peak: false }));
  for (const row of rows) {
    const slot = sums[row.hour];
    if (!slot) continue;
    slot.cost += Number(row.cost) || 0;
    slot.tokens += Number(row.total_tokens) || 0;
    if (row.label === "高峰窗口") slot.peak = true;
  }
  const pairs = sums.map((slot, hour) => [
    `${String(hour).padStart(2, "0")}:00`,
    slot.cost,
    slot.peak ? "peak" : "off",
    slot.tokens,
  ]);
  drawBars(svg, pairs, "时");
}

// 纯 SVG 柱状图，不引第三方图表库；viewBox 固定，自适应宽度。
function drawBars(svg, pairs, unit) {
  const W = 900;
  const H = 220;
  const pad = { left: 8, right: 8, top: 18, bottom: 22 };
  if (!pairs.length) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", W / 2);
    text.setAttribute("y", H / 2);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "axis");
    text.textContent = "没有数据";
    svg.append(text);
    return;
  }
  const max = Math.max(...pairs.map(([, v]) => v), 0.000001);
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const slot = innerW / pairs.length;
  const barW = Math.max(1, Math.min(28, slot * 0.62));
  // 标签太密时隔几个画一个。
  const stride = Math.ceil(pairs.length / Math.max(1, Math.floor(innerW / 46)));

  pairs.forEach(([label, value, kind, tokens], index) => {
    const height = Math.max(value > 0 ? 1.5 : 0, (value / max) * innerH);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", (pad.left + index * slot + (slot - barW) / 2).toFixed(1));
    rect.setAttribute("y", (pad.top + innerH - height).toFixed(1));
    rect.setAttribute("width", barW.toFixed(1));
    rect.setAttribute("height", height.toFixed(1));
    rect.setAttribute("rx", "2");
    if (kind) rect.setAttribute("class", kind);
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = tokens == null
      ? `${label}　¥${fmtMoney(value)}`
      : `${label}　¥${fmtMoney(value)}　${fmtTokens(tokens)} token`;
    rect.append(title);
    svg.append(rect);

    if (index % stride === 0 || index === pairs.length - 1) {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", (pad.left + index * slot + slot / 2).toFixed(1));
      text.setAttribute("y", H - 6);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("class", "axis");
      text.textContent = unit === "天" ? label.slice(5) : label;
      svg.append(text);
    }
  });

  const top = document.createElementNS("http://www.w3.org/2000/svg", "text");
  top.setAttribute("x", pad.left);
  top.setAttribute("y", 12);
  top.setAttribute("class", "axis");
  top.textContent = `最高 ¥${fmtMoney(max)}`;
  svg.append(top);
}

function syncRange() {
  el("custom").hidden = el("range").value !== "custom";
}

function schedule() {
  clearInterval(state.timer);
  const every = Number(el("every").value) || 0;
  if (every > 0) state.timer = setInterval(() => {
    if (document.hidden) return;
    load();
  }, every * 1000);
}

el("command").addEventListener("change", () => {
  state.sort = null;
  load();
});
el("range").addEventListener("change", () => {
  syncRange();
  load();
});
for (const input of document.querySelectorAll("#since, #until")) input.addEventListener("change", load);
for (const box of document.querySelectorAll("#sources input")) box.addEventListener("change", load);
el("every").addEventListener("change", schedule);
el("refresh").addEventListener("click", load);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) load();
});

// 地址里带 command、range、source 时按它打开，方便把看板链接直接发给别人或收藏。
function restore() {
  const params = new URLSearchParams(location.search);
  const command = params.get("command");
  if (command && COLUMNS[command]) el("command").value = command;
  const range = params.get("range");
  if (range) el("range").value = range;
  else if (params.get("days")) el("range").value = params.get("days");
  if (el("range").value === "custom") {
    el("since").value = params.get("since") || "";
    el("until").value = params.get("until") || "";
  }
  const sources = (params.get("source") || "").split(",").filter(Boolean);
  if (sources.length) {
    for (const box of document.querySelectorAll("#sources input")) box.checked = sources.includes(box.value);
  }
}

restore();
syncRange();
schedule();
load();
