import { computed as e, onBeforeUnmount as t, onMounted as n } from "vue";
import { createVuetify as r, useTheme as i } from "vuetify";
// src/theme.js
var a = {
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
function o(e) {
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
function s({ storageKey: e, colors: t = {}, options: n = {} } = {}) {
	let i = o(e) || (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"), s = {
		light: {
			dark: !1,
			colors: {
				...a.light,
				...t.light || {}
			}
		},
		dark: {
			dark: !0,
			colors: {
				...a.dark,
				...t.dark || {}
			}
		}
	}, c = r({
		...n,
		theme: {
			defaultTheme: i,
			themes: s
		}
	});
	function l(t) {
		try {
			window.localStorage.setItem(e, JSON.stringify(t));
		} catch {}
	}
	return {
		vuetify: c,
		initialTheme: i,
		rememberTheme: l
	};
}
function c({ storageKey: r, rememberTheme: a, followSystem: o = !1 } = {}) {
	let s = i(), c = e(() => s.global.current.value.dark), l = null;
	function u() {
		try {
			return r ? window.localStorage.getItem(r) : "";
		} catch {
			return "";
		}
	}
	function d(e) {
		s.global.name.value = e, a && a(e);
	}
	function f() {
		d(c.value ? "light" : "dark");
	}
	function p(e) {
		u() || (s.global.name.value = e.matches ? "dark" : "light");
	}
	return n(() => {
		o && typeof window < "u" && window.matchMedia && (u() || (l = window.matchMedia("(prefers-color-scheme: dark)"), l.addEventListener?.("change", p)));
	}), t(() => {
		l?.removeEventListener?.("change", p), l = null;
	}), {
		theme: s,
		dark: c,
		toggle: f,
		setTheme: d
	};
}
export { s as createThemedVuetify, c as useThemeToggle };
