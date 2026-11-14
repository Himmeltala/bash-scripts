import { t as e } from "./_plugin-vue_export-helper-Djzt4Yr7.js";
import { highlightCode as t, languageOf as n } from "./highlight.js";
import { n as r, r as i, t as a } from "./useToast-CLYr-vEJ.js";
import { Fragment as o, Teleport as s, computed as c, createBlock as l, createCommentVNode as u, createElementBlock as d, createElementVNode as f, createTextVNode as p, createVNode as m, guardReactiveProps as h, mergeProps as g, nextTick as _, normalizeClass as v, normalizeProps as y, normalizeStyle as b, onBeforeUnmount as x, onMounted as S, openBlock as C, reactive as w, ref as T, renderList as E, renderSlot as D, resolveComponent as O, toDisplayString as k, unref as A, watch as j, watchEffect as M, withCtx as N, withKeys as P, withModifiers as F } from "vue";
import { Terminal as I } from "@xterm/xterm";
import { FitAddon as L } from "@xterm/addon-fit";
import { useLocalStorage as R } from "@vueuse/core";
var z = /*#__PURE__*/ e({
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
		}, r = T(null), i = null, a = null, o = null, s = "";
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
		function f(e) {
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
		return S(() => {
			i = new I({
				convertEol: !0,
				disableStdin: !0,
				cursorBlink: !1,
				scrollback: 5e3,
				fontFamily: "'JetBrains Mono', 'Noto Sans Mono CJK SC', 'Sarasa Mono SC', 'Cascadia Mono', Consolas, Menlo, monospace",
				fontSize: 12,
				lineHeight: 1.3,
				theme: c(t.dark)
			}), a = new L(), i.loadAddon(a), i.open(r.value), requestAnimationFrame(() => i && a.fit()), document.fonts && document.fonts.load("12px 'JetBrains Mono'").then(() => i && a.fit()).catch(() => {}), o = new ResizeObserver(() => {
				i && a.fit();
			}), o.observe(r.value), i.attachCustomKeyEventHandler(p), f(t.text || "");
		}), j(() => t.text, (e) => f(e || "")), j(() => t.dark, (e) => {
			i && (i.options.theme = c(e));
		}), x(() => {
			o && o.disconnect(), i && i.dispose(), o = null, i = null;
		}), (t, n) => (C(), d("div", {
			ref_key: "host",
			ref: r,
			class: v(["term", { deeper: e.dark }]),
			style: b(e.height ? {
				height: e.height,
				flex: "0 0 auto"
			} : null)
		}, null, 6));
	}
}, [["__scopeId", "data-v-6c5d0f49"]]), B = { class: "node" }, V = ["title"], H = {
	key: 0,
	class: "kids"
}, U = {
	key: 0,
	class: "hint"
}, ee = {
	key: 1,
	class: "hint bad"
}, W = {
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
		let n = e, r = t, i = T(!1), a = T(!1), s = T(""), c = T(null);
		j(() => n.selected === n.node.path, (e) => {
			e && _(() => c.value && c.value.scrollIntoView({ block: "nearest" }));
		}, { immediate: !0 });
		async function h() {
			r("pick", n.node), i.value || (i.value = !0, await y());
		}
		async function g() {
			i.value = !i.value, i.value && await y();
		}
		async function y() {
			if (!(n.node.children || a.value)) {
				a.value = !0, s.value = "";
				try {
					let e = await n.loader(n.node.path);
					n.node.children = e.entries;
				} catch (e) {
					s.value = e.message;
				} finally {
					a.value = !1;
				}
			}
		}
		return (t, n) => {
			let r = O("v-icon"), _ = O("v-btn"), y = O("DirectoryNode", !0);
			return C(), d("div", B, [f("div", {
				ref_key: "rowEl",
				ref: c,
				class: v(["row", { selected: e.node.path === e.selected }]),
				onClick: h
			}, [
				m(_, {
					icon: !0,
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: i.value ? "收起" : "展开",
					onClick: F(g, ["stop"])
				}, {
					default: N(() => [m(r, { size: "18" }, {
						default: N(() => [p(k(i.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"]),
				m(r, {
					size: "18",
					class: "folder"
				}, {
					default: N(() => [...n[1] ||= [p("mdi-folder-outline", -1)]]),
					_: 1
				}),
				f("span", {
					class: "label",
					title: e.node.path
				}, k(e.node.name), 9, V)
			], 2), i.value ? (C(), d("div", H, [a.value ? (C(), d("p", U, "正在读取…")) : s.value ? (C(), d("p", ee, k(s.value), 1)) : e.node.children ? (C(), d(o, { key: 2 }, [(C(!0), d(o, null, E(e.node.children, (r) => (C(), l(y, {
				key: r.path,
				node: r,
				selected: e.selected,
				loader: e.loader,
				onPick: n[0] ||= (e) => t.$emit("pick", e)
			}, null, 8, [
				"node",
				"selected",
				"loader"
			]))), 128)), e.node.children.length ? u("", !0) : (C(), d("p", W, "没有子目录"))], 64)) : u("", !0)])) : u("", !0)]);
		};
	}
}, [["__scopeId", "data-v-3e5909ab"]]), K = { class: "picker" }, q = {
	key: 0,
	class: "tip"
}, J = { class: "tree" }, Y = { class: "root" }, X = ["title"], Z = {
	key: 0,
	class: "hint bad"
}, te = {
	key: 0,
	class: "hint"
}, Q = /*#__PURE__*/ e({
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
		let n = e, r = t, i = T(""), a = T(null), s = T(!0), h = T(""), g = c({
			get: () => n.modelValue,
			set: (e) => r("update:modelValue", e)
		}), _ = c(() => {
			let e = String(n.modelValue || "").trim();
			return e === "~" ? e = i.value : e.startsWith("~/") && (e = i.value + e.slice(1)), e.replace(/\/+$/, "");
		}), v = c(() => !i.value || !_.value ? !1 : n.validate ? !!n.validate(_.value, i.value) : _.value === i.value || _.value.startsWith(i.value + "/"));
		M(() => r("update:valid", v.value));
		function y(e) {
			g.value = e.path;
		}
		return S(async () => {
			try {
				let e = await n.loader();
				i.value = e.home, a.value = e.entries.map((e) => ({
					...e,
					children: null
				}));
			} catch (e) {
				h.value = e.message;
			} finally {
				s.value = !1;
			}
		}), (t, n) => {
			let r = O("v-text-field"), c = O("v-icon"), b = O("v-progress-circular");
			return C(), d("div", K, [
				e.tip ? (C(), d("p", q, k(e.tip), 1)) : u("", !0),
				m(r, {
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
				f("div", J, [f("div", Y, [
					m(c, { size: "18" }, {
						default: N(() => [...n[1] ||= [p("mdi-home-outline", -1)]]),
						_: 1
					}),
					f("span", {
						class: "root-label",
						title: i.value || "~"
					}, "~", 8, X),
					s.value ? (C(), l(b, {
						key: 0,
						size: "12",
						width: "2",
						indeterminate: ""
					})) : u("", !0)
				]), h.value ? (C(), d("p", Z, k(h.value), 1)) : a.value ? (C(), d(o, { key: 1 }, [(C(!0), d(o, null, E(a.value, (t) => (C(), l(G, {
					key: t.path,
					node: t,
					selected: _.value,
					loader: e.loader,
					onPick: y
				}, null, 8, [
					"node",
					"selected",
					"loader"
				]))), 128)), a.value.length ? u("", !0) : (C(), d("p", te, "家目录下没有子目录"))], 64)) : u("", !0)])
			]);
		};
	}
}, [["__scopeId", "data-v-39d6d557"]]), $ = {
	icon: "mdi-file-outline",
	color: ""
}, ne = {
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
}, re = {
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
function ie(e) {
	let t = String(e || "").split("/").pop().toLowerCase(), n = ne[t];
	if (n) return n;
	let r = t.lastIndexOf(".");
	return r < 0 ? $ : re[t.slice(r + 1)] || $;
}
// src/components/FileTree/FileTreeNode.vue
var ae = { class: "branch" }, oe = {
	key: 1,
	class: "arrow-space"
}, se = ["title"], ce = {
	key: 0,
	class: "hint"
}, le = {
	key: 1,
	class: "hint bad"
}, ue = {
	key: 2,
	class: "hint"
}, de = {
	key: 0,
	class: "hint"
}, fe = /*#__PURE__*/ e({
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
		}, a = c(() => ({
			...i,
			...n.texts
		})), s = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, h = c(() => n.keyOf(n.node)), _ = c(() => n.dirOf(n.node)), y = c(() => n.expanded[h.value] === !0), x = c(() => n.cache[h.value] || s), S = c(() => _.value ? null : ie(n.nameOf(n.node))), w = c(() => _.value ? y.value ? "mdi-folder-open-outline" : "mdi-folder-outline" : S.value.icon), T = c(() => _.value ? null : S.value.color ? { color: S.value.color } : null);
		function A() {
			n.pickOnRowClick && (_.value ? r("toggle", h.value) : r("pick", n.node));
		}
		function j(e) {
			r("context", {
				node: n.node,
				event: e
			});
		}
		return (t, n) => {
			let i = O("v-icon"), s = O("v-btn"), c = O("FileTreeNode", !0);
			return C(), d("div", ae, [f("div", {
				class: v(["row", [e.rowClass ? e.rowClass(e.node) : null, { clickable: e.pickOnRowClick }]]),
				style: b({ paddingLeft: 4 + e.depth * 14 + "px" }),
				onClick: A,
				onContextmenu: F(j, ["prevent", "stop"])
			}, [
				_.value ? (C(), l(s, {
					key: 0,
					icon: "",
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: y.value ? "收起" : "展开",
					onClick: n[0] ||= F((e) => r("toggle", h.value), ["stop"])
				}, {
					default: N(() => [m(i, { size: "16" }, {
						default: N(() => [p(k(y.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"])) : (C(), d("span", oe)),
				m(i, {
					size: "16",
					class: v(_.value ? "folder" : "file"),
					style: b(T.value)
				}, {
					default: N(() => [p(k(w.value), 1)]),
					_: 1
				}, 8, ["class", "style"]),
				D(t.$slots, "row-before-label", {
					node: e.node,
					open: y.value,
					state: x.value
				}, void 0, !0),
				f("span", {
					class: v(["label", e.labelClass]),
					title: h.value
				}, k(e.nameOf(e.node)), 11, se),
				D(t.$slots, "row-after-label", {
					node: e.node,
					open: y.value,
					state: x.value
				}, void 0, !0)
			], 38), _.value && y.value ? (C(), d(o, { key: 0 }, [x.value.loading ? (C(), d("p", ce, k(a.value.loading), 1)) : x.value.error ? (C(), d("p", le, k(x.value.error), 1)) : x.value.entries.length ? (C(), d(o, { key: 3 }, [(C(!0), d(o, null, E(x.value.entries, (i) => (C(), l(c, {
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
				"row-before-label": N((e) => [D(t.$slots, "row-before-label", g({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": N((e) => [D(t.$slots, "row-after-label", g({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), x.value.truncated ? (C(), d("p", de, k(a.value.truncated), 1)) : u("", !0)], 64)) : (C(), d("p", ue, k(a.value.empty), 1))], 64)) : u("", !0)]);
		};
	}
}, [["__scopeId", "data-v-84c4665e"]]);
// src/utils/clipboard.js
async function pe(e) {
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
// src/components/FileTree/FileTree.vue
var me = { class: "file-tree" }, he = {
	key: 0,
	class: "hint"
}, ge = {
	key: 1,
	class: "hint bad"
}, _e = {
	key: 2,
	class: "hint"
}, ve = {
	key: 0,
	class: "hint"
}, ye = ["disabled"], be = /*#__PURE__*/ e({
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
		texts: {
			type: Object,
			default: () => ({})
		}
	},
	emits: ["pick"],
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
			copied: "已复制"
		}, v = c(() => ({
			...a,
			...r.texts
		})), A = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, M = w({}), P = w({}), I = T(!1), L = c(() => r.root ? r.keyOf(r.root) : ""), R = c(() => P[L.value] || A);
		async function z(e, t = !1) {
			if (!t && P[e]) return;
			P[e] || (P[e] = {
				loading: !1,
				error: "",
				entries: [],
				truncated: !1
			});
			let n = P[e];
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
			M[e] = !M[e], M[e] && z(e);
		}
		async function V(e) {
			M[L.value] = !0, await z(L.value);
			let t = L.value;
			for (let n of String(e || "").split("/").filter(Boolean)) t = t ? `${t}/${n}` : n, await z(t), M[t] = !0;
		}
		function H() {
			for (let e of Object.keys(P)) delete P[e];
			for (let e of Object.keys(M)) delete M[e];
			M[L.value] = !0, z(L.value);
		}
		async function U(e) {
			await z(e, !0);
		}
		async function ee() {
			await Promise.all(Object.keys(P).map((e) => z(e, !0)));
		}
		function W() {
			r.active && !I.value && (I.value = !0, M[L.value] = !0, z(L.value));
		}
		r.active && W(), S(W), j(() => r.active, (e) => {
			e && W();
		});
		let G = w({
			open: !1,
			x: 0,
			y: 0,
			node: null,
			copied: ""
		}), K = T(null), q = 0, J = c(() => G.node ? String(r.keyOf(G.node) || "") : ""), Y = c(() => {
			if (!G.node || !r.rootPath) return "";
			let e = r.rootPath.replace(/\/+$/, ""), t = J.value;
			return t ? `${e}/${t}` : e;
		}), X = c(() => G.node ? r.dirOf(G.node) : !1);
		function Z({ node: e, event: t }) {
			G.node = e, G.copied = "", G.x = t.clientX, G.y = t.clientY, G.open = !0, _(te);
		}
		function te() {
			if (!K.value) return;
			let e = K.value.offsetWidth, t = K.value.offsetHeight;
			G.x = Math.max(6, Math.min(G.x, window.innerWidth - e - 6)), G.y = Math.max(6, Math.min(G.y, window.innerHeight - t - 6));
		}
		function Q() {
			G.open = !1, G.node = null, G.copied = "", clearTimeout(q);
		}
		async function $(e) {
			let t = e === "abs" ? Y.value : J.value;
			t && await pe(t) && (G.copied = e, clearTimeout(q), q = setTimeout(Q, 700));
		}
		function ne() {
			if (!G.node || !r.downloadOf) return;
			let e = G.node, t = r.downloadOf(e);
			if (Q(), !t) return;
			let n = r.nameOf(e) || "download", i = document.createElement("a");
			i.href = t, i.download = r.dirOf(e) ? `${n}.zip` : n, i.rel = "noopener", i.style.display = "none", document.body.appendChild(i), i.click(), i.remove();
		}
		function re(e) {
			K.value && !K.value.contains(e.target) && Q();
		}
		function ie(e) {
			e.key === "Escape" && Q();
		}
		function ae() {
			G.open && Q();
		}
		function oe(e) {
			let t = e ? "addEventListener" : "removeEventListener";
			document[t]("mousedown", re, !0), document[t]("keydown", ie, !0), window[t]("scroll", ae, !0), window[t]("resize", ae);
		}
		return j(() => G.open, (e) => oe(e)), x(() => {
			Q(), oe(!1);
		}), t({
			reveal: V,
			reload: H,
			reloadDir: U,
			refreshAll: ee,
			toggle: B
		}), (t, n) => {
			let r = O("v-icon");
			return C(), d("div", me, [e.root ? (C(), l(fe, {
				key: 0,
				node: e.root,
				depth: 0,
				expanded: M,
				cache: P,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: B,
				onPick: n[0] ||= (e) => i("pick", e),
				onContext: Z
			}, {
				"row-before-label": N((e) => [D(t.$slots, "row-before-label", y(h(e)), void 0, !0)]),
				"row-after-label": N((e) => [D(t.$slots, "row-after-label", y(h(e)), void 0, !0)]),
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
			])) : (C(), d(o, { key: 1 }, [R.value.loading ? (C(), d("p", he, k(v.value.rootLoading), 1)) : R.value.error ? (C(), d("p", ge, k(R.value.error), 1)) : R.value.entries.length ? (C(), d(o, { key: 3 }, [(C(!0), d(o, null, E(R.value.entries, (r) => (C(), l(fe, {
				key: e.keyOf(r),
				node: r,
				depth: 0,
				expanded: M,
				cache: P,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: B,
				onPick: n[1] ||= (e) => i("pick", e),
				onContext: Z
			}, {
				"row-before-label": N((e) => [D(t.$slots, "row-before-label", g({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": N((e) => [D(t.$slots, "row-after-label", g({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), R.value.truncated ? (C(), d("p", ve, k(v.value.truncated), 1)) : u("", !0)], 64)) : (C(), d("p", _e, k(v.value.rootEmpty), 1))], 64)), (C(), l(s, { to: "body" }, [G.open ? (C(), d("div", {
				key: 0,
				ref_key: "menuRef",
				ref: K,
				class: "ft-menu",
				style: b({
					left: G.x + "px",
					top: G.y + "px"
				}),
				onContextmenu: n[4] ||= F(() => {}, ["prevent"])
			}, [
				f("button", {
					class: "ft-item",
					type: "button",
					disabled: !J.value,
					onClick: n[2] ||= (e) => $("rel")
				}, [m(r, { size: "16" }, {
					default: N(() => [...n[5] ||= [p("mdi-content-copy", -1)]]),
					_: 1
				}), f("span", null, k(G.copied === "rel" ? v.value.copied : v.value.copyRel), 1)], 8, ye),
				e.rootPath ? (C(), d("button", {
					key: 0,
					class: "ft-item",
					type: "button",
					onClick: n[3] ||= (e) => $("abs")
				}, [m(r, { size: "16" }, {
					default: N(() => [...n[6] ||= [p("mdi-link-variant", -1)]]),
					_: 1
				}), f("span", null, k(G.copied === "abs" ? v.value.copied : v.value.copyAbs), 1)])) : u("", !0),
				e.downloadOf ? (C(), d("button", {
					key: 1,
					class: "ft-item",
					type: "button",
					onClick: ne
				}, [m(r, { size: "16" }, {
					default: N(() => [p(k(X.value ? "mdi-folder-zip-outline" : "mdi-download"), 1)]),
					_: 1
				}), f("span", null, k(X.value ? v.value.downloadDir : v.value.downloadFile), 1)])) : u("", !0)
			], 36)) : u("", !0)]))]);
		};
	}
}, [["__scopeId", "data-v-e8af4780"]]), xe = { class: "edit-body" }, Se = { class: "edit-stage" }, Ce = {
	class: "layer-code",
	"aria-hidden": "true"
}, we = ["innerHTML"], Te = ["value", "onKeydown"], Ee = /*#__PURE__*/ e({
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
		let r = e, i = n, a = T(null), s = T(null), c = T(null);
		function l(e) {
			s.value && (s.value.style.transform = `translate(${-e.scrollLeft}px, ${-e.scrollTop}px)`), a.value && (a.value.scrollTop = e.scrollTop);
		}
		function u(e) {
			l(e.target);
		}
		function p(e) {
			let t = e.target, n = t.selectionStart, a = t.selectionEnd;
			i("update:modelValue", `${r.modelValue.slice(0, n)}    ${r.modelValue.slice(a)}`), _(() => {
				t.selectionStart = n + 4, t.selectionEnd = n + 4;
			});
		}
		function m() {
			let e = c.value;
			e && (e.scrollTop = 0, e.scrollLeft = 0, l(e));
		}
		async function h(e) {
			await _();
			let t = c.value;
			if (!t) return;
			let n = r.modelValue.split("\n"), i = Math.min(Math.max(Number(e) || 1, 1), n.length), a = 0;
			for (let e = 0; e < i - 1; e += 1) a += n[e].length + 1;
			t.focus(), t.setSelectionRange(a, a + n[i - 1].length);
			let o = parseFloat(getComputedStyle(t).lineHeight) || 20;
			t.scrollTop = Math.max(0, (i - 1) * o - t.clientHeight / 3), l(t);
		}
		return t({
			resetScroll: m,
			locate: h
		}), (t, n) => (C(), d("div", xe, [f("div", {
			ref_key: "gutterRef",
			ref: a,
			class: "gutter",
			"aria-hidden": "true"
		}, [(C(!0), d(o, null, E(e.lineCount, (e) => (C(), d("div", {
			key: e,
			class: "ln"
		}, k(e), 1))), 128))], 512), f("div", Se, [f("pre", Ce, [f("code", {
			ref_key: "codeRef",
			ref: s,
			innerHTML: e.highlighted
		}, null, 8, we)]), f("textarea", {
			ref_key: "editorRef",
			ref: c,
			value: e.modelValue,
			class: "editor",
			wrap: "off",
			spellcheck: "false",
			onInput: n[0] ||= (e) => t.$emit("update:modelValue", e.target.value),
			onScroll: u,
			onKeydown: P(F(p, ["prevent"]), ["tab"])
		}, null, 40, Te)])]));
	}
}, [["__scopeId", "data-v-d7e19f41"]]), De = { class: "file-head" }, Oe = { class: "crumbs" }, ke = ["title", "onClick"], Ae = { class: "meta" }, je = /*#__PURE__*/ e({
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
		let n = e, r = t, i = c(() => {
			let e = String(n.path || "").split("/").filter(Boolean), t = "";
			return e.map((e) => (t = t ? `${t}/${e}` : e, {
				name: e,
				path: t
			}));
		}), a = c(() => {
			if (n.size === void 0 || n.size === null) return "";
			let e = Number(n.size) || 0;
			return e < 1024 ? `${e} 字节` : e < 1048576 ? `${(e / 1024).toFixed(1)} KB` : `${(e / 1024 / 1024).toFixed(1)} MB`;
		});
		function s(e, t) {
			t !== i.value.length - 1 && r("navigate", e.path);
		}
		return (t, n) => (C(), d("div", De, [
			f("nav", Oe, [f("button", {
				class: "seg",
				title: "回到根目录",
				onClick: n[0] ||= (e) => r("navigate", "")
			}, k(e.rootName), 1), (C(!0), d(o, null, E(i.value, (e, t) => (C(), d(o, { key: e.path }, [n[1] ||= f("span", { class: "sep" }, "/", -1), f("button", {
				class: v(["seg", { last: t === i.value.length - 1 }]),
				title: e.path,
				onClick: (n) => s(e, t)
			}, k(e.name), 11, ke)], 64))), 128))]),
			D(t.$slots, "actions", {}, void 0, !0),
			f("span", Ae, k(a.value), 1)
		]));
	}
}, [["__scopeId", "data-v-187b69ed"]]), Me = /*#__PURE__*/ e({
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
			let i = O("v-card-title"), a = O("v-card-text"), o = O("v-spacer"), s = O("v-btn"), c = O("v-card-actions"), u = O("v-card"), d = O("v-dialog");
			return C(), l(d, {
				"model-value": e.modelValue,
				"max-width": "440",
				"onUpdate:modelValue": r[2] ||= (e) => !e && n("answer", !1)
			}, {
				default: N(() => [m(u, null, {
					default: N(() => [
						m(i, null, {
							default: N(() => [...r[3] ||= [p("文件还没保存", -1)]]),
							_: 1
						}),
						m(a, null, {
							default: N(() => [p(k(e.path || "当前文件") + " ", 1), r[4] ||= f("p", { class: "tip" }, "换过去之后这次的修改就没了，要保留就先按 Ctrl+S 保存。", -1)]),
							_: 1
						}),
						m(c, null, {
							default: N(() => [
								m(o),
								m(s, {
									variant: "text",
									onClick: r[0] ||= (e) => n("answer", !1)
								}, {
									default: N(() => [...r[5] ||= [p("留在这里", -1)]]),
									_: 1
								}),
								m(s, {
									color: "error",
									variant: "flat",
									onClick: r[1] ||= (e) => n("answer", !0)
								}, {
									default: N(() => [...r[6] ||= [p("丢掉修改", -1)]]),
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
function Ne({ loader: e, saver: r }) {
	let i = T(""), a = w({
		base: "",
		draft: "",
		loading: !1,
		error: "",
		saving: !1,
		saveError: ""
	}), o = 0, s = c(() => a.draft !== a.base), l = c(() => n(i.value)), u = c(() => a.draft.endsWith("\n") ? a.draft.slice(0, -1) : a.draft), d = c(() => a.draft.split("\n").length), f = c(() => t(u.value, l.value));
	async function p(t) {
		i.value = t;
		let n = ++o;
		a.loading = !0, a.error = "", a.saveError = "", a.base = "", a.draft = "";
		try {
			let r = await e(t);
			return n === o && (a.base = (r.text || "").replace(/\r\n?/g, "\n"), a.draft = a.base, !0);
		} catch (e) {
			return n === o && (a.error = e.message), !1;
		} finally {
			n === o && (a.loading = !1);
		}
	}
	async function m() {
		if (a.saving || !s.value || !i.value) return null;
		let e = i.value;
		a.saving = !0, a.saveError = "";
		try {
			let t = await r(e, a.draft);
			return i.value === e && (a.base = a.draft), t;
		} catch (t) {
			return i.value === e && (a.saveError = t.message), null;
		} finally {
			a.saving = !1;
		}
	}
	function h() {
		a.saving || (a.draft = a.base, a.saveError = "");
	}
	function g() {
		o += 1, i.value = "", a.base = "", a.draft = "", a.loading = !1, a.error = "", a.saving = !1, a.saveError = "";
	}
	return {
		path: i,
		state: a,
		dirty: s,
		lineCount: d,
		highlighted: f,
		load: p,
		save: m,
		discard: h,
		reset: g
	};
}
// src/components/FileEditor/FileEditor.vue
var Pe = { class: "file-editor" }, Fe = {
	key: 0,
	class: "actions"
}, Ie = {
	key: 1,
	class: "hint"
}, Le = {
	key: 2,
	class: "hint bad"
}, Re = {
	key: 3,
	class: "edit-wrap"
}, ze = {
	key: 0,
	class: "hint bad edit-error"
}, Be = {
	key: 4,
	class: "none"
}, Ve = /*#__PURE__*/ e({
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
	emits: ["navigate", "saved"],
	setup(e, { expose: t, emit: n }) {
		let r = e, i = n, { path: a, state: o, dirty: s, lineCount: c, highlighted: f, load: h, save: g, discard: v, reset: y } = Ne({
			loader: r.loader,
			saver: r.saver
		}), b = T(null);
		async function S() {
			let e = a.value, t = await g();
			return t && i("saved", {
				path: e,
				data: t
			}), t;
		}
		function w() {
			v();
		}
		let E = T(!1), D = null;
		async function j(e, t = 0) {
			return await h(e) ? (await _(), b.value?.resetScroll(), t && b.value?.locate(t), !0) : !1;
		}
		async function M() {
			return !a.value || !await h(a.value) ? !1 : (await _(), b.value?.resetScroll(), !0);
		}
		function P() {
			L(), y();
		}
		function F() {
			return s.value ? E.value ? Promise.resolve(!1) : (E.value = !0, new Promise((e) => {
				D = e;
			})) : Promise.resolve(!0);
		}
		function I(e) {
			if (E.value = !1, !D) return;
			let t = D;
			D = null, t(e);
		}
		function L() {
			I(!1);
		}
		return x(() => I(!1)), t({
			open: j,
			reload: M,
			close: P,
			save: S,
			discard: w,
			confirmLeave: F,
			cancelLeave: L,
			dirty: s
		}), (t, n) => {
			let r = O("v-chip"), h = O("v-btn");
			return C(), d("section", Pe, [
				A(a) ? (C(), l(je, {
					key: 0,
					"root-name": e.rootName,
					path: A(a),
					size: e.size,
					onNavigate: n[0] ||= (e) => i("navigate", e)
				}, {
					actions: N(() => [A(s) && !A(o).loading ? (C(), d("div", Fe, [
						m(r, {
							size: "x-small",
							variant: "flat",
							color: "modified"
						}, {
							default: N(() => [...n[2] ||= [p("未保存", -1)]]),
							_: 1
						}),
						m(h, {
							size: "small",
							variant: "text",
							color: "primary",
							loading: A(o).saving,
							onClick: S
						}, {
							default: N(() => [...n[3] ||= [p(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"]),
						m(h, {
							size: "small",
							variant: "text",
							disabled: A(o).saving,
							onClick: w
						}, {
							default: N(() => [...n[4] ||= [p(" 放弃 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					])) : u("", !0)]),
					_: 1
				}, 8, [
					"root-name",
					"path",
					"size"
				])) : u("", !0),
				A(o).loading ? (C(), d("p", Ie, "正在读取文件…")) : A(o).error ? (C(), d("p", Le, k(A(o).error), 1)) : A(a) ? (C(), d("div", Re, [A(o).saveError ? (C(), d("p", ze, k(A(o).saveError), 1)) : u("", !0), m(Ee, {
					ref_key: "paneRef",
					ref: b,
					modelValue: A(o).draft,
					"onUpdate:modelValue": n[1] ||= (e) => A(o).draft = e,
					highlighted: A(f),
					"line-count": A(c)
				}, null, 8, [
					"modelValue",
					"highlighted",
					"line-count"
				])])) : (C(), d("div", Be, "从左边选一个文件，右边显示它的内容。")),
				m(Me, {
					"model-value": E.value,
					path: A(a),
					onAnswer: I
				}, null, 8, ["model-value", "path"])
			]);
		};
	}
}, [["__scopeId", "data-v-caf91426"]]);
// src/composables/useDialogLayout.js
function He(e) {
	function t() {
		try {
			let t = JSON.parse(window.localStorage.getItem(e) || "{}");
			return t && typeof t == "object" ? t : {};
		} catch {
			return {};
		}
	}
	function n(e) {
		if (!e) return null;
		let n = t()[e];
		return n && [
			"x",
			"y",
			"w",
			"h"
		].every((e) => Number.isFinite(n[e])) ? {
			x: n.x,
			y: n.y,
			w: n.w,
			h: n.h
		} : null;
	}
	function r(n, r) {
		if (n) try {
			window.localStorage.setItem(e, JSON.stringify({
				...t(),
				[n]: r
			}));
		} catch {}
	}
	return {
		get: n,
		remember: r
	};
}
var Ue = /*#__PURE__*/ e({
	__name: "FloatingDialog",
	props: {
		modelValue: {
			type: Boolean,
			default: !1
		},
		initialWidth: {
			type: Number,
			default: 760
		},
		initialHeight: {
			type: Number,
			default: 620
		},
		minWidth: {
			type: Number,
			default: 480
		},
		minHeight: {
			type: Number,
			default: 380
		},
		storageKey: {
			type: String,
			default: ""
		},
		storage: {
			type: String,
			default: "dialog-layouts"
		}
	},
	emits: ["update:modelValue"],
	setup(e, { emit: t }) {
		let n = e, r = t, i = He(n.storage), a = i.get(n.storageKey), o = T(a ? {
			w: a.w,
			h: a.h
		} : y()), s = T(a ? {
			x: a.x,
			y: a.y
		} : {
			x: 0,
			y: 0
		}), d = T(!!a), p = T(!1), h = null, g = c(() => ({
			position: "fixed",
			left: `${s.value.x}px`,
			top: `${s.value.y}px`,
			margin: "0"
		}));
		function _(e, t, n) {
			return Math.min(Math.max(e, t), n);
		}
		function y() {
			return {
				w: Math.min(n.initialWidth, Math.max(n.minWidth, window.innerWidth - 48)),
				h: Math.min(n.initialHeight, Math.max(n.minHeight, window.innerHeight - 48))
			};
		}
		function b() {
			s.value = {
				x: Math.max(0, Math.round((window.innerWidth - o.value.w) / 2)),
				y: Math.max(0, Math.round((window.innerHeight - o.value.h) / 2))
			};
		}
		function S() {
			s.value = {
				x: _(s.value.x, 0, Math.max(0, window.innerWidth - o.value.w)),
				y: _(s.value.y, 0, Math.max(0, window.innerHeight - o.value.h))
			};
		}
		j(() => n.modelValue, (e) => {
			e && (o.value = {
				w: _(o.value.w, n.minWidth, Math.max(n.minWidth, window.innerWidth - 48)),
				h: _(o.value.h, n.minHeight, Math.max(n.minHeight, window.innerHeight - 48))
			}, d.value ? S() : b());
		}, { immediate: !0 });
		function w(e) {
			e.button === 0 && (e.target.closest("button, a, input, textarea, select, [role=\"button\"]") || (e.preventDefault(), k("move", e)));
		}
		function E(e) {
			e.button === 0 && (e.preventDefault(), k("resize", e));
		}
		function k(e, t) {
			h = {
				mode: e,
				x: t.clientX,
				y: t.clientY,
				px: s.value.x,
				py: s.value.y,
				w: o.value.w,
				h: o.value.h
			}, p.value = !0, document.body.style.userSelect = "none", window.addEventListener("pointermove", A), window.addEventListener("pointerup", M, { once: !0 });
		}
		function A(e) {
			if (!h) return;
			let t = e.clientX - h.x, r = e.clientY - h.y;
			if (d.value = !0, h.mode === "move") {
				s.value = {
					x: _(h.px + t, 0, Math.max(0, window.innerWidth - o.value.w)),
					y: _(h.py + r, 0, Math.max(0, window.innerHeight - o.value.h))
				};
				return;
			}
			let i = Math.max(n.minWidth, Math.min(window.innerWidth - 48, window.innerWidth - s.value.x)), a = Math.max(n.minHeight, Math.min(window.innerHeight - 48, window.innerHeight - s.value.y));
			o.value = {
				w: _(h.w + t, n.minWidth, i),
				h: _(h.h + r, n.minHeight, a)
			};
		}
		function M() {
			let e = h !== null;
			h = null, p.value = !1, document.body.style.userSelect = "", window.removeEventListener("pointermove", A), e && P();
		}
		function P() {
			i.remember(n.storageKey, {
				x: s.value.x,
				y: s.value.y,
				w: o.value.w,
				h: o.value.h
			});
		}
		function F() {
			d.value = !1, b(), P();
		}
		return x(M), (t, n) => {
			let i = O("v-card-title"), a = O("v-card-text"), s = O("v-card-actions"), c = O("v-card"), d = O("v-dialog");
			return C(), l(d, {
				"model-value": e.modelValue,
				width: o.value.w,
				height: o.value.h,
				"content-props": { style: g.value },
				scrollable: "",
				"onUpdate:modelValue": n[0] ||= (e) => r("update:modelValue", e)
			}, {
				default: N(() => [m(c, { class: v(["dialog", { moving: p.value }]) }, {
					default: N(() => [
						m(i, {
							class: "title d-flex align-center",
							title: "拖动标题移动窗口，双击回到屏幕中间",
							onPointerdown: w,
							onDblclick: F
						}, {
							default: N(() => [D(t.$slots, "title", {}, void 0, !0)]),
							_: 3
						}),
						m(a, { class: "body" }, {
							default: N(() => [D(t.$slots, "default", {}, void 0, !0)]),
							_: 3
						}),
						t.$slots.actions ? (C(), l(s, { key: 0 }, {
							default: N(() => [D(t.$slots, "actions", {}, void 0, !0)]),
							_: 3
						})) : u("", !0),
						f("span", {
							class: "resize-grip",
							title: "拖动调整窗口大小",
							onPointerdown: E
						}, null, 32)
					]),
					_: 3
				}, 8, ["class"])]),
				_: 3
			}, 8, [
				"model-value",
				"width",
				"height",
				"content-props"
			]);
		};
	}
}, [["__scopeId", "data-v-b9b19361"]]), We = { class: "list" }, Ge = { class: "head" }, Ke = { class: "head-title" }, qe = {
	key: 0,
	class: "none"
}, Je = { class: "tip" }, Ye = { class: "tip" }, Xe = { class: "tip" }, Ze = /*#__PURE__*/ e({
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
		}
	},
	emits: [
		"select",
		"add",
		"remove",
		"changed",
		"notice"
	],
	setup(e, { emit: t }) {
		let n = e, r = {
			headTitle: "工作区",
			add: "添加",
			empty: "还没有工作区",
			forgetTitle: "移出工作区",
			menuAlias: "设置别名",
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
		}, i = c(() => ({
			...r,
			...n.texts
		})), a = t, s = T(!1), h = T(""), g = T(!1), _ = T(0), v = T(null), y = w({
			open: !1,
			x: 0,
			y: 0,
			ws: null
		}), j = T(!1), M = T(null), I = T(""), L = T(!1);
		function R(e, t) {
			y.x = Math.max(8, Math.min(e.clientX, window.innerWidth - 190)), y.y = Math.max(8, Math.min(e.clientY, window.innerHeight - 130)), y.ws = t, y.open = !0;
		}
		function z() {
			y.open = !1;
		}
		function B(e) {
			M.value = e, I.value = e.alias || "", j.value = !0, z();
		}
		async function V() {
			if (M.value) {
				L.value = !0;
				try {
					await n.saveAlias(M.value.id, (I.value || "").trim()), j.value = !1, a("changed"), a("notice", {
						text: i.value.aliasSaved,
						color: "primary"
					});
				} catch (e) {
					a("notice", {
						text: `${i.value.aliasFailed}${e.message}`,
						color: "error"
					});
				} finally {
					L.value = !1;
				}
			}
		}
		async function H(e, t) {
			let n = t === "rel" && e.rel || e.root, r = await pe(n);
			a("notice", {
				text: r ? `${i.value.copied}${n}` : i.value.copyFailed,
				color: r ? "primary" : "error"
			}), z();
		}
		S(() => {
			document.addEventListener("click", z), document.addEventListener("contextmenu", z), window.addEventListener("resize", z), window.addEventListener("blur", z);
		}), x(() => {
			document.removeEventListener("click", z), document.removeEventListener("contextmenu", z), window.removeEventListener("resize", z), window.removeEventListener("blur", z);
		});
		function U(e) {
			let t = String(e || "").split("/").filter(Boolean);
			return t.length ? t[t.length - 1] : e;
		}
		function ee() {
			h.value = "", g.value = !1, _.value += 1, s.value = !0;
		}
		function W() {
			let e = h.value.trim();
			e && (s.value = !1, a("add", e));
		}
		function G(e) {
			v.value = e;
		}
		function K() {
			let e = v.value;
			v.value = null, e && a("remove", e.id);
		}
		return (t, n) => {
			let r = O("v-btn"), a = O("v-list-item-title"), c = O("v-list-item-subtitle"), x = O("v-icon"), S = O("v-list-item"), w = O("v-list"), T = O("v-card-title"), z = O("v-text-field"), q = O("v-card-text"), J = O("v-spacer"), Y = O("v-card-actions"), X = O("v-card"), Z = O("v-dialog");
			return C(), d("div", We, [
				f("div", Ge, [f("span", Ke, k(i.value.headTitle), 1), m(r, {
					size: "small",
					variant: "text",
					color: "primary",
					"prepend-icon": "mdi-plus",
					loading: e.busy,
					onClick: ee
				}, {
					default: N(() => [p(k(i.value.add), 1)]),
					_: 1
				}, 8, ["loading"])]),
				e.workspaces.length ? u("", !0) : (C(), d("div", qe, k(i.value.empty), 1)),
				m(w, {
					density: "compact",
					nav: "",
					class: "items"
				}, {
					default: N(() => [(C(!0), d(o, null, E(e.workspaces, (o) => (C(), l(S, {
						key: o.id,
						active: o.id === e.current,
						"active-color": "primary",
						onClick: (e) => t.$emit("select", o.id),
						onContextmenu: F((e) => R(e, o), ["prevent", "stop"])
					}, {
						append: N(() => [m(r, {
							icon: !0,
							size: "x-small",
							variant: "text",
							title: i.value.forgetTitle,
							class: "forget",
							onClick: F((e) => G(o), ["stop"])
						}, {
							default: N(() => [m(x, { size: "18" }, {
								default: N(() => [...n[13] ||= [p("mdi-close", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["title", "onClick"])]),
						default: N(() => [m(a, {
							class: "name",
							title: o.alias ? o.root : ""
						}, {
							default: N(() => [p(k(o.alias || U(o.root)) + " ", 1), D(t.$slots, "title-extra", { ws: o }, void 0, !0)]),
							_: 2
						}, 1032, ["title"]), m(c, {
							class: "path",
							title: o.url || o.root
						}, {
							default: N(() => [p(k(o.url || o.root), 1)]),
							_: 2
						}, 1032, ["title"])]),
						_: 2
					}, 1032, [
						"active",
						"onClick",
						"onContextmenu"
					]))), 128))]),
					_: 3
				}),
				y.open ? (C(), d("div", {
					key: 1,
					class: "ctxmenu",
					style: b({
						left: y.x + "px",
						top: y.y + "px"
					}),
					onClick: n[3] ||= F(() => {}, ["stop"])
				}, [
					f("button", {
						type: "button",
						class: "ctxitem",
						onClick: n[0] ||= (e) => B(y.ws)
					}, [m(x, { size: "16" }, {
						default: N(() => [...n[14] ||= [p("mdi-rename-box", -1)]]),
						_: 1
					}), p(k(i.value.menuAlias), 1)]),
					f("button", {
						type: "button",
						class: "ctxitem",
						onClick: n[1] ||= (e) => H(y.ws, "rel")
					}, [m(x, { size: "16" }, {
						default: N(() => [...n[15] ||= [p("mdi-content-copy", -1)]]),
						_: 1
					}), p(k(i.value.copyRel), 1)]),
					f("button", {
						type: "button",
						class: "ctxitem",
						onClick: n[2] ||= (e) => H(y.ws, "abs")
					}, [m(x, { size: "16" }, {
						default: N(() => [...n[16] ||= [p("mdi-content-copy", -1)]]),
						_: 1
					}), p(k(i.value.copyAbs), 1)])
				], 4)) : u("", !0),
				m(Z, {
					modelValue: j.value,
					"onUpdate:modelValue": n[6] ||= (e) => j.value = e,
					"max-width": "460"
				}, {
					default: N(() => [m(X, null, {
						default: N(() => [
							m(T, null, {
								default: N(() => [p(k(i.value.aliasTitle), 1)]),
								_: 1
							}),
							m(q, null, {
								default: N(() => [
									f("p", Je, k(M.value ? M.value.root : ""), 1),
									m(z, {
										modelValue: I.value,
										"onUpdate:modelValue": n[4] ||= (e) => I.value = e,
										label: "别名",
										density: "compact",
										variant: "outlined",
										maxlength: "80",
										clearable: "",
										autofocus: "",
										onKeyup: P(V, ["enter"])
									}, null, 8, ["modelValue"]),
									f("p", Ye, k(i.value.aliasHint), 1)
								]),
								_: 1
							}),
							m(Y, null, {
								default: N(() => [
									m(J),
									m(r, {
										variant: "text",
										onClick: n[5] ||= (e) => j.value = !1
									}, {
										default: N(() => [...n[17] ||= [p("取消", -1)]]),
										_: 1
									}),
									m(r, {
										color: "primary",
										variant: "flat",
										loading: L.value,
										onClick: V
									}, {
										default: N(() => [...n[18] ||= [p(" 保存 ", -1)]]),
										_: 1
									}, 8, ["loading"])
								]),
								_: 1
							})
						]),
						_: 1
					})]),
					_: 1
				}, 8, ["modelValue"]),
				m(Z, {
					modelValue: s.value,
					"onUpdate:modelValue": n[10] ||= (e) => s.value = e,
					"max-width": "620"
				}, {
					default: N(() => [m(X, null, {
						default: N(() => [
							m(T, null, {
								default: N(() => [p(k(i.value.addTitle), 1)]),
								_: 1
							}),
							m(q, null, {
								default: N(() => [(C(), l(A(Q), {
									key: _.value,
									modelValue: h.value,
									"onUpdate:modelValue": n[7] ||= (e) => h.value = e,
									tip: i.value.addTip,
									label: i.value.addLabel,
									placeholder: i.value.addPlaceholder,
									loader: e.dirs,
									"onUpdate:valid": n[8] ||= (e) => g.value = e
								}, null, 8, [
									"modelValue",
									"tip",
									"label",
									"placeholder",
									"loader"
								]))]),
								_: 1
							}),
							m(Y, null, {
								default: N(() => [
									m(J),
									m(r, {
										variant: "text",
										onClick: n[9] ||= (e) => s.value = !1
									}, {
										default: N(() => [...n[19] ||= [p("取消", -1)]]),
										_: 1
									}),
									m(r, {
										color: "primary",
										variant: "flat",
										disabled: !h.value.trim() || !g.value,
										onClick: W
									}, {
										default: N(() => [p(k(i.value.addConfirm), 1)]),
										_: 1
									}, 8, ["disabled"])
								]),
								_: 1
							})
						]),
						_: 1
					})]),
					_: 1
				}, 8, ["modelValue"]),
				m(Z, {
					modelValue: v.value,
					"onUpdate:modelValue": n[12] ||= (e) => v.value = e,
					"max-width": "440"
				}, {
					default: N(() => [m(X, null, {
						default: N(() => [
							m(T, null, {
								default: N(() => [p(k(i.value.removeTitle), 1)]),
								_: 1
							}),
							m(q, null, {
								default: N(() => [p(k(v.value ? v.value.root : "") + " ", 1), f("p", Xe, k(i.value.removeText), 1)]),
								_: 1
							}),
							m(Y, null, {
								default: N(() => [
									m(J),
									m(r, {
										variant: "text",
										onClick: n[11] ||= (e) => v.value = null
									}, {
										default: N(() => [...n[20] ||= [p("取消", -1)]]),
										_: 1
									}),
									m(r, {
										color: "error",
										variant: "flat",
										onClick: K
									}, {
										default: N(() => [p(k(i.value.removeConfirm), 1)]),
										_: 1
									})
								]),
								_: 1
							})
						]),
						_: 1
					})]),
					_: 1
				}, 8, ["modelValue"])
			]);
		};
	}
}, [["__scopeId", "data-v-f2eb90fb"]]), Qe = { class: "brand" }, $e = { class: "shell" }, et = { class: "side" }, tt = { class: "content" }, nt = /*#__PURE__*/ e({
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
		return (t, n) => {
			let a = O("v-app-bar-title"), o = O("v-spacer"), s = O("v-chip"), c = O("v-btn"), d = O("v-app-bar"), h = O("v-main"), _ = O("v-app");
			return C(), l(_, null, {
				default: N(() => [
					m(d, {
						density: "comfortable",
						flat: "",
						border: "b",
						class: "app-bar"
					}, {
						default: N(() => [
							m(a, null, {
								default: N(() => [f("span", Qe, k(e.title), 1)]),
								_: 1
							}),
							m(o),
							e.workspaces.length ? (C(), l(s, {
								key: 0,
								size: "small",
								variant: "tonal",
								class: "running",
								color: e.running ? "ready" : void 0,
								"prepend-icon": "mdi-play-circle-outline",
								title: e.running ? `所有工作区共 ${e.running} 个进程在跑` : "所有工作区都没有在跑的进程"
							}, {
								default: N(() => [p(k(e.running) + " 个在跑 ", 1)]),
								_: 1
							}, 8, ["color", "title"])) : u("", !0),
							D(t.$slots, "metrics", {}, void 0, !0),
							m(c, {
								icon: e.dark ? "mdi-weather-sunny" : "mdi-weather-night",
								variant: "text",
								onClick: e.toggleTheme
							}, null, 8, ["icon", "onClick"])
						]),
						_: 3
					}),
					m(r, {
						modelValue: e.snack.on,
						"onUpdate:modelValue": n[0] ||= (t) => e.snack.on = t,
						text: e.snack.text,
						color: e.snack.color
					}, null, 8, [
						"modelValue",
						"text",
						"color"
					]),
					m(h, { class: "fill-height" }, {
						default: N(() => [f("div", $e, [f("aside", et, [D(t.$slots, "sidebar", {}, void 0, !0)]), f("main", tt, [D(t.$slots, "default", { ws: e.current }, void 0, !0), e.current ? u("", !0) : (C(), l(i, g({ key: 0 }, e.empty, { onAction: n[1] ||= (e) => t.$emit("empty-action") }), null, 16))])])]),
						_: 3
					})
				]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-be211836"]]), rt = { style: { width: "42%" } }, it = { class: "svc-name" }, at = ["title"], ot = ["title"], st = { class: "status-line" }, ct = {
	key: 0,
	class: "meta"
}, lt = {
	key: 1,
	class: "meta"
}, ut = ["title"], dt = {
	key: 1,
	class: "meta"
}, ft = {
	key: 2,
	class: "meta"
}, pt = { class: "ops" }, mt = /*#__PURE__*/ e({
	__name: "ServiceTable",
	props: {
		rows: {
			type: Array,
			required: !0
		},
		nameTitle: {
			type: String,
			required: !0
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
			let r = O("v-chip"), i = O("v-btn"), a = O("v-icon"), s = O("v-table");
			return C(), l(s, {
				density: "compact",
				class: "table"
			}, {
				default: N(() => [f("thead", null, [f("tr", null, [
					f("th", rt, k(e.nameTitle), 1),
					n[0] ||= f("th", null, "参数", -1),
					n[1] ||= f("th", { style: { width: "200px" } }, "状态", -1),
					n[2] ||= f("th", { style: { width: "230px" } }, null, -1)
				])]), f("tbody", null, [(C(!0), d(o, null, E(e.rows, (e) => (C(), d("tr", { key: e.key }, [
					f("td", null, [f("div", it, k(e.title), 1), f("div", {
						class: "svc-path",
						title: e.path
					}, k(e.path), 9, at)]),
					f("td", null, [f("div", {
						class: "cmd",
						title: e.cmd
					}, k(e.cmd), 9, ot)]),
					f("td", null, [f("div", st, [e.live ? (C(), d(o, { key: 0 }, [m(r, {
						size: "small",
						class: "status-chip",
						color: e.color,
						variant: "tonal",
						"prepend-icon": e.icon
					}, {
						default: N(() => [p(k(e.statusText), 1)]),
						_: 2
					}, 1032, ["color", "prepend-icon"]), e.port ? (C(), d("span", ct, "端口 " + k(e.port), 1)) : e.started ? (C(), d("span", lt, k(e.ago), 1)) : u("", !0)], 64)) : e.run ? (C(), d(o, { key: 1 }, [m(r, {
						size: "small",
						class: "status-chip",
						color: e.color,
						variant: "tonal",
						"prepend-icon": e.icon,
						onClick: (n) => t.$emit("log", e)
					}, {
						default: N(() => [p(k(e.statusText), 1)]),
						_: 2
					}, 1032, [
						"color",
						"prepend-icon",
						"onClick"
					]), e.err ? (C(), d("span", {
						key: 0,
						class: "meta err",
						title: e.err
					}, k(e.err), 9, ut)) : e.started ? (C(), d("span", dt, k(e.ago), 1)) : u("", !0)], 64)) : (C(), d("span", ft, "—"))])]),
					f("td", pt, [e.live ? (C(), d(o, { key: 0 }, [m(i, {
						size: "small",
						variant: "text",
						"prepend-icon": "mdi-text-box-outline",
						onClick: (n) => t.$emit("log", e)
					}, {
						default: N(() => [...n[3] ||= [p(" 日志 ", -1)]]),
						_: 1
					}, 8, ["onClick"]), m(i, {
						size: "small",
						color: "error",
						variant: "tonal",
						loading: e.stopping,
						onClick: (n) => t.$emit("stop", e)
					}, {
						default: N(() => [...n[4] ||= [p(" 停止 ", -1)]]),
						_: 1
					}, 8, ["loading", "onClick"])], 64)) : (C(), d(o, { key: 1 }, [
						m(i, {
							size: "small",
							color: "primary",
							variant: "flat",
							disabled: e.blocked,
							loading: e.starting,
							onClick: (n) => t.$emit("start", e)
						}, {
							default: N(() => [p(k(e.action), 1)]),
							_: 2
						}, 1032, [
							"disabled",
							"loading",
							"onClick"
						]),
						m(i, {
							size: "small",
							variant: "text",
							icon: !0,
							title: "参数",
							onClick: (n) => t.$emit("settings", e)
						}, {
							default: N(() => [m(a, { size: "20" }, {
								default: N(() => [...n[5] ||= [p("mdi-tune", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["onClick"]),
						e.run ? (C(), l(i, {
							key: 0,
							size: "small",
							variant: "text",
							"prepend-icon": "mdi-text-box-outline",
							onClick: (n) => t.$emit("log", e)
						}, {
							default: N(() => [...n[6] ||= [p(" 日志 ", -1)]]),
							_: 1
						}, 8, ["onClick"])) : u("", !0)
					], 64)), D(t.$slots, "row-extra", { row: e }, void 0, !0)])
				]))), 128))])]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-2d68a0ec"]]), ht = { class: "log-head" }, gt = { class: "log-box" }, _t = {
	key: 1,
	class: "log-empty"
}, vt = /*#__PURE__*/ e({
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
			let r = O("v-spacer"), i = O("v-btn");
			return C(), d(o, null, [f("div", ht, [
				n[2] ||= f("span", { class: "label" }, "日志", -1),
				m(r),
				e.more ? (C(), l(i, {
					key: 0,
					size: "small",
					variant: "text",
					"prepend-icon": "mdi-history",
					onClick: n[0] ||= (e) => t.$emit("load-more")
				}, {
					default: N(() => [...n[1] ||= [p(" 更早 ", -1)]]),
					_: 1
				})) : u("", !0)
			]), f("div", gt, [e.text ? (C(), l(z, {
				key: 0,
				text: e.text,
				dark: e.dark,
				colorize: e.colorize
			}, null, 8, [
				"text",
				"dark",
				"colorize"
			])) : (C(), d("p", _t, k(e.emptyText), 1))])], 64);
		};
	}
}, [["__scopeId", "data-v-71e338f5"]]), yt = ["title"], bt = /*#__PURE__*/ e({
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
		return (t, n) => (C(), d("div", {
			class: v(["handle", [e.axis, {
				active: !e.disabled && e.active,
				disabled: e.disabled
			}]]),
			title: e.disabled ? "" : e.title,
			onPointerdown: i,
			onDblclick: a
		}, [...n[0] ||= [f("span", { class: "grip" }, null, -1)]], 42, yt));
	}
}, [["__scopeId", "data-v-84f2ac99"]]), xt = "web-shared-resizing";
function St({ area: e, initial: t, min: n = 0, max: r = 100, rightMin: i = 0, axis: a = "x", unit: o = "px", persist: s = "" }) {
	let c = T(f()), l = T(!1), u = 0, d = 0;
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
		l.value && (l.value = !1, window.removeEventListener("pointermove", m), document.body.classList.remove(xt));
	}
	function g(t) {
		t.button === 0 && e.value && (l.value = !0, u = a === "x" ? t.clientX : t.clientY, d = c.value, t.preventDefault(), document.body.classList.add(xt), window.addEventListener("pointermove", m), window.addEventListener("pointerup", h, { once: !0 }));
	}
	function _() {
		c.value = t;
	}
	return j(c, (e) => {
		if (s) try {
			window.localStorage.setItem(s, String(e));
		} catch {}
	}), x(h), {
		size: c,
		resizing: l,
		start: g,
		stop: h,
		reset: _
	};
}
// src/composables/useFileTree.js
function Ct(e, t = () => ({})) {
	let n = w({});
	function r() {
		let t = typeof e == "function" ? e() : A(e);
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
	let s = c(() => o(i(r()), 0));
	function l(e) {
		n[e] = !n[e];
	}
	return {
		rows: s,
		collapsed: n,
		toggle: l
	};
}
// src/composables/useRunLog.js
function wt({ api: e, ws: t, statusText: n = {} }) {
	let r = T(""), i = T(!1), a = T(0), o = T(""), s = T(""), c = T(""), l = null;
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
	return j(t, (e) => {
		if (!c.value || !e) return;
		let t = (e.services || []).find((e) => e.id === c.value);
		t && t.run && (o.value = n[t.run.status] || t.run.status);
	}), x(u), {
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
// src/utils/serviceStatus.js
var Tt = ["starting", "ready"];
function Et(e, t = Tt) {
	return (e.services || []).filter((e) => e.run && t.includes(e.run.status)).length;
}
// src/composables/useWorkspaceState.js
function Dt({ api: e, storageKey: t, extraState: n = {}, loadExtra: r = null, addedNotice: i = "已添加" }) {
	let o = w({
		workspaces: [],
		...n
	}), s = R(t, "", { writeDefaults: !1 }), l = T(!1), u = T(null), { snack: d, toast: f } = a(), p = null, m = 0, h = c(() => o.workspaces.find((e) => e.id === s.value) || null), g = c(() => o.workspaces.reduce((e, t) => e + Et(t), 0));
	function _(e) {
		s.value = e || "";
	}
	function v(e) {
		o.workspaces = e.workspaces || [], s.value && !h.value && _("");
	}
	async function y() {
		if (!m) try {
			v(await e.state());
		} catch {}
	}
	function b() {
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
	function x() {
		p &&= (p.close(), null);
	}
	async function S() {
		if (r) try {
			await r(o);
		} catch {}
	}
	async function C(e, t) {
		m += 1;
		try {
			return await t();
		} catch (t) {
			return f(`${e}失败：${t.message}`, "error"), null;
		} finally {
			--m, y();
		}
	}
	async function E(t) {
		let n = typeof t == "string" ? t : "";
		l.value = !0;
		let r = await C("添加工作区", async () => (await e.addWorkspace(n), !0));
		if (l.value = !1, !r) return;
		await y();
		let a = o.workspaces.find((e) => e.root === n || e.root === n.replace(/\/+$/, ""));
		a && _(a.id), f(i, "primary");
	}
	async function D(t) {
		await C("移出工作区", async () => (await e.forgetWorkspace(t), !0)) && (s.value === t && _(""), f("已移出，在跑的进程一并停了"));
	}
	async function O() {
		h.value && await C("重新扫描", () => e.rescan(h.value.id));
	}
	async function k(t) {
		await C("启动", () => e.start(t)) && f("已发出启动", "primary");
	}
	async function A(t) {
		await C("停止", () => e.stop(t)) && f("已停止");
	}
	async function j(t) {
		await C("保存参数", () => e.update(t)) && f("参数已保存", "primary");
	}
	async function M() {
		b(), await y(), S();
	}
	return {
		state: o,
		current: h,
		currentId: s,
		adding: l,
		snack: d,
		toast: f,
		metrics: u,
		running: g,
		select: _,
		refresh: y,
		act: C,
		start: M,
		disconnect: x,
		addWorkspace: E,
		removeWorkspace: D,
		rescan: O,
		startService: k,
		stopService: A,
		saveService: j
	};
}
export { G as DirectoryNode, Q as DirectoryPicker, Ve as FileEditor, be as FileTree, Ue as FloatingDialog, Tt as LIVE_STATUSES, z as LogView, vt as RunLogPanel, mt as ServiceTable, bt as SplitHandle, Ze as WorkspaceList, nt as WorkspaceShell, pe as copyText, ie as fileIcon, Et as runningCount, Ct as useFileTree, wt as useRunLog, St as useSplitPane, Dt as useWorkspaceState };
