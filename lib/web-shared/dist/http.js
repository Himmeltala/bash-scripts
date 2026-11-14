// src/utils/http.js
var e = class extends Error {
	constructor(e, t) {
		super(e), this.name = "ApiError", this.status = t;
	}
};
function t(e) {
	return encodeURIComponent(e ?? "");
}
function n({ prefix: t, messageOf: n, statusOnError: r = !0, treatPayloadError: i = !1, fetchImpl: a = fetch } = {}) {
	async function o(o, s, c) {
		let l = {
			method: o,
			cache: "no-store",
			headers: {}
		};
		c !== void 0 && (l.headers["Content-Type"] = "application/json", l.body = JSON.stringify(c));
		let u = await a(t + s, l), d = null;
		try {
			d = await u.json();
		} catch {
			d = null;
		}
		let f = () => n ? n({
			data: d,
			status: u.status,
			response: u,
			method: o,
			path: s
		}) : d && d.error || `请求失败（${u.status}）`;
		if (!u.ok || i && d && d.error) throw new e(f(), r ? u.status : void 0);
		return d;
	}
	return { call: o };
}
export { e as ApiError, n as createJsonClient, t as q };
