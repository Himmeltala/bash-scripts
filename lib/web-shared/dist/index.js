import { t as e } from "./_plugin-vue_export-helper.js";
import { n as t, r as n, t as r } from "./useToast.js";
import { n as i, t as a } from "./SplitHandle.js";
import { languageOf as o } from "./highlight.js";
import { baseName as s } from "./format.js";
import { t as c } from "./Metrics2.js";
import { n as l, r as u } from "./theme2.js";
import { createJsonClient as d, encodeParam as f } from "./http.js";
import { symbolAt as p } from "./text.js";
import { Fragment as m, Teleport as h, computed as g, createBlock as _, createCommentVNode as v, createElementBlock as y, createElementVNode as b, createTextVNode as x, createVNode as S, getCurrentInstance as C, guardReactiveProps as w, mergeProps as T, nextTick as E, normalizeClass as D, normalizeProps as O, normalizeStyle as k, onBeforeUnmount as A, onMounted as j, openBlock as M, reactive as N, ref as P, renderList as F, renderSlot as I, resolveComponent as L, resolveDynamicComponent as ee, shallowRef as te, toDisplayString as R, unref as z, vShow as ne, watch as B, watchEffect as re, withCtx as V, withDirectives as ie, withKeys as ae, withModifiers as H } from "vue";
import { Terminal as oe } from "@xterm/xterm";
import { FitAddon as se } from "@xterm/addon-fit";
import { useLocalStorage as ce } from "@vueuse/core";
var U = /*#__PURE__*/ e({
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
		}, r = P(null), i = null, a = null, o = null, s = "";
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
		return j(() => {
			i = new oe({
				convertEol: !0,
				disableStdin: !0,
				cursorBlink: !1,
				scrollback: 5e3,
				fontFamily: "'JetBrains Mono', Roboto, 'Noto Sans SC', 'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
				fontSize: 12,
				lineHeight: 1.3,
				theme: c(t.dark)
			}), a = new se(), i.loadAddon(a), i.open(r.value), requestAnimationFrame(() => i && a.fit()), document.fonts && document.fonts.load("12px 'JetBrains Mono'").then(() => i && a.fit()).catch(() => {}), o = new ResizeObserver(() => {
				i && a.fit();
			}), o.observe(r.value), i.attachCustomKeyEventHandler(f), d(t.text || "");
		}), B(() => t.text, (e) => d(e || "")), B(() => t.dark, (e) => {
			i && (i.options.theme = c(e));
		}), A(() => {
			o && o.disconnect(), i && i.dispose(), o = null, i = null;
		}), (t, n) => (M(), y("div", {
			ref_key: "host",
			ref: r,
			class: D(["term", { deeper: e.dark }]),
			style: k(e.height ? {
				height: e.height,
				flex: "0 0 auto"
			} : null)
		}, null, 6));
	}
}, [["__scopeId", "data-v-619b1e01"]]), W = { class: "node" }, G = ["title"], le = {
	key: 0,
	class: "kids"
}, K = {
	key: 0,
	class: "hint"
}, q = {
	key: 1,
	class: "hint bad"
}, J = {
	key: 0,
	class: "hint"
}, Y = /*#__PURE__*/ e({
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
		let n = e, r = t, i = P(!1), a = P(!1), o = P(""), s = P(null);
		B(() => n.selected === n.node.path, (e) => {
			e && E(() => s.value && s.value.scrollIntoView({ block: "nearest" }));
		}, { immediate: !0 });
		async function c() {
			r("pick", n.node), i.value || (i.value = !0, await u());
		}
		async function l() {
			i.value = !i.value, i.value && await u();
		}
		async function u() {
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
			let r = L("v-icon"), u = L("v-btn"), d = L("DirectoryNode", !0);
			return M(), y("div", W, [b("div", {
				ref_key: "rowEl",
				ref: s,
				class: D(["row", { selected: e.node.path === e.selected }]),
				onClick: c
			}, [
				S(u, {
					icon: !0,
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: i.value ? "收起" : "展开",
					onClick: H(l, ["stop"])
				}, {
					default: V(() => [S(r, { size: "18" }, {
						default: V(() => [x(R(i.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"]),
				S(r, {
					size: "18",
					class: "folder"
				}, {
					default: V(() => [...n[1] ||= [x("mdi-folder-outline", -1)]]),
					_: 1
				}),
				b("span", {
					class: "label",
					title: e.node.path
				}, R(e.node.name), 9, G)
			], 2), i.value ? (M(), y("div", le, [a.value ? (M(), y("p", K, "正在读取…")) : o.value ? (M(), y("p", q, R(o.value), 1)) : e.node.children ? (M(), y(m, { key: 2 }, [(M(!0), y(m, null, F(e.node.children, (r) => (M(), _(d, {
				key: r.path,
				node: r,
				selected: e.selected,
				loader: e.loader,
				onPick: n[0] ||= (e) => t.$emit("pick", e)
			}, null, 8, [
				"node",
				"selected",
				"loader"
			]))), 128)), e.node.children.length ? v("", !0) : (M(), y("p", J, "没有子目录"))], 64)) : v("", !0)])) : v("", !0)]);
		};
	}
}, [["__scopeId", "data-v-9e855642"]]), ue = { class: "picker" }, X = {
	key: 0,
	class: "tip"
}, Z = { class: "tree" }, Q = { class: "root" }, de = ["title"], fe = {
	key: 0,
	class: "hint bad"
}, pe = {
	key: 0,
	class: "hint"
}, me = /*#__PURE__*/ e({
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
		let n = e, r = t, i = P(""), a = P(null), o = P(!0), s = P(""), c = g({
			get: () => n.modelValue,
			set: (e) => r("update:modelValue", e)
		}), l = g(() => {
			let e = String(n.modelValue || "").trim();
			return e === "~" ? e = i.value : e.startsWith("~/") && (e = i.value + e.slice(1)), e.replace(/\/+$/, "");
		}), u = g(() => !i.value || !l.value ? !1 : n.validate ? !!n.validate(l.value, i.value) : l.value === i.value || l.value.startsWith(i.value + "/"));
		re(() => r("update:valid", u.value));
		function d(e) {
			c.value = e.path;
		}
		return j(async () => {
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
			let r = L("v-text-field"), f = L("v-icon"), p = L("v-progress-circular");
			return M(), y("div", ue, [
				e.tip ? (M(), y("p", X, R(e.tip), 1)) : v("", !0),
				S(r, {
					modelValue: c.value,
					"onUpdate:modelValue": n[0] ||= (e) => c.value = e,
					label: e.label,
					placeholder: e.placeholder,
					"prepend-inner-icon": "mdi-folder",
					error: !!e.modelValue && !u.value,
					"error-messages": e.modelValue && !u.value ? e.invalidText : "",
					"hide-details": "auto",
					autofocus: ""
				}, null, 8, [
					"modelValue",
					"label",
					"placeholder",
					"error",
					"error-messages"
				]),
				b("div", Z, [b("div", Q, [
					S(f, { size: "18" }, {
						default: V(() => [...n[1] ||= [x("mdi-home-outline", -1)]]),
						_: 1
					}),
					b("span", {
						class: "root-label",
						title: i.value || "~"
					}, "~", 8, de),
					o.value ? (M(), _(p, {
						key: 0,
						size: "12",
						width: "2",
						indeterminate: ""
					})) : v("", !0)
				]), s.value ? (M(), y("p", fe, R(s.value), 1)) : a.value ? (M(), y(m, { key: 1 }, [(M(!0), y(m, null, F(a.value, (t) => (M(), _(Y, {
					key: t.path,
					node: t,
					selected: l.value,
					loader: e.loader,
					onPick: d
				}, null, 8, [
					"node",
					"selected",
					"loader"
				]))), 128)), a.value.length ? v("", !0) : (M(), y("p", pe, "家目录下没有子目录"))], 64)) : v("", !0)])
			]);
		};
	}
}, [["__scopeId", "data-v-a4b93ef9"]]), he = {
	icon: "mdi-file-outline",
	color: ""
}, ge = {
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
}, _e = {
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
function $(e) {
	let t = String(e || "").split("/").pop().toLowerCase(), n = ge[t];
	if (n) return n;
	let r = t.lastIndexOf(".");
	return r < 0 ? he : _e[t.slice(r + 1)] || he;
}
// src/components/commons/FileTree/FileTreeNode.vue
var ve = { class: "branch" }, ye = ["data-path", "data-type"], be = {
	key: 1,
	class: "arrow-space"
}, xe = ["title"], Se = {
	key: 0,
	class: "hint bad"
}, Ce = {
	key: 0,
	class: "hint"
}, we = /*#__PURE__*/ e({
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
		let n = e, r = t, i = { truncated: "这一层文件太多，只列了前面一部分。" }, a = g(() => ({
			...i,
			...n.texts
		})), o = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, s = g(() => n.keyOf(n.node)), c = g(() => n.dirOf(n.node)), l = g(() => n.expanded[s.value] === !0), u = g(() => n.cache[s.value] || o), d = g(() => c.value ? null : $(n.nameOf(n.node))), f = g(() => c.value ? l.value ? "mdi-folder-open-outline" : "mdi-folder-outline" : d.value.icon), p = g(() => c.value ? null : d.value.color ? { color: d.value.color } : null);
		function h() {
			n.pickOnRowClick && (c.value ? r("toggle", s.value) : r("pick", n.node));
		}
		function C(e) {
			r("context", {
				node: n.node,
				event: e
			});
		}
		return (t, n) => {
			let i = L("v-icon"), o = L("v-btn"), d = L("v-progress-circular"), g = L("FileTreeNode", !0);
			return M(), y("div", ve, [b("div", {
				class: D(["row", [e.rowClass ? e.rowClass(e.node) : null, { clickable: e.pickOnRowClick }]]),
				"data-path": s.value,
				"data-type": e.node.type,
				style: k({ paddingLeft: 4 + e.depth * 18 + "px" }),
				onClick: h,
				onContextmenu: H(C, ["prevent", "stop"])
			}, [
				c.value ? (M(), _(o, {
					key: 0,
					icon: "",
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: l.value ? "收起" : "展开",
					onClick: n[0] ||= H((e) => r("toggle", s.value), ["stop"])
				}, {
					default: V(() => [S(i, { size: "16" }, {
						default: V(() => [x(R(l.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"])) : (M(), y("span", be)),
				c.value && l.value && u.value.loading ? (M(), _(d, {
					key: 2,
					indeterminate: "",
					size: 14,
					width: 2,
					class: "spin"
				})) : (M(), _(i, {
					key: 3,
					size: "16",
					class: D(c.value ? "folder" : "file"),
					style: k(p.value)
				}, {
					default: V(() => [x(R(f.value), 1)]),
					_: 1
				}, 8, ["class", "style"])),
				I(t.$slots, "row-before-label", {
					node: e.node,
					open: l.value,
					state: u.value
				}, void 0, !0),
				b("span", {
					class: D(["label", e.labelClass]),
					title: s.value
				}, R(e.nameOf(e.node)), 11, xe),
				I(t.$slots, "row-after-label", {
					node: e.node,
					open: l.value,
					state: u.value
				}, void 0, !0)
			], 46, ye), c.value && l.value ? (M(), y(m, { key: 0 }, [u.value.error ? (M(), y("p", Se, R(u.value.error), 1)) : (M(), y(m, { key: 1 }, [(M(!0), y(m, null, F(u.value.entries, (i) => (M(), _(g, {
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
				"row-before-label": V((e) => [I(t.$slots, "row-before-label", T({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": V((e) => [I(t.$slots, "row-after-label", T({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), u.value.truncated ? (M(), y("p", Ce, R(a.value.truncated), 1)) : v("", !0)], 64))], 64)) : v("", !0)]);
		};
	}
}, [["__scopeId", "data-v-f0de9fb7"]]);
// src/utils/commons/clipboard.js
async function Te(e) {
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
var Ee = {
	key: 0,
	class: "root-loading"
}, De = {
	key: 1,
	class: "hint bad"
}, Oe = {
	key: 0,
	class: "hint"
}, ke = ["disabled"], Ae = ["disabled"], je = ["disabled"], Me = /*#__PURE__*/ e({
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
		}, o = g(() => ({
			...a,
			...r.texts
		})), s = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, c = N({}), l = N({}), u = P(!1), d = P(null), f = g(() => r.root ? r.keyOf(r.root) : ""), p = g(() => l[f.value] || s);
		async function C(e, t = !1) {
			if (!t && l[e]) return;
			l[e] || (l[e] = {
				loading: !1,
				error: "",
				entries: [],
				truncated: !1
			});
			let n = l[e];
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
		function D(e) {
			c[e] = !c[e], c[e] && C(e);
		}
		async function ee(e) {
			c[f.value] = !0, await C(f.value);
			let t = f.value;
			for (let n of String(e || "").split("/").filter(Boolean)) t = t ? `${t}/${n}` : n, await C(t), c[t] = !0;
		}
		function te() {
			return Object.keys(c).filter((e) => c[e]);
		}
		async function z(e) {
			let t = Array.isArray(e) ? e : [];
			await Promise.all(t.map(async (e) => {
				c[e] = !0, await C(e);
			}));
		}
		function ne() {
			for (let e of Object.keys(c)) c[e] = !1;
			c[f.value] = !0;
		}
		function re() {
			for (let e of Object.keys(l)) delete l[e];
			for (let e of Object.keys(c)) delete c[e];
			c[f.value] = !0, C(f.value);
		}
		async function ie(e) {
			await C(e, !0);
		}
		async function ae() {
			let e = Object.keys(c).filter((e) => c[e]);
			await Promise.all(e.map((e) => C(e, !0)));
		}
		async function oe(e) {
			let t = new Set(Array.isArray(e) ? e : []);
			t.add(f.value);
			let n = [...t].filter((e) => e === f.value || c[e]);
			await Promise.all(n.map((e) => C(e, !0)));
		}
		function se(e) {
			let t = d.value ? d.value.querySelectorAll("[data-path]") : [];
			for (let n of t) if (n.dataset.path === e) {
				n.scrollIntoView({ block: "nearest" });
				return;
			}
		}
		async function ce() {
			await Promise.all(Object.keys(l).map((e) => C(e, !0)));
		}
		function U() {
			r.active && !u.value && (u.value = !0, c[f.value] = !0, C(f.value));
		}
		r.active && U(), j(U), B(() => r.active, (e) => {
			e && U();
		});
		let W = N({
			open: !1,
			x: 0,
			y: 0,
			node: null,
			copied: ""
		}), G = P(null), le = 0, K = g(() => W.node ? String(r.keyOf(W.node) || "") : ""), q = g(() => {
			if (!W.node || !r.rootPath) return "";
			let e = r.rootPath.replace(/\/+$/, ""), t = K.value;
			return t ? `${e}/${t}` : e;
		}), J = g(() => W.node ? r.dirOf(W.node) : !1);
		function Y({ node: e, event: t }) {
			W.node = e, W.copied = "", W.x = t.clientX, W.y = t.clientY, W.open = !0, E(ue);
		}
		function ue() {
			if (!G.value) return;
			let e = G.value.offsetWidth, t = G.value.offsetHeight;
			W.x = Math.max(6, Math.min(W.x, window.innerWidth - e - 6)), W.y = Math.max(6, Math.min(W.y, window.innerHeight - t - 6));
		}
		function X() {
			W.open = !1, W.node = null, W.copied = "", clearTimeout(le);
		}
		async function Z(e) {
			let t = e === "abs" ? q.value : K.value;
			t && await Te(t) && (W.copied = e, clearTimeout(le), le = setTimeout(X, 700));
		}
		function Q(e) {
			if (!W.node) return;
			let t = W.node;
			X(), i("action", {
				action: e,
				node: t
			});
		}
		function de() {
			if (!W.node || !r.downloadOf) return;
			let e = W.node, t = r.downloadOf(e);
			if (X(), !t) return;
			let n = r.nameOf(e) || "download", i = document.createElement("a");
			i.href = t, i.download = r.dirOf(e) ? `${n}.zip` : n, i.rel = "noopener", i.style.display = "none", document.body.appendChild(i), i.click(), i.remove();
		}
		function fe(e) {
			G.value && !G.value.contains(e.target) && X();
		}
		function pe(e) {
			e.key === "Escape" && X();
		}
		function me() {
			W.open && X();
		}
		function he(e) {
			let t = e ? "addEventListener" : "removeEventListener";
			document[t]("mousedown", fe, !0), document[t]("keydown", pe, !0), window[t]("scroll", me, !0), window[t]("resize", me);
		}
		return B(() => W.open, (e) => he(e)), A(() => {
			X(), he(!1);
		}), t({
			reveal: ee,
			reload: re,
			reloadDir: ie,
			reloadExpanded: ae,
			reloadDirs: oe,
			refreshAll: ce,
			scrollTo: se,
			toggle: D,
			collapseAll: ne,
			expandedKeys: te,
			restoreExpanded: z
		}), (t, n) => {
			let r = L("v-progress-circular"), a = L("v-icon");
			return M(), y("div", {
				ref_key: "rootRef",
				ref: d,
				class: "file-tree"
			}, [e.root ? (M(), _(we, {
				key: 0,
				node: e.root,
				depth: 0,
				expanded: c,
				cache: l,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: D,
				onPick: n[0] ||= (e) => i("pick", e),
				onContext: Y
			}, {
				"row-before-label": V((e) => [I(t.$slots, "row-before-label", O(w(e)), void 0, !0)]),
				"row-after-label": V((e) => [I(t.$slots, "row-after-label", O(w(e)), void 0, !0)]),
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
			])) : (M(), y(m, { key: 1 }, [p.value.loading ? (M(), y("div", Ee, [S(r, {
				indeterminate: "",
				size: 14,
				width: 2
			})])) : p.value.error ? (M(), y("p", De, R(p.value.error), 1)) : (M(), y(m, { key: 2 }, [(M(!0), y(m, null, F(p.value.entries, (r) => (M(), _(we, {
				key: e.keyOf(r),
				node: r,
				depth: 0,
				expanded: c,
				cache: l,
				"key-of": e.keyOf,
				"dir-of": e.dirOf,
				"name-of": e.nameOf,
				"label-class": e.labelClass,
				"row-class": e.rowClass,
				"pick-on-row-click": e.pickOnRowClick,
				texts: e.texts,
				onToggle: D,
				onPick: n[1] ||= (e) => i("pick", e),
				onContext: Y
			}, {
				"row-before-label": V((e) => [I(t.$slots, "row-before-label", T({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": V((e) => [I(t.$slots, "row-after-label", T({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), p.value.truncated ? (M(), y("p", Oe, R(o.value.truncated), 1)) : v("", !0)], 64))], 64)), (M(), _(h, { to: "body" }, [W.open ? (M(), y("div", {
				key: 0,
				ref_key: "menuRef",
				ref: G,
				class: "ft-menu",
				style: k({
					left: W.x + "px",
					top: W.y + "px"
				}),
				onContextmenu: n[10] ||= H(() => {}, ["prevent"])
			}, [
				e.editable ? (M(), y(m, { key: 0 }, [
					J.value ? (M(), y("button", {
						key: 0,
						class: "ft-item",
						type: "button",
						onClick: n[2] ||= (e) => Q("create-file")
					}, [S(a, { size: "16" }, {
						default: V(() => [...n[11] ||= [x("mdi-file-plus-outline", -1)]]),
						_: 1
					}), b("span", null, R(o.value.newFile), 1)])) : v("", !0),
					J.value ? (M(), y("button", {
						key: 1,
						class: "ft-item",
						type: "button",
						onClick: n[3] ||= (e) => Q("create-dir")
					}, [S(a, { size: "16" }, {
						default: V(() => [...n[12] ||= [x("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), b("span", null, R(o.value.newDir), 1)])) : v("", !0),
					J.value ? (M(), y("button", {
						key: 2,
						class: "ft-item",
						type: "button",
						onClick: n[4] ||= (e) => Q("upload")
					}, [S(a, { size: "16" }, {
						default: V(() => [...n[13] ||= [x("mdi-cloud-upload-outline", -1)]]),
						_: 1
					}), b("span", null, R(o.value.upload), 1)])) : v("", !0),
					b("button", {
						class: "ft-item",
						type: "button",
						disabled: !K.value,
						onClick: n[5] ||= (e) => Q("rename")
					}, [S(a, { size: "16" }, {
						default: V(() => [...n[14] ||= [x("mdi-form-textbox", -1)]]),
						_: 1
					}), b("span", null, R(o.value.rename), 1)], 8, ke),
					b("button", {
						class: "ft-item danger",
						type: "button",
						disabled: !K.value,
						onClick: n[6] ||= (e) => Q("delete")
					}, [S(a, { size: "16" }, {
						default: V(() => [...n[15] ||= [x("mdi-trash-can-outline", -1)]]),
						_: 1
					}), b("span", null, R(o.value.delete), 1)], 8, Ae),
					n[17] ||= b("div", { class: "ft-sep" }, null, -1),
					b("button", {
						class: "ft-item",
						type: "button",
						onClick: n[7] ||= (e) => Q("props")
					}, [S(a, { size: "16" }, {
						default: V(() => [...n[16] ||= [x("mdi-information-outline", -1)]]),
						_: 1
					}), b("span", null, R(o.value.props), 1)]),
					n[18] ||= b("div", { class: "ft-sep" }, null, -1)
				], 64)) : v("", !0),
				b("button", {
					class: "ft-item",
					type: "button",
					disabled: !K.value,
					onClick: n[8] ||= (e) => Z("rel")
				}, [S(a, { size: "16" }, {
					default: V(() => [...n[19] ||= [x("mdi-content-copy", -1)]]),
					_: 1
				}), b("span", null, R(W.copied === "rel" ? o.value.copied : o.value.copyRel), 1)], 8, je),
				e.rootPath ? (M(), y("button", {
					key: 1,
					class: "ft-item",
					type: "button",
					onClick: n[9] ||= (e) => Z("abs")
				}, [S(a, { size: "16" }, {
					default: V(() => [...n[20] ||= [x("mdi-link-variant", -1)]]),
					_: 1
				}), b("span", null, R(W.copied === "abs" ? o.value.copied : o.value.copyAbs), 1)])) : v("", !0),
				e.downloadOf ? (M(), y("button", {
					key: 2,
					class: "ft-item",
					type: "button",
					onClick: de
				}, [S(a, { size: "16" }, {
					default: V(() => [x(R(J.value ? "mdi-folder-zip-outline" : "mdi-download"), 1)]),
					_: 1
				}), b("span", null, R(J.value ? o.value.downloadDir : o.value.downloadFile), 1)])) : v("", !0)
			], 36)) : v("", !0)]))], 512);
		};
	}
}, [["__scopeId", "data-v-32ca7798"]]), Ne = { class: "file-head" }, Pe = { class: "crumbs" }, Fe = ["title", "onClick"], Ie = { class: "meta" }, Le = /*#__PURE__*/ e({
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
		},
		navigable: {
			type: Boolean,
			default: !1
		}
	},
	emits: ["navigate"],
	setup(e, { emit: t }) {
		let n = e, r = t, i = g(() => {
			let e = String(n.path || "").split("/").filter(Boolean), t = "";
			return e.map((e) => (t = t ? `${t}/${e}` : e, {
				name: e,
				path: t
			}));
		}), a = g(() => {
			if (n.size === void 0 || n.size === null) return "";
			let e = Number(n.size) || 0;
			return e < 1024 ? `${e} 字节` : e < 1048576 ? `${(e / 1024).toFixed(1)} KB` : `${(e / 1024 / 1024).toFixed(1)} MB`;
		});
		function o(e, t) {
			t !== i.value.length - 1 && r("navigate", e.path);
		}
		return (t, n) => (M(), y("div", Ne, [
			b("nav", Pe, [b("button", {
				class: D(["seg", { link: e.navigable }]),
				title: "回到根目录",
				onClick: n[0] ||= (e) => r("navigate", "")
			}, R(e.rootName), 3), (M(!0), y(m, null, F(i.value, (t, r) => (M(), y(m, { key: t.path }, [n[1] ||= b("span", { class: "sep" }, "/", -1), b("button", {
				class: D(["seg", {
					last: r === i.value.length - 1,
					link: e.navigable && r !== i.value.length - 1
				}]),
				title: t.path,
				onClick: (e) => o(t, r)
			}, R(t.name), 11, Fe)], 64))), 128))]),
			I(t.$slots, "actions", {}, void 0, !0),
			b("span", Ie, R(a.value), 1)
		]));
	}
}, [["__scopeId", "data-v-ca7b2c85"]]), Re = /*#__PURE__*/ e({
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
			let a = L("v-spacer"), o = L("v-btn");
			return M(), _(n, {
				"model-value": e.modelValue,
				"initial-width": 440,
				"initial-height": 280,
				"min-width": 340,
				"min-height": 200,
				"onUpdate:modelValue": i[2] ||= (e) => !e && r("answer", !1)
			}, {
				title: V(() => [...i[3] ||= [x("文件还没保存", -1)]]),
				actions: V(() => [
					S(a),
					S(o, {
						variant: "text",
						onClick: i[0] ||= (e) => r("answer", !1)
					}, {
						default: V(() => [...i[4] ||= [x("留在这里", -1)]]),
						_: 1
					}),
					S(o, {
						color: "error",
						variant: "flat",
						onClick: i[1] ||= (e) => r("answer", !0)
					}, {
						default: V(() => [...i[5] ||= [x("丢掉修改", -1)]]),
						_: 1
					})
				]),
				default: V(() => [x(" " + R(e.path || "当前文件") + " ", 1), i[6] ||= b("p", { class: "tip" }, "换过去之后这次的修改就没了，要保留就先按 Ctrl+S 保存。", -1)]),
				_: 1
			}, 8, ["model-value"]);
		};
	}
}, [["__scopeId", "data-v-d6dcbf86"]]);
// src/components/commons/FileEditor/useFileEditor.js
function ze({ loader: e, saver: t }) {
	let n = P(""), r = N({
		base: "",
		draft: "",
		loading: !1,
		error: "",
		saving: !1,
		saveError: ""
	}), i = 0, a = g(() => r.draft !== r.base);
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
var Be = {
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
function Ve(e, t = null) {
	let n = o(e);
	return n === "markdown" ? Be.markdown : n ? t || Be.code : Be.plain;
}
function He(e, t = null) {
	return Ve(e, t).modes;
}
function Ue(e, t = null) {
	return !!t && Ve(e, t) === t;
}
function We(e, t) {
	return t.some((t) => t.id === e) ? e : "source";
}
function Ge(e, t) {
	return t > 0 ? "source" : e;
}
function Ke(e) {
	return {
		mode: "source",
		message: `视图加载失败${e && e.message ? `：${e.message}` : ""}`
	};
}
// src/components/commons/FileEditor/FileEditor.vue
var qe = { class: "file-editor" }, Je = {
	key: 1,
	class: "actions"
}, Ye = {
	key: 1,
	class: "hint"
}, Xe = {
	key: 3,
	class: "edit-wrap"
}, Ze = {
	key: 0,
	class: "hint bad edit-error"
}, Qe = {
	key: 1,
	class: "hint bad edit-error"
}, $e = {
	key: 3,
	class: "hint"
}, et = /*#__PURE__*/ e({
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
		codeView: {
			type: Object,
			default: null
		},
		viewProps: {
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
		let r = e, a = n, o = C(), s = g(() => !!o?.vnode.props?.onNavigate), { path: c, state: l, dirty: u, load: d, save: f, discard: p, reset: h } = ze({
			loader: r.loader,
			saver: r.saver
		}), b = P(null);
		B(u, (e) => a("dirty", e));
		let w = P("source"), D = g(() => He(c.value, r.codeView)), O = g(() => D.value.find((e) => e.id === w.value) || null), k = te(null), j = P(!1), N = P(""), I = 0;
		function ne() {
			if (!I) return;
			let e = b.value;
			if (!e || typeof e.locate != "function") return;
			let t = I;
			I = 0, e.locate(t);
		}
		B(D, (e) => {
			w.value = We(w.value, e);
		}, { immediate: !0 }), B(O, async (e) => {
			if (k.value = null, j.value = !!e, e) {
				N.value = "";
				try {
					let t = await e.load();
					if (O.value !== e) return;
					k.value = t.default, await E(), ne();
				} catch (t) {
					if (O.value === e) {
						let e = Ke(t);
						N.value = e.message, w.value = e.mode;
					}
				} finally {
					O.value === e && (j.value = !1);
				}
			}
		}, { immediate: !0 });
		async function re() {
			let e = c.value, t = await f();
			return t && a("saved", {
				path: e,
				data: t
			}), t;
		}
		function ie() {
			p();
		}
		function ae(e) {
			a("definition", {
				path: c.value,
				...e
			});
		}
		function H(e) {
			a("menu", {
				path: c.value,
				...e
			});
		}
		function oe(e) {
			a("rename", {
				path: c.value,
				...e
			});
		}
		function se(e) {
			a("caret", {
				path: c.value,
				...e
			});
		}
		let ce = P(!1), U = null;
		async function W(e, t = 0) {
			return N.value = "", w.value = Ge(w.value, t), I = t, await d(e) ? (await E(), t || b.value?.resetScroll(), ne(), !0) : (I = 0, !1);
		}
		async function G() {
			return !c.value || !await d(c.value) ? !1 : (await E(), b.value?.resetScroll(), !0);
		}
		function le() {
			J(), h();
		}
		function K() {
			return u.value ? ce.value ? Promise.resolve(!1) : (ce.value = !0, new Promise((e) => {
				U = e;
			})) : Promise.resolve(!0);
		}
		function q(e) {
			if (ce.value = !1, !U) return;
			let t = U;
			U = null, t(e);
		}
		function J() {
			q(!1);
		}
		let Y = g(() => l.draft), ue = g(() => l.base);
		function X(e) {
			l.draft = e == null ? "" : String(e);
		}
		return A(() => q(!1)), t({
			open: W,
			reload: G,
			close: le,
			save: re,
			discard: ie,
			confirmLeave: K,
			cancelLeave: J,
			path: c,
			dirty: u,
			text: Y,
			base: ue,
			restore: X
		}), (t, n) => {
			let r = L("v-btn"), o = L("v-btn-toggle"), d = L("v-chip");
			return M(), y("section", qe, [
				z(c) ? (M(), _(Le, {
					key: 0,
					"root-name": e.rootName,
					path: z(c),
					size: e.size,
					navigable: s.value,
					onNavigate: n[1] ||= (e) => a("navigate", e)
				}, {
					actions: V(() => [D.value.length > 1 ? (M(), _(o, {
						key: 0,
						modelValue: w.value,
						"onUpdate:modelValue": n[0] ||= (e) => w.value = e,
						density: "compact",
						variant: "text",
						divided: "",
						mandatory: "",
						class: "views"
					}, {
						default: V(() => [(M(!0), y(m, null, F(D.value, (e) => (M(), _(r, {
							key: e.id,
							value: e.id,
							size: "small"
						}, {
							default: V(() => [x(R(e.title), 1)]),
							_: 2
						}, 1032, ["value"]))), 128))]),
						_: 1
					}, 8, ["modelValue"])) : v("", !0), z(u) && !z(l).loading ? (M(), y("div", Je, [
						S(d, {
							size: "x-small",
							variant: "flat",
							color: "modified"
						}, {
							default: V(() => [...n[6] ||= [x("未保存", -1)]]),
							_: 1
						}),
						S(r, {
							size: "small",
							variant: "text",
							color: "primary",
							loading: z(l).saving,
							onClick: re
						}, {
							default: V(() => [...n[7] ||= [x(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"]),
						S(r, {
							size: "small",
							variant: "text",
							disabled: z(l).saving,
							onClick: ie
						}, {
							default: V(() => [...n[8] ||= [x(" 放弃 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					])) : v("", !0)]),
					_: 1
				}, 8, [
					"root-name",
					"path",
					"size",
					"navigable"
				])) : v("", !0),
				z(l).loading ? (M(), y("p", Ye, "正在读取文件…")) : z(l).error ? (M(), _(i, {
					key: 2,
					icon: "mdi-file-question-outline",
					"icon-size": 28,
					title: z(l).error,
					hint: "换一个文件试试，或者从左侧目录里下载它。"
				}, null, 8, ["title"])) : z(c) ? (M(), y("div", Xe, [
					N.value ? (M(), y("p", Ze, R(N.value), 1)) : v("", !0),
					z(l).saveError ? (M(), y("p", Qe, R(z(l).saveError), 1)) : v("", !0),
					k.value ? (M(), _(ee(k.value), T({
						key: 2,
						ref_key: "paneRef",
						ref: b,
						modelValue: z(l).draft,
						"onUpdate:modelValue": n[2] ||= (e) => z(l).draft = e
					}, z(Ue)(z(c), e.codeView) ? e.viewProps : {}, {
						path: z(c),
						onSymbol: ae,
						onMenu: H,
						onRename: oe,
						onCaret: se,
						markers: e.markers,
						onEdit: n[3] ||= (e) => t.$emit("edit", { path: z(c) }),
						onHover: n[4] ||= (e) => t.$emit("hover", {
							path: z(c),
							...e
						}),
						onHoverEnd: n[5] ||= (e) => t.$emit("hover-end", { path: z(c) })
					}), null, 16, [
						"modelValue",
						"path",
						"markers"
					])) : j.value ? (M(), y("p", $e, "正在准备视图…")) : v("", !0)
				])) : (M(), _(i, {
					key: 4,
					icon: "mdi-file-outline",
					hint: "从左边选一个文件，右边显示它的内容。"
				})),
				S(Re, {
					"model-value": ce.value,
					path: z(c),
					onAnswer: q
				}, null, 8, ["model-value", "path"])
			]);
		};
	}
}, [["__scopeId", "data-v-0f064e9d"]]), tt = "web-shared-resizing";
function nt({ area: e, initial: t, min: n = 0, max: r = 100, rightMin: i = 0, axis: a = "x", unit: o = "px", persist: s = "" }) {
	let c = P(f()), l = P(!1), u = 0, d = 0;
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
		l.value && (l.value = !1, window.removeEventListener("pointermove", m), document.body.classList.remove(tt));
	}
	function g(t) {
		t.button === 0 && e.value && (l.value = !0, u = a === "x" ? t.clientX : t.clientY, d = c.value, t.preventDefault(), document.body.classList.add(tt), window.addEventListener("pointermove", m), window.addEventListener("pointerup", h, { once: !0 }));
	}
	function _() {
		c.value = t;
	}
	return B(c, (e) => {
		if (s) try {
			window.localStorage.setItem(s, String(e));
		} catch {}
	}), A(h), {
		size: c,
		resizing: l,
		start: g,
		stop: h,
		reset: _
	};
}
// src/utils/services/serviceStatus.js
var rt = ["starting", "ready"];
function it(e, t = rt) {
	return (e.services || []).filter((e) => e.run && t.includes(e.run.status)).length;
}
function at(e, t = rt) {
	let n = [];
	for (let r of e || []) {
		let e = it(r, t);
		e && n.push({
			id: r.id,
			name: r.alias || s(r.root),
			count: e
		});
	}
	return n;
}
// src/components/services/WorkspaceShell.vue
var ot = { class: "brand" }, st = { class: "run-count" }, ct = { class: "side" }, lt = { class: "content" }, ut = /*#__PURE__*/ e({
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
		let r = e, o = n, s = g(() => at(r.workspaces));
		function c(e) {
			o("select-workspace", e);
		}
		let l = P(null), u = P(!0), { size: d, resizing: f, start: p, reset: h } = nt({
			area: l,
			initial: 268,
			min: 200,
			rightMin: 420,
			persist: `${r.title}.shell.side-width`
		});
		return (n, r) => {
			let o = L("v-app-bar-nav-icon"), g = L("v-app-bar-title"), C = L("v-spacer"), w = L("v-chip"), E = L("v-list-item-title"), O = L("v-list-item"), A = L("v-list"), j = L("v-menu"), N = L("v-btn"), P = L("v-app-bar"), ee = L("v-main"), te = L("v-app");
			return M(), _(te, null, {
				default: V(() => [
					S(P, {
						density: "comfortable",
						flat: "",
						border: "b",
						class: "app-bar"
					}, {
						default: V(() => [
							S(o, {
								title: u.value ? "收起左侧列表" : "展开左侧列表",
								onClick: r[0] ||= (e) => u.value = !u.value
							}, null, 8, ["title"]),
							S(g, null, {
								default: V(() => [b("span", ot, R(e.title), 1)]),
								_: 1
							}),
							S(C),
							e.workspaces.length ? (M(), _(j, {
								key: 0,
								location: "bottom end"
							}, {
								activator: V(({ props: t }) => [S(w, T(t, {
									size: "small",
									variant: "tonal",
									class: "running",
									color: e.running ? "ready" : void 0,
									"prepend-icon": "mdi-play-circle-outline",
									title: e.running ? `所有工作区共 ${e.running} 个进程在跑` : "所有工作区都没有在跑的进程"
								}), {
									default: V(() => [x(R(e.running) + " 个在跑 ", 1)]),
									_: 1
								}, 16, ["color", "title"])]),
								default: V(() => [S(A, {
									density: "compact",
									class: "running-menu"
								}, {
									default: V(() => [(M(!0), y(m, null, F(s.value, (t) => (M(), _(O, {
										key: t.id,
										active: e.current && e.current.id === t.id,
										onClick: (e) => c(t.id)
									}, {
										append: V(() => [b("span", st, R(t.count) + " 个", 1)]),
										default: V(() => [S(E, { class: "run-name" }, {
											default: V(() => [x(R(t.name), 1)]),
											_: 2
										}, 1024)]),
										_: 2
									}, 1032, ["active", "onClick"]))), 128)), s.value.length ? v("", !0) : (M(), _(O, {
										key: 0,
										disabled: ""
									}, {
										default: V(() => [S(E, null, {
											default: V(() => [...r[3] ||= [x("没有在跑的进程", -1)]]),
											_: 1
										})]),
										_: 1
									}))]),
									_: 1
								})]),
								_: 1
							})) : v("", !0),
							I(n.$slots, "metrics", {}, void 0, !0),
							S(N, {
								icon: e.dark ? "mdi-weather-sunny" : "mdi-weather-night",
								title: "切换深浅色",
								variant: "text",
								onClick: e.toggleTheme
							}, null, 8, ["icon", "onClick"])
						]),
						_: 3
					}),
					S(t, {
						modelValue: e.snack.on,
						"onUpdate:modelValue": r[1] ||= (t) => e.snack.on = t,
						text: e.snack.text,
						color: e.snack.color
					}, null, 8, [
						"modelValue",
						"text",
						"color"
					]),
					S(ee, { class: "fill-height" }, {
						default: V(() => [b("div", {
							ref_key: "shellRef",
							ref: l,
							class: "shell"
						}, [
							b("div", {
								class: "side-slot",
								style: k({ width: u.value ? `${z(d)}px` : "0px" })
							}, null, 4),
							b("div", {
								class: D(["side-layer", { folded: !u.value }]),
								style: k({ width: `${z(d)}px` })
							}, [b("aside", ct, [I(n.$slots, "sidebar", {}, void 0, !0)])], 6),
							ie(S(a, {
								axis: "x",
								active: z(f),
								onStart: z(p),
								onReset: z(h)
							}, null, 8, [
								"active",
								"onStart",
								"onReset"
							]), [[ne, u.value]]),
							b("main", lt, [I(n.$slots, "default", { ws: e.current }, void 0, !0), e.current ? v("", !0) : (M(), _(i, T({ key: 0 }, e.empty, { onAction: r[2] ||= (e) => n.$emit("empty-action") }), null, 16))])
						], 512)]),
						_: 3
					})
				]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-67021267"]]), dt = "";
function ft(e, t) {
	let n = String(e.parent || "").trim();
	return n && t.has(n) ? n : dt;
}
function pt(e, t, n) {
	let r = new Map(t.map((e) => [e.id, e])), i = /* @__PURE__ */ new Set();
	for (let t of e) t && t.kind === "group" && t.id && i.add(t.id);
	let a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), c = [], l = /* @__PURE__ */ new Map(), u = (e, t) => {
		a.has(e) || a.set(e, []), a.get(e).push(t);
	};
	for (let t of e) if (t && t.id) {
		if (t.kind === "ws") {
			if (!r.has(t.id) || o.has(t.id)) continue;
			o.add(t.id), u(ft(t, i), t);
		} else if (t.kind === "group" && t.name) {
			if (s.has(t.id)) continue;
			s.add(t.id), c.push(t), l.set(t.id, t), u(ft(t, i), t);
		}
	}
	let d = (e) => {
		let t = e, n = /* @__PURE__ */ new Set();
		for (; t;) {
			if (n.has(t.id)) return !1;
			n.add(t.id);
			let e = ft(t, i);
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
	m(dt, 0);
	for (let e of c) p.has(e.id) || d(e) || (p.add(e.id), f.push({
		key: `group:${e.id}`,
		kind: "group",
		id: e.id,
		depth: 0,
		parent: dt,
		name: e.name,
		group: e
	}), n.has(e.id) || m(e.id, 1));
	for (let e of t) o.has(e.id) || f.push({
		key: `ws:${e.id}`,
		kind: "ws",
		id: e.id,
		depth: 0,
		parent: dt,
		ws: e
	});
	return f;
}
function mt(e) {
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
	a(dt, 0);
	for (let e of t.values()) for (let t of e) i.has(t.id) || (i.add(t.id), r.push({
		id: t.id,
		name: t.name,
		depth: 0
	}));
	return r;
}
function ht(e, t, n) {
	let r = String(n || ""), i = /* @__PURE__ */ new Set();
	for (; r && !i.has(r);) {
		if (r === t) return !0;
		i.add(r);
		let n = e.find((e) => e && e.kind === "group" && e.id === r);
		r = n ? String(n.parent || "") : "";
	}
	return !1;
}
function gt(e, t, n) {
	let r = new Set(t);
	return r.size ? e.map((e) => e.kind === "ws" && r.has(e.id) ? {
		...e,
		parent: n
	} : e) : e;
}
function _t(e, t) {
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
var vt = { class: "head" }, yt = { class: "head-title" }, bt = {
	key: 0,
	class: "none"
}, xt = { class: "gtext" }, St = { class: "nm" }, Ct = ["onClick"], wt = { class: "tip" }, Tt = { class: "tip" }, Et = { class: "tip" }, Dt = /*#__PURE__*/ e({
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
		}, a = g(() => ({
			...i,
			...r.texts
		})), o = t, s = r.storageKey ? ce(r.storageKey, [], { writeDefaults: !1 }) : P([]), c = g(() => new Set(Array.isArray(s.value) ? s.value : [])), l = P(null), u = P(null), d = g(() => r.groups.filter((e) => e && e.kind === "group").length), f = g(() => pt(r.groups, r.workspaces, c.value)), p = g(() => mt(r.groups));
		function h() {
			return _t(r.groups, r.workspaces);
		}
		function C(e, t) {
			return ht(r.groups, e, t);
		}
		function w(e) {
			o("groups-change", e);
		}
		function T(e, t, n, r) {
			let i = e.find((e) => e.kind === t && e.id === n);
			i ? i.parent = r : e.push({
				kind: t,
				id: n,
				parent: r
			});
		}
		function E() {
			return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
		}
		function O(e) {
			s.value = [...e];
		}
		function ee(e) {
			if (e.kind !== "group") {
				o("select", e.id);
				return;
			}
			let t = new Set(c.value);
			t.has(e.id) ? t.delete(e.id) : t.add(e.id), O(t);
		}
		function te(e) {
			if (!c.value.has(e)) return;
			let t = new Set(c.value);
			t.delete(e), O(t);
		}
		function ne(e) {
			let t = l.value, n = u.value, r = (t) => !!n && n.mode === t && n.kind === e.kind && n.id === e.id;
			return {
				"drag-src": !!t && t.kind === e.kind && t.id === e.id,
				"drop-before": r("before"),
				"drop-after": r("after"),
				"drop-into": r("into")
			};
		}
		function re(e, t) {
			l.value = {
				kind: t.kind,
				id: t.id
			}, u.value = null, e.dataTransfer && (e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("text/plain", t.id));
		}
		function ie(e, t) {
			if (!l.value) return;
			let n = l.value;
			if (n.kind === t.kind && n.id === t.id) {
				u.value = null;
				return;
			}
			let r = e.currentTarget.getBoundingClientRect(), i = e.clientY - r.top, a = i > r.height / 2 ? "after" : "before";
			t.kind === "group" && (a = i < r.height * .25 ? "before" : i > r.height * .75 ? "after" : "into"), n.kind === "group" && C(n.id, a === "into" ? t.id : t.parent) ? u.value = null : u.value = {
				kind: t.kind,
				id: t.id,
				mode: a
			};
		}
		function oe() {
			let e = l.value, t = u.value;
			if (!e || !t) return se();
			let n = h(), r = n.findIndex((t) => t.kind === e.kind && t.id === e.id);
			if (r < 0) return se();
			let i = n.splice(r, 1)[0];
			if (t.mode === "into") i.parent = t.id, n.push(i), te(t.id);
			else {
				let e = n.findIndex((e) => e.kind === t.kind && e.id === t.id);
				e < 0 ? (i.parent = "", n.push(i)) : (i.parent = n[e].parent || "", n.splice(t.mode === "before" ? e : e + 1, 0, i));
			}
			w(n), se();
		}
		function se() {
			l.value = null, u.value = null;
		}
		let U = P(!1), W = P(""), G = P(!1), le = P(0), K = P(null), q = N({
			open: !1,
			x: 0,
			y: 0,
			mode: "blank",
			target: null
		}), J = P(!1), Y = P(null), ue = P(""), X = P(!1), Z = P(!1), Q = P(null), de = P(""), fe = P(!1), pe = P(null);
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
			Q.value = { id: e.id }, de.value = e.name || "", Z.value = !0, $();
		}
		function ye() {
			let e = (de.value || "").trim().slice(0, 80);
			e && Q.value && (w(h().map((t) => t.kind === "group" && t.id === Q.value.id ? {
				...t,
				name: e
			} : t)), Z.value = !1);
		}
		function be() {
			let e = h(), t = {
				kind: "group",
				id: E(),
				name: "新分组",
				parent: ""
			};
			e.push(t), w(e), $(), ve(t);
		}
		function xe() {
			let e = q.target;
			if (!e) return;
			let t = h(), n = {
				kind: "group",
				id: E(),
				name: "新分组",
				parent: e.id
			};
			t.push(n), w(t), te(e.id), $(), ve(n);
		}
		function Se() {
			let e = q.target;
			if (!e) return;
			let t = h(), n = {
				kind: "group",
				id: E(),
				name: "新分组",
				parent: ""
			};
			t.push(n), T(t, "ws", e.id, n.id), w(t), $(), ve(n);
		}
		function Ce(e) {
			if (!q.target) return;
			let t = h();
			T(t, "ws", q.target.id, e), w(t), e && te(e), $();
		}
		function we() {
			pe.value = q.target, fe.value = !0, $();
		}
		function Ee() {
			let e = pe.value ? pe.value.id : "";
			if (e) {
				let t = h(), n = t.findIndex((t) => t.kind === "group" && t.id === e);
				if (n >= 0) {
					let r = t[n].parent || "";
					t.splice(n, 1);
					for (let n of t) (n.parent || "") === e && (n.parent = r);
					w(t);
				}
			}
			fe.value = !1;
		}
		function De(e) {
			Y.value = e, ue.value = e.alias || "", J.value = !0, $();
		}
		async function Oe() {
			if (Y.value) {
				X.value = !0;
				try {
					await r.saveAlias(Y.value.id, (ue.value || "").trim()), J.value = !1, o("changed"), o("notice", {
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
			let n = t === "rel" && e.rel || e.root, r = await Te(n);
			o("notice", {
				text: r ? `${a.value.copied}${n}` : a.value.copyFailed,
				color: r ? "primary" : "error"
			}), $();
		}
		j(() => {
			document.addEventListener("click", $), document.addEventListener("contextmenu", $), window.addEventListener("resize", $), window.addEventListener("blur", $);
		}), A(() => {
			document.removeEventListener("click", $), document.removeEventListener("contextmenu", $), window.removeEventListener("resize", $), window.removeEventListener("blur", $);
		});
		function Ae(e) {
			let t = String(e || "").split("/").filter(Boolean);
			return t.length ? t[t.length - 1] : e;
		}
		let je = P(""), Me = new Set(r.workspaces.map((e) => e.id));
		function Ne(e) {
			q.open = !1, Pe(), je.value = e ? e.id : "";
		}
		B(() => r.workspaces.map((e) => e.id).join(","), () => {
			let e = r.workspaces.filter((e) => !Me.has(e.id)).map((e) => e.id);
			if (Me = new Set(r.workspaces.map((e) => e.id)), !je.value || !e.length) return;
			let t = je.value;
			je.value = "", o("groups-change", gt(_t(r.groups, r.workspaces), e, t));
		});
		function Pe() {
			je.value = "", W.value = "", G.value = !1, le.value += 1, U.value = !0;
		}
		function Fe() {
			let e = W.value.trim();
			e && (U.value = !1, o("add", e));
		}
		function Ie(e) {
			K.value = e;
		}
		function Le() {
			let e = K.value;
			K.value = null, e && o("remove", e.id);
		}
		return (t, r) => {
			let i = L("v-btn"), o = L("v-icon"), s = L("v-list-item-title"), l = L("v-list-item-subtitle"), u = L("v-list-item"), h = L("v-list"), g = L("v-text-field"), C = L("v-spacer");
			return M(), y("div", {
				class: "list",
				onContextmenu: H(_e, ["prevent", "stop"])
			}, [
				b("div", vt, [b("span", yt, R(a.value.headTitle), 1), S(i, {
					size: "small",
					variant: "text",
					color: "primary",
					"prepend-icon": "mdi-plus",
					loading: e.busy,
					onClick: Pe
				}, {
					default: V(() => [x(R(a.value.add), 1)]),
					_: 1
				}, 8, ["loading"])]),
				!e.workspaces.length && !d.value ? (M(), y("div", bt, R(a.value.empty), 1)) : v("", !0),
				S(h, {
					density: "compact",
					nav: "",
					class: "items",
					onDrop: H(oe, ["prevent"])
				}, {
					default: V(() => [(M(!0), y(m, null, F(f.value, (n) => (M(), _(u, {
						key: n.key,
						active: n.kind === "ws" && n.id === e.current,
						"active-color": "primary",
						draggable: "true",
						style: k({ paddingLeft: `${12 + n.depth * 18}px` }),
						class: D(ne(n)),
						onClick: (e) => ee(n),
						onContextmenu: H((e) => ge(e, n), ["prevent", "stop"]),
						onDragstart: (e) => re(e, n),
						onDragover: H((e) => ie(e, n), ["prevent"]),
						onDragend: se
					}, {
						append: V(() => [n.kind === "ws" ? (M(), _(i, {
							key: 0,
							icon: !0,
							size: "x-small",
							variant: "text",
							title: a.value.forgetTitle,
							class: "forget",
							onClick: H((e) => Ie(n.ws), ["stop"])
						}, {
							default: V(() => [S(o, { size: "18" }, {
								default: V(() => [...r[24] ||= [x("mdi-close", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["title", "onClick"])) : v("", !0)]),
						default: V(() => [(M(!0), y(m, null, F(n.depth, (e) => (M(), y("span", {
							key: e,
							class: "guide",
							style: k({ left: `${20 + (e - 1) * 18}px` })
						}, null, 4))), 128)), n.kind === "group" ? (M(), _(s, {
							key: 0,
							class: "gname"
						}, {
							default: V(() => [
								S(o, { size: "16" }, {
									default: V(() => [x(R(c.value.has(n.id) ? "mdi-chevron-right" : "mdi-chevron-down"), 1)]),
									_: 2
								}, 1024),
								S(o, { size: "16" }, {
									default: V(() => [...r[23] ||= [x("mdi-folder-outline", -1)]]),
									_: 1
								}),
								b("span", xt, R(n.name), 1)
							]),
							_: 2
						}, 1024)) : (M(), y(m, { key: 1 }, [S(s, {
							class: "name",
							title: n.ws.alias ? n.ws.root : ""
						}, {
							default: V(() => [b("span", St, R(n.ws.alias || Ae(n.ws.root)), 1), I(t.$slots, "title-extra", { ws: n.ws }, void 0, !0)]),
							_: 2
						}, 1032, ["title"]), S(l, {
							class: "path",
							title: n.ws.url || n.ws.root
						}, {
							default: V(() => [x(R(n.ws.url || n.ws.root), 1)]),
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
				q.open ? (M(), y("div", {
					key: 1,
					class: "ctxmenu",
					style: k({
						left: q.x + "px",
						top: q.y + "px"
					}),
					onClick: r[7] ||= H(() => {}, ["stop"]),
					onContextmenu: r[8] ||= H(() => {}, ["prevent", "stop"])
				}, [q.mode === "ws" ? (M(), y(m, { key: 0 }, [
					b("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[0] ||= (e) => De(q.target)
					}, [S(o, { size: "16" }, {
						default: V(() => [...r[25] ||= [x("mdi-rename-box", -1)]]),
						_: 1
					}), x(R(a.value.menuAlias), 1)]),
					b("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[1] ||= (e) => ke(q.target, "rel")
					}, [S(o, { size: "16" }, {
						default: V(() => [...r[26] ||= [x("mdi-content-copy", -1)]]),
						_: 1
					}), x(R(a.value.copyRel), 1)]),
					b("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[2] ||= (e) => ke(q.target, "abs")
					}, [S(o, { size: "16" }, {
						default: V(() => [...r[27] ||= [x("mdi-content-copy", -1)]]),
						_: 1
					}), x(R(a.value.copyAbs), 1)]),
					b("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[3] ||= (e) => q.mode = "pick"
					}, [
						S(o, { size: "16" }, {
							default: V(() => [...r[28] ||= [x("mdi-folder-move-outline", -1)]]),
							_: 1
						}),
						r[29] ||= x("移到分组 ", -1),
						r[30] ||= b("span", { class: "more" }, "›", -1)
					])
				], 64)) : q.mode === "pick" ? (M(), y(m, { key: 1 }, [
					b("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[4] ||= (e) => Ce("")
					}, [S(o, { size: "16" }, {
						default: V(() => [...r[31] ||= [x("mdi-format-list-bulleted", -1)]]),
						_: 1
					}), r[32] ||= x("移出分组 ", -1)]),
					(M(!0), y(m, null, F(p.value, (e) => (M(), y("button", {
						key: e.id,
						type: "button",
						class: "ctxitem",
						style: k({ paddingLeft: `${10 + e.depth * 18}px` }),
						onClick: (t) => Ce(e.id)
					}, [S(o, { size: "16" }, {
						default: V(() => [...r[33] ||= [x("mdi-folder-outline", -1)]]),
						_: 1
					}), x(R(e.name), 1)], 12, Ct))), 128)),
					b("button", {
						type: "button",
						class: "ctxitem",
						onClick: Se
					}, [S(o, { size: "16" }, {
						default: V(() => [...r[34] ||= [x("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), r[35] ||= x("新建分组并移入 ", -1)])
				], 64)) : q.mode === "group" ? (M(), y(m, { key: 2 }, [
					b("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[5] ||= (e) => Ne(q.target)
					}, [S(o, { size: "16" }, {
						default: V(() => [...r[36] ||= [x("mdi-plus", -1)]]),
						_: 1
					}), x(R(a.value.menuAddInGroup), 1)]),
					b("button", {
						type: "button",
						class: "ctxitem",
						onClick: xe
					}, [S(o, { size: "16" }, {
						default: V(() => [...r[37] ||= [x("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), r[38] ||= x("新建子分组 ", -1)]),
					b("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[6] ||= (e) => ve(q.target)
					}, [S(o, { size: "16" }, {
						default: V(() => [...r[39] ||= [x("mdi-rename-box", -1)]]),
						_: 1
					}), r[40] ||= x("重命名 ", -1)]),
					b("button", {
						type: "button",
						class: "ctxitem",
						onClick: we
					}, [S(o, { size: "16" }, {
						default: V(() => [...r[41] ||= [x("mdi-trash-can-outline", -1)]]),
						_: 1
					}), r[42] ||= x("删除分组 ", -1)])
				], 64)) : (M(), y("button", {
					key: 3,
					type: "button",
					class: "ctxitem",
					onClick: be
				}, [S(o, { size: "16" }, {
					default: V(() => [...r[43] ||= [x("mdi-folder-plus-outline", -1)]]),
					_: 1
				}), r[44] ||= x("新建分组 ", -1)]))], 36)) : v("", !0),
				S(n, {
					modelValue: J.value,
					"onUpdate:modelValue": r[11] ||= (e) => J.value = e,
					"initial-width": 460,
					"initial-height": 320,
					"min-width": 360,
					"min-height": 240
				}, {
					title: V(() => [x(R(a.value.aliasTitle), 1)]),
					actions: V(() => [
						S(C),
						S(i, {
							variant: "text",
							onClick: r[10] ||= (e) => J.value = !1
						}, {
							default: V(() => [...r[45] ||= [x("取消", -1)]]),
							_: 1
						}),
						S(i, {
							color: "primary",
							variant: "flat",
							loading: X.value,
							onClick: Oe
						}, {
							default: V(() => [...r[46] ||= [x(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"])
					]),
					default: V(() => [
						b("p", wt, R(Y.value ? Y.value.root : ""), 1),
						S(g, {
							modelValue: ue.value,
							"onUpdate:modelValue": r[9] ||= (e) => ue.value = e,
							label: "别名",
							density: "compact",
							variant: "outlined",
							maxlength: "80",
							clearable: "",
							autofocus: "",
							onKeyup: ae(Oe, ["enter"])
						}, null, 8, ["modelValue"]),
						b("p", Tt, R(a.value.aliasHint), 1)
					]),
					_: 1
				}, 8, ["modelValue"]),
				S(n, {
					modelValue: Z.value,
					"onUpdate:modelValue": r[14] ||= (e) => Z.value = e,
					"initial-width": 440,
					"initial-height": 260,
					"min-width": 340,
					"min-height": 200
				}, {
					title: V(() => [...r[47] ||= [x("分组名称", -1)]]),
					actions: V(() => [
						S(C),
						S(i, {
							variant: "text",
							onClick: r[13] ||= (e) => Z.value = !1
						}, {
							default: V(() => [...r[48] ||= [x("取消", -1)]]),
							_: 1
						}),
						S(i, {
							color: "primary",
							variant: "flat",
							disabled: !de.value.trim(),
							onClick: ye
						}, {
							default: V(() => [...r[49] ||= [x(" 保存 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					]),
					default: V(() => [S(g, {
						modelValue: de.value,
						"onUpdate:modelValue": r[12] ||= (e) => de.value = e,
						label: "名称",
						density: "compact",
						variant: "outlined",
						maxlength: "80",
						autofocus: "",
						onKeyup: ae(ye, ["enter"])
					}, null, 8, ["modelValue"])]),
					_: 1
				}, 8, ["modelValue"]),
				S(n, {
					modelValue: fe.value,
					"onUpdate:modelValue": r[16] ||= (e) => fe.value = e,
					"initial-width": 440,
					"initial-height": 240,
					"min-width": 340,
					"min-height": 200
				}, {
					title: V(() => [...r[50] ||= [x("删除分组", -1)]]),
					actions: V(() => [
						S(C),
						S(i, {
							variant: "text",
							onClick: r[15] ||= (e) => fe.value = !1
						}, {
							default: V(() => [...r[51] ||= [x("取消", -1)]]),
							_: 1
						}),
						S(i, {
							color: "error",
							variant: "flat",
							onClick: Ee
						}, {
							default: V(() => [...r[52] ||= [x("删除", -1)]]),
							_: 1
						})
					]),
					default: V(() => [x(" " + R(pe.value ? pe.value.name : "") + " ", 1), r[53] ||= b("p", { class: "tip" }, "里面的子分组与工作区移到上一级，工作区本身不动。", -1)]),
					_: 1
				}, 8, ["modelValue"]),
				S(n, {
					modelValue: U.value,
					"onUpdate:modelValue": r[20] ||= (e) => U.value = e,
					"initial-width": 620,
					"initial-height": 460,
					"min-width": 420,
					"min-height": 300
				}, {
					title: V(() => [x(R(a.value.addTitle), 1)]),
					actions: V(() => [
						S(C),
						S(i, {
							variant: "text",
							onClick: r[19] ||= (e) => U.value = !1
						}, {
							default: V(() => [...r[54] ||= [x("取消", -1)]]),
							_: 1
						}),
						S(i, {
							color: "primary",
							variant: "flat",
							disabled: !W.value.trim() || !G.value,
							onClick: Fe
						}, {
							default: V(() => [x(R(a.value.addConfirm), 1)]),
							_: 1
						}, 8, ["disabled"])
					]),
					default: V(() => [(M(), _(z(me), {
						key: le.value,
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
				S(n, {
					modelValue: K.value,
					"onUpdate:modelValue": r[22] ||= (e) => K.value = e,
					"initial-width": 440,
					"initial-height": 260,
					"min-width": 340,
					"min-height": 200
				}, {
					title: V(() => [x(R(a.value.removeTitle), 1)]),
					actions: V(() => [
						S(C),
						S(i, {
							variant: "text",
							onClick: r[21] ||= (e) => K.value = null
						}, {
							default: V(() => [...r[55] ||= [x("取消", -1)]]),
							_: 1
						}),
						S(i, {
							color: "error",
							variant: "flat",
							onClick: Le
						}, {
							default: V(() => [x(R(a.value.removeConfirm), 1)]),
							_: 1
						})
					]),
					default: V(() => [x(" " + R(K.value ? K.value.root : "") + " ", 1), b("p", Et, R(a.value.removeText), 1)]),
					_: 1
				}, 8, ["modelValue"])
			], 32);
		};
	}
}, [["__scopeId", "data-v-593e1b9a"]]);
// src/composables/services/useWorkspaceState.js
function Ot({ api: e, storageKey: t, extraState: n = {}, loadExtra: i = null, addedNotice: a = "已添加" }) {
	let o = N({
		workspaces: [],
		groups: [],
		...n
	}), s = ce(t, "", { writeDefaults: !1 }), c = P(!1), l = P(null), { snack: u, toast: d } = r(), f = null, p = 0, m = g(() => o.workspaces.find((e) => e.id === s.value) || null), h = g(() => o.workspaces.reduce((e, t) => e + it(t), 0));
	function _(e) {
		s.value = e || "";
	}
	function v(e) {
		o.workspaces = e.workspaces || [], o.groups = e.groups || [], s.value && !m.value && _("");
	}
	async function y(t) {
		let n = o.groups;
		o.groups = t;
		try {
			let n = await e.saveGroups(t);
			n && n.groups && (o.groups = n.groups);
		} catch (e) {
			o.groups = n, d(`保存分组失败：${e.message}`, "error");
		}
	}
	async function b() {
		if (!p) try {
			v(await e.state());
		} catch {}
	}
	function x() {
		f = new EventSource(e.stateStreamUrl()), f.addEventListener("state", (e) => {
			if (!p) try {
				v(JSON.parse(e.data));
			} catch {}
		}), f.addEventListener("metrics", (e) => {
			if (!document.hidden) try {
				l.value = JSON.parse(e.data);
			} catch {}
		});
	}
	function S() {
		f &&= (f.close(), null);
	}
	async function C() {
		if (i) try {
			await i(o);
		} catch {}
	}
	async function w(e, t) {
		p += 1;
		try {
			return await t();
		} catch (t) {
			return d(`${e}失败：${t.message}`, "error"), null;
		} finally {
			--p, b();
		}
	}
	async function T(t) {
		let n = typeof t == "string" ? t : "";
		c.value = !0;
		let r = await w("添加工作区", async () => (await e.addWorkspace(n), !0));
		if (c.value = !1, !r) return;
		await b();
		let i = o.workspaces.find((e) => e.root === n || e.root === n.replace(/\/+$/, ""));
		i && _(i.id), d(a, "primary");
	}
	async function E(t) {
		await w("移出工作区", async () => (await e.forgetWorkspace(t), !0)) && (s.value === t && _(""), d("已移出，在跑的进程一并停了"));
	}
	async function D() {
		m.value && await w("重新扫描", () => e.rescan(m.value.id));
	}
	async function O(t) {
		await w("启动", () => e.start(t)) && d("已发出启动", "primary");
	}
	async function k(t) {
		await w("停止", () => e.stop(t)) && d("已停止");
	}
	async function A(t) {
		await w("保存参数", () => e.update(t)) && d("参数已保存", "primary");
	}
	async function j() {
		x(), await b(), C();
	}
	return {
		state: o,
		current: m,
		currentId: s,
		adding: c,
		snack: u,
		toast: d,
		metrics: l,
		running: h,
		select: _,
		setGroups: y,
		refresh: b,
		act: w,
		start: j,
		disconnect: S,
		addWorkspace: T,
		removeWorkspace: E,
		rescan: D,
		startService: O,
		stopService: k,
		saveService: A
	};
}
// src/components/services/ToolApp.vue
var kt = {
	__name: "ToolApp",
	props: {
		title: {
			type: String,
			required: !0
		},
		api: {
			type: Object,
			required: !0
		},
		empty: {
			type: Object,
			default: () => ({})
		},
		rememberTheme: {
			type: Function,
			default: null
		},
		storageKey: {
			type: String,
			required: !0
		},
		extraState: {
			type: Object,
			default: () => ({})
		},
		addedNotice: {
			type: String,
			default: "已添加"
		},
		loadExtra: {
			type: Function,
			default: null
		},
		listTexts: {
			type: Object,
			default: () => ({})
		},
		collapsedKey: {
			type: String,
			default: ""
		}
	},
	setup(e) {
		let t = e, { dark: n, toggle: r } = l({ rememberTheme: t.rememberTheme }), { state: i, current: a, currentId: o, adding: s, snack: u, toast: d, metrics: f, running: p, select: m, setGroups: h, refresh: g, act: y, start: b, addWorkspace: x, removeWorkspace: C, rescan: w, startService: T, stopService: E, saveService: D } = Ot({
			api: t.api,
			storageKey: t.storageKey,
			extraState: t.extraState,
			addedNotice: t.addedNotice,
			loadExtra: t.loadExtra
		});
		return j(b), (t, l) => (M(), _(ut, {
			title: e.title,
			workspaces: z(i).workspaces,
			current: z(a),
			running: z(p),
			dark: z(n),
			snack: z(u),
			empty: e.empty,
			"toggle-theme": z(r),
			onEmptyAction: l[1] ||= (e) => z(x)(),
			onSelectWorkspace: z(m)
		}, {
			sidebar: V(() => [S(Dt, {
				workspaces: z(i).workspaces,
				groups: z(i).groups,
				current: z(o),
				busy: z(s),
				dirs: e.api.dirs,
				"save-alias": e.api.setAlias,
				texts: e.listTexts,
				"storage-key": e.collapsedKey,
				onSelect: z(m),
				onAdd: z(x),
				onRemove: z(C),
				onChanged: z(g),
				onGroupsChange: z(h),
				onNotice: l[0] ||= (e) => z(d)(e.text, e.color)
			}, null, 8, [
				"workspaces",
				"groups",
				"current",
				"busy",
				"dirs",
				"save-alias",
				"texts",
				"storage-key",
				"onSelect",
				"onAdd",
				"onRemove",
				"onChanged",
				"onGroupsChange"
			])]),
			metrics: V(() => [S(z(c), {
				dark: z(n),
				metrics: z(f)
			}, null, 8, ["dark", "metrics"])]),
			default: V(({ ws: e }) => [e ? I(t.$slots, "panel", {
				ws: e,
				state: z(i),
				dark: z(n),
				toast: z(d),
				act: z(y),
				startService: z(T),
				stopService: z(E),
				saveService: z(D),
				rescan: z(w),
				removeWorkspace: z(C),
				refresh: z(g)
			}, void 0, void 0, 0) : v("", !0)]),
			_: 3
		}, 8, [
			"title",
			"workspaces",
			"current",
			"running",
			"dark",
			"snack",
			"empty",
			"toggle-theme",
			"onSelectWorkspace"
		]));
	}
}, At = { style: { width: "42%" } }, jt = { class: "svc-name" }, Mt = ["title"], Nt = ["title"], Pt = { class: "status-line" }, Ft = {
	key: 0,
	class: "meta"
}, It = {
	key: 1,
	class: "meta"
}, Lt = ["title"], Rt = {
	key: 1,
	class: "meta"
}, zt = {
	key: 2,
	class: "meta"
}, Bt = { class: "ops" }, Vt = /*#__PURE__*/ e({
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
			let r = L("v-chip"), i = L("v-btn"), a = L("v-icon"), o = L("v-table");
			return M(), _(o, {
				density: "compact",
				class: "table"
			}, {
				default: V(() => [b("thead", null, [b("tr", null, [
					b("th", At, R(e.nameTitle), 1),
					n[0] ||= b("th", null, "参数", -1),
					n[1] ||= b("th", { style: { width: "200px" } }, "状态", -1),
					n[2] ||= b("th", { style: { width: "230px" } }, null, -1)
				])]), b("tbody", null, [(M(!0), y(m, null, F(e.rows, (o) => (M(), y("tr", { key: o.key }, [
					b("td", null, [b("div", jt, [b("span", null, R(o.title), 1), o.typeText ? (M(), _(r, {
						key: 0,
						size: "x-small",
						variant: "tonal",
						class: "type-chip"
					}, {
						default: V(() => [x(R(o.typeText), 1)]),
						_: 2
					}, 1024)) : v("", !0)]), e.showPath && o.path ? (M(), y("div", {
						key: 0,
						class: "svc-path",
						title: o.path
					}, R(o.path), 9, Mt)) : v("", !0)]),
					b("td", null, [b("div", {
						class: "cmd",
						title: o.cmd
					}, R(o.cmd), 9, Nt)]),
					b("td", null, [b("div", Pt, [o.live ? (M(), y(m, { key: 0 }, [S(r, {
						size: "small",
						class: "status-chip",
						color: o.color,
						variant: "tonal",
						"prepend-icon": o.icon
					}, {
						default: V(() => [x(R(o.statusText), 1)]),
						_: 2
					}, 1032, ["color", "prepend-icon"]), o.port ? (M(), y("span", Ft, "端口 " + R(o.port), 1)) : o.started ? (M(), y("span", It, R(o.ago), 1)) : v("", !0)], 64)) : o.run ? (M(), y(m, { key: 1 }, [S(r, {
						size: "small",
						class: "status-chip",
						color: o.color,
						variant: "tonal",
						"prepend-icon": o.icon,
						onClick: (e) => t.$emit("log", o)
					}, {
						default: V(() => [x(R(o.statusText), 1)]),
						_: 2
					}, 1032, [
						"color",
						"prepend-icon",
						"onClick"
					]), o.err ? (M(), y("span", {
						key: 0,
						class: "meta err",
						title: o.err
					}, R(o.err), 9, Lt)) : o.started ? (M(), y("span", Rt, R(o.ago), 1)) : v("", !0)], 64)) : (M(), y("span", zt, "—"))])]),
					b("td", Bt, [o.live ? (M(), y(m, { key: 0 }, [S(i, {
						size: "small",
						variant: "text",
						"prepend-icon": "mdi-text-box-outline",
						onClick: (e) => t.$emit("log", o)
					}, {
						default: V(() => [...n[3] ||= [x(" 日志 ", -1)]]),
						_: 1
					}, 8, ["onClick"]), S(i, {
						size: "small",
						color: "error",
						variant: "tonal",
						loading: o.stopping,
						onClick: (e) => t.$emit("stop", o)
					}, {
						default: V(() => [...n[4] ||= [x(" 停止 ", -1)]]),
						_: 1
					}, 8, ["loading", "onClick"])], 64)) : (M(), y(m, { key: 1 }, [
						S(i, {
							size: "small",
							color: "primary",
							variant: "flat",
							disabled: o.blocked,
							loading: o.starting,
							onClick: (e) => t.$emit("start", o)
						}, {
							default: V(() => [x(R(o.action), 1)]),
							_: 2
						}, 1032, [
							"disabled",
							"loading",
							"onClick"
						]),
						S(i, {
							size: "small",
							variant: "text",
							icon: !0,
							title: "参数",
							onClick: (e) => t.$emit("settings", o)
						}, {
							default: V(() => [S(a, { size: "20" }, {
								default: V(() => [...n[5] ||= [x("mdi-tune", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["onClick"]),
						o.run ? (M(), _(i, {
							key: 0,
							size: "small",
							variant: "text",
							"prepend-icon": "mdi-text-box-outline",
							onClick: (e) => t.$emit("log", o)
						}, {
							default: V(() => [...n[6] ||= [x(" 日志 ", -1)]]),
							_: 1
						}, 8, ["onClick"])) : v("", !0)
					], 64)), I(t.$slots, "row-extra", { row: o }, void 0, !0)])
				]))), 128))])]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-8df04734"]]), Ht = { class: "log-head" }, Ut = { class: "log-box" }, Wt = {
	key: 1,
	class: "log-empty"
}, Gt = /*#__PURE__*/ e({
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
			let r = L("v-spacer"), i = L("v-btn");
			return M(), y(m, null, [b("div", Ht, [
				n[2] ||= b("span", { class: "label" }, "日志", -1),
				S(r),
				e.more ? (M(), _(i, {
					key: 0,
					size: "small",
					variant: "text",
					"prepend-icon": "mdi-history",
					onClick: n[0] ||= (e) => t.$emit("load-more")
				}, {
					default: V(() => [...n[1] ||= [x(" 更早 ", -1)]]),
					_: 1
				})) : v("", !0)
			]), b("div", Ut, [e.text ? (M(), _(U, {
				key: 0,
				text: e.text,
				dark: e.dark,
				colorize: e.colorize
			}, null, 8, [
				"text",
				"dark",
				"colorize"
			])) : (M(), y("p", Wt, R(e.emptyText), 1))])], 64);
		};
	}
}, [["__scopeId", "data-v-d45becae"]]);
// src/utils/services/toolApi.js
function Kt(e, t = {}) {
	let { call: n } = d({ prefix: e });
	return {
		call: n,
		api: {
			state: () => n("GET", "/state"),
			stateStreamUrl: () => `${e}/state/stream`,
			log: (e, t = 0) => n("GET", `/log?run=${f(e)}&page=${t}`),
			logStreamUrl: (t) => `${e}/log/stream?run=${f(t)}`,
			dirs: (e = "") => n("GET", `/dirs${e ? `?path=${f(e)}` : ""}`),
			addWorkspace: (e) => n("POST", "/workspaces", { root: e }),
			forgetWorkspace: (e) => n("POST", "/forget", { ws: e }),
			setAlias: (e, t) => n("POST", "/alias", {
				ws: e,
				alias: t
			}),
			saveGroups: (e) => n("POST", "/groups", { nodes: e }),
			rescan: (e) => n("POST", "/rescan", { ws: e }),
			start: (e) => n("POST", "/start", e),
			stop: (e) => n("POST", "/stop", { run: e }),
			update: (e) => n("POST", "/update", e),
			...t
		}
	};
}
// src/composables/commons/useFileTree.js
function qt(e, t = () => ({})) {
	let n = N({});
	function r() {
		let t = typeof e == "function" ? e() : z(e);
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
	let s = g(() => o(i(r()), 0));
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
function Jt({ api: e, ws: t, statusText: n = {} }) {
	let r = P(""), i = P(!1), a = P(0), o = P(""), s = P(""), c = P(""), l = null;
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
	return B(t, (e) => {
		if (!c.value || !e) return;
		let t = (e.services || []).find((e) => e.id === c.value);
		t && t.run && (o.value = n[t.run.status] || t.run.status);
	}), A(u), {
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
export { Y as DirectoryNode, me as DirectoryPicker, et as FileEditor, Me as FileTree, rt as LIVE_STATUSES, U as LogView, Gt as RunLogPanel, Vt as ServiceTable, kt as ToolApp, Dt as WorkspaceList, ut as WorkspaceShell, Te as copyText, Kt as createToolApi, $ as fileIcon, it as runningCount, p as symbolAt, qt as useFileTree, Jt as useRunLog, nt as useSplitPane, u as useStoredChoice, Ot as useWorkspaceState };
