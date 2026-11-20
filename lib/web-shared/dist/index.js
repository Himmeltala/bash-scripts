import { t as e } from "./_plugin-vue_export-helper.js";
import { n as t, r as n, t as r } from "./useToast.js";
import { n as i, t as a } from "./SplitHandle.js";
import { languageOf as o } from "./highlight.js";
import { baseName as s } from "./format.js";
import { symbolAt as c } from "./text.js";
import { Fragment as l, Teleport as u, computed as d, createBlock as f, createCommentVNode as p, createElementBlock as m, createElementVNode as h, createTextVNode as g, createVNode as _, guardReactiveProps as v, mergeProps as y, nextTick as b, normalizeClass as x, normalizeProps as S, normalizeStyle as C, onBeforeUnmount as w, onMounted as T, openBlock as E, reactive as D, ref as O, renderList as k, renderSlot as A, resolveComponent as j, resolveDynamicComponent as M, shallowRef as ee, toDisplayString as N, unref as P, vShow as F, watch as I, watchEffect as L, withCtx as R, withDirectives as z, withKeys as te, withModifiers as B } from "vue";
import { Terminal as ne } from "@xterm/xterm";
import { FitAddon as re } from "@xterm/addon-fit";
import { useLocalStorage as ie } from "@vueuse/core";
var ae = /*#__PURE__*/ e({
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
			i = new ne({
				convertEol: !0,
				disableStdin: !0,
				cursorBlink: !1,
				scrollback: 5e3,
				fontFamily: "'JetBrains Mono', 'Noto Sans Mono CJK SC', 'Sarasa Mono SC', 'Cascadia Mono', Consolas, Menlo, monospace",
				fontSize: 12,
				lineHeight: 1.3,
				theme: c(t.dark)
			}), a = new re(), i.loadAddon(a), i.open(r.value), requestAnimationFrame(() => i && a.fit()), document.fonts && document.fonts.load("12px 'JetBrains Mono'").then(() => i && a.fit()).catch(() => {}), o = new ResizeObserver(() => {
				i && a.fit();
			}), o.observe(r.value), i.attachCustomKeyEventHandler(f), d(t.text || "");
		}), I(() => t.text, (e) => d(e || "")), I(() => t.dark, (e) => {
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
}, [["__scopeId", "data-v-be16b898"]]), oe = { class: "node" }, se = ["title"], ce = {
	key: 0,
	class: "kids"
}, le = {
	key: 0,
	class: "hint"
}, V = {
	key: 1,
	class: "hint bad"
}, H = {
	key: 0,
	class: "hint"
}, U = /*#__PURE__*/ e({
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
		I(() => n.selected === n.node.path, (e) => {
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
			return E(), m("div", oe, [h("div", {
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
					onClick: B(u, ["stop"])
				}, {
					default: R(() => [_(r, { size: "18" }, {
						default: R(() => [g(N(i.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"]),
				_(r, {
					size: "18",
					class: "folder"
				}, {
					default: R(() => [...n[1] ||= [g("mdi-folder-outline", -1)]]),
					_: 1
				}),
				h("span", {
					class: "label",
					title: e.node.path
				}, N(e.node.name), 9, se)
			], 2), i.value ? (E(), m("div", ce, [a.value ? (E(), m("p", le, "正在读取…")) : o.value ? (E(), m("p", V, N(o.value), 1)) : e.node.children ? (E(), m(l, { key: 2 }, [(E(!0), m(l, null, k(e.node.children, (r) => (E(), f(v, {
				key: r.path,
				node: r,
				selected: e.selected,
				loader: e.loader,
				onPick: n[0] ||= (e) => t.$emit("pick", e)
			}, null, 8, [
				"node",
				"selected",
				"loader"
			]))), 128)), e.node.children.length ? p("", !0) : (E(), m("p", H, "没有子目录"))], 64)) : p("", !0)])) : p("", !0)]);
		};
	}
}, [["__scopeId", "data-v-9e855642"]]), W = { class: "picker" }, G = {
	key: 0,
	class: "tip"
}, K = { class: "tree" }, q = { class: "root" }, J = ["title"], ue = {
	key: 0,
	class: "hint bad"
}, Y = {
	key: 0,
	class: "hint"
}, de = /*#__PURE__*/ e({
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
		L(() => r("update:valid", v.value));
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
			return E(), m("div", W, [
				e.tip ? (E(), m("p", G, N(e.tip), 1)) : p("", !0),
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
				h("div", K, [h("div", q, [
					_(d, { size: "18" }, {
						default: R(() => [...n[1] ||= [g("mdi-home-outline", -1)]]),
						_: 1
					}),
					h("span", {
						class: "root-label",
						title: i.value || "~"
					}, "~", 8, J),
					o.value ? (E(), f(b, {
						key: 0,
						size: "12",
						width: "2",
						indeterminate: ""
					})) : p("", !0)
				]), s.value ? (E(), m("p", ue, N(s.value), 1)) : a.value ? (E(), m(l, { key: 1 }, [(E(!0), m(l, null, k(a.value, (t) => (E(), f(U, {
					key: t.path,
					node: t,
					selected: u.value,
					loader: e.loader,
					onPick: y
				}, null, 8, [
					"node",
					"selected",
					"loader"
				]))), 128)), a.value.length ? p("", !0) : (E(), m("p", Y, "家目录下没有子目录"))], 64)) : p("", !0)])
			]);
		};
	}
}, [["__scopeId", "data-v-a4b93ef9"]]), X = {
	icon: "mdi-file-outline",
	color: ""
}, fe = {
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
}, pe = {
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
function Z(e) {
	let t = String(e || "").split("/").pop().toLowerCase(), n = fe[t];
	if (n) return n;
	let r = t.lastIndexOf(".");
	return r < 0 ? X : pe[t.slice(r + 1)] || X;
}
// src/components/commons/FileTree/FileTreeNode.vue
var Q = { class: "branch" }, me = ["data-path", "data-type"], he = {
	key: 1,
	class: "arrow-space"
}, ge = ["title"], _e = {
	key: 0,
	class: "hint bad"
}, $ = {
	key: 0,
	class: "hint"
}, ve = /*#__PURE__*/ e({
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
		let n = e, r = t, i = { truncated: "这一层文件太多，只列了前面一部分。" }, a = d(() => ({
			...i,
			...n.texts
		})), o = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, s = d(() => n.keyOf(n.node)), c = d(() => n.dirOf(n.node)), u = d(() => n.expanded[s.value] === !0), v = d(() => n.cache[s.value] || o), b = d(() => c.value ? null : Z(n.nameOf(n.node))), S = d(() => c.value ? u.value ? "mdi-folder-open-outline" : "mdi-folder-outline" : b.value.icon), w = d(() => c.value ? null : b.value.color ? { color: b.value.color } : null);
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
			return E(), m("div", Q, [h("div", {
				class: x(["row", [e.rowClass ? e.rowClass(e.node) : null, { clickable: e.pickOnRowClick }]]),
				"data-path": s.value,
				"data-type": e.node.type,
				style: C({ paddingLeft: 4 + e.depth * 18 + "px" }),
				onClick: T,
				onContextmenu: B(D, ["prevent", "stop"])
			}, [
				c.value ? (E(), f(o, {
					key: 0,
					icon: "",
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: u.value ? "收起" : "展开",
					onClick: n[0] ||= B((e) => r("toggle", s.value), ["stop"])
				}, {
					default: R(() => [_(i, { size: "16" }, {
						default: R(() => [g(N(u.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
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
					default: R(() => [g(N(S.value), 1)]),
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
				}, N(e.nameOf(e.node)), 11, ge),
				A(t.$slots, "row-after-label", {
					node: e.node,
					open: u.value,
					state: v.value
				}, void 0, !0)
			], 46, me), c.value && u.value ? (E(), m(l, { key: 0 }, [v.value.error ? (E(), m("p", _e, N(v.value.error), 1)) : (E(), m(l, { key: 1 }, [(E(!0), m(l, null, k(v.value.entries, (i) => (E(), f(b, {
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
				"row-before-label": R((e) => [A(t.$slots, "row-before-label", y({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": R((e) => [A(t.$slots, "row-after-label", y({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), v.value.truncated ? (E(), m("p", $, N(a.value.truncated), 1)) : p("", !0)], 64))], 64)) : p("", !0)]);
		};
	}
}, [["__scopeId", "data-v-f0de9fb7"]]);
// src/utils/commons/clipboard.js
async function ye(e) {
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
var be = {
	key: 0,
	class: "root-loading"
}, xe = {
	key: 1,
	class: "hint bad"
}, Se = {
	key: 0,
	class: "hint"
}, Ce = ["disabled"], we = ["disabled"], Te = ["disabled"], Ee = /*#__PURE__*/ e({
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
			truncated: "这一层文件太多，只列了前面一部分。",
			copyRel: "复制相对路径",
			copyAbs: "复制绝对路径",
			downloadFile: "下载文件",
			downloadDir: "下载目录（zip）",
			copied: "已复制",
			newFile: "新建文件",
			newDir: "新建目录",
			upload: "上传文件",
			props: "属性",
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
		}, c = D({}), x = D({}), M = O(!1), ee = O(null), P = d(() => r.root ? r.keyOf(r.root) : ""), F = d(() => x[P.value] || s);
		async function L(e, t = !1) {
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
		function z(e) {
			c[e] = !c[e], c[e] && L(e);
		}
		async function te(e) {
			c[P.value] = !0, await L(P.value);
			let t = P.value;
			for (let n of String(e || "").split("/").filter(Boolean)) t = t ? `${t}/${n}` : n, await L(t), c[t] = !0;
		}
		function ne() {
			return Object.keys(c).filter((e) => c[e]);
		}
		async function re(e) {
			let t = Array.isArray(e) ? e : [];
			await Promise.all(t.map(async (e) => {
				c[e] = !0, await L(e);
			}));
		}
		function ie() {
			for (let e of Object.keys(c)) c[e] = !1;
			c[P.value] = !0;
		}
		function ae() {
			for (let e of Object.keys(x)) delete x[e];
			for (let e of Object.keys(c)) delete c[e];
			c[P.value] = !0, L(P.value);
		}
		async function oe(e) {
			await L(e, !0);
		}
		async function se() {
			let e = Object.keys(c).filter((e) => c[e]);
			await Promise.all(e.map((e) => L(e, !0)));
		}
		function ce(e) {
			let t = ee.value ? ee.value.querySelectorAll("[data-path]") : [];
			for (let n of t) if (n.dataset.path === e) {
				n.scrollIntoView({ block: "nearest" });
				return;
			}
		}
		async function le() {
			await Promise.all(Object.keys(x).map((e) => L(e, !0)));
		}
		function V() {
			r.active && !M.value && (M.value = !0, c[P.value] = !0, L(P.value));
		}
		r.active && V(), T(V), I(() => r.active, (e) => {
			e && V();
		});
		let H = D({
			open: !1,
			x: 0,
			y: 0,
			node: null,
			copied: ""
		}), U = O(null), W = 0, G = d(() => H.node ? String(r.keyOf(H.node) || "") : ""), K = d(() => {
			if (!H.node || !r.rootPath) return "";
			let e = r.rootPath.replace(/\/+$/, ""), t = G.value;
			return t ? `${e}/${t}` : e;
		}), q = d(() => H.node ? r.dirOf(H.node) : !1);
		function J({ node: e, event: t }) {
			H.node = e, H.copied = "", H.x = t.clientX, H.y = t.clientY, H.open = !0, b(ue);
		}
		function ue() {
			if (!U.value) return;
			let e = U.value.offsetWidth, t = U.value.offsetHeight;
			H.x = Math.max(6, Math.min(H.x, window.innerWidth - e - 6)), H.y = Math.max(6, Math.min(H.y, window.innerHeight - t - 6));
		}
		function Y() {
			H.open = !1, H.node = null, H.copied = "", clearTimeout(W);
		}
		async function de(e) {
			let t = e === "abs" ? K.value : G.value;
			t && await ye(t) && (H.copied = e, clearTimeout(W), W = setTimeout(Y, 700));
		}
		function X(e) {
			if (!H.node) return;
			let t = H.node;
			Y(), i("action", {
				action: e,
				node: t
			});
		}
		function fe() {
			if (!H.node || !r.downloadOf) return;
			let e = H.node, t = r.downloadOf(e);
			if (Y(), !t) return;
			let n = r.nameOf(e) || "download", i = document.createElement("a");
			i.href = t, i.download = r.dirOf(e) ? `${n}.zip` : n, i.rel = "noopener", i.style.display = "none", document.body.appendChild(i), i.click(), i.remove();
		}
		function pe(e) {
			U.value && !U.value.contains(e.target) && Y();
		}
		function Z(e) {
			e.key === "Escape" && Y();
		}
		function Q() {
			H.open && Y();
		}
		function me(e) {
			let t = e ? "addEventListener" : "removeEventListener";
			document[t]("mousedown", pe, !0), document[t]("keydown", Z, !0), window[t]("scroll", Q, !0), window[t]("resize", Q);
		}
		return I(() => H.open, (e) => me(e)), w(() => {
			Y(), me(!1);
		}), t({
			reveal: te,
			reload: ae,
			reloadDir: oe,
			reloadExpanded: se,
			refreshAll: le,
			scrollTo: ce,
			toggle: z,
			collapseAll: ie,
			expandedKeys: ne,
			restoreExpanded: re
		}), (t, n) => {
			let r = j("v-progress-circular"), a = j("v-icon");
			return E(), m("div", {
				ref_key: "rootRef",
				ref: ee,
				class: "file-tree"
			}, [e.root ? (E(), f(ve, {
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
				onToggle: z,
				onPick: n[0] ||= (e) => i("pick", e),
				onContext: J
			}, {
				"row-before-label": R((e) => [A(t.$slots, "row-before-label", S(v(e)), void 0, !0)]),
				"row-after-label": R((e) => [A(t.$slots, "row-after-label", S(v(e)), void 0, !0)]),
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
			])) : (E(), m(l, { key: 1 }, [F.value.loading ? (E(), m("div", be, [_(r, {
				indeterminate: "",
				size: 14,
				width: 2
			})])) : F.value.error ? (E(), m("p", xe, N(F.value.error), 1)) : (E(), m(l, { key: 2 }, [(E(!0), m(l, null, k(F.value.entries, (r) => (E(), f(ve, {
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
				onToggle: z,
				onPick: n[1] ||= (e) => i("pick", e),
				onContext: J
			}, {
				"row-before-label": R((e) => [A(t.$slots, "row-before-label", y({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": R((e) => [A(t.$slots, "row-after-label", y({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), F.value.truncated ? (E(), m("p", Se, N(o.value.truncated), 1)) : p("", !0)], 64))], 64)), (E(), f(u, { to: "body" }, [H.open ? (E(), m("div", {
				key: 0,
				ref_key: "menuRef",
				ref: U,
				class: "ft-menu",
				style: C({
					left: H.x + "px",
					top: H.y + "px"
				}),
				onContextmenu: n[10] ||= B(() => {}, ["prevent"])
			}, [
				e.editable ? (E(), m(l, { key: 0 }, [
					q.value ? (E(), m("button", {
						key: 0,
						class: "ft-item",
						type: "button",
						onClick: n[2] ||= (e) => X("create-file")
					}, [_(a, { size: "16" }, {
						default: R(() => [...n[11] ||= [g("mdi-file-plus-outline", -1)]]),
						_: 1
					}), h("span", null, N(o.value.newFile), 1)])) : p("", !0),
					q.value ? (E(), m("button", {
						key: 1,
						class: "ft-item",
						type: "button",
						onClick: n[3] ||= (e) => X("create-dir")
					}, [_(a, { size: "16" }, {
						default: R(() => [...n[12] ||= [g("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), h("span", null, N(o.value.newDir), 1)])) : p("", !0),
					q.value ? (E(), m("button", {
						key: 2,
						class: "ft-item",
						type: "button",
						onClick: n[4] ||= (e) => X("upload")
					}, [_(a, { size: "16" }, {
						default: R(() => [...n[13] ||= [g("mdi-cloud-upload-outline", -1)]]),
						_: 1
					}), h("span", null, N(o.value.upload), 1)])) : p("", !0),
					h("button", {
						class: "ft-item",
						type: "button",
						disabled: !G.value,
						onClick: n[5] ||= (e) => X("rename")
					}, [_(a, { size: "16" }, {
						default: R(() => [...n[14] ||= [g("mdi-form-textbox", -1)]]),
						_: 1
					}), h("span", null, N(o.value.rename), 1)], 8, Ce),
					h("button", {
						class: "ft-item danger",
						type: "button",
						disabled: !G.value,
						onClick: n[6] ||= (e) => X("delete")
					}, [_(a, { size: "16" }, {
						default: R(() => [...n[15] ||= [g("mdi-trash-can-outline", -1)]]),
						_: 1
					}), h("span", null, N(o.value.delete), 1)], 8, we),
					n[17] ||= h("div", { class: "ft-sep" }, null, -1),
					h("button", {
						class: "ft-item",
						type: "button",
						onClick: n[7] ||= (e) => X("props")
					}, [_(a, { size: "16" }, {
						default: R(() => [...n[16] ||= [g("mdi-information-outline", -1)]]),
						_: 1
					}), h("span", null, N(o.value.props), 1)]),
					n[18] ||= h("div", { class: "ft-sep" }, null, -1)
				], 64)) : p("", !0),
				h("button", {
					class: "ft-item",
					type: "button",
					disabled: !G.value,
					onClick: n[8] ||= (e) => de("rel")
				}, [_(a, { size: "16" }, {
					default: R(() => [...n[19] ||= [g("mdi-content-copy", -1)]]),
					_: 1
				}), h("span", null, N(H.copied === "rel" ? o.value.copied : o.value.copyRel), 1)], 8, Te),
				e.rootPath ? (E(), m("button", {
					key: 1,
					class: "ft-item",
					type: "button",
					onClick: n[9] ||= (e) => de("abs")
				}, [_(a, { size: "16" }, {
					default: R(() => [...n[20] ||= [g("mdi-link-variant", -1)]]),
					_: 1
				}), h("span", null, N(H.copied === "abs" ? o.value.copied : o.value.copyAbs), 1)])) : p("", !0),
				e.downloadOf ? (E(), m("button", {
					key: 2,
					class: "ft-item",
					type: "button",
					onClick: fe
				}, [_(a, { size: "16" }, {
					default: R(() => [g(N(q.value ? "mdi-folder-zip-outline" : "mdi-download"), 1)]),
					_: 1
				}), h("span", null, N(q.value ? o.value.downloadDir : o.value.downloadFile), 1)])) : p("", !0)
			], 36)) : p("", !0)]))], 512);
		};
	}
}, [["__scopeId", "data-v-5b2607f4"]]), De = { class: "file-head" }, Oe = { class: "crumbs" }, ke = ["title", "onClick"], Ae = { class: "meta" }, je = /*#__PURE__*/ e({
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
		return (t, n) => (E(), m("div", De, [
			h("nav", Oe, [h("button", {
				class: "seg",
				title: "回到根目录",
				onClick: n[0] ||= (e) => r("navigate", "")
			}, N(e.rootName), 1), (E(!0), m(l, null, k(i.value, (e, t) => (E(), m(l, { key: e.path }, [n[1] ||= h("span", { class: "sep" }, "/", -1), h("button", {
				class: x(["seg", { last: t === i.value.length - 1 }]),
				title: e.path,
				onClick: (n) => o(e, t)
			}, N(e.name), 11, ke)], 64))), 128))]),
			A(t.$slots, "actions", {}, void 0, !0),
			h("span", Ae, N(a.value), 1)
		]));
	}
}, [["__scopeId", "data-v-0a2775f2"]]), Me = /*#__PURE__*/ e({
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
				title: R(() => [...i[3] ||= [g("文件还没保存", -1)]]),
				actions: R(() => [
					_(a),
					_(o, {
						variant: "text",
						onClick: i[0] ||= (e) => r("answer", !1)
					}, {
						default: R(() => [...i[4] ||= [g("留在这里", -1)]]),
						_: 1
					}),
					_(o, {
						color: "error",
						variant: "flat",
						onClick: i[1] ||= (e) => r("answer", !0)
					}, {
						default: R(() => [...i[5] ||= [g("丢掉修改", -1)]]),
						_: 1
					})
				]),
				default: R(() => [g(" " + N(e.path || "当前文件") + " ", 1), i[6] ||= h("p", { class: "tip" }, "换过去之后这次的修改就没了，要保留就先按 Ctrl+S 保存。", -1)]),
				_: 1
			}, 8, ["model-value"]);
		};
	}
}, [["__scopeId", "data-v-d6dcbf86"]]);
// src/components/commons/FileEditor/useFileEditor.js
function Ne({ loader: e, saver: t }) {
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
var Pe = {
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
function Fe(e) {
	let t = o(e);
	return t === "markdown" ? Pe.markdown : t ? Pe.code : Pe.plain;
}
function Ie(e) {
	return Fe(e).modes;
}
function Le(e, t) {
	return t.some((t) => t.id === e) ? e : "source";
}
function Re(e, t) {
	return t > 0 ? "source" : e;
}
function ze(e) {
	return {
		mode: "source",
		message: `视图加载失败${e && e.message ? `：${e.message}` : ""}`
	};
}
// src/components/commons/FileEditor/FileEditor.vue
var Be = { class: "file-editor" }, Ve = {
	key: 1,
	class: "actions"
}, He = {
	key: 1,
	class: "hint"
}, Ue = {
	key: 3,
	class: "edit-wrap"
}, We = {
	key: 0,
	class: "hint bad edit-error"
}, Ge = {
	key: 1,
	class: "hint bad edit-error"
}, Ke = {
	key: 3,
	class: "hint"
}, qe = /*#__PURE__*/ e({
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
		let r = e, a = n, { path: o, state: s, dirty: c, load: u, save: h, discard: v, reset: y } = Ne({
			loader: r.loader,
			saver: r.saver
		}), x = O(null);
		I(c, (e) => a("dirty", e));
		let S = O("source"), C = d(() => Ie(o.value)), T = d(() => C.value.find((e) => e.id === S.value) || null), D = ee(null), A = O(!1), F = O(""), L = 0;
		function z() {
			if (!L) return;
			let e = x.value;
			if (!e || typeof e.locate != "function") return;
			let t = L;
			L = 0, e.locate(t);
		}
		I(C, (e) => {
			S.value = Le(S.value, e);
		}, { immediate: !0 }), I(T, async (e) => {
			if (D.value = null, A.value = !!e, e) {
				F.value = "";
				try {
					let t = await e.load();
					if (T.value !== e) return;
					D.value = t.default, await b(), z();
				} catch (t) {
					if (T.value === e) {
						let e = ze(t);
						F.value = e.message, S.value = e.mode;
					}
				} finally {
					T.value === e && (A.value = !1);
				}
			}
		}, { immediate: !0 });
		async function te() {
			let e = o.value, t = await h();
			return t && a("saved", {
				path: e,
				data: t
			}), t;
		}
		function B() {
			v();
		}
		function ne(e) {
			a("definition", {
				path: o.value,
				...e
			});
		}
		function re(e) {
			a("menu", {
				path: o.value,
				...e
			});
		}
		function ie(e) {
			a("rename", {
				path: o.value,
				...e
			});
		}
		function ae(e) {
			a("caret", {
				path: o.value,
				...e
			});
		}
		let oe = O(!1), se = null;
		async function ce(e, t = 0) {
			return F.value = "", S.value = Re(S.value, t), L = t, await u(e) ? (await b(), t || x.value?.resetScroll(), z(), !0) : (L = 0, !1);
		}
		async function le() {
			return !o.value || !await u(o.value) ? !1 : (await b(), x.value?.resetScroll(), !0);
		}
		function V() {
			W(), y();
		}
		function H() {
			return c.value ? oe.value ? Promise.resolve(!1) : (oe.value = !0, new Promise((e) => {
				se = e;
			})) : Promise.resolve(!0);
		}
		function U(e) {
			if (oe.value = !1, !se) return;
			let t = se;
			se = null, t(e);
		}
		function W() {
			U(!1);
		}
		let G = d(() => s.draft), K = d(() => s.base);
		function q(e) {
			s.draft = e == null ? "" : String(e);
		}
		return w(() => U(!1)), t({
			open: ce,
			reload: le,
			close: V,
			save: te,
			discard: B,
			confirmLeave: H,
			cancelLeave: W,
			path: o,
			dirty: c,
			text: G,
			base: K,
			restore: q
		}), (t, n) => {
			let r = j("v-btn"), u = j("v-btn-toggle"), d = j("v-chip");
			return E(), m("section", Be, [
				P(o) ? (E(), f(je, {
					key: 0,
					"root-name": e.rootName,
					path: P(o),
					size: e.size,
					onNavigate: n[1] ||= (e) => a("navigate", e)
				}, {
					actions: R(() => [C.value.length > 1 ? (E(), f(u, {
						key: 0,
						modelValue: S.value,
						"onUpdate:modelValue": n[0] ||= (e) => S.value = e,
						density: "compact",
						variant: "text",
						divided: "",
						mandatory: "",
						class: "views"
					}, {
						default: R(() => [(E(!0), m(l, null, k(C.value, (e) => (E(), f(r, {
							key: e.id,
							value: e.id,
							size: "small"
						}, {
							default: R(() => [g(N(e.title), 1)]),
							_: 2
						}, 1032, ["value"]))), 128))]),
						_: 1
					}, 8, ["modelValue"])) : p("", !0), P(c) && !P(s).loading ? (E(), m("div", Ve, [
						_(d, {
							size: "x-small",
							variant: "flat",
							color: "modified"
						}, {
							default: R(() => [...n[6] ||= [g("未保存", -1)]]),
							_: 1
						}),
						_(r, {
							size: "small",
							variant: "text",
							color: "primary",
							loading: P(s).saving,
							onClick: te
						}, {
							default: R(() => [...n[7] ||= [g(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"]),
						_(r, {
							size: "small",
							variant: "text",
							disabled: P(s).saving,
							onClick: B
						}, {
							default: R(() => [...n[8] ||= [g(" 放弃 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					])) : p("", !0)]),
					_: 1
				}, 8, [
					"root-name",
					"path",
					"size"
				])) : p("", !0),
				P(s).loading ? (E(), m("p", He, "正在读取文件…")) : P(s).error ? (E(), f(i, {
					key: 2,
					icon: "mdi-file-question-outline",
					"icon-size": 28,
					title: P(s).error,
					hint: "换一个文件试试，或者从左侧目录里下载它。"
				}, null, 8, ["title"])) : P(o) ? (E(), m("div", Ue, [
					F.value ? (E(), m("p", We, N(F.value), 1)) : p("", !0),
					P(s).saveError ? (E(), m("p", Ge, N(P(s).saveError), 1)) : p("", !0),
					D.value ? (E(), f(M(D.value), {
						key: 2,
						ref_key: "paneRef",
						ref: x,
						modelValue: P(s).draft,
						"onUpdate:modelValue": n[2] ||= (e) => P(s).draft = e,
						path: P(o),
						onSymbol: ne,
						onMenu: re,
						onRename: ie,
						onCaret: ae,
						markers: e.markers,
						onEdit: n[3] ||= (e) => t.$emit("edit", { path: P(o) }),
						onHover: n[4] ||= (e) => t.$emit("hover", {
							path: P(o),
							...e
						}),
						onHoverEnd: n[5] ||= (e) => t.$emit("hover-end", { path: P(o) })
					}, null, 40, [
						"modelValue",
						"path",
						"markers"
					])) : A.value ? (E(), m("p", Ke, "正在准备视图…")) : p("", !0)
				])) : (E(), f(i, {
					key: 4,
					icon: "mdi-file-outline",
					hint: "从左边选一个文件，右边显示它的内容。"
				})),
				_(Me, {
					"model-value": oe.value,
					path: P(o),
					onAnswer: U
				}, null, 8, ["model-value", "path"])
			]);
		};
	}
}, [["__scopeId", "data-v-6b41639b"]]), Je = "";
function Ye(e, t) {
	let n = String(e.parent || "").trim();
	return n && t.has(n) ? n : Je;
}
function Xe(e, t, n) {
	let r = new Map(t.map((e) => [e.id, e])), i = /* @__PURE__ */ new Set();
	for (let t of e) t && t.kind === "group" && t.id && i.add(t.id);
	let a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), c = [], l = /* @__PURE__ */ new Map(), u = (e, t) => {
		a.has(e) || a.set(e, []), a.get(e).push(t);
	};
	for (let t of e) if (t && t.id) {
		if (t.kind === "ws") {
			if (!r.has(t.id) || o.has(t.id)) continue;
			o.add(t.id), u(Ye(t, i), t);
		} else if (t.kind === "group" && t.name) {
			if (s.has(t.id)) continue;
			s.add(t.id), c.push(t), l.set(t.id, t), u(Ye(t, i), t);
		}
	}
	let d = (e) => {
		let t = e, n = /* @__PURE__ */ new Set();
		for (; t;) {
			if (n.has(t.id)) return !1;
			n.add(t.id);
			let e = Ye(t, i);
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
	m(Je, 0);
	for (let e of c) p.has(e.id) || d(e) || (p.add(e.id), f.push({
		key: `group:${e.id}`,
		kind: "group",
		id: e.id,
		depth: 0,
		parent: Je,
		name: e.name,
		group: e
	}), n.has(e.id) || m(e.id, 1));
	for (let e of t) o.has(e.id) || f.push({
		key: `ws:${e.id}`,
		kind: "ws",
		id: e.id,
		depth: 0,
		parent: Je,
		ws: e
	});
	return f;
}
function Ze(e) {
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
	a(Je, 0);
	for (let e of t.values()) for (let t of e) i.has(t.id) || (i.add(t.id), r.push({
		id: t.id,
		name: t.name,
		depth: 0
	}));
	return r;
}
function Qe(e, t, n) {
	let r = String(n || ""), i = /* @__PURE__ */ new Set();
	for (; r && !i.has(r);) {
		if (r === t) return !0;
		i.add(r);
		let n = e.find((e) => e && e.kind === "group" && e.id === r);
		r = n ? String(n.parent || "") : "";
	}
	return !1;
}
function $e(e, t, n) {
	let r = new Set(t);
	return r.size ? e.map((e) => e.kind === "ws" && r.has(e.id) ? {
		...e,
		parent: n
	} : e) : e;
}
function et(e, t) {
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
var tt = { class: "head" }, nt = { class: "head-title" }, rt = {
	key: 0,
	class: "none"
}, it = { class: "gtext" }, at = { class: "nm" }, ot = ["onClick"], st = { class: "tip" }, ct = { class: "tip" }, lt = { class: "tip" }, ut = /*#__PURE__*/ e({
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
		})), o = t, s = r.storageKey ? ie(r.storageKey, [], { writeDefaults: !1 }) : O([]), c = d(() => new Set(Array.isArray(s.value) ? s.value : [])), u = O(null), v = O(null), y = d(() => r.groups.filter((e) => e && e.kind === "group").length), b = d(() => Xe(r.groups, r.workspaces, c.value)), S = d(() => Ze(r.groups));
		function M() {
			return et(r.groups, r.workspaces);
		}
		function ee(e, t) {
			return Qe(r.groups, e, t);
		}
		function F(e) {
			o("groups-change", e);
		}
		function L(e, t, n, r) {
			let i = e.find((e) => e.kind === t && e.id === n);
			i ? i.parent = r : e.push({
				kind: t,
				id: n,
				parent: r
			});
		}
		function z() {
			return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
		}
		function ne(e) {
			s.value = [...e];
		}
		function re(e) {
			if (e.kind !== "group") {
				o("select", e.id);
				return;
			}
			let t = new Set(c.value);
			t.has(e.id) ? t.delete(e.id) : t.add(e.id), ne(t);
		}
		function ae(e) {
			if (!c.value.has(e)) return;
			let t = new Set(c.value);
			t.delete(e), ne(t);
		}
		function oe(e) {
			let t = u.value, n = v.value, r = (t) => !!n && n.mode === t && n.kind === e.kind && n.id === e.id;
			return {
				"drag-src": !!t && t.kind === e.kind && t.id === e.id,
				"drop-before": r("before"),
				"drop-after": r("after"),
				"drop-into": r("into")
			};
		}
		function se(e, t) {
			u.value = {
				kind: t.kind,
				id: t.id
			}, v.value = null, e.dataTransfer && (e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("text/plain", t.id));
		}
		function ce(e, t) {
			if (!u.value) return;
			let n = u.value;
			if (n.kind === t.kind && n.id === t.id) {
				v.value = null;
				return;
			}
			let r = e.currentTarget.getBoundingClientRect(), i = e.clientY - r.top, a = i > r.height / 2 ? "after" : "before";
			t.kind === "group" && (a = i < r.height * .25 ? "before" : i > r.height * .75 ? "after" : "into"), n.kind === "group" && ee(n.id, a === "into" ? t.id : t.parent) ? v.value = null : v.value = {
				kind: t.kind,
				id: t.id,
				mode: a
			};
		}
		function le() {
			let e = u.value, t = v.value;
			if (!e || !t) return V();
			let n = M(), r = n.findIndex((t) => t.kind === e.kind && t.id === e.id);
			if (r < 0) return V();
			let i = n.splice(r, 1)[0];
			if (t.mode === "into") i.parent = t.id, n.push(i), ae(t.id);
			else {
				let e = n.findIndex((e) => e.kind === t.kind && e.id === t.id);
				e < 0 ? (i.parent = "", n.push(i)) : (i.parent = n[e].parent || "", n.splice(t.mode === "before" ? e : e + 1, 0, i));
			}
			F(n), V();
		}
		function V() {
			u.value = null, v.value = null;
		}
		let H = O(!1), U = O(""), W = O(!1), G = O(0), K = O(null), q = D({
			open: !1,
			x: 0,
			y: 0,
			mode: "blank",
			target: null
		}), J = O(!1), ue = O(null), Y = O(""), X = O(!1), fe = O(!1), pe = O(null), Z = O(""), Q = O(!1), me = O(null);
		function he(e) {
			q.x = Math.max(8, Math.min(e.clientX, window.innerWidth - 210)), q.y = Math.max(8, Math.min(e.clientY, window.innerHeight - 160));
		}
		function ge(e, t) {
			he(e), q.mode = t.kind === "group" ? "group" : "ws", q.target = t.kind === "group" ? t.group : t.ws, q.open = !0;
		}
		function _e(e) {
			e.target.closest && e.target.closest(".head") || (he(e), q.mode = "blank", q.target = null, q.open = !0);
		}
		function $() {
			q.open = !1;
		}
		function ve(e) {
			pe.value = { id: e.id }, Z.value = e.name || "", fe.value = !0, $();
		}
		function be() {
			let e = (Z.value || "").trim().slice(0, 80);
			e && pe.value && (F(M().map((t) => t.kind === "group" && t.id === pe.value.id ? {
				...t,
				name: e
			} : t)), fe.value = !1);
		}
		function xe() {
			let e = M(), t = {
				kind: "group",
				id: z(),
				name: "新分组",
				parent: ""
			};
			e.push(t), F(e), $(), ve(t);
		}
		function Se() {
			let e = q.target;
			if (!e) return;
			let t = M(), n = {
				kind: "group",
				id: z(),
				name: "新分组",
				parent: e.id
			};
			t.push(n), F(t), ae(e.id), $(), ve(n);
		}
		function Ce() {
			let e = q.target;
			if (!e) return;
			let t = M(), n = {
				kind: "group",
				id: z(),
				name: "新分组",
				parent: ""
			};
			t.push(n), L(t, "ws", e.id, n.id), F(t), $(), ve(n);
		}
		function we(e) {
			if (!q.target) return;
			let t = M();
			L(t, "ws", q.target.id, e), F(t), e && ae(e), $();
		}
		function Te() {
			me.value = q.target, Q.value = !0, $();
		}
		function Ee() {
			let e = me.value ? me.value.id : "";
			if (e) {
				let t = M(), n = t.findIndex((t) => t.kind === "group" && t.id === e);
				if (n >= 0) {
					let r = t[n].parent || "";
					t.splice(n, 1);
					for (let n of t) (n.parent || "") === e && (n.parent = r);
					F(t);
				}
			}
			Q.value = !1;
		}
		function De(e) {
			ue.value = e, Y.value = e.alias || "", J.value = !0, $();
		}
		async function Oe() {
			if (ue.value) {
				X.value = !0;
				try {
					await r.saveAlias(ue.value.id, (Y.value || "").trim()), J.value = !1, o("changed"), o("notice", {
						text: a.value.aliasSaved,
						color: "primary"
					});
				} catch (e) {
					o("notice", {
						text: `${a.value.aliasFailed}${e.message}`,
						color: "error"
					});
				} finally {
					X.value = !1;
				}
			}
		}
		async function ke(e, t) {
			let n = t === "rel" && e.rel || e.root, r = await ye(n);
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
			q.open = !1, Pe(), je.value = e ? e.id : "";
		}
		I(() => r.workspaces.map((e) => e.id).join(","), () => {
			let e = r.workspaces.filter((e) => !Me.has(e.id)).map((e) => e.id);
			if (Me = new Set(r.workspaces.map((e) => e.id)), !je.value || !e.length) return;
			let t = je.value;
			je.value = "", o("groups-change", $e(et(r.groups, r.workspaces), e, t));
		});
		function Pe() {
			je.value = "", U.value = "", W.value = !1, G.value += 1, H.value = !0;
		}
		function Fe() {
			let e = U.value.trim();
			e && (H.value = !1, o("add", e));
		}
		function Ie(e) {
			K.value = e;
		}
		function Le() {
			let e = K.value;
			K.value = null, e && o("remove", e.id);
		}
		return (t, r) => {
			let i = j("v-btn"), o = j("v-icon"), s = j("v-list-item-title"), u = j("v-list-item-subtitle"), d = j("v-list-item"), v = j("v-list"), w = j("v-text-field"), T = j("v-spacer");
			return E(), m("div", {
				class: "list",
				onContextmenu: B(_e, ["prevent", "stop"])
			}, [
				h("div", tt, [h("span", nt, N(a.value.headTitle), 1), _(i, {
					size: "small",
					variant: "text",
					color: "primary",
					"prepend-icon": "mdi-plus",
					loading: e.busy,
					onClick: Pe
				}, {
					default: R(() => [g(N(a.value.add), 1)]),
					_: 1
				}, 8, ["loading"])]),
				!e.workspaces.length && !y.value ? (E(), m("div", rt, N(a.value.empty), 1)) : p("", !0),
				_(v, {
					density: "compact",
					nav: "",
					class: "items",
					onDrop: B(le, ["prevent"])
				}, {
					default: R(() => [(E(!0), m(l, null, k(b.value, (n) => (E(), f(d, {
						key: n.key,
						active: n.kind === "ws" && n.id === e.current,
						"active-color": "primary",
						draggable: "true",
						style: C({ paddingLeft: `${12 + n.depth * 18}px` }),
						class: x(oe(n)),
						onClick: (e) => re(n),
						onContextmenu: B((e) => ge(e, n), ["prevent", "stop"]),
						onDragstart: (e) => se(e, n),
						onDragover: B((e) => ce(e, n), ["prevent"]),
						onDragend: V
					}, {
						append: R(() => [n.kind === "ws" ? (E(), f(i, {
							key: 0,
							icon: !0,
							size: "x-small",
							variant: "text",
							title: a.value.forgetTitle,
							class: "forget",
							onClick: B((e) => Ie(n.ws), ["stop"])
						}, {
							default: R(() => [_(o, { size: "18" }, {
								default: R(() => [...r[24] ||= [g("mdi-close", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["title", "onClick"])) : p("", !0)]),
						default: R(() => [(E(!0), m(l, null, k(n.depth, (e) => (E(), m("span", {
							key: e,
							class: "guide",
							style: C({ left: `${20 + (e - 1) * 18}px` })
						}, null, 4))), 128)), n.kind === "group" ? (E(), f(s, {
							key: 0,
							class: "gname"
						}, {
							default: R(() => [
								_(o, { size: "16" }, {
									default: R(() => [g(N(c.value.has(n.id) ? "mdi-chevron-right" : "mdi-chevron-down"), 1)]),
									_: 2
								}, 1024),
								_(o, { size: "16" }, {
									default: R(() => [...r[23] ||= [g("mdi-folder-outline", -1)]]),
									_: 1
								}),
								h("span", it, N(n.name), 1)
							]),
							_: 2
						}, 1024)) : (E(), m(l, { key: 1 }, [_(s, {
							class: "name",
							title: n.ws.alias ? n.ws.root : ""
						}, {
							default: R(() => [h("span", at, N(n.ws.alias || Ae(n.ws.root)), 1), A(t.$slots, "title-extra", { ws: n.ws }, void 0, !0)]),
							_: 2
						}, 1032, ["title"]), _(u, {
							class: "path",
							title: n.ws.url || n.ws.root
						}, {
							default: R(() => [g(N(n.ws.url || n.ws.root), 1)]),
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
				q.open ? (E(), m("div", {
					key: 1,
					class: "ctxmenu",
					style: C({
						left: q.x + "px",
						top: q.y + "px"
					}),
					onClick: r[7] ||= B(() => {}, ["stop"]),
					onContextmenu: r[8] ||= B(() => {}, ["prevent", "stop"])
				}, [q.mode === "ws" ? (E(), m(l, { key: 0 }, [
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[0] ||= (e) => De(q.target)
					}, [_(o, { size: "16" }, {
						default: R(() => [...r[25] ||= [g("mdi-rename-box", -1)]]),
						_: 1
					}), g(N(a.value.menuAlias), 1)]),
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[1] ||= (e) => ke(q.target, "rel")
					}, [_(o, { size: "16" }, {
						default: R(() => [...r[26] ||= [g("mdi-content-copy", -1)]]),
						_: 1
					}), g(N(a.value.copyRel), 1)]),
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[2] ||= (e) => ke(q.target, "abs")
					}, [_(o, { size: "16" }, {
						default: R(() => [...r[27] ||= [g("mdi-content-copy", -1)]]),
						_: 1
					}), g(N(a.value.copyAbs), 1)]),
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[3] ||= (e) => q.mode = "pick"
					}, [
						_(o, { size: "16" }, {
							default: R(() => [...r[28] ||= [g("mdi-folder-move-outline", -1)]]),
							_: 1
						}),
						r[29] ||= g("移到分组 ", -1),
						r[30] ||= h("span", { class: "more" }, "›", -1)
					])
				], 64)) : q.mode === "pick" ? (E(), m(l, { key: 1 }, [
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[4] ||= (e) => we("")
					}, [_(o, { size: "16" }, {
						default: R(() => [...r[31] ||= [g("mdi-format-list-bulleted", -1)]]),
						_: 1
					}), r[32] ||= g("移出分组 ", -1)]),
					(E(!0), m(l, null, k(S.value, (e) => (E(), m("button", {
						key: e.id,
						type: "button",
						class: "ctxitem",
						style: C({ paddingLeft: `${10 + e.depth * 18}px` }),
						onClick: (t) => we(e.id)
					}, [_(o, { size: "16" }, {
						default: R(() => [...r[33] ||= [g("mdi-folder-outline", -1)]]),
						_: 1
					}), g(N(e.name), 1)], 12, ot))), 128)),
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: Ce
					}, [_(o, { size: "16" }, {
						default: R(() => [...r[34] ||= [g("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), r[35] ||= g("新建分组并移入 ", -1)])
				], 64)) : q.mode === "group" ? (E(), m(l, { key: 2 }, [
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[5] ||= (e) => Ne(q.target)
					}, [_(o, { size: "16" }, {
						default: R(() => [...r[36] ||= [g("mdi-plus", -1)]]),
						_: 1
					}), g(N(a.value.menuAddInGroup), 1)]),
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: Se
					}, [_(o, { size: "16" }, {
						default: R(() => [...r[37] ||= [g("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), r[38] ||= g("新建子分组 ", -1)]),
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[6] ||= (e) => ve(q.target)
					}, [_(o, { size: "16" }, {
						default: R(() => [...r[39] ||= [g("mdi-rename-box", -1)]]),
						_: 1
					}), r[40] ||= g("重命名 ", -1)]),
					h("button", {
						type: "button",
						class: "ctxitem",
						onClick: Te
					}, [_(o, { size: "16" }, {
						default: R(() => [...r[41] ||= [g("mdi-trash-can-outline", -1)]]),
						_: 1
					}), r[42] ||= g("删除分组 ", -1)])
				], 64)) : (E(), m("button", {
					key: 3,
					type: "button",
					class: "ctxitem",
					onClick: xe
				}, [_(o, { size: "16" }, {
					default: R(() => [...r[43] ||= [g("mdi-folder-plus-outline", -1)]]),
					_: 1
				}), r[44] ||= g("新建分组 ", -1)]))], 36)) : p("", !0),
				_(n, {
					modelValue: J.value,
					"onUpdate:modelValue": r[11] ||= (e) => J.value = e,
					"initial-width": 460,
					"initial-height": 320,
					"min-width": 360,
					"min-height": 240
				}, {
					title: R(() => [g(N(a.value.aliasTitle), 1)]),
					actions: R(() => [
						_(T),
						_(i, {
							variant: "text",
							onClick: r[10] ||= (e) => J.value = !1
						}, {
							default: R(() => [...r[45] ||= [g("取消", -1)]]),
							_: 1
						}),
						_(i, {
							color: "primary",
							variant: "flat",
							loading: X.value,
							onClick: Oe
						}, {
							default: R(() => [...r[46] ||= [g(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"])
					]),
					default: R(() => [
						h("p", st, N(ue.value ? ue.value.root : ""), 1),
						_(w, {
							modelValue: Y.value,
							"onUpdate:modelValue": r[9] ||= (e) => Y.value = e,
							label: "别名",
							density: "compact",
							variant: "outlined",
							maxlength: "80",
							clearable: "",
							autofocus: "",
							onKeyup: te(Oe, ["enter"])
						}, null, 8, ["modelValue"]),
						h("p", ct, N(a.value.aliasHint), 1)
					]),
					_: 1
				}, 8, ["modelValue"]),
				_(n, {
					modelValue: fe.value,
					"onUpdate:modelValue": r[14] ||= (e) => fe.value = e,
					"initial-width": 440,
					"initial-height": 260,
					"min-width": 340,
					"min-height": 200
				}, {
					title: R(() => [...r[47] ||= [g("分组名称", -1)]]),
					actions: R(() => [
						_(T),
						_(i, {
							variant: "text",
							onClick: r[13] ||= (e) => fe.value = !1
						}, {
							default: R(() => [...r[48] ||= [g("取消", -1)]]),
							_: 1
						}),
						_(i, {
							color: "primary",
							variant: "flat",
							disabled: !Z.value.trim(),
							onClick: be
						}, {
							default: R(() => [...r[49] ||= [g(" 保存 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					]),
					default: R(() => [_(w, {
						modelValue: Z.value,
						"onUpdate:modelValue": r[12] ||= (e) => Z.value = e,
						label: "名称",
						density: "compact",
						variant: "outlined",
						maxlength: "80",
						autofocus: "",
						onKeyup: te(be, ["enter"])
					}, null, 8, ["modelValue"])]),
					_: 1
				}, 8, ["modelValue"]),
				_(n, {
					modelValue: Q.value,
					"onUpdate:modelValue": r[16] ||= (e) => Q.value = e,
					"initial-width": 440,
					"initial-height": 240,
					"min-width": 340,
					"min-height": 200
				}, {
					title: R(() => [...r[50] ||= [g("删除分组", -1)]]),
					actions: R(() => [
						_(T),
						_(i, {
							variant: "text",
							onClick: r[15] ||= (e) => Q.value = !1
						}, {
							default: R(() => [...r[51] ||= [g("取消", -1)]]),
							_: 1
						}),
						_(i, {
							color: "error",
							variant: "flat",
							onClick: Ee
						}, {
							default: R(() => [...r[52] ||= [g("删除", -1)]]),
							_: 1
						})
					]),
					default: R(() => [g(" " + N(me.value ? me.value.name : "") + " ", 1), r[53] ||= h("p", { class: "tip" }, "里面的子分组与工作区移到上一级，工作区本身不动。", -1)]),
					_: 1
				}, 8, ["modelValue"]),
				_(n, {
					modelValue: H.value,
					"onUpdate:modelValue": r[20] ||= (e) => H.value = e,
					"initial-width": 620,
					"initial-height": 460,
					"min-width": 420,
					"min-height": 300
				}, {
					title: R(() => [g(N(a.value.addTitle), 1)]),
					actions: R(() => [
						_(T),
						_(i, {
							variant: "text",
							onClick: r[19] ||= (e) => H.value = !1
						}, {
							default: R(() => [...r[54] ||= [g("取消", -1)]]),
							_: 1
						}),
						_(i, {
							color: "primary",
							variant: "flat",
							disabled: !U.value.trim() || !W.value,
							onClick: Fe
						}, {
							default: R(() => [g(N(a.value.addConfirm), 1)]),
							_: 1
						}, 8, ["disabled"])
					]),
					default: R(() => [(E(), f(P(de), {
						key: G.value,
						modelValue: U.value,
						"onUpdate:modelValue": r[17] ||= (e) => U.value = e,
						tip: a.value.addTip,
						label: a.value.addLabel,
						placeholder: a.value.addPlaceholder,
						loader: e.dirs,
						"onUpdate:valid": r[18] ||= (e) => W.value = e
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
					modelValue: K.value,
					"onUpdate:modelValue": r[22] ||= (e) => K.value = e,
					"initial-width": 440,
					"initial-height": 260,
					"min-width": 340,
					"min-height": 200
				}, {
					title: R(() => [g(N(a.value.removeTitle), 1)]),
					actions: R(() => [
						_(T),
						_(i, {
							variant: "text",
							onClick: r[21] ||= (e) => K.value = null
						}, {
							default: R(() => [...r[55] ||= [g("取消", -1)]]),
							_: 1
						}),
						_(i, {
							color: "error",
							variant: "flat",
							onClick: Le
						}, {
							default: R(() => [g(N(a.value.removeConfirm), 1)]),
							_: 1
						})
					]),
					default: R(() => [g(" " + N(K.value ? K.value.root : "") + " ", 1), h("p", lt, N(a.value.removeText), 1)]),
					_: 1
				}, 8, ["modelValue"])
			], 32);
		};
	}
}, [["__scopeId", "data-v-593e1b9a"]]), dt = "web-shared-resizing";
function ft({ area: e, initial: t, min: n = 0, max: r = 100, rightMin: i = 0, axis: a = "x", unit: o = "px", persist: s = "" }) {
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
		l.value && (l.value = !1, window.removeEventListener("pointermove", m), document.body.classList.remove(dt));
	}
	function g(t) {
		t.button === 0 && e.value && (l.value = !0, u = a === "x" ? t.clientX : t.clientY, d = c.value, t.preventDefault(), document.body.classList.add(dt), window.addEventListener("pointermove", m), window.addEventListener("pointerup", h, { once: !0 }));
	}
	function _() {
		c.value = t;
	}
	return I(c, (e) => {
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
var pt = ["starting", "ready"];
function mt(e, t = pt) {
	return (e.services || []).filter((e) => e.run && t.includes(e.run.status)).length;
}
function ht(e, t = pt) {
	let n = [];
	for (let r of e || []) {
		let e = mt(r, t);
		e && n.push({
			id: r.id,
			name: r.alias || s(r.root),
			count: e
		});
	}
	return n;
}
// src/components/services/WorkspaceShell.vue
var gt = { class: "brand" }, _t = { class: "run-count" }, vt = { class: "side" }, yt = { class: "content" }, bt = /*#__PURE__*/ e({
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
		let r = e, o = n, s = d(() => ht(r.workspaces));
		function c(e) {
			o("select-workspace", e);
		}
		let u = O(null), v = O(!0), { size: b, resizing: S, start: w, reset: T } = ft({
			area: u,
			initial: 268,
			min: 200,
			rightMin: 420,
			persist: `${r.title}.shell.side-width`
		});
		return (n, r) => {
			let o = j("v-app-bar-nav-icon"), d = j("v-app-bar-title"), D = j("v-spacer"), O = j("v-chip"), M = j("v-list-item-title"), ee = j("v-list-item"), I = j("v-list"), L = j("v-menu"), te = j("v-btn"), B = j("v-app-bar"), ne = j("v-main"), re = j("v-app");
			return E(), f(re, null, {
				default: R(() => [
					_(B, {
						density: "comfortable",
						flat: "",
						border: "b",
						class: "app-bar"
					}, {
						default: R(() => [
							_(o, {
								title: v.value ? "收起左侧列表" : "展开左侧列表",
								onClick: r[0] ||= (e) => v.value = !v.value
							}, null, 8, ["title"]),
							_(d, null, {
								default: R(() => [h("span", gt, N(e.title), 1)]),
								_: 1
							}),
							_(D),
							e.workspaces.length ? (E(), f(L, {
								key: 0,
								location: "bottom end"
							}, {
								activator: R(({ props: t }) => [_(O, y(t, {
									size: "small",
									variant: "tonal",
									class: "running",
									color: e.running ? "ready" : void 0,
									"prepend-icon": "mdi-play-circle-outline",
									title: e.running ? `所有工作区共 ${e.running} 个进程在跑` : "所有工作区都没有在跑的进程"
								}), {
									default: R(() => [g(N(e.running) + " 个在跑 ", 1)]),
									_: 1
								}, 16, ["color", "title"])]),
								default: R(() => [_(I, {
									density: "compact",
									class: "running-menu"
								}, {
									default: R(() => [(E(!0), m(l, null, k(s.value, (t) => (E(), f(ee, {
										key: t.id,
										active: e.current && e.current.id === t.id,
										onClick: (e) => c(t.id)
									}, {
										append: R(() => [h("span", _t, N(t.count) + " 个", 1)]),
										default: R(() => [_(M, { class: "run-name" }, {
											default: R(() => [g(N(t.name), 1)]),
											_: 2
										}, 1024)]),
										_: 2
									}, 1032, ["active", "onClick"]))), 128)), s.value.length ? p("", !0) : (E(), f(ee, {
										key: 0,
										disabled: ""
									}, {
										default: R(() => [_(M, null, {
											default: R(() => [...r[3] ||= [g("没有在跑的进程", -1)]]),
											_: 1
										})]),
										_: 1
									}))]),
									_: 1
								})]),
								_: 1
							})) : p("", !0),
							A(n.$slots, "metrics", {}, void 0, !0),
							_(te, {
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
					_(ne, { class: "fill-height" }, {
						default: R(() => [h("div", {
							ref_key: "shellRef",
							ref: u,
							class: "shell"
						}, [
							h("div", {
								class: "side-slot",
								style: C({ width: v.value ? `${P(b)}px` : "0px" })
							}, null, 4),
							h("div", {
								class: x(["side-layer", { folded: !v.value }]),
								style: C({ width: `${P(b)}px` })
							}, [h("aside", vt, [A(n.$slots, "sidebar", {}, void 0, !0)])], 6),
							z(_(a, {
								axis: "x",
								active: P(S),
								onStart: P(w),
								onReset: P(T)
							}, null, 8, [
								"active",
								"onStart",
								"onReset"
							]), [[F, v.value]]),
							h("main", yt, [A(n.$slots, "default", { ws: e.current }, void 0, !0), e.current ? p("", !0) : (E(), f(i, y({ key: 0 }, e.empty, { onAction: r[2] ||= (e) => n.$emit("empty-action") }), null, 16))])
						], 512)]),
						_: 3
					})
				]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-67021267"]]), xt = { style: { width: "42%" } }, St = { class: "svc-name" }, Ct = ["title"], wt = ["title"], Tt = { class: "status-line" }, Et = {
	key: 0,
	class: "meta"
}, Dt = {
	key: 1,
	class: "meta"
}, Ot = ["title"], kt = {
	key: 1,
	class: "meta"
}, At = {
	key: 2,
	class: "meta"
}, jt = { class: "ops" }, Mt = /*#__PURE__*/ e({
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
				default: R(() => [h("thead", null, [h("tr", null, [
					h("th", xt, N(e.nameTitle), 1),
					n[0] ||= h("th", null, "参数", -1),
					n[1] ||= h("th", { style: { width: "200px" } }, "状态", -1),
					n[2] ||= h("th", { style: { width: "230px" } }, null, -1)
				])]), h("tbody", null, [(E(!0), m(l, null, k(e.rows, (o) => (E(), m("tr", { key: o.key }, [
					h("td", null, [h("div", St, [h("span", null, N(o.title), 1), o.typeText ? (E(), f(r, {
						key: 0,
						size: "x-small",
						variant: "tonal",
						class: "type-chip"
					}, {
						default: R(() => [g(N(o.typeText), 1)]),
						_: 2
					}, 1024)) : p("", !0)]), e.showPath && o.path ? (E(), m("div", {
						key: 0,
						class: "svc-path",
						title: o.path
					}, N(o.path), 9, Ct)) : p("", !0)]),
					h("td", null, [h("div", {
						class: "cmd",
						title: o.cmd
					}, N(o.cmd), 9, wt)]),
					h("td", null, [h("div", Tt, [o.live ? (E(), m(l, { key: 0 }, [_(r, {
						size: "small",
						class: "status-chip",
						color: o.color,
						variant: "tonal",
						"prepend-icon": o.icon
					}, {
						default: R(() => [g(N(o.statusText), 1)]),
						_: 2
					}, 1032, ["color", "prepend-icon"]), o.port ? (E(), m("span", Et, "端口 " + N(o.port), 1)) : o.started ? (E(), m("span", Dt, N(o.ago), 1)) : p("", !0)], 64)) : o.run ? (E(), m(l, { key: 1 }, [_(r, {
						size: "small",
						class: "status-chip",
						color: o.color,
						variant: "tonal",
						"prepend-icon": o.icon,
						onClick: (e) => t.$emit("log", o)
					}, {
						default: R(() => [g(N(o.statusText), 1)]),
						_: 2
					}, 1032, [
						"color",
						"prepend-icon",
						"onClick"
					]), o.err ? (E(), m("span", {
						key: 0,
						class: "meta err",
						title: o.err
					}, N(o.err), 9, Ot)) : o.started ? (E(), m("span", kt, N(o.ago), 1)) : p("", !0)], 64)) : (E(), m("span", At, "—"))])]),
					h("td", jt, [o.live ? (E(), m(l, { key: 0 }, [_(i, {
						size: "small",
						variant: "text",
						"prepend-icon": "mdi-text-box-outline",
						onClick: (e) => t.$emit("log", o)
					}, {
						default: R(() => [...n[3] ||= [g(" 日志 ", -1)]]),
						_: 1
					}, 8, ["onClick"]), _(i, {
						size: "small",
						color: "error",
						variant: "tonal",
						loading: o.stopping,
						onClick: (e) => t.$emit("stop", o)
					}, {
						default: R(() => [...n[4] ||= [g(" 停止 ", -1)]]),
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
							default: R(() => [g(N(o.action), 1)]),
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
							default: R(() => [_(a, { size: "20" }, {
								default: R(() => [...n[5] ||= [g("mdi-tune", -1)]]),
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
							default: R(() => [...n[6] ||= [g(" 日志 ", -1)]]),
							_: 1
						}, 8, ["onClick"])) : p("", !0)
					], 64)), A(t.$slots, "row-extra", { row: o }, void 0, !0)])
				]))), 128))])]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-8df04734"]]), Nt = { class: "log-head" }, Pt = { class: "log-box" }, Ft = {
	key: 1,
	class: "log-empty"
}, It = /*#__PURE__*/ e({
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
			return E(), m(l, null, [h("div", Nt, [
				n[2] ||= h("span", { class: "label" }, "日志", -1),
				_(r),
				e.more ? (E(), f(i, {
					key: 0,
					size: "small",
					variant: "text",
					"prepend-icon": "mdi-history",
					onClick: n[0] ||= (e) => t.$emit("load-more")
				}, {
					default: R(() => [...n[1] ||= [g(" 更早 ", -1)]]),
					_: 1
				})) : p("", !0)
			]), h("div", Pt, [e.text ? (E(), f(ae, {
				key: 0,
				text: e.text,
				dark: e.dark,
				colorize: e.colorize
			}, null, 8, [
				"text",
				"dark",
				"colorize"
			])) : (E(), m("p", Ft, N(e.emptyText), 1))])], 64);
		};
	}
}, [["__scopeId", "data-v-d45becae"]]);
// src/composables/commons/useFileTree.js
function Lt(e, t = () => ({})) {
	let n = D({});
	function r() {
		let t = typeof e == "function" ? e() : P(e);
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
function Rt({ api: e, ws: t, statusText: n = {} }) {
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
	return I(t, (e) => {
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
function zt({ api: e, storageKey: t, extraState: n = {}, loadExtra: i = null, addedNotice: a = "已添加" }) {
	let o = D({
		workspaces: [],
		groups: [],
		...n
	}), s = ie(t, "", { writeDefaults: !1 }), c = O(!1), l = O(null), { snack: u, toast: f } = r(), p = null, m = 0, h = d(() => o.workspaces.find((e) => e.id === s.value) || null), g = d(() => o.workspaces.reduce((e, t) => e + mt(t), 0));
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
	async function ee() {
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
		start: ee,
		disconnect: S,
		addWorkspace: T,
		removeWorkspace: E,
		rescan: k,
		startService: A,
		stopService: j,
		saveService: M
	};
}
export { U as DirectoryNode, de as DirectoryPicker, qe as FileEditor, Ee as FileTree, pt as LIVE_STATUSES, ae as LogView, It as RunLogPanel, Mt as ServiceTable, ut as WorkspaceList, bt as WorkspaceShell, ye as copyText, Z as fileIcon, mt as runningCount, c as symbolAt, Lt as useFileTree, Rt as useRunLog, ft as useSplitPane, zt as useWorkspaceState };
