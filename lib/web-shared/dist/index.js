import { Fragment as e, computed as t, createBlock as n, createCommentVNode as r, createElementBlock as i, createElementVNode as a, createTextVNode as o, createVNode as s, nextTick as c, normalizeClass as l, normalizeStyle as u, onBeforeUnmount as d, onMounted as f, openBlock as p, reactive as m, ref as h, renderList as g, resolveComponent as _, toDisplayString as v, unref as y, watch as b, watchEffect as x, withCtx as S, withModifiers as C } from "vue";
import { Terminal as w } from "@xterm/xterm";
import { FitAddon as T } from "@xterm/addon-fit";
// \0plugin-vue:export-helper
var E = (e, t) => {
	let n = e.__vccOpts || e;
	for (let [e, r] of t) n[e] = r;
	return n;
}, D = /*#__PURE__*/ E({
	__name: "LogView",
	props: {
		text: {
			type: String,
			default: ""
		},
		dark: {
			type: Boolean,
			default: !1
		},
		colorize: {
			type: Function,
			default: (e) => e
		},
		height: {
			type: String,
			default: ""
		}
	},
	setup(e) {
		let t = e, n = {
			normal: {
				background: "#11151c",
				foreground: "#d6deeb",
				selectionBackground: "#2f4366"
			},
			deeper: {
				background: "#0b0e13",
				foreground: "#d6deeb",
				selectionBackground: "#2f4366"
			}
		}, r = h(null), a = null, o = null, s = null, c = "";
		function m(e) {
			return e ? n.deeper : n.normal;
		}
		function g(e) {
			return t.colorize(e);
		}
		function _(e, t) {
			a.reset(), a.write(g(e), () => {
				a && (t == null ? a.scrollToBottom() : a.scrollToLine(Math.min(t, Math.max(0, a.buffer.active.length - 1))));
			});
		}
		function v(e) {
			if (a && e !== c) {
				if (c && e.startsWith(c)) {
					let t = a.buffer.active.viewportY >= a.buffer.active.baseY, n = e.slice(c.length);
					c = e, a.write(g(n), () => {
						a && t && a.scrollToBottom();
					});
				} else if (c && e.endsWith(c)) {
					let t = (e.slice(0, e.length - c.length).match(/\n/g) || []).length, n = a.buffer.active.viewportY + t;
					c = e, _(e, n);
				} else c = e, _(e);
			}
		}
		function y(e) {
			return e.type !== "keydown" || e.altKey || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "c" || !a.hasSelection() ? !0 : (navigator.clipboard?.writeText(a.getSelection()).catch(() => {}), !1);
		}
		return f(() => {
			a = new w({
				convertEol: !0,
				disableStdin: !0,
				cursorBlink: !1,
				scrollback: 5e3,
				fontFamily: "'JetBrains Mono', 'Noto Sans Mono CJK SC', 'Sarasa Mono SC', 'Cascadia Mono', Consolas, Menlo, monospace",
				fontSize: 12,
				lineHeight: 1.3,
				theme: m(t.dark)
			}), o = new T(), a.loadAddon(o), a.open(r.value), requestAnimationFrame(() => a && o.fit()), document.fonts && document.fonts.load("12px 'JetBrains Mono'").then(() => a && o.fit()).catch(() => {}), s = new ResizeObserver(() => {
				a && o.fit();
			}), s.observe(r.value), a.attachCustomKeyEventHandler(y), v(t.text || "");
		}), b(() => t.text, (e) => v(e || "")), b(() => t.dark, (e) => {
			a && (a.options.theme = m(e));
		}), d(() => {
			s && s.disconnect(), a && a.dispose(), s = null, a = null;
		}), (t, n) => (p(), i("div", {
			ref_key: "host",
			ref: r,
			class: l(["term", { deeper: e.dark }]),
			style: u(e.height ? {
				height: e.height,
				flex: "0 0 auto"
			} : null)
		}, null, 6));
	}
}, [["__scopeId", "data-v-6c5d0f49"]]), O = { class: "node" }, k = ["title"], A = {
	key: 0,
	class: "kids"
}, j = {
	key: 0,
	class: "hint"
}, M = {
	key: 1,
	class: "hint bad"
}, N = {
	key: 0,
	class: "hint"
}, P = /*#__PURE__*/ E({
	__name: "DirectoryNode",
	props: {
		node: {
			type: Object,
			required: !0
		},
		selected: {
			type: String,
			default: ""
		},
		loader: {
			type: Function,
			required: !0
		}
	},
	emits: ["pick"],
	setup(t, { emit: u }) {
		let d = t, f = u, m = h(!1), y = h(!1), x = h(""), w = h(null);
		b(() => d.selected === d.node.path, (e) => {
			e && c(() => w.value && w.value.scrollIntoView({ block: "nearest" }));
		}, { immediate: !0 });
		async function T() {
			f("pick", d.node), m.value || (m.value = !0, await D());
		}
		async function E() {
			m.value = !m.value, m.value && await D();
		}
		async function D() {
			if (!(d.node.children || y.value)) {
				y.value = !0, x.value = "";
				try {
					let e = await d.loader(d.node.path);
					d.node.children = e.entries;
				} catch (e) {
					x.value = e.message;
				} finally {
					y.value = !1;
				}
			}
		}
		return (c, u) => {
			let d = _("v-icon"), f = _("v-btn"), h = _("DirectoryNode", !0);
			return p(), i("div", O, [a("div", {
				ref_key: "rowEl",
				ref: w,
				class: l(["row", { selected: t.node.path === t.selected }]),
				onClick: T
			}, [
				s(f, {
					icon: !0,
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: m.value ? "收起" : "展开",
					onClick: C(E, ["stop"])
				}, {
					default: S(() => [s(d, { size: "18" }, {
						default: S(() => [o(v(m.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"]),
				s(d, {
					size: "18",
					class: "folder"
				}, {
					default: S(() => [...u[1] ||= [o("mdi-folder-outline", -1)]]),
					_: 1
				}),
				a("span", {
					class: "label",
					title: t.node.path
				}, v(t.node.name), 9, k)
			], 2), m.value ? (p(), i("div", A, [y.value ? (p(), i("p", j, "正在读取…")) : x.value ? (p(), i("p", M, v(x.value), 1)) : t.node.children ? (p(), i(e, { key: 2 }, [(p(!0), i(e, null, g(t.node.children, (e) => (p(), n(h, {
				key: e.path,
				node: e,
				selected: t.selected,
				loader: t.loader,
				onPick: u[0] ||= (e) => c.$emit("pick", e)
			}, null, 8, [
				"node",
				"selected",
				"loader"
			]))), 128)), t.node.children.length ? r("", !0) : (p(), i("p", N, "没有子目录"))], 64)) : r("", !0)])) : r("", !0)]);
		};
	}
}, [["__scopeId", "data-v-08667ca3"]]), F = { class: "picker" }, I = {
	key: 0,
	class: "tip"
}, L = { class: "tree" }, R = { class: "root" }, z = ["title"], B = {
	key: 0,
	class: "hint bad"
}, V = {
	key: 0,
	class: "hint"
}, H = /*#__PURE__*/ E({
	__name: "DirectoryPicker",
	props: {
		modelValue: {
			type: String,
			default: ""
		},
		tip: {
			type: String,
			default: ""
		},
		label: {
			type: String,
			default: "目录"
		},
		placeholder: {
			type: String,
			default: ""
		},
		loader: {
			type: Function,
			required: !0
		}
	},
	emits: ["update:modelValue", "update:valid"],
	setup(c, { emit: l }) {
		let u = c, d = l, m = h(""), y = h(null), b = h(!0), C = h(""), w = t({
			get: () => u.modelValue,
			set: (e) => d("update:modelValue", e)
		}), T = t(() => {
			let e = String(u.modelValue || "").trim();
			return e === "~" ? e = m.value : e.startsWith("~/") && (e = m.value + e.slice(1)), e.replace(/\/+$/, "");
		}), E = t(() => !m.value || !T.value ? !1 : T.value === m.value || T.value.startsWith(m.value + "/"));
		x(() => d("update:valid", E.value));
		function D(e) {
			w.value = e.path;
		}
		return f(async () => {
			try {
				let e = await u.loader();
				m.value = e.home, y.value = e.entries.map((e) => ({
					...e,
					children: null
				}));
			} catch (e) {
				C.value = e.message;
			} finally {
				b.value = !1;
			}
		}), (t, l) => {
			let u = _("v-text-field"), d = _("v-icon"), f = _("v-progress-circular");
			return p(), i("div", F, [
				c.tip ? (p(), i("p", I, v(c.tip), 1)) : r("", !0),
				s(u, {
					modelValue: w.value,
					"onUpdate:modelValue": l[0] ||= (e) => w.value = e,
					label: c.label,
					placeholder: c.placeholder,
					"prepend-inner-icon": "mdi-folder",
					error: !!c.modelValue && !E.value,
					"error-messages": c.modelValue && !E.value ? "只能添加家目录内的目录" : "",
					"hide-details": "auto",
					autofocus: ""
				}, null, 8, [
					"modelValue",
					"label",
					"placeholder",
					"error",
					"error-messages"
				]),
				a("div", L, [a("div", R, [
					s(d, { size: "18" }, {
						default: S(() => [...l[1] ||= [o("mdi-home-outline", -1)]]),
						_: 1
					}),
					a("span", {
						class: "root-label",
						title: m.value || "~"
					}, "~", 8, z),
					b.value ? (p(), n(f, {
						key: 0,
						size: "12",
						width: "2",
						indeterminate: ""
					})) : r("", !0)
				]), C.value ? (p(), i("p", B, v(C.value), 1)) : y.value ? (p(), i(e, { key: 1 }, [(p(!0), i(e, null, g(y.value, (e) => (p(), n(P, {
					key: e.path,
					node: e,
					selected: T.value,
					loader: c.loader,
					onPick: D
				}, null, 8, [
					"node",
					"selected",
					"loader"
				]))), 128)), y.value.length ? r("", !0) : (p(), i("p", V, "家目录下没有子目录"))], 64)) : r("", !0)])
			]);
		};
	}
}, [["__scopeId", "data-v-0926921f"]]), U = {
	icon: "mdi-file-outline",
	color: ""
}, W = {
	"package.json": {
		icon: "mdi-npm",
		color: "#cb3837"
	},
	"package-lock.json": {
		icon: "mdi-npm",
		color: "#cb3837"
	},
	dockerfile: {
		icon: "mdi-docker",
		color: "#2496ed"
	},
	makefile: {
		icon: "mdi-hammer-wrench",
		color: "#8d6e63"
	},
	".gitignore": {
		icon: "mdi-git",
		color: "#f14e32"
	},
	".gitattributes": {
		icon: "mdi-git",
		color: "#f14e32"
	},
	".gitmodules": {
		icon: "mdi-git",
		color: "#f14e32"
	},
	"pom.xml": {
		icon: "mdi-xml",
		color: "#e37933"
	}
}, G = {
	js: {
		icon: "mdi-language-javascript",
		color: "#f1e05a"
	},
	mjs: {
		icon: "mdi-language-javascript",
		color: "#f1e05a"
	},
	cjs: {
		icon: "mdi-language-javascript",
		color: "#f1e05a"
	},
	jsx: {
		icon: "mdi-react",
		color: "#61dafb"
	},
	ts: {
		icon: "mdi-language-typescript",
		color: "#3178c6"
	},
	tsx: {
		icon: "mdi-react",
		color: "#61dafb"
	},
	vue: {
		icon: "mdi-vuejs",
		color: "#41b883"
	},
	html: {
		icon: "mdi-language-html5",
		color: "#e34f26"
	},
	htm: {
		icon: "mdi-language-html5",
		color: "#e34f26"
	},
	xml: {
		icon: "mdi-xml",
		color: "#e37933"
	},
	svg: {
		icon: "mdi-file-image-outline",
		color: "#ffb13b"
	},
	css: {
		icon: "mdi-language-css3",
		color: "#42a5f5"
	},
	scss: {
		icon: "mdi-sass",
		color: "#cf649a"
	},
	sass: {
		icon: "mdi-sass",
		color: "#cf649a"
	},
	less: {
		icon: "mdi-language-css3",
		color: "#1d365d"
	},
	json: {
		icon: "mdi-code-json",
		color: "#cbcb41"
	},
	md: {
		icon: "mdi-language-markdown",
		color: "#519aba"
	},
	markdown: {
		icon: "mdi-language-markdown",
		color: "#519aba"
	},
	py: {
		icon: "mdi-language-python",
		color: "#3572a5"
	},
	java: {
		icon: "mdi-language-java",
		color: "#b07219"
	},
	yml: {
		icon: "mdi-file-cog-outline",
		color: "#cb171e"
	},
	yaml: {
		icon: "mdi-file-cog-outline",
		color: "#cb171e"
	},
	toml: {
		icon: "mdi-file-cog-outline",
		color: "#9e9e9e"
	},
	ini: {
		icon: "mdi-file-cog-outline",
		color: "#9e9e9e"
	},
	conf: {
		icon: "mdi-file-cog-outline",
		color: "#9e9e9e"
	},
	properties: {
		icon: "mdi-file-cog-outline",
		color: "#9e9e9e"
	},
	env: {
		icon: "mdi-file-cog-outline",
		color: "#9e9e9e"
	},
	sh: {
		icon: "mdi-bash",
		color: "#89e051"
	},
	bash: {
		icon: "mdi-bash",
		color: "#89e051"
	},
	zsh: {
		icon: "mdi-bash",
		color: "#89e051"
	},
	sql: {
		icon: "mdi-database",
		color: "#e38c00"
	},
	png: {
		icon: "mdi-file-image-outline",
		color: "#26a69a"
	},
	jpg: {
		icon: "mdi-file-image-outline",
		color: "#26a69a"
	},
	jpeg: {
		icon: "mdi-file-image-outline",
		color: "#26a69a"
	},
	gif: {
		icon: "mdi-file-image-outline",
		color: "#26a69a"
	},
	webp: {
		icon: "mdi-file-image-outline",
		color: "#26a69a"
	},
	bmp: {
		icon: "mdi-file-image-outline",
		color: "#26a69a"
	},
	ico: {
		icon: "mdi-file-image-outline",
		color: "#26a69a"
	},
	pdf: {
		icon: "mdi-file-pdf-box",
		color: "#e53935"
	},
	zip: {
		icon: "mdi-zip-box-outline",
		color: "#afb42b"
	},
	gz: {
		icon: "mdi-zip-box-outline",
		color: "#afb42b"
	},
	tar: {
		icon: "mdi-zip-box-outline",
		color: "#afb42b"
	},
	rar: {
		icon: "mdi-zip-box-outline",
		color: "#afb42b"
	},
	"7z": {
		icon: "mdi-zip-box-outline",
		color: "#afb42b"
	},
	doc: {
		icon: "mdi-file-word-outline",
		color: "#2b579a"
	},
	docx: {
		icon: "mdi-file-word-outline",
		color: "#2b579a"
	},
	xls: {
		icon: "mdi-file-excel-outline",
		color: "#217346"
	},
	xlsx: {
		icon: "mdi-file-excel-outline",
		color: "#217346"
	},
	csv: {
		icon: "mdi-file-table-outline",
		color: "#217346"
	},
	ppt: {
		icon: "mdi-file-powerpoint-outline",
		color: "#d24726"
	},
	pptx: {
		icon: "mdi-file-powerpoint-outline",
		color: "#d24726"
	},
	txt: {
		icon: "mdi-file-document-outline",
		color: "#90a4ae"
	},
	log: {
		icon: "mdi-file-document-outline",
		color: "#90a4ae"
	},
	lock: {
		icon: "mdi-lock-outline",
		color: "#9e9e9e"
	},
	ttf: {
		icon: "mdi-format-font",
		color: "#7e57c2"
	},
	otf: {
		icon: "mdi-format-font",
		color: "#7e57c2"
	},
	woff: {
		icon: "mdi-format-font",
		color: "#7e57c2"
	},
	woff2: {
		icon: "mdi-format-font",
		color: "#7e57c2"
	},
	mp3: {
		icon: "mdi-file-music-outline",
		color: "#ab47bc"
	},
	wav: {
		icon: "mdi-file-music-outline",
		color: "#ab47bc"
	},
	mp4: {
		icon: "mdi-file-video-outline",
		color: "#5c6bc0"
	},
	avi: {
		icon: "mdi-file-video-outline",
		color: "#5c6bc0"
	},
	mov: {
		icon: "mdi-file-video-outline",
		color: "#5c6bc0"
	},
	mkv: {
		icon: "mdi-file-video-outline",
		color: "#5c6bc0"
	}
};
function K(e) {
	let t = String(e || "").split("/").pop().toLowerCase(), n = W[t];
	if (n) return n;
	let r = t.lastIndexOf(".");
	return r < 0 ? U : G[t.slice(r + 1)] || U;
}
// src/composables/useSplitPane.js
var q = "dvcsx-resizing";
function J({ area: e, initial: t, min: n = 0, max: r = 100, rightMin: i = 0, axis: a = "x", unit: o = "px", persist: s = "" }) {
	let c = h(p()), l = h(!1), u = 0, f = 0;
	function p() {
		if (!s) return t;
		try {
			let e = Number(window.localStorage.getItem(s));
			return Number.isFinite(e) && e > 0 ? e : t;
		} catch {
			return t;
		}
	}
	function m(t) {
		let s = r;
		if (o === "px" && e.value) {
			let t = a === "x" ? e.value.clientWidth : e.value.clientHeight;
			t && (s = Math.max(n, t - i));
		}
		return Math.min(Math.max(t, n), s);
	}
	function g(t) {
		let n = e.value;
		if (!n) return;
		let r = a === "x" ? n.clientWidth : n.clientHeight;
		if (!r) return;
		let i = (a === "x" ? t.clientX : t.clientY) - u;
		c.value = m(f + (o === "pct" ? i / r * 100 : i));
	}
	function _() {
		l.value && (l.value = !1, window.removeEventListener("pointermove", g), document.body.classList.remove(q));
	}
	function v(t) {
		t.button === 0 && e.value && (l.value = !0, u = a === "x" ? t.clientX : t.clientY, f = c.value, t.preventDefault(), document.body.classList.add(q), window.addEventListener("pointermove", g), window.addEventListener("pointerup", _, { once: !0 }));
	}
	function y() {
		c.value = t;
	}
	return b(c, (e) => {
		if (s) try {
			window.localStorage.setItem(s, String(e));
		} catch {}
	}), d(_), {
		size: c,
		resizing: l,
		start: v,
		stop: _,
		reset: y
	};
}
// src/composables/useFileTree.js
function Y(e, n = () => ({})) {
	let r = m({});
	function i() {
		let t = typeof e == "function" ? e() : y(e);
		return Array.isArray(t) ? t : [];
	}
	function a(e) {
		let t = {
			path: "",
			dirs: /* @__PURE__ */ new Map(),
			files: []
		};
		for (let n of e) {
			let e = String(n.path || "").split("/").filter(Boolean);
			if (!e.length) continue;
			let r = t;
			for (let t = 0; t < e.length - 1; t += 1) {
				let n = e[t], i = r.dirs.get(n);
				i || (i = {
					name: n,
					path: r.path ? `${r.path}/${n}` : n,
					dirs: /* @__PURE__ */ new Map(),
					files: []
				}, r.dirs.set(n, i)), r = i;
			}
			r.files.push({
				...n,
				name: e[e.length - 1]
			});
		}
		return t;
	}
	function o(e) {
		let t = e.files.length;
		for (let n of e.dirs.values()) t += o(n);
		return t;
	}
	function s(e, t) {
		let i = [], a = [...e.dirs.values()].sort((e, t) => e.name.localeCompare(t.name, "zh-CN"));
		for (let e of a) i.push({
			kind: "dir",
			name: e.name,
			path: e.path,
			depth: t,
			count: o(e)
		}), r[e.path] || i.push(...s(e, t + 1));
		let c = [...e.files].sort((e, t) => e.name.localeCompare(t.name, "zh-CN"));
		for (let e of c) i.push({
			kind: "file",
			name: e.name,
			path: e.path,
			depth: t,
			file: e,
			...n(e)
		});
		return i;
	}
	let c = t(() => s(a(i()), 0));
	function l(e) {
		r[e] = !r[e];
	}
	return {
		rows: c,
		collapsed: r,
		toggle: l
	};
}
export { P as DirectoryNode, H as DirectoryPicker, D as LogView, K as fileIcon, Y as useFileTree, J as useSplitPane };
