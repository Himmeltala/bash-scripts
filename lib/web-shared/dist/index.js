import { t as e } from "./_plugin-vue_export-helper.js";
import { n as t, r as n, t as r } from "./useToast.js";
import { n as i, t as a } from "./SplitHandle.js";
import { languageOf as o } from "./highlight.js";
import { Fragment as s, Teleport as c, computed as l, createBlock as u, createCommentVNode as d, createElementBlock as f, createElementVNode as p, createTextVNode as m, createVNode as h, guardReactiveProps as g, mergeProps as _, nextTick as v, normalizeClass as y, normalizeProps as b, normalizeStyle as x, onBeforeUnmount as S, onMounted as C, openBlock as w, reactive as T, ref as E, renderList as D, renderSlot as O, resolveComponent as k, resolveDynamicComponent as A, shallowRef as j, toDisplayString as M, unref as N, vShow as P, watch as F, watchEffect as I, withCtx as L, withDirectives as R, withKeys as z, withModifiers as B } from "vue";
import { Terminal as V } from "@xterm/xterm";
import { FitAddon as ee } from "@xterm/addon-fit";
import { useLocalStorage as te } from "@vueuse/core";
var H = /*#__PURE__*/ e({
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
		}, r = E(null), i = null, a = null, o = null, s = "";
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
		function p(e) {
			return e.type !== "keydown" || e.altKey || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "c" || !i.hasSelection() ? !0 : (navigator.clipboard?.writeText(i.getSelection()).catch(() => {}), !1);
		}
		return C(() => {
			i = new V({
				convertEol: !0,
				disableStdin: !0,
				cursorBlink: !1,
				scrollback: 5e3,
				fontFamily: "'JetBrains Mono', 'Noto Sans Mono CJK SC', 'Sarasa Mono SC', 'Cascadia Mono', Consolas, Menlo, monospace",
				fontSize: 12,
				lineHeight: 1.3,
				theme: c(t.dark)
			}), a = new ee(), i.loadAddon(a), i.open(r.value), requestAnimationFrame(() => i && a.fit()), document.fonts && document.fonts.load("12px 'JetBrains Mono'").then(() => i && a.fit()).catch(() => {}), o = new ResizeObserver(() => {
				i && a.fit();
			}), o.observe(r.value), i.attachCustomKeyEventHandler(p), d(t.text || "");
		}), F(() => t.text, (e) => d(e || "")), F(() => t.dark, (e) => {
			i && (i.options.theme = c(e));
		}), S(() => {
			o && o.disconnect(), i && i.dispose(), o = null, i = null;
		}), (t, n) => (w(), f("div", {
			ref_key: "host",
			ref: r,
			class: y(["term", { deeper: e.dark }]),
			style: x(e.height ? {
				height: e.height,
				flex: "0 0 auto"
			} : null)
		}, null, 6));
	}
}, [["__scopeId", "data-v-be16b898"]]), ne = { class: "node" }, re = ["title"], ie = {
	key: 0,
	class: "kids"
}, U = {
	key: 0,
	class: "hint"
}, W = {
	key: 1,
	class: "hint bad"
}, ae = {
	key: 0,
	class: "hint"
}, G = /*#__PURE__*/ e({
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
		let n = e, r = t, i = E(!1), a = E(!1), o = E(""), c = E(null);
		F(() => n.selected === n.node.path, (e) => {
			e && v(() => c.value && c.value.scrollIntoView({ block: "nearest" }));
		}, { immediate: !0 });
		async function l() {
			r("pick", n.node), i.value || (i.value = !0, await _());
		}
		async function g() {
			i.value = !i.value, i.value && await _();
		}
		async function _() {
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
			let r = k("v-icon"), _ = k("v-btn"), v = k("DirectoryNode", !0);
			return w(), f("div", ne, [p("div", {
				ref_key: "rowEl",
				ref: c,
				class: y(["row", { selected: e.node.path === e.selected }]),
				onClick: l
			}, [
				h(_, {
					icon: !0,
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: i.value ? "收起" : "展开",
					onClick: B(g, ["stop"])
				}, {
					default: L(() => [h(r, { size: "18" }, {
						default: L(() => [m(M(i.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"]),
				h(r, {
					size: "18",
					class: "folder"
				}, {
					default: L(() => [...n[1] ||= [m("mdi-folder-outline", -1)]]),
					_: 1
				}),
				p("span", {
					class: "label",
					title: e.node.path
				}, M(e.node.name), 9, re)
			], 2), i.value ? (w(), f("div", ie, [a.value ? (w(), f("p", U, "正在读取…")) : o.value ? (w(), f("p", W, M(o.value), 1)) : e.node.children ? (w(), f(s, { key: 2 }, [(w(!0), f(s, null, D(e.node.children, (r) => (w(), u(v, {
				key: r.path,
				node: r,
				selected: e.selected,
				loader: e.loader,
				onPick: n[0] ||= (e) => t.$emit("pick", e)
			}, null, 8, [
				"node",
				"selected",
				"loader"
			]))), 128)), e.node.children.length ? d("", !0) : (w(), f("p", ae, "没有子目录"))], 64)) : d("", !0)])) : d("", !0)]);
		};
	}
}, [["__scopeId", "data-v-9e855642"]]), K = { class: "picker" }, q = {
	key: 0,
	class: "tip"
}, oe = { class: "tree" }, se = { class: "root" }, J = ["title"], Y = {
	key: 0,
	class: "hint bad"
}, X = {
	key: 0,
	class: "hint"
}, ce = /*#__PURE__*/ e({
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
		let n = e, r = t, i = E(""), a = E(null), o = E(!0), c = E(""), g = l({
			get: () => n.modelValue,
			set: (e) => r("update:modelValue", e)
		}), _ = l(() => {
			let e = String(n.modelValue || "").trim();
			return e === "~" ? e = i.value : e.startsWith("~/") && (e = i.value + e.slice(1)), e.replace(/\/+$/, "");
		}), v = l(() => !i.value || !_.value ? !1 : n.validate ? !!n.validate(_.value, i.value) : _.value === i.value || _.value.startsWith(i.value + "/"));
		I(() => r("update:valid", v.value));
		function y(e) {
			g.value = e.path;
		}
		return C(async () => {
			try {
				let e = await n.loader();
				i.value = e.home, a.value = e.entries.map((e) => ({
					...e,
					children: null
				}));
			} catch (e) {
				c.value = e.message;
			} finally {
				o.value = !1;
			}
		}), (t, n) => {
			let r = k("v-text-field"), l = k("v-icon"), b = k("v-progress-circular");
			return w(), f("div", K, [
				e.tip ? (w(), f("p", q, M(e.tip), 1)) : d("", !0),
				h(r, {
					modelValue: g.value,
					"onUpdate:modelValue": n[0] ||= (e) => g.value = e,
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
				p("div", oe, [p("div", se, [
					h(l, { size: "18" }, {
						default: L(() => [...n[1] ||= [m("mdi-home-outline", -1)]]),
						_: 1
					}),
					p("span", {
						class: "root-label",
						title: i.value || "~"
					}, "~", 8, J),
					o.value ? (w(), u(b, {
						key: 0,
						size: "12",
						width: "2",
						indeterminate: ""
					})) : d("", !0)
				]), c.value ? (w(), f("p", Y, M(c.value), 1)) : a.value ? (w(), f(s, { key: 1 }, [(w(!0), f(s, null, D(a.value, (t) => (w(), u(G, {
					key: t.path,
					node: t,
					selected: _.value,
					loader: e.loader,
					onPick: y
				}, null, 8, [
					"node",
					"selected",
					"loader"
				]))), 128)), a.value.length ? d("", !0) : (w(), f("p", X, "家目录下没有子目录"))], 64)) : d("", !0)])
			]);
		};
	}
}, [["__scopeId", "data-v-a4b93ef9"]]), Z = {
	icon: "mdi-file-outline",
	color: ""
}, le = {
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
}, ue = {
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
	let t = String(e || "").split("/").pop().toLowerCase(), n = le[t];
	if (n) return n;
	let r = t.lastIndexOf(".");
	return r < 0 ? Z : ue[t.slice(r + 1)] || Z;
}
// src/components/commons/FileTree/FileTreeNode.vue
var de = { class: "branch" }, fe = ["data-path"], pe = {
	key: 1,
	class: "arrow-space"
}, me = ["title"], he = {
	key: 0,
	class: "hint"
}, ge = {
	key: 1,
	class: "hint bad"
}, _e = {
	key: 2,
	class: "hint"
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
		let n = e, r = t, i = {
			loading: "正在读取…",
			empty: "空目录",
			truncated: "这一层文件太多，只列了前面一部分。"
		}, a = l(() => ({
			...i,
			...n.texts
		})), o = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, c = l(() => n.keyOf(n.node)), g = l(() => n.dirOf(n.node)), v = l(() => n.expanded[c.value] === !0), b = l(() => n.cache[c.value] || o), S = l(() => g.value ? null : Q(n.nameOf(n.node))), C = l(() => g.value ? v.value ? "mdi-folder-open-outline" : "mdi-folder-outline" : S.value.icon), T = l(() => g.value ? null : S.value.color ? { color: S.value.color } : null);
		function E() {
			n.pickOnRowClick && (g.value ? r("toggle", c.value) : r("pick", n.node));
		}
		function A(e) {
			r("context", {
				node: n.node,
				event: e
			});
		}
		return (t, n) => {
			let i = k("v-icon"), o = k("v-btn"), l = k("FileTreeNode", !0);
			return w(), f("div", de, [p("div", {
				class: y(["row", [e.rowClass ? e.rowClass(e.node) : null, { clickable: e.pickOnRowClick }]]),
				"data-path": c.value,
				style: x({ paddingLeft: 4 + e.depth * 14 + "px" }),
				onClick: E,
				onContextmenu: B(A, ["prevent", "stop"])
			}, [
				g.value ? (w(), u(o, {
					key: 0,
					icon: "",
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: v.value ? "收起" : "展开",
					onClick: n[0] ||= B((e) => r("toggle", c.value), ["stop"])
				}, {
					default: L(() => [h(i, { size: "16" }, {
						default: L(() => [m(M(v.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"])) : (w(), f("span", pe)),
				h(i, {
					size: "16",
					class: y(g.value ? "folder" : "file"),
					style: x(T.value)
				}, {
					default: L(() => [m(M(C.value), 1)]),
					_: 1
				}, 8, ["class", "style"]),
				O(t.$slots, "row-before-label", {
					node: e.node,
					open: v.value,
					state: b.value
				}, void 0, !0),
				p("span", {
					class: y(["label", e.labelClass]),
					title: c.value
				}, M(e.nameOf(e.node)), 11, me),
				O(t.$slots, "row-after-label", {
					node: e.node,
					open: v.value,
					state: b.value
				}, void 0, !0)
			], 46, fe), g.value && v.value ? (w(), f(s, { key: 0 }, [b.value.loading ? (w(), f("p", he, M(a.value.loading), 1)) : b.value.error ? (w(), f("p", ge, M(b.value.error), 1)) : b.value.entries.length ? (w(), f(s, { key: 3 }, [(w(!0), f(s, null, D(b.value.entries, (i) => (w(), u(l, {
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
				"row-before-label": L((e) => [O(t.$slots, "row-before-label", _({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": L((e) => [O(t.$slots, "row-after-label", _({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), b.value.truncated ? (w(), f("p", $, M(a.value.truncated), 1)) : d("", !0)], 64)) : (w(), f("p", _e, M(a.value.empty), 1))], 64)) : d("", !0)]);
		};
	}
}, [["__scopeId", "data-v-7825703d"]]);
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
	class: "hint"
}, xe = {
	key: 1,
	class: "hint bad"
}, Se = {
	key: 2,
	class: "hint"
}, Ce = {
	key: 0,
	class: "hint"
}, we = ["disabled"], Te = ["disabled"], Ee = ["disabled"], De = /*#__PURE__*/ e({
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
			loading: "正在读取…",
			empty: "空目录",
			truncated: "这一层文件太多，只列了前面一部分。",
			rootLoading: "正在读取目录…",
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
		}, o = l(() => ({
			...a,
			...r.texts
		})), y = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, A = T({}), j = T({}), N = E(!1), P = E(null), I = l(() => r.root ? r.keyOf(r.root) : ""), R = l(() => j[I.value] || y);
		async function z(e, t = !1) {
			if (!t && j[e]) return;
			j[e] || (j[e] = {
				loading: !1,
				error: "",
				entries: [],
				truncated: !1
			});
			let n = j[e];
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
		function V(e) {
			A[e] = !A[e], A[e] && z(e);
		}
		async function ee(e) {
			A[I.value] = !0, await z(I.value);
			let t = I.value;
			for (let n of String(e || "").split("/").filter(Boolean)) t = t ? `${t}/${n}` : n, await z(t), A[t] = !0;
		}
		function te() {
			for (let e of Object.keys(j)) delete j[e];
			for (let e of Object.keys(A)) delete A[e];
			A[I.value] = !0, z(I.value);
		}
		async function H(e) {
			await z(e, !0);
		}
		function ne(e) {
			let t = P.value ? P.value.querySelectorAll("[data-path]") : [];
			for (let n of t) if (n.dataset.path === e) {
				n.scrollIntoView({ block: "nearest" });
				return;
			}
		}
		async function re() {
			await Promise.all(Object.keys(j).map((e) => z(e, !0)));
		}
		function ie() {
			r.active && !N.value && (N.value = !0, A[I.value] = !0, z(I.value));
		}
		r.active && ie(), C(ie), F(() => r.active, (e) => {
			e && ie();
		});
		let U = T({
			open: !1,
			x: 0,
			y: 0,
			node: null,
			copied: ""
		}), W = E(null), ae = 0, G = l(() => U.node ? String(r.keyOf(U.node) || "") : ""), K = l(() => {
			if (!U.node || !r.rootPath) return "";
			let e = r.rootPath.replace(/\/+$/, ""), t = G.value;
			return t ? `${e}/${t}` : e;
		}), q = l(() => U.node ? r.dirOf(U.node) : !1);
		function oe({ node: e, event: t }) {
			U.node = e, U.copied = "", U.x = t.clientX, U.y = t.clientY, U.open = !0, v(se);
		}
		function se() {
			if (!W.value) return;
			let e = W.value.offsetWidth, t = W.value.offsetHeight;
			U.x = Math.max(6, Math.min(U.x, window.innerWidth - e - 6)), U.y = Math.max(6, Math.min(U.y, window.innerHeight - t - 6));
		}
		function J() {
			U.open = !1, U.node = null, U.copied = "", clearTimeout(ae);
		}
		async function Y(e) {
			let t = e === "abs" ? K.value : G.value;
			t && await ye(t) && (U.copied = e, clearTimeout(ae), ae = setTimeout(J, 700));
		}
		function X(e) {
			if (!U.node) return;
			let t = U.node;
			J(), i("action", {
				action: e,
				node: t
			});
		}
		function ce() {
			if (!U.node || !r.downloadOf) return;
			let e = U.node, t = r.downloadOf(e);
			if (J(), !t) return;
			let n = r.nameOf(e) || "download", i = document.createElement("a");
			i.href = t, i.download = r.dirOf(e) ? `${n}.zip` : n, i.rel = "noopener", i.style.display = "none", document.body.appendChild(i), i.click(), i.remove();
		}
		function Z(e) {
			W.value && !W.value.contains(e.target) && J();
		}
		function le(e) {
			e.key === "Escape" && J();
		}
		function ue() {
			U.open && J();
		}
		function Q(e) {
			let t = e ? "addEventListener" : "removeEventListener";
			document[t]("mousedown", Z, !0), document[t]("keydown", le, !0), window[t]("scroll", ue, !0), window[t]("resize", ue);
		}
		return F(() => U.open, (e) => Q(e)), S(() => {
			J(), Q(!1);
		}), t({
			reveal: ee,
			reload: te,
			reloadDir: H,
			refreshAll: re,
			scrollTo: ne,
			toggle: V
		}), (t, n) => {
			let r = k("v-icon");
			return w(), f("div", {
				ref_key: "rootRef",
				ref: P,
				class: "file-tree"
			}, [e.root ? (w(), u(ve, {
				key: 0,
				node: e.root,
				depth: 0,
				expanded: A,
				cache: j,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: V,
				onPick: n[0] ||= (e) => i("pick", e),
				onContext: oe
			}, {
				"row-before-label": L((e) => [O(t.$slots, "row-before-label", b(g(e)), void 0, !0)]),
				"row-after-label": L((e) => [O(t.$slots, "row-after-label", b(g(e)), void 0, !0)]),
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
			])) : (w(), f(s, { key: 1 }, [R.value.loading ? (w(), f("p", be, M(o.value.rootLoading), 1)) : R.value.error ? (w(), f("p", xe, M(R.value.error), 1)) : R.value.entries.length ? (w(), f(s, { key: 3 }, [(w(!0), f(s, null, D(R.value.entries, (r) => (w(), u(ve, {
				key: e.keyOf(r),
				node: r,
				depth: 0,
				expanded: A,
				cache: j,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: V,
				onPick: n[1] ||= (e) => i("pick", e),
				onContext: oe
			}, {
				"row-before-label": L((e) => [O(t.$slots, "row-before-label", _({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": L((e) => [O(t.$slots, "row-after-label", _({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), R.value.truncated ? (w(), f("p", Ce, M(o.value.truncated), 1)) : d("", !0)], 64)) : (w(), f("p", Se, M(o.value.rootEmpty), 1))], 64)), (w(), u(c, { to: "body" }, [U.open ? (w(), f("div", {
				key: 0,
				ref_key: "menuRef",
				ref: W,
				class: "ft-menu",
				style: x({
					left: U.x + "px",
					top: U.y + "px"
				}),
				onContextmenu: n[8] ||= B(() => {}, ["prevent"])
			}, [
				e.editable ? (w(), f(s, { key: 0 }, [
					q.value ? (w(), f("button", {
						key: 0,
						class: "ft-item",
						type: "button",
						onClick: n[2] ||= (e) => X("create-file")
					}, [h(r, { size: "16" }, {
						default: L(() => [...n[9] ||= [m("mdi-file-plus-outline", -1)]]),
						_: 1
					}), p("span", null, M(o.value.newFile), 1)])) : d("", !0),
					q.value ? (w(), f("button", {
						key: 1,
						class: "ft-item",
						type: "button",
						onClick: n[3] ||= (e) => X("create-dir")
					}, [h(r, { size: "16" }, {
						default: L(() => [...n[10] ||= [m("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), p("span", null, M(o.value.newDir), 1)])) : d("", !0),
					p("button", {
						class: "ft-item",
						type: "button",
						disabled: !G.value,
						onClick: n[4] ||= (e) => X("rename")
					}, [h(r, { size: "16" }, {
						default: L(() => [...n[11] ||= [m("mdi-form-textbox", -1)]]),
						_: 1
					}), p("span", null, M(o.value.rename), 1)], 8, we),
					p("button", {
						class: "ft-item danger",
						type: "button",
						disabled: !G.value,
						onClick: n[5] ||= (e) => X("delete")
					}, [h(r, { size: "16" }, {
						default: L(() => [...n[12] ||= [m("mdi-trash-can-outline", -1)]]),
						_: 1
					}), p("span", null, M(o.value.delete), 1)], 8, Te),
					n[13] ||= p("div", { class: "ft-sep" }, null, -1)
				], 64)) : d("", !0),
				p("button", {
					class: "ft-item",
					type: "button",
					disabled: !G.value,
					onClick: n[6] ||= (e) => Y("rel")
				}, [h(r, { size: "16" }, {
					default: L(() => [...n[14] ||= [m("mdi-content-copy", -1)]]),
					_: 1
				}), p("span", null, M(U.copied === "rel" ? o.value.copied : o.value.copyRel), 1)], 8, Ee),
				e.rootPath ? (w(), f("button", {
					key: 1,
					class: "ft-item",
					type: "button",
					onClick: n[7] ||= (e) => Y("abs")
				}, [h(r, { size: "16" }, {
					default: L(() => [...n[15] ||= [m("mdi-link-variant", -1)]]),
					_: 1
				}), p("span", null, M(U.copied === "abs" ? o.value.copied : o.value.copyAbs), 1)])) : d("", !0),
				e.downloadOf ? (w(), f("button", {
					key: 2,
					class: "ft-item",
					type: "button",
					onClick: ce
				}, [h(r, { size: "16" }, {
					default: L(() => [m(M(q.value ? "mdi-folder-zip-outline" : "mdi-download"), 1)]),
					_: 1
				}), p("span", null, M(q.value ? o.value.downloadDir : o.value.downloadFile), 1)])) : d("", !0)
			], 36)) : d("", !0)]))], 512);
		};
	}
}, [["__scopeId", "data-v-e341dbe0"]]), Oe = { class: "file-head" }, ke = { class: "crumbs" }, Ae = ["title", "onClick"], je = { class: "meta" }, Me = /*#__PURE__*/ e({
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
		let n = e, r = t, i = l(() => {
			let e = String(n.path || "").split("/").filter(Boolean), t = "";
			return e.map((e) => (t = t ? `${t}/${e}` : e, {
				name: e,
				path: t
			}));
		}), a = l(() => {
			if (n.size === void 0 || n.size === null) return "";
			let e = Number(n.size) || 0;
			return e < 1024 ? `${e} 字节` : e < 1048576 ? `${(e / 1024).toFixed(1)} KB` : `${(e / 1024 / 1024).toFixed(1)} MB`;
		});
		function o(e, t) {
			t !== i.value.length - 1 && r("navigate", e.path);
		}
		return (t, n) => (w(), f("div", Oe, [
			p("nav", ke, [p("button", {
				class: "seg",
				title: "回到根目录",
				onClick: n[0] ||= (e) => r("navigate", "")
			}, M(e.rootName), 1), (w(!0), f(s, null, D(i.value, (e, t) => (w(), f(s, { key: e.path }, [n[1] ||= p("span", { class: "sep" }, "/", -1), p("button", {
				class: y(["seg", { last: t === i.value.length - 1 }]),
				title: e.path,
				onClick: (n) => o(e, t)
			}, M(e.name), 11, Ae)], 64))), 128))]),
			O(t.$slots, "actions", {}, void 0, !0),
			p("span", je, M(a.value), 1)
		]));
	}
}, [["__scopeId", "data-v-0a2775f2"]]), Ne = /*#__PURE__*/ e({
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
			let a = k("v-spacer"), o = k("v-btn");
			return w(), u(n, {
				"model-value": e.modelValue,
				"initial-width": 440,
				"initial-height": 280,
				"min-width": 340,
				"min-height": 200,
				"onUpdate:modelValue": i[2] ||= (e) => !e && r("answer", !1)
			}, {
				title: L(() => [...i[3] ||= [m("文件还没保存", -1)]]),
				actions: L(() => [
					h(a),
					h(o, {
						variant: "text",
						onClick: i[0] ||= (e) => r("answer", !1)
					}, {
						default: L(() => [...i[4] ||= [m("留在这里", -1)]]),
						_: 1
					}),
					h(o, {
						color: "error",
						variant: "flat",
						onClick: i[1] ||= (e) => r("answer", !0)
					}, {
						default: L(() => [...i[5] ||= [m("丢掉修改", -1)]]),
						_: 1
					})
				]),
				default: L(() => [m(" " + M(e.path || "当前文件") + " ", 1), i[6] ||= p("p", { class: "tip" }, "换过去之后这次的修改就没了，要保留就先按 Ctrl+S 保存。", -1)]),
				_: 1
			}, 8, ["model-value"]);
		};
	}
}, [["__scopeId", "data-v-d6dcbf86"]]);
// src/components/commons/FileEditor/useFileEditor.js
function Pe({ loader: e, saver: t }) {
	let n = E(""), r = T({
		base: "",
		draft: "",
		loading: !1,
		error: "",
		saving: !1,
		saveError: ""
	}), i = 0, a = l(() => r.draft !== r.base);
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
	function u() {
		i += 1, n.value = "", r.base = "", r.draft = "", r.loading = !1, r.error = "", r.saving = !1, r.saveError = "";
	}
	return {
		path: n,
		state: r,
		dirty: a,
		load: o,
		save: s,
		discard: c,
		reset: u
	};
}
// src/components/commons/FileEditor/handlers/registry.js
var Fe = {
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
function Ie(e) {
	let t = o(e);
	return t === "markdown" ? Fe.markdown : t ? Fe.code : Fe.plain;
}
function Le(e) {
	return Ie(e).modes;
}
function Re(e, t) {
	return t.some((t) => t.id === e) ? e : "source";
}
function ze(e, t) {
	return t > 0 ? "source" : e;
}
function Be(e) {
	return {
		mode: "source",
		message: `视图加载失败${e && e.message ? `：${e.message}` : ""}`
	};
}
// src/components/commons/FileEditor/FileEditor.vue
var Ve = { class: "file-editor" }, He = {
	key: 1,
	class: "actions"
}, Ue = {
	key: 1,
	class: "hint"
}, We = {
	key: 3,
	class: "edit-wrap"
}, Ge = {
	key: 0,
	class: "hint bad edit-error"
}, Ke = {
	key: 1,
	class: "hint bad edit-error"
}, qe = {
	key: 3,
	class: "hint"
}, Je = /*#__PURE__*/ e({
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
	emits: [
		"navigate",
		"saved",
		"dirty"
	],
	setup(e, { expose: t, emit: n }) {
		let r = e, a = n, { path: o, state: c, dirty: p, load: g, save: _, discard: y, reset: b } = Pe({
			loader: r.loader,
			saver: r.saver
		}), x = E(null);
		F(p, (e) => a("dirty", e));
		let C = E("source"), T = l(() => Le(o.value)), O = l(() => T.value.find((e) => e.id === C.value) || null), P = j(null), I = E(!1), R = E(""), z = 0;
		function B() {
			if (!z) return;
			let e = x.value;
			if (!e || typeof e.locate != "function") return;
			let t = z;
			z = 0, e.locate(t);
		}
		F(T, (e) => {
			C.value = Re(C.value, e);
		}, { immediate: !0 }), F(O, async (e) => {
			if (P.value = null, I.value = !!e, e) {
				R.value = "";
				try {
					let t = await e.load();
					if (O.value !== e) return;
					P.value = t.default, await v(), B();
				} catch (t) {
					if (O.value === e) {
						let e = Be(t);
						R.value = e.message, C.value = e.mode;
					}
				} finally {
					O.value === e && (I.value = !1);
				}
			}
		}, { immediate: !0 });
		async function V() {
			let e = o.value, t = await _();
			return t && a("saved", {
				path: e,
				data: t
			}), t;
		}
		function ee() {
			y();
		}
		let te = E(!1), H = null;
		async function ne(e, t = 0) {
			return R.value = "", C.value = ze(C.value, t), z = t, await g(e) ? (await v(), t || x.value?.resetScroll(), B(), !0) : (z = 0, !1);
		}
		async function re() {
			return !o.value || !await g(o.value) ? !1 : (await v(), x.value?.resetScroll(), !0);
		}
		function ie() {
			ae(), b();
		}
		function U() {
			return p.value ? te.value ? Promise.resolve(!1) : (te.value = !0, new Promise((e) => {
				H = e;
			})) : Promise.resolve(!0);
		}
		function W(e) {
			if (te.value = !1, !H) return;
			let t = H;
			H = null, t(e);
		}
		function ae() {
			W(!1);
		}
		return S(() => W(!1)), t({
			open: ne,
			reload: re,
			close: ie,
			save: V,
			discard: ee,
			confirmLeave: U,
			cancelLeave: ae,
			path: o,
			dirty: p
		}), (t, n) => {
			let r = k("v-btn"), l = k("v-btn-toggle"), g = k("v-chip");
			return w(), f("section", Ve, [
				N(o) ? (w(), u(Me, {
					key: 0,
					"root-name": e.rootName,
					path: N(o),
					size: e.size,
					onNavigate: n[1] ||= (e) => a("navigate", e)
				}, {
					actions: L(() => [T.value.length > 1 ? (w(), u(l, {
						key: 0,
						modelValue: C.value,
						"onUpdate:modelValue": n[0] ||= (e) => C.value = e,
						density: "compact",
						variant: "text",
						divided: "",
						mandatory: "",
						class: "views"
					}, {
						default: L(() => [(w(!0), f(s, null, D(T.value, (e) => (w(), u(r, {
							key: e.id,
							value: e.id,
							size: "small"
						}, {
							default: L(() => [m(M(e.title), 1)]),
							_: 2
						}, 1032, ["value"]))), 128))]),
						_: 1
					}, 8, ["modelValue"])) : d("", !0), N(p) && !N(c).loading ? (w(), f("div", He, [
						h(g, {
							size: "x-small",
							variant: "flat",
							color: "modified"
						}, {
							default: L(() => [...n[3] ||= [m("未保存", -1)]]),
							_: 1
						}),
						h(r, {
							size: "small",
							variant: "text",
							color: "primary",
							loading: N(c).saving,
							onClick: V
						}, {
							default: L(() => [...n[4] ||= [m(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"]),
						h(r, {
							size: "small",
							variant: "text",
							disabled: N(c).saving,
							onClick: ee
						}, {
							default: L(() => [...n[5] ||= [m(" 放弃 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					])) : d("", !0)]),
					_: 1
				}, 8, [
					"root-name",
					"path",
					"size"
				])) : d("", !0),
				N(c).loading ? (w(), f("p", Ue, "正在读取文件…")) : N(c).error ? (w(), u(i, {
					key: 2,
					icon: "mdi-file-question-outline",
					"icon-size": 28,
					title: N(c).error,
					hint: "换一个文件试试，或者从左侧目录里下载它。"
				}, null, 8, ["title"])) : N(o) ? (w(), f("div", We, [
					R.value ? (w(), f("p", Ge, M(R.value), 1)) : d("", !0),
					N(c).saveError ? (w(), f("p", Ke, M(N(c).saveError), 1)) : d("", !0),
					P.value ? (w(), u(A(P.value), {
						key: 2,
						ref_key: "paneRef",
						ref: x,
						modelValue: N(c).draft,
						"onUpdate:modelValue": n[2] ||= (e) => N(c).draft = e,
						path: N(o)
					}, null, 8, ["modelValue", "path"])) : I.value ? (w(), f("p", qe, "正在准备视图…")) : d("", !0)
				])) : (w(), u(i, {
					key: 4,
					icon: "mdi-file-outline",
					hint: "从左边选一个文件，右边显示它的内容。"
				})),
				h(Ne, {
					"model-value": te.value,
					path: N(o),
					onAnswer: W
				}, null, 8, ["model-value", "path"])
			]);
		};
	}
}, [["__scopeId", "data-v-3f640fb1"]]), Ye = "";
function Xe(e, t) {
	let n = String(e.parent || "").trim();
	return n && t.has(n) ? n : Ye;
}
function Ze(e, t, n) {
	let r = new Map(t.map((e) => [e.id, e])), i = /* @__PURE__ */ new Set();
	for (let t of e) t && t.kind === "group" && t.id && i.add(t.id);
	let a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), c = [], l = /* @__PURE__ */ new Map(), u = (e, t) => {
		a.has(e) || a.set(e, []), a.get(e).push(t);
	};
	for (let t of e) if (t && t.id) {
		if (t.kind === "ws") {
			if (!r.has(t.id) || o.has(t.id)) continue;
			o.add(t.id), u(Xe(t, i), t);
		} else if (t.kind === "group" && t.name) {
			if (s.has(t.id)) continue;
			s.add(t.id), c.push(t), l.set(t.id, t), u(Xe(t, i), t);
		}
	}
	let d = (e) => {
		let t = e, n = /* @__PURE__ */ new Set();
		for (; t;) {
			if (n.has(t.id)) return !1;
			n.add(t.id);
			let e = Xe(t, i);
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
	m(Ye, 0);
	for (let e of c) p.has(e.id) || d(e) || (p.add(e.id), f.push({
		key: `group:${e.id}`,
		kind: "group",
		id: e.id,
		depth: 0,
		parent: Ye,
		name: e.name,
		group: e
	}), n.has(e.id) || m(e.id, 1));
	for (let e of t) o.has(e.id) || f.push({
		key: `ws:${e.id}`,
		kind: "ws",
		id: e.id,
		depth: 0,
		parent: Ye,
		ws: e
	});
	return f;
}
function Qe(e) {
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
	a(Ye, 0);
	for (let e of t.values()) for (let t of e) i.has(t.id) || (i.add(t.id), r.push({
		id: t.id,
		name: t.name,
		depth: 0
	}));
	return r;
}
function $e(e, t, n) {
	let r = String(n || ""), i = /* @__PURE__ */ new Set();
	for (; r && !i.has(r);) {
		if (r === t) return !0;
		i.add(r);
		let n = e.find((e) => e && e.kind === "group" && e.id === r);
		r = n ? String(n.parent || "") : "";
	}
	return !1;
}
function et(e, t, n) {
	let r = new Set(t);
	return r.size ? e.map((e) => e.kind === "ws" && r.has(e.id) ? {
		...e,
		parent: n
	} : e) : e;
}
function tt(e, t) {
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
var nt = { class: "head" }, rt = { class: "head-title" }, it = {
	key: 0,
	class: "none"
}, at = { class: "gtext" }, ot = { class: "nm" }, st = ["onClick"], ct = { class: "tip" }, lt = { class: "tip" }, ut = { class: "tip" }, dt = /*#__PURE__*/ e({
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
		}, a = l(() => ({
			...i,
			...r.texts
		})), o = t, c = r.storageKey ? te(r.storageKey, [], { writeDefaults: !1 }) : E([]), g = l(() => new Set(Array.isArray(c.value) ? c.value : [])), _ = E(null), v = E(null), b = l(() => r.groups.filter((e) => e && e.kind === "group").length), A = l(() => Ze(r.groups, r.workspaces, g.value)), j = l(() => Qe(r.groups));
		function P() {
			return tt(r.groups, r.workspaces);
		}
		function I(e, t) {
			return $e(r.groups, e, t);
		}
		function R(e) {
			o("groups-change", e);
		}
		function V(e, t, n, r) {
			let i = e.find((e) => e.kind === t && e.id === n);
			i ? i.parent = r : e.push({
				kind: t,
				id: n,
				parent: r
			});
		}
		function ee() {
			return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
		}
		function H(e) {
			c.value = [...e];
		}
		function ne(e) {
			if (e.kind !== "group") {
				o("select", e.id);
				return;
			}
			let t = new Set(g.value);
			t.has(e.id) ? t.delete(e.id) : t.add(e.id), H(t);
		}
		function re(e) {
			if (!g.value.has(e)) return;
			let t = new Set(g.value);
			t.delete(e), H(t);
		}
		function ie(e) {
			let t = _.value, n = v.value, r = (t) => !!n && n.mode === t && n.kind === e.kind && n.id === e.id;
			return {
				"drag-src": !!t && t.kind === e.kind && t.id === e.id,
				"drop-before": r("before"),
				"drop-after": r("after"),
				"drop-into": r("into")
			};
		}
		function U(e, t) {
			_.value = {
				kind: t.kind,
				id: t.id
			}, v.value = null, e.dataTransfer && (e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("text/plain", t.id));
		}
		function W(e, t) {
			if (!_.value) return;
			let n = _.value;
			if (n.kind === t.kind && n.id === t.id) {
				v.value = null;
				return;
			}
			let r = e.currentTarget.getBoundingClientRect(), i = e.clientY - r.top, a = i > r.height / 2 ? "after" : "before";
			t.kind === "group" && (a = i < r.height * .25 ? "before" : i > r.height * .75 ? "after" : "into"), n.kind === "group" && I(n.id, a === "into" ? t.id : t.parent) ? v.value = null : v.value = {
				kind: t.kind,
				id: t.id,
				mode: a
			};
		}
		function ae() {
			let e = _.value, t = v.value;
			if (!e || !t) return G();
			let n = P(), r = n.findIndex((t) => t.kind === e.kind && t.id === e.id);
			if (r < 0) return G();
			let i = n.splice(r, 1)[0];
			if (t.mode === "into") i.parent = t.id, n.push(i), re(t.id);
			else {
				let e = n.findIndex((e) => e.kind === t.kind && e.id === t.id);
				e < 0 ? (i.parent = "", n.push(i)) : (i.parent = n[e].parent || "", n.splice(t.mode === "before" ? e : e + 1, 0, i));
			}
			R(n), G();
		}
		function G() {
			_.value = null, v.value = null;
		}
		let K = E(!1), q = E(""), oe = E(!1), se = E(0), J = E(null), Y = T({
			open: !1,
			x: 0,
			y: 0,
			mode: "blank",
			target: null
		}), X = E(!1), Z = E(null), le = E(""), ue = E(!1), Q = E(!1), de = E(null), fe = E(""), pe = E(!1), me = E(null);
		function he(e) {
			Y.x = Math.max(8, Math.min(e.clientX, window.innerWidth - 210)), Y.y = Math.max(8, Math.min(e.clientY, window.innerHeight - 160));
		}
		function ge(e, t) {
			he(e), Y.mode = t.kind === "group" ? "group" : "ws", Y.target = t.kind === "group" ? t.group : t.ws, Y.open = !0;
		}
		function _e(e) {
			e.target.closest && e.target.closest(".head") || (he(e), Y.mode = "blank", Y.target = null, Y.open = !0);
		}
		function $() {
			Y.open = !1;
		}
		function ve(e) {
			de.value = { id: e.id }, fe.value = e.name || "", Q.value = !0, $();
		}
		function be() {
			let e = (fe.value || "").trim().slice(0, 80);
			e && de.value && (R(P().map((t) => t.kind === "group" && t.id === de.value.id ? {
				...t,
				name: e
			} : t)), Q.value = !1);
		}
		function xe() {
			let e = P(), t = {
				kind: "group",
				id: ee(),
				name: "新分组",
				parent: ""
			};
			e.push(t), R(e), $(), ve(t);
		}
		function Se() {
			let e = Y.target;
			if (!e) return;
			let t = P(), n = {
				kind: "group",
				id: ee(),
				name: "新分组",
				parent: e.id
			};
			t.push(n), R(t), re(e.id), $(), ve(n);
		}
		function Ce() {
			let e = Y.target;
			if (!e) return;
			let t = P(), n = {
				kind: "group",
				id: ee(),
				name: "新分组",
				parent: ""
			};
			t.push(n), V(t, "ws", e.id, n.id), R(t), $(), ve(n);
		}
		function we(e) {
			if (!Y.target) return;
			let t = P();
			V(t, "ws", Y.target.id, e), R(t), e && re(e), $();
		}
		function Te() {
			me.value = Y.target, pe.value = !0, $();
		}
		function Ee() {
			let e = me.value ? me.value.id : "";
			if (e) {
				let t = P(), n = t.findIndex((t) => t.kind === "group" && t.id === e);
				if (n >= 0) {
					let r = t[n].parent || "";
					t.splice(n, 1);
					for (let n of t) (n.parent || "") === e && (n.parent = r);
					R(t);
				}
			}
			pe.value = !1;
		}
		function De(e) {
			Z.value = e, le.value = e.alias || "", X.value = !0, $();
		}
		async function Oe() {
			if (Z.value) {
				ue.value = !0;
				try {
					await r.saveAlias(Z.value.id, (le.value || "").trim()), X.value = !1, o("changed"), o("notice", {
						text: a.value.aliasSaved,
						color: "primary"
					});
				} catch (e) {
					o("notice", {
						text: `${a.value.aliasFailed}${e.message}`,
						color: "error"
					});
				} finally {
					ue.value = !1;
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
		C(() => {
			document.addEventListener("click", $), document.addEventListener("contextmenu", $), window.addEventListener("resize", $), window.addEventListener("blur", $);
		}), S(() => {
			document.removeEventListener("click", $), document.removeEventListener("contextmenu", $), window.removeEventListener("resize", $), window.removeEventListener("blur", $);
		});
		function Ae(e) {
			let t = String(e || "").split("/").filter(Boolean);
			return t.length ? t[t.length - 1] : e;
		}
		let je = E(""), Me = new Set(r.workspaces.map((e) => e.id));
		function Ne(e) {
			Y.open = !1, Pe(), je.value = e ? e.id : "";
		}
		F(() => r.workspaces.map((e) => e.id).join(","), () => {
			let e = r.workspaces.filter((e) => !Me.has(e.id)).map((e) => e.id);
			if (Me = new Set(r.workspaces.map((e) => e.id)), !je.value || !e.length) return;
			let t = je.value;
			je.value = "", o("groups-change", et(tt(r.groups, r.workspaces), e, t));
		});
		function Pe() {
			je.value = "", q.value = "", oe.value = !1, se.value += 1, K.value = !0;
		}
		function Fe() {
			let e = q.value.trim();
			e && (K.value = !1, o("add", e));
		}
		function Ie(e) {
			J.value = e;
		}
		function Le() {
			let e = J.value;
			J.value = null, e && o("remove", e.id);
		}
		return (t, r) => {
			let i = k("v-btn"), o = k("v-icon"), c = k("v-list-item-title"), l = k("v-list-item-subtitle"), _ = k("v-list-item"), v = k("v-list"), S = k("v-text-field"), C = k("v-spacer");
			return w(), f("div", {
				class: "list",
				onContextmenu: B(_e, ["prevent", "stop"])
			}, [
				p("div", nt, [p("span", rt, M(a.value.headTitle), 1), h(i, {
					size: "small",
					variant: "text",
					color: "primary",
					"prepend-icon": "mdi-plus",
					loading: e.busy,
					onClick: Pe
				}, {
					default: L(() => [m(M(a.value.add), 1)]),
					_: 1
				}, 8, ["loading"])]),
				!e.workspaces.length && !b.value ? (w(), f("div", it, M(a.value.empty), 1)) : d("", !0),
				h(v, {
					density: "compact",
					nav: "",
					class: "items",
					onDrop: B(ae, ["prevent"])
				}, {
					default: L(() => [(w(!0), f(s, null, D(A.value, (n) => (w(), u(_, {
						key: n.key,
						active: n.kind === "ws" && n.id === e.current,
						"active-color": "primary",
						draggable: "true",
						style: x({ paddingLeft: `${12 + n.depth * 12}px` }),
						class: y(ie(n)),
						onClick: (e) => ne(n),
						onContextmenu: B((e) => ge(e, n), ["prevent", "stop"]),
						onDragstart: (e) => U(e, n),
						onDragover: B((e) => W(e, n), ["prevent"]),
						onDragend: G
					}, {
						append: L(() => [n.kind === "ws" ? (w(), u(i, {
							key: 0,
							icon: !0,
							size: "x-small",
							variant: "text",
							title: a.value.forgetTitle,
							class: "forget",
							onClick: B((e) => Ie(n.ws), ["stop"])
						}, {
							default: L(() => [h(o, { size: "18" }, {
								default: L(() => [...r[24] ||= [m("mdi-close", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["title", "onClick"])) : d("", !0)]),
						default: L(() => [n.kind === "group" ? (w(), u(c, {
							key: 0,
							class: "gname"
						}, {
							default: L(() => [
								h(o, { size: "16" }, {
									default: L(() => [m(M(g.value.has(n.id) ? "mdi-chevron-right" : "mdi-chevron-down"), 1)]),
									_: 2
								}, 1024),
								h(o, { size: "16" }, {
									default: L(() => [...r[23] ||= [m("mdi-folder-outline", -1)]]),
									_: 1
								}),
								p("span", at, M(n.name), 1)
							]),
							_: 2
						}, 1024)) : (w(), f(s, { key: 1 }, [h(c, {
							class: "name",
							title: n.ws.alias ? n.ws.root : ""
						}, {
							default: L(() => [p("span", ot, M(n.ws.alias || Ae(n.ws.root)), 1), O(t.$slots, "title-extra", { ws: n.ws }, void 0, !0)]),
							_: 2
						}, 1032, ["title"]), h(l, {
							class: "path",
							title: n.ws.url || n.ws.root
						}, {
							default: L(() => [m(M(n.ws.url || n.ws.root), 1)]),
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
				Y.open ? (w(), f("div", {
					key: 1,
					class: "ctxmenu",
					style: x({
						left: Y.x + "px",
						top: Y.y + "px"
					}),
					onClick: r[7] ||= B(() => {}, ["stop"]),
					onContextmenu: r[8] ||= B(() => {}, ["prevent", "stop"])
				}, [Y.mode === "ws" ? (w(), f(s, { key: 0 }, [
					p("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[0] ||= (e) => De(Y.target)
					}, [h(o, { size: "16" }, {
						default: L(() => [...r[25] ||= [m("mdi-rename-box", -1)]]),
						_: 1
					}), m(M(a.value.menuAlias), 1)]),
					p("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[1] ||= (e) => ke(Y.target, "rel")
					}, [h(o, { size: "16" }, {
						default: L(() => [...r[26] ||= [m("mdi-content-copy", -1)]]),
						_: 1
					}), m(M(a.value.copyRel), 1)]),
					p("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[2] ||= (e) => ke(Y.target, "abs")
					}, [h(o, { size: "16" }, {
						default: L(() => [...r[27] ||= [m("mdi-content-copy", -1)]]),
						_: 1
					}), m(M(a.value.copyAbs), 1)]),
					p("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[3] ||= (e) => Y.mode = "pick"
					}, [
						h(o, { size: "16" }, {
							default: L(() => [...r[28] ||= [m("mdi-folder-move-outline", -1)]]),
							_: 1
						}),
						r[29] ||= m("移到分组 ", -1),
						r[30] ||= p("span", { class: "more" }, "›", -1)
					])
				], 64)) : Y.mode === "pick" ? (w(), f(s, { key: 1 }, [
					p("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[4] ||= (e) => we("")
					}, [h(o, { size: "16" }, {
						default: L(() => [...r[31] ||= [m("mdi-format-list-bulleted", -1)]]),
						_: 1
					}), r[32] ||= m("移出分组 ", -1)]),
					(w(!0), f(s, null, D(j.value, (e) => (w(), f("button", {
						key: e.id,
						type: "button",
						class: "ctxitem",
						style: x({ paddingLeft: `${10 + e.depth * 12}px` }),
						onClick: (t) => we(e.id)
					}, [h(o, { size: "16" }, {
						default: L(() => [...r[33] ||= [m("mdi-folder-outline", -1)]]),
						_: 1
					}), m(M(e.name), 1)], 12, st))), 128)),
					p("button", {
						type: "button",
						class: "ctxitem",
						onClick: Ce
					}, [h(o, { size: "16" }, {
						default: L(() => [...r[34] ||= [m("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), r[35] ||= m("新建分组并移入 ", -1)])
				], 64)) : Y.mode === "group" ? (w(), f(s, { key: 2 }, [
					p("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[5] ||= (e) => Ne(Y.target)
					}, [h(o, { size: "16" }, {
						default: L(() => [...r[36] ||= [m("mdi-plus", -1)]]),
						_: 1
					}), m(M(a.value.menuAddInGroup), 1)]),
					p("button", {
						type: "button",
						class: "ctxitem",
						onClick: Se
					}, [h(o, { size: "16" }, {
						default: L(() => [...r[37] ||= [m("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), r[38] ||= m("新建子分组 ", -1)]),
					p("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[6] ||= (e) => ve(Y.target)
					}, [h(o, { size: "16" }, {
						default: L(() => [...r[39] ||= [m("mdi-rename-box", -1)]]),
						_: 1
					}), r[40] ||= m("重命名 ", -1)]),
					p("button", {
						type: "button",
						class: "ctxitem",
						onClick: Te
					}, [h(o, { size: "16" }, {
						default: L(() => [...r[41] ||= [m("mdi-trash-can-outline", -1)]]),
						_: 1
					}), r[42] ||= m("删除分组 ", -1)])
				], 64)) : (w(), f("button", {
					key: 3,
					type: "button",
					class: "ctxitem",
					onClick: xe
				}, [h(o, { size: "16" }, {
					default: L(() => [...r[43] ||= [m("mdi-folder-plus-outline", -1)]]),
					_: 1
				}), r[44] ||= m("新建分组 ", -1)]))], 36)) : d("", !0),
				h(n, {
					modelValue: X.value,
					"onUpdate:modelValue": r[11] ||= (e) => X.value = e,
					"initial-width": 460,
					"initial-height": 320,
					"min-width": 360,
					"min-height": 240
				}, {
					title: L(() => [m(M(a.value.aliasTitle), 1)]),
					actions: L(() => [
						h(C),
						h(i, {
							variant: "text",
							onClick: r[10] ||= (e) => X.value = !1
						}, {
							default: L(() => [...r[45] ||= [m("取消", -1)]]),
							_: 1
						}),
						h(i, {
							color: "primary",
							variant: "flat",
							loading: ue.value,
							onClick: Oe
						}, {
							default: L(() => [...r[46] ||= [m(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"])
					]),
					default: L(() => [
						p("p", ct, M(Z.value ? Z.value.root : ""), 1),
						h(S, {
							modelValue: le.value,
							"onUpdate:modelValue": r[9] ||= (e) => le.value = e,
							label: "别名",
							density: "compact",
							variant: "outlined",
							maxlength: "80",
							clearable: "",
							autofocus: "",
							onKeyup: z(Oe, ["enter"])
						}, null, 8, ["modelValue"]),
						p("p", lt, M(a.value.aliasHint), 1)
					]),
					_: 1
				}, 8, ["modelValue"]),
				h(n, {
					modelValue: Q.value,
					"onUpdate:modelValue": r[14] ||= (e) => Q.value = e,
					"initial-width": 440,
					"initial-height": 260,
					"min-width": 340,
					"min-height": 200
				}, {
					title: L(() => [...r[47] ||= [m("分组名称", -1)]]),
					actions: L(() => [
						h(C),
						h(i, {
							variant: "text",
							onClick: r[13] ||= (e) => Q.value = !1
						}, {
							default: L(() => [...r[48] ||= [m("取消", -1)]]),
							_: 1
						}),
						h(i, {
							color: "primary",
							variant: "flat",
							disabled: !fe.value.trim(),
							onClick: be
						}, {
							default: L(() => [...r[49] ||= [m(" 保存 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					]),
					default: L(() => [h(S, {
						modelValue: fe.value,
						"onUpdate:modelValue": r[12] ||= (e) => fe.value = e,
						label: "名称",
						density: "compact",
						variant: "outlined",
						maxlength: "80",
						autofocus: "",
						onKeyup: z(be, ["enter"])
					}, null, 8, ["modelValue"])]),
					_: 1
				}, 8, ["modelValue"]),
				h(n, {
					modelValue: pe.value,
					"onUpdate:modelValue": r[16] ||= (e) => pe.value = e,
					"initial-width": 440,
					"initial-height": 240,
					"min-width": 340,
					"min-height": 200
				}, {
					title: L(() => [...r[50] ||= [m("删除分组", -1)]]),
					actions: L(() => [
						h(C),
						h(i, {
							variant: "text",
							onClick: r[15] ||= (e) => pe.value = !1
						}, {
							default: L(() => [...r[51] ||= [m("取消", -1)]]),
							_: 1
						}),
						h(i, {
							color: "error",
							variant: "flat",
							onClick: Ee
						}, {
							default: L(() => [...r[52] ||= [m("删除", -1)]]),
							_: 1
						})
					]),
					default: L(() => [m(" " + M(me.value ? me.value.name : "") + " ", 1), r[53] ||= p("p", { class: "tip" }, "里面的子分组与工作区移到上一级，工作区本身不动。", -1)]),
					_: 1
				}, 8, ["modelValue"]),
				h(n, {
					modelValue: K.value,
					"onUpdate:modelValue": r[20] ||= (e) => K.value = e,
					"initial-width": 620,
					"initial-height": 460,
					"min-width": 420,
					"min-height": 300
				}, {
					title: L(() => [m(M(a.value.addTitle), 1)]),
					actions: L(() => [
						h(C),
						h(i, {
							variant: "text",
							onClick: r[19] ||= (e) => K.value = !1
						}, {
							default: L(() => [...r[54] ||= [m("取消", -1)]]),
							_: 1
						}),
						h(i, {
							color: "primary",
							variant: "flat",
							disabled: !q.value.trim() || !oe.value,
							onClick: Fe
						}, {
							default: L(() => [m(M(a.value.addConfirm), 1)]),
							_: 1
						}, 8, ["disabled"])
					]),
					default: L(() => [(w(), u(N(ce), {
						key: se.value,
						modelValue: q.value,
						"onUpdate:modelValue": r[17] ||= (e) => q.value = e,
						tip: a.value.addTip,
						label: a.value.addLabel,
						placeholder: a.value.addPlaceholder,
						loader: e.dirs,
						"onUpdate:valid": r[18] ||= (e) => oe.value = e
					}, null, 8, [
						"modelValue",
						"tip",
						"label",
						"placeholder",
						"loader"
					]))]),
					_: 1
				}, 8, ["modelValue"]),
				h(n, {
					modelValue: J.value,
					"onUpdate:modelValue": r[22] ||= (e) => J.value = e,
					"initial-width": 440,
					"initial-height": 260,
					"min-width": 340,
					"min-height": 200
				}, {
					title: L(() => [m(M(a.value.removeTitle), 1)]),
					actions: L(() => [
						h(C),
						h(i, {
							variant: "text",
							onClick: r[21] ||= (e) => J.value = null
						}, {
							default: L(() => [...r[55] ||= [m("取消", -1)]]),
							_: 1
						}),
						h(i, {
							color: "error",
							variant: "flat",
							onClick: Le
						}, {
							default: L(() => [m(M(a.value.removeConfirm), 1)]),
							_: 1
						})
					]),
					default: L(() => [m(" " + M(J.value ? J.value.root : "") + " ", 1), p("p", ut, M(a.value.removeText), 1)]),
					_: 1
				}, 8, ["modelValue"])
			], 32);
		};
	}
}, [["__scopeId", "data-v-34d9e320"]]), ft = "web-shared-resizing";
function pt({ area: e, initial: t, min: n = 0, max: r = 100, rightMin: i = 0, axis: a = "x", unit: o = "px", persist: s = "" }) {
	let c = E(f()), l = E(!1), u = 0, d = 0;
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
		l.value && (l.value = !1, window.removeEventListener("pointermove", m), document.body.classList.remove(ft));
	}
	function g(t) {
		t.button === 0 && e.value && (l.value = !0, u = a === "x" ? t.clientX : t.clientY, d = c.value, t.preventDefault(), document.body.classList.add(ft), window.addEventListener("pointermove", m), window.addEventListener("pointerup", h, { once: !0 }));
	}
	function _() {
		c.value = t;
	}
	return F(c, (e) => {
		if (s) try {
			window.localStorage.setItem(s, String(e));
		} catch {}
	}), S(h), {
		size: c,
		resizing: l,
		start: g,
		stop: h,
		reset: _
	};
}
// src/components/services/WorkspaceShell.vue
var mt = { class: "brand" }, ht = { class: "side" }, gt = { class: "content" }, _t = /*#__PURE__*/ e({
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
	emits: ["empty-action"],
	setup(e) {
		let n = e, r = E(null), o = E(!0), { size: s, resizing: c, start: l, reset: f } = pt({
			area: r,
			initial: 268,
			min: 200,
			rightMin: 420,
			persist: `${n.title}.shell.side-width`
		});
		return (n, g) => {
			let v = k("v-app-bar-nav-icon"), b = k("v-app-bar-title"), S = k("v-spacer"), C = k("v-chip"), T = k("v-btn"), E = k("v-app-bar"), D = k("v-main"), A = k("v-app");
			return w(), u(A, null, {
				default: L(() => [
					h(E, {
						density: "comfortable",
						flat: "",
						border: "b",
						class: "app-bar"
					}, {
						default: L(() => [
							h(v, {
								title: o.value ? "收起左侧列表" : "展开左侧列表",
								onClick: g[0] ||= (e) => o.value = !o.value
							}, null, 8, ["title"]),
							h(b, null, {
								default: L(() => [p("span", mt, M(e.title), 1)]),
								_: 1
							}),
							h(S),
							e.workspaces.length ? (w(), u(C, {
								key: 0,
								size: "small",
								variant: "tonal",
								class: "running",
								color: e.running ? "ready" : void 0,
								"prepend-icon": "mdi-play-circle-outline",
								title: e.running ? `所有工作区共 ${e.running} 个进程在跑` : "所有工作区都没有在跑的进程"
							}, {
								default: L(() => [m(M(e.running) + " 个在跑 ", 1)]),
								_: 1
							}, 8, ["color", "title"])) : d("", !0),
							O(n.$slots, "metrics", {}, void 0, !0),
							h(T, {
								icon: e.dark ? "mdi-weather-sunny" : "mdi-weather-night",
								title: "切换深浅色",
								variant: "text",
								onClick: e.toggleTheme
							}, null, 8, ["icon", "onClick"])
						]),
						_: 3
					}),
					h(t, {
						modelValue: e.snack.on,
						"onUpdate:modelValue": g[1] ||= (t) => e.snack.on = t,
						text: e.snack.text,
						color: e.snack.color
					}, null, 8, [
						"modelValue",
						"text",
						"color"
					]),
					h(D, { class: "fill-height" }, {
						default: L(() => [p("div", {
							ref_key: "shellRef",
							ref: r,
							class: "shell"
						}, [
							p("div", {
								class: "side-slot",
								style: x({ width: o.value ? `${N(s)}px` : "0px" })
							}, null, 4),
							p("div", {
								class: y(["side-layer", { folded: !o.value }]),
								style: x({ width: `${N(s)}px` })
							}, [p("aside", ht, [O(n.$slots, "sidebar", {}, void 0, !0)])], 6),
							R(h(a, {
								axis: "x",
								active: N(c),
								onStart: N(l),
								onReset: N(f)
							}, null, 8, [
								"active",
								"onStart",
								"onReset"
							]), [[P, o.value]]),
							p("main", gt, [O(n.$slots, "default", { ws: e.current }, void 0, !0), e.current ? d("", !0) : (w(), u(i, _({ key: 0 }, e.empty, { onAction: g[2] ||= (e) => n.$emit("empty-action") }), null, 16))])
						], 512)]),
						_: 3
					})
				]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-cb664302"]]), vt = { style: { width: "42%" } }, yt = { class: "svc-name" }, bt = ["title"], xt = ["title"], St = { class: "status-line" }, Ct = {
	key: 0,
	class: "meta"
}, wt = {
	key: 1,
	class: "meta"
}, Tt = ["title"], Et = {
	key: 1,
	class: "meta"
}, Dt = {
	key: 2,
	class: "meta"
}, Ot = { class: "ops" }, kt = /*#__PURE__*/ e({
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
			let r = k("v-chip"), i = k("v-btn"), a = k("v-icon"), o = k("v-table");
			return w(), u(o, {
				density: "compact",
				class: "table"
			}, {
				default: L(() => [p("thead", null, [p("tr", null, [
					p("th", vt, M(e.nameTitle), 1),
					n[0] ||= p("th", null, "参数", -1),
					n[1] ||= p("th", { style: { width: "200px" } }, "状态", -1),
					n[2] ||= p("th", { style: { width: "230px" } }, null, -1)
				])]), p("tbody", null, [(w(!0), f(s, null, D(e.rows, (o) => (w(), f("tr", { key: o.key }, [
					p("td", null, [p("div", yt, [p("span", null, M(o.title), 1), o.typeText ? (w(), u(r, {
						key: 0,
						size: "x-small",
						variant: "tonal",
						class: "type-chip"
					}, {
						default: L(() => [m(M(o.typeText), 1)]),
						_: 2
					}, 1024)) : d("", !0)]), e.showPath && o.path ? (w(), f("div", {
						key: 0,
						class: "svc-path",
						title: o.path
					}, M(o.path), 9, bt)) : d("", !0)]),
					p("td", null, [p("div", {
						class: "cmd",
						title: o.cmd
					}, M(o.cmd), 9, xt)]),
					p("td", null, [p("div", St, [o.live ? (w(), f(s, { key: 0 }, [h(r, {
						size: "small",
						class: "status-chip",
						color: o.color,
						variant: "tonal",
						"prepend-icon": o.icon
					}, {
						default: L(() => [m(M(o.statusText), 1)]),
						_: 2
					}, 1032, ["color", "prepend-icon"]), o.port ? (w(), f("span", Ct, "端口 " + M(o.port), 1)) : o.started ? (w(), f("span", wt, M(o.ago), 1)) : d("", !0)], 64)) : o.run ? (w(), f(s, { key: 1 }, [h(r, {
						size: "small",
						class: "status-chip",
						color: o.color,
						variant: "tonal",
						"prepend-icon": o.icon,
						onClick: (e) => t.$emit("log", o)
					}, {
						default: L(() => [m(M(o.statusText), 1)]),
						_: 2
					}, 1032, [
						"color",
						"prepend-icon",
						"onClick"
					]), o.err ? (w(), f("span", {
						key: 0,
						class: "meta err",
						title: o.err
					}, M(o.err), 9, Tt)) : o.started ? (w(), f("span", Et, M(o.ago), 1)) : d("", !0)], 64)) : (w(), f("span", Dt, "—"))])]),
					p("td", Ot, [o.live ? (w(), f(s, { key: 0 }, [h(i, {
						size: "small",
						variant: "text",
						"prepend-icon": "mdi-text-box-outline",
						onClick: (e) => t.$emit("log", o)
					}, {
						default: L(() => [...n[3] ||= [m(" 日志 ", -1)]]),
						_: 1
					}, 8, ["onClick"]), h(i, {
						size: "small",
						color: "error",
						variant: "tonal",
						loading: o.stopping,
						onClick: (e) => t.$emit("stop", o)
					}, {
						default: L(() => [...n[4] ||= [m(" 停止 ", -1)]]),
						_: 1
					}, 8, ["loading", "onClick"])], 64)) : (w(), f(s, { key: 1 }, [
						h(i, {
							size: "small",
							color: "primary",
							variant: "flat",
							disabled: o.blocked,
							loading: o.starting,
							onClick: (e) => t.$emit("start", o)
						}, {
							default: L(() => [m(M(o.action), 1)]),
							_: 2
						}, 1032, [
							"disabled",
							"loading",
							"onClick"
						]),
						h(i, {
							size: "small",
							variant: "text",
							icon: !0,
							title: "参数",
							onClick: (e) => t.$emit("settings", o)
						}, {
							default: L(() => [h(a, { size: "20" }, {
								default: L(() => [...n[5] ||= [m("mdi-tune", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["onClick"]),
						o.run ? (w(), u(i, {
							key: 0,
							size: "small",
							variant: "text",
							"prepend-icon": "mdi-text-box-outline",
							onClick: (e) => t.$emit("log", o)
						}, {
							default: L(() => [...n[6] ||= [m(" 日志 ", -1)]]),
							_: 1
						}, 8, ["onClick"])) : d("", !0)
					], 64)), O(t.$slots, "row-extra", { row: o }, void 0, !0)])
				]))), 128))])]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-8df04734"]]), At = { class: "log-head" }, jt = { class: "log-box" }, Mt = {
	key: 1,
	class: "log-empty"
}, Nt = /*#__PURE__*/ e({
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
			let r = k("v-spacer"), i = k("v-btn");
			return w(), f(s, null, [p("div", At, [
				n[2] ||= p("span", { class: "label" }, "日志", -1),
				h(r),
				e.more ? (w(), u(i, {
					key: 0,
					size: "small",
					variant: "text",
					"prepend-icon": "mdi-history",
					onClick: n[0] ||= (e) => t.$emit("load-more")
				}, {
					default: L(() => [...n[1] ||= [m(" 更早 ", -1)]]),
					_: 1
				})) : d("", !0)
			]), p("div", jt, [e.text ? (w(), u(H, {
				key: 0,
				text: e.text,
				dark: e.dark,
				colorize: e.colorize
			}, null, 8, [
				"text",
				"dark",
				"colorize"
			])) : (w(), f("p", Mt, M(e.emptyText), 1))])], 64);
		};
	}
}, [["__scopeId", "data-v-d45becae"]]);
// src/composables/commons/useFileTree.js
function Pt(e, t = () => ({})) {
	let n = T({});
	function r() {
		let t = typeof e == "function" ? e() : N(e);
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
	let s = l(() => o(i(r()), 0));
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
function Ft({ api: e, ws: t, statusText: n = {} }) {
	let r = E(""), i = E(!1), a = E(0), o = E(""), s = E(""), c = E(""), l = null;
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
	return F(t, (e) => {
		if (!c.value || !e) return;
		let t = (e.services || []).find((e) => e.id === c.value);
		t && t.run && (o.value = n[t.run.status] || t.run.status);
	}), S(u), {
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
// src/utils/services/serviceStatus.js
var It = ["starting", "ready"];
function Lt(e, t = It) {
	return (e.services || []).filter((e) => e.run && t.includes(e.run.status)).length;
}
// src/composables/services/useWorkspaceState.js
function Rt({ api: e, storageKey: t, extraState: n = {}, loadExtra: i = null, addedNotice: a = "已添加" }) {
	let o = T({
		workspaces: [],
		groups: [],
		...n
	}), s = te(t, "", { writeDefaults: !1 }), c = E(!1), u = E(null), { snack: d, toast: f } = r(), p = null, m = 0, h = l(() => o.workspaces.find((e) => e.id === s.value) || null), g = l(() => o.workspaces.reduce((e, t) => e + Lt(t), 0));
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
				u.value = JSON.parse(e.data);
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
	async function D(t) {
		let n = typeof t == "string" ? t : "";
		c.value = !0;
		let r = await w("添加工作区", async () => (await e.addWorkspace(n), !0));
		if (c.value = !1, !r) return;
		await b();
		let i = o.workspaces.find((e) => e.root === n || e.root === n.replace(/\/+$/, ""));
		i && _(i.id), f(a, "primary");
	}
	async function O(t) {
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
		snack: d,
		toast: f,
		metrics: u,
		running: g,
		select: _,
		setGroups: y,
		refresh: b,
		act: w,
		start: N,
		disconnect: S,
		addWorkspace: D,
		removeWorkspace: O,
		rescan: k,
		startService: A,
		stopService: j,
		saveService: M
	};
}
export { G as DirectoryNode, ce as DirectoryPicker, Je as FileEditor, De as FileTree, It as LIVE_STATUSES, H as LogView, Nt as RunLogPanel, kt as ServiceTable, dt as WorkspaceList, _t as WorkspaceShell, ye as copyText, Q as fileIcon, Lt as runningCount, Pt as useFileTree, Ft as useRunLog, pt as useSplitPane, Rt as useWorkspaceState };
