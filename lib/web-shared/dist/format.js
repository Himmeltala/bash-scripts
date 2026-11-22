// src/utils/commons/format.js
function e(e) {
	let t = String(e || ""), n = t.split("/").filter(Boolean);
	return n.length ? n[n.length - 1] : t;
}
function t(e) {
	let t = String(e || "").split("/");
	return t.pop(), t.join("/");
}
function n(e) {
	return String(e || "").replace(/^\/+/, "");
}
function r(e, t = 42) {
	let n = String(e || "");
	if (n.length <= t) return n;
	let r = t - 1, i = Math.ceil(r / 3), a = r - i;
	return n.slice(0, i) + "…" + n.slice(-a);
}
function i(e) {
	return String(e || "").split("\n").find((e) => e.trim()) || "（没有写提交说明）";
}
function a(e, t = !1) {
	if (!e) return "";
	let n = new Date(e);
	if (Number.isNaN(n.getTime())) return String(e).slice(0, 16);
	let r = (e) => String(e).padStart(2, "0"), i = `${r(n.getHours())}:${r(n.getMinutes())}` + (t ? `:${r(n.getSeconds())}` : "");
	return `${n.getFullYear()}-${r(n.getMonth() + 1)}-${r(n.getDate())} ${i}`;
}
function o(e, { unit: t = "ms", seconds: n = !0, fallback: r = "" } = {}) {
	let i = Number(e);
	return !Number.isFinite(i) || i <= 0 ? r : a(new Date(t === "s" ? i * 1e3 : i), n);
}
function s(e, { unit: t = "s", seconds: n = !0, fallback: r = "" } = {}) {
	let i = Number(e);
	if (!Number.isFinite(i) || i <= 0) return r;
	let a = new Date(t === "s" ? i * 1e3 : i);
	if (Number.isNaN(a.getTime())) return r;
	let o = (e) => String(e).padStart(2, "0");
	return `${o(a.getHours())}:${o(a.getMinutes())}${n ? `:${o(a.getSeconds())}` : ""}`;
}
function c(e) {
	if (!e) return "";
	let t = e instanceof Date ? e : new Date(e);
	if (Number.isNaN(t.getTime())) return "";
	let n = (e) => String(e).padStart(2, "0");
	return `${t.getFullYear()}-${n(t.getMonth() + 1)}-${n(t.getDate())}`;
}
function l(e = /* @__PURE__ */ new Date()) {
	let t = new Date(e);
	return t.setDate(t.getDate() - (t.getDay() + 6) % 7), t;
}
function u(e, t = Date.now()) {
	let n = Number(e);
	if (!n) return "";
	let r = Math.max(0, Math.floor(t / 1e3) - n);
	return r < 60 ? `${r} 秒前` : r < 3600 ? `${Math.floor(r / 60)} 分钟前` : r < 86400 ? `${Math.floor(r / 3600)} 小时前` : `${Math.floor(r / 86400)} 天前`;
}
function d(e, { units: t = [
	"B",
	"KB",
	"MB"
], precision: n = [
	0,
	1,
	2
], base: r = 1024 } = {}) {
	let i = Number(e) || 0, a = 0;
	for (; a < t.length - 1 && i >= r ** (a + 1);) a += 1;
	return `${(i / r ** a).toFixed(n[a] ?? 0)} ${t[a]}`;
}
var f = new Intl.NumberFormat("zh-CN"), p = new Intl.NumberFormat("zh-CN", {
	minimumFractionDigits: 4,
	maximumFractionDigits: 4
});
function m(e) {
	return f.format(Math.round(Number(e) || 0));
}
function h(e) {
	return e == null ? "--" : p.format(Number(e) || 0);
}
function g(e) {
	let t = Number(e) || 0;
	return t >= 1e8 ? `${(t / 1e8).toFixed(2)}亿` : t >= 1e4 ? `${(t / 1e4).toFixed(1)}万` : m(t);
}
export { e as baseName, t as dirName, i as firstLine, u as formatAgo, d as formatBytes, s as formatClock, g as formatCompact, c as formatDate, a as formatDateTime, h as formatMoney, m as formatNumber, o as formatTimestamp, n as shortPath, r as shortenPath, l as startOfWeek };
