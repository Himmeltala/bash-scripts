import { t as e } from "./_plugin-vue_export-helper.js";
import { languageOf as t } from "./highlight.js";
import { n, r, t as i } from "./useToast.js";
import { Fragment as a, Teleport as o, computed as s, createBlock as c, createCommentVNode as l, createElementBlock as u, createElementVNode as d, createTextVNode as f, createVNode as p, guardReactiveProps as m, mergeProps as h, nextTick as g, normalizeClass as _, normalizeProps as v, normalizeStyle as y, onBeforeUnmount as b, onMounted as x, openBlock as S, reactive as C, ref as w, renderList as T, renderSlot as E, resolveComponent as D, resolveDynamicComponent as O, shallowRef as k, toDisplayString as A, unref as j, vShow as M, watch as N, watchEffect as P, withCtx as F, withDirectives as I, withKeys as L, withModifiers as R } from "vue";
import { Terminal as z } from "@xterm/xterm";
import { FitAddon as ee } from "@xterm/addon-fit";
import { useLocalStorage as B } from "@vueuse/core";
var V = /*#__PURE__*/ e({
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
		}, r = w(null), i = null, a = null, o = null, s = "";
		function c(e) {
			return e ? n.deeper : n.normal;
		}
		function l(e) {
			return t.colorize(e);
		}
		function d(e, t) {
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
					s = e, d(e, n);
				} else s = e, d(e);
			}
		}
		function p(e) {
			return e.type !== "keydown" || e.altKey || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "c" || !i.hasSelection() ? !0 : (navigator.clipboard?.writeText(i.getSelection()).catch(() => {}), !1);
		}
		return x(() => {
			i = new z({
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
			}), o.observe(r.value), i.attachCustomKeyEventHandler(p), f(t.text || "");
		}), N(() => t.text, (e) => f(e || "")), N(() => t.dark, (e) => {
			i && (i.options.theme = c(e));
		}), b(() => {
			o && o.disconnect(), i && i.dispose(), o = null, i = null;
		}), (t, n) => (S(), u("div", {
			ref_key: "host",
			ref: r,
			class: _(["term", { deeper: e.dark }]),
			style: y(e.height ? {
				height: e.height,
				flex: "0 0 auto"
			} : null)
		}, null, 6));
	}
}, [["__scopeId", "data-v-be16b898"]]), te = { class: "node" }, ne = ["title"], re = {
	key: 0,
	class: "kids"
}, H = {
	key: 0,
	class: "hint"
}, U = {
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
		let n = e, r = t, i = w(!1), o = w(!1), s = w(""), m = w(null);
		N(() => n.selected === n.node.path, (e) => {
			e && g(() => m.value && m.value.scrollIntoView({ block: "nearest" }));
		}, { immediate: !0 });
		async function h() {
			r("pick", n.node), i.value || (i.value = !0, await y());
		}
		async function v() {
			i.value = !i.value, i.value && await y();
		}
		async function y() {
			if (!(n.node.children || o.value)) {
				o.value = !0, s.value = "";
				try {
					let e = await n.loader(n.node.path);
					n.node.children = e.entries;
				} catch (e) {
					s.value = e.message;
				} finally {
					o.value = !1;
				}
			}
		}
		return (t, n) => {
			let r = D("v-icon"), g = D("v-btn"), y = D("DirectoryNode", !0);
			return S(), u("div", te, [d("div", {
				ref_key: "rowEl",
				ref: m,
				class: _(["row", { selected: e.node.path === e.selected }]),
				onClick: h
			}, [
				p(g, {
					icon: !0,
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: i.value ? "收起" : "展开",
					onClick: R(v, ["stop"])
				}, {
					default: F(() => [p(r, { size: "18" }, {
						default: F(() => [f(A(i.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"]),
				p(r, {
					size: "18",
					class: "folder"
				}, {
					default: F(() => [...n[1] ||= [f("mdi-folder-outline", -1)]]),
					_: 1
				}),
				d("span", {
					class: "label",
					title: e.node.path
				}, A(e.node.name), 9, ne)
			], 2), i.value ? (S(), u("div", re, [o.value ? (S(), u("p", H, "正在读取…")) : s.value ? (S(), u("p", U, A(s.value), 1)) : e.node.children ? (S(), u(a, { key: 2 }, [(S(!0), u(a, null, T(e.node.children, (r) => (S(), c(y, {
				key: r.path,
				node: r,
				selected: e.selected,
				loader: e.loader,
				onPick: n[0] ||= (e) => t.$emit("pick", e)
			}, null, 8, [
				"node",
				"selected",
				"loader"
			]))), 128)), e.node.children.length ? l("", !0) : (S(), u("p", W, "没有子目录"))], 64)) : l("", !0)])) : l("", !0)]);
		};
	}
}, [["__scopeId", "data-v-9e855642"]]), ie = { class: "picker" }, K = {
	key: 0,
	class: "tip"
}, q = { class: "tree" }, J = { class: "root" }, Y = ["title"], X = {
	key: 0,
	class: "hint bad"
}, ae = {
	key: 0,
	class: "hint"
}, oe = /*#__PURE__*/ e({
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
		let n = e, r = t, i = w(""), o = w(null), m = w(!0), h = w(""), g = s({
			get: () => n.modelValue,
			set: (e) => r("update:modelValue", e)
		}), _ = s(() => {
			let e = String(n.modelValue || "").trim();
			return e === "~" ? e = i.value : e.startsWith("~/") && (e = i.value + e.slice(1)), e.replace(/\/+$/, "");
		}), v = s(() => !i.value || !_.value ? !1 : n.validate ? !!n.validate(_.value, i.value) : _.value === i.value || _.value.startsWith(i.value + "/"));
		P(() => r("update:valid", v.value));
		function y(e) {
			g.value = e.path;
		}
		return x(async () => {
			try {
				let e = await n.loader();
				i.value = e.home, o.value = e.entries.map((e) => ({
					...e,
					children: null
				}));
			} catch (e) {
				h.value = e.message;
			} finally {
				m.value = !1;
			}
		}), (t, n) => {
			let r = D("v-text-field"), s = D("v-icon"), b = D("v-progress-circular");
			return S(), u("div", ie, [
				e.tip ? (S(), u("p", K, A(e.tip), 1)) : l("", !0),
				p(r, {
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
				d("div", q, [d("div", J, [
					p(s, { size: "18" }, {
						default: F(() => [...n[1] ||= [f("mdi-home-outline", -1)]]),
						_: 1
					}),
					d("span", {
						class: "root-label",
						title: i.value || "~"
					}, "~", 8, Y),
					m.value ? (S(), c(b, {
						key: 0,
						size: "12",
						width: "2",
						indeterminate: ""
					})) : l("", !0)
				]), h.value ? (S(), u("p", X, A(h.value), 1)) : o.value ? (S(), u(a, { key: 1 }, [(S(!0), u(a, null, T(o.value, (t) => (S(), c(G, {
					key: t.path,
					node: t,
					selected: _.value,
					loader: e.loader,
					onPick: y
				}, null, 8, [
					"node",
					"selected",
					"loader"
				]))), 128)), o.value.length ? l("", !0) : (S(), u("p", ae, "家目录下没有子目录"))], 64)) : l("", !0)])
			]);
		};
	}
}, [["__scopeId", "data-v-a4b93ef9"]]), Z = {
	icon: "mdi-file-outline",
	color: ""
}, se = {
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
}, Q = {
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
function ce(e) {
	let t = String(e || "").split("/").pop().toLowerCase(), n = se[t];
	if (n) return n;
	let r = t.lastIndexOf(".");
	return r < 0 ? Z : Q[t.slice(r + 1)] || Z;
}
// src/components/commons/FileTree/FileTreeNode.vue
var le = { class: "branch" }, ue = {
	key: 1,
	class: "arrow-space"
}, de = ["title"], fe = {
	key: 0,
	class: "hint"
}, $ = {
	key: 1,
	class: "hint bad"
}, pe = {
	key: 2,
	class: "hint"
}, me = {
	key: 0,
	class: "hint"
}, he = /*#__PURE__*/ e({
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
		}, o = s(() => ({
			...i,
			...n.texts
		})), m = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, g = s(() => n.keyOf(n.node)), v = s(() => n.dirOf(n.node)), b = s(() => n.expanded[g.value] === !0), x = s(() => n.cache[g.value] || m), C = s(() => v.value ? null : ce(n.nameOf(n.node))), w = s(() => v.value ? b.value ? "mdi-folder-open-outline" : "mdi-folder-outline" : C.value.icon), O = s(() => v.value ? null : C.value.color ? { color: C.value.color } : null);
		function k() {
			n.pickOnRowClick && (v.value ? r("toggle", g.value) : r("pick", n.node));
		}
		function j(e) {
			r("context", {
				node: n.node,
				event: e
			});
		}
		return (t, n) => {
			let i = D("v-icon"), s = D("v-btn"), m = D("FileTreeNode", !0);
			return S(), u("div", le, [d("div", {
				class: _(["row", [e.rowClass ? e.rowClass(e.node) : null, { clickable: e.pickOnRowClick }]]),
				style: y({ paddingLeft: 4 + e.depth * 14 + "px" }),
				onClick: k,
				onContextmenu: R(j, ["prevent", "stop"])
			}, [
				v.value ? (S(), c(s, {
					key: 0,
					icon: "",
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: b.value ? "收起" : "展开",
					onClick: n[0] ||= R((e) => r("toggle", g.value), ["stop"])
				}, {
					default: F(() => [p(i, { size: "16" }, {
						default: F(() => [f(A(b.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"])) : (S(), u("span", ue)),
				p(i, {
					size: "16",
					class: _(v.value ? "folder" : "file"),
					style: y(O.value)
				}, {
					default: F(() => [f(A(w.value), 1)]),
					_: 1
				}, 8, ["class", "style"]),
				E(t.$slots, "row-before-label", {
					node: e.node,
					open: b.value,
					state: x.value
				}, void 0, !0),
				d("span", {
					class: _(["label", e.labelClass]),
					title: g.value
				}, A(e.nameOf(e.node)), 11, de),
				E(t.$slots, "row-after-label", {
					node: e.node,
					open: b.value,
					state: x.value
				}, void 0, !0)
			], 38), v.value && b.value ? (S(), u(a, { key: 0 }, [x.value.loading ? (S(), u("p", fe, A(o.value.loading), 1)) : x.value.error ? (S(), u("p", $, A(x.value.error), 1)) : x.value.entries.length ? (S(), u(a, { key: 3 }, [(S(!0), u(a, null, T(x.value.entries, (i) => (S(), c(m, {
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
				"row-before-label": F((e) => [E(t.$slots, "row-before-label", h({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": F((e) => [E(t.$slots, "row-after-label", h({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), x.value.truncated ? (S(), u("p", me, A(o.value.truncated), 1)) : l("", !0)], 64)) : (S(), u("p", pe, A(o.value.empty), 1))], 64)) : l("", !0)]);
		};
	}
}, [["__scopeId", "data-v-6aca2f04"]]);
// src/utils/commons/clipboard.js
async function ge(e) {
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
var _e = { class: "file-tree" }, ve = {
	key: 0,
	class: "hint"
}, ye = {
	key: 1,
	class: "hint bad"
}, be = {
	key: 2,
	class: "hint"
}, xe = {
	key: 0,
	class: "hint"
}, Se = ["disabled"], Ce = /*#__PURE__*/ e({
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
		let r = e, i = n, _ = {
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
		}, O = s(() => ({
			..._,
			...r.texts
		})), k = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, j = C({}), M = C({}), P = w(!1), I = s(() => r.root ? r.keyOf(r.root) : ""), L = s(() => M[I.value] || k);
		async function z(e, t = !1) {
			if (!t && M[e]) return;
			M[e] || (M[e] = {
				loading: !1,
				error: "",
				entries: [],
				truncated: !1
			});
			let n = M[e];
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
			j[e] = !j[e], j[e] && z(e);
		}
		async function B(e) {
			j[I.value] = !0, await z(I.value);
			let t = I.value;
			for (let n of String(e || "").split("/").filter(Boolean)) t = t ? `${t}/${n}` : n, await z(t), j[t] = !0;
		}
		function V() {
			for (let e of Object.keys(M)) delete M[e];
			for (let e of Object.keys(j)) delete j[e];
			j[I.value] = !0, z(I.value);
		}
		async function te(e) {
			await z(e, !0);
		}
		async function ne() {
			await Promise.all(Object.keys(M).map((e) => z(e, !0)));
		}
		function re() {
			r.active && !P.value && (P.value = !0, j[I.value] = !0, z(I.value));
		}
		r.active && re(), x(re), N(() => r.active, (e) => {
			e && re();
		});
		let H = C({
			open: !1,
			x: 0,
			y: 0,
			node: null,
			copied: ""
		}), U = w(null), W = 0, G = s(() => H.node ? String(r.keyOf(H.node) || "") : ""), ie = s(() => {
			if (!H.node || !r.rootPath) return "";
			let e = r.rootPath.replace(/\/+$/, ""), t = G.value;
			return t ? `${e}/${t}` : e;
		}), K = s(() => H.node ? r.dirOf(H.node) : !1);
		function q({ node: e, event: t }) {
			H.node = e, H.copied = "", H.x = t.clientX, H.y = t.clientY, H.open = !0, g(J);
		}
		function J() {
			if (!U.value) return;
			let e = U.value.offsetWidth, t = U.value.offsetHeight;
			H.x = Math.max(6, Math.min(H.x, window.innerWidth - e - 6)), H.y = Math.max(6, Math.min(H.y, window.innerHeight - t - 6));
		}
		function Y() {
			H.open = !1, H.node = null, H.copied = "", clearTimeout(W);
		}
		async function X(e) {
			let t = e === "abs" ? ie.value : G.value;
			t && await ge(t) && (H.copied = e, clearTimeout(W), W = setTimeout(Y, 700));
		}
		function ae() {
			if (!H.node || !r.downloadOf) return;
			let e = H.node, t = r.downloadOf(e);
			if (Y(), !t) return;
			let n = r.nameOf(e) || "download", i = document.createElement("a");
			i.href = t, i.download = r.dirOf(e) ? `${n}.zip` : n, i.rel = "noopener", i.style.display = "none", document.body.appendChild(i), i.click(), i.remove();
		}
		function oe(e) {
			U.value && !U.value.contains(e.target) && Y();
		}
		function Z(e) {
			e.key === "Escape" && Y();
		}
		function se() {
			H.open && Y();
		}
		function Q(e) {
			let t = e ? "addEventListener" : "removeEventListener";
			document[t]("mousedown", oe, !0), document[t]("keydown", Z, !0), window[t]("scroll", se, !0), window[t]("resize", se);
		}
		return N(() => H.open, (e) => Q(e)), b(() => {
			Y(), Q(!1);
		}), t({
			reveal: B,
			reload: V,
			reloadDir: te,
			refreshAll: ne,
			toggle: ee
		}), (t, n) => {
			let r = D("v-icon");
			return S(), u("div", _e, [e.root ? (S(), c(he, {
				key: 0,
				node: e.root,
				depth: 0,
				expanded: j,
				cache: M,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: ee,
				onPick: n[0] ||= (e) => i("pick", e),
				onContext: q
			}, {
				"row-before-label": F((e) => [E(t.$slots, "row-before-label", v(m(e)), void 0, !0)]),
				"row-after-label": F((e) => [E(t.$slots, "row-after-label", v(m(e)), void 0, !0)]),
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
			])) : (S(), u(a, { key: 1 }, [L.value.loading ? (S(), u("p", ve, A(O.value.rootLoading), 1)) : L.value.error ? (S(), u("p", ye, A(L.value.error), 1)) : L.value.entries.length ? (S(), u(a, { key: 3 }, [(S(!0), u(a, null, T(L.value.entries, (r) => (S(), c(he, {
				key: e.keyOf(r),
				node: r,
				depth: 0,
				expanded: j,
				cache: M,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: ee,
				onPick: n[1] ||= (e) => i("pick", e),
				onContext: q
			}, {
				"row-before-label": F((e) => [E(t.$slots, "row-before-label", h({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": F((e) => [E(t.$slots, "row-after-label", h({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), L.value.truncated ? (S(), u("p", xe, A(O.value.truncated), 1)) : l("", !0)], 64)) : (S(), u("p", be, A(O.value.rootEmpty), 1))], 64)), (S(), c(o, { to: "body" }, [H.open ? (S(), u("div", {
				key: 0,
				ref_key: "menuRef",
				ref: U,
				class: "ft-menu",
				style: y({
					left: H.x + "px",
					top: H.y + "px"
				}),
				onContextmenu: n[4] ||= R(() => {}, ["prevent"])
			}, [
				d("button", {
					class: "ft-item",
					type: "button",
					disabled: !G.value,
					onClick: n[2] ||= (e) => X("rel")
				}, [p(r, { size: "16" }, {
					default: F(() => [...n[5] ||= [f("mdi-content-copy", -1)]]),
					_: 1
				}), d("span", null, A(H.copied === "rel" ? O.value.copied : O.value.copyRel), 1)], 8, Se),
				e.rootPath ? (S(), u("button", {
					key: 0,
					class: "ft-item",
					type: "button",
					onClick: n[3] ||= (e) => X("abs")
				}, [p(r, { size: "16" }, {
					default: F(() => [...n[6] ||= [f("mdi-link-variant", -1)]]),
					_: 1
				}), d("span", null, A(H.copied === "abs" ? O.value.copied : O.value.copyAbs), 1)])) : l("", !0),
				e.downloadOf ? (S(), u("button", {
					key: 1,
					class: "ft-item",
					type: "button",
					onClick: ae
				}, [p(r, { size: "16" }, {
					default: F(() => [f(A(K.value ? "mdi-folder-zip-outline" : "mdi-download"), 1)]),
					_: 1
				}), d("span", null, A(K.value ? O.value.downloadDir : O.value.downloadFile), 1)])) : l("", !0)
			], 36)) : l("", !0)]))]);
		};
	}
}, [["__scopeId", "data-v-351594dd"]]), we = { class: "file-head" }, Te = { class: "crumbs" }, Ee = ["title", "onClick"], De = { class: "meta" }, Oe = /*#__PURE__*/ e({
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
		let n = e, r = t, i = s(() => {
			let e = String(n.path || "").split("/").filter(Boolean), t = "";
			return e.map((e) => (t = t ? `${t}/${e}` : e, {
				name: e,
				path: t
			}));
		}), o = s(() => {
			if (n.size === void 0 || n.size === null) return "";
			let e = Number(n.size) || 0;
			return e < 1024 ? `${e} 字节` : e < 1048576 ? `${(e / 1024).toFixed(1)} KB` : `${(e / 1024 / 1024).toFixed(1)} MB`;
		});
		function c(e, t) {
			t !== i.value.length - 1 && r("navigate", e.path);
		}
		return (t, n) => (S(), u("div", we, [
			d("nav", Te, [d("button", {
				class: "seg",
				title: "回到根目录",
				onClick: n[0] ||= (e) => r("navigate", "")
			}, A(e.rootName), 1), (S(!0), u(a, null, T(i.value, (e, t) => (S(), u(a, { key: e.path }, [n[1] ||= d("span", { class: "sep" }, "/", -1), d("button", {
				class: _(["seg", { last: t === i.value.length - 1 }]),
				title: e.path,
				onClick: (n) => c(e, t)
			}, A(e.name), 11, Ee)], 64))), 128))]),
			E(t.$slots, "actions", {}, void 0, !0),
			d("span", De, A(o.value), 1)
		]));
	}
}, [["__scopeId", "data-v-0a2775f2"]]);
// src/composables/commons/useDialogLayout.js
function ke(e) {
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
var Ae = /*#__PURE__*/ e({
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
		},
		persistent: {
			type: Boolean,
			default: !1
		}
	},
	emits: ["update:modelValue"],
	setup(e, { emit: t }) {
		let n = e, r = t, i = ke(n.storage), a = i.get(n.storageKey), o = w(a ? {
			w: a.w,
			h: a.h
		} : y()), u = w(a ? {
			x: a.x,
			y: a.y
		} : {
			x: 0,
			y: 0
		}), f = w(!!a), m = w(!1), h = null, g = s(() => ({
			position: "fixed",
			left: `${u.value.x}px`,
			top: `${u.value.y}px`,
			margin: "0"
		}));
		function v(e, t, n) {
			return Math.min(Math.max(e, t), n);
		}
		function y() {
			return {
				w: Math.min(n.initialWidth, Math.max(n.minWidth, window.innerWidth - 48)),
				h: Math.min(n.initialHeight, Math.max(n.minHeight, window.innerHeight - 48))
			};
		}
		function x() {
			u.value = {
				x: Math.max(0, Math.round((window.innerWidth - o.value.w) / 2)),
				y: Math.max(0, Math.round((window.innerHeight - o.value.h) / 2))
			};
		}
		function C() {
			u.value = {
				x: v(u.value.x, 0, Math.max(0, window.innerWidth - o.value.w)),
				y: v(u.value.y, 0, Math.max(0, window.innerHeight - o.value.h))
			};
		}
		N(() => n.modelValue, (e) => {
			e && (o.value = {
				w: v(o.value.w, n.minWidth, Math.max(n.minWidth, window.innerWidth - 48)),
				h: v(o.value.h, n.minHeight, Math.max(n.minHeight, window.innerHeight - 48))
			}, f.value ? C() : x());
		}, { immediate: !0 });
		function T(e) {
			e.button === 0 && (e.target.closest("button, a, input, textarea, select, [role=\"button\"]") || (e.preventDefault(), k("move", e)));
		}
		function O(e) {
			e.button === 0 && (e.preventDefault(), k("resize", e));
		}
		function k(e, t) {
			h = {
				mode: e,
				x: t.clientX,
				y: t.clientY,
				px: u.value.x,
				py: u.value.y,
				w: o.value.w,
				h: o.value.h
			}, m.value = !0, document.body.style.userSelect = "none", window.addEventListener("pointermove", A), window.addEventListener("pointerup", j, { once: !0 });
		}
		function A(e) {
			if (!h) return;
			let t = e.clientX - h.x, r = e.clientY - h.y;
			if (f.value = !0, h.mode === "move") {
				u.value = {
					x: v(h.px + t, 0, Math.max(0, window.innerWidth - o.value.w)),
					y: v(h.py + r, 0, Math.max(0, window.innerHeight - o.value.h))
				};
				return;
			}
			let i = Math.max(n.minWidth, Math.min(window.innerWidth - 48, window.innerWidth - u.value.x)), a = Math.max(n.minHeight, Math.min(window.innerHeight - 48, window.innerHeight - u.value.y));
			o.value = {
				w: v(h.w + t, n.minWidth, i),
				h: v(h.h + r, n.minHeight, a)
			};
		}
		function j() {
			let e = h !== null;
			h = null, m.value = !1, document.body.style.userSelect = "", window.removeEventListener("pointermove", A), e && M();
		}
		function M() {
			i.remember(n.storageKey, {
				x: u.value.x,
				y: u.value.y,
				w: o.value.w,
				h: o.value.h
			});
		}
		function P() {
			f.value = !1, x(), M();
		}
		return b(j), (t, n) => {
			let i = D("v-card-title"), a = D("v-card-text"), s = D("v-card-actions"), u = D("v-card"), f = D("v-dialog");
			return S(), c(f, {
				"model-value": e.modelValue,
				width: o.value.w,
				height: o.value.h,
				"content-props": { style: g.value },
				persistent: e.persistent,
				scrollable: "",
				"onUpdate:modelValue": n[0] ||= (e) => r("update:modelValue", e)
			}, {
				default: F(() => [p(u, { class: _(["dialog", { moving: m.value }]) }, {
					default: F(() => [
						p(i, {
							class: "title d-flex align-center",
							title: "拖动标题移动窗口，双击回到屏幕中间",
							onPointerdown: T,
							onDblclick: P
						}, {
							default: F(() => [E(t.$slots, "title", {}, void 0, !0)]),
							_: 3
						}),
						p(a, { class: "body" }, {
							default: F(() => [E(t.$slots, "default", {}, void 0, !0)]),
							_: 3
						}),
						t.$slots.actions ? (S(), c(s, { key: 0 }, {
							default: F(() => [E(t.$slots, "actions", {}, void 0, !0)]),
							_: 3
						})) : l("", !0),
						d("span", {
							class: "resize-grip",
							title: "拖动调整窗口大小",
							onPointerdown: O
						}, null, 32)
					]),
					_: 3
				}, 8, ["class"])]),
				_: 3
			}, 8, [
				"model-value",
				"width",
				"height",
				"content-props",
				"persistent"
			]);
		};
	}
}, [["__scopeId", "data-v-9daa493b"]]), je = /*#__PURE__*/ e({
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
			let i = D("v-spacer"), a = D("v-btn");
			return S(), c(Ae, {
				"model-value": e.modelValue,
				"initial-width": 440,
				"initial-height": 280,
				"min-width": 340,
				"min-height": 200,
				"onUpdate:modelValue": r[2] ||= (e) => !e && n("answer", !1)
			}, {
				title: F(() => [...r[3] ||= [f("文件还没保存", -1)]]),
				actions: F(() => [
					p(i),
					p(a, {
						variant: "text",
						onClick: r[0] ||= (e) => n("answer", !1)
					}, {
						default: F(() => [...r[4] ||= [f("留在这里", -1)]]),
						_: 1
					}),
					p(a, {
						color: "error",
						variant: "flat",
						onClick: r[1] ||= (e) => n("answer", !0)
					}, {
						default: F(() => [...r[5] ||= [f("丢掉修改", -1)]]),
						_: 1
					})
				]),
				default: F(() => [f(" " + A(e.path || "当前文件") + " ", 1), r[6] ||= d("p", { class: "tip" }, "换过去之后这次的修改就没了，要保留就先按 Ctrl+S 保存。", -1)]),
				_: 1
			}, 8, ["model-value"]);
		};
	}
}, [["__scopeId", "data-v-bc1f7afc"]]);
// src/components/commons/FileEditor/useFileEditor.js
function Me({ loader: e, saver: t }) {
	let n = w(""), r = C({
		base: "",
		draft: "",
		loading: !1,
		error: "",
		saving: !1,
		saveError: ""
	}), i = 0, a = s(() => r.draft !== r.base);
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
	async function c() {
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
	function l() {
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
		save: c,
		discard: l,
		reset: u
	};
}
// src/components/commons/FileEditor/handlers/registry.js
var Ne = {
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
function Pe(e) {
	let n = t(e);
	return n === "markdown" ? Ne.markdown : n ? Ne.code : Ne.plain;
}
function Fe(e) {
	return Pe(e).modes;
}
function Ie(e, t) {
	return t.some((t) => t.id === e) ? e : "source";
}
function Le(e, t) {
	return t > 0 ? "source" : e;
}
function Re(e) {
	return {
		mode: "source",
		message: `视图加载失败${e && e.message ? `：${e.message}` : ""}`
	};
}
// src/components/commons/FileEditor/FileEditor.vue
var ze = { class: "file-editor" }, Be = {
	key: 1,
	class: "actions"
}, Ve = {
	key: 1,
	class: "hint"
}, He = {
	key: 2,
	class: "hint bad"
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
}, qe = {
	key: 4,
	class: "none"
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
	emits: ["navigate", "saved"],
	setup(e, { expose: t, emit: n }) {
		let r = e, i = n, { path: o, state: d, dirty: m, load: h, save: _, discard: v, reset: y } = Me({
			loader: r.loader,
			saver: r.saver
		}), x = w(null), C = w("source"), E = s(() => Fe(o.value)), M = s(() => E.value.find((e) => e.id === C.value) || null), P = k(null), I = w(!1), L = w(""), R = 0;
		function z() {
			if (!R) return;
			let e = x.value;
			if (!e || typeof e.locate != "function") return;
			let t = R;
			R = 0, e.locate(t);
		}
		N(E, (e) => {
			C.value = Ie(C.value, e);
		}, { immediate: !0 }), N(M, async (e) => {
			if (P.value = null, I.value = !!e, e) {
				L.value = "";
				try {
					let t = await e.load();
					if (M.value !== e) return;
					P.value = t.default, await g(), z();
				} catch (t) {
					if (M.value === e) {
						let e = Re(t);
						L.value = e.message, C.value = e.mode;
					}
				} finally {
					M.value === e && (I.value = !1);
				}
			}
		}, { immediate: !0 });
		async function ee() {
			let e = o.value, t = await _();
			return t && i("saved", {
				path: e,
				data: t
			}), t;
		}
		function B() {
			v();
		}
		let V = w(!1), te = null;
		async function ne(e, t = 0) {
			return L.value = "", C.value = Le(C.value, t), R = t, await h(e) ? (await g(), t || x.value?.resetScroll(), z(), !0) : (R = 0, !1);
		}
		async function re() {
			return !o.value || !await h(o.value) ? !1 : (await g(), x.value?.resetScroll(), !0);
		}
		function H() {
			G(), y();
		}
		function U() {
			return m.value ? V.value ? Promise.resolve(!1) : (V.value = !0, new Promise((e) => {
				te = e;
			})) : Promise.resolve(!0);
		}
		function W(e) {
			if (V.value = !1, !te) return;
			let t = te;
			te = null, t(e);
		}
		function G() {
			W(!1);
		}
		return b(() => W(!1)), t({
			open: ne,
			reload: re,
			close: H,
			save: ee,
			discard: B,
			confirmLeave: U,
			cancelLeave: G,
			dirty: m
		}), (t, n) => {
			let r = D("v-btn"), s = D("v-btn-toggle"), h = D("v-chip");
			return S(), u("section", ze, [
				j(o) ? (S(), c(Oe, {
					key: 0,
					"root-name": e.rootName,
					path: j(o),
					size: e.size,
					onNavigate: n[1] ||= (e) => i("navigate", e)
				}, {
					actions: F(() => [E.value.length > 1 ? (S(), c(s, {
						key: 0,
						modelValue: C.value,
						"onUpdate:modelValue": n[0] ||= (e) => C.value = e,
						density: "compact",
						variant: "text",
						divided: "",
						mandatory: "",
						class: "views"
					}, {
						default: F(() => [(S(!0), u(a, null, T(E.value, (e) => (S(), c(r, {
							key: e.id,
							value: e.id,
							size: "small"
						}, {
							default: F(() => [f(A(e.title), 1)]),
							_: 2
						}, 1032, ["value"]))), 128))]),
						_: 1
					}, 8, ["modelValue"])) : l("", !0), j(m) && !j(d).loading ? (S(), u("div", Be, [
						p(h, {
							size: "x-small",
							variant: "flat",
							color: "modified"
						}, {
							default: F(() => [...n[3] ||= [f("未保存", -1)]]),
							_: 1
						}),
						p(r, {
							size: "small",
							variant: "text",
							color: "primary",
							loading: j(d).saving,
							onClick: ee
						}, {
							default: F(() => [...n[4] ||= [f(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"]),
						p(r, {
							size: "small",
							variant: "text",
							disabled: j(d).saving,
							onClick: B
						}, {
							default: F(() => [...n[5] ||= [f(" 放弃 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					])) : l("", !0)]),
					_: 1
				}, 8, [
					"root-name",
					"path",
					"size"
				])) : l("", !0),
				j(d).loading ? (S(), u("p", Ve, "正在读取文件…")) : j(d).error ? (S(), u("p", He, A(j(d).error), 1)) : j(o) ? (S(), u("div", Ue, [
					L.value ? (S(), u("p", We, A(L.value), 1)) : l("", !0),
					j(d).saveError ? (S(), u("p", Ge, A(j(d).saveError), 1)) : l("", !0),
					P.value ? (S(), c(O(P.value), {
						key: 2,
						ref_key: "paneRef",
						ref: x,
						modelValue: j(d).draft,
						"onUpdate:modelValue": n[2] ||= (e) => j(d).draft = e,
						path: j(o)
					}, null, 8, ["modelValue", "path"])) : I.value ? (S(), u("p", Ke, "正在准备视图…")) : l("", !0)
				])) : (S(), u("div", qe, "从左边选一个文件，右边显示它的内容。")),
				p(je, {
					"model-value": V.value,
					path: j(o),
					onAnswer: W
				}, null, 8, ["model-value", "path"])
			]);
		};
	}
}, [["__scopeId", "data-v-7782e892"]]), Ye = "";
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
		}, i = s(() => ({
			...r,
			...n.texts
		})), o = t, m = w(/* @__PURE__ */ new Set()), h = w(null), g = w(null), v = s(() => n.groups.filter((e) => e && e.kind === "group").length), O = s(() => Ze(n.groups, n.workspaces, m.value)), k = s(() => Qe(n.groups));
		function M() {
			return et(n.groups, n.workspaces);
		}
		function N(e, t) {
			return $e(n.groups, e, t);
		}
		function P(e) {
			o("groups-change", e);
		}
		function I(e, t, n, r) {
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
		function ee(e) {
			if (e.kind !== "group") {
				o("select", e.id);
				return;
			}
			let t = new Set(m.value);
			t.has(e.id) ? t.delete(e.id) : t.add(e.id), m.value = t;
		}
		function B(e) {
			if (!m.value.has(e)) return;
			let t = new Set(m.value);
			t.delete(e), m.value = t;
		}
		function V(e) {
			let t = h.value, n = g.value, r = (t) => !!n && n.mode === t && n.kind === e.kind && n.id === e.id;
			return {
				"drag-src": !!t && t.kind === e.kind && t.id === e.id,
				"drop-before": r("before"),
				"drop-after": r("after"),
				"drop-into": r("into")
			};
		}
		function te(e, t) {
			h.value = {
				kind: t.kind,
				id: t.id
			}, g.value = null, e.dataTransfer && (e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("text/plain", t.id));
		}
		function ne(e, t) {
			if (!h.value) return;
			let n = h.value;
			if (n.kind === t.kind && n.id === t.id) {
				g.value = null;
				return;
			}
			let r = e.currentTarget.getBoundingClientRect(), i = e.clientY - r.top, a = i > r.height / 2 ? "after" : "before";
			t.kind === "group" && (a = i < r.height * .25 ? "before" : i > r.height * .75 ? "after" : "into"), n.kind === "group" && N(n.id, a === "into" ? t.id : t.parent) ? g.value = null : g.value = {
				kind: t.kind,
				id: t.id,
				mode: a
			};
		}
		function re() {
			let e = h.value, t = g.value;
			if (!e || !t) return H();
			let n = M(), r = n.findIndex((t) => t.kind === e.kind && t.id === e.id);
			if (r < 0) return H();
			let i = n.splice(r, 1)[0];
			if (t.mode === "into") i.parent = t.id, n.push(i), B(t.id);
			else {
				let e = n.findIndex((e) => e.kind === t.kind && e.id === t.id);
				e < 0 ? (i.parent = "", n.push(i)) : (i.parent = n[e].parent || "", n.splice(t.mode === "before" ? e : e + 1, 0, i));
			}
			P(n), H();
		}
		function H() {
			h.value = null, g.value = null;
		}
		let U = w(!1), W = w(""), G = w(!1), ie = w(0), K = w(null), q = C({
			open: !1,
			x: 0,
			y: 0,
			mode: "blank",
			target: null
		}), J = w(!1), Y = w(null), X = w(""), ae = w(!1), Z = w(!1), se = w(null), Q = w(""), ce = w(!1), le = w(null);
		function ue(e) {
			q.x = Math.max(8, Math.min(e.clientX, window.innerWidth - 210)), q.y = Math.max(8, Math.min(e.clientY, window.innerHeight - 160));
		}
		function de(e, t) {
			ue(e), q.mode = t.kind === "group" ? "group" : "ws", q.target = t.kind === "group" ? t.group : t.ws, q.open = !0;
		}
		function fe(e) {
			e.target.closest && e.target.closest(".head") || (ue(e), q.mode = "blank", q.target = null, q.open = !0);
		}
		function $() {
			q.open = !1;
		}
		function pe(e) {
			se.value = { id: e.id }, Q.value = e.name || "", Z.value = !0, $();
		}
		function me() {
			let e = (Q.value || "").trim().slice(0, 80);
			e && se.value && (P(M().map((t) => t.kind === "group" && t.id === se.value.id ? {
				...t,
				name: e
			} : t)), Z.value = !1);
		}
		function he() {
			let e = M(), t = {
				kind: "group",
				id: z(),
				name: "新分组",
				parent: ""
			};
			e.push(t), P(e), $(), pe(t);
		}
		function _e() {
			let e = q.target;
			if (!e) return;
			let t = M(), n = {
				kind: "group",
				id: z(),
				name: "新分组",
				parent: e.id
			};
			t.push(n), P(t), B(e.id), $(), pe(n);
		}
		function ve() {
			let e = q.target;
			if (!e) return;
			let t = M(), n = {
				kind: "group",
				id: z(),
				name: "新分组",
				parent: ""
			};
			t.push(n), I(t, "ws", e.id, n.id), P(t), $(), pe(n);
		}
		function ye(e) {
			if (!q.target) return;
			let t = M();
			I(t, "ws", q.target.id, e), P(t), e && B(e), $();
		}
		function be() {
			le.value = q.target, ce.value = !0, $();
		}
		function xe() {
			let e = le.value ? le.value.id : "";
			if (e) {
				let t = M(), n = t.findIndex((t) => t.kind === "group" && t.id === e);
				if (n >= 0) {
					let r = t[n].parent || "";
					t.splice(n, 1);
					for (let n of t) (n.parent || "") === e && (n.parent = r);
					P(t);
				}
			}
			ce.value = !1;
		}
		function Se(e) {
			Y.value = e, X.value = e.alias || "", J.value = !0, $();
		}
		async function Ce() {
			if (Y.value) {
				ae.value = !0;
				try {
					await n.saveAlias(Y.value.id, (X.value || "").trim()), J.value = !1, o("changed"), o("notice", {
						text: i.value.aliasSaved,
						color: "primary"
					});
				} catch (e) {
					o("notice", {
						text: `${i.value.aliasFailed}${e.message}`,
						color: "error"
					});
				} finally {
					ae.value = !1;
				}
			}
		}
		async function we(e, t) {
			let n = t === "rel" && e.rel || e.root, r = await ge(n);
			o("notice", {
				text: r ? `${i.value.copied}${n}` : i.value.copyFailed,
				color: r ? "primary" : "error"
			}), $();
		}
		x(() => {
			document.addEventListener("click", $), document.addEventListener("contextmenu", $), window.addEventListener("resize", $), window.addEventListener("blur", $);
		}), b(() => {
			document.removeEventListener("click", $), document.removeEventListener("contextmenu", $), window.removeEventListener("resize", $), window.removeEventListener("blur", $);
		});
		function Te(e) {
			let t = String(e || "").split("/").filter(Boolean);
			return t.length ? t[t.length - 1] : e;
		}
		function Ee() {
			W.value = "", G.value = !1, ie.value += 1, U.value = !0;
		}
		function De() {
			let e = W.value.trim();
			e && (U.value = !1, o("add", e));
		}
		function Oe(e) {
			K.value = e;
		}
		function ke() {
			let e = K.value;
			K.value = null, e && o("remove", e.id);
		}
		return (t, n) => {
			let r = D("v-btn"), o = D("v-icon"), s = D("v-list-item-title"), h = D("v-list-item-subtitle"), g = D("v-list-item"), b = D("v-list"), x = D("v-text-field"), C = D("v-spacer");
			return S(), u("div", {
				class: "list",
				onContextmenu: R(fe, ["prevent", "stop"])
			}, [
				d("div", tt, [d("span", nt, A(i.value.headTitle), 1), p(r, {
					size: "small",
					variant: "text",
					color: "primary",
					"prepend-icon": "mdi-plus",
					loading: e.busy,
					onClick: Ee
				}, {
					default: F(() => [f(A(i.value.add), 1)]),
					_: 1
				}, 8, ["loading"])]),
				!e.workspaces.length && !v.value ? (S(), u("div", rt, A(i.value.empty), 1)) : l("", !0),
				p(b, {
					density: "compact",
					nav: "",
					class: "items",
					onDrop: R(re, ["prevent"])
				}, {
					default: F(() => [(S(!0), u(a, null, T(O.value, (v) => (S(), c(g, {
						key: v.key,
						active: v.kind === "ws" && v.id === e.current,
						"active-color": "primary",
						draggable: "true",
						style: y({ paddingLeft: `${12 + v.depth * 12}px` }),
						class: _(V(v)),
						onClick: (e) => ee(v),
						onContextmenu: R((e) => de(e, v), ["prevent", "stop"]),
						onDragstart: (e) => te(e, v),
						onDragover: R((e) => ne(e, v), ["prevent"]),
						onDragend: H
					}, {
						append: F(() => [v.kind === "ws" ? (S(), c(r, {
							key: 0,
							icon: !0,
							size: "x-small",
							variant: "text",
							title: i.value.forgetTitle,
							class: "forget",
							onClick: R((e) => Oe(v.ws), ["stop"])
						}, {
							default: F(() => [p(o, { size: "18" }, {
								default: F(() => [...n[23] ||= [f("mdi-close", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["title", "onClick"])) : l("", !0)]),
						default: F(() => [v.kind === "group" ? (S(), c(s, {
							key: 0,
							class: "gname"
						}, {
							default: F(() => [
								p(o, { size: "16" }, {
									default: F(() => [f(A(m.value.has(v.id) ? "mdi-chevron-right" : "mdi-chevron-down"), 1)]),
									_: 2
								}, 1024),
								p(o, { size: "16" }, {
									default: F(() => [...n[22] ||= [f("mdi-folder-outline", -1)]]),
									_: 1
								}),
								d("span", it, A(v.name), 1)
							]),
							_: 2
						}, 1024)) : (S(), u(a, { key: 1 }, [p(s, {
							class: "name",
							title: v.ws.alias ? v.ws.root : ""
						}, {
							default: F(() => [d("span", at, A(v.ws.alias || Te(v.ws.root)), 1), E(t.$slots, "title-extra", { ws: v.ws }, void 0, !0)]),
							_: 2
						}, 1032, ["title"]), p(h, {
							class: "path",
							title: v.ws.url || v.ws.root
						}, {
							default: F(() => [f(A(v.ws.url || v.ws.root), 1)]),
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
				q.open ? (S(), u("div", {
					key: 1,
					class: "ctxmenu",
					style: y({
						left: q.x + "px",
						top: q.y + "px"
					}),
					onClick: n[6] ||= R(() => {}, ["stop"]),
					onContextmenu: n[7] ||= R(() => {}, ["prevent", "stop"])
				}, [q.mode === "ws" ? (S(), u(a, { key: 0 }, [
					d("button", {
						type: "button",
						class: "ctxitem",
						onClick: n[0] ||= (e) => Se(q.target)
					}, [p(o, { size: "16" }, {
						default: F(() => [...n[24] ||= [f("mdi-rename-box", -1)]]),
						_: 1
					}), f(A(i.value.menuAlias), 1)]),
					d("button", {
						type: "button",
						class: "ctxitem",
						onClick: n[1] ||= (e) => we(q.target, "rel")
					}, [p(o, { size: "16" }, {
						default: F(() => [...n[25] ||= [f("mdi-content-copy", -1)]]),
						_: 1
					}), f(A(i.value.copyRel), 1)]),
					d("button", {
						type: "button",
						class: "ctxitem",
						onClick: n[2] ||= (e) => we(q.target, "abs")
					}, [p(o, { size: "16" }, {
						default: F(() => [...n[26] ||= [f("mdi-content-copy", -1)]]),
						_: 1
					}), f(A(i.value.copyAbs), 1)]),
					d("button", {
						type: "button",
						class: "ctxitem",
						onClick: n[3] ||= (e) => q.mode = "pick"
					}, [
						p(o, { size: "16" }, {
							default: F(() => [...n[27] ||= [f("mdi-folder-move-outline", -1)]]),
							_: 1
						}),
						n[28] ||= f("移到分组 ", -1),
						n[29] ||= d("span", { class: "more" }, "›", -1)
					])
				], 64)) : q.mode === "pick" ? (S(), u(a, { key: 1 }, [
					d("button", {
						type: "button",
						class: "ctxitem",
						onClick: n[4] ||= (e) => ye("")
					}, [p(o, { size: "16" }, {
						default: F(() => [...n[30] ||= [f("mdi-format-list-bulleted", -1)]]),
						_: 1
					}), n[31] ||= f("移出分组 ", -1)]),
					(S(!0), u(a, null, T(k.value, (e) => (S(), u("button", {
						key: e.id,
						type: "button",
						class: "ctxitem",
						style: y({ paddingLeft: `${10 + e.depth * 12}px` }),
						onClick: (t) => ye(e.id)
					}, [p(o, { size: "16" }, {
						default: F(() => [...n[32] ||= [f("mdi-folder-outline", -1)]]),
						_: 1
					}), f(A(e.name), 1)], 12, ot))), 128)),
					d("button", {
						type: "button",
						class: "ctxitem",
						onClick: ve
					}, [p(o, { size: "16" }, {
						default: F(() => [...n[33] ||= [f("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), n[34] ||= f("新建分组并移入 ", -1)])
				], 64)) : q.mode === "group" ? (S(), u(a, { key: 2 }, [
					d("button", {
						type: "button",
						class: "ctxitem",
						onClick: _e
					}, [p(o, { size: "16" }, {
						default: F(() => [...n[35] ||= [f("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), n[36] ||= f("新建子分组 ", -1)]),
					d("button", {
						type: "button",
						class: "ctxitem",
						onClick: n[5] ||= (e) => pe(q.target)
					}, [p(o, { size: "16" }, {
						default: F(() => [...n[37] ||= [f("mdi-rename-box", -1)]]),
						_: 1
					}), n[38] ||= f("重命名 ", -1)]),
					d("button", {
						type: "button",
						class: "ctxitem",
						onClick: be
					}, [p(o, { size: "16" }, {
						default: F(() => [...n[39] ||= [f("mdi-trash-can-outline", -1)]]),
						_: 1
					}), n[40] ||= f("删除分组 ", -1)])
				], 64)) : (S(), u("button", {
					key: 3,
					type: "button",
					class: "ctxitem",
					onClick: he
				}, [p(o, { size: "16" }, {
					default: F(() => [...n[41] ||= [f("mdi-folder-plus-outline", -1)]]),
					_: 1
				}), n[42] ||= f("新建分组 ", -1)]))], 36)) : l("", !0),
				p(Ae, {
					modelValue: J.value,
					"onUpdate:modelValue": n[10] ||= (e) => J.value = e,
					"initial-width": 460,
					"initial-height": 320,
					"min-width": 360,
					"min-height": 240
				}, {
					title: F(() => [f(A(i.value.aliasTitle), 1)]),
					actions: F(() => [
						p(C),
						p(r, {
							variant: "text",
							onClick: n[9] ||= (e) => J.value = !1
						}, {
							default: F(() => [...n[43] ||= [f("取消", -1)]]),
							_: 1
						}),
						p(r, {
							color: "primary",
							variant: "flat",
							loading: ae.value,
							onClick: Ce
						}, {
							default: F(() => [...n[44] ||= [f(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"])
					]),
					default: F(() => [
						d("p", st, A(Y.value ? Y.value.root : ""), 1),
						p(x, {
							modelValue: X.value,
							"onUpdate:modelValue": n[8] ||= (e) => X.value = e,
							label: "别名",
							density: "compact",
							variant: "outlined",
							maxlength: "80",
							clearable: "",
							autofocus: "",
							onKeyup: L(Ce, ["enter"])
						}, null, 8, ["modelValue"]),
						d("p", ct, A(i.value.aliasHint), 1)
					]),
					_: 1
				}, 8, ["modelValue"]),
				p(Ae, {
					modelValue: Z.value,
					"onUpdate:modelValue": n[13] ||= (e) => Z.value = e,
					"initial-width": 440,
					"initial-height": 260,
					"min-width": 340,
					"min-height": 200
				}, {
					title: F(() => [...n[45] ||= [f("分组名称", -1)]]),
					actions: F(() => [
						p(C),
						p(r, {
							variant: "text",
							onClick: n[12] ||= (e) => Z.value = !1
						}, {
							default: F(() => [...n[46] ||= [f("取消", -1)]]),
							_: 1
						}),
						p(r, {
							color: "primary",
							variant: "flat",
							disabled: !Q.value.trim(),
							onClick: me
						}, {
							default: F(() => [...n[47] ||= [f(" 保存 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					]),
					default: F(() => [p(x, {
						modelValue: Q.value,
						"onUpdate:modelValue": n[11] ||= (e) => Q.value = e,
						label: "名称",
						density: "compact",
						variant: "outlined",
						maxlength: "80",
						autofocus: "",
						onKeyup: L(me, ["enter"])
					}, null, 8, ["modelValue"])]),
					_: 1
				}, 8, ["modelValue"]),
				p(Ae, {
					modelValue: ce.value,
					"onUpdate:modelValue": n[15] ||= (e) => ce.value = e,
					"initial-width": 440,
					"initial-height": 240,
					"min-width": 340,
					"min-height": 200
				}, {
					title: F(() => [...n[48] ||= [f("删除分组", -1)]]),
					actions: F(() => [
						p(C),
						p(r, {
							variant: "text",
							onClick: n[14] ||= (e) => ce.value = !1
						}, {
							default: F(() => [...n[49] ||= [f("取消", -1)]]),
							_: 1
						}),
						p(r, {
							color: "error",
							variant: "flat",
							onClick: xe
						}, {
							default: F(() => [...n[50] ||= [f("删除", -1)]]),
							_: 1
						})
					]),
					default: F(() => [f(" " + A(le.value ? le.value.name : "") + " ", 1), n[51] ||= d("p", { class: "tip" }, "里面的子分组与工作区移到上一级，工作区本身不动。", -1)]),
					_: 1
				}, 8, ["modelValue"]),
				p(Ae, {
					modelValue: U.value,
					"onUpdate:modelValue": n[19] ||= (e) => U.value = e,
					"initial-width": 620,
					"initial-height": 460,
					"min-width": 420,
					"min-height": 300
				}, {
					title: F(() => [f(A(i.value.addTitle), 1)]),
					actions: F(() => [
						p(C),
						p(r, {
							variant: "text",
							onClick: n[18] ||= (e) => U.value = !1
						}, {
							default: F(() => [...n[52] ||= [f("取消", -1)]]),
							_: 1
						}),
						p(r, {
							color: "primary",
							variant: "flat",
							disabled: !W.value.trim() || !G.value,
							onClick: De
						}, {
							default: F(() => [f(A(i.value.addConfirm), 1)]),
							_: 1
						}, 8, ["disabled"])
					]),
					default: F(() => [(S(), c(j(oe), {
						key: ie.value,
						modelValue: W.value,
						"onUpdate:modelValue": n[16] ||= (e) => W.value = e,
						tip: i.value.addTip,
						label: i.value.addLabel,
						placeholder: i.value.addPlaceholder,
						loader: e.dirs,
						"onUpdate:valid": n[17] ||= (e) => G.value = e
					}, null, 8, [
						"modelValue",
						"tip",
						"label",
						"placeholder",
						"loader"
					]))]),
					_: 1
				}, 8, ["modelValue"]),
				p(Ae, {
					modelValue: K.value,
					"onUpdate:modelValue": n[21] ||= (e) => K.value = e,
					"initial-width": 440,
					"initial-height": 260,
					"min-width": 340,
					"min-height": 200
				}, {
					title: F(() => [f(A(i.value.removeTitle), 1)]),
					actions: F(() => [
						p(C),
						p(r, {
							variant: "text",
							onClick: n[20] ||= (e) => K.value = null
						}, {
							default: F(() => [...n[53] ||= [f("取消", -1)]]),
							_: 1
						}),
						p(r, {
							color: "error",
							variant: "flat",
							onClick: ke
						}, {
							default: F(() => [f(A(i.value.removeConfirm), 1)]),
							_: 1
						})
					]),
					default: F(() => [f(" " + A(K.value ? K.value.root : "") + " ", 1), d("p", lt, A(i.value.removeText), 1)]),
					_: 1
				}, 8, ["modelValue"])
			], 32);
		};
	}
}, [["__scopeId", "data-v-a7acb0bf"]]), dt = ["title"], ft = /*#__PURE__*/ e({
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
		return (t, n) => (S(), u("div", {
			class: _(["handle", [e.axis, {
				active: !e.disabled && e.active,
				disabled: e.disabled
			}]]),
			title: e.disabled ? "" : e.title,
			onPointerdown: i,
			onDblclick: a
		}, [...n[0] ||= [d("span", { class: "grip" }, null, -1)]], 42, dt));
	}
}, [["__scopeId", "data-v-5d45adaa"]]), pt = "web-shared-resizing";
function mt({ area: e, initial: t, min: n = 0, max: r = 100, rightMin: i = 0, axis: a = "x", unit: o = "px", persist: s = "" }) {
	let c = w(f()), l = w(!1), u = 0, d = 0;
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
	return N(c, (e) => {
		if (s) try {
			window.localStorage.setItem(s, String(e));
		} catch {}
	}), b(h), {
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
		let t = e, i = w(null), a = w(!0), { size: o, resizing: s, start: u, reset: m } = mt({
			area: i,
			initial: 268,
			min: 200,
			rightMin: 420,
			persist: `${t.title}.shell.side-width`
		});
		return (t, g) => {
			let v = D("v-app-bar-nav-icon"), b = D("v-app-bar-title"), x = D("v-spacer"), C = D("v-chip"), w = D("v-btn"), T = D("v-app-bar"), O = D("v-main"), k = D("v-app");
			return S(), c(k, null, {
				default: F(() => [
					p(T, {
						density: "comfortable",
						flat: "",
						border: "b",
						class: "app-bar"
					}, {
						default: F(() => [
							p(v, {
								title: a.value ? "收起左侧列表" : "展开左侧列表",
								onClick: g[0] ||= (e) => a.value = !a.value
							}, null, 8, ["title"]),
							p(b, null, {
								default: F(() => [d("span", ht, A(e.title), 1)]),
								_: 1
							}),
							p(x),
							e.workspaces.length ? (S(), c(C, {
								key: 0,
								size: "small",
								variant: "tonal",
								class: "running",
								color: e.running ? "ready" : void 0,
								"prepend-icon": "mdi-play-circle-outline",
								title: e.running ? `所有工作区共 ${e.running} 个进程在跑` : "所有工作区都没有在跑的进程"
							}, {
								default: F(() => [f(A(e.running) + " 个在跑 ", 1)]),
								_: 1
							}, 8, ["color", "title"])) : l("", !0),
							E(t.$slots, "metrics", {}, void 0, !0),
							p(w, {
								icon: e.dark ? "mdi-weather-sunny" : "mdi-weather-night",
								title: "切换深浅色",
								variant: "text",
								onClick: e.toggleTheme
							}, null, 8, ["icon", "onClick"])
						]),
						_: 3
					}),
					p(n, {
						modelValue: e.snack.on,
						"onUpdate:modelValue": g[1] ||= (t) => e.snack.on = t,
						text: e.snack.text,
						color: e.snack.color
					}, null, 8, [
						"modelValue",
						"text",
						"color"
					]),
					p(O, { class: "fill-height" }, {
						default: F(() => [d("div", {
							ref_key: "shellRef",
							ref: i,
							class: "shell"
						}, [
							d("div", {
								class: "side-slot",
								style: y({ width: a.value ? `${j(o)}px` : "0px" })
							}, null, 4),
							d("div", {
								class: _(["side-layer", { folded: !a.value }]),
								style: y({ width: `${j(o)}px` })
							}, [d("aside", gt, [E(t.$slots, "sidebar", {}, void 0, !0)])], 6),
							I(p(ft, {
								axis: "x",
								active: j(s),
								onStart: j(u),
								onReset: j(m)
							}, null, 8, [
								"active",
								"onStart",
								"onReset"
							]), [[M, a.value]]),
							d("main", _t, [E(t.$slots, "default", { ws: e.current }, void 0, !0), e.current ? l("", !0) : (S(), c(r, h({ key: 0 }, e.empty, { onAction: g[2] ||= (e) => t.$emit("empty-action") }), null, 16))])
						], 512)]),
						_: 3
					})
				]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-b05e89f5"]]), yt = { style: { width: "42%" } }, bt = { class: "svc-name" }, xt = ["title"], St = ["title"], Ct = { class: "status-line" }, wt = {
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
			let r = D("v-chip"), i = D("v-btn"), o = D("v-icon"), s = D("v-table");
			return S(), c(s, {
				density: "compact",
				class: "table"
			}, {
				default: F(() => [d("thead", null, [d("tr", null, [
					d("th", yt, A(e.nameTitle), 1),
					n[0] ||= d("th", null, "参数", -1),
					n[1] ||= d("th", { style: { width: "200px" } }, "状态", -1),
					n[2] ||= d("th", { style: { width: "230px" } }, null, -1)
				])]), d("tbody", null, [(S(!0), u(a, null, T(e.rows, (e) => (S(), u("tr", { key: e.key }, [
					d("td", null, [d("div", bt, [d("span", null, A(e.title), 1), e.typeText ? (S(), c(r, {
						key: 0,
						size: "x-small",
						variant: "tonal",
						class: "type-chip"
					}, {
						default: F(() => [f(A(e.typeText), 1)]),
						_: 2
					}, 1024)) : l("", !0)]), d("div", {
						class: "svc-path",
						title: e.path
					}, A(e.path), 9, xt)]),
					d("td", null, [d("div", {
						class: "cmd",
						title: e.cmd
					}, A(e.cmd), 9, St)]),
					d("td", null, [d("div", Ct, [e.live ? (S(), u(a, { key: 0 }, [p(r, {
						size: "small",
						class: "status-chip",
						color: e.color,
						variant: "tonal",
						"prepend-icon": e.icon
					}, {
						default: F(() => [f(A(e.statusText), 1)]),
						_: 2
					}, 1032, ["color", "prepend-icon"]), e.port ? (S(), u("span", wt, "端口 " + A(e.port), 1)) : e.started ? (S(), u("span", Tt, A(e.ago), 1)) : l("", !0)], 64)) : e.run ? (S(), u(a, { key: 1 }, [p(r, {
						size: "small",
						class: "status-chip",
						color: e.color,
						variant: "tonal",
						"prepend-icon": e.icon,
						onClick: (n) => t.$emit("log", e)
					}, {
						default: F(() => [f(A(e.statusText), 1)]),
						_: 2
					}, 1032, [
						"color",
						"prepend-icon",
						"onClick"
					]), e.err ? (S(), u("span", {
						key: 0,
						class: "meta err",
						title: e.err
					}, A(e.err), 9, Et)) : e.started ? (S(), u("span", Dt, A(e.ago), 1)) : l("", !0)], 64)) : (S(), u("span", Ot, "—"))])]),
					d("td", kt, [e.live ? (S(), u(a, { key: 0 }, [p(i, {
						size: "small",
						variant: "text",
						"prepend-icon": "mdi-text-box-outline",
						onClick: (n) => t.$emit("log", e)
					}, {
						default: F(() => [...n[3] ||= [f(" 日志 ", -1)]]),
						_: 1
					}, 8, ["onClick"]), p(i, {
						size: "small",
						color: "error",
						variant: "tonal",
						loading: e.stopping,
						onClick: (n) => t.$emit("stop", e)
					}, {
						default: F(() => [...n[4] ||= [f(" 停止 ", -1)]]),
						_: 1
					}, 8, ["loading", "onClick"])], 64)) : (S(), u(a, { key: 1 }, [
						p(i, {
							size: "small",
							color: "primary",
							variant: "flat",
							disabled: e.blocked,
							loading: e.starting,
							onClick: (n) => t.$emit("start", e)
						}, {
							default: F(() => [f(A(e.action), 1)]),
							_: 2
						}, 1032, [
							"disabled",
							"loading",
							"onClick"
						]),
						p(i, {
							size: "small",
							variant: "text",
							icon: !0,
							title: "参数",
							onClick: (n) => t.$emit("settings", e)
						}, {
							default: F(() => [p(o, { size: "20" }, {
								default: F(() => [...n[5] ||= [f("mdi-tune", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["onClick"]),
						e.run ? (S(), c(i, {
							key: 0,
							size: "small",
							variant: "text",
							"prepend-icon": "mdi-text-box-outline",
							onClick: (n) => t.$emit("log", e)
						}, {
							default: F(() => [...n[6] ||= [f(" 日志 ", -1)]]),
							_: 1
						}, 8, ["onClick"])) : l("", !0)
					], 64)), E(t.$slots, "row-extra", { row: e }, void 0, !0)])
				]))), 128))])]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-6b5b7a54"]]), jt = { class: "log-head" }, Mt = { class: "log-box" }, Nt = {
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
			let r = D("v-spacer"), i = D("v-btn");
			return S(), u(a, null, [d("div", jt, [
				n[2] ||= d("span", { class: "label" }, "日志", -1),
				p(r),
				e.more ? (S(), c(i, {
					key: 0,
					size: "small",
					variant: "text",
					"prepend-icon": "mdi-history",
					onClick: n[0] ||= (e) => t.$emit("load-more")
				}, {
					default: F(() => [...n[1] ||= [f(" 更早 ", -1)]]),
					_: 1
				})) : l("", !0)
			]), d("div", Mt, [e.text ? (S(), c(V, {
				key: 0,
				text: e.text,
				dark: e.dark,
				colorize: e.colorize
			}, null, 8, [
				"text",
				"dark",
				"colorize"
			])) : (S(), u("p", Nt, A(e.emptyText), 1))])], 64);
		};
	}
}, [["__scopeId", "data-v-d45becae"]]);
// src/composables/commons/useFileTree.js
function Ft(e, t = () => ({})) {
	let n = C({});
	function r() {
		let t = typeof e == "function" ? e() : j(e);
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
	let c = s(() => o(i(r()), 0));
	function l(e) {
		n[e] = !n[e];
	}
	return {
		rows: c,
		collapsed: n,
		toggle: l
	};
}
// src/composables/services/useRunLog.js
function It({ api: e, ws: t, statusText: n = {} }) {
	let r = w(""), i = w(!1), a = w(0), o = w(""), s = w(""), c = w(""), l = null;
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
	return N(t, (e) => {
		if (!c.value || !e) return;
		let t = (e.services || []).find((e) => e.id === c.value);
		t && t.run && (o.value = n[t.run.status] || t.run.status);
	}), b(u), {
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
function zt({ api: e, storageKey: t, extraState: n = {}, loadExtra: r = null, addedNotice: a = "已添加" }) {
	let o = C({
		workspaces: [],
		groups: [],
		...n
	}), c = B(t, "", { writeDefaults: !1 }), l = w(!1), u = w(null), { snack: d, toast: f } = i(), p = null, m = 0, h = s(() => o.workspaces.find((e) => e.id === c.value) || null), g = s(() => o.workspaces.reduce((e, t) => e + Rt(t), 0));
	function _(e) {
		c.value = e || "";
	}
	function v(e) {
		o.workspaces = e.workspaces || [], o.groups = e.groups || [], c.value && !h.value && _("");
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
	async function T() {
		if (r) try {
			await r(o);
		} catch {}
	}
	async function E(e, t) {
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
		l.value = !0;
		let r = await E("添加工作区", async () => (await e.addWorkspace(n), !0));
		if (l.value = !1, !r) return;
		await b();
		let i = o.workspaces.find((e) => e.root === n || e.root === n.replace(/\/+$/, ""));
		i && _(i.id), f(a, "primary");
	}
	async function O(t) {
		await E("移出工作区", async () => (await e.forgetWorkspace(t), !0)) && (c.value === t && _(""), f("已移出，在跑的进程一并停了"));
	}
	async function k() {
		h.value && await E("重新扫描", () => e.rescan(h.value.id));
	}
	async function A(t) {
		await E("启动", () => e.start(t)) && f("已发出启动", "primary");
	}
	async function j(t) {
		await E("停止", () => e.stop(t)) && f("已停止");
	}
	async function M(t) {
		await E("保存参数", () => e.update(t)) && f("参数已保存", "primary");
	}
	async function N() {
		x(), await b(), T();
	}
	return {
		state: o,
		current: h,
		currentId: c,
		adding: l,
		snack: d,
		toast: f,
		metrics: u,
		running: g,
		select: _,
		setGroups: y,
		refresh: b,
		act: E,
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
export { G as DirectoryNode, oe as DirectoryPicker, Je as FileEditor, Ce as FileTree, Ae as FloatingDialog, Lt as LIVE_STATUSES, V as LogView, Pt as RunLogPanel, At as ServiceTable, ft as SplitHandle, ut as WorkspaceList, vt as WorkspaceShell, ge as copyText, ce as fileIcon, Rt as runningCount, Ft as useFileTree, It as useRunLog, mt as useSplitPane, zt as useWorkspaceState };
