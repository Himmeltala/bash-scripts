function e(e, t) {
	return `\u001b[${e}m${t}[0m`;
}
function t({ rules: t = [], skipAnsi: n = !1 } = {}) {
	function r(t, n) {
		if (typeof t == "function") return t(n);
		if (t.match) {
			let r = t.match.exec(n);
			return r ? t.render ? t.render(r, n) : e(t.color, n) : null;
		}
		if (t.test) {
			let r = typeof t.test == "function" ? t.test(n) : t.test.test(n);
			return r ? t.render ? t.render(r, n) : e(typeof t.color == "function" ? t.color(n) : t.color, n) : null;
		}
		return null;
	}
	function i(e) {
		if (!e || n && e.includes("\x1B")) return e;
		for (let n of t) {
			let t = r(n, e);
			if (t != null) return t;
		}
		return e;
	}
	return (e) => e ? e.split("\n").map(i).join("\n") : "";
}
export { t as createLogColorizer, e as paint };
