import { computed as e, onBeforeUnmount as t, onMounted as n } from "vue";
import { useLocalStorage as r } from "@vueuse/core";
import { createVuetify as i, useTheme as a } from "vuetify";
// src/composables/services/useStoredChoice.js
function o(t, n, i) {
	let a = r(t, i, { writeDefaults: !1 });
	return e({
		get: () => n.includes(a.value) ? a.value : i,
		set: (e) => {
			a.value = e;
		}
	});
}
// src/theme.js
var s = {
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
}, c = ["light", "dark"];
function l(e) {
	if (!e) return null;
	let t = o(e, c, "");
	try {
		let n = window.localStorage.getItem(e);
		if (n && n.startsWith("\"")) {
			let e = JSON.parse(n);
			c.includes(e) && (t.value = e);
		}
	} catch {}
	return t;
}
function u({ storageKey: e, colors: t = {}, options: n = {} } = {}) {
	let r = l(e), a = (r ? r.value : "") || (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"), o = {
		light: {
			dark: !1,
			colors: {
				...s.light,
				...t.light || {}
			}
		},
		dark: {
			dark: !0,
			colors: {
				...s.dark,
				...t.dark || {}
			}
		}
	}, c = i({
		...n,
		theme: {
			defaultTheme: a,
			themes: o
		}
	});
	function u(e) {
		r && (r.value = e);
	}
	return {
		vuetify: c,
		initialTheme: a,
		rememberTheme: u
	};
}
function d({ storageKey: r, rememberTheme: i, followSystem: o = !1 } = {}) {
	let s = a(), c = e(() => s.global.current.value.dark), u = l(r), d = null;
	function f() {
		return u ? u.value : "";
	}
	function p(e) {
		s.global.name.value = e, i && i(e);
	}
	function m() {
		p(c.value ? "light" : "dark");
	}
	function h(e) {
		f() || (s.global.name.value = e.matches ? "dark" : "light");
	}
	return n(() => {
		o && typeof window < "u" && window.matchMedia && (f() || (d = window.matchMedia("(prefers-color-scheme: dark)"), d.addEventListener?.("change", h)));
	}), t(() => {
		d?.removeEventListener?.("change", h), d = null;
	}), {
		theme: s,
		dark: c,
		toggle: m,
		setTheme: p
	};
}
export { d as n, o as r, u as t };
