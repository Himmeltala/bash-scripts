// src/utils/commons/codeSymbol.js
var e = /[\p{L}\p{N}_$@]/u;
function t(t, n) {
	let r = String(t ?? "");
	if (!Number.isInteger(n) || n < 0 || n > r.length) return null;
	let i = n;
	if (i >= r.length || !e.test(r[i])) {
		let e = r[i];
		if (e !== void 0 && !/\s/.test(e)) return null;
		--i;
	}
	if (i < 0 || !e.test(r[i])) return null;
	let a = i, o = i + 1;
	for (; a > 0 && e.test(r[a - 1]);) --a;
	for (; o < r.length && e.test(r[o]);) o += 1;
	let s = r.slice(a, o);
	if (!s) return null;
	let c = 0, l = 0;
	for (let e = 0; e < a; e += 1) r[e] === "\n" && (c += 1, l = e + 1);
	return {
		word: s,
		line: c,
		character: a - l
	};
}
export { t };
