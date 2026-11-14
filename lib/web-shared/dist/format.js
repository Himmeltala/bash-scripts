// src/utils/format.js
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
function a(e) {
	if (!e) return "";
	let t = new Date(e);
	if (Number.isNaN(t.getTime())) return String(e).slice(0, 16);
	let n = (e) => String(e).padStart(2, "0");
	return `${t.getFullYear()}-${n(t.getMonth() + 1)}-${n(t.getDate())} ${n(t.getHours())}:${n(t.getMinutes())}`;
}
function o(e, t = Date.now()) {
	let n = Number(e);
	if (!n) return "";
	let r = Math.max(0, Math.floor(t / 1e3) - n);
	return r < 60 ? `${r} 秒前` : r < 3600 ? `${Math.floor(r / 60)} 分钟前` : r < 86400 ? `${Math.floor(r / 3600)} 小时前` : `${Math.floor(r / 86400)} 天前`;
}
function s(e, { units: t = [
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
var c = new Intl.NumberFormat("zh-CN"), l = new Intl.NumberFormat("zh-CN", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});
function u(e) {
	return c.format(Math.round(Number(e) || 0));
}
function d(e) {
	return e == null ? "--" : l.format(Number(e) || 0);
}
function f(e) {
	let t = Number(e) || 0;
	return t >= 1e9 ? `${(t / 1e9).toFixed(2)}B` : t >= 1e6 ? `${(t / 1e6).toFixed(2)}M` : t >= 1e3 ? `${(t / 1e3).toFixed(1)}K` : u(t);
}
export { e as baseName, t as dirName, i as firstLine, o as formatAgo, s as formatBytes, f as formatCompact, a as formatDateTime, d as formatMoney, u as formatNumber, n as shortPath, r as shortenPath };
