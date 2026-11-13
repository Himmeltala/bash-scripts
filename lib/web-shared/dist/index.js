import { t as e } from "./_plugin-vue_export-helper-Djzt4Yr7.js";
import { highlightCode as t, languageOf as n } from "./highlight.js";
import { Fragment as r, Teleport as i, computed as a, createBlock as o, createCommentVNode as s, createElementBlock as c, createElementVNode as l, createTextVNode as u, createVNode as d, guardReactiveProps as f, mergeProps as p, nextTick as m, normalizeClass as h, normalizeProps as g, normalizeStyle as _, onBeforeUnmount as v, onMounted as y, openBlock as b, reactive as x, ref as S, renderList as C, renderSlot as w, resolveComponent as T, toDisplayString as E, unref as D, watch as O, watchEffect as k, withCtx as A, withKeys as j, withModifiers as M } from "vue";
import { Terminal as N } from "@xterm/xterm";
import { FitAddon as P } from "@xterm/addon-fit";
var F = /*#__PURE__*/ e({
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
		}, r = S(null), i = null, a = null, o = null, s = "";
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
			if (i && e !== s) {
				if (s && e.startsWith(s)) {
					let t = i.buffer.active.viewportY >= i.buffer.active.baseY, n = e.slice(s.length);
					s = e, i.write(u(n), () => {
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
		return y(() => {
			i = new N({
				convertEol: !0,
				disableStdin: !0,
				cursorBlink: !1,
				scrollback: 5e3,
				fontFamily: "'JetBrains Mono', 'Noto Sans Mono CJK SC', 'Sarasa Mono SC', 'Cascadia Mono', Consolas, Menlo, monospace",
				fontSize: 12,
				lineHeight: 1.3,
				theme: l(t.dark)
			}), a = new P(), i.loadAddon(a), i.open(r.value), requestAnimationFrame(() => i && a.fit()), document.fonts && document.fonts.load("12px 'JetBrains Mono'").then(() => i && a.fit()).catch(() => {}), o = new ResizeObserver(() => {
				i && a.fit();
			}), o.observe(r.value), i.attachCustomKeyEventHandler(p), f(t.text || "");
		}), O(() => t.text, (e) => f(e || "")), O(() => t.dark, (e) => {
			i && (i.options.theme = l(e));
		}), v(() => {
			o && o.disconnect(), i && i.dispose(), o = null, i = null;
		}), (t, n) => (b(), c("div", {
			ref_key: "host",
			ref: r,
			class: h(["term", { deeper: e.dark }]),
			style: _(e.height ? {
				height: e.height,
				flex: "0 0 auto"
			} : null)
		}, null, 6));
	}
}, [["__scopeId", "data-v-6c5d0f49"]]), I = { class: "node" }, L = ["title"], R = {
	key: 0,
	class: "kids"
}, z = {
	key: 0,
	class: "hint"
}, B = {
	key: 1,
	class: "hint bad"
}, ee = {
	key: 0,
	class: "hint"
}, V = /*#__PURE__*/ e({
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
		let n = e, i = t, a = S(!1), f = S(!1), p = S(""), g = S(null);
		O(() => n.selected === n.node.path, (e) => {
			e && m(() => g.value && g.value.scrollIntoView({ block: "nearest" }));
		}, { immediate: !0 });
		async function _() {
			i("pick", n.node), a.value || (a.value = !0, await y());
		}
		async function v() {
			a.value = !a.value, a.value && await y();
		}
		async function y() {
			if (!(n.node.children || f.value)) {
				f.value = !0, p.value = "";
				try {
					let e = await n.loader(n.node.path);
					n.node.children = e.entries;
				} catch (e) {
					p.value = e.message;
				} finally {
					f.value = !1;
				}
			}
		}
		return (t, n) => {
			let i = T("v-icon"), m = T("v-btn"), y = T("DirectoryNode", !0);
			return b(), c("div", I, [l("div", {
				ref_key: "rowEl",
				ref: g,
				class: h(["row", { selected: e.node.path === e.selected }]),
				onClick: _
			}, [
				d(m, {
					icon: !0,
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: a.value ? "收起" : "展开",
					onClick: M(v, ["stop"])
				}, {
					default: A(() => [d(i, { size: "18" }, {
						default: A(() => [u(E(a.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"]),
				d(i, {
					size: "18",
					class: "folder"
				}, {
					default: A(() => [...n[1] ||= [u("mdi-folder-outline", -1)]]),
					_: 1
				}),
				l("span", {
					class: "label",
					title: e.node.path
				}, E(e.node.name), 9, L)
			], 2), a.value ? (b(), c("div", R, [f.value ? (b(), c("p", z, "正在读取…")) : p.value ? (b(), c("p", B, E(p.value), 1)) : e.node.children ? (b(), c(r, { key: 2 }, [(b(!0), c(r, null, C(e.node.children, (r) => (b(), o(y, {
				key: r.path,
				node: r,
				selected: e.selected,
				loader: e.loader,
				onPick: n[0] ||= (e) => t.$emit("pick", e)
			}, null, 8, [
				"node",
				"selected",
				"loader"
			]))), 128)), e.node.children.length ? s("", !0) : (b(), c("p", ee, "没有子目录"))], 64)) : s("", !0)])) : s("", !0)]);
		};
	}
}, [["__scopeId", "data-v-3e5909ab"]]), H = { class: "picker" }, te = {
	key: 0,
	class: "tip"
}, U = { class: "tree" }, W = { class: "root" }, G = ["title"], K = {
	key: 0,
	class: "hint bad"
}, q = {
	key: 0,
	class: "hint"
}, ne = /*#__PURE__*/ e({
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
		let n = e, i = t, f = S(""), p = S(null), m = S(!0), h = S(""), g = a({
			get: () => n.modelValue,
			set: (e) => i("update:modelValue", e)
		}), _ = a(() => {
			let e = String(n.modelValue || "").trim();
			return e === "~" ? e = f.value : e.startsWith("~/") && (e = f.value + e.slice(1)), e.replace(/\/+$/, "");
		}), v = a(() => !f.value || !_.value ? !1 : n.validate ? !!n.validate(_.value, f.value) : _.value === f.value || _.value.startsWith(f.value + "/"));
		k(() => i("update:valid", v.value));
		function x(e) {
			g.value = e.path;
		}
		return y(async () => {
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
			let i = T("v-text-field"), a = T("v-icon"), y = T("v-progress-circular");
			return b(), c("div", H, [
				e.tip ? (b(), c("p", te, E(e.tip), 1)) : s("", !0),
				d(i, {
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
				l("div", U, [l("div", W, [
					d(a, { size: "18" }, {
						default: A(() => [...n[1] ||= [u("mdi-home-outline", -1)]]),
						_: 1
					}),
					l("span", {
						class: "root-label",
						title: f.value || "~"
					}, "~", 8, G),
					m.value ? (b(), o(y, {
						key: 0,
						size: "12",
						width: "2",
						indeterminate: ""
					})) : s("", !0)
				]), h.value ? (b(), c("p", K, E(h.value), 1)) : p.value ? (b(), c(r, { key: 1 }, [(b(!0), c(r, null, C(p.value, (t) => (b(), o(V, {
					key: t.path,
					node: t,
					selected: _.value,
					loader: e.loader,
					onPick: x
				}, null, 8, [
					"node",
					"selected",
					"loader"
				]))), 128)), p.value.length ? s("", !0) : (b(), c("p", q, "家目录下没有子目录"))], 64)) : s("", !0)])
			]);
		};
	}
}, [["__scopeId", "data-v-39d6d557"]]), J = {
	icon: "mdi-file-outline",
	color: ""
}, Y = {
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
function X(e) {
	let t = String(e || "").split("/").pop().toLowerCase(), n = Y[t];
	if (n) return n;
	let r = t.lastIndexOf(".");
	return r < 0 ? J : re[t.slice(r + 1)] || J;
}
// src/components/FileTree/FileTreeNode.vue
var Z = { class: "branch" }, ie = {
	key: 1,
	class: "arrow-space"
}, ae = ["title"], oe = {
	key: 0,
	class: "hint"
}, Q = {
	key: 1,
	class: "hint bad"
}, $ = {
	key: 2,
	class: "hint"
}, se = {
	key: 0,
	class: "hint"
}, ce = /*#__PURE__*/ e({
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
		let n = e, i = t, f = {
			loading: "正在读取…",
			empty: "空目录",
			truncated: "这一层文件太多，只列了前面一部分。"
		}, m = a(() => ({
			...f,
			...n.texts
		})), g = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, v = a(() => n.keyOf(n.node)), y = a(() => n.dirOf(n.node)), x = a(() => n.expanded[v.value] === !0), S = a(() => n.cache[v.value] || g), D = a(() => y.value ? null : X(n.nameOf(n.node))), O = a(() => y.value ? x.value ? "mdi-folder-open-outline" : "mdi-folder-outline" : D.value.icon), k = a(() => y.value ? null : D.value.color ? { color: D.value.color } : null);
		function j() {
			n.pickOnRowClick && (y.value ? i("toggle", v.value) : i("pick", n.node));
		}
		function N(e) {
			i("context", {
				node: n.node,
				event: e
			});
		}
		return (t, n) => {
			let a = T("v-icon"), f = T("v-btn"), g = T("FileTreeNode", !0);
			return b(), c("div", Z, [l("div", {
				class: h(["row", [e.rowClass ? e.rowClass(e.node) : null, { clickable: e.pickOnRowClick }]]),
				style: _({ paddingLeft: 4 + e.depth * 14 + "px" }),
				onClick: j,
				onContextmenu: M(N, ["prevent", "stop"])
			}, [
				y.value ? (b(), o(f, {
					key: 0,
					icon: "",
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: x.value ? "收起" : "展开",
					onClick: n[0] ||= M((e) => i("toggle", v.value), ["stop"])
				}, {
					default: A(() => [d(a, { size: "16" }, {
						default: A(() => [u(E(x.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"])) : (b(), c("span", ie)),
				d(a, {
					size: "16",
					class: h(y.value ? "folder" : "file"),
					style: _(k.value)
				}, {
					default: A(() => [u(E(O.value), 1)]),
					_: 1
				}, 8, ["class", "style"]),
				w(t.$slots, "row-before-label", {
					node: e.node,
					open: x.value,
					state: S.value
				}, void 0, !0),
				l("span", {
					class: h(["label", e.labelClass]),
					title: v.value
				}, E(e.nameOf(e.node)), 11, ae),
				w(t.$slots, "row-after-label", {
					node: e.node,
					open: x.value,
					state: S.value
				}, void 0, !0)
			], 38), y.value && x.value ? (b(), c(r, { key: 0 }, [S.value.loading ? (b(), c("p", oe, E(m.value.loading), 1)) : S.value.error ? (b(), c("p", Q, E(S.value.error), 1)) : S.value.entries.length ? (b(), c(r, { key: 3 }, [(b(!0), c(r, null, C(S.value.entries, (r) => (b(), o(g, {
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
				onToggle: n[1] ||= (e) => i("toggle", e),
				onPick: n[2] ||= (e) => i("pick", e),
				onContext: n[3] ||= (e) => i("context", e)
			}, {
				"row-before-label": A((e) => [w(t.$slots, "row-before-label", p({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": A((e) => [w(t.$slots, "row-after-label", p({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), S.value.truncated ? (b(), c("p", se, E(m.value.truncated), 1)) : s("", !0)], 64)) : (b(), c("p", $, E(m.value.empty), 1))], 64)) : s("", !0)]);
		};
	}
}, [["__scopeId", "data-v-84c4665e"]]);
// src/utils/clipboard.js
async function le(e) {
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
var ue = { class: "file-tree" }, de = {
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
}, he = ["disabled"], ge = /*#__PURE__*/ e({
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
		let h = e, D = n, k = {
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
		}, j = a(() => ({
			...k,
			...h.texts
		})), N = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, P = x({}), F = x({}), I = S(!1), L = a(() => h.root ? h.keyOf(h.root) : ""), R = a(() => F[L.value] || N);
		async function z(e, t = !1) {
			if (!t && F[e]) return;
			F[e] || (F[e] = {
				loading: !1,
				error: "",
				entries: [],
				truncated: !1
			});
			let n = F[e];
			n.loading = !0, n.error = "";
			try {
				let t = await h.loader(e);
				n.entries = t.entries || [], n.truncated = t.truncated || !1;
			} catch (e) {
				n.error = e.message, n.entries = [];
			} finally {
				n.loading = !1;
			}
		}
		function B(e) {
			P[e] = !P[e], P[e] && z(e);
		}
		async function ee(e) {
			P[L.value] = !0, await z(L.value);
			let t = L.value;
			for (let n of String(e || "").split("/").filter(Boolean)) t = t ? `${t}/${n}` : n, await z(t), P[t] = !0;
		}
		function V() {
			for (let e of Object.keys(F)) delete F[e];
			for (let e of Object.keys(P)) delete P[e];
			P[L.value] = !0, z(L.value);
		}
		async function H(e) {
			await z(e, !0);
		}
		async function te() {
			await Promise.all(Object.keys(F).map((e) => z(e, !0)));
		}
		function U() {
			h.active && !I.value && (I.value = !0, P[L.value] = !0, z(L.value));
		}
		h.active && U(), y(U), O(() => h.active, (e) => {
			e && U();
		});
		let W = x({
			open: !1,
			x: 0,
			y: 0,
			node: null,
			copied: ""
		}), G = S(null), K = 0, q = a(() => W.node ? String(h.keyOf(W.node) || "") : ""), ne = a(() => {
			if (!W.node || !h.rootPath) return "";
			let e = h.rootPath.replace(/\/+$/, ""), t = q.value;
			return t ? `${e}/${t}` : e;
		}), J = a(() => W.node ? h.dirOf(W.node) : !1);
		function Y({ node: e, event: t }) {
			W.node = e, W.copied = "", W.x = t.clientX, W.y = t.clientY, W.open = !0, m(re);
		}
		function re() {
			if (!G.value) return;
			let e = G.value.offsetWidth, t = G.value.offsetHeight;
			W.x = Math.max(6, Math.min(W.x, window.innerWidth - e - 6)), W.y = Math.max(6, Math.min(W.y, window.innerHeight - t - 6));
		}
		function X() {
			W.open = !1, W.node = null, W.copied = "", clearTimeout(K);
		}
		async function Z(e) {
			let t = e === "abs" ? ne.value : q.value;
			t && await le(t) && (W.copied = e, clearTimeout(K), K = setTimeout(X, 700));
		}
		function ie() {
			if (!W.node || !h.downloadOf) return;
			let e = W.node, t = h.downloadOf(e);
			if (X(), !t) return;
			let n = h.nameOf(e) || "download", r = document.createElement("a");
			r.href = t, r.download = h.dirOf(e) ? `${n}.zip` : n, r.rel = "noopener", r.style.display = "none", document.body.appendChild(r), r.click(), r.remove();
		}
		function ae(e) {
			G.value && !G.value.contains(e.target) && X();
		}
		function oe(e) {
			e.key === "Escape" && X();
		}
		function Q() {
			W.open && X();
		}
		function $(e) {
			let t = e ? "addEventListener" : "removeEventListener";
			document[t]("mousedown", ae, !0), document[t]("keydown", oe, !0), window[t]("scroll", Q, !0), window[t]("resize", Q);
		}
		return O(() => W.open, (e) => $(e)), v(() => {
			X(), $(!1);
		}), t({
			reveal: ee,
			reload: V,
			reloadDir: H,
			refreshAll: te,
			toggle: B
		}), (t, n) => {
			let a = T("v-icon");
			return b(), c("div", ue, [e.root ? (b(), o(ce, {
				key: 0,
				node: e.root,
				depth: 0,
				expanded: P,
				cache: F,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: B,
				onPick: n[0] ||= (e) => D("pick", e),
				onContext: Y
			}, {
				"row-before-label": A((e) => [w(t.$slots, "row-before-label", g(f(e)), void 0, !0)]),
				"row-after-label": A((e) => [w(t.$slots, "row-after-label", g(f(e)), void 0, !0)]),
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
			])) : (b(), c(r, { key: 1 }, [R.value.loading ? (b(), c("p", de, E(j.value.rootLoading), 1)) : R.value.error ? (b(), c("p", fe, E(R.value.error), 1)) : R.value.entries.length ? (b(), c(r, { key: 3 }, [(b(!0), c(r, null, C(R.value.entries, (r) => (b(), o(ce, {
				key: e.keyOf(r),
				node: r,
				depth: 0,
				expanded: P,
				cache: F,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: B,
				onPick: n[1] ||= (e) => D("pick", e),
				onContext: Y
			}, {
				"row-before-label": A((e) => [w(t.$slots, "row-before-label", p({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": A((e) => [w(t.$slots, "row-after-label", p({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), R.value.truncated ? (b(), c("p", me, E(j.value.truncated), 1)) : s("", !0)], 64)) : (b(), c("p", pe, E(j.value.rootEmpty), 1))], 64)), (b(), o(i, { to: "body" }, [W.open ? (b(), c("div", {
				key: 0,
				ref_key: "menuRef",
				ref: G,
				class: "ft-menu",
				style: _({
					left: W.x + "px",
					top: W.y + "px"
				}),
				onContextmenu: n[4] ||= M(() => {}, ["prevent"])
			}, [
				l("button", {
					class: "ft-item",
					type: "button",
					disabled: !q.value,
					onClick: n[2] ||= (e) => Z("rel")
				}, [d(a, { size: "16" }, {
					default: A(() => [...n[5] ||= [u("mdi-content-copy", -1)]]),
					_: 1
				}), l("span", null, E(W.copied === "rel" ? j.value.copied : j.value.copyRel), 1)], 8, he),
				e.rootPath ? (b(), c("button", {
					key: 0,
					class: "ft-item",
					type: "button",
					onClick: n[3] ||= (e) => Z("abs")
				}, [d(a, { size: "16" }, {
					default: A(() => [...n[6] ||= [u("mdi-link-variant", -1)]]),
					_: 1
				}), l("span", null, E(W.copied === "abs" ? j.value.copied : j.value.copyAbs), 1)])) : s("", !0),
				e.downloadOf ? (b(), c("button", {
					key: 1,
					class: "ft-item",
					type: "button",
					onClick: ie
				}, [d(a, { size: "16" }, {
					default: A(() => [u(E(J.value ? "mdi-folder-zip-outline" : "mdi-download"), 1)]),
					_: 1
				}), l("span", null, E(J.value ? j.value.downloadDir : j.value.downloadFile), 1)])) : s("", !0)
			], 36)) : s("", !0)]))]);
		};
	}
}, [["__scopeId", "data-v-e8af4780"]]), _e = { class: "edit-body" }, ve = { class: "edit-stage" }, ye = {
	class: "layer-code",
	"aria-hidden": "true"
}, be = ["innerHTML"], xe = ["value", "onKeydown"], Se = /*#__PURE__*/ e({
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
		let i = e, a = n, o = S(null), s = S(null), u = S(null);
		function d(e) {
			s.value && (s.value.style.transform = `translate(${-e.scrollLeft}px, ${-e.scrollTop}px)`), o.value && (o.value.scrollTop = e.scrollTop);
		}
		function f(e) {
			d(e.target);
		}
		function p(e) {
			let t = e.target, n = t.selectionStart, r = t.selectionEnd;
			a("update:modelValue", `${i.modelValue.slice(0, n)}    ${i.modelValue.slice(r)}`), m(() => {
				t.selectionStart = n + 4, t.selectionEnd = n + 4;
			});
		}
		function h() {
			let e = u.value;
			e && (e.scrollTop = 0, e.scrollLeft = 0, d(e));
		}
		async function g(e) {
			await m();
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
		}), (t, n) => (b(), c("div", _e, [l("div", {
			ref_key: "gutterRef",
			ref: o,
			class: "gutter",
			"aria-hidden": "true"
		}, [(b(!0), c(r, null, C(e.lineCount, (e) => (b(), c("div", {
			key: e,
			class: "ln"
		}, E(e), 1))), 128))], 512), l("div", ve, [l("pre", ye, [l("code", {
			ref_key: "codeRef",
			ref: s,
			innerHTML: e.highlighted
		}, null, 8, be)]), l("textarea", {
			ref_key: "editorRef",
			ref: u,
			value: e.modelValue,
			class: "editor",
			wrap: "off",
			spellcheck: "false",
			onInput: n[0] ||= (e) => t.$emit("update:modelValue", e.target.value),
			onScroll: f,
			onKeydown: j(M(p, ["prevent"]), ["tab"])
		}, null, 40, xe)])]));
	}
}, [["__scopeId", "data-v-d7e19f41"]]), Ce = { class: "file-head" }, we = { class: "crumbs" }, Te = ["title", "onClick"], Ee = { class: "meta" }, De = /*#__PURE__*/ e({
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
		let n = e, i = t, o = a(() => {
			let e = String(n.path || "").split("/").filter(Boolean), t = "";
			return e.map((e) => (t = t ? `${t}/${e}` : e, {
				name: e,
				path: t
			}));
		}), s = a(() => {
			if (n.size === void 0 || n.size === null) return "";
			let e = Number(n.size) || 0;
			return e < 1024 ? `${e} 字节` : e < 1048576 ? `${(e / 1024).toFixed(1)} KB` : `${(e / 1024 / 1024).toFixed(1)} MB`;
		});
		function u(e, t) {
			t !== o.value.length - 1 && i("navigate", e.path);
		}
		return (t, n) => (b(), c("div", Ce, [l("nav", we, [l("button", {
			class: "seg",
			title: "回到根目录",
			onClick: n[0] ||= (e) => i("navigate", "")
		}, E(e.rootName), 1), (b(!0), c(r, null, C(o.value, (e, t) => (b(), c(r, { key: e.path }, [n[1] ||= l("span", { class: "sep" }, "/", -1), l("button", {
			class: h(["seg", { last: t === o.value.length - 1 }]),
			title: e.path,
			onClick: (n) => u(e, t)
		}, E(e.name), 11, Te)], 64))), 128))]), l("span", Ee, E(s.value), 1)]));
	}
}, [["__scopeId", "data-v-66fcb71a"]]), Oe = /*#__PURE__*/ e({
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
			let i = T("v-card-title"), a = T("v-card-text"), s = T("v-spacer"), c = T("v-btn"), f = T("v-card-actions"), p = T("v-card"), m = T("v-dialog");
			return b(), o(m, {
				"model-value": e.modelValue,
				"max-width": "440",
				"onUpdate:modelValue": r[2] ||= (e) => !e && n("answer", !1)
			}, {
				default: A(() => [d(p, null, {
					default: A(() => [
						d(i, null, {
							default: A(() => [...r[3] ||= [u("文件还没保存", -1)]]),
							_: 1
						}),
						d(a, null, {
							default: A(() => [u(E(e.path || "当前文件") + " ", 1), r[4] ||= l("p", { class: "tip" }, "换过去之后这次的修改就没了，要保留就先按 Ctrl+S 保存。", -1)]),
							_: 1
						}),
						d(f, null, {
							default: A(() => [
								d(s),
								d(c, {
									variant: "text",
									onClick: r[0] ||= (e) => n("answer", !1)
								}, {
									default: A(() => [...r[5] ||= [u("留在这里", -1)]]),
									_: 1
								}),
								d(c, {
									color: "error",
									variant: "flat",
									onClick: r[1] ||= (e) => n("answer", !0)
								}, {
									default: A(() => [...r[6] ||= [u("丢掉修改", -1)]]),
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
function ke({ loader: e, saver: r }) {
	let i = S(""), o = x({
		base: "",
		draft: "",
		loading: !1,
		error: "",
		saving: !1,
		saveError: ""
	}), s = 0, c = a(() => o.draft !== o.base), l = a(() => n(i.value)), u = a(() => o.draft.endsWith("\n") ? o.draft.slice(0, -1) : o.draft), d = a(() => o.draft.split("\n").length), f = a(() => t(u.value, l.value));
	async function p(t) {
		i.value = t;
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
		if (o.saving || !c.value || !i.value) return null;
		let e = i.value;
		o.saving = !0, o.saveError = "";
		try {
			let t = await r(e, o.draft);
			return i.value === e && (o.base = o.draft), t;
		} catch (t) {
			return i.value === e && (o.saveError = t.message), null;
		} finally {
			o.saving = !1;
		}
	}
	function h() {
		s += 1, i.value = "", o.base = "", o.draft = "", o.loading = !1, o.error = "", o.saving = !1, o.saveError = "";
	}
	return {
		path: i,
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
var Ae = { class: "file-editor" }, je = {
	key: 1,
	class: "hint"
}, Me = {
	key: 2,
	class: "hint bad"
}, Ne = {
	key: 3,
	class: "edit-wrap"
}, Pe = {
	key: 0,
	class: "hint bad edit-error"
}, Fe = {
	key: 4,
	class: "none"
}, Ie = /*#__PURE__*/ e({
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
		let r = e, i = n, { path: a, state: l, dirty: u, lineCount: f, highlighted: p, load: h, save: g, reset: _ } = ke({
			loader: r.loader,
			saver: r.saver
		}), y = S(null), x = S(!1), C = null;
		async function w(e, t = 0) {
			return await h(e) ? (await m(), y.value?.resetScroll(), t && y.value?.locate(t), !0) : !1;
		}
		async function T() {
			return !a.value || !await h(a.value) ? !1 : (await m(), y.value?.resetScroll(), !0);
		}
		function O() {
			j(), _();
		}
		function k() {
			return u.value ? x.value ? Promise.resolve(!1) : (x.value = !0, new Promise((e) => {
				C = e;
			})) : Promise.resolve(!0);
		}
		function A(e) {
			if (x.value = !1, !C) return;
			let t = C;
			C = null, t(e);
		}
		function j() {
			A(!1);
		}
		return v(() => A(!1)), t({
			open: w,
			reload: T,
			close: O,
			save: g,
			confirmLeave: k,
			cancelLeave: j,
			dirty: u
		}), (t, n) => (b(), c("section", Ae, [
			D(a) ? (b(), o(De, {
				key: 0,
				"root-name": e.rootName,
				path: D(a),
				size: e.size,
				onNavigate: n[0] ||= (e) => i("navigate", e)
			}, null, 8, [
				"root-name",
				"path",
				"size"
			])) : s("", !0),
			D(l).loading ? (b(), c("p", je, "正在读取文件…")) : D(l).error ? (b(), c("p", Me, E(D(l).error), 1)) : D(a) ? (b(), c("div", Ne, [D(l).saveError ? (b(), c("p", Pe, E(D(l).saveError), 1)) : s("", !0), d(Se, {
				ref_key: "paneRef",
				ref: y,
				modelValue: D(l).draft,
				"onUpdate:modelValue": n[1] ||= (e) => D(l).draft = e,
				highlighted: D(p),
				"line-count": D(f)
			}, null, 8, [
				"modelValue",
				"highlighted",
				"line-count"
			])])) : (b(), c("div", Fe, "从左边选一个文件，右边显示它的内容。")),
			d(Oe, {
				"model-value": x.value,
				path: D(a),
				onAnswer: A
			}, null, 8, ["model-value", "path"])
		]));
	}
}, [["__scopeId", "data-v-bbe4c0a6"]]), Le = ["title"], Re = /*#__PURE__*/ e({
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
		return (t, n) => (b(), c("div", {
			class: h(["handle", [e.axis, {
				active: !e.disabled && e.active,
				disabled: e.disabled
			}]]),
			title: e.disabled ? "" : e.title,
			onPointerdown: i,
			onDblclick: a
		}, [...n[0] ||= [l("span", { class: "grip" }, null, -1)]], 42, Le));
	}
}, [["__scopeId", "data-v-84f2ac99"]]), ze = "dvcsx-resizing";
function Be({ area: e, initial: t, min: n = 0, max: r = 100, rightMin: i = 0, axis: a = "x", unit: o = "px", persist: s = "" }) {
	let c = S(f()), l = S(!1), u = 0, d = 0;
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
		l.value && (l.value = !1, window.removeEventListener("pointermove", m), document.body.classList.remove(ze));
	}
	function g(t) {
		t.button === 0 && e.value && (l.value = !0, u = a === "x" ? t.clientX : t.clientY, d = c.value, t.preventDefault(), document.body.classList.add(ze), window.addEventListener("pointermove", m), window.addEventListener("pointerup", h, { once: !0 }));
	}
	function _() {
		c.value = t;
	}
	return O(c, (e) => {
		if (s) try {
			window.localStorage.setItem(s, String(e));
		} catch {}
	}), v(h), {
		size: c,
		resizing: l,
		start: g,
		stop: h,
		reset: _
	};
}
// src/composables/useFileTree.js
function Ve(e, t = () => ({})) {
	let n = x({});
	function r() {
		let t = typeof e == "function" ? e() : D(e);
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
	let c = a(() => s(i(r()), 0));
	function l(e) {
		n[e] = !n[e];
	}
	return {
		rows: c,
		collapsed: n,
		toggle: l
	};
}
export { V as DirectoryNode, ne as DirectoryPicker, Ie as FileEditor, ge as FileTree, F as LogView, Re as SplitHandle, le as copyText, X as fileIcon, Ve as useFileTree, Be as useSplitPane };
