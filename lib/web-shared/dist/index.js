import { Fragment as e, computed as t, createBlock as n, createCommentVNode as r, createElementBlock as i, createElementVNode as a, createTextVNode as o, createVNode as s, guardReactiveProps as c, mergeProps as l, nextTick as u, normalizeClass as d, normalizeProps as f, normalizeStyle as p, onBeforeUnmount as m, onMounted as h, openBlock as g, reactive as _, ref as v, renderList as y, renderSlot as b, resolveComponent as x, toDisplayString as S, unref as C, watch as w, watchEffect as T, withCtx as E, withModifiers as D } from "vue";
import { Terminal as O } from "@xterm/xterm";
import { FitAddon as k } from "@xterm/addon-fit";
// \0plugin-vue:export-helper
var A = (e, t) => {
	let n = e.__vccOpts || e;
	for (let [e, r] of t) n[e] = r;
	return n;
}, j = /*#__PURE__*/ A({
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
		}, r = v(null), a = null, o = null, s = null, c = "";
		function l(e) {
			return e ? n.deeper : n.normal;
		}
		function u(e) {
			return t.colorize(e);
		}
		function f(e, t) {
			a.reset(), a.write(u(e), () => {
				a && (t == null ? a.scrollToBottom() : a.scrollToLine(Math.min(t, Math.max(0, a.buffer.active.length - 1))));
			});
		}
		function _(e) {
			if (a && e !== c) {
				if (c && e.startsWith(c)) {
					let t = a.buffer.active.viewportY >= a.buffer.active.baseY, n = e.slice(c.length);
					c = e, a.write(u(n), () => {
						a && t && a.scrollToBottom();
					});
				} else if (c && e.endsWith(c)) {
					let t = (e.slice(0, e.length - c.length).match(/\n/g) || []).length, n = a.buffer.active.viewportY + t;
					c = e, f(e, n);
				} else c = e, f(e);
			}
		}
		function y(e) {
			return e.type !== "keydown" || e.altKey || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "c" || !a.hasSelection() ? !0 : (navigator.clipboard?.writeText(a.getSelection()).catch(() => {}), !1);
		}
		return h(() => {
			a = new O({
				convertEol: !0,
				disableStdin: !0,
				cursorBlink: !1,
				scrollback: 5e3,
				fontFamily: "'JetBrains Mono', 'Noto Sans Mono CJK SC', 'Sarasa Mono SC', 'Cascadia Mono', Consolas, Menlo, monospace",
				fontSize: 12,
				lineHeight: 1.3,
				theme: l(t.dark)
			}), o = new k(), a.loadAddon(o), a.open(r.value), requestAnimationFrame(() => a && o.fit()), document.fonts && document.fonts.load("12px 'JetBrains Mono'").then(() => a && o.fit()).catch(() => {}), s = new ResizeObserver(() => {
				a && o.fit();
			}), s.observe(r.value), a.attachCustomKeyEventHandler(y), _(t.text || "");
		}), w(() => t.text, (e) => _(e || "")), w(() => t.dark, (e) => {
			a && (a.options.theme = l(e));
		}), m(() => {
			s && s.disconnect(), a && a.dispose(), s = null, a = null;
		}), (t, n) => (g(), i("div", {
			ref_key: "host",
			ref: r,
			class: d(["term", { deeper: e.dark }]),
			style: p(e.height ? {
				height: e.height,
				flex: "0 0 auto"
			} : null)
		}, null, 6));
	}
}, [["__scopeId", "data-v-6c5d0f49"]]), M = { class: "node" }, N = ["title"], P = {
	key: 0,
	class: "kids"
}, F = {
	key: 0,
	class: "hint"
}, I = {
	key: 1,
	class: "hint bad"
}, L = {
	key: 0,
	class: "hint"
}, R = /*#__PURE__*/ A({
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
	setup(t, { emit: c }) {
		let l = t, f = c, p = v(!1), m = v(!1), h = v(""), _ = v(null);
		w(() => l.selected === l.node.path, (e) => {
			e && u(() => _.value && _.value.scrollIntoView({ block: "nearest" }));
		}, { immediate: !0 });
		async function b() {
			f("pick", l.node), p.value || (p.value = !0, await T());
		}
		async function C() {
			p.value = !p.value, p.value && await T();
		}
		async function T() {
			if (!(l.node.children || m.value)) {
				m.value = !0, h.value = "";
				try {
					let e = await l.loader(l.node.path);
					l.node.children = e.entries;
				} catch (e) {
					h.value = e.message;
				} finally {
					m.value = !1;
				}
			}
		}
		return (c, l) => {
			let u = x("v-icon"), f = x("v-btn"), v = x("DirectoryNode", !0);
			return g(), i("div", M, [a("div", {
				ref_key: "rowEl",
				ref: _,
				class: d(["row", { selected: t.node.path === t.selected }]),
				onClick: b
			}, [
				s(f, {
					icon: !0,
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: p.value ? "收起" : "展开",
					onClick: D(C, ["stop"])
				}, {
					default: E(() => [s(u, { size: "18" }, {
						default: E(() => [o(S(p.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"]),
				s(u, {
					size: "18",
					class: "folder"
				}, {
					default: E(() => [...l[1] ||= [o("mdi-folder-outline", -1)]]),
					_: 1
				}),
				a("span", {
					class: "label",
					title: t.node.path
				}, S(t.node.name), 9, N)
			], 2), p.value ? (g(), i("div", P, [m.value ? (g(), i("p", F, "正在读取…")) : h.value ? (g(), i("p", I, S(h.value), 1)) : t.node.children ? (g(), i(e, { key: 2 }, [(g(!0), i(e, null, y(t.node.children, (e) => (g(), n(v, {
				key: e.path,
				node: e,
				selected: t.selected,
				loader: t.loader,
				onPick: l[0] ||= (e) => c.$emit("pick", e)
			}, null, 8, [
				"node",
				"selected",
				"loader"
			]))), 128)), t.node.children.length ? r("", !0) : (g(), i("p", L, "没有子目录"))], 64)) : r("", !0)])) : r("", !0)]);
		};
	}
}, [["__scopeId", "data-v-08667ca3"]]), z = { class: "picker" }, ee = {
	key: 0,
	class: "tip"
}, te = { class: "tree" }, ne = { class: "root" }, B = ["title"], V = {
	key: 0,
	class: "hint bad"
}, H = {
	key: 0,
	class: "hint"
}, U = /*#__PURE__*/ A({
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
		let u = c, d = l, f = v(""), p = v(null), m = v(!0), _ = v(""), b = t({
			get: () => u.modelValue,
			set: (e) => d("update:modelValue", e)
		}), C = t(() => {
			let e = String(u.modelValue || "").trim();
			return e === "~" ? e = f.value : e.startsWith("~/") && (e = f.value + e.slice(1)), e.replace(/\/+$/, "");
		}), w = t(() => !f.value || !C.value ? !1 : C.value === f.value || C.value.startsWith(f.value + "/"));
		T(() => d("update:valid", w.value));
		function D(e) {
			b.value = e.path;
		}
		return h(async () => {
			try {
				let e = await u.loader();
				f.value = e.home, p.value = e.entries.map((e) => ({
					...e,
					children: null
				}));
			} catch (e) {
				_.value = e.message;
			} finally {
				m.value = !1;
			}
		}), (t, l) => {
			let u = x("v-text-field"), d = x("v-icon"), h = x("v-progress-circular");
			return g(), i("div", z, [
				c.tip ? (g(), i("p", ee, S(c.tip), 1)) : r("", !0),
				s(u, {
					modelValue: b.value,
					"onUpdate:modelValue": l[0] ||= (e) => b.value = e,
					label: c.label,
					placeholder: c.placeholder,
					"prepend-inner-icon": "mdi-folder",
					error: !!c.modelValue && !w.value,
					"error-messages": c.modelValue && !w.value ? "只能添加家目录内的目录" : "",
					"hide-details": "auto",
					autofocus: ""
				}, null, 8, [
					"modelValue",
					"label",
					"placeholder",
					"error",
					"error-messages"
				]),
				a("div", te, [a("div", ne, [
					s(d, { size: "18" }, {
						default: E(() => [...l[1] ||= [o("mdi-home-outline", -1)]]),
						_: 1
					}),
					a("span", {
						class: "root-label",
						title: f.value || "~"
					}, "~", 8, B),
					m.value ? (g(), n(h, {
						key: 0,
						size: "12",
						width: "2",
						indeterminate: ""
					})) : r("", !0)
				]), _.value ? (g(), i("p", V, S(_.value), 1)) : p.value ? (g(), i(e, { key: 1 }, [(g(!0), i(e, null, y(p.value, (e) => (g(), n(R, {
					key: e.path,
					node: e,
					selected: C.value,
					loader: c.loader,
					onPick: D
				}, null, 8, [
					"node",
					"selected",
					"loader"
				]))), 128)), p.value.length ? r("", !0) : (g(), i("p", H, "家目录下没有子目录"))], 64)) : r("", !0)])
			]);
		};
	}
}, [["__scopeId", "data-v-0926921f"]]), W = {
	icon: "mdi-file-outline",
	color: ""
}, G = {
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
}, K = {
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
function q(e) {
	let t = String(e || "").split("/").pop().toLowerCase(), n = G[t];
	if (n) return n;
	let r = t.lastIndexOf(".");
	return r < 0 ? W : K[t.slice(r + 1)] || W;
}
// src/components/FileTreeNode.vue
var J = { class: "branch" }, Y = {
	key: 1,
	class: "arrow-space"
}, X = ["title"], re = {
	key: 0,
	class: "hint"
}, ie = {
	key: 1,
	class: "hint bad"
}, ae = {
	key: 2,
	class: "hint"
}, oe = {
	key: 0,
	class: "hint"
}, Z = /*#__PURE__*/ A({
	__name: "FileTreeNode",
	props: {
		node: {
			type: Object,
			required: !0
		},
		depth: {
			type: Number,
			default: 0
		},
		expanded: {
			type: Object,
			required: !0
		},
		cache: {
			type: Object,
			required: !0
		},
		keyOf: {
			type: Function,
			required: !0
		},
		dirOf: {
			type: Function,
			required: !0
		},
		nameOf: {
			type: Function,
			required: !0
		},
		labelClass: {
			type: String,
			default: ""
		},
		rowClass: {
			type: Function,
			default: null
		},
		pickOnRowClick: {
			type: Boolean,
			default: !1
		},
		texts: {
			type: Object,
			default: () => ({})
		}
	},
	emits: ["toggle", "pick"],
	setup(c, { emit: u }) {
		let f = c, m = u, h = {
			loading: "正在读取…",
			empty: "空目录",
			truncated: "这一层文件太多，只列了前面一部分。"
		}, _ = t(() => ({
			...h,
			...f.texts
		})), v = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, C = t(() => f.keyOf(f.node)), w = t(() => f.dirOf(f.node)), T = t(() => f.expanded[C.value] === !0), O = t(() => f.cache[C.value] || v), k = t(() => w.value ? null : q(f.nameOf(f.node))), A = t(() => w.value ? T.value ? "mdi-folder-open-outline" : "mdi-folder-outline" : k.value.icon), j = t(() => w.value ? null : k.value.color ? { color: k.value.color } : null);
		function M() {
			f.pickOnRowClick && (w.value ? m("toggle", C.value) : m("pick", f.node));
		}
		return (t, u) => {
			let f = x("v-icon"), h = x("v-btn"), v = x("FileTreeNode", !0);
			return g(), i("div", J, [a("div", {
				class: d(["row", [c.rowClass ? c.rowClass(c.node) : null, { clickable: c.pickOnRowClick }]]),
				style: p({ paddingLeft: 4 + c.depth * 14 + "px" }),
				onClick: M
			}, [
				w.value ? (g(), n(h, {
					key: 0,
					icon: "",
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: T.value ? "收起" : "展开",
					onClick: u[0] ||= D((e) => m("toggle", C.value), ["stop"])
				}, {
					default: E(() => [s(f, { size: "16" }, {
						default: E(() => [o(S(T.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"])) : (g(), i("span", Y)),
				s(f, {
					size: "16",
					class: d(w.value ? "folder" : "file"),
					style: p(j.value)
				}, {
					default: E(() => [o(S(A.value), 1)]),
					_: 1
				}, 8, ["class", "style"]),
				b(t.$slots, "row-before-label", {
					node: c.node,
					open: T.value,
					state: O.value
				}, void 0, !0),
				a("span", {
					class: d(["label", c.labelClass]),
					title: C.value
				}, S(c.nameOf(c.node)), 11, X),
				b(t.$slots, "row-after-label", {
					node: c.node,
					open: T.value,
					state: O.value
				}, void 0, !0)
			], 6), w.value && T.value ? (g(), i(e, { key: 0 }, [O.value.loading ? (g(), i("p", re, S(_.value.loading), 1)) : O.value.error ? (g(), i("p", ie, S(O.value.error), 1)) : O.value.entries.length ? (g(), i(e, { key: 3 }, [(g(!0), i(e, null, y(O.value.entries, (e) => (g(), n(v, {
				key: c.keyOf(e),
				node: e,
				depth: c.depth + 1,
				expanded: c.expanded,
				cache: c.cache,
				"key-of": c.keyOf,
				"dir-of": c.dirOf,
				"name-of": c.nameOf,
				"label-class": c.labelClass,
				"row-class": c.rowClass,
				"pick-on-row-click": c.pickOnRowClick,
				texts: c.texts,
				onToggle: u[1] ||= (e) => m("toggle", e),
				onPick: u[2] ||= (e) => m("pick", e)
			}, {
				"row-before-label": E((e) => [b(t.$slots, "row-before-label", l({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": E((e) => [b(t.$slots, "row-after-label", l({ ref_for: !0 }, e), void 0, !0)]),
				_: 3
			}, 8, [
				"node",
				"depth",
				"expanded",
				"cache",
				"key-of",
				"dir-of",
				"name-of",
				"label-class",
				"row-class",
				"pick-on-row-click",
				"texts"
			]))), 128)), O.value.truncated ? (g(), i("p", oe, S(_.value.truncated), 1)) : r("", !0)], 64)) : (g(), i("p", ae, S(_.value.empty), 1))], 64)) : r("", !0)]);
		};
	}
}, [["__scopeId", "data-v-0429b63a"]]), se = { class: "file-tree" }, ce = {
	key: 0,
	class: "hint"
}, le = {
	key: 1,
	class: "hint bad"
}, ue = {
	key: 2,
	class: "hint"
}, Q = {
	key: 0,
	class: "hint"
}, de = /*#__PURE__*/ A({
	__name: "FileTree",
	props: {
		loader: {
			type: Function,
			required: !0
		},
		root: {
			type: Object,
			default: null
		},
		keyOf: {
			type: Function,
			default: (e) => e.path
		},
		dirOf: {
			type: Function,
			default: (e) => e.type === "dir"
		},
		nameOf: {
			type: Function,
			default: (e) => e.name
		},
		labelClass: {
			type: String,
			default: ""
		},
		rowClass: {
			type: Function,
			default: null
		},
		pickOnRowClick: {
			type: Boolean,
			default: !1
		},
		active: {
			type: Boolean,
			default: !0
		},
		texts: {
			type: Object,
			default: () => ({})
		}
	},
	emits: ["pick"],
	setup(a, { expose: o, emit: s }) {
		let u = a, d = s, p = {
			loading: "正在读取…",
			empty: "空目录",
			truncated: "这一层文件太多，只列了前面一部分。",
			rootLoading: "正在读取目录…",
			rootEmpty: "空目录"
		}, m = t(() => ({
			...p,
			...u.texts
		})), x = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, C = _({}), T = _({}), D = v(!1), O = t(() => u.root ? u.keyOf(u.root) : ""), k = t(() => T[O.value] || x);
		async function A(e, t = !1) {
			if (!t && T[e]) return;
			T[e] || (T[e] = {
				loading: !1,
				error: "",
				entries: [],
				truncated: !1
			});
			let n = T[e];
			n.loading = !0, n.error = "";
			try {
				let t = await u.loader(e);
				n.entries = t.entries || [], n.truncated = t.truncated || !1;
			} catch (e) {
				n.error = e.message, n.entries = [];
			} finally {
				n.loading = !1;
			}
		}
		function j(e) {
			C[e] = !C[e], C[e] && A(e);
		}
		async function M(e) {
			C[O.value] = !0, await A(O.value);
			let t = O.value;
			for (let n of String(e || "").split("/").filter(Boolean)) t = t ? `${t}/${n}` : n, await A(t), C[t] = !0;
		}
		function N() {
			for (let e of Object.keys(T)) delete T[e];
			for (let e of Object.keys(C)) delete C[e];
			C[O.value] = !0, A(O.value);
		}
		async function P(e) {
			await A(e, !0);
		}
		async function F() {
			await Promise.all(Object.keys(T).map((e) => A(e, !0)));
		}
		function I() {
			u.active && !D.value && (D.value = !0, C[O.value] = !0, A(O.value));
		}
		return u.active && I(), h(I), w(() => u.active, (e) => {
			e && I();
		}), o({
			reveal: M,
			reload: N,
			reloadDir: P,
			refreshAll: F,
			toggle: j
		}), (t, o) => (g(), i("div", se, [a.root ? (g(), n(Z, {
			key: 0,
			node: a.root,
			depth: 0,
			expanded: C,
			cache: T,
			"key-of": a.keyOf,
			"dir-of": a.dirOf,
			"name-of": a.nameOf,
			"label-class": a.labelClass,
			"row-class": a.rowClass,
			"pick-on-row-click": a.pickOnRowClick,
			texts: a.texts,
			onToggle: j,
			onPick: o[0] ||= (e) => d("pick", e)
		}, {
			"row-before-label": E((e) => [b(t.$slots, "row-before-label", f(c(e)), void 0, !0)]),
			"row-after-label": E((e) => [b(t.$slots, "row-after-label", f(c(e)), void 0, !0)]),
			_: 3
		}, 8, [
			"node",
			"expanded",
			"cache",
			"key-of",
			"dir-of",
			"name-of",
			"label-class",
			"row-class",
			"pick-on-row-click",
			"texts"
		])) : (g(), i(e, { key: 1 }, [k.value.loading ? (g(), i("p", ce, S(m.value.rootLoading), 1)) : k.value.error ? (g(), i("p", le, S(k.value.error), 1)) : k.value.entries.length ? (g(), i(e, { key: 3 }, [(g(!0), i(e, null, y(k.value.entries, (e) => (g(), n(Z, {
			key: a.keyOf(e),
			node: e,
			depth: 0,
			expanded: C,
			cache: T,
			"key-of": a.keyOf,
			"dir-of": a.dirOf,
			"name-of": a.nameOf,
			"label-class": a.labelClass,
			"row-class": a.rowClass,
			"pick-on-row-click": a.pickOnRowClick,
			texts: a.texts,
			onToggle: j,
			onPick: o[1] ||= (e) => d("pick", e)
		}, {
			"row-before-label": E((e) => [b(t.$slots, "row-before-label", l({ ref_for: !0 }, e), void 0, !0)]),
			"row-after-label": E((e) => [b(t.$slots, "row-after-label", l({ ref_for: !0 }, e), void 0, !0)]),
			_: 3
		}, 8, [
			"node",
			"expanded",
			"cache",
			"key-of",
			"dir-of",
			"name-of",
			"label-class",
			"row-class",
			"pick-on-row-click",
			"texts"
		]))), 128)), k.value.truncated ? (g(), i("p", Q, S(m.value.truncated), 1)) : r("", !0)], 64)) : (g(), i("p", ue, S(m.value.rootEmpty), 1))], 64))]));
	}
}, [["__scopeId", "data-v-d9b74bb2"]]), $ = "dvcsx-resizing";
function fe({ area: e, initial: t, min: n = 0, max: r = 100, rightMin: i = 0, axis: a = "x", unit: o = "px", persist: s = "" }) {
	let c = v(f()), l = v(!1), u = 0, d = 0;
	function f() {
		if (!s) return t;
		try {
			let e = Number(window.localStorage.getItem(s));
			return Number.isFinite(e) && e > 0 ? e : t;
		} catch {
			return t;
		}
	}
	function p(t) {
		let s = r;
		if (o === "px" && e.value) {
			let t = a === "x" ? e.value.clientWidth : e.value.clientHeight;
			t && (s = Math.max(n, t - i));
		}
		return Math.min(Math.max(t, n), s);
	}
	function h(t) {
		let n = e.value;
		if (!n) return;
		let r = a === "x" ? n.clientWidth : n.clientHeight;
		if (!r) return;
		let i = (a === "x" ? t.clientX : t.clientY) - u;
		c.value = p(d + (o === "pct" ? i / r * 100 : i));
	}
	function g() {
		l.value && (l.value = !1, window.removeEventListener("pointermove", h), document.body.classList.remove($));
	}
	function _(t) {
		t.button === 0 && e.value && (l.value = !0, u = a === "x" ? t.clientX : t.clientY, d = c.value, t.preventDefault(), document.body.classList.add($), window.addEventListener("pointermove", h), window.addEventListener("pointerup", g, { once: !0 }));
	}
	function y() {
		c.value = t;
	}
	return w(c, (e) => {
		if (s) try {
			window.localStorage.setItem(s, String(e));
		} catch {}
	}), m(g), {
		size: c,
		resizing: l,
		start: _,
		stop: g,
		reset: y
	};
}
// src/composables/useFileTree.js
function pe(e, n = () => ({})) {
	let r = _({});
	function i() {
		let t = typeof e == "function" ? e() : C(e);
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
export { R as DirectoryNode, U as DirectoryPicker, de as FileTree, j as LogView, q as fileIcon, pe as useFileTree, fe as useSplitPane };
