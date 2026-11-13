import { createVuetify as e } from "vuetify";
// src/theme.js
var t = {
	light: {
		background: "#f4f6f8",
		surface: "#ffffff",
		"surface-variant": "#eef1f4",
		"on-surface": "#1d2129",
		"on-surface-variant": "#6b7280",
		primary: "#2563eb",
		"on-primary": "#ffffff"
	},
	dark: {
		background: "#14161a",
		surface: "#1c1f24",
		"surface-variant": "#262a30",
		"on-surface": "#e5e7eb",
		"on-surface-variant": "#9ca3af",
		primary: "#60a5fa",
		"on-primary": "#0b1220"
	}
};
function n(e) {
	try {
		let t = window.localStorage.getItem(e);
		if (!t) return "";
		if (!t.startsWith("\"")) return t;
		let n = JSON.parse(t);
		return typeof n == "string" ? n : "";
	} catch {
		return "";
	}
}
function r({ storageKey: r, colors: i = {}, options: a = {} } = {}) {
	let o = n(r) || (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"), s = {
		light: {
			dark: !1,
			colors: {
				...t.light,
				...i.light || {}
			}
		},
		dark: {
			dark: !0,
			colors: {
				...t.dark,
				...i.dark || {}
			}
		}
	}, c = e({
		...a,
		theme: {
			defaultTheme: o,
			themes: s
		}
	});
	function l(e) {
		try {
			window.localStorage.setItem(r, JSON.stringify(e));
		} catch {}
	}
	return {
		vuetify: c,
		initialTheme: o,
		rememberTheme: l
	};
}
export { r as createThemedVuetify };
