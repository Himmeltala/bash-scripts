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
}, V = {
	key: 0,
	class: "hint"
}, H = /*#__PURE__*/ e({
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
			]))), 128)), e.node.children.length ? s("", !0) : (b(), c("p", V, "没有子目录"))], 64)) : s("", !0)])) : s("", !0)]);
		};
	}
}, [["__scopeId", "data-v-3e5909ab"]]), ee = { class: "picker" }, U = {
	key: 0,
	class: "tip"
}, W = { class: "tree" }, G = { class: "root" }, K = ["title"], q = {
	key: 0,
	class: "hint bad"
}, J = {
	key: 0,
	class: "hint"
}, te = /*#__PURE__*/ e({
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
			return b(), c("div", ee, [
				e.tip ? (b(), c("p", U, E(e.tip), 1)) : s("", !0),
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
				l("div", W, [l("div", G, [
					d(a, { size: "18" }, {
						default: A(() => [...n[1] ||= [u("mdi-home-outline", -1)]]),
						_: 1
					}),
					l("span", {
						class: "root-label",
						title: f.value || "~"
					}, "~", 8, K),
					m.value ? (b(), o(y, {
						key: 0,
						size: "12",
						width: "2",
						indeterminate: ""
					})) : s("", !0)
				]), h.value ? (b(), c("p", q, E(h.value), 1)) : p.value ? (b(), c(r, { key: 1 }, [(b(!0), c(r, null, C(p.value, (t) => (b(), o(H, {
					key: t.path,
					node: t,
					selected: _.value,
					loader: e.loader,
					onPick: x
				}, null, 8, [
					"node",
					"selected",
					"loader"
				]))), 128)), p.value.length ? s("", !0) : (b(), c("p", J, "家目录下没有子目录"))], 64)) : s("", !0)])
			]);
		};
	}
}, [["__scopeId", "data-v-39d6d557"]]), Y = {
	icon: "mdi-file-outline",
	color: ""
}, X = {
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
}, Z = {
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
	let t = String(e || "").split("/").pop().toLowerCase(), n = X[t];
	if (n) return n;
	let r = t.lastIndexOf(".");
	return r < 0 ? Y : Z[t.slice(r + 1)] || Y;
}
// src/components/FileTree/FileTreeNode.vue
var ne = { class: "branch" }, re = {
	key: 1,
	class: "arrow-space"
}, ie = ["title"], ae = {
	key: 0,
	class: "hint"
}, $ = {
	key: 1,
	class: "hint bad"
}, oe = {
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
		}, v = a(() => n.keyOf(n.node)), y = a(() => n.dirOf(n.node)), x = a(() => n.expanded[v.value] === !0), S = a(() => n.cache[v.value] || g), D = a(() => y.value ? null : Q(n.nameOf(n.node))), O = a(() => y.value ? x.value ? "mdi-folder-open-outline" : "mdi-folder-outline" : D.value.icon), k = a(() => y.value ? null : D.value.color ? { color: D.value.color } : null);
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
			return b(), c("div", ne, [l("div", {
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
				}, 8, ["title"])) : (b(), c("span", re)),
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
				}, E(e.nameOf(e.node)), 11, ie),
				w(t.$slots, "row-after-label", {
					node: e.node,
					open: x.value,
					state: S.value
				}, void 0, !0)
			], 38), y.value && x.value ? (b(), c(r, { key: 0 }, [S.value.loading ? (b(), c("p", ae, E(m.value.loading), 1)) : S.value.error ? (b(), c("p", $, E(S.value.error), 1)) : S.value.entries.length ? (b(), c(r, { key: 3 }, [(b(!0), c(r, null, C(S.value.entries, (r) => (b(), o(g, {
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
			]))), 128)), S.value.truncated ? (b(), c("p", se, E(m.value.truncated), 1)) : s("", !0)], 64)) : (b(), c("p", oe, E(m.value.empty), 1))], 64)) : s("", !0)]);
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
		async function V(e) {
			P[L.value] = !0, await z(L.value);
			let t = L.value;
			for (let n of String(e || "").split("/").filter(Boolean)) t = t ? `${t}/${n}` : n, await z(t), P[t] = !0;
		}
		function H() {
			for (let e of Object.keys(F)) delete F[e];
			for (let e of Object.keys(P)) delete P[e];
			P[L.value] = !0, z(L.value);
		}
		async function ee(e) {
			await z(e, !0);
		}
		async function U() {
			await Promise.all(Object.keys(F).map((e) => z(e, !0)));
		}
		function W() {
			h.active && !I.value && (I.value = !0, P[L.value] = !0, z(L.value));
		}
		h.active && W(), y(W), O(() => h.active, (e) => {
			e && W();
		});
		let G = x({
			open: !1,
			x: 0,
			y: 0,
			node: null,
			copied: ""
		}), K = S(null), q = 0, J = a(() => G.node ? String(h.keyOf(G.node) || "") : ""), te = a(() => {
			if (!G.node || !h.rootPath) return "";
			let e = h.rootPath.replace(/\/+$/, ""), t = J.value;
			return t ? `${e}/${t}` : e;
		}), Y = a(() => G.node ? h.dirOf(G.node) : !1);
		function X({ node: e, event: t }) {
			G.node = e, G.copied = "", G.x = t.clientX, G.y = t.clientY, G.open = !0, m(Z);
		}
		function Z() {
			if (!K.value) return;
			let e = K.value.offsetWidth, t = K.value.offsetHeight;
			G.x = Math.max(6, Math.min(G.x, window.innerWidth - e - 6)), G.y = Math.max(6, Math.min(G.y, window.innerHeight - t - 6));
		}
		function Q() {
			G.open = !1, G.node = null, G.copied = "", clearTimeout(q);
		}
		async function ne(e) {
			let t = e === "abs" ? te.value : J.value;
			t && await le(t) && (G.copied = e, clearTimeout(q), q = setTimeout(Q, 700));
		}
		function re() {
			if (!G.node || !h.downloadOf) return;
			let e = G.node, t = h.downloadOf(e);
			if (Q(), !t) return;
			let n = h.nameOf(e) || "download", r = document.createElement("a");
			r.href = t, r.download = h.dirOf(e) ? `${n}.zip` : n, r.rel = "noopener", r.style.display = "none", document.body.appendChild(r), r.click(), r.remove();
		}
		function ie(e) {
			K.value && !K.value.contains(e.target) && Q();
		}
		function ae(e) {
			e.key === "Escape" && Q();
		}
		function $() {
			G.open && Q();
		}
		function oe(e) {
			let t = e ? "addEventListener" : "removeEventListener";
			document[t]("mousedown", ie, !0), document[t]("keydown", ae, !0), window[t]("scroll", $, !0), window[t]("resize", $);
		}
		return O(() => G.open, (e) => oe(e)), v(() => {
			Q(), oe(!1);
		}), t({
			reveal: V,
			reload: H,
			reloadDir: ee,
			refreshAll: U,
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
				onContext: X
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
				onContext: X
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
			]))), 128)), R.value.truncated ? (b(), c("p", me, E(j.value.truncated), 1)) : s("", !0)], 64)) : (b(), c("p", pe, E(j.value.rootEmpty), 1))], 64)), (b(), o(i, { to: "body" }, [G.open ? (b(), c("div", {
				key: 0,
				ref_key: "menuRef",
				ref: K,
				class: "ft-menu",
				style: _({
					left: G.x + "px",
					top: G.y + "px"
				}),
				onContextmenu: n[4] ||= M(() => {}, ["prevent"])
			}, [
				l("button", {
					class: "ft-item",
					type: "button",
					disabled: !J.value,
					onClick: n[2] ||= (e) => ne("rel")
				}, [d(a, { size: "16" }, {
					default: A(() => [...n[5] ||= [u("mdi-content-copy", -1)]]),
					_: 1
				}), l("span", null, E(G.copied === "rel" ? j.value.copied : j.value.copyRel), 1)], 8, he),
				e.rootPath ? (b(), c("button", {
					key: 0,
					class: "ft-item",
					type: "button",
					onClick: n[3] ||= (e) => ne("abs")
				}, [d(a, { size: "16" }, {
					default: A(() => [...n[6] ||= [u("mdi-link-variant", -1)]]),
					_: 1
				}), l("span", null, E(G.copied === "abs" ? j.value.copied : j.value.copyAbs), 1)])) : s("", !0),
				e.downloadOf ? (b(), c("button", {
					key: 1,
					class: "ft-item",
					type: "button",
					onClick: re
				}, [d(a, { size: "16" }, {
					default: A(() => [u(E(Y.value ? "mdi-folder-zip-outline" : "mdi-download"), 1)]),
					_: 1
				}), l("span", null, E(Y.value ? j.value.downloadDir : j.value.downloadFile), 1)])) : s("", !0)
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
		return (t, n) => (b(), c("div", Ce, [
			l("nav", we, [l("button", {
				class: "seg",
				title: "回到根目录",
				onClick: n[0] ||= (e) => i("navigate", "")
			}, E(e.rootName), 1), (b(!0), c(r, null, C(o.value, (e, t) => (b(), c(r, { key: e.path }, [n[1] ||= l("span", { class: "sep" }, "/", -1), l("button", {
				class: h(["seg", { last: t === o.value.length - 1 }]),
				title: e.path,
				onClick: (n) => u(e, t)
			}, E(e.name), 11, Te)], 64))), 128))]),
			l("span", Ee, E(s.value), 1),
			w(t.$slots, "actions", {}, void 0, !0)
		]));
	}
}, [["__scopeId", "data-v-e11d23ba"]]), Oe = /*#__PURE__*/ e({
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
		o.saving || (o.draft = o.base, o.saveError = "");
	}
	function g() {
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
		discard: h,
		reset: g
	};
}
// src/components/FileEditor/FileEditor.vue
var Ae = { class: "file-editor" }, je = {
	key: 0,
	class: "actions"
}, Me = {
	key: 1,
	class: "hint"
}, Ne = {
	key: 2,
	class: "hint bad"
}, Pe = {
	key: 3,
	class: "edit-wrap"
}, Fe = {
	key: 0,
	class: "hint bad edit-error"
}, Ie = {
	key: 4,
	class: "none"
}, Le = /*#__PURE__*/ e({
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
		let r = e, i = n, { path: a, state: l, dirty: f, lineCount: p, highlighted: h, load: g, save: _, discard: y, reset: x } = ke({
			loader: r.loader,
			saver: r.saver
		}), C = S(null);
		async function w() {
			let e = a.value, t = await _();
			return t && i("saved", {
				path: e,
				data: t
			}), t;
		}
		function O() {
			y();
		}
		let k = S(!1), j = null;
		async function M(e, t = 0) {
			return await g(e) ? (await m(), C.value?.resetScroll(), t && C.value?.locate(t), !0) : !1;
		}
		async function N() {
			return !a.value || !await g(a.value) ? !1 : (await m(), C.value?.resetScroll(), !0);
		}
		function P() {
			L(), x();
		}
		function F() {
			return f.value ? k.value ? Promise.resolve(!1) : (k.value = !0, new Promise((e) => {
				j = e;
			})) : Promise.resolve(!0);
		}
		function I(e) {
			if (k.value = !1, !j) return;
			let t = j;
			j = null, t(e);
		}
		function L() {
			I(!1);
		}
		return v(() => I(!1)), t({
			open: M,
			reload: N,
			close: P,
			save: w,
			discard: O,
			confirmLeave: F,
			cancelLeave: L,
			dirty: f
		}), (t, n) => {
			let r = T("v-chip"), m = T("v-btn");
			return b(), c("section", Ae, [
				D(a) ? (b(), o(De, {
					key: 0,
					"root-name": e.rootName,
					path: D(a),
					size: e.size,
					onNavigate: n[0] ||= (e) => i("navigate", e)
				}, {
					actions: A(() => [D(f) && !D(l).loading ? (b(), c("div", je, [
						d(r, {
							size: "x-small",
							variant: "flat",
							color: "warning"
						}, {
							default: A(() => [...n[2] ||= [u("未保存", -1)]]),
							_: 1
						}),
						d(m, {
							size: "small",
							variant: "text",
							color: "primary",
							loading: D(l).saving,
							onClick: w
						}, {
							default: A(() => [...n[3] ||= [u(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"]),
						d(m, {
							size: "small",
							variant: "text",
							disabled: D(l).saving,
							onClick: O
						}, {
							default: A(() => [...n[4] ||= [u(" 放弃 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					])) : s("", !0)]),
					_: 1
				}, 8, [
					"root-name",
					"path",
					"size"
				])) : s("", !0),
				D(l).loading ? (b(), c("p", Me, "正在读取文件…")) : D(l).error ? (b(), c("p", Ne, E(D(l).error), 1)) : D(a) ? (b(), c("div", Pe, [D(l).saveError ? (b(), c("p", Fe, E(D(l).saveError), 1)) : s("", !0), d(Se, {
					ref_key: "paneRef",
					ref: C,
					modelValue: D(l).draft,
					"onUpdate:modelValue": n[1] ||= (e) => D(l).draft = e,
					highlighted: D(h),
					"line-count": D(p)
				}, null, 8, [
					"modelValue",
					"highlighted",
					"line-count"
				])])) : (b(), c("div", Ie, "从左边选一个文件，右边显示它的内容。")),
				d(Oe, {
					"model-value": k.value,
					path: D(a),
					onAnswer: I
				}, null, 8, ["model-value", "path"])
			]);
		};
	}
}, [["__scopeId", "data-v-2445702a"]]);
// src/composables/useDialogLayout.js
function Re(e) {
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
var ze = /*#__PURE__*/ e({
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
		let n = e, r = t, i = Re(n.storage), c = i.get(n.storageKey), u = S(c ? {
			w: c.w,
			h: c.h
		} : x()), f = S(c ? {
			x: c.x,
			y: c.y
		} : {
			x: 0,
			y: 0
		}), p = S(!!c), m = S(!1), g = null, _ = a(() => ({
			position: "fixed",
			left: `${f.value.x}px`,
			top: `${f.value.y}px`,
			margin: "0"
		}));
		function y(e, t, n) {
			return Math.min(Math.max(e, t), n);
		}
		function x() {
			return {
				w: Math.min(n.initialWidth, Math.max(n.minWidth, window.innerWidth - 48)),
				h: Math.min(n.initialHeight, Math.max(n.minHeight, window.innerHeight - 48))
			};
		}
		function C() {
			f.value = {
				x: Math.max(0, Math.round((window.innerWidth - u.value.w) / 2)),
				y: Math.max(0, Math.round((window.innerHeight - u.value.h) / 2))
			};
		}
		function E() {
			f.value = {
				x: y(f.value.x, 0, Math.max(0, window.innerWidth - u.value.w)),
				y: y(f.value.y, 0, Math.max(0, window.innerHeight - u.value.h))
			};
		}
		O(() => n.modelValue, (e) => {
			e && (u.value = {
				w: y(u.value.w, n.minWidth, Math.max(n.minWidth, window.innerWidth - 48)),
				h: y(u.value.h, n.minHeight, Math.max(n.minHeight, window.innerHeight - 48))
			}, p.value ? E() : C());
		}, { immediate: !0 });
		function D(e) {
			e.button === 0 && (e.target.closest("button, a, input, textarea, select, [role=\"button\"]") || (e.preventDefault(), j("move", e)));
		}
		function k(e) {
			e.button === 0 && (e.preventDefault(), j("resize", e));
		}
		function j(e, t) {
			g = {
				mode: e,
				x: t.clientX,
				y: t.clientY,
				px: f.value.x,
				py: f.value.y,
				w: u.value.w,
				h: u.value.h
			}, m.value = !0, document.body.style.userSelect = "none", window.addEventListener("pointermove", M), window.addEventListener("pointerup", N, { once: !0 });
		}
		function M(e) {
			if (!g) return;
			let t = e.clientX - g.x, r = e.clientY - g.y;
			if (p.value = !0, g.mode === "move") {
				f.value = {
					x: y(g.px + t, 0, Math.max(0, window.innerWidth - u.value.w)),
					y: y(g.py + r, 0, Math.max(0, window.innerHeight - u.value.h))
				};
				return;
			}
			let i = Math.max(n.minWidth, Math.min(window.innerWidth - 48, window.innerWidth - f.value.x)), a = Math.max(n.minHeight, Math.min(window.innerHeight - 48, window.innerHeight - f.value.y));
			u.value = {
				w: y(g.w + t, n.minWidth, i),
				h: y(g.h + r, n.minHeight, a)
			};
		}
		function N() {
			let e = g !== null;
			g = null, m.value = !1, document.body.style.userSelect = "", window.removeEventListener("pointermove", M), e && P();
		}
		function P() {
			i.remember(n.storageKey, {
				x: f.value.x,
				y: f.value.y,
				w: u.value.w,
				h: u.value.h
			});
		}
		function F() {
			p.value = !1, C(), P();
		}
		return v(N), (t, n) => {
			let i = T("v-card-title"), a = T("v-card-text"), c = T("v-card-actions"), f = T("v-card"), p = T("v-dialog");
			return b(), o(p, {
				"model-value": e.modelValue,
				width: u.value.w,
				height: u.value.h,
				"content-props": { style: _.value },
				scrollable: "",
				"onUpdate:modelValue": n[0] ||= (e) => r("update:modelValue", e)
			}, {
				default: A(() => [d(f, { class: h(["dialog", { moving: m.value }]) }, {
					default: A(() => [
						d(i, {
							class: "title d-flex align-center",
							title: "拖动标题移动窗口，双击回到屏幕中间",
							onPointerdown: D,
							onDblclick: F
						}, {
							default: A(() => [w(t.$slots, "title", {}, void 0, !0)]),
							_: 3
						}),
						d(a, { class: "body" }, {
							default: A(() => [w(t.$slots, "default", {}, void 0, !0)]),
							_: 3
						}),
						t.$slots.actions ? (b(), o(c, { key: 0 }, {
							default: A(() => [w(t.$slots, "actions", {}, void 0, !0)]),
							_: 3
						})) : s("", !0),
						l("span", {
							class: "resize-grip",
							title: "拖动调整窗口大小",
							onPointerdown: k
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
}, [["__scopeId", "data-v-a20ede5c"]]), Be = { class: "list" }, Ve = { class: "head" }, He = { class: "head-title" }, Ue = {
	key: 0,
	class: "none"
}, We = { class: "tip" }, Ge = { class: "tip" }, Ke = { class: "tip" }, qe = /*#__PURE__*/ e({
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
		let n = e, i = {
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
			removeText: "登记的服务与日志一起删掉，正在跑的进程会先停掉。工程目录本身不动。",
			removeConfirm: "移出"
		}, f = a(() => ({
			...i,
			...n.texts
		})), p = t, m = S(!1), h = S(""), g = S(!1), O = S(0), k = S(null), N = x({
			open: !1,
			x: 0,
			y: 0,
			ws: null
		}), P = S(!1), F = S(null), I = S(""), L = S(!1);
		function R(e, t) {
			N.x = Math.max(8, Math.min(e.clientX, window.innerWidth - 190)), N.y = Math.max(8, Math.min(e.clientY, window.innerHeight - 130)), N.ws = t, N.open = !0;
		}
		function z() {
			N.open = !1;
		}
		function B(e) {
			F.value = e, I.value = e.alias || "", P.value = !0, z();
		}
		async function V() {
			if (F.value) {
				L.value = !0;
				try {
					await n.saveAlias(F.value.id, (I.value || "").trim()), P.value = !1, p("changed"), p("notice", {
						text: f.value.aliasSaved,
						color: "primary"
					});
				} catch (e) {
					p("notice", {
						text: `${f.value.aliasFailed}${e.message}`,
						color: "error"
					});
				} finally {
					L.value = !1;
				}
			}
		}
		async function H(e, t) {
			let n = t === "rel" && e.rel || e.root, r = await le(n);
			p("notice", {
				text: r ? `${f.value.copied}${n}` : f.value.copyFailed,
				color: r ? "primary" : "error"
			}), z();
		}
		y(() => {
			document.addEventListener("click", z), document.addEventListener("contextmenu", z), window.addEventListener("resize", z), window.addEventListener("blur", z);
		}), v(() => {
			document.removeEventListener("click", z), document.removeEventListener("contextmenu", z), window.removeEventListener("resize", z), window.removeEventListener("blur", z);
		});
		function ee(e) {
			let t = String(e || "").split("/").filter(Boolean);
			return t.length ? t[t.length - 1] : e;
		}
		function U() {
			h.value = "", g.value = !1, O.value += 1, m.value = !0;
		}
		function W() {
			let e = h.value.trim();
			e && (m.value = !1, p("add", e));
		}
		function G(e) {
			k.value = e;
		}
		function K() {
			let e = k.value;
			k.value = null, e && p("remove", e.id);
		}
		return (t, n) => {
			let i = T("v-btn"), a = T("v-list-item-title"), p = T("v-list-item-subtitle"), v = T("v-icon"), y = T("v-list-item"), x = T("v-list"), S = T("v-card-title"), z = T("v-text-field"), q = T("v-card-text"), J = T("v-spacer"), Y = T("v-card-actions"), X = T("v-card"), Z = T("v-dialog");
			return b(), c("div", Be, [
				l("div", Ve, [l("span", He, E(f.value.headTitle), 1), d(i, {
					size: "small",
					variant: "text",
					color: "primary",
					"prepend-icon": "mdi-plus",
					loading: e.busy,
					onClick: U
				}, {
					default: A(() => [u(E(f.value.add), 1)]),
					_: 1
				}, 8, ["loading"])]),
				e.workspaces.length ? s("", !0) : (b(), c("div", Ue, E(f.value.empty), 1)),
				d(x, {
					density: "compact",
					nav: "",
					class: "items"
				}, {
					default: A(() => [(b(!0), c(r, null, C(e.workspaces, (r) => (b(), o(y, {
						key: r.id,
						active: r.id === e.current,
						"active-color": "primary",
						onClick: (e) => t.$emit("select", r.id),
						onContextmenu: M((e) => R(e, r), ["prevent", "stop"])
					}, {
						append: A(() => [d(i, {
							icon: !0,
							size: "x-small",
							variant: "text",
							title: f.value.forgetTitle,
							class: "forget",
							onClick: M((e) => G(r), ["stop"])
						}, {
							default: A(() => [d(v, { size: "18" }, {
								default: A(() => [...n[13] ||= [u("mdi-close", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["title", "onClick"])]),
						default: A(() => [d(a, {
							class: "name",
							title: r.alias ? r.root : ""
						}, {
							default: A(() => [u(E(r.alias || ee(r.root)) + " ", 1), w(t.$slots, "title-extra", { ws: r }, void 0, !0)]),
							_: 2
						}, 1032, ["title"]), d(p, {
							class: "path",
							title: r.url || r.root
						}, {
							default: A(() => [u(E(r.url || r.root), 1)]),
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
				N.open ? (b(), c("div", {
					key: 1,
					class: "ctxmenu",
					style: _({
						left: N.x + "px",
						top: N.y + "px"
					}),
					onClick: n[3] ||= M(() => {}, ["stop"])
				}, [
					l("button", {
						type: "button",
						class: "ctxitem",
						onClick: n[0] ||= (e) => B(N.ws)
					}, [d(v, { size: "16" }, {
						default: A(() => [...n[14] ||= [u("mdi-rename-box", -1)]]),
						_: 1
					}), u(E(f.value.menuAlias), 1)]),
					l("button", {
						type: "button",
						class: "ctxitem",
						onClick: n[1] ||= (e) => H(N.ws, "rel")
					}, [d(v, { size: "16" }, {
						default: A(() => [...n[15] ||= [u("mdi-content-copy", -1)]]),
						_: 1
					}), u(E(f.value.copyRel), 1)]),
					l("button", {
						type: "button",
						class: "ctxitem",
						onClick: n[2] ||= (e) => H(N.ws, "abs")
					}, [d(v, { size: "16" }, {
						default: A(() => [...n[16] ||= [u("mdi-content-copy", -1)]]),
						_: 1
					}), u(E(f.value.copyAbs), 1)])
				], 4)) : s("", !0),
				d(Z, {
					modelValue: P.value,
					"onUpdate:modelValue": n[6] ||= (e) => P.value = e,
					"max-width": "460"
				}, {
					default: A(() => [d(X, null, {
						default: A(() => [
							d(S, null, {
								default: A(() => [u(E(f.value.aliasTitle), 1)]),
								_: 1
							}),
							d(q, null, {
								default: A(() => [
									l("p", We, E(F.value ? F.value.root : ""), 1),
									d(z, {
										modelValue: I.value,
										"onUpdate:modelValue": n[4] ||= (e) => I.value = e,
										label: "别名",
										density: "compact",
										variant: "outlined",
										maxlength: "80",
										clearable: "",
										autofocus: "",
										onKeyup: j(V, ["enter"])
									}, null, 8, ["modelValue"]),
									l("p", Ge, E(f.value.aliasHint), 1)
								]),
								_: 1
							}),
							d(Y, null, {
								default: A(() => [
									d(J),
									d(i, {
										variant: "text",
										onClick: n[5] ||= (e) => P.value = !1
									}, {
										default: A(() => [...n[17] ||= [u("取消", -1)]]),
										_: 1
									}),
									d(i, {
										color: "primary",
										variant: "flat",
										loading: L.value,
										onClick: V
									}, {
										default: A(() => [...n[18] ||= [u(" 保存 ", -1)]]),
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
				d(Z, {
					modelValue: m.value,
					"onUpdate:modelValue": n[10] ||= (e) => m.value = e,
					"max-width": "620"
				}, {
					default: A(() => [d(X, null, {
						default: A(() => [
							d(S, null, {
								default: A(() => [u(E(f.value.addTitle), 1)]),
								_: 1
							}),
							d(q, null, {
								default: A(() => [(b(), o(D(te), {
									key: O.value,
									modelValue: h.value,
									"onUpdate:modelValue": n[7] ||= (e) => h.value = e,
									tip: f.value.addTip,
									label: f.value.addLabel,
									placeholder: f.value.addPlaceholder,
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
							d(Y, null, {
								default: A(() => [
									d(J),
									d(i, {
										variant: "text",
										onClick: n[9] ||= (e) => m.value = !1
									}, {
										default: A(() => [...n[19] ||= [u("取消", -1)]]),
										_: 1
									}),
									d(i, {
										color: "primary",
										variant: "flat",
										disabled: !h.value.trim() || !g.value,
										onClick: W
									}, {
										default: A(() => [u(E(f.value.addConfirm), 1)]),
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
				d(Z, {
					modelValue: k.value,
					"onUpdate:modelValue": n[12] ||= (e) => k.value = e,
					"max-width": "440"
				}, {
					default: A(() => [d(X, null, {
						default: A(() => [
							d(S, null, {
								default: A(() => [u(E(f.value.removeTitle), 1)]),
								_: 1
							}),
							d(q, null, {
								default: A(() => [u(E(k.value ? k.value.root : "") + " ", 1), l("p", Ke, E(f.value.removeText), 1)]),
								_: 1
							}),
							d(Y, null, {
								default: A(() => [
									d(J),
									d(i, {
										variant: "text",
										onClick: n[11] ||= (e) => k.value = null
									}, {
										default: A(() => [...n[20] ||= [u("取消", -1)]]),
										_: 1
									}),
									d(i, {
										color: "error",
										variant: "flat",
										onClick: K
									}, {
										default: A(() => [u(E(f.value.removeConfirm), 1)]),
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
}, [["__scopeId", "data-v-a69204f0"]]), Je = ["title"], Ye = /*#__PURE__*/ e({
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
		}, [...n[0] ||= [l("span", { class: "grip" }, null, -1)]], 42, Je));
	}
}, [["__scopeId", "data-v-84f2ac99"]]), Xe = "web-shared-resizing";
function Ze({ area: e, initial: t, min: n = 0, max: r = 100, rightMin: i = 0, axis: a = "x", unit: o = "px", persist: s = "" }) {
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
		l.value && (l.value = !1, window.removeEventListener("pointermove", m), document.body.classList.remove(Xe));
	}
	function g(t) {
		t.button === 0 && e.value && (l.value = !0, u = a === "x" ? t.clientX : t.clientY, d = c.value, t.preventDefault(), document.body.classList.add(Xe), window.addEventListener("pointermove", m), window.addEventListener("pointerup", h, { once: !0 }));
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
function Qe(e, t = () => ({})) {
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
export { H as DirectoryNode, te as DirectoryPicker, Le as FileEditor, ge as FileTree, ze as FloatingDialog, F as LogView, Ye as SplitHandle, qe as WorkspaceList, le as copyText, Q as fileIcon, Qe as useFileTree, Ze as useSplitPane };
