// src/utils/logColor.js
var e = "\x1B[0m";
function t(t, n) {
	return `\u001b[${t}m${n}${e}`;
}
function n({ rules: e = [], skipAnsi: n = !1 } = {}) {
	function r(e, n) {
		if (typeof e == "function") return e(n);
		if (e.match) {
			let r = e.match.exec(n);
			return r ? e.render ? e.render(r, n) : t(e.color, n) : null;
		}
		if (e.test) {
			let r = typeof e.test == "function" ? e.test(n) : e.test.test(n);
			return r ? e.render ? e.render(r, n) : t(typeof e.color == "function" ? e.color(n) : e.color, n) : null;
		}
		return null;
	}
	function i(t) {
		if (!t || n && t.includes("\x1B")) return t;
		for (let n of e) {
			let e = r(n, t);
			if (e != null) return e;
		}
		return t;
	}
	return (e) => e ? e.split("\n").map(i).join("\n") : "";
}
export { e as RESET, n as createLogColorizer, t as paint };
