import { t as e } from "./_plugin-vue_export-helper.js";
import { n as t, r as n, t as r } from "./useToast.js";
import { n as i, t as a } from "./SplitHandle.js";
import { languageOf as o } from "./highlight.js";
import { baseName as s } from "./format.js";
import { symbolAt as c } from "./text.js";
import { Fragment as l, Teleport as u, computed as d, createBlock as f, createCommentVNode as p, createElementBlock as m, createElementVNode as h, createTextVNode as g, createVNode as _, guardReactiveProps as v, mergeProps as y, nextTick as b, normalizeClass as x, normalizeProps as S, normalizeStyle as C, onBeforeUnmount as w, onMounted as T, openBlock as E, reactive as D, ref as O, renderList as k, renderSlot as A, resolveComponent as j, resolveDynamicComponent as M, shallowRef as N, toDisplayString as P, unref as F, vShow as I, watch as L, watchEffect as R, withCtx as z, withDirectives as B, withKeys as ee, withModifiers as V } from "vue";
import { Terminal as te } from "@xterm/xterm";
import { FitAddon as ne } from "@xterm/addon-fit";
import { useLocalStorage as re } from "@vueuse/core";
var ie = /*#__PURE__*/ e({
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
		}, r = O(null), i = null, a = null, o = null, s = "";
		function c(e) {
			return e ? n.deeper : n.normal;
		}
		function l(e) {
			return t.colorize(e);
		}
		function u(e, t) {
			i.reset(), i.write(l(e), () => {
				i && (t == null ? i.scrollToBottom() : i.scrollToLine(Math.min(t, Math.max(0, i.buffer.active.length - 1))));
			});
		}
		function d(e) {
			if (i && e !== s) {
				if (s && e.startsWith(s)) {
					let t = i.buffer.active.viewportY >= i.buffer.active.baseY, n = e.slice(s.length);
					s = e, i.write(l(n), () => {
						i && t && i.scrollToBottom();
					});
				} else if (s && e.endsWith(s)) {
					let t = (e.slice(0, e.length - s.length).match(/\n/g) || []).length, n = i.buffer.active.viewportY + t;
					s = e, u(e, n);
				} else s = e, u(e);
			}
		}
		function f(e) {
			return e.type !== "keydown" || e.altKey || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "c" || !i.hasSelection() ? !0 : (navigator.clipboard?.writeText(i.getSelection()).catch(() => {}), !1);
		}
		return T(() => {
			i = new te({
				convertEol: !0,
				disableStdin: !0,
				cursorBlink: !1,
				scrollback: 5e3,
				fontFamily: "'JetBrains Mono', 'Noto Sans Mono CJK SC', 'Sarasa Mono SC', 'Cascadia Mono', Consolas, Menlo, monospace",
				fontSize: 12,
				lineHeight: 1.3,
				theme: c(t.dark)
			}), a = new ne(), i.loadAddon(a), i.open(r.value), requestAnimationFrame(() => i && a.fit()), document.fonts && document.fonts.load("12px 'JetBrains Mono'").then(() => i && a.fit()).catch(() => {}), o = new ResizeObserver(() => {
				i && a.fit();
			}), o.observe(r.value), i.attachCustomKeyEventHandler(f), d(t.text || "");
		}), L(() => t.text, (e) => d(e || "")), L(() => t.dark, (e) => {
			i && (i.options.theme = c(e));
		}), w(() => {
			o && o.disconnect(), i && i.dispose(), o = null, i = null;
		}), (t, n) => (E(), m("div", {
			ref_key: "host",
			ref: r,
			class: x(["term", { deeper: e.dark }]),
			style: C(e.height ? {
				height: e.height,
				flex: "0 0 auto"
			} : null)
		}, null, 6));
	}
}, [["__scopeId", "data-v-be16b898"]]), ae = { class: "node" }, oe = ["title"], se = {
	key: 0,
	class: "kids"
}, ce = {
	key: 0,
	class: "hint"
}, H = {
	key: 1,
	class: "hint bad"
}, U = {
	key: 0,
	class: "hint"
}, W = /*#__PURE__*/ e({
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
		let n = e, r = t, i = O(!1), a = O(!1), o = O(""), s = O(null);
		L(() => n.selected === n.node.path, (e) => {
			e && b(() => s.value && s.value.scrollIntoView({ block: "nearest" }));
		}, { immediate: !0 });
		async function c() {
			r("pick", n.node), i.value || (i.value = !0, await d());
		}
		async function u() {
			i.value = !i.value, i.value && await d();
		}
		async function d() {
			if (!(n.node.children || a.value)) {
				a.value = !0, o.value = "";
				try {
					let e = await n.loader(n.node.path);
					n.node.children = e.entries;
				} catch (e) {
					o.value = e.message;
				} finally {
					a.value = !1;
				}
			}
		}
		return (t, n) => {
			let r = j("v-icon"), d = j("v-btn"), v = j("DirectoryNode", !0);
			return E(), m("div", ae, [h("div", {
				ref_key: "rowEl",
				ref: s,
				class: x(["row", { selected: e.node.path === e.selected }]),
				onClick: c
			}, [
				_(d, {
					icon: !0,
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: i.value ? "收起" : "展开",
					onClick: V(u, ["stop"])
				}, {
					default: z(() => [_(r, { size: "18" }, {
						default: z(() => [g(P(i.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"]),
				_(r, {
					size: "18",
					class: "folder"
				}, {
					default: z(() => [...n[1] ||= [g("mdi-folder-outline", -1)]]),
					_: 1
				}),
				h("span", {
					class: "label",
					title: e.node.path
				}, P(e.node.name), 9, oe)
			], 2), i.value ? (E(), m("div", se, [a.value ? (E(), m("p", ce, "正在读取…")) : o.value ? (E(), m("p", H, P(o.value), 1)) : e.node.children ? (E(), m(l, { key: 2 }, [(E(!0), m(l, null, k(e.node.children, (r) => (E(), f(v, {
				key: r.path,
				node: r,
				selected: e.selected,
				loader: e.loader,
				onPick: n[0] ||= (e) => t.$emit("pick", e)
			}, null, 8, [
				"node",
				"selected",
				"loader"
			]))), 128)), e.node.children.length ? p("", !0) : (E(), m("p", U, "没有子目录"))], 64)) : p("", !0)])) : p("", !0)]);
		};
	}
}, [["__scopeId", "data-v-9e855642"]]), G = { class: "picker" }, K = {
	key: 0,
	class: "tip"
}, q = { class: "tree" }, J = { class: "root" }, Y = ["title"], le = {
	key: 0,
	class: "hint bad"
}, X = {
	key: 0,
	class: "hint"
}, ue = /*#__PURE__*/ e({
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
		},
		validate: {
			type: Function,
			default: null
		},
		invalidText: {
			type: String,
			default: "只能添加家目录内的目录"
		}
	},
	emits: ["update:modelValue", "update:valid"],
	setup(e, { emit: t }) {
		let n = e, r = t, i = O(""), a = O(null), o = O(!0), s = O(""), c = d({
			get: () => n.modelValue,
			set: (e) => r("update:modelValue", e)
		}), u = d(() => {
			let e = String(n.modelValue || "").trim();
			return e === "~" ? e = i.value : e.startsWith("~/") && (e = i.value + e.slice(1)), e.replace(/\/+$/, "");
		}), v = d(() => !i.value || !u.value ? !1 : n.validate ? !!n.validate(u.value, i.value) : u.value === i.value || u.value.startsWith(i.value + "/"));
		R(() => r("update:valid", v.value));
		function y(e) {
			c.value = e.path;
		}
		return T(async () => {
			try {
				let e = await n.loader();
				i.value = e.home, a.value = e.entries.map((e) => ({
					...e,
					children: null
				}));
			} catch (e) {
				s.value = e.message;
			} finally {
				o.value = !1;
			}
		}), (t, n) => {
			let r = j("v-text-field"), d = j("v-icon"), b = j("v-progress-circular");
			return E(), m("div", G, [
				e.tip ? (E(), m("p", K, P(e.tip), 1)) : p("", !0),
				_(r, {
					modelValue: c.value,
					"onUpdate:modelValue": n[0] ||= (e) => c.value = e,
					label: e.label,
					placeholder: e.placeholder,
					"prepend-inner-icon": "mdi-folder",
					error: !!e.modelValue && !v.value,
					"error-messages": e.modelValue && !v.value ? e.invalidText : "",
					"hide-details": "auto",
					autofocus: ""
				}, null, 8, [
					"modelValue",
					"label",
					"placeholder",
					"error",
					"error-messages"
				]),
				h("div", q, [h("div", J, [
					_(d, { size: "18" }, {
						default: z(() => [...n[1] ||= [g("mdi-home-outline", -1)]]),
						_: 1
					}),
					h("span", {
						class: "root-label",
						title: i.value || "~"
					}, "~", 8, Y),
					o.value ? (E(), f(b, {
						key: 0,
						size: "12",
						width: "2",
						indeterminate: ""
					})) : p("", !0)
				]), s.value ? (E(), m("p", le, P(s.value), 1)) : a.value ? (E(), m(l, { key: 1 }, [(E(!0), m(l, null, k(a.value, (t) => (E(), f(W, {
					key: t.path,
					node: t,
					selected: u.value,
					loader: e.loader,
					onPick: y
				}, null, 8, [
					"node",
					"selected",
					"loader"
				]))), 128)), a.value.length ? p("", !0) : (E(), m("p", X, "家目录下没有子目录"))], 64)) : p("", !0)])
			]);
		};
	}
}, [["__scopeId", "data-v-a4b93ef9"]]), Z = {
	icon: "mdi-file-outline",
	color: ""
}, de = {
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
}, fe = {
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
function Q(e) {
	let t = String(e || "").split("/").pop().toLowerCase(), n = de[t];
	if (n) return n;
	let r = t.lastIndexOf(".");
	return r < 0 ? Z : fe[t.slice(r + 1)] || Z;
}
// src/components/commons/FileTree/FileTreeNode.vue
var pe = { class: "branch" }, me = ["data-path"], he = {
	key: 1,
	class: "arrow-space"
}, ge = ["title"], _e = {
	key: 0,
	class: "hint bad"
}, $ = {
	key: 1,
	class: "hint"
}, ve = {
	key: 0,
	class: "hint"
}, ye = /*#__PURE__*/ e({
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
	emits: [
		"toggle",
		"pick",
		"context"
	],
	setup(e, { emit: t }) {
		let n = e, r = t, i = {
			empty: "空目录",
			truncated: "这一层文件太多，只列了前面一部分。"
		}, a = d(() => ({
			...i,
			...n.texts
		})), o = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, s = d(() => n.keyOf(n.node)), c = d(() => n.dirOf(n.node)), u = d(() => n.expanded[s.value] === !0), v = d(() => n.cache[s.value] || o), b = d(() => c.value ? null : Q(n.nameOf(n.node))), S = d(() => c.value ? u.value ? "mdi-folder-open-outline" : "mdi-folder-outline" : b.value.icon), w = d(() => c.value ? null : b.value.color ? { color: b.value.color } : null);
		function T() {
			n.pickOnRowClick && (c.value ? r("toggle", s.value) : r("pick", n.node));
		}
		function D(e) {
			r("context", {
				node: n.node,
				event: e
			});
		}
		return (t, n) => {
			let i = j("v-icon"), o = j("v-btn"), d = j("v-progress-circular"), b = j("FileTreeNode", !0);
			return E(), m("div", pe, [h("div", {
				class: x(["row", [e.rowClass ? e.rowClass(e.node) : null, { clickable: e.pickOnRowClick }]]),
				"data-path": s.value,
				style: C({ paddingLeft: 4 + e.depth * 14 + "px" }),
				onClick: T,
				onContextmenu: V(D, ["prevent", "stop"])
			}, [
				c.value ? (E(), f(o, {
					key: 0,
					icon: "",
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: u.value ? "收起" : "展开",
					onClick: n[0] ||= V((e) => r("toggle", s.value), ["stop"])
				}, {
					default: z(() => [_(i, { size: "16" }, {
						default: z(() => [g(P(u.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"])) : (E(), m("span", he)),
				c.value && u.value && v.value.loading ? (E(), f(d, {
					key: 2,
					indeterminate: "",
					size: 14,
					width: 2,
					class: "spin"
				})) : (E(), f(i, {
					key: 3,
					size: "16",
					class: x(c.value ? "folder" : "file"),
					style: C(w.value)
				}, {
					default: z(() => [g(P(S.value), 1)]),
					_: 1
				}, 8, ["class", "style"])),
				A(t.$slots, "row-before-label", {
					node: e.node,
					open: u.value,
					state: v.value
				}, void 0, !0),
				h("span", {
					class: x(["label", e.labelClass]),
					title: s.value
				}, P(e.nameOf(e.node)), 11, ge),
				A(t.$slots, "row-after-label", {
					node: e.node,
					open: u.value,
					state: v.value
				}, void 0, !0)
			], 46, me), c.value && u.value ? (E(), m(l, { key: 0 }, [v.value.error ? (E(), m("p", _e, P(v.value.error), 1)) : !v.value.loading && !v.value.entries.length ? (E(), m("p", $, P(a.value.empty), 1)) : (E(), m(l, { key: 2 }, [(E(!0), m(l, null, k(v.value.entries, (i) => (E(), f(b, {
				key: e.keyOf(i),
				node: i,
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
				onToggle: n[1] ||= (e) => r("toggle", e),
				onPick: n[2] ||= (e) => r("pick", e),
				onContext: n[3] ||= (e) => r("context", e)
			}, {
				"row-before-label": z((e) => [A(t.$slots, "row-before-label", y({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": z((e) => [A(t.$slots, "row-after-label", y({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), v.value.truncated ? (E(), m("p", ve, P(a.value.truncated), 1)) : p("", !0)], 64))], 64)) : p("", !0)]);
		};
	}
}, [["__scopeId", "data-v-6f354971"]]);
// src/utils/commons/clipboard.js
async function be(e) {
	if (!e) return !1;
	try {
		if (navigator.clipboard && window.isSecureContext) return await navigator.clipboard.writeText(e), !0;
	} catch {}
	try {
		let t = document.createElement("textarea");
		t.value = e, t.setAttribute("readonly", ""), t.style.position = "fixed", t.style.top = "-1000px", document.body.appendChild(t), t.select();
		let n = document.execCommand("copy");
		return document.body.removeChild(t), n;
	} catch {
		return !1;
	}
}
// src/components/commons/FileTree/FileTree.vue
var xe = {
	key: 0,
	class: "root-loading"
}, Se = {
	key: 1,
	class: "hint bad"
}, Ce = {
	key: 2,
	class: "hint"
}, we = {
	key: 0,
	class: "hint"
}, Te = ["disabled"], Ee = ["disabled"], De = ["disabled"], Oe = /*#__PURE__*/ e({
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
		rootPath: {
			type: String,
			default: ""
		},
		downloadOf: {
			type: Function,
			default: null
		},
		editable: {
			type: Boolean,
			default: !1
		},
		texts: {
			type: Object,
			default: () => ({})
		}
	},
	emits: ["pick", "action"],
	setup(e, { expose: t, emit: n }) {
		let r = e, i = n, a = {
			empty: "空目录",
			truncated: "这一层文件太多，只列了前面一部分。",
			rootEmpty: "空目录",
			copyRel: "复制相对路径",
			copyAbs: "复制绝对路径",
			downloadFile: "下载文件",
			downloadDir: "下载目录（zip）",
			copied: "已复制",
			newFile: "新建文件",
			newDir: "新建目录",
			rename: "重命名",
			delete: "删除"
		}, o = d(() => ({
			...a,
			...r.texts
		})), s = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, c = D({}), x = D({}), M = O(!1), N = O(null), F = d(() => r.root ? r.keyOf(r.root) : ""), I = d(() => x[F.value] || s);
		async function R(e, t = !1) {
			if (!t && x[e]) return;
			x[e] || (x[e] = {
				loading: !1,
				error: "",
				entries: [],
				truncated: !1
			});
			let n = x[e];
			n.loading = !0, n.error = "";
			try {
				let t = await r.loader(e);
				n.entries = t.entries || [], n.truncated = t.truncated || !1;
			} catch (e) {
				n.error = e.message, n.entries = [];
			} finally {
				n.loading = !1;
			}
		}
		function B(e) {
			c[e] = !c[e], c[e] && R(e);
		}
		async function ee(e) {
			c[F.value] = !0, await R(F.value);
			let t = F.value;
			for (let n of String(e || "").split("/").filter(Boolean)) t = t ? `${t}/${n}` : n, await R(t), c[t] = !0;
		}
		function te() {
			return Object.keys(c).filter((e) => c[e]);
		}
		async function ne(e) {
			let t = Array.isArray(e) ? e : [];
			await Promise.all(t.map(async (e) => {
				c[e] = !0, await R(e);
			}));
		}
		function re() {
			for (let e of Object.keys(c)) c[e] = !1;
			c[F.value] = !0;
		}
		function ie() {
			for (let e of Object.keys(x)) delete x[e];
			for (let e of Object.keys(c)) delete c[e];
			c[F.value] = !0, R(F.value);
		}
		async function ae(e) {
			await R(e, !0);
		}
		async function oe() {
			let e = Object.keys(c).filter((e) => c[e]);
			await Promise.all(e.map((e) => R(e, !0)));
		}
		function se(e) {
			let t = N.value ? N.value.querySelectorAll("[data-path]") : [];
			for (let n of t) if (n.dataset.path === e) {
				n.scrollIntoView({ block: "nearest" });
				return;
			}
		}
		async function ce() {
			await Promise.all(Object.keys(x).map((e) => R(e, !0)));
		}
		function H() {
			r.active && !M.value && (M.value = !0, c[F.value] = !0, R(F.value));
		}
		r.active && H(), T(H), L(() => r.active, (e) => {
			e && H();
		});
		let U = D({
			open: !1,
			x: 0,
			y: 0,
			node: null,
			copied: ""
		}), W = O(null), G = 0, K = d(() => U.node ? String(r.keyOf(U.node) || "") : ""), q = d(() => {
			if (!U.node || !r.rootPath) return "";
			let e = r.rootPath.replace(/\/+$/, ""), t = K.value;
			return t ? `${e}/${t}` : e;
		}), J = d(() => U.node ? r.dirOf(U.node) : !1);
		function Y({ node: e, event: t }) {
			U.node = e, U.copied = "", U.x = t.clientX, U.y = t.clientY, U.open = !0, b(le);
		}
		function le() {
			if (!W.value) return;
			let e = W.value.offsetWidth, t = W.value.offsetHeight;
			U.x = Math.max(6, Math.min(U.x, window.innerWidth - e - 6)), U.y = Math.max(6, Math.min(U.y, window.innerHeight - t - 6));
		}
		function X() {
			U.open = !1, U.node = null, U.copied = "", clearTimeout(G);
		}
		async function ue(e) {
			let t = e === "abs" ? q.value : K.value;
			t && await be(t) && (U.copied = e, clearTimeout(G), G = setTimeout(X, 700));
		}
		function Z(e) {
			if (!U.node) return;
			let t = U.node;
			X(), i("action", {
				action: e,
				node: t
			});
		}
		function de() {
			if (!U.node || !r.downloadOf) return;
			let e = U.node, t = r.downloadOf(e);
			if (X(), !t) return;
			let n = r.nameOf(e) || "download", i = document.createElement("a");
			i.href = t, i.download = r.dirOf(e) ? `${n}.zip` : n, i.rel = "noopener", i.style.display = "none", document.body.appendChild(i), i.click(), i.remove();
		}
		function fe(e) {
			W.value && !W.value.contains(e.target) && X();
		}
		function Q(e) {
			e.key === "Escape" && X();
		}
		function pe() {
			U.open && X();
		}
		function me(e) {
			let t = e ? "addEventListener" : "removeEventListener";
			document[t]("mousedown", fe, !0), document[t]("keydown", Q, !0), window[t]("scroll", pe, !0), window[t]("resize", pe);
		}
		return L(() => U.open, (e) => me(e)), w(() => {
			X(), me(!1);
		}), t({
			reveal: ee,
			reload: ie,
			reloadDir: ae,
			reloadExpanded: oe,
			refreshAll: ce,
			scrollTo: se,
			toggle: B,
			collapseAll: re,
			expandedKeys: te,
			restoreExpanded: ne
		}), (t, n) => {
			let r = j("v-progress-circular"), a = j("v-icon");
			return E(), m("div", {
				ref_key: "rootRef",
				ref: N,
				class: "file-tree"
			}, [e.root ? (E(), f(ye, {
				key: 0,
				node: e.root,
				depth: 0,
				expanded: c,
				cache: x,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: B,
				onPick: n[0] ||= (e) => i("pick", e),
				onContext: Y
			}, {
				"row-before-label": z((e) => [A(t.$slots, "row-before-label", S(v(e)), void 0, !0)]),
				"row-after-label": z((e) => [A(t.$slots, "row-after-label", S(v(e)), void 0, !0)]),
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
			])) : (E(), m(l, { key: 1 }, [I.value.loading ? (E(), m("div", xe, [_(r, {
				indeterminate: "",
				size: 14,
				width: 2
			})])) : I.value.error ? (E(), m("p", Se, P(I.value.error), 1)) : I.value.entries.length ? (E(), m(l, { key: 3 }, [(E(!0), m(l, null, k(I.value.entries, (r) => (E(), f(ye, {
				key: e.keyOf(r),
				node: r,
				depth: 0,
				expanded: c,
				cache: x,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: B,
				onPick: n[1] ||= (e) => i("pick", e),
				onContext: Y
			}, {
				"row-before-label": z((e) => [A(t.$slots, "row-before-label", y({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": z((e) => [A(t.$slots, "row-after-label", y({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), I.value.truncated ? (E(), m("p", we, P(o.value.truncated), 1)) : p("", !0)], 64)) : (E(), m("p", Ce, P(o.value.rootEmpty), 1))], 64)), (E(), f(u, { to: "body" }, [U.open ? (E(), m("div", {
				key: 0,
				ref_key: "menuRef",
				ref: W,
				class: "ft-menu",
				style: C({
					left: U.x + "px",
					top: U.y + "px"
				}),
				onContextmenu: n[8] ||= V(() => {}, ["prevent"])
			}, [
				e.editable ? (E(), m(l, { key: 0 }, [
					J.value ? (E(), m("button", {
						key: 0,
						class: "ft-item",
						type: "button",
						onClick: n[2] ||= (e) => Z("create-file")
					}, [_(a, { size: "16" }, {
						default: z(() => [...n[9] ||= [g("mdi-file-plus-outline", -1)]]),
						_: 1
					}), h("span", null, P(o.value.newFile), 1)])) : p("", !0),
					J.value ? (E(), m("button", {
						key: 1,
						class: "ft-item",
						type: "button",
						onClick: n[3] ||= (e) => Z("create-dir")
					}, [_(a, { size: "16" }, {
						default: z(() => [...n[10] ||= [g("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), h("span", null, P(o.value.newDir), 1)])) : p("", !0),
					h("button", {
						class: "ft-item",
						type: "button",
						disabled: !K.value,
						onClick: n[4] ||= (e) => Z("rename")
					}, [_(a, { size: "16" }, {
						default: z(() => [...n[11] ||= [g("mdi-form-textbox", -1)]]),
						_: 1
					}), h("span", null, P(o.value.rename), 1)], 8, Te),
					h("button", {
						class: "ft-item danger",
						type: "button",
						disabled: !K.value,
						onClick: n[5] ||= (e) => Z("delete")
					}, [_(a, { size: "16" }, {
						default: z(() => [...n[12] ||= [g("mdi-trash-can-outline", -1)]]),
						_: 1
					}), h("span", null, P(o.value.delete), 1)], 8, Ee),
					n[13] ||= h("div", { class: "ft-sep" }, null, -1)
				], 64)) : p("", !0),
				h("button", {
					class: "ft-item",
					type: "button",
					disabled: !K.value,
					onClick: n[6] ||= (e) => ue("rel")
				}, [_(a, { size: "16" }, {
					default: z(() => [...n[14] ||= [g("mdi-content-copy", -1)]]),
					_: 1
				}), h("span", null, P(U.copied === "rel" ? o.value.copied : o.value.copyRel), 1)], 8, De),
				e.rootPath ? (E(), m("button", {
					key: 1,
					class: "ft-item",
					type: "button",
					onClick: n[7] ||= (e) => ue("abs")
				}, [_(a, { size: "16" }, {
					default: z(() => [...n[15] ||= [g("mdi-link-variant", -1)]]),
					_: 1
				}), h("span", null, P(U.copied === "abs" ? o.value.copied : o.value.copyAbs), 1)])) : p("", !0),
				e.downloadOf ? (E(), m("button", {
					key: 2,
					class: "ft-item",
					type: "button",
					onClick: de
				}, [_(a, { size: "16" }, {
					default: z(() => [g(P(J.value ? "mdi-folder-zip-outline" : "mdi-download"), 1)]),
					_: 1
				}), h("span", null, P(J.value ? o.value.downloadDir : o.value.downloadFile), 1)])) : p("", !0)
			], 36)) : p("", !0)]))], 512);
		};
	}
}, [["__scopeId", "data-v-43acb3f2"]]), ke = { class: "file-head" }, Ae = { class: "crumbs" }, je = ["title", "onClick"], Me = { class: "meta" }, Ne = /*#__PURE__*/ e({
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
		let n = e, r = t, i = d(() => {
			let e = String(n.path || "").split("/").filter(Boolean), t = "";
			return e.map((e) => (t = t ? `${t}/${e}` : e, {
				name: e,
				path: t
			}));
		}), a = d(() => {
			if (n.size === void 0 || n.size === null) return "";
			let e = Number(n.size) || 0;
			return e < 1024 ? `${e} 字节` : e < 1048576 ? `${(e / 1024).toFixed(1)} KB` : `${(e / 1024 / 1024).toFixed(1)} MB`;
		});
		function o(e, t) {
			t !== i.value.length - 1 && r("navigate", e.path);
		}
		return (t, n) => (E(), m("div", ke, [
			h("nav", Ae, [h("button", {
				class: "seg",
				title: "回到根目录",
				onClick: n[0] ||= (e) => r("navigate", "")
			}, P(e.rootName), 1), (E(!0), m(l, null, k(i.value, (e, t) => (E(), m(l, { key: e.path }, [n[1] ||= h("span", { class: "sep" }, "/", -1), h("button", {
				class: x(["seg", { last: t === i.value.length - 1 }]),
				title: e.path,
				onClick: (n) => o(e, t)
			}, P(e.name), 11, je)], 64))), 128))]),
			A(t.$slots, "actions", {}, void 0, !0),
			h("span", Me, P(a.value), 1)
		]));
	}
}, [["__scopeId", "data-v-0a2775f2"]]), Pe = /*#__PURE__*/ e({
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
		let r = t;
		return (t, i) => {
			let a = j("v-spacer"), o = j("v-btn");
			return E(), f(n, {
				"model-value": e.modelValue,
				"initial-width": 440,
				"initial-height": 280,
				"min-width": 340,
				"min-height": 200,
				"onUpdate:modelValue": i[2] ||= (e) => !e && r("answer", !1)
			}, {
				title: z(() => [...i[3] ||= [g("文件还没保存", -1)]]),
				actions: z(() => [
					_(a),
					_(o, {
						variant: "text",
						onClick: i[0] ||= (e) => r("answer", !1)
					}, {
						default: z(() => [...i[4] ||= [g("留在这里", -1)]]),
						_: 1
					}),
					_(o, {
						color: "error",
						variant: "flat",
						onClick: i[1] ||= (e) => r("answer", !0)
					}, {
						default: z(() => [...i[5] ||= [g("丢掉修改", -1)]]),
						_: 1
					})
				]),
				default: z(() => [g(" " + P(e.path || "当前文件") + " ", 1), i[6] ||= h("p", { class: "tip" }, "换过去之后这次的修改就没了，要保留就先按 Ctrl+S 保存。", -1)]),
				_: 1
			}, 8, ["model-value"]);
		};
	}
}, [["__scopeId", "data-v-d6dcbf86"]]);
// src/components/commons/FileEditor/useFileEditor.js
function Fe({ loader: e, saver: t }) {
	let n = O(""), r = D({
		base: "",
		draft: "",
		loading: !1,
		error: "",
		saving: !1,
		saveError: ""
	}), i = 0, a = d(() => r.draft !== r.base);
	async function o(t) {
		n.value = t;
		let a = ++i;
		r.loading = !0, r.error = "", r.saveError = "", r.base = "", r.draft = "";
		try {
			let n = await e(t);
			return a === i && (r.base = (n.text || "").replace(/\r\n?/g, "\n"), r.draft = r.base, !0);
		} catch (e) {
			return a === i && (r.error = e.message), !1;
		} finally {
			a === i && (r.loading = !1);
		}
	}
	async function s() {
		if (r.saving || !a.value || !n.value) return null;
		let e = n.value;
		r.saving = !0, r.saveError = "";
		try {
			let i = await t(e, r.draft);
			return n.value === e && (r.base = r.draft), i;
		} catch (t) {
			return n.value === e && (r.saveError = t.message), null;
		} finally {
			r.saving = !1;
		}
	}
	function c() {
		r.saving || (r.draft = r.base, r.saveError = "");
	}
	function l() {
		i += 1, n.value = "", r.base = "", r.draft = "", r.loading = !1, r.error = "", r.saving = !1, r.saveError = "";
	}
	return {
		path: n,
		state: r,
		dirty: a,
		load: o,
		save: s,
		discard: c,
		reset: l
	};
}
// src/components/commons/FileEditor/handlers/registry.js
var Ie = {
	markdown: {
		id: "markdown",
		modes: [{
			id: "source",
			title: "源码",
			load: () => import("./MarkdownEditor.js")
		}, {
			id: "render",
			title: "渲染",
			load: () => import("./MarkdownView.js")
		}]
	},
	code: {
		id: "code",
		modes: [{
			id: "source",
			title: "源码",
			load: () => import("./CodeEditor.js")
		}]
	},
	plain: {
		id: "plain",
		modes: [{
			id: "source",
			title: "源码",
			load: () => import("./PlainEditor.js")
		}]
	}
};
function Le(e) {
	let t = o(e);
	return t === "markdown" ? Ie.markdown : t ? Ie.code : Ie.plain;
}
function Re(e) {
	return Le(e).modes;
}
function ze(e, t) {
	return t.some((t) => t.id === e) ? e : "source";
}
function Be(e, t) {
	return t > 0 ? "source" : e;
}
function Ve(e) {
	return {
		mode: "source",
		message: `视图加载失败${e && e.message ? `：${e.message}` : ""}`
	};
}
// src/components/commons/FileEditor/FileEditor.vue
var He = { class: "file-editor" }, Ue = {
	key: 1,
	class: "actions"
}, We = {
	key: 1,
	class: "hint"
}, Ge = {
	key: 3,
	class: "edit-wrap"
}, Ke = {
	key: 0,
	class: "hint bad edit-error"
}, qe = {
	key: 1,
	class: "hint bad edit-error"
}, Je = {
	key: 3,
	class: "hint"
}, Ye = /*#__PURE__*/ e({
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
		markers: {
			type: Object,
			default: () => ({})
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
	emits: [
		"navigate",
		"saved",
		"dirty",
		"definition",
		"menu",
		"rename",
		"caret",
		"edit",
		"hover",
		"hover-end"
	],
	setup(e, { expose: t, emit: n }) {
		let r = e, a = n, { path: o, state: s, dirty: c, load: u, save: h, discard: v, reset: y } = Fe({
			loader: r.loader,
			saver: r.saver
		}), x = O(null);
		L(c, (e) => a("dirty", e));
		let S = O("source"), C = d(() => Re(o.value)), T = d(() => C.value.find((e) => e.id === S.value) || null), D = N(null), A = O(!1), I = O(""), R = 0;
		function B() {
			if (!R) return;
			let e = x.value;
			if (!e || typeof e.locate != "function") return;
			let t = R;
			R = 0, e.locate(t);
		}
		L(C, (e) => {
			S.value = ze(S.value, e);
		}, { immediate: !0 }), L(T, async (e) => {
			if (D.value = null, A.value = !!e, e) {
				I.value = "";
				try {
					let t = await e.load();
					if (T.value !== e) return;
					D.value = t.default, await b(), B();
				} catch (t) {
					if (T.value === e) {
						let e = Ve(t);
						I.value = e.message, S.value = e.mode;
					}
				} finally {
					T.value === e && (A.value = !1);
				}
			}
		}, { immediate: !0 });
		async function ee() {
			let e = o.value, t = await h();
			return t && a("saved", {
				path: e,
				data: t
			}), t;
		}
		function V() {
			v();
		}
		function te(e) {
			a("definition", {
				path: o.value,
				...e
			});
		}
		function ne(e) {
			a("menu", {
				path: o.value,
				...e
			});
		}
		function re(e) {
			a("rename", {
				path: o.value,
				...e
			});
		}
		function ie(e) {
			a("caret", {
				path: o.value,
				...e
			});
		}
		let ae = O(!1), oe = null;
		async function se(e, t = 0) {
			return I.value = "", S.value = Be(S.value, t), R = t, await u(e) ? (await b(), t || x.value?.resetScroll(), B(), !0) : (R = 0, !1);
		}
		async function ce() {
			return !o.value || !await u(o.value) ? !1 : (await b(), x.value?.resetScroll(), !0);
		}
		function H() {
			G(), y();
		}
		function U() {
			return c.value ? ae.value ? Promise.resolve(!1) : (ae.value = !0, new Promise((e) => {
				oe = e;
			})) : Promise.resolve(!0);
		}
		function W(e) {
			if (ae.value = !1, !oe) return;
			let t = oe;
			oe = null, t(e);
		}
		function G() {
			W(!1);
		}
		let K = d(() => s.draft), q = d(() => s.base);
		function J(e) {
			s.draft = e == null ? "" : String(e);
		}
		return w(() => W(!1)), t({
			open: se,
			reload: ce,
			close: H,
			save: ee,
			discard: V,
			confirmLeave: U,
			cancelLeave: G,
			path: o,
			dirty: c,
			text: K,
			base: q,
			restore: J
		}), (t, n) => {
			let r = j("v-btn"), u = j("v-btn-toggle"), d = j("v-chip");
			return E(), m("section", He, [
				F(o) ? (E(), f(Ne, {
					key: 0,
					"root-name": e.rootName,
					path: F(o),
					size: e.size,
					onNavigate: n[1] ||= (e) => a("navigate", e)
				}, {
					actions: z(() => [C.value.length > 1 ? (E(), f(u, {
						key: 0,
						modelValue: S.value,
						"onUpdate:modelValue": n[0] ||= (e) => S.value = e,
						density: "compact",
						variant: "text",
						divided: "",
						mandatory: "",
						class: "views"
					}, {
						default: z(() => [(E(!0), m(l, null, k(C.value, (e) => (E(), f(r, {
							key: e.id,
							value: e.id,
							size: "small"
						}, {
							default: z(() => [g(P(e.title), 1)]),
							_: 2
						}, 1032, ["value"]))), 128))]),
						_: 1
					}, 8, ["modelValue"])) : p("", !0), F(c) && !F(s).loading ? (E(), m("div", Ue, [
						_(d, {
							size: "x-small",
							variant: "flat",
							color: "modified"
						}, {
							default: z(() => [...n[6] ||= [g("未保存", -1)]]),
							_: 1
						}),
						_(r, {
							size: "small",
							variant: "text",
							color: "primary",
							loading: F(s).saving,
							onClick: ee
						}, {
							default: z(() => [...n[7] ||= [g(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"]),
						_(r, {
							size: "small",
							variant: "text",
							disabled: F(s).saving,
							onClick: V
						}, {
							default: z(() => [...n[8] ||= [g(" 放弃 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					])) : p("", !0)]),
					_: 1
				}, 8, [
					"root-name",
					"path",
					"size"
				])) : p("", !0),
				F(s).loading ? (E(), m("p", We, "正在读取文件…")) : F(s).error ? (E(), f(i, {
					key: 2,
					icon: "mdi-file-question-outline",
					"icon-size": 28,
					title: F(s).error,
					hint: "换一个文件试试，或者从左侧目录里下载它。"
				}, null, 8, ["title"])) : F(o) ? (E(), m("div", Ge, [
					I.value ? (E(), m("p", Ke, P(I.value), 1)) : p("", !0),
					F(s).saveError ? (E(), m("p", qe, P(F(s).saveError), 1)) : p("", !0),
					D.value ? (E(), f(M(D.value), {
						key: 2,
						ref_key: "paneRef",
						ref: x,
						modelValue: F(s).draft,
						"onUpdate:modelValue": n[2] ||= (e) => F(s).draft = e,
						path: F(o),
						onSymbol: te,
						onMenu: ne,
						onRename: re,
						onCaret: ie,
						markers: e.markers,
						onEdit: n[3] ||= (e) => t.$emit("edit", { path: F(o) }),
						onHover: n[4] ||= (e) => t.$emit("hover", {
							path: F(o),
							...e
						}),
						onHoverEnd: n[5] ||= (e) => t.$emit("hover-end", { path: F(o) })
					}, null, 40, [
						"modelValue",
						"path",
						"markers"
					])) : A.value ? (E(), m("p", Je, "正在准备视图…")) : p("", !0)
				])) : (E(), f(i, {
					key: 4,
					icon: "mdi-file-outline",
					hint: "从左边选一个文件，右边显示它的内容。"
				})),
				_(Pe, {
					"model-value": ae.value,
					path: F(o),
					onAnswer: W
				}, null, 8, ["model-value", "path"])
			]);
		};
	}
}, [["__scopeId", "data-v-6b41639b"]]), Xe = "";
function Ze(e, t) {
	let n = String(e.parent || "").trim();
	return n && t.has(n) ? n : Xe;
}
function Qe(e, t, n) {
	let r = new Map(t.map((e) => [e.id, e])), i = /* @__PURE__ */ new Set();
	for (let t of e) t && t.kind === "group" && t.id && i.add(t.id);
	let a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), c = [], l = /* @__PURE__ */ new Map(), u = (e, t) => {
		a.has(e) || a.set(e, []), a.get(e).push(t);
	};
	for (let t of e) if (t && t.id) {
		if (t.kind === "ws") {
			if (!r.has(t.id) || o.has(t.id)) continue;
			o.add(t.id), u(Ze(t, i), t);
		} else if (t.kind === "group" && t.name) {
			if (s.has(t.id)) continue;
			s.add(t.id), c.push(t), l.set(t.id, t), u(Ze(t, i), t);
		}
	}
	let d = (e) => {
		let t = e, n = /* @__PURE__ */ new Set();
		for (; t;) {
			if (n.has(t.id)) return !1;
			n.add(t.id);
			let e = Ze(t, i);
			if (!e) return !0;
			t = l.get(e);
		}
		return !0;
	}, f = [], p = /* @__PURE__ */ new Set(), m = (e, t) => {
		for (let i of a.get(e) || []) i.kind === "ws" ? f.push({
			key: `ws:${i.id}`,
			kind: "ws",
			id: i.id,
			depth: t,
			parent: e,
			ws: r.get(i.id)
		}) : p.has(i.id) || (p.add(i.id), f.push({
			key: `group:${i.id}`,
			kind: "group",
			id: i.id,
			depth: t,
			parent: e,
			name: i.name,
			group: i
		}), n.has(i.id) || m(i.id, t + 1));
	};
	m(Xe, 0);
	for (let e of c) p.has(e.id) || d(e) || (p.add(e.id), f.push({
		key: `group:${e.id}`,
		kind: "group",
		id: e.id,
		depth: 0,
		parent: Xe,
		name: e.name,
		group: e
	}), n.has(e.id) || m(e.id, 1));
	for (let e of t) o.has(e.id) || f.push({
		key: `ws:${e.id}`,
		kind: "ws",
		id: e.id,
		depth: 0,
		parent: Xe,
		ws: e
	});
	return f;
}
function $e(e) {
	let t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Set(), r = [];
	for (let r of e) {
		if (!r || r.kind !== "group" || !r.id || !r.name || n.has(r.id)) continue;
		n.add(r.id);
		let e = String(r.parent || "").trim();
		t.has(e) || t.set(e, []), t.get(e).push(r);
	}
	let i = /* @__PURE__ */ new Set(), a = (e, n) => {
		for (let o of t.get(e) || []) i.has(o.id) || (i.add(o.id), r.push({
			id: o.id,
			name: o.name,
			depth: n
		}), a(o.id, n + 1));
	};
	a(Xe, 0);
	for (let e of t.values()) for (let t of e) i.has(t.id) || (i.add(t.id), r.push({
		id: t.id,
		name: t.name,
		depth: 0
	}));
	return r;
}
function et(e, t, n) {
	let r = String(n || ""), i = /* @__PURE__ */ new Set();
	for (; r && !i.has(r);) {
		if (r === t) return !0;
		i.add(r);
		let n = e.find((e) => e && e.kind === "group" && e.id === r);
		r = n ? String(n.parent || "") : "";
	}
	return !1;
}
function tt(e, t, n) {
	let r = new Set(t);
	return r.size ? e.map((e) => e.kind === "ws" && r.has(e.id) ? {
		...e,
		parent: n
	} : e) : e;
}
function nt(e, t) {
	let n = new Set(t.map((e) => e.id)), r = /* @__PURE__ */ new Set(), i = [];
	for (let t of e) {
		if (!t || t.kind !== "group" && t.kind !== "ws" || !t.id || t.kind === "ws" && !n.has(t.id)) continue;
		let e = `${t.kind}:${t.id}`;
		r.has(e) || (r.add(e), i.push({
			...t,
			parent: t.parent || ""
		}));
	}
	for (let e of t) r.has(`ws:${e.id}`) || i.push({
		kind: "ws",
		id: e.id,
		parent: ""
	});
	return i;
}
// src/components/services/WorkspaceList.vue
var rt = { class: "head" }, it = { class: "head-title" }, at = {
	key: 0,
	class: "none"
}, ot = { class: "gtext" }, st = { class: "nm" }, ct = ["onClick"], lt = { class: "tip" }, ut = { class: "tip" }, dt = { class: "tip" }, ft = /*#__PURE__*/ e({
	__name: "WorkspaceList",
	props: {
		workspaces: {
			type: Array,
			required: !0
		},
		current: {
			type: String,
			default: ""
		},
		busy: {
			type: Boolean,
			default: !1
		},
		dirs: {
			type: Function,
			required: !0
		},
		saveAlias: {
			type: Function,
			required: !0
		},
		texts: {
			type: Object,
			default: () => ({})
		},
		groups: {
			type: Array,
			default: () => []
		},
		storageKey: {
			type: String,
			default: ""
		}
	},
	emits: [
		"select",
		"add",
		"remove",
		"changed",
		"notice",
		"groups-change"
	],
	setup(e, { emit: t }) {
		let r = e, i = {
			headTitle: "工作区",
			add: "添加",
			empty: "还没有工作区",
			forgetTitle: "移出工作区",
			menuAlias: "设置别名",
			menuAddInGroup: "新增工作区",
			copyRel: "复制相对路径",
			copyAbs: "复制绝对路径",
			aliasTitle: "设置别名",
			aliasHint: "留空表示不用别名，显示目录名。",
			aliasSaved: "别名已保存",
			aliasFailed: "保存别名失败：",
			copied: "已复制：",
			copyFailed: "复制失败，浏览器不允许访问剪贴板",
			addTitle: "添加工作区",
			addTip: "选工程所在的目录。",
			addLabel: "工程目录",
			addPlaceholder: "~/pros/项目名",
			addConfirm: "添加此目录",
			removeTitle: "移出工作区",
			removeText: "只是从列表里移出，工程目录本身不动。",
			removeConfirm: "移出"
		}, a = d(() => ({
			...i,
			...r.texts
		})), o = t, s = r.storageKey ? re(r.storageKey, [], { writeDefaults: !1 }) : O([]), c = d(() => new Set(Array.isArray(s.value) ? s.value : [])), u = O(null), v = O(null), y = d(() => r.groups.filter((e) => e && e.kind === "group").length), b = d(() => Qe(r.groups, r.workspaces, c.value)), S = d(() => $e(r.groups));
		function M() {
			return nt(r.groups, r.workspaces);
		}
		function N(e, t) {
			return et(r.groups, e, t);
		}
		function I(e) {
			o("groups-change", e);
		}
		function R(e, t, n, r) {
			let i = e.find((e) => e.kind === t && e.id === n);
			i ? i.parent = r : e.push({
				kind: t,
				id: n,
				parent: r
			});
		}
		function B() {
			return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
		}
		function te(e) {
			s.value = [...e];
		}
		function ne(e) {
			if (e.kind !== "group") {
				o("select", e.id);
				return;
			}
			let t = new Set(c.value);
			t.has(e.id) ? t.delete(e.id) : t.add(e.id), te(t);
		}
		function ie(e) {
			if (!c.value.has(e)) return;
			let t = new Set(c.value);
			t.delete(e), te(t);
		}
		function ae(e) {
			let t = u.value, n = v.value, r = (t) => !!n && n.mode === t && n.kind === e.kind && n.id === e.id;
			return {
				"drag-src": !!t && t.kind === e.kind && t.id === e.id,
				"drop-before": r("before"),
				"drop-after": r("after"),
				"drop-into": r("into")
			};
		}
		function oe(e, t) {
			u.value = {
				kind: t.kind,
				id: t.id
			}, v.value = null, e.dataTransfer && (e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("text/plain", t.id));
		}
		function se(e, t) {
			if (!u.value) return;
			let n = u.value;
			if (n.kind === t.kind && n.id === t.id) {
				v.value = null;
				return;
			}
			let r = e.currentTarget.getBoundingClientRect(), i = e.clientY - r.top, a = i > r.height / 2 ? "after" : "before";
			t.kind === "group" && (a = i < r.height * .25 ? "before" : i > r.height * .75 ? "after" : "into"), n.kind === "group" && N(n.id, a === "into" ? t.id : t.parent) ? v.value = null : v.value = {
				kind: t.kind,
				id: t.id,
				mode: a
			};
		}
		function ce() {
			let e = u.value, t = v.value;
			if (!e || !t) return H();
			let n = M(), r = n.findIndex((t) => t.kind === e.kind && t.id === e.id);
			if (r < 0) return H();
			let i = n.splice(r, 1)[0];
			if (t.mode === "into") i.parent = t.id, n.push(i), ie(t.id);
			else {
				let e = n.findIndex((e) => e.kind === t.kind && e.id === t.id);
				e < 0 ? (i.parent = "", n.push(i)) : (i.parent = n[e].parent || "", n.splice(t.mode === "before" ? e : e + 1, 0, i));
			}
			I(n), H();
		}
		function H() {
			u.value = null, v.value = null;
		}
		let U = O(!1), W = O(""), G = O(!1), K = O(0), q = O(null), J = D({
			open: !1,
			x: 0,
			y: 0,
			mode: "blank",
			target: null
		}), Y = O(!1), le = O(null), X = O(""), Z = O(!1), de = O(!1), fe = O(null), Q = O(""), pe = O(!1), me = O(null);
		function he(e) {
			J.x = Math.max(8, Math.min(e.clientX, window.innerWidth - 210)), J.y = Math.max(8, Math.min(e.clientY, window.innerHeight - 160));
		}
		function ge(e, t) {
			he(e), J.mode = t.kind === "group" ? "group" : "ws", J.target = t.kind === "group" ? t.group : t.ws, J.open = !0;
		}
		function _e(e) {
			e.target.closest && e.target.closest(".head") || (he(e), J.mode = "blank", J.target = null, J.open = !0);
		}
		function $() {
			J.open = !1;
		}
		function ve(e) {
			fe.value = { id: e.id }, Q.value = e.name || "", de.value = !0, $();
		}
		function ye() {
			let e = (Q.value || "").trim().slice(0, 80);
			e && fe.value && (I(M().map((t) => t.kind === "group" && t.id === fe.value.id ? {
				...t,
				name: e
			} : t)), de.value = !1);
		}
		function xe() {
			let e = M(), t = {
				kind: "group",
				id: B(),
				name: "新分组",
				parent: ""
			};
			e.push(t), I(e), $(), ve(t);
		}
		function Se() {
			let e = J.target;
			if (!e) return;
			let t = M(), n = {
				kind: "group",
				id: B(),
				name: "新分组",
				parent: e.id
			};
			t.push(n), I(t), ie(e.id), $(), ve(n);
		}
		function Ce() {
			let e = J.target;
			if (!e) return;
			let t = M(), n = {
				kind: "group",
				id: B(),
				name: "新分组",
				parent: ""
			};
			t.push(n), R(t, "ws", e.id, n.id), I(t), $(), ve(n);
		}
		function we(e) {
			if (!J.target) return;
			let t = M();
			R(t, "ws", J.target.id, e), I(t), e && ie(e), $();
		}
		function Te() {
			me.value = J.target, pe.value = !0, $();
		}
		function Ee() {
			let e = me.value ? me.value.id : "";
			if (e) {
				let t = M(), n = t.findIndex((t) => t.kind === "group" && t.id === e);
				if (n >= 0) {
					let r = t[n].parent || "";
					t.splice(n, 1);
					for (let n of t) (n.parent || "") === e && (n.parent = r);
					I(t);
				}
			}
			pe.value = !1;
		}
		function De(e) {
			le.value = e, X.value = e.alias || "", Y.value = !0, $();
		}
		async function Oe() {
			if (le.value) {
				Z.value = !0;
				try {
					await r.saveAlias(le.value.id, (X.value || "").trim()), Y.value = !1, o("changed"), o("notice", {
						text: a.value.aliasSaved,
						color: "primary"
					});
				} catch (e) {
					o("notice", {
						text: `${a.value.aliasFailed}${e.message}`,
						color: "error"
					});
				} finally {
					Z.value = !1;
				}
			}
		}
		async function ke(e, t) {
			let n = t === "rel" && e.rel || e.root, r = await be(n);
			o("notice", {
				text: r ? `${a.value.copied}${n}` : a.value.copyFailed,
				color: r ? "primary" : "error"
			}), $();
		}
		T(() => {
			document.addEventListener("click", $), document.addEventListener("contextmenu", $), window.addEventListener("resize", $), window.addEventListener("blur", $);
		}), w(() => {
			document.removeEventListener("click", $), document.removeEventListener("contextmenu", $), window.removeEventListener("resize", $), window.removeEventListener("blur", $);
		});
		function Ae(e) {
			let t = String(e || "").split("/").filter(Boolean);
			return t.length ? t[t.length - 1] : e;
		}
		let je = O(""), Me = new Set(r.workspaces.map((e) => e.id));
		function Ne(e) {
			J.open = !1, Pe(), je.value = e ? e.id : "";
		}
		L(() => r.workspaces.map((e) => e.id).join(","), () => {
			let e = r.workspaces.filter((e) => !Me.has(e.id)).map((e) => e.id);
			if (Me = new Set(r.workspaces.map((e) => e.id)), !je.value || !e.length) return;
			let t = je.value;
			je.value = "", o("groups-change", tt(nt(r.groups, r.workspaces), e, t));
		});
		function Pe() {
			je.value = "", W.value = "", G.value = !1, K.value += 1, U.value = !0;
		}
		function Fe() {
			let e = W.value.trim();
			e && (U.value = !1, o("add", e));
		}
		function Ie(e) {
			q.value = e;
		}
		function Le() {
			let e = q.value;
			q.value = null, e && o("remove", e.id);
		}
		return (t, r) => {
			let i = j("v-btn"), o = j("v-icon"), s = j("v-list-item-title"), u = j("v-list-item-subtitle"), d = j("v-list-item"), v = j("v-list"), w = j("v-text-field"), T = j("v-spacer");
			return E(), m("div", {
				class: "list",
				onContextmenu: V(_e, ["prevent", "stop"])
			}, [
				h("div", rt, [h("span", it, P(a.value.headTitle), 1), _(i, {
					size: "small",
					variant: "text",
					color: "primary",
					"prepend-icon": "mdi-plus",
					loading: e.busy,
					onClick: Pe
				}, {
					default: z(() => [g(P(a.value.add), 1)]),
					_: 1
				}, 8, ["loading"])]),
				!e.workspaces.length && !y.value ? (E(), m("div", at, P(a.value.empty), 1)) : p("", !0),
				_(v, {
					density: "compact",
					nav: "",
					class: "items",
					onDrop: V(ce, ["prevent"])
				}, {
					default: z(() => [(E(!0), m(l, null, k(b.value, (n) => (E(), f(d, {
						key: n.key,
						active: n.kind === "ws" && n.id === e.current,
						"active-color": "primary",
						draggable: "true",
						style: C({ paddingLeft: `${12 + n.depth * 12}px` }),
						class: x(ae(n)),
						onClick: (e) => ne(n),
						onContextmenu: V((e) => ge(e, n), ["prevent", "stop"]),
						onDragstart: (e) => oe(e, n),
						onDragover: V((e) => se(e, n), ["prevent"]),
						onDragend: H
					}, {
						append: z(() => [n.kind === "ws" ? (E(), f(i, {
							key: 0,
							icon: !0,
							size: "x-small",
							variant: "text",
							title: a.value.forgetTitle,
							class: "forget",
							onClick: V((e) => Ie(n.ws), ["stop"])
						}, {
							default: z(() => [_(o, { size: "18" }, {
								default: z(() => [...r[24] ||= [g("mdi-close", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["title", "onClick"])) : p("", !0)]),
						default: z(() => [n.kind === "group" ? (E(), f(s, {
							key: 0,
							class: "gname"
						}, {
							default: z(() => [
								_(o, { size: "16" }, {
									default: z(() => [g(P(c.value.has(n.id) ? "mdi-chevron-right" : "mdi-chevron-down"), 1)]),
									_: 2
								}, 1024),
								_(o, { size: "16" }, {
									default: z(() => [...r[23] ||= [g("mdi-folder-outline", -1)]]),
									_: 1
								}),
								h("span", ot, P(n.name), 1)
							]),
							_: 2
						}, 1024)) : (E(), m(l, { key: 1 }, [_(s, {
							class: "name",
							title: n.ws.alias ? n.ws.root : ""
						}, {
							default: z(() => [h("span", st, P(n.ws.alias || Ae(n.ws.root)), 1), A(t.$slots, "title-extra", { ws: n.ws }, void 0, !0)]),
							_: 2
						}, 1032, ["title"]), _(u, {
							class: "path",
							title: n.ws.url || n.ws.root
						}, {
							default: z(() => [g(P(n.ws.url || n.ws.root), 1)]),
							_: 2
						}, 1032, ["title"])], 64))]),
						_: 2
					}, 1032, [
						"active",
						"style",
						"class",
						"onClick",
						"onContextmenu",
						"onDragstart",
						"onDragover"
					]))), 128))]),
					_: 3
				}),
				J.open ? (E(), m("div", {
					key: 1,
					class: "ctxmenu",
					style: C({
						left: J.x + "px",
						top: J.y + "px"
					}),
					onClick: r[7] ||= V(() => {}, ["stop"]),
					onContextmenu: r[8] ||= V(() => {}, ["prevent", "stop"])
				}, [J.mode === "ws" ? (E(), m(l, { key: 0 }, [
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[0] ||= (e) => De(J.target)
					}, [_(o, { size: "16" }, {
						default: z(() => [...r[25] ||= [g("mdi-rename-box", -1)]]),
						_: 1
					}), g(P(a.value.menuAlias), 1)]),
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[1] ||= (e) => ke(J.target, "rel")
					}, [_(o, { size: "16" }, {
						default: z(() => [...r[26] ||= [g("mdi-content-copy", -1)]]),
						_: 1
					}), g(P(a.value.copyRel), 1)]),
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[2] ||= (e) => ke(J.target, "abs")
					}, [_(o, { size: "16" }, {
						default: z(() => [...r[27] ||= [g("mdi-content-copy", -1)]]),
						_: 1
					}), g(P(a.value.copyAbs), 1)]),
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[3] ||= (e) => J.mode = "pick"
					}, [
						_(o, { size: "16" }, {
							default: z(() => [...r[28] ||= [g("mdi-folder-move-outline", -1)]]),
							_: 1
						}),
						r[29] ||= g("移到分组 ", -1),
						r[30] ||= h("span", { class: "more" }, "›", -1)
					])
				], 64)) : J.mode === "pick" ? (E(), m(l, { key: 1 }, [
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[4] ||= (e) => we("")
					}, [_(o, { size: "16" }, {
						default: z(() => [...r[31] ||= [g("mdi-format-list-bulleted", -1)]]),
						_: 1
					}), r[32] ||= g("移出分组 ", -1)]),
					(E(!0), m(l, null, k(S.value, (e) => (E(), m("button", {
						key: e.id,
						type: "button",
						class: "ctxitem",
						style: C({ paddingLeft: `${10 + e.depth * 12}px` }),
						onClick: (t) => we(e.id)
					}, [_(o, { size: "16" }, {
						default: z(() => [...r[33] ||= [g("mdi-folder-outline", -1)]]),
						_: 1
					}), g(P(e.name), 1)], 12, ct))), 128)),
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: Ce
					}, [_(o, { size: "16" }, {
						default: z(() => [...r[34] ||= [g("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), r[35] ||= g("新建分组并移入 ", -1)])
				], 64)) : J.mode === "group" ? (E(), m(l, { key: 2 }, [
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[5] ||= (e) => Ne(J.target)
					}, [_(o, { size: "16" }, {
						default: z(() => [...r[36] ||= [g("mdi-plus", -1)]]),
						_: 1
					}), g(P(a.value.menuAddInGroup), 1)]),
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: Se
					}, [_(o, { size: "16" }, {
						default: z(() => [...r[37] ||= [g("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), r[38] ||= g("新建子分组 ", -1)]),
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[6] ||= (e) => ve(J.target)
					}, [_(o, { size: "16" }, {
						default: z(() => [...r[39] ||= [g("mdi-rename-box", -1)]]),
						_: 1
					}), r[40] ||= g("重命名 ", -1)]),
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: Te
					}, [_(o, { size: "16" }, {
						default: z(() => [...r[41] ||= [g("mdi-trash-can-outline", -1)]]),
						_: 1
					}), r[42] ||= g("删除分组 ", -1)])
				], 64)) : (E(), m("button", {
					key: 3,
					type: "button",
					class: "ctxitem",
					onClick: xe
				}, [_(o, { size: "16" }, {
					default: z(() => [...r[43] ||= [g("mdi-folder-plus-outline", -1)]]),
					_: 1
				}), r[44] ||= g("新建分组 ", -1)]))], 36)) : p("", !0),
				_(n, {
					modelValue: Y.value,
					"onUpdate:modelValue": r[11] ||= (e) => Y.value = e,
					"initial-width": 460,
					"initial-height": 320,
					"min-width": 360,
					"min-height": 240
				}, {
					title: z(() => [g(P(a.value.aliasTitle), 1)]),
					actions: z(() => [
						_(T),
						_(i, {
							variant: "text",
							onClick: r[10] ||= (e) => Y.value = !1
						}, {
							default: z(() => [...r[45] ||= [g("取消", -1)]]),
							_: 1
						}),
						_(i, {
							color: "primary",
							variant: "flat",
							loading: Z.value,
							onClick: Oe
						}, {
							default: z(() => [...r[46] ||= [g(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"])
					]),
					default: z(() => [
						h("p", lt, P(le.value ? le.value.root : ""), 1),
						_(w, {
							modelValue: X.value,
							"onUpdate:modelValue": r[9] ||= (e) => X.value = e,
							label: "别名",
							density: "compact",
							variant: "outlined",
							maxlength: "80",
							clearable: "",
							autofocus: "",
							onKeyup: ee(Oe, ["enter"])
						}, null, 8, ["modelValue"]),
						h("p", ut, P(a.value.aliasHint), 1)
					]),
					_: 1
				}, 8, ["modelValue"]),
				_(n, {
					modelValue: de.value,
					"onUpdate:modelValue": r[14] ||= (e) => de.value = e,
					"initial-width": 440,
					"initial-height": 260,
					"min-width": 340,
					"min-height": 200
				}, {
					title: z(() => [...r[47] ||= [g("分组名称", -1)]]),
					actions: z(() => [
						_(T),
						_(i, {
							variant: "text",
							onClick: r[13] ||= (e) => de.value = !1
						}, {
							default: z(() => [...r[48] ||= [g("取消", -1)]]),
							_: 1
						}),
						_(i, {
							color: "primary",
							variant: "flat",
							disabled: !Q.value.trim(),
							onClick: ye
						}, {
							default: z(() => [...r[49] ||= [g(" 保存 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					]),
					default: z(() => [_(w, {
						modelValue: Q.value,
						"onUpdate:modelValue": r[12] ||= (e) => Q.value = e,
						label: "名称",
						density: "compact",
						variant: "outlined",
						maxlength: "80",
						autofocus: "",
						onKeyup: ee(ye, ["enter"])
					}, null, 8, ["modelValue"])]),
					_: 1
				}, 8, ["modelValue"]),
				_(n, {
					modelValue: pe.value,
					"onUpdate:modelValue": r[16] ||= (e) => pe.value = e,
					"initial-width": 440,
					"initial-height": 240,
					"min-width": 340,
					"min-height": 200
				}, {
					title: z(() => [...r[50] ||= [g("删除分组", -1)]]),
					actions: z(() => [
						_(T),
						_(i, {
							variant: "text",
							onClick: r[15] ||= (e) => pe.value = !1
						}, {
							default: z(() => [...r[51] ||= [g("取消", -1)]]),
							_: 1
						}),
						_(i, {
							color: "error",
							variant: "flat",
							onClick: Ee
						}, {
							default: z(() => [...r[52] ||= [g("删除", -1)]]),
							_: 1
						})
					]),
					default: z(() => [g(" " + P(me.value ? me.value.name : "") + " ", 1), r[53] ||= h("p", { class: "tip" }, "里面的子分组与工作区移到上一级，工作区本身不动。", -1)]),
					_: 1
				}, 8, ["modelValue"]),
				_(n, {
					modelValue: U.value,
					"onUpdate:modelValue": r[20] ||= (e) => U.value = e,
					"initial-width": 620,
					"initial-height": 460,
					"min-width": 420,
					"min-height": 300
				}, {
					title: z(() => [g(P(a.value.addTitle), 1)]),
					actions: z(() => [
						_(T),
						_(i, {
							variant: "text",
							onClick: r[19] ||= (e) => U.value = !1
						}, {
							default: z(() => [...r[54] ||= [g("取消", -1)]]),
							_: 1
						}),
						_(i, {
							color: "primary",
							variant: "flat",
							disabled: !W.value.trim() || !G.value,
							onClick: Fe
						}, {
							default: z(() => [g(P(a.value.addConfirm), 1)]),
							_: 1
						}, 8, ["disabled"])
					]),
					default: z(() => [(E(), f(F(ue), {
						key: K.value,
						modelValue: W.value,
						"onUpdate:modelValue": r[17] ||= (e) => W.value = e,
						tip: a.value.addTip,
						label: a.value.addLabel,
						placeholder: a.value.addPlaceholder,
						loader: e.dirs,
						"onUpdate:valid": r[18] ||= (e) => G.value = e
					}, null, 8, [
						"modelValue",
						"tip",
						"label",
						"placeholder",
						"loader"
					]))]),
					_: 1
				}, 8, ["modelValue"]),
				_(n, {
					modelValue: q.value,
					"onUpdate:modelValue": r[22] ||= (e) => q.value = e,
					"initial-width": 440,
					"initial-height": 260,
					"min-width": 340,
					"min-height": 200
				}, {
					title: z(() => [g(P(a.value.removeTitle), 1)]),
					actions: z(() => [
						_(T),
						_(i, {
							variant: "text",
							onClick: r[21] ||= (e) => q.value = null
						}, {
							default: z(() => [...r[55] ||= [g("取消", -1)]]),
							_: 1
						}),
						_(i, {
							color: "error",
							variant: "flat",
							onClick: Le
						}, {
							default: z(() => [g(P(a.value.removeConfirm), 1)]),
							_: 1
						})
					]),
					default: z(() => [g(" " + P(q.value ? q.value.root : "") + " ", 1), h("p", dt, P(a.value.removeText), 1)]),
					_: 1
				}, 8, ["modelValue"])
			], 32);
		};
	}
}, [["__scopeId", "data-v-34d9e320"]]), pt = "web-shared-resizing";
function mt({ area: e, initial: t, min: n = 0, max: r = 100, rightMin: i = 0, axis: a = "x", unit: o = "px", persist: s = "" }) {
	let c = O(f()), l = O(!1), u = 0, d = 0;
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
		l.value && (l.value = !1, window.removeEventListener("pointermove", m), document.body.classList.remove(pt));
	}
	function g(t) {
		t.button === 0 && e.value && (l.value = !0, u = a === "x" ? t.clientX : t.clientY, d = c.value, t.preventDefault(), document.body.classList.add(pt), window.addEventListener("pointermove", m), window.addEventListener("pointerup", h, { once: !0 }));
	}
	function _() {
		c.value = t;
	}
	return L(c, (e) => {
		if (s) try {
			window.localStorage.setItem(s, String(e));
		} catch {}
	}), w(h), {
		size: c,
		resizing: l,
		start: g,
		stop: h,
		reset: _
	};
}
// src/utils/services/serviceStatus.js
var ht = ["starting", "ready"];
function gt(e, t = ht) {
	return (e.services || []).filter((e) => e.run && t.includes(e.run.status)).length;
}
function _t(e, t = ht) {
	let n = [];
	for (let r of e || []) {
		let e = gt(r, t);
		e && n.push({
			id: r.id,
			name: r.alias || s(r.root),
			count: e
		});
	}
	return n;
}
// src/components/services/WorkspaceShell.vue
var vt = { class: "brand" }, yt = { class: "run-count" }, bt = { class: "side" }, xt = { class: "content" }, St = /*#__PURE__*/ e({
	__name: "WorkspaceShell",
	props: {
		title: {
			type: String,
			required: !0
		},
		workspaces: {
			type: Array,
			default: () => []
		},
		current: {
			type: Object,
			default: null
		},
		running: {
			type: Number,
			default: 0
		},
		dark: {
			type: Boolean,
			default: !1
		},
		snack: {
			type: Object,
			required: !0
		},
		empty: {
			type: Object,
			default: () => ({})
		},
		toggleTheme: {
			type: Function,
			required: !0
		}
	},
	emits: ["empty-action", "select-workspace"],
	setup(e, { emit: n }) {
		let r = e, o = n, s = d(() => _t(r.workspaces));
		function c(e) {
			o("select-workspace", e);
		}
		let u = O(null), v = O(!0), { size: b, resizing: S, start: w, reset: T } = mt({
			area: u,
			initial: 268,
			min: 200,
			rightMin: 420,
			persist: `${r.title}.shell.side-width`
		});
		return (n, r) => {
			let o = j("v-app-bar-nav-icon"), d = j("v-app-bar-title"), D = j("v-spacer"), O = j("v-chip"), M = j("v-list-item-title"), N = j("v-list-item"), L = j("v-list"), R = j("v-menu"), ee = j("v-btn"), V = j("v-app-bar"), te = j("v-main"), ne = j("v-app");
			return E(), f(ne, null, {
				default: z(() => [
					_(V, {
						density: "comfortable",
						flat: "",
						border: "b",
						class: "app-bar"
					}, {
						default: z(() => [
							_(o, {
								title: v.value ? "收起左侧列表" : "展开左侧列表",
								onClick: r[0] ||= (e) => v.value = !v.value
							}, null, 8, ["title"]),
							_(d, null, {
								default: z(() => [h("span", vt, P(e.title), 1)]),
								_: 1
							}),
							_(D),
							e.workspaces.length ? (E(), f(R, {
								key: 0,
								location: "bottom end"
							}, {
								activator: z(({ props: t }) => [_(O, y(t, {
									size: "small",
									variant: "tonal",
									class: "running",
									color: e.running ? "ready" : void 0,
									"prepend-icon": "mdi-play-circle-outline",
									title: e.running ? `所有工作区共 ${e.running} 个进程在跑` : "所有工作区都没有在跑的进程"
								}), {
									default: z(() => [g(P(e.running) + " 个在跑 ", 1)]),
									_: 1
								}, 16, ["color", "title"])]),
								default: z(() => [_(L, {
									density: "compact",
									class: "running-menu"
								}, {
									default: z(() => [(E(!0), m(l, null, k(s.value, (t) => (E(), f(N, {
										key: t.id,
										active: e.current && e.current.id === t.id,
										onClick: (e) => c(t.id)
									}, {
										append: z(() => [h("span", yt, P(t.count) + " 个", 1)]),
										default: z(() => [_(M, { class: "run-name" }, {
											default: z(() => [g(P(t.name), 1)]),
											_: 2
										}, 1024)]),
										_: 2
									}, 1032, ["active", "onClick"]))), 128)), s.value.length ? p("", !0) : (E(), f(N, {
										key: 0,
										disabled: ""
									}, {
										default: z(() => [_(M, null, {
											default: z(() => [...r[3] ||= [g("没有在跑的进程", -1)]]),
											_: 1
										})]),
										_: 1
									}))]),
									_: 1
								})]),
								_: 1
							})) : p("", !0),
							A(n.$slots, "metrics", {}, void 0, !0),
							_(ee, {
								icon: e.dark ? "mdi-weather-sunny" : "mdi-weather-night",
								title: "切换深浅色",
								variant: "text",
								onClick: e.toggleTheme
							}, null, 8, ["icon", "onClick"])
						]),
						_: 3
					}),
					_(t, {
						modelValue: e.snack.on,
						"onUpdate:modelValue": r[1] ||= (t) => e.snack.on = t,
						text: e.snack.text,
						color: e.snack.color
					}, null, 8, [
						"modelValue",
						"text",
						"color"
					]),
					_(te, { class: "fill-height" }, {
						default: z(() => [h("div", {
							ref_key: "shellRef",
							ref: u,
							class: "shell"
						}, [
							h("div", {
								class: "side-slot",
								style: C({ width: v.value ? `${F(b)}px` : "0px" })
							}, null, 4),
							h("div", {
								class: x(["side-layer", { folded: !v.value }]),
								style: C({ width: `${F(b)}px` })
							}, [h("aside", bt, [A(n.$slots, "sidebar", {}, void 0, !0)])], 6),
							B(_(a, {
								axis: "x",
								active: F(S),
								onStart: F(w),
								onReset: F(T)
							}, null, 8, [
								"active",
								"onStart",
								"onReset"
							]), [[I, v.value]]),
							h("main", xt, [A(n.$slots, "default", { ws: e.current }, void 0, !0), e.current ? p("", !0) : (E(), f(i, y({ key: 0 }, e.empty, { onAction: r[2] ||= (e) => n.$emit("empty-action") }), null, 16))])
						], 512)]),
						_: 3
					})
				]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-67021267"]]), Ct = { style: { width: "42%" } }, wt = { class: "svc-name" }, Tt = ["title"], Et = ["title"], Dt = { class: "status-line" }, Ot = {
	key: 0,
	class: "meta"
}, kt = {
	key: 1,
	class: "meta"
}, At = ["title"], jt = {
	key: 1,
	class: "meta"
}, Mt = {
	key: 2,
	class: "meta"
}, Nt = { class: "ops" }, Pt = /*#__PURE__*/ e({
	__name: "ServiceTable",
	props: {
		rows: {
			type: Array,
			required: !0
		},
		nameTitle: {
			type: String,
			required: !0
		},
		showPath: {
			type: Boolean,
			default: !0
		}
	},
	emits: [
		"start",
		"stop",
		"settings",
		"log"
	],
	setup(e) {
		return (t, n) => {
			let r = j("v-chip"), i = j("v-btn"), a = j("v-icon"), o = j("v-table");
			return E(), f(o, {
				density: "compact",
				class: "table"
			}, {
				default: z(() => [h("thead", null, [h("tr", null, [
					h("th", Ct, P(e.nameTitle), 1),
					n[0] ||= h("th", null, "参数", -1),
					n[1] ||= h("th", { style: { width: "200px" } }, "状态", -1),
					n[2] ||= h("th", { style: { width: "230px" } }, null, -1)
				])]), h("tbody", null, [(E(!0), m(l, null, k(e.rows, (o) => (E(), m("tr", { key: o.key }, [
					h("td", null, [h("div", wt, [h("span", null, P(o.title), 1), o.typeText ? (E(), f(r, {
						key: 0,
						size: "x-small",
						variant: "tonal",
						class: "type-chip"
					}, {
						default: z(() => [g(P(o.typeText), 1)]),
						_: 2
					}, 1024)) : p("", !0)]), e.showPath && o.path ? (E(), m("div", {
						key: 0,
						class: "svc-path",
						title: o.path
					}, P(o.path), 9, Tt)) : p("", !0)]),
					h("td", null, [h("div", {
						class: "cmd",
						title: o.cmd
					}, P(o.cmd), 9, Et)]),
					h("td", null, [h("div", Dt, [o.live ? (E(), m(l, { key: 0 }, [_(r, {
						size: "small",
						class: "status-chip",
						color: o.color,
						variant: "tonal",
						"prepend-icon": o.icon
					}, {
						default: z(() => [g(P(o.statusText), 1)]),
						_: 2
					}, 1032, ["color", "prepend-icon"]), o.port ? (E(), m("span", Ot, "端口 " + P(o.port), 1)) : o.started ? (E(), m("span", kt, P(o.ago), 1)) : p("", !0)], 64)) : o.run ? (E(), m(l, { key: 1 }, [_(r, {
						size: "small",
						class: "status-chip",
						color: o.color,
						variant: "tonal",
						"prepend-icon": o.icon,
						onClick: (e) => t.$emit("log", o)
					}, {
						default: z(() => [g(P(o.statusText), 1)]),
						_: 2
					}, 1032, [
						"color",
						"prepend-icon",
						"onClick"
					]), o.err ? (E(), m("span", {
						key: 0,
						class: "meta err",
						title: o.err
					}, P(o.err), 9, At)) : o.started ? (E(), m("span", jt, P(o.ago), 1)) : p("", !0)], 64)) : (E(), m("span", Mt, "—"))])]),
					h("td", Nt, [o.live ? (E(), m(l, { key: 0 }, [_(i, {
						size: "small",
						variant: "text",
						"prepend-icon": "mdi-text-box-outline",
						onClick: (e) => t.$emit("log", o)
					}, {
						default: z(() => [...n[3] ||= [g(" 日志 ", -1)]]),
						_: 1
					}, 8, ["onClick"]), _(i, {
						size: "small",
						color: "error",
						variant: "tonal",
						loading: o.stopping,
						onClick: (e) => t.$emit("stop", o)
					}, {
						default: z(() => [...n[4] ||= [g(" 停止 ", -1)]]),
						_: 1
					}, 8, ["loading", "onClick"])], 64)) : (E(), m(l, { key: 1 }, [
						_(i, {
							size: "small",
							color: "primary",
							variant: "flat",
							disabled: o.blocked,
							loading: o.starting,
							onClick: (e) => t.$emit("start", o)
						}, {
							default: z(() => [g(P(o.action), 1)]),
							_: 2
						}, 1032, [
							"disabled",
							"loading",
							"onClick"
						]),
						_(i, {
							size: "small",
							variant: "text",
							icon: !0,
							title: "参数",
							onClick: (e) => t.$emit("settings", o)
						}, {
							default: z(() => [_(a, { size: "20" }, {
								default: z(() => [...n[5] ||= [g("mdi-tune", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["onClick"]),
						o.run ? (E(), f(i, {
							key: 0,
							size: "small",
							variant: "text",
							"prepend-icon": "mdi-text-box-outline",
							onClick: (e) => t.$emit("log", o)
						}, {
							default: z(() => [...n[6] ||= [g(" 日志 ", -1)]]),
							_: 1
						}, 8, ["onClick"])) : p("", !0)
					], 64)), A(t.$slots, "row-extra", { row: o }, void 0, !0)])
				]))), 128))])]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-8df04734"]]), Ft = { class: "log-head" }, It = { class: "log-box" }, Lt = {
	key: 1,
	class: "log-empty"
}, Rt = /*#__PURE__*/ e({
	__name: "RunLogPanel",
	props: {
		text: {
			type: String,
			default: ""
		},
		more: {
			type: Boolean,
			default: !1
		},
		dark: {
			type: Boolean,
			default: !1
		},
		colorize: {
			type: Function,
			default: (e) => e
		},
		emptyText: {
			type: String,
			default: "还没有运行过"
		}
	},
	emits: ["load-more"],
	setup(e) {
		return (t, n) => {
			let r = j("v-spacer"), i = j("v-btn");
			return E(), m(l, null, [h("div", Ft, [
				n[2] ||= h("span", { class: "label" }, "日志", -1),
				_(r),
				e.more ? (E(), f(i, {
					key: 0,
					size: "small",
					variant: "text",
					"prepend-icon": "mdi-history",
					onClick: n[0] ||= (e) => t.$emit("load-more")
				}, {
					default: z(() => [...n[1] ||= [g(" 更早 ", -1)]]),
					_: 1
				})) : p("", !0)
			]), h("div", It, [e.text ? (E(), f(ie, {
				key: 0,
				text: e.text,
				dark: e.dark,
				colorize: e.colorize
			}, null, 8, [
				"text",
				"dark",
				"colorize"
			])) : (E(), m("p", Lt, P(e.emptyText), 1))])], 64);
		};
	}
}, [["__scopeId", "data-v-d45becae"]]);
// src/composables/commons/useFileTree.js
function zt(e, t = () => ({})) {
	let n = D({});
	function r() {
		let t = typeof e == "function" ? e() : F(e);
		return Array.isArray(t) ? t : [];
	}
	function i(e) {
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
	function a(e) {
		let t = e.files.length;
		for (let n of e.dirs.values()) t += a(n);
		return t;
	}
	function o(e, r) {
		let i = [], s = [...e.dirs.values()].sort((e, t) => e.name.localeCompare(t.name, "zh-CN"));
		for (let e of s) i.push({
			kind: "dir",
			name: e.name,
			path: e.path,
			depth: r,
			count: a(e)
		}), n[e.path] || i.push(...o(e, r + 1));
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
	let s = d(() => o(i(r()), 0));
	function c(e) {
		n[e] = !n[e];
	}
	return {
		rows: s,
		collapsed: n,
		toggle: c
	};
}
// src/composables/services/useRunLog.js
function Bt({ api: e, ws: t, statusText: n = {} }) {
	let r = O(""), i = O(!1), a = O(0), o = O(""), s = O(""), c = O(""), l = null;
	function u() {
		l &&= (l.close(), null), s.value = "", c.value = "";
	}
	function d(t, d = "") {
		if (u(), r.value = "", i.value = !1, a.value = 0, o.value = t ? n[t.status] || t.status : "", c.value = d || "", !t) return;
		s.value = t.id;
		let f = new EventSource(e.logStreamUrl(t.id));
		l = f, f.addEventListener("tail", (e) => {
			let t = JSON.parse(e.data);
			r.value = t.text || "", i.value = !!t.more, a.value = 0;
		}), f.addEventListener("append", (e) => {
			let t = JSON.parse(e.data);
			t.text && (r.value = r.value ? `${r.value}\n${t.text}` : t.text);
		});
	}
	async function f() {
		if (!i.value || !s.value) return;
		let t = a.value + 1;
		try {
			let c = await e.log(s.value, t);
			r.value = c.text + (r.value ? "\n" + r.value : ""), i.value = c.more, a.value = t, o.value = c.status ? n[c.status] || c.status : "";
		} catch (e) {
			r.value = `读日志失败：${e.message}`;
		}
	}
	return L(t, (e) => {
		if (!c.value || !e) return;
		let t = (e.services || []).find((e) => e.id === c.value);
		t && t.run && (o.value = n[t.run.status] || t.run.status);
	}), w(u), {
		text: r,
		more: i,
		page: a,
		status: o,
		runId: s,
		open: d,
		close: u,
		loadMore: f
	};
}
// src/composables/services/useWorkspaceState.js
function Vt({ api: e, storageKey: t, extraState: n = {}, loadExtra: i = null, addedNotice: a = "已添加" }) {
	let o = D({
		workspaces: [],
		groups: [],
		...n
	}), s = re(t, "", { writeDefaults: !1 }), c = O(!1), l = O(null), { snack: u, toast: f } = r(), p = null, m = 0, h = d(() => o.workspaces.find((e) => e.id === s.value) || null), g = d(() => o.workspaces.reduce((e, t) => e + gt(t), 0));
	function _(e) {
		s.value = e || "";
	}
	function v(e) {
		o.workspaces = e.workspaces || [], o.groups = e.groups || [], s.value && !h.value && _("");
	}
	async function y(t) {
		let n = o.groups;
		o.groups = t;
		try {
			let n = await e.saveGroups(t);
			n && n.groups && (o.groups = n.groups);
		} catch (e) {
			o.groups = n, f(`保存分组失败：${e.message}`, "error");
		}
	}
	async function b() {
		if (!m) try {
			v(await e.state());
		} catch {}
	}
	function x() {
		p = new EventSource(e.stateStreamUrl()), p.addEventListener("state", (e) => {
			if (!m) try {
				v(JSON.parse(e.data));
			} catch {}
		}), p.addEventListener("metrics", (e) => {
			if (!document.hidden) try {
				l.value = JSON.parse(e.data);
			} catch {}
		});
	}
	function S() {
		p &&= (p.close(), null);
	}
	async function C() {
		if (i) try {
			await i(o);
		} catch {}
	}
	async function w(e, t) {
		m += 1;
		try {
			return await t();
		} catch (t) {
			return f(`${e}失败：${t.message}`, "error"), null;
		} finally {
			--m, b();
		}
	}
	async function T(t) {
		let n = typeof t == "string" ? t : "";
		c.value = !0;
		let r = await w("添加工作区", async () => (await e.addWorkspace(n), !0));
		if (c.value = !1, !r) return;
		await b();
		let i = o.workspaces.find((e) => e.root === n || e.root === n.replace(/\/+$/, ""));
		i && _(i.id), f(a, "primary");
	}
	async function E(t) {
		await w("移出工作区", async () => (await e.forgetWorkspace(t), !0)) && (s.value === t && _(""), f("已移出，在跑的进程一并停了"));
	}
	async function k() {
		h.value && await w("重新扫描", () => e.rescan(h.value.id));
	}
	async function A(t) {
		await w("启动", () => e.start(t)) && f("已发出启动", "primary");
	}
	async function j(t) {
		await w("停止", () => e.stop(t)) && f("已停止");
	}
	async function M(t) {
		await w("保存参数", () => e.update(t)) && f("参数已保存", "primary");
	}
	async function N() {
		x(), await b(), C();
	}
	return {
		state: o,
		current: h,
		currentId: s,
		adding: c,
		snack: u,
		toast: f,
		metrics: l,
		running: g,
		select: _,
		setGroups: y,
		refresh: b,
		act: w,
		start: N,
		disconnect: S,
		addWorkspace: T,
		removeWorkspace: E,
		rescan: k,
		startService: A,
		stopService: j,
		saveService: M
	};
}
export { W as DirectoryNode, ue as DirectoryPicker, Ye as FileEditor, Oe as FileTree, ht as LIVE_STATUSES, ie as LogView, Rt as RunLogPanel, Pt as ServiceTable, ft as WorkspaceList, St as WorkspaceShell, be as copyText, Q as fileIcon, gt as runningCount, c as symbolAt, zt as useFileTree, Bt as useRunLog, mt as useSplitPane, Vt as useWorkspaceState };
