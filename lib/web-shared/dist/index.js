import { t as e } from "./_plugin-vue_export-helper.js";
import { n as t, r as n, t as r } from "./useToast.js";
import { n as i, t as a } from "./SplitHandle.js";
import { languageOf as o } from "./highlight.js";
import { t as s } from "./codeSymbol.js";
import { Fragment as c, Teleport as l, computed as u, createBlock as d, createCommentVNode as f, createElementBlock as p, createElementVNode as m, createTextVNode as h, createVNode as g, guardReactiveProps as _, mergeProps as v, nextTick as y, normalizeClass as b, normalizeProps as x, normalizeStyle as S, onBeforeUnmount as C, onMounted as w, openBlock as T, reactive as E, ref as D, renderList as O, renderSlot as k, resolveComponent as A, resolveDynamicComponent as j, shallowRef as M, toDisplayString as N, unref as P, vShow as F, watch as I, watchEffect as L, withCtx as R, withDirectives as z, withKeys as ee, withModifiers as B } from "vue";
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
		}, r = D(null), i = null, a = null, o = null, s = "";
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
		return w(() => {
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
		}), I(() => t.text, (e) => d(e || "")), I(() => t.dark, (e) => {
			i && (i.options.theme = c(e));
		}), C(() => {
			o && o.disconnect(), i && i.dispose(), o = null, i = null;
		}), (t, n) => (T(), p("div", {
			ref_key: "host",
			ref: r,
			class: b(["term", { deeper: e.dark }]),
			style: S(e.height ? {
				height: e.height,
				flex: "0 0 auto"
			} : null)
		}, null, 6));
	}
}, [["__scopeId", "data-v-be16b898"]]), ae = { class: "node" }, V = ["title"], H = {
	key: 0,
	class: "kids"
}, oe = {
	key: 0,
	class: "hint"
}, se = {
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
		let n = e, r = t, i = D(!1), a = D(!1), o = D(""), s = D(null);
		I(() => n.selected === n.node.path, (e) => {
			e && y(() => s.value && s.value.scrollIntoView({ block: "nearest" }));
		}, { immediate: !0 });
		async function l() {
			r("pick", n.node), i.value || (i.value = !0, await _());
		}
		async function u() {
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
			let r = A("v-icon"), _ = A("v-btn"), v = A("DirectoryNode", !0);
			return T(), p("div", ae, [m("div", {
				ref_key: "rowEl",
				ref: s,
				class: b(["row", { selected: e.node.path === e.selected }]),
				onClick: l
			}, [
				g(_, {
					icon: !0,
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: i.value ? "收起" : "展开",
					onClick: B(u, ["stop"])
				}, {
					default: R(() => [g(r, { size: "18" }, {
						default: R(() => [h(N(i.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"]),
				g(r, {
					size: "18",
					class: "folder"
				}, {
					default: R(() => [...n[1] ||= [h("mdi-folder-outline", -1)]]),
					_: 1
				}),
				m("span", {
					class: "label",
					title: e.node.path
				}, N(e.node.name), 9, V)
			], 2), i.value ? (T(), p("div", H, [a.value ? (T(), p("p", oe, "正在读取…")) : o.value ? (T(), p("p", se, N(o.value), 1)) : e.node.children ? (T(), p(c, { key: 2 }, [(T(!0), p(c, null, O(e.node.children, (r) => (T(), d(v, {
				key: r.path,
				node: r,
				selected: e.selected,
				loader: e.loader,
				onPick: n[0] ||= (e) => t.$emit("pick", e)
			}, null, 8, [
				"node",
				"selected",
				"loader"
			]))), 128)), e.node.children.length ? f("", !0) : (T(), p("p", U, "没有子目录"))], 64)) : f("", !0)])) : f("", !0)]);
		};
	}
}, [["__scopeId", "data-v-9e855642"]]), G = { class: "picker" }, K = {
	key: 0,
	class: "tip"
}, ce = { class: "tree" }, q = { class: "root" }, J = ["title"], le = {
	key: 0,
	class: "hint bad"
}, Y = {
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
		let n = e, r = t, i = D(""), a = D(null), o = D(!0), s = D(""), l = u({
			get: () => n.modelValue,
			set: (e) => r("update:modelValue", e)
		}), _ = u(() => {
			let e = String(n.modelValue || "").trim();
			return e === "~" ? e = i.value : e.startsWith("~/") && (e = i.value + e.slice(1)), e.replace(/\/+$/, "");
		}), v = u(() => !i.value || !_.value ? !1 : n.validate ? !!n.validate(_.value, i.value) : _.value === i.value || _.value.startsWith(i.value + "/"));
		L(() => r("update:valid", v.value));
		function y(e) {
			l.value = e.path;
		}
		return w(async () => {
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
			let r = A("v-text-field"), u = A("v-icon"), b = A("v-progress-circular");
			return T(), p("div", G, [
				e.tip ? (T(), p("p", K, N(e.tip), 1)) : f("", !0),
				g(r, {
					modelValue: l.value,
					"onUpdate:modelValue": n[0] ||= (e) => l.value = e,
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
				m("div", ce, [m("div", q, [
					g(u, { size: "18" }, {
						default: R(() => [...n[1] ||= [h("mdi-home-outline", -1)]]),
						_: 1
					}),
					m("span", {
						class: "root-label",
						title: i.value || "~"
					}, "~", 8, J),
					o.value ? (T(), d(b, {
						key: 0,
						size: "12",
						width: "2",
						indeterminate: ""
					})) : f("", !0)
				]), s.value ? (T(), p("p", le, N(s.value), 1)) : a.value ? (T(), p(c, { key: 1 }, [(T(!0), p(c, null, O(a.value, (t) => (T(), d(W, {
					key: t.path,
					node: t,
					selected: _.value,
					loader: e.loader,
					onPick: y
				}, null, 8, [
					"node",
					"selected",
					"loader"
				]))), 128)), a.value.length ? f("", !0) : (T(), p("p", Y, "家目录下没有子目录"))], 64)) : f("", !0)])
			]);
		};
	}
}, [["__scopeId", "data-v-a4b93ef9"]]), X = {
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
function pe(e) {
	let t = String(e || "").split("/").pop().toLowerCase(), n = de[t];
	if (n) return n;
	let r = t.lastIndexOf(".");
	return r < 0 ? X : fe[t.slice(r + 1)] || X;
}
// src/components/commons/FileTree/FileTreeNode.vue
var Z = { class: "branch" }, Q = ["data-path"], me = {
	key: 1,
	class: "arrow-space"
}, he = ["title"], ge = {
	key: 0,
	class: "hint"
}, _e = {
	key: 1,
	class: "hint bad"
}, $ = {
	key: 2,
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
			loading: "正在读取…",
			empty: "空目录",
			truncated: "这一层文件太多，只列了前面一部分。"
		}, a = u(() => ({
			...i,
			...n.texts
		})), o = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, s = u(() => n.keyOf(n.node)), l = u(() => n.dirOf(n.node)), _ = u(() => n.expanded[s.value] === !0), y = u(() => n.cache[s.value] || o), x = u(() => l.value ? null : pe(n.nameOf(n.node))), C = u(() => l.value ? _.value ? "mdi-folder-open-outline" : "mdi-folder-outline" : x.value.icon), w = u(() => l.value ? null : x.value.color ? { color: x.value.color } : null);
		function E() {
			n.pickOnRowClick && (l.value ? r("toggle", s.value) : r("pick", n.node));
		}
		function D(e) {
			r("context", {
				node: n.node,
				event: e
			});
		}
		return (t, n) => {
			let i = A("v-icon"), o = A("v-btn"), u = A("FileTreeNode", !0);
			return T(), p("div", Z, [m("div", {
				class: b(["row", [e.rowClass ? e.rowClass(e.node) : null, { clickable: e.pickOnRowClick }]]),
				"data-path": s.value,
				style: S({ paddingLeft: 4 + e.depth * 14 + "px" }),
				onClick: E,
				onContextmenu: B(D, ["prevent", "stop"])
			}, [
				l.value ? (T(), d(o, {
					key: 0,
					icon: "",
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: _.value ? "收起" : "展开",
					onClick: n[0] ||= B((e) => r("toggle", s.value), ["stop"])
				}, {
					default: R(() => [g(i, { size: "16" }, {
						default: R(() => [h(N(_.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"])) : (T(), p("span", me)),
				g(i, {
					size: "16",
					class: b(l.value ? "folder" : "file"),
					style: S(w.value)
				}, {
					default: R(() => [h(N(C.value), 1)]),
					_: 1
				}, 8, ["class", "style"]),
				k(t.$slots, "row-before-label", {
					node: e.node,
					open: _.value,
					state: y.value
				}, void 0, !0),
				m("span", {
					class: b(["label", e.labelClass]),
					title: s.value
				}, N(e.nameOf(e.node)), 11, he),
				k(t.$slots, "row-after-label", {
					node: e.node,
					open: _.value,
					state: y.value
				}, void 0, !0)
			], 46, Q), l.value && _.value ? (T(), p(c, { key: 0 }, [y.value.loading ? (T(), p("p", ge, N(a.value.loading), 1)) : y.value.error ? (T(), p("p", _e, N(y.value.error), 1)) : y.value.entries.length ? (T(), p(c, { key: 3 }, [(T(!0), p(c, null, O(y.value.entries, (i) => (T(), d(u, {
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
				"row-before-label": R((e) => [k(t.$slots, "row-before-label", v({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": R((e) => [k(t.$slots, "row-after-label", v({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), y.value.truncated ? (T(), p("p", ve, N(a.value.truncated), 1)) : f("", !0)], 64)) : (T(), p("p", $, N(a.value.empty), 1))], 64)) : f("", !0)]);
		};
	}
}, [["__scopeId", "data-v-7825703d"]]);
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
	class: "hint"
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
		}, o = u(() => ({
			...a,
			...r.texts
		})), s = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, b = E({}), j = E({}), M = D(!1), P = D(null), F = u(() => r.root ? r.keyOf(r.root) : ""), L = u(() => j[F.value] || s);
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
		function ee(e) {
			b[e] = !b[e], b[e] && z(e);
		}
		async function te(e) {
			b[F.value] = !0, await z(F.value);
			let t = F.value;
			for (let n of String(e || "").split("/").filter(Boolean)) t = t ? `${t}/${n}` : n, await z(t), b[t] = !0;
		}
		function ne() {
			return Object.keys(b).filter((e) => b[e]);
		}
		async function re(e) {
			let t = Array.isArray(e) ? e : [];
			await Promise.all(t.map(async (e) => {
				b[e] = !0, await z(e);
			}));
		}
		function ie() {
			for (let e of Object.keys(b)) b[e] = !1;
			b[F.value] = !0;
		}
		function ae() {
			for (let e of Object.keys(j)) delete j[e];
			for (let e of Object.keys(b)) delete b[e];
			b[F.value] = !0, z(F.value);
		}
		async function V(e) {
			await z(e, !0);
		}
		function H(e) {
			let t = P.value ? P.value.querySelectorAll("[data-path]") : [];
			for (let n of t) if (n.dataset.path === e) {
				n.scrollIntoView({ block: "nearest" });
				return;
			}
		}
		async function oe() {
			await Promise.all(Object.keys(j).map((e) => z(e, !0)));
		}
		function se() {
			r.active && !M.value && (M.value = !0, b[F.value] = !0, z(F.value));
		}
		r.active && se(), w(se), I(() => r.active, (e) => {
			e && se();
		});
		let U = E({
			open: !1,
			x: 0,
			y: 0,
			node: null,
			copied: ""
		}), W = D(null), G = 0, K = u(() => U.node ? String(r.keyOf(U.node) || "") : ""), ce = u(() => {
			if (!U.node || !r.rootPath) return "";
			let e = r.rootPath.replace(/\/+$/, ""), t = K.value;
			return t ? `${e}/${t}` : e;
		}), q = u(() => U.node ? r.dirOf(U.node) : !1);
		function J({ node: e, event: t }) {
			U.node = e, U.copied = "", U.x = t.clientX, U.y = t.clientY, U.open = !0, y(le);
		}
		function le() {
			if (!W.value) return;
			let e = W.value.offsetWidth, t = W.value.offsetHeight;
			U.x = Math.max(6, Math.min(U.x, window.innerWidth - e - 6)), U.y = Math.max(6, Math.min(U.y, window.innerHeight - t - 6));
		}
		function Y() {
			U.open = !1, U.node = null, U.copied = "", clearTimeout(G);
		}
		async function ue(e) {
			let t = e === "abs" ? ce.value : K.value;
			t && await be(t) && (U.copied = e, clearTimeout(G), G = setTimeout(Y, 700));
		}
		function X(e) {
			if (!U.node) return;
			let t = U.node;
			Y(), i("action", {
				action: e,
				node: t
			});
		}
		function de() {
			if (!U.node || !r.downloadOf) return;
			let e = U.node, t = r.downloadOf(e);
			if (Y(), !t) return;
			let n = r.nameOf(e) || "download", i = document.createElement("a");
			i.href = t, i.download = r.dirOf(e) ? `${n}.zip` : n, i.rel = "noopener", i.style.display = "none", document.body.appendChild(i), i.click(), i.remove();
		}
		function fe(e) {
			W.value && !W.value.contains(e.target) && Y();
		}
		function pe(e) {
			e.key === "Escape" && Y();
		}
		function Z() {
			U.open && Y();
		}
		function Q(e) {
			let t = e ? "addEventListener" : "removeEventListener";
			document[t]("mousedown", fe, !0), document[t]("keydown", pe, !0), window[t]("scroll", Z, !0), window[t]("resize", Z);
		}
		return I(() => U.open, (e) => Q(e)), C(() => {
			Y(), Q(!1);
		}), t({
			reveal: te,
			reload: ae,
			reloadDir: V,
			refreshAll: oe,
			scrollTo: H,
			toggle: ee,
			collapseAll: ie,
			expandedKeys: ne,
			restoreExpanded: re
		}), (t, n) => {
			let r = A("v-icon");
			return T(), p("div", {
				ref_key: "rootRef",
				ref: P,
				class: "file-tree"
			}, [e.root ? (T(), d(ye, {
				key: 0,
				node: e.root,
				depth: 0,
				expanded: b,
				cache: j,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: ee,
				onPick: n[0] ||= (e) => i("pick", e),
				onContext: J
			}, {
				"row-before-label": R((e) => [k(t.$slots, "row-before-label", x(_(e)), void 0, !0)]),
				"row-after-label": R((e) => [k(t.$slots, "row-after-label", x(_(e)), void 0, !0)]),
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
			])) : (T(), p(c, { key: 1 }, [L.value.loading ? (T(), p("p", xe, N(o.value.rootLoading), 1)) : L.value.error ? (T(), p("p", Se, N(L.value.error), 1)) : L.value.entries.length ? (T(), p(c, { key: 3 }, [(T(!0), p(c, null, O(L.value.entries, (r) => (T(), d(ye, {
				key: e.keyOf(r),
				node: r,
				depth: 0,
				expanded: b,
				cache: j,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: ee,
				onPick: n[1] ||= (e) => i("pick", e),
				onContext: J
			}, {
				"row-before-label": R((e) => [k(t.$slots, "row-before-label", v({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": R((e) => [k(t.$slots, "row-after-label", v({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), L.value.truncated ? (T(), p("p", we, N(o.value.truncated), 1)) : f("", !0)], 64)) : (T(), p("p", Ce, N(o.value.rootEmpty), 1))], 64)), (T(), d(l, { to: "body" }, [U.open ? (T(), p("div", {
				key: 0,
				ref_key: "menuRef",
				ref: W,
				class: "ft-menu",
				style: S({
					left: U.x + "px",
					top: U.y + "px"
				}),
				onContextmenu: n[8] ||= B(() => {}, ["prevent"])
			}, [
				e.editable ? (T(), p(c, { key: 0 }, [
					q.value ? (T(), p("button", {
						key: 0,
						class: "ft-item",
						type: "button",
						onClick: n[2] ||= (e) => X("create-file")
					}, [g(r, { size: "16" }, {
						default: R(() => [...n[9] ||= [h("mdi-file-plus-outline", -1)]]),
						_: 1
					}), m("span", null, N(o.value.newFile), 1)])) : f("", !0),
					q.value ? (T(), p("button", {
						key: 1,
						class: "ft-item",
						type: "button",
						onClick: n[3] ||= (e) => X("create-dir")
					}, [g(r, { size: "16" }, {
						default: R(() => [...n[10] ||= [h("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), m("span", null, N(o.value.newDir), 1)])) : f("", !0),
					m("button", {
						class: "ft-item",
						type: "button",
						disabled: !K.value,
						onClick: n[4] ||= (e) => X("rename")
					}, [g(r, { size: "16" }, {
						default: R(() => [...n[11] ||= [h("mdi-form-textbox", -1)]]),
						_: 1
					}), m("span", null, N(o.value.rename), 1)], 8, Te),
					m("button", {
						class: "ft-item danger",
						type: "button",
						disabled: !K.value,
						onClick: n[5] ||= (e) => X("delete")
					}, [g(r, { size: "16" }, {
						default: R(() => [...n[12] ||= [h("mdi-trash-can-outline", -1)]]),
						_: 1
					}), m("span", null, N(o.value.delete), 1)], 8, Ee),
					n[13] ||= m("div", { class: "ft-sep" }, null, -1)
				], 64)) : f("", !0),
				m("button", {
					class: "ft-item",
					type: "button",
					disabled: !K.value,
					onClick: n[6] ||= (e) => ue("rel")
				}, [g(r, { size: "16" }, {
					default: R(() => [...n[14] ||= [h("mdi-content-copy", -1)]]),
					_: 1
				}), m("span", null, N(U.copied === "rel" ? o.value.copied : o.value.copyRel), 1)], 8, De),
				e.rootPath ? (T(), p("button", {
					key: 1,
					class: "ft-item",
					type: "button",
					onClick: n[7] ||= (e) => ue("abs")
				}, [g(r, { size: "16" }, {
					default: R(() => [...n[15] ||= [h("mdi-link-variant", -1)]]),
					_: 1
				}), m("span", null, N(U.copied === "abs" ? o.value.copied : o.value.copyAbs), 1)])) : f("", !0),
				e.downloadOf ? (T(), p("button", {
					key: 2,
					class: "ft-item",
					type: "button",
					onClick: de
				}, [g(r, { size: "16" }, {
					default: R(() => [h(N(q.value ? "mdi-folder-zip-outline" : "mdi-download"), 1)]),
					_: 1
				}), m("span", null, N(q.value ? o.value.downloadDir : o.value.downloadFile), 1)])) : f("", !0)
			], 36)) : f("", !0)]))], 512);
		};
	}
}, [["__scopeId", "data-v-64472c3a"]]), ke = { class: "file-head" }, Ae = { class: "crumbs" }, je = ["title", "onClick"], Me = { class: "meta" }, Ne = /*#__PURE__*/ e({
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
		let n = e, r = t, i = u(() => {
			let e = String(n.path || "").split("/").filter(Boolean), t = "";
			return e.map((e) => (t = t ? `${t}/${e}` : e, {
				name: e,
				path: t
			}));
		}), a = u(() => {
			if (n.size === void 0 || n.size === null) return "";
			let e = Number(n.size) || 0;
			return e < 1024 ? `${e} 字节` : e < 1048576 ? `${(e / 1024).toFixed(1)} KB` : `${(e / 1024 / 1024).toFixed(1)} MB`;
		});
		function o(e, t) {
			t !== i.value.length - 1 && r("navigate", e.path);
		}
		return (t, n) => (T(), p("div", ke, [
			m("nav", Ae, [m("button", {
				class: "seg",
				title: "回到根目录",
				onClick: n[0] ||= (e) => r("navigate", "")
			}, N(e.rootName), 1), (T(!0), p(c, null, O(i.value, (e, t) => (T(), p(c, { key: e.path }, [n[1] ||= m("span", { class: "sep" }, "/", -1), m("button", {
				class: b(["seg", { last: t === i.value.length - 1 }]),
				title: e.path,
				onClick: (n) => o(e, t)
			}, N(e.name), 11, je)], 64))), 128))]),
			k(t.$slots, "actions", {}, void 0, !0),
			m("span", Me, N(a.value), 1)
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
			let a = A("v-spacer"), o = A("v-btn");
			return T(), d(n, {
				"model-value": e.modelValue,
				"initial-width": 440,
				"initial-height": 280,
				"min-width": 340,
				"min-height": 200,
				"onUpdate:modelValue": i[2] ||= (e) => !e && r("answer", !1)
			}, {
				title: R(() => [...i[3] ||= [h("文件还没保存", -1)]]),
				actions: R(() => [
					g(a),
					g(o, {
						variant: "text",
						onClick: i[0] ||= (e) => r("answer", !1)
					}, {
						default: R(() => [...i[4] ||= [h("留在这里", -1)]]),
						_: 1
					}),
					g(o, {
						color: "error",
						variant: "flat",
						onClick: i[1] ||= (e) => r("answer", !0)
					}, {
						default: R(() => [...i[5] ||= [h("丢掉修改", -1)]]),
						_: 1
					})
				]),
				default: R(() => [h(" " + N(e.path || "当前文件") + " ", 1), i[6] ||= m("p", { class: "tip" }, "换过去之后这次的修改就没了，要保留就先按 Ctrl+S 保存。", -1)]),
				_: 1
			}, 8, ["model-value"]);
		};
	}
}, [["__scopeId", "data-v-d6dcbf86"]]);
// src/components/commons/FileEditor/useFileEditor.js
function Fe({ loader: e, saver: t }) {
	let n = D(""), r = E({
		base: "",
		draft: "",
		loading: !1,
		error: "",
		saving: !1,
		saveError: ""
	}), i = 0, a = u(() => r.draft !== r.base);
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
		"edit"
	],
	setup(e, { expose: t, emit: n }) {
		let r = e, a = n, { path: o, state: s, dirty: l, load: m, save: _, discard: v, reset: b } = Fe({
			loader: r.loader,
			saver: r.saver
		}), x = D(null);
		I(l, (e) => a("dirty", e));
		let S = D("source"), w = u(() => Re(o.value)), E = u(() => w.value.find((e) => e.id === S.value) || null), k = M(null), F = D(!1), L = D(""), z = 0;
		function ee() {
			if (!z) return;
			let e = x.value;
			if (!e || typeof e.locate != "function") return;
			let t = z;
			z = 0, e.locate(t);
		}
		I(w, (e) => {
			S.value = ze(S.value, e);
		}, { immediate: !0 }), I(E, async (e) => {
			if (k.value = null, F.value = !!e, e) {
				L.value = "";
				try {
					let t = await e.load();
					if (E.value !== e) return;
					k.value = t.default, await y(), ee();
				} catch (t) {
					if (E.value === e) {
						let e = Ve(t);
						L.value = e.message, S.value = e.mode;
					}
				} finally {
					E.value === e && (F.value = !1);
				}
			}
		}, { immediate: !0 });
		async function B() {
			let e = o.value, t = await _();
			return t && a("saved", {
				path: e,
				data: t
			}), t;
		}
		function te() {
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
		let V = D(!1), H = null;
		async function oe(e, t = 0) {
			return L.value = "", S.value = Be(S.value, t), z = t, await m(e) ? (await y(), t || x.value?.resetScroll(), ee(), !0) : (z = 0, !1);
		}
		async function se() {
			return !o.value || !await m(o.value) ? !1 : (await y(), x.value?.resetScroll(), !0);
		}
		function U() {
			K(), b();
		}
		function W() {
			return l.value ? V.value ? Promise.resolve(!1) : (V.value = !0, new Promise((e) => {
				H = e;
			})) : Promise.resolve(!0);
		}
		function G(e) {
			if (V.value = !1, !H) return;
			let t = H;
			H = null, t(e);
		}
		function K() {
			G(!1);
		}
		let ce = u(() => s.draft);
		function q(e) {
			s.draft = e == null ? "" : String(e);
		}
		return C(() => G(!1)), t({
			open: oe,
			reload: se,
			close: U,
			save: B,
			discard: te,
			confirmLeave: W,
			cancelLeave: K,
			path: o,
			dirty: l,
			text: ce,
			restore: q
		}), (t, n) => {
			let r = A("v-btn"), u = A("v-btn-toggle"), m = A("v-chip");
			return T(), p("section", He, [
				P(o) ? (T(), d(Ne, {
					key: 0,
					"root-name": e.rootName,
					path: P(o),
					size: e.size,
					onNavigate: n[1] ||= (e) => a("navigate", e)
				}, {
					actions: R(() => [w.value.length > 1 ? (T(), d(u, {
						key: 0,
						modelValue: S.value,
						"onUpdate:modelValue": n[0] ||= (e) => S.value = e,
						density: "compact",
						variant: "text",
						divided: "",
						mandatory: "",
						class: "views"
					}, {
						default: R(() => [(T(!0), p(c, null, O(w.value, (e) => (T(), d(r, {
							key: e.id,
							value: e.id,
							size: "small"
						}, {
							default: R(() => [h(N(e.title), 1)]),
							_: 2
						}, 1032, ["value"]))), 128))]),
						_: 1
					}, 8, ["modelValue"])) : f("", !0), P(l) && !P(s).loading ? (T(), p("div", Ue, [
						g(m, {
							size: "x-small",
							variant: "flat",
							color: "modified"
						}, {
							default: R(() => [...n[4] ||= [h("未保存", -1)]]),
							_: 1
						}),
						g(r, {
							size: "small",
							variant: "text",
							color: "primary",
							loading: P(s).saving,
							onClick: B
						}, {
							default: R(() => [...n[5] ||= [h(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"]),
						g(r, {
							size: "small",
							variant: "text",
							disabled: P(s).saving,
							onClick: te
						}, {
							default: R(() => [...n[6] ||= [h(" 放弃 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					])) : f("", !0)]),
					_: 1
				}, 8, [
					"root-name",
					"path",
					"size"
				])) : f("", !0),
				P(s).loading ? (T(), p("p", We, "正在读取文件…")) : P(s).error ? (T(), d(i, {
					key: 2,
					icon: "mdi-file-question-outline",
					"icon-size": 28,
					title: P(s).error,
					hint: "换一个文件试试，或者从左侧目录里下载它。"
				}, null, 8, ["title"])) : P(o) ? (T(), p("div", Ge, [
					L.value ? (T(), p("p", Ke, N(L.value), 1)) : f("", !0),
					P(s).saveError ? (T(), p("p", qe, N(P(s).saveError), 1)) : f("", !0),
					k.value ? (T(), d(j(k.value), {
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
						onEdit: n[3] ||= (e) => t.$emit("edit", { path: P(o) })
					}, null, 40, [
						"modelValue",
						"path",
						"markers"
					])) : F.value ? (T(), p("p", Je, "正在准备视图…")) : f("", !0)
				])) : (T(), d(i, {
					key: 4,
					icon: "mdi-file-outline",
					hint: "从左边选一个文件，右边显示它的内容。"
				})),
				g(Pe, {
					"model-value": V.value,
					path: P(o),
					onAnswer: G
				}, null, 8, ["model-value", "path"])
			]);
		};
	}
}, [["__scopeId", "data-v-8faeedb3"]]), Xe = "";
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
		}, a = u(() => ({
			...i,
			...r.texts
		})), o = t, s = r.storageKey ? re(r.storageKey, [], { writeDefaults: !1 }) : D([]), l = u(() => new Set(Array.isArray(s.value) ? s.value : [])), _ = D(null), v = D(null), y = u(() => r.groups.filter((e) => e && e.kind === "group").length), x = u(() => Qe(r.groups, r.workspaces, l.value)), j = u(() => $e(r.groups));
		function M() {
			return nt(r.groups, r.workspaces);
		}
		function F(e, t) {
			return et(r.groups, e, t);
		}
		function L(e) {
			o("groups-change", e);
		}
		function z(e, t, n, r) {
			let i = e.find((e) => e.kind === t && e.id === n);
			i ? i.parent = r : e.push({
				kind: t,
				id: n,
				parent: r
			});
		}
		function te() {
			return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
		}
		function ne(e) {
			s.value = [...e];
		}
		function ie(e) {
			if (e.kind !== "group") {
				o("select", e.id);
				return;
			}
			let t = new Set(l.value);
			t.has(e.id) ? t.delete(e.id) : t.add(e.id), ne(t);
		}
		function ae(e) {
			if (!l.value.has(e)) return;
			let t = new Set(l.value);
			t.delete(e), ne(t);
		}
		function V(e) {
			let t = _.value, n = v.value, r = (t) => !!n && n.mode === t && n.kind === e.kind && n.id === e.id;
			return {
				"drag-src": !!t && t.kind === e.kind && t.id === e.id,
				"drop-before": r("before"),
				"drop-after": r("after"),
				"drop-into": r("into")
			};
		}
		function H(e, t) {
			_.value = {
				kind: t.kind,
				id: t.id
			}, v.value = null, e.dataTransfer && (e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("text/plain", t.id));
		}
		function oe(e, t) {
			if (!_.value) return;
			let n = _.value;
			if (n.kind === t.kind && n.id === t.id) {
				v.value = null;
				return;
			}
			let r = e.currentTarget.getBoundingClientRect(), i = e.clientY - r.top, a = i > r.height / 2 ? "after" : "before";
			t.kind === "group" && (a = i < r.height * .25 ? "before" : i > r.height * .75 ? "after" : "into"), n.kind === "group" && F(n.id, a === "into" ? t.id : t.parent) ? v.value = null : v.value = {
				kind: t.kind,
				id: t.id,
				mode: a
			};
		}
		function se() {
			let e = _.value, t = v.value;
			if (!e || !t) return U();
			let n = M(), r = n.findIndex((t) => t.kind === e.kind && t.id === e.id);
			if (r < 0) return U();
			let i = n.splice(r, 1)[0];
			if (t.mode === "into") i.parent = t.id, n.push(i), ae(t.id);
			else {
				let e = n.findIndex((e) => e.kind === t.kind && e.id === t.id);
				e < 0 ? (i.parent = "", n.push(i)) : (i.parent = n[e].parent || "", n.splice(t.mode === "before" ? e : e + 1, 0, i));
			}
			L(n), U();
		}
		function U() {
			_.value = null, v.value = null;
		}
		let W = D(!1), G = D(""), K = D(!1), ce = D(0), q = D(null), J = E({
			open: !1,
			x: 0,
			y: 0,
			mode: "blank",
			target: null
		}), le = D(!1), Y = D(null), X = D(""), de = D(!1), fe = D(!1), pe = D(null), Z = D(""), Q = D(!1), me = D(null);
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
			pe.value = { id: e.id }, Z.value = e.name || "", fe.value = !0, $();
		}
		function ye() {
			let e = (Z.value || "").trim().slice(0, 80);
			e && pe.value && (L(M().map((t) => t.kind === "group" && t.id === pe.value.id ? {
				...t,
				name: e
			} : t)), fe.value = !1);
		}
		function xe() {
			let e = M(), t = {
				kind: "group",
				id: te(),
				name: "新分组",
				parent: ""
			};
			e.push(t), L(e), $(), ve(t);
		}
		function Se() {
			let e = J.target;
			if (!e) return;
			let t = M(), n = {
				kind: "group",
				id: te(),
				name: "新分组",
				parent: e.id
			};
			t.push(n), L(t), ae(e.id), $(), ve(n);
		}
		function Ce() {
			let e = J.target;
			if (!e) return;
			let t = M(), n = {
				kind: "group",
				id: te(),
				name: "新分组",
				parent: ""
			};
			t.push(n), z(t, "ws", e.id, n.id), L(t), $(), ve(n);
		}
		function we(e) {
			if (!J.target) return;
			let t = M();
			z(t, "ws", J.target.id, e), L(t), e && ae(e), $();
		}
		function Te() {
			me.value = J.target, Q.value = !0, $();
		}
		function Ee() {
			let e = me.value ? me.value.id : "";
			if (e) {
				let t = M(), n = t.findIndex((t) => t.kind === "group" && t.id === e);
				if (n >= 0) {
					let r = t[n].parent || "";
					t.splice(n, 1);
					for (let n of t) (n.parent || "") === e && (n.parent = r);
					L(t);
				}
			}
			Q.value = !1;
		}
		function De(e) {
			Y.value = e, X.value = e.alias || "", le.value = !0, $();
		}
		async function Oe() {
			if (Y.value) {
				de.value = !0;
				try {
					await r.saveAlias(Y.value.id, (X.value || "").trim()), le.value = !1, o("changed"), o("notice", {
						text: a.value.aliasSaved,
						color: "primary"
					});
				} catch (e) {
					o("notice", {
						text: `${a.value.aliasFailed}${e.message}`,
						color: "error"
					});
				} finally {
					de.value = !1;
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
		w(() => {
			document.addEventListener("click", $), document.addEventListener("contextmenu", $), window.addEventListener("resize", $), window.addEventListener("blur", $);
		}), C(() => {
			document.removeEventListener("click", $), document.removeEventListener("contextmenu", $), window.removeEventListener("resize", $), window.removeEventListener("blur", $);
		});
		function Ae(e) {
			let t = String(e || "").split("/").filter(Boolean);
			return t.length ? t[t.length - 1] : e;
		}
		let je = D(""), Me = new Set(r.workspaces.map((e) => e.id));
		function Ne(e) {
			J.open = !1, Pe(), je.value = e ? e.id : "";
		}
		I(() => r.workspaces.map((e) => e.id).join(","), () => {
			let e = r.workspaces.filter((e) => !Me.has(e.id)).map((e) => e.id);
			if (Me = new Set(r.workspaces.map((e) => e.id)), !je.value || !e.length) return;
			let t = je.value;
			je.value = "", o("groups-change", tt(nt(r.groups, r.workspaces), e, t));
		});
		function Pe() {
			je.value = "", G.value = "", K.value = !1, ce.value += 1, W.value = !0;
		}
		function Fe() {
			let e = G.value.trim();
			e && (W.value = !1, o("add", e));
		}
		function Ie(e) {
			q.value = e;
		}
		function Le() {
			let e = q.value;
			q.value = null, e && o("remove", e.id);
		}
		return (t, r) => {
			let i = A("v-btn"), o = A("v-icon"), s = A("v-list-item-title"), u = A("v-list-item-subtitle"), _ = A("v-list-item"), v = A("v-list"), C = A("v-text-field"), w = A("v-spacer");
			return T(), p("div", {
				class: "list",
				onContextmenu: B(_e, ["prevent", "stop"])
			}, [
				m("div", rt, [m("span", it, N(a.value.headTitle), 1), g(i, {
					size: "small",
					variant: "text",
					color: "primary",
					"prepend-icon": "mdi-plus",
					loading: e.busy,
					onClick: Pe
				}, {
					default: R(() => [h(N(a.value.add), 1)]),
					_: 1
				}, 8, ["loading"])]),
				!e.workspaces.length && !y.value ? (T(), p("div", at, N(a.value.empty), 1)) : f("", !0),
				g(v, {
					density: "compact",
					nav: "",
					class: "items",
					onDrop: B(se, ["prevent"])
				}, {
					default: R(() => [(T(!0), p(c, null, O(x.value, (n) => (T(), d(_, {
						key: n.key,
						active: n.kind === "ws" && n.id === e.current,
						"active-color": "primary",
						draggable: "true",
						style: S({ paddingLeft: `${12 + n.depth * 12}px` }),
						class: b(V(n)),
						onClick: (e) => ie(n),
						onContextmenu: B((e) => ge(e, n), ["prevent", "stop"]),
						onDragstart: (e) => H(e, n),
						onDragover: B((e) => oe(e, n), ["prevent"]),
						onDragend: U
					}, {
						append: R(() => [n.kind === "ws" ? (T(), d(i, {
							key: 0,
							icon: !0,
							size: "x-small",
							variant: "text",
							title: a.value.forgetTitle,
							class: "forget",
							onClick: B((e) => Ie(n.ws), ["stop"])
						}, {
							default: R(() => [g(o, { size: "18" }, {
								default: R(() => [...r[24] ||= [h("mdi-close", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["title", "onClick"])) : f("", !0)]),
						default: R(() => [n.kind === "group" ? (T(), d(s, {
							key: 0,
							class: "gname"
						}, {
							default: R(() => [
								g(o, { size: "16" }, {
									default: R(() => [h(N(l.value.has(n.id) ? "mdi-chevron-right" : "mdi-chevron-down"), 1)]),
									_: 2
								}, 1024),
								g(o, { size: "16" }, {
									default: R(() => [...r[23] ||= [h("mdi-folder-outline", -1)]]),
									_: 1
								}),
								m("span", ot, N(n.name), 1)
							]),
							_: 2
						}, 1024)) : (T(), p(c, { key: 1 }, [g(s, {
							class: "name",
							title: n.ws.alias ? n.ws.root : ""
						}, {
							default: R(() => [m("span", st, N(n.ws.alias || Ae(n.ws.root)), 1), k(t.$slots, "title-extra", { ws: n.ws }, void 0, !0)]),
							_: 2
						}, 1032, ["title"]), g(u, {
							class: "path",
							title: n.ws.url || n.ws.root
						}, {
							default: R(() => [h(N(n.ws.url || n.ws.root), 1)]),
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
				J.open ? (T(), p("div", {
					key: 1,
					class: "ctxmenu",
					style: S({
						left: J.x + "px",
						top: J.y + "px"
					}),
					onClick: r[7] ||= B(() => {}, ["stop"]),
					onContextmenu: r[8] ||= B(() => {}, ["prevent", "stop"])
				}, [J.mode === "ws" ? (T(), p(c, { key: 0 }, [
					m("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[0] ||= (e) => De(J.target)
					}, [g(o, { size: "16" }, {
						default: R(() => [...r[25] ||= [h("mdi-rename-box", -1)]]),
						_: 1
					}), h(N(a.value.menuAlias), 1)]),
					m("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[1] ||= (e) => ke(J.target, "rel")
					}, [g(o, { size: "16" }, {
						default: R(() => [...r[26] ||= [h("mdi-content-copy", -1)]]),
						_: 1
					}), h(N(a.value.copyRel), 1)]),
					m("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[2] ||= (e) => ke(J.target, "abs")
					}, [g(o, { size: "16" }, {
						default: R(() => [...r[27] ||= [h("mdi-content-copy", -1)]]),
						_: 1
					}), h(N(a.value.copyAbs), 1)]),
					m("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[3] ||= (e) => J.mode = "pick"
					}, [
						g(o, { size: "16" }, {
							default: R(() => [...r[28] ||= [h("mdi-folder-move-outline", -1)]]),
							_: 1
						}),
						r[29] ||= h("移到分组 ", -1),
						r[30] ||= m("span", { class: "more" }, "›", -1)
					])
				], 64)) : J.mode === "pick" ? (T(), p(c, { key: 1 }, [
					m("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[4] ||= (e) => we("")
					}, [g(o, { size: "16" }, {
						default: R(() => [...r[31] ||= [h("mdi-format-list-bulleted", -1)]]),
						_: 1
					}), r[32] ||= h("移出分组 ", -1)]),
					(T(!0), p(c, null, O(j.value, (e) => (T(), p("button", {
						key: e.id,
						type: "button",
						class: "ctxitem",
						style: S({ paddingLeft: `${10 + e.depth * 12}px` }),
						onClick: (t) => we(e.id)
					}, [g(o, { size: "16" }, {
						default: R(() => [...r[33] ||= [h("mdi-folder-outline", -1)]]),
						_: 1
					}), h(N(e.name), 1)], 12, ct))), 128)),
					m("button", {
						type: "button",
						class: "ctxitem",
						onClick: Ce
					}, [g(o, { size: "16" }, {
						default: R(() => [...r[34] ||= [h("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), r[35] ||= h("新建分组并移入 ", -1)])
				], 64)) : J.mode === "group" ? (T(), p(c, { key: 2 }, [
					m("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[5] ||= (e) => Ne(J.target)
					}, [g(o, { size: "16" }, {
						default: R(() => [...r[36] ||= [h("mdi-plus", -1)]]),
						_: 1
					}), h(N(a.value.menuAddInGroup), 1)]),
					m("button", {
						type: "button",
						class: "ctxitem",
						onClick: Se
					}, [g(o, { size: "16" }, {
						default: R(() => [...r[37] ||= [h("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), r[38] ||= h("新建子分组 ", -1)]),
					m("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[6] ||= (e) => ve(J.target)
					}, [g(o, { size: "16" }, {
						default: R(() => [...r[39] ||= [h("mdi-rename-box", -1)]]),
						_: 1
					}), r[40] ||= h("重命名 ", -1)]),
					m("button", {
						type: "button",
						class: "ctxitem",
						onClick: Te
					}, [g(o, { size: "16" }, {
						default: R(() => [...r[41] ||= [h("mdi-trash-can-outline", -1)]]),
						_: 1
					}), r[42] ||= h("删除分组 ", -1)])
				], 64)) : (T(), p("button", {
					key: 3,
					type: "button",
					class: "ctxitem",
					onClick: xe
				}, [g(o, { size: "16" }, {
					default: R(() => [...r[43] ||= [h("mdi-folder-plus-outline", -1)]]),
					_: 1
				}), r[44] ||= h("新建分组 ", -1)]))], 36)) : f("", !0),
				g(n, {
					modelValue: le.value,
					"onUpdate:modelValue": r[11] ||= (e) => le.value = e,
					"initial-width": 460,
					"initial-height": 320,
					"min-width": 360,
					"min-height": 240
				}, {
					title: R(() => [h(N(a.value.aliasTitle), 1)]),
					actions: R(() => [
						g(w),
						g(i, {
							variant: "text",
							onClick: r[10] ||= (e) => le.value = !1
						}, {
							default: R(() => [...r[45] ||= [h("取消", -1)]]),
							_: 1
						}),
						g(i, {
							color: "primary",
							variant: "flat",
							loading: de.value,
							onClick: Oe
						}, {
							default: R(() => [...r[46] ||= [h(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"])
					]),
					default: R(() => [
						m("p", lt, N(Y.value ? Y.value.root : ""), 1),
						g(C, {
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
						m("p", ut, N(a.value.aliasHint), 1)
					]),
					_: 1
				}, 8, ["modelValue"]),
				g(n, {
					modelValue: fe.value,
					"onUpdate:modelValue": r[14] ||= (e) => fe.value = e,
					"initial-width": 440,
					"initial-height": 260,
					"min-width": 340,
					"min-height": 200
				}, {
					title: R(() => [...r[47] ||= [h("分组名称", -1)]]),
					actions: R(() => [
						g(w),
						g(i, {
							variant: "text",
							onClick: r[13] ||= (e) => fe.value = !1
						}, {
							default: R(() => [...r[48] ||= [h("取消", -1)]]),
							_: 1
						}),
						g(i, {
							color: "primary",
							variant: "flat",
							disabled: !Z.value.trim(),
							onClick: ye
						}, {
							default: R(() => [...r[49] ||= [h(" 保存 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					]),
					default: R(() => [g(C, {
						modelValue: Z.value,
						"onUpdate:modelValue": r[12] ||= (e) => Z.value = e,
						label: "名称",
						density: "compact",
						variant: "outlined",
						maxlength: "80",
						autofocus: "",
						onKeyup: ee(ye, ["enter"])
					}, null, 8, ["modelValue"])]),
					_: 1
				}, 8, ["modelValue"]),
				g(n, {
					modelValue: Q.value,
					"onUpdate:modelValue": r[16] ||= (e) => Q.value = e,
					"initial-width": 440,
					"initial-height": 240,
					"min-width": 340,
					"min-height": 200
				}, {
					title: R(() => [...r[50] ||= [h("删除分组", -1)]]),
					actions: R(() => [
						g(w),
						g(i, {
							variant: "text",
							onClick: r[15] ||= (e) => Q.value = !1
						}, {
							default: R(() => [...r[51] ||= [h("取消", -1)]]),
							_: 1
						}),
						g(i, {
							color: "error",
							variant: "flat",
							onClick: Ee
						}, {
							default: R(() => [...r[52] ||= [h("删除", -1)]]),
							_: 1
						})
					]),
					default: R(() => [h(" " + N(me.value ? me.value.name : "") + " ", 1), r[53] ||= m("p", { class: "tip" }, "里面的子分组与工作区移到上一级，工作区本身不动。", -1)]),
					_: 1
				}, 8, ["modelValue"]),
				g(n, {
					modelValue: W.value,
					"onUpdate:modelValue": r[20] ||= (e) => W.value = e,
					"initial-width": 620,
					"initial-height": 460,
					"min-width": 420,
					"min-height": 300
				}, {
					title: R(() => [h(N(a.value.addTitle), 1)]),
					actions: R(() => [
						g(w),
						g(i, {
							variant: "text",
							onClick: r[19] ||= (e) => W.value = !1
						}, {
							default: R(() => [...r[54] ||= [h("取消", -1)]]),
							_: 1
						}),
						g(i, {
							color: "primary",
							variant: "flat",
							disabled: !G.value.trim() || !K.value,
							onClick: Fe
						}, {
							default: R(() => [h(N(a.value.addConfirm), 1)]),
							_: 1
						}, 8, ["disabled"])
					]),
					default: R(() => [(T(), d(P(ue), {
						key: ce.value,
						modelValue: G.value,
						"onUpdate:modelValue": r[17] ||= (e) => G.value = e,
						tip: a.value.addTip,
						label: a.value.addLabel,
						placeholder: a.value.addPlaceholder,
						loader: e.dirs,
						"onUpdate:valid": r[18] ||= (e) => K.value = e
					}, null, 8, [
						"modelValue",
						"tip",
						"label",
						"placeholder",
						"loader"
					]))]),
					_: 1
				}, 8, ["modelValue"]),
				g(n, {
					modelValue: q.value,
					"onUpdate:modelValue": r[22] ||= (e) => q.value = e,
					"initial-width": 440,
					"initial-height": 260,
					"min-width": 340,
					"min-height": 200
				}, {
					title: R(() => [h(N(a.value.removeTitle), 1)]),
					actions: R(() => [
						g(w),
						g(i, {
							variant: "text",
							onClick: r[21] ||= (e) => q.value = null
						}, {
							default: R(() => [...r[55] ||= [h("取消", -1)]]),
							_: 1
						}),
						g(i, {
							color: "error",
							variant: "flat",
							onClick: Le
						}, {
							default: R(() => [h(N(a.value.removeConfirm), 1)]),
							_: 1
						})
					]),
					default: R(() => [h(" " + N(q.value ? q.value.root : "") + " ", 1), m("p", dt, N(a.value.removeText), 1)]),
					_: 1
				}, 8, ["modelValue"])
			], 32);
		};
	}
}, [["__scopeId", "data-v-34d9e320"]]), pt = "web-shared-resizing";
function mt({ area: e, initial: t, min: n = 0, max: r = 100, rightMin: i = 0, axis: a = "x", unit: o = "px", persist: s = "" }) {
	let c = D(f()), l = D(!1), u = 0, d = 0;
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
	return I(c, (e) => {
		if (s) try {
			window.localStorage.setItem(s, String(e));
		} catch {}
	}), C(h), {
		size: c,
		resizing: l,
		start: g,
		stop: h,
		reset: _
	};
}
// src/components/services/WorkspaceShell.vue
var ht = { class: "brand" }, gt = { class: "side" }, _t = { class: "content" }, vt = /*#__PURE__*/ e({
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
		let n = e, r = D(null), o = D(!0), { size: s, resizing: c, start: l, reset: u } = mt({
			area: r,
			initial: 268,
			min: 200,
			rightMin: 420,
			persist: `${n.title}.shell.side-width`
		});
		return (n, p) => {
			let _ = A("v-app-bar-nav-icon"), y = A("v-app-bar-title"), x = A("v-spacer"), C = A("v-chip"), w = A("v-btn"), E = A("v-app-bar"), D = A("v-main"), O = A("v-app");
			return T(), d(O, null, {
				default: R(() => [
					g(E, {
						density: "comfortable",
						flat: "",
						border: "b",
						class: "app-bar"
					}, {
						default: R(() => [
							g(_, {
								title: o.value ? "收起左侧列表" : "展开左侧列表",
								onClick: p[0] ||= (e) => o.value = !o.value
							}, null, 8, ["title"]),
							g(y, null, {
								default: R(() => [m("span", ht, N(e.title), 1)]),
								_: 1
							}),
							g(x),
							e.workspaces.length ? (T(), d(C, {
								key: 0,
								size: "small",
								variant: "tonal",
								class: "running",
								color: e.running ? "ready" : void 0,
								"prepend-icon": "mdi-play-circle-outline",
								title: e.running ? `所有工作区共 ${e.running} 个进程在跑` : "所有工作区都没有在跑的进程"
							}, {
								default: R(() => [h(N(e.running) + " 个在跑 ", 1)]),
								_: 1
							}, 8, ["color", "title"])) : f("", !0),
							k(n.$slots, "metrics", {}, void 0, !0),
							g(w, {
								icon: e.dark ? "mdi-weather-sunny" : "mdi-weather-night",
								title: "切换深浅色",
								variant: "text",
								onClick: e.toggleTheme
							}, null, 8, ["icon", "onClick"])
						]),
						_: 3
					}),
					g(t, {
						modelValue: e.snack.on,
						"onUpdate:modelValue": p[1] ||= (t) => e.snack.on = t,
						text: e.snack.text,
						color: e.snack.color
					}, null, 8, [
						"modelValue",
						"text",
						"color"
					]),
					g(D, { class: "fill-height" }, {
						default: R(() => [m("div", {
							ref_key: "shellRef",
							ref: r,
							class: "shell"
						}, [
							m("div", {
								class: "side-slot",
								style: S({ width: o.value ? `${P(s)}px` : "0px" })
							}, null, 4),
							m("div", {
								class: b(["side-layer", { folded: !o.value }]),
								style: S({ width: `${P(s)}px` })
							}, [m("aside", gt, [k(n.$slots, "sidebar", {}, void 0, !0)])], 6),
							z(g(a, {
								axis: "x",
								active: P(c),
								onStart: P(l),
								onReset: P(u)
							}, null, 8, [
								"active",
								"onStart",
								"onReset"
							]), [[F, o.value]]),
							m("main", _t, [k(n.$slots, "default", { ws: e.current }, void 0, !0), e.current ? f("", !0) : (T(), d(i, v({ key: 0 }, e.empty, { onAction: p[2] ||= (e) => n.$emit("empty-action") }), null, 16))])
						], 512)]),
						_: 3
					})
				]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-cb664302"]]), yt = { style: { width: "42%" } }, bt = { class: "svc-name" }, xt = ["title"], St = ["title"], Ct = { class: "status-line" }, wt = {
	key: 0,
	class: "meta"
}, Tt = {
	key: 1,
	class: "meta"
}, Et = ["title"], Dt = {
	key: 1,
	class: "meta"
}, Ot = {
	key: 2,
	class: "meta"
}, kt = { class: "ops" }, At = /*#__PURE__*/ e({
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
			let r = A("v-chip"), i = A("v-btn"), a = A("v-icon"), o = A("v-table");
			return T(), d(o, {
				density: "compact",
				class: "table"
			}, {
				default: R(() => [m("thead", null, [m("tr", null, [
					m("th", yt, N(e.nameTitle), 1),
					n[0] ||= m("th", null, "参数", -1),
					n[1] ||= m("th", { style: { width: "200px" } }, "状态", -1),
					n[2] ||= m("th", { style: { width: "230px" } }, null, -1)
				])]), m("tbody", null, [(T(!0), p(c, null, O(e.rows, (o) => (T(), p("tr", { key: o.key }, [
					m("td", null, [m("div", bt, [m("span", null, N(o.title), 1), o.typeText ? (T(), d(r, {
						key: 0,
						size: "x-small",
						variant: "tonal",
						class: "type-chip"
					}, {
						default: R(() => [h(N(o.typeText), 1)]),
						_: 2
					}, 1024)) : f("", !0)]), e.showPath && o.path ? (T(), p("div", {
						key: 0,
						class: "svc-path",
						title: o.path
					}, N(o.path), 9, xt)) : f("", !0)]),
					m("td", null, [m("div", {
						class: "cmd",
						title: o.cmd
					}, N(o.cmd), 9, St)]),
					m("td", null, [m("div", Ct, [o.live ? (T(), p(c, { key: 0 }, [g(r, {
						size: "small",
						class: "status-chip",
						color: o.color,
						variant: "tonal",
						"prepend-icon": o.icon
					}, {
						default: R(() => [h(N(o.statusText), 1)]),
						_: 2
					}, 1032, ["color", "prepend-icon"]), o.port ? (T(), p("span", wt, "端口 " + N(o.port), 1)) : o.started ? (T(), p("span", Tt, N(o.ago), 1)) : f("", !0)], 64)) : o.run ? (T(), p(c, { key: 1 }, [g(r, {
						size: "small",
						class: "status-chip",
						color: o.color,
						variant: "tonal",
						"prepend-icon": o.icon,
						onClick: (e) => t.$emit("log", o)
					}, {
						default: R(() => [h(N(o.statusText), 1)]),
						_: 2
					}, 1032, [
						"color",
						"prepend-icon",
						"onClick"
					]), o.err ? (T(), p("span", {
						key: 0,
						class: "meta err",
						title: o.err
					}, N(o.err), 9, Et)) : o.started ? (T(), p("span", Dt, N(o.ago), 1)) : f("", !0)], 64)) : (T(), p("span", Ot, "—"))])]),
					m("td", kt, [o.live ? (T(), p(c, { key: 0 }, [g(i, {
						size: "small",
						variant: "text",
						"prepend-icon": "mdi-text-box-outline",
						onClick: (e) => t.$emit("log", o)
					}, {
						default: R(() => [...n[3] ||= [h(" 日志 ", -1)]]),
						_: 1
					}, 8, ["onClick"]), g(i, {
						size: "small",
						color: "error",
						variant: "tonal",
						loading: o.stopping,
						onClick: (e) => t.$emit("stop", o)
					}, {
						default: R(() => [...n[4] ||= [h(" 停止 ", -1)]]),
						_: 1
					}, 8, ["loading", "onClick"])], 64)) : (T(), p(c, { key: 1 }, [
						g(i, {
							size: "small",
							color: "primary",
							variant: "flat",
							disabled: o.blocked,
							loading: o.starting,
							onClick: (e) => t.$emit("start", o)
						}, {
							default: R(() => [h(N(o.action), 1)]),
							_: 2
						}, 1032, [
							"disabled",
							"loading",
							"onClick"
						]),
						g(i, {
							size: "small",
							variant: "text",
							icon: !0,
							title: "参数",
							onClick: (e) => t.$emit("settings", o)
						}, {
							default: R(() => [g(a, { size: "20" }, {
								default: R(() => [...n[5] ||= [h("mdi-tune", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["onClick"]),
						o.run ? (T(), d(i, {
							key: 0,
							size: "small",
							variant: "text",
							"prepend-icon": "mdi-text-box-outline",
							onClick: (e) => t.$emit("log", o)
						}, {
							default: R(() => [...n[6] ||= [h(" 日志 ", -1)]]),
							_: 1
						}, 8, ["onClick"])) : f("", !0)
					], 64)), k(t.$slots, "row-extra", { row: o }, void 0, !0)])
				]))), 128))])]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-8df04734"]]), jt = { class: "log-head" }, Mt = { class: "log-box" }, Nt = {
	key: 1,
	class: "log-empty"
}, Pt = /*#__PURE__*/ e({
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
			let r = A("v-spacer"), i = A("v-btn");
			return T(), p(c, null, [m("div", jt, [
				n[2] ||= m("span", { class: "label" }, "日志", -1),
				g(r),
				e.more ? (T(), d(i, {
					key: 0,
					size: "small",
					variant: "text",
					"prepend-icon": "mdi-history",
					onClick: n[0] ||= (e) => t.$emit("load-more")
				}, {
					default: R(() => [...n[1] ||= [h(" 更早 ", -1)]]),
					_: 1
				})) : f("", !0)
			]), m("div", Mt, [e.text ? (T(), d(ie, {
				key: 0,
				text: e.text,
				dark: e.dark,
				colorize: e.colorize
			}, null, 8, [
				"text",
				"dark",
				"colorize"
			])) : (T(), p("p", Nt, N(e.emptyText), 1))])], 64);
		};
	}
}, [["__scopeId", "data-v-d45becae"]]);
// src/composables/commons/useFileTree.js
function Ft(e, t = () => ({})) {
	let n = E({});
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
	let s = u(() => o(i(r()), 0));
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
function It({ api: e, ws: t, statusText: n = {} }) {
	let r = D(""), i = D(!1), a = D(0), o = D(""), s = D(""), c = D(""), l = null;
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
	}), C(u), {
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
var Lt = ["starting", "ready"];
function Rt(e, t = Lt) {
	return (e.services || []).filter((e) => e.run && t.includes(e.run.status)).length;
}
// src/composables/services/useWorkspaceState.js
function zt({ api: e, storageKey: t, extraState: n = {}, loadExtra: i = null, addedNotice: a = "已添加" }) {
	let o = E({
		workspaces: [],
		groups: [],
		...n
	}), s = re(t, "", { writeDefaults: !1 }), c = D(!1), l = D(null), { snack: d, toast: f } = r(), p = null, m = 0, h = u(() => o.workspaces.find((e) => e.id === s.value) || null), g = u(() => o.workspaces.reduce((e, t) => e + Rt(t), 0));
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
		metrics: l,
		running: g,
		select: _,
		setGroups: y,
		refresh: b,
		act: w,
		start: N,
		disconnect: S,
		addWorkspace: T,
		removeWorkspace: O,
		rescan: k,
		startService: A,
		stopService: j,
		saveService: M
	};
}
export { W as DirectoryNode, ue as DirectoryPicker, Ye as FileEditor, Oe as FileTree, Lt as LIVE_STATUSES, ie as LogView, Pt as RunLogPanel, At as ServiceTable, ft as WorkspaceList, vt as WorkspaceShell, be as copyText, pe as fileIcon, Rt as runningCount, s as symbolAt, Ft as useFileTree, It as useRunLog, mt as useSplitPane, zt as useWorkspaceState };
