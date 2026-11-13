import { t as e } from "./_plugin-vue_export-helper-Djzt4Yr7.js";
import { highlightCode as t, languageOf as n } from "./highlight.js";
import { Fragment as r, computed as i, createBlock as a, createCommentVNode as o, createElementBlock as s, createElementVNode as c, createTextVNode as l, createVNode as u, guardReactiveProps as d, mergeProps as f, nextTick as p, normalizeClass as m, normalizeProps as h, normalizeStyle as g, onBeforeUnmount as _, onMounted as v, openBlock as y, reactive as b, ref as x, renderList as S, renderSlot as C, resolveComponent as w, toDisplayString as T, unref as E, watch as D, watchEffect as O, withCtx as k, withKeys as A, withModifiers as j } from "vue";
import { Terminal as M } from "@xterm/xterm";
import { FitAddon as N } from "@xterm/addon-fit";
var P = /*#__PURE__*/ e({
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
		}, r = x(null), i = null, a = null, o = null, c = "";
		function l(e) {
			return e ? n.deeper : n.normal;
		}
		function u(e) {
			return t.colorize(e);
		}
		function d(e, t) {
			i.reset(), i.write(u(e), () => {
				i && (t == null ? i.scrollToBottom() : i.scrollToLine(Math.min(t, Math.max(0, i.buffer.active.length - 1))));
			});
		}
		function f(e) {
			if (i && e !== c) {
				if (c && e.startsWith(c)) {
					let t = i.buffer.active.viewportY >= i.buffer.active.baseY, n = e.slice(c.length);
					c = e, i.write(u(n), () => {
						i && t && i.scrollToBottom();
					});
				} else if (c && e.endsWith(c)) {
					let t = (e.slice(0, e.length - c.length).match(/\n/g) || []).length, n = i.buffer.active.viewportY + t;
					c = e, d(e, n);
				} else c = e, d(e);
			}
		}
		function p(e) {
			return e.type !== "keydown" || e.altKey || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "c" || !i.hasSelection() ? !0 : (navigator.clipboard?.writeText(i.getSelection()).catch(() => {}), !1);
		}
		return v(() => {
			i = new M({
				convertEol: !0,
				disableStdin: !0,
				cursorBlink: !1,
				scrollback: 5e3,
				fontFamily: "'JetBrains Mono', 'Noto Sans Mono CJK SC', 'Sarasa Mono SC', 'Cascadia Mono', Consolas, Menlo, monospace",
				fontSize: 12,
				lineHeight: 1.3,
				theme: l(t.dark)
			}), a = new N(), i.loadAddon(a), i.open(r.value), requestAnimationFrame(() => i && a.fit()), document.fonts && document.fonts.load("12px 'JetBrains Mono'").then(() => i && a.fit()).catch(() => {}), o = new ResizeObserver(() => {
				i && a.fit();
			}), o.observe(r.value), i.attachCustomKeyEventHandler(p), f(t.text || "");
		}), D(() => t.text, (e) => f(e || "")), D(() => t.dark, (e) => {
			i && (i.options.theme = l(e));
		}), _(() => {
			o && o.disconnect(), i && i.dispose(), o = null, i = null;
		}), (t, n) => (y(), s("div", {
			ref_key: "host",
			ref: r,
			class: m(["term", { deeper: e.dark }]),
			style: g(e.height ? {
				height: e.height,
				flex: "0 0 auto"
			} : null)
		}, null, 6));
	}
}, [["__scopeId", "data-v-6c5d0f49"]]), F = { class: "node" }, I = ["title"], ee = {
	key: 0,
	class: "kids"
}, L = {
	key: 0,
	class: "hint"
}, R = {
	key: 1,
	class: "hint bad"
}, te = {
	key: 0,
	class: "hint"
}, z = /*#__PURE__*/ e({
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
	setup(e, { emit: t }) {
		let n = e, i = t, d = x(!1), f = x(!1), h = x(""), g = x(null);
		D(() => n.selected === n.node.path, (e) => {
			e && p(() => g.value && g.value.scrollIntoView({ block: "nearest" }));
		}, { immediate: !0 });
		async function _() {
			i("pick", n.node), d.value || (d.value = !0, await b());
		}
		async function v() {
			d.value = !d.value, d.value && await b();
		}
		async function b() {
			if (!(n.node.children || f.value)) {
				f.value = !0, h.value = "";
				try {
					let e = await n.loader(n.node.path);
					n.node.children = e.entries;
				} catch (e) {
					h.value = e.message;
				} finally {
					f.value = !1;
				}
			}
		}
		return (t, n) => {
			let i = w("v-icon"), p = w("v-btn"), b = w("DirectoryNode", !0);
			return y(), s("div", F, [c("div", {
				ref_key: "rowEl",
				ref: g,
				class: m(["row", { selected: e.node.path === e.selected }]),
				onClick: _
			}, [
				u(p, {
					icon: !0,
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: d.value ? "收起" : "展开",
					onClick: j(v, ["stop"])
				}, {
					default: k(() => [u(i, { size: "18" }, {
						default: k(() => [l(T(d.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"]),
				u(i, {
					size: "18",
					class: "folder"
				}, {
					default: k(() => [...n[1] ||= [l("mdi-folder-outline", -1)]]),
					_: 1
				}),
				c("span", {
					class: "label",
					title: e.node.path
				}, T(e.node.name), 9, I)
			], 2), d.value ? (y(), s("div", ee, [f.value ? (y(), s("p", L, "正在读取…")) : h.value ? (y(), s("p", R, T(h.value), 1)) : e.node.children ? (y(), s(r, { key: 2 }, [(y(!0), s(r, null, S(e.node.children, (r) => (y(), a(b, {
				key: r.path,
				node: r,
				selected: e.selected,
				loader: e.loader,
				onPick: n[0] ||= (e) => t.$emit("pick", e)
			}, null, 8, [
				"node",
				"selected",
				"loader"
			]))), 128)), e.node.children.length ? o("", !0) : (y(), s("p", te, "没有子目录"))], 64)) : o("", !0)])) : o("", !0)]);
		};
	}
}, [["__scopeId", "data-v-08667ca3"]]), ne = { class: "picker" }, re = {
	key: 0,
	class: "tip"
}, B = { class: "tree" }, V = { class: "root" }, H = ["title"], U = {
	key: 0,
	class: "hint bad"
}, W = {
	key: 0,
	class: "hint"
}, G = /*#__PURE__*/ e({
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
	setup(e, { emit: t }) {
		let n = e, d = t, f = x(""), p = x(null), m = x(!0), h = x(""), g = i({
			get: () => n.modelValue,
			set: (e) => d("update:modelValue", e)
		}), _ = i(() => {
			let e = String(n.modelValue || "").trim();
			return e === "~" ? e = f.value : e.startsWith("~/") && (e = f.value + e.slice(1)), e.replace(/\/+$/, "");
		}), b = i(() => !f.value || !_.value ? !1 : _.value === f.value || _.value.startsWith(f.value + "/"));
		O(() => d("update:valid", b.value));
		function C(e) {
			g.value = e.path;
		}
		return v(async () => {
			try {
				let e = await n.loader();
				f.value = e.home, p.value = e.entries.map((e) => ({
					...e,
					children: null
				}));
			} catch (e) {
				h.value = e.message;
			} finally {
				m.value = !1;
			}
		}), (t, n) => {
			let i = w("v-text-field"), d = w("v-icon"), v = w("v-progress-circular");
			return y(), s("div", ne, [
				e.tip ? (y(), s("p", re, T(e.tip), 1)) : o("", !0),
				u(i, {
					modelValue: g.value,
					"onUpdate:modelValue": n[0] ||= (e) => g.value = e,
					label: e.label,
					placeholder: e.placeholder,
					"prepend-inner-icon": "mdi-folder",
					error: !!e.modelValue && !b.value,
					"error-messages": e.modelValue && !b.value ? "只能添加家目录内的目录" : "",
					"hide-details": "auto",
					autofocus: ""
				}, null, 8, [
					"modelValue",
					"label",
					"placeholder",
					"error",
					"error-messages"
				]),
				c("div", B, [c("div", V, [
					u(d, { size: "18" }, {
						default: k(() => [...n[1] ||= [l("mdi-home-outline", -1)]]),
						_: 1
					}),
					c("span", {
						class: "root-label",
						title: f.value || "~"
					}, "~", 8, H),
					m.value ? (y(), a(v, {
						key: 0,
						size: "12",
						width: "2",
						indeterminate: ""
					})) : o("", !0)
				]), h.value ? (y(), s("p", U, T(h.value), 1)) : p.value ? (y(), s(r, { key: 1 }, [(y(!0), s(r, null, S(p.value, (t) => (y(), a(z, {
					key: t.path,
					node: t,
					selected: _.value,
					loader: e.loader,
					onPick: C
				}, null, 8, [
					"node",
					"selected",
					"loader"
				]))), 128)), p.value.length ? o("", !0) : (y(), s("p", W, "家目录下没有子目录"))], 64)) : o("", !0)])
			]);
		};
	}
}, [["__scopeId", "data-v-0926921f"]]), K = {
	icon: "mdi-file-outline",
	color: ""
}, q = {
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
}, J = {
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
function Y(e) {
	let t = String(e || "").split("/").pop().toLowerCase(), n = q[t];
	if (n) return n;
	let r = t.lastIndexOf(".");
	return r < 0 ? K : J[t.slice(r + 1)] || K;
}
// src/components/FileTreeNode.vue
var X = { class: "branch" }, ie = {
	key: 1,
	class: "arrow-space"
}, ae = ["title"], oe = {
	key: 0,
	class: "hint"
}, se = {
	key: 1,
	class: "hint bad"
}, ce = {
	key: 2,
	class: "hint"
}, le = {
	key: 0,
	class: "hint"
}, Z = /*#__PURE__*/ e({
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
	setup(e, { emit: t }) {
		let n = e, d = t, p = {
			loading: "正在读取…",
			empty: "空目录",
			truncated: "这一层文件太多，只列了前面一部分。"
		}, h = i(() => ({
			...p,
			...n.texts
		})), _ = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, v = i(() => n.keyOf(n.node)), b = i(() => n.dirOf(n.node)), x = i(() => n.expanded[v.value] === !0), E = i(() => n.cache[v.value] || _), D = i(() => b.value ? null : Y(n.nameOf(n.node))), O = i(() => b.value ? x.value ? "mdi-folder-open-outline" : "mdi-folder-outline" : D.value.icon), A = i(() => b.value ? null : D.value.color ? { color: D.value.color } : null);
		function M() {
			n.pickOnRowClick && (b.value ? d("toggle", v.value) : d("pick", n.node));
		}
		return (t, n) => {
			let i = w("v-icon"), p = w("v-btn"), _ = w("FileTreeNode", !0);
			return y(), s("div", X, [c("div", {
				class: m(["row", [e.rowClass ? e.rowClass(e.node) : null, { clickable: e.pickOnRowClick }]]),
				style: g({ paddingLeft: 4 + e.depth * 14 + "px" }),
				onClick: M
			}, [
				b.value ? (y(), a(p, {
					key: 0,
					icon: "",
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: x.value ? "收起" : "展开",
					onClick: n[0] ||= j((e) => d("toggle", v.value), ["stop"])
				}, {
					default: k(() => [u(i, { size: "16" }, {
						default: k(() => [l(T(x.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"])) : (y(), s("span", ie)),
				u(i, {
					size: "16",
					class: m(b.value ? "folder" : "file"),
					style: g(A.value)
				}, {
					default: k(() => [l(T(O.value), 1)]),
					_: 1
				}, 8, ["class", "style"]),
				C(t.$slots, "row-before-label", {
					node: e.node,
					open: x.value,
					state: E.value
				}, void 0, !0),
				c("span", {
					class: m(["label", e.labelClass]),
					title: v.value
				}, T(e.nameOf(e.node)), 11, ae),
				C(t.$slots, "row-after-label", {
					node: e.node,
					open: x.value,
					state: E.value
				}, void 0, !0)
			], 6), b.value && x.value ? (y(), s(r, { key: 0 }, [E.value.loading ? (y(), s("p", oe, T(h.value.loading), 1)) : E.value.error ? (y(), s("p", se, T(E.value.error), 1)) : E.value.entries.length ? (y(), s(r, { key: 3 }, [(y(!0), s(r, null, S(E.value.entries, (r) => (y(), a(_, {
				key: e.keyOf(r),
				node: r,
				depth: e.depth + 1,
				expanded: e.expanded,
				cache: e.cache,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: n[1] ||= (e) => d("toggle", e),
				onPick: n[2] ||= (e) => d("pick", e)
			}, {
				"row-before-label": k((e) => [C(t.$slots, "row-before-label", f({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": k((e) => [C(t.$slots, "row-after-label", f({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), E.value.truncated ? (y(), s("p", le, T(h.value.truncated), 1)) : o("", !0)], 64)) : (y(), s("p", ce, T(h.value.empty), 1))], 64)) : o("", !0)]);
		};
	}
}, [["__scopeId", "data-v-0429b63a"]]), ue = { class: "file-tree" }, de = {
	key: 0,
	class: "hint"
}, fe = {
	key: 1,
	class: "hint bad"
}, pe = {
	key: 2,
	class: "hint"
}, me = {
	key: 0,
	class: "hint"
}, he = /*#__PURE__*/ e({
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
	setup(e, { expose: t, emit: n }) {
		let c = e, l = n, u = {
			loading: "正在读取…",
			empty: "空目录",
			truncated: "这一层文件太多，只列了前面一部分。",
			rootLoading: "正在读取目录…",
			rootEmpty: "空目录"
		}, p = i(() => ({
			...u,
			...c.texts
		})), m = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, g = b({}), _ = b({}), w = x(!1), E = i(() => c.root ? c.keyOf(c.root) : ""), O = i(() => _[E.value] || m);
		async function A(e, t = !1) {
			if (!t && _[e]) return;
			_[e] || (_[e] = {
				loading: !1,
				error: "",
				entries: [],
				truncated: !1
			});
			let n = _[e];
			n.loading = !0, n.error = "";
			try {
				let t = await c.loader(e);
				n.entries = t.entries || [], n.truncated = t.truncated || !1;
			} catch (e) {
				n.error = e.message, n.entries = [];
			} finally {
				n.loading = !1;
			}
		}
		function j(e) {
			g[e] = !g[e], g[e] && A(e);
		}
		async function M(e) {
			g[E.value] = !0, await A(E.value);
			let t = E.value;
			for (let n of String(e || "").split("/").filter(Boolean)) t = t ? `${t}/${n}` : n, await A(t), g[t] = !0;
		}
		function N() {
			for (let e of Object.keys(_)) delete _[e];
			for (let e of Object.keys(g)) delete g[e];
			g[E.value] = !0, A(E.value);
		}
		async function P(e) {
			await A(e, !0);
		}
		async function F() {
			await Promise.all(Object.keys(_).map((e) => A(e, !0)));
		}
		function I() {
			c.active && !w.value && (w.value = !0, g[E.value] = !0, A(E.value));
		}
		return c.active && I(), v(I), D(() => c.active, (e) => {
			e && I();
		}), t({
			reveal: M,
			reload: N,
			reloadDir: P,
			refreshAll: F,
			toggle: j
		}), (t, n) => (y(), s("div", ue, [e.root ? (y(), a(Z, {
			key: 0,
			node: e.root,
			depth: 0,
			expanded: g,
			cache: _,
			"key-of": e.keyOf,
			"dir-of": e.dirOf,
			"name-of": e.nameOf,
			"label-class": e.labelClass,
			"row-class": e.rowClass,
			"pick-on-row-click": e.pickOnRowClick,
			texts: e.texts,
			onToggle: j,
			onPick: n[0] ||= (e) => l("pick", e)
		}, {
			"row-before-label": k((e) => [C(t.$slots, "row-before-label", h(d(e)), void 0, !0)]),
			"row-after-label": k((e) => [C(t.$slots, "row-after-label", h(d(e)), void 0, !0)]),
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
		])) : (y(), s(r, { key: 1 }, [O.value.loading ? (y(), s("p", de, T(p.value.rootLoading), 1)) : O.value.error ? (y(), s("p", fe, T(O.value.error), 1)) : O.value.entries.length ? (y(), s(r, { key: 3 }, [(y(!0), s(r, null, S(O.value.entries, (r) => (y(), a(Z, {
			key: e.keyOf(r),
			node: r,
			depth: 0,
			expanded: g,
			cache: _,
			"key-of": e.keyOf,
			"dir-of": e.dirOf,
			"name-of": e.nameOf,
			"label-class": e.labelClass,
			"row-class": e.rowClass,
			"pick-on-row-click": e.pickOnRowClick,
			texts: e.texts,
			onToggle: j,
			onPick: n[1] ||= (e) => l("pick", e)
		}, {
			"row-before-label": k((e) => [C(t.$slots, "row-before-label", f({ ref_for: !0 }, e), void 0, !0)]),
			"row-after-label": k((e) => [C(t.$slots, "row-after-label", f({ ref_for: !0 }, e), void 0, !0)]),
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
		]))), 128)), O.value.truncated ? (y(), s("p", me, T(p.value.truncated), 1)) : o("", !0)], 64)) : (y(), s("p", pe, T(p.value.rootEmpty), 1))], 64))]));
	}
}, [["__scopeId", "data-v-d9b74bb2"]]), ge = { class: "edit-body" }, _e = { class: "edit-stage" }, ve = {
	class: "layer-code",
	"aria-hidden": "true"
}, ye = ["innerHTML"], be = ["value", "onKeydown"], xe = /*#__PURE__*/ e({
	__name: "EditorPane",
	props: {
		modelValue: {
			type: String,
			default: ""
		},
		highlighted: {
			type: String,
			default: ""
		},
		lineCount: {
			type: Number,
			default: 1
		}
	},
	emits: ["update:modelValue"],
	setup(e, { expose: t, emit: n }) {
		let i = e, a = n, o = x(null), l = x(null), u = x(null);
		function d(e) {
			l.value && (l.value.style.transform = `translate(${-e.scrollLeft}px, ${-e.scrollTop}px)`), o.value && (o.value.scrollTop = e.scrollTop);
		}
		function f(e) {
			d(e.target);
		}
		function m(e) {
			let t = e.target, n = t.selectionStart, r = t.selectionEnd;
			a("update:modelValue", `${i.modelValue.slice(0, n)}    ${i.modelValue.slice(r)}`), p(() => {
				t.selectionStart = n + 4, t.selectionEnd = n + 4;
			});
		}
		function h() {
			let e = u.value;
			e && (e.scrollTop = 0, e.scrollLeft = 0, d(e));
		}
		async function g(e) {
			await p();
			let t = u.value;
			if (!t) return;
			let n = i.modelValue.split("\n"), r = Math.min(Math.max(Number(e) || 1, 1), n.length), a = 0;
			for (let e = 0; e < r - 1; e += 1) a += n[e].length + 1;
			t.focus(), t.setSelectionRange(a, a + n[r - 1].length);
			let o = parseFloat(getComputedStyle(t).lineHeight) || 20;
			t.scrollTop = Math.max(0, (r - 1) * o - t.clientHeight / 3), d(t);
		}
		return t({
			resetScroll: h,
			locate: g
		}), (t, n) => (y(), s("div", ge, [c("div", {
			ref_key: "gutterRef",
			ref: o,
			class: "gutter",
			"aria-hidden": "true"
		}, [(y(!0), s(r, null, S(e.lineCount, (e) => (y(), s("div", {
			key: e,
			class: "ln"
		}, T(e), 1))), 128))], 512), c("div", _e, [c("pre", ve, [c("code", {
			ref_key: "codeRef",
			ref: l,
			innerHTML: e.highlighted
		}, null, 8, ye)]), c("textarea", {
			ref_key: "editorRef",
			ref: u,
			value: e.modelValue,
			class: "editor",
			wrap: "off",
			spellcheck: "false",
			onInput: n[0] ||= (e) => t.$emit("update:modelValue", e.target.value),
			onScroll: f,
			onKeydown: A(j(m, ["prevent"]), ["tab"])
		}, null, 40, be)])]));
	}
}, [["__scopeId", "data-v-d7e19f41"]]), Se = { class: "file-head" }, Ce = { class: "crumbs" }, we = ["title", "onClick"], Te = { class: "meta" }, Ee = /*#__PURE__*/ e({
	__name: "FileHead",
	props: {
		rootName: {
			type: String,
			default: "/"
		},
		path: {
			type: String,
			default: ""
		},
		size: {
			type: Number,
			default: void 0
		}
	},
	emits: ["navigate"],
	setup(e, { emit: t }) {
		let n = e, a = t, o = i(() => {
			let e = String(n.path || "").split("/").filter(Boolean), t = "";
			return e.map((e) => (t = t ? `${t}/${e}` : e, {
				name: e,
				path: t
			}));
		}), l = i(() => {
			if (n.size === void 0 || n.size === null) return "";
			let e = Number(n.size) || 0;
			return e < 1024 ? `${e} 字节` : e < 1048576 ? `${(e / 1024).toFixed(1)} KB` : `${(e / 1024 / 1024).toFixed(1)} MB`;
		});
		function u(e, t) {
			t !== o.value.length - 1 && a("navigate", e.path);
		}
		return (t, n) => (y(), s("div", Se, [c("nav", Ce, [c("button", {
			class: "seg",
			title: "回到根目录",
			onClick: n[0] ||= (e) => a("navigate", "")
		}, T(e.rootName), 1), (y(!0), s(r, null, S(o.value, (e, t) => (y(), s(r, { key: e.path }, [n[1] ||= c("span", { class: "sep" }, "/", -1), c("button", {
			class: m(["seg", { last: t === o.value.length - 1 }]),
			title: e.path,
			onClick: (n) => u(e, t)
		}, T(e.name), 11, we)], 64))), 128))]), c("span", Te, T(l.value), 1)]));
	}
}, [["__scopeId", "data-v-66fcb71a"]]), De = /*#__PURE__*/ e({
	__name: "SaveLeaveDialog",
	props: {
		modelValue: {
			type: Boolean,
			default: !1
		},
		path: {
			type: String,
			default: ""
		}
	},
	emits: ["answer"],
	setup(e, { emit: t }) {
		let n = t;
		return (t, r) => {
			let i = w("v-card-title"), o = w("v-card-text"), s = w("v-spacer"), d = w("v-btn"), f = w("v-card-actions"), p = w("v-card"), m = w("v-dialog");
			return y(), a(m, {
				"model-value": e.modelValue,
				"max-width": "440",
				"onUpdate:modelValue": r[2] ||= (e) => !e && n("answer", !1)
			}, {
				default: k(() => [u(p, null, {
					default: k(() => [
						u(i, null, {
							default: k(() => [...r[3] ||= [l("文件还没保存", -1)]]),
							_: 1
						}),
						u(o, null, {
							default: k(() => [l(T(e.path || "当前文件") + " ", 1), r[4] ||= c("p", { class: "tip" }, "换过去之后这次的修改就没了，要保留就先按 Ctrl+S 保存。", -1)]),
							_: 1
						}),
						u(f, null, {
							default: k(() => [
								u(s),
								u(d, {
									variant: "text",
									onClick: r[0] ||= (e) => n("answer", !1)
								}, {
									default: k(() => [...r[5] ||= [l("留在这里", -1)]]),
									_: 1
								}),
								u(d, {
									color: "error",
									variant: "flat",
									onClick: r[1] ||= (e) => n("answer", !0)
								}, {
									default: k(() => [...r[6] ||= [l("丢掉修改", -1)]]),
									_: 1
								})
							]),
							_: 1
						})
					]),
					_: 1
				})]),
				_: 1
			}, 8, ["model-value"]);
		};
	}
}, [["__scopeId", "data-v-aeec6b84"]]);
// src/components/FileEditor/useFileEditor.js
function Oe({ loader: e, saver: r }) {
	let a = x(""), o = b({
		base: "",
		draft: "",
		loading: !1,
		error: "",
		saving: !1,
		saveError: ""
	}), s = 0, c = i(() => o.draft !== o.base), l = i(() => n(a.value)), u = i(() => o.draft.endsWith("\n") ? o.draft.slice(0, -1) : o.draft), d = i(() => o.draft.split("\n").length), f = i(() => t(u.value, l.value));
	async function p(t) {
		a.value = t;
		let n = ++s;
		o.loading = !0, o.error = "", o.saveError = "", o.base = "", o.draft = "";
		try {
			let r = await e(t);
			return n === s && (o.base = (r.text || "").replace(/\r\n?/g, "\n"), o.draft = o.base, !0);
		} catch (e) {
			return n === s && (o.error = e.message), !1;
		} finally {
			n === s && (o.loading = !1);
		}
	}
	async function m() {
		if (o.saving || !c.value || !a.value) return null;
		let e = a.value;
		o.saving = !0, o.saveError = "";
		try {
			let t = await r(e, o.draft);
			return a.value === e && (o.base = o.draft), t;
		} catch (t) {
			return a.value === e && (o.saveError = t.message), null;
		} finally {
			o.saving = !1;
		}
	}
	function h() {
		s += 1, a.value = "", o.base = "", o.draft = "", o.loading = !1, o.error = "", o.saving = !1, o.saveError = "";
	}
	return {
		path: a,
		state: o,
		dirty: c,
		lineCount: d,
		highlighted: f,
		load: p,
		save: m,
		reset: h
	};
}
// src/components/FileEditor/FileEditor.vue
var Q = { class: "file-editor" }, ke = {
	key: 1,
	class: "hint"
}, Ae = {
	key: 2,
	class: "hint bad"
}, je = {
	key: 3,
	class: "edit-wrap"
}, Me = {
	key: 0,
	class: "hint bad edit-error"
}, Ne = {
	key: 4,
	class: "none"
}, Pe = /*#__PURE__*/ e({
	__name: "FileEditor",
	props: {
		rootName: {
			type: String,
			default: "/"
		},
		size: {
			type: Number,
			default: void 0
		},
		loader: {
			type: Function,
			required: !0
		},
		saver: {
			type: Function,
			required: !0
		}
	},
	emits: ["navigate"],
	setup(e, { expose: t, emit: n }) {
		let r = e, i = n, { path: c, state: l, dirty: d, lineCount: f, highlighted: m, load: h, save: g, reset: v } = Oe({
			loader: r.loader,
			saver: r.saver
		}), b = x(null), S = x(!1), C = null;
		async function w(e, t = 0) {
			return await h(e) ? (await p(), b.value?.resetScroll(), t && b.value?.locate(t), !0) : !1;
		}
		async function D() {
			return !c.value || !await h(c.value) ? !1 : (await p(), b.value?.resetScroll(), !0);
		}
		function O() {
			j(), v();
		}
		function k() {
			return d.value ? S.value ? Promise.resolve(!1) : (S.value = !0, new Promise((e) => {
				C = e;
			})) : Promise.resolve(!0);
		}
		function A(e) {
			if (S.value = !1, !C) return;
			let t = C;
			C = null, t(e);
		}
		function j() {
			A(!1);
		}
		return _(() => A(!1)), t({
			open: w,
			reload: D,
			close: O,
			save: g,
			confirmLeave: k,
			cancelLeave: j,
			dirty: d
		}), (t, n) => (y(), s("section", Q, [
			E(c) ? (y(), a(Ee, {
				key: 0,
				"root-name": e.rootName,
				path: E(c),
				size: e.size,
				onNavigate: n[0] ||= (e) => i("navigate", e)
			}, null, 8, [
				"root-name",
				"path",
				"size"
			])) : o("", !0),
			E(l).loading ? (y(), s("p", ke, "正在读取文件…")) : E(l).error ? (y(), s("p", Ae, T(E(l).error), 1)) : E(c) ? (y(), s("div", je, [E(l).saveError ? (y(), s("p", Me, T(E(l).saveError), 1)) : o("", !0), u(xe, {
				ref_key: "paneRef",
				ref: b,
				modelValue: E(l).draft,
				"onUpdate:modelValue": n[1] ||= (e) => E(l).draft = e,
				highlighted: E(m),
				"line-count": E(f)
			}, null, 8, [
				"modelValue",
				"highlighted",
				"line-count"
			])])) : (y(), s("div", Ne, "从左边选一个文件，右边显示它的内容。")),
			u(De, {
				"model-value": S.value,
				path: E(c),
				onAnswer: A
			}, null, 8, ["model-value", "path"])
		]));
	}
}, [["__scopeId", "data-v-bbe4c0a6"]]), Fe = ["title"], Ie = /*#__PURE__*/ e({
	__name: "SplitHandle",
	props: {
		axis: {
			type: String,
			default: "x"
		},
		active: {
			type: Boolean,
			default: !1
		},
		disabled: {
			type: Boolean,
			default: !1
		},
		title: {
			type: String,
			default: "拖动调整大小，双击还原"
		}
	},
	emits: ["start", "reset"],
	setup(e, { emit: t }) {
		let n = e, r = t;
		function i(e) {
			n.disabled || r("start", e);
		}
		function a() {
			n.disabled || r("reset");
		}
		return (t, n) => (y(), s("div", {
			class: m(["handle", [e.axis, {
				active: !e.disabled && e.active,
				disabled: e.disabled
			}]]),
			title: e.disabled ? "" : e.title,
			onPointerdown: i,
			onDblclick: a
		}, [...n[0] ||= [c("span", { class: "grip" }, null, -1)]], 42, Fe));
	}
}, [["__scopeId", "data-v-84f2ac99"]]), $ = "dvcsx-resizing";
function Le({ area: e, initial: t, min: n = 0, max: r = 100, rightMin: i = 0, axis: a = "x", unit: o = "px", persist: s = "" }) {
	let c = x(f()), l = x(!1), u = 0, d = 0;
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
	function m(t) {
		let n = e.value;
		if (!n) return;
		let r = a === "x" ? n.clientWidth : n.clientHeight;
		if (!r) return;
		let i = (a === "x" ? t.clientX : t.clientY) - u;
		c.value = p(d + (o === "pct" ? i / r * 100 : i));
	}
	function h() {
		l.value && (l.value = !1, window.removeEventListener("pointermove", m), document.body.classList.remove($));
	}
	function g(t) {
		t.button === 0 && e.value && (l.value = !0, u = a === "x" ? t.clientX : t.clientY, d = c.value, t.preventDefault(), document.body.classList.add($), window.addEventListener("pointermove", m), window.addEventListener("pointerup", h, { once: !0 }));
	}
	function v() {
		c.value = t;
	}
	return D(c, (e) => {
		if (s) try {
			window.localStorage.setItem(s, String(e));
		} catch {}
	}), _(h), {
		size: c,
		resizing: l,
		start: g,
		stop: h,
		reset: v
	};
}
// src/composables/useFileTree.js
function Re(e, t = () => ({})) {
	let n = b({});
	function r() {
		let t = typeof e == "function" ? e() : E(e);
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
	function s(e, r) {
		let i = [], a = [...e.dirs.values()].sort((e, t) => e.name.localeCompare(t.name, "zh-CN"));
		for (let e of a) i.push({
			kind: "dir",
			name: e.name,
			path: e.path,
			depth: r,
			count: o(e)
		}), n[e.path] || i.push(...s(e, r + 1));
		let c = [...e.files].sort((e, t) => e.name.localeCompare(t.name, "zh-CN"));
		for (let e of c) i.push({
			kind: "file",
			name: e.name,
			path: e.path,
			depth: r,
			file: e,
			...t(e)
		});
		return i;
	}
	let c = i(() => s(a(r()), 0));
	function l(e) {
		n[e] = !n[e];
	}
	return {
		rows: c,
		collapsed: n,
		toggle: l
	};
}
export { z as DirectoryNode, G as DirectoryPicker, Pe as FileEditor, he as FileTree, P as LogView, Ie as SplitHandle, Y as fileIcon, Re as useFileTree, Le as useSplitPane };
