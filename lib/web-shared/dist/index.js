import { t as e } from "./_plugin-vue_export-helper.js";
import { n as t, r as n, t as r } from "./useToast.js";
import { n as i, t as a } from "./SplitHandle.js";
import { languageOf as o } from "./highlight.js";
import { baseName as s } from "./format.js";
import { t as c } from "./Metrics2.js";
import { useThemeToggle as l } from "./theme.js";
import { createJsonClient as u, encodeParam as d } from "./http.js";
import { symbolAt as f } from "./text.js";
import { Fragment as p, Teleport as m, computed as h, createBlock as g, createCommentVNode as _, createElementBlock as v, createElementVNode as y, createTextVNode as b, createVNode as x, getCurrentInstance as S, guardReactiveProps as C, mergeProps as w, nextTick as T, normalizeClass as E, normalizeProps as D, normalizeStyle as O, onBeforeUnmount as k, onMounted as A, openBlock as j, reactive as M, ref as N, renderList as P, renderSlot as F, resolveComponent as I, resolveDynamicComponent as ee, shallowRef as te, toDisplayString as L, unref as R, vShow as ne, watch as z, watchEffect as re, withCtx as B, withDirectives as ie, withKeys as ae, withModifiers as V } from "vue";
import { Terminal as oe } from "@xterm/xterm";
import { FitAddon as se } from "@xterm/addon-fit";
import { useLocalStorage as ce } from "@vueuse/core";
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
		}, r = N(null), i = null, a = null, o = null, s = "";
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
		return A(() => {
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
		}), z(() => t.text, (e) => d(e || "")), z(() => t.dark, (e) => {
			i && (i.options.theme = c(e));
		}), k(() => {
			o && o.disconnect(), i && i.dispose(), o = null, i = null;
		}), (t, n) => (j(), v("div", {
			ref_key: "host",
			ref: r,
			class: E(["term", { deeper: e.dark }]),
			style: O(e.height ? {
				height: e.height,
				flex: "0 0 auto"
			} : null)
		}, null, 6));
	}
}, [["__scopeId", "data-v-619b1e01"]]), U = { class: "node" }, W = ["title"], G = {
	key: 0,
	class: "kids"
}, le = {
	key: 0,
	class: "hint"
}, K = {
	key: 1,
	class: "hint bad"
}, q = {
	key: 0,
	class: "hint"
}, J = /*#__PURE__*/ e({
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
		let n = e, r = t, i = N(!1), a = N(!1), o = N(""), s = N(null);
		z(() => n.selected === n.node.path, (e) => {
			e && T(() => s.value && s.value.scrollIntoView({ block: "nearest" }));
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
			let r = I("v-icon"), u = I("v-btn"), d = I("DirectoryNode", !0);
			return j(), v("div", U, [y("div", {
				ref_key: "rowEl",
				ref: s,
				class: E(["row", { selected: e.node.path === e.selected }]),
				onClick: c
			}, [
				x(u, {
					icon: !0,
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: i.value ? "收起" : "展开",
					onClick: V(l, ["stop"])
				}, {
					default: B(() => [x(r, { size: "18" }, {
						default: B(() => [b(L(i.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"]),
				x(r, {
					size: "18",
					class: "folder"
				}, {
					default: B(() => [...n[1] ||= [b("mdi-folder-outline", -1)]]),
					_: 1
				}),
				y("span", {
					class: "label",
					title: e.node.path
				}, L(e.node.name), 9, W)
			], 2), i.value ? (j(), v("div", G, [a.value ? (j(), v("p", le, "正在读取…")) : o.value ? (j(), v("p", K, L(o.value), 1)) : e.node.children ? (j(), v(p, { key: 2 }, [(j(!0), v(p, null, P(e.node.children, (r) => (j(), g(d, {
				key: r.path,
				node: r,
				selected: e.selected,
				loader: e.loader,
				onPick: n[0] ||= (e) => t.$emit("pick", e)
			}, null, 8, [
				"node",
				"selected",
				"loader"
			]))), 128)), e.node.children.length ? _("", !0) : (j(), v("p", q, "没有子目录"))], 64)) : _("", !0)])) : _("", !0)]);
		};
	}
}, [["__scopeId", "data-v-9e855642"]]), Y = { class: "picker" }, ue = {
	key: 0,
	class: "tip"
}, X = { class: "tree" }, de = { class: "root" }, Z = ["title"], fe = {
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
		let n = e, r = t, i = N(""), a = N(null), o = N(!0), s = N(""), c = h({
			get: () => n.modelValue,
			set: (e) => r("update:modelValue", e)
		}), l = h(() => {
			let e = String(n.modelValue || "").trim();
			return e === "~" ? e = i.value : e.startsWith("~/") && (e = i.value + e.slice(1)), e.replace(/\/+$/, "");
		}), u = h(() => !i.value || !l.value ? !1 : n.validate ? !!n.validate(l.value, i.value) : l.value === i.value || l.value.startsWith(i.value + "/"));
		re(() => r("update:valid", u.value));
		function d(e) {
			c.value = e.path;
		}
		return A(async () => {
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
			let r = I("v-text-field"), f = I("v-icon"), m = I("v-progress-circular");
			return j(), v("div", Y, [
				e.tip ? (j(), v("p", ue, L(e.tip), 1)) : _("", !0),
				x(r, {
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
				y("div", X, [y("div", de, [
					x(f, { size: "18" }, {
						default: B(() => [...n[1] ||= [b("mdi-home-outline", -1)]]),
						_: 1
					}),
					y("span", {
						class: "root-label",
						title: i.value || "~"
					}, "~", 8, Z),
					o.value ? (j(), g(m, {
						key: 0,
						size: "12",
						width: "2",
						indeterminate: ""
					})) : _("", !0)
				]), s.value ? (j(), v("p", fe, L(s.value), 1)) : a.value ? (j(), v(p, { key: 1 }, [(j(!0), v(p, null, P(a.value, (t) => (j(), g(J, {
					key: t.path,
					node: t,
					selected: l.value,
					loader: e.loader,
					onPick: d
				}, null, 8, [
					"node",
					"selected",
					"loader"
				]))), 128)), a.value.length ? _("", !0) : (j(), v("p", pe, "家目录下没有子目录"))], 64)) : _("", !0)])
			]);
		};
	}
}, [["__scopeId", "data-v-a4b93ef9"]]), Q = {
	icon: "mdi-file-outline",
	color: ""
}, he = {
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
}, ge = {
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
function _e(e) {
	let t = String(e || "").split("/").pop().toLowerCase(), n = he[t];
	if (n) return n;
	let r = t.lastIndexOf(".");
	return r < 0 ? Q : ge[t.slice(r + 1)] || Q;
}
// src/components/commons/FileTree/FileTreeNode.vue
var $ = { class: "branch" }, ve = ["data-path", "data-type"], ye = {
	key: 1,
	class: "arrow-space"
}, be = ["title"], xe = {
	key: 0,
	class: "hint bad"
}, Se = {
	key: 0,
	class: "hint"
}, Ce = /*#__PURE__*/ e({
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
		let n = e, r = t, i = { truncated: "这一层文件太多，只列了前面一部分。" }, a = h(() => ({
			...i,
			...n.texts
		})), o = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, s = h(() => n.keyOf(n.node)), c = h(() => n.dirOf(n.node)), l = h(() => n.expanded[s.value] === !0), u = h(() => n.cache[s.value] || o), d = h(() => c.value ? null : _e(n.nameOf(n.node))), f = h(() => c.value ? l.value ? "mdi-folder-open-outline" : "mdi-folder-outline" : d.value.icon), m = h(() => c.value ? null : d.value.color ? { color: d.value.color } : null);
		function S() {
			n.pickOnRowClick && (c.value ? r("toggle", s.value) : r("pick", n.node));
		}
		function C(e) {
			r("context", {
				node: n.node,
				event: e
			});
		}
		return (t, n) => {
			let i = I("v-icon"), o = I("v-btn"), d = I("v-progress-circular"), h = I("FileTreeNode", !0);
			return j(), v("div", $, [y("div", {
				class: E(["row", [e.rowClass ? e.rowClass(e.node) : null, { clickable: e.pickOnRowClick }]]),
				"data-path": s.value,
				"data-type": e.node.type,
				style: O({ paddingLeft: 4 + e.depth * 18 + "px" }),
				onClick: S,
				onContextmenu: V(C, ["prevent", "stop"])
			}, [
				c.value ? (j(), g(o, {
					key: 0,
					icon: "",
					size: "x-small",
					variant: "text",
					class: "arrow",
					title: l.value ? "收起" : "展开",
					onClick: n[0] ||= V((e) => r("toggle", s.value), ["stop"])
				}, {
					default: B(() => [x(i, { size: "16" }, {
						default: B(() => [b(L(l.value ? "mdi-chevron-down" : "mdi-chevron-right"), 1)]),
						_: 1
					})]),
					_: 1
				}, 8, ["title"])) : (j(), v("span", ye)),
				c.value && l.value && u.value.loading ? (j(), g(d, {
					key: 2,
					indeterminate: "",
					size: 14,
					width: 2,
					class: "spin"
				})) : (j(), g(i, {
					key: 3,
					size: "16",
					class: E(c.value ? "folder" : "file"),
					style: O(m.value)
				}, {
					default: B(() => [b(L(f.value), 1)]),
					_: 1
				}, 8, ["class", "style"])),
				F(t.$slots, "row-before-label", {
					node: e.node,
					open: l.value,
					state: u.value
				}, void 0, !0),
				y("span", {
					class: E(["label", e.labelClass]),
					title: s.value
				}, L(e.nameOf(e.node)), 11, be),
				F(t.$slots, "row-after-label", {
					node: e.node,
					open: l.value,
					state: u.value
				}, void 0, !0)
			], 46, ve), c.value && l.value ? (j(), v(p, { key: 0 }, [u.value.error ? (j(), v("p", xe, L(u.value.error), 1)) : (j(), v(p, { key: 1 }, [(j(!0), v(p, null, P(u.value.entries, (i) => (j(), g(h, {
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
				"row-before-label": B((e) => [F(t.$slots, "row-before-label", w({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": B((e) => [F(t.$slots, "row-after-label", w({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), u.value.truncated ? (j(), v("p", Se, L(a.value.truncated), 1)) : _("", !0)], 64))], 64)) : _("", !0)]);
		};
	}
}, [["__scopeId", "data-v-f0de9fb7"]]);
// src/utils/commons/clipboard.js
async function we(e) {
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
var Te = {
	key: 0,
	class: "root-loading"
}, Ee = {
	key: 1,
	class: "hint bad"
}, De = {
	key: 0,
	class: "hint"
}, Oe = ["disabled"], ke = ["disabled"], Ae = ["disabled"], je = /*#__PURE__*/ e({
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
		}, o = h(() => ({
			...a,
			...r.texts
		})), s = {
			loading: !1,
			error: "",
			entries: [],
			truncated: !1
		}, c = M({}), l = M({}), u = N(!1), d = N(null), f = h(() => r.root ? r.keyOf(r.root) : ""), S = h(() => l[f.value] || s);
		async function E(e, t = !1) {
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
		function ee(e) {
			c[e] = !c[e], c[e] && E(e);
		}
		async function te(e) {
			c[f.value] = !0, await E(f.value);
			let t = f.value;
			for (let n of String(e || "").split("/").filter(Boolean)) t = t ? `${t}/${n}` : n, await E(t), c[t] = !0;
		}
		function R() {
			return Object.keys(c).filter((e) => c[e]);
		}
		async function ne(e) {
			let t = Array.isArray(e) ? e : [];
			await Promise.all(t.map(async (e) => {
				c[e] = !0, await E(e);
			}));
		}
		function re() {
			for (let e of Object.keys(c)) c[e] = !1;
			c[f.value] = !0;
		}
		function ie() {
			for (let e of Object.keys(l)) delete l[e];
			for (let e of Object.keys(c)) delete c[e];
			c[f.value] = !0, E(f.value);
		}
		async function ae(e) {
			await E(e, !0);
		}
		async function oe() {
			let e = Object.keys(c).filter((e) => c[e]);
			await Promise.all(e.map((e) => E(e, !0)));
		}
		async function se(e) {
			let t = new Set(Array.isArray(e) ? e : []);
			t.add(f.value);
			let n = [...t].filter((e) => e === f.value || c[e]);
			await Promise.all(n.map((e) => E(e, !0)));
		}
		function ce(e) {
			let t = d.value ? d.value.querySelectorAll("[data-path]") : [];
			for (let n of t) if (n.dataset.path === e) {
				n.scrollIntoView({ block: "nearest" });
				return;
			}
		}
		async function H() {
			await Promise.all(Object.keys(l).map((e) => E(e, !0)));
		}
		function U() {
			r.active && !u.value && (u.value = !0, c[f.value] = !0, E(f.value));
		}
		r.active && U(), A(U), z(() => r.active, (e) => {
			e && U();
		});
		let W = M({
			open: !1,
			x: 0,
			y: 0,
			node: null,
			copied: ""
		}), G = N(null), le = 0, K = h(() => W.node ? String(r.keyOf(W.node) || "") : ""), q = h(() => {
			if (!W.node || !r.rootPath) return "";
			let e = r.rootPath.replace(/\/+$/, ""), t = K.value;
			return t ? `${e}/${t}` : e;
		}), J = h(() => W.node ? r.dirOf(W.node) : !1);
		function Y({ node: e, event: t }) {
			W.node = e, W.copied = "", W.x = t.clientX, W.y = t.clientY, W.open = !0, T(ue);
		}
		function ue() {
			if (!G.value) return;
			let e = G.value.offsetWidth, t = G.value.offsetHeight;
			W.x = Math.max(6, Math.min(W.x, window.innerWidth - e - 6)), W.y = Math.max(6, Math.min(W.y, window.innerHeight - t - 6));
		}
		function X() {
			W.open = !1, W.node = null, W.copied = "", clearTimeout(le);
		}
		async function de(e) {
			let t = e === "abs" ? q.value : K.value;
			t && await we(t) && (W.copied = e, clearTimeout(le), le = setTimeout(X, 700));
		}
		function Z(e) {
			if (!W.node) return;
			let t = W.node;
			X(), i("action", {
				action: e,
				node: t
			});
		}
		function fe() {
			if (!W.node || !r.downloadOf) return;
			let e = W.node, t = r.downloadOf(e);
			if (X(), !t) return;
			let n = r.nameOf(e) || "download", i = document.createElement("a");
			i.href = t, i.download = r.dirOf(e) ? `${n}.zip` : n, i.rel = "noopener", i.style.display = "none", document.body.appendChild(i), i.click(), i.remove();
		}
		function pe(e) {
			G.value && !G.value.contains(e.target) && X();
		}
		function me(e) {
			e.key === "Escape" && X();
		}
		function Q() {
			W.open && X();
		}
		function he(e) {
			let t = e ? "addEventListener" : "removeEventListener";
			document[t]("mousedown", pe, !0), document[t]("keydown", me, !0), window[t]("scroll", Q, !0), window[t]("resize", Q);
		}
		return z(() => W.open, (e) => he(e)), k(() => {
			X(), he(!1);
		}), t({
			reveal: te,
			reload: ie,
			reloadDir: ae,
			reloadExpanded: oe,
			reloadDirs: se,
			refreshAll: H,
			scrollTo: ce,
			toggle: ee,
			collapseAll: re,
			expandedKeys: R,
			restoreExpanded: ne
		}), (t, n) => {
			let r = I("v-progress-circular"), a = I("v-icon");
			return j(), v("div", {
				ref_key: "rootRef",
				ref: d,
				class: "file-tree"
			}, [e.root ? (j(), g(Ce, {
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
				onToggle: ee,
				onPick: n[0] ||= (e) => i("pick", e),
				onContext: Y
			}, {
				"row-before-label": B((e) => [F(t.$slots, "row-before-label", D(C(e)), void 0, !0)]),
				"row-after-label": B((e) => [F(t.$slots, "row-after-label", D(C(e)), void 0, !0)]),
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
			])) : (j(), v(p, { key: 1 }, [S.value.loading ? (j(), v("div", Te, [x(r, {
				indeterminate: "",
				size: 14,
				width: 2
			})])) : S.value.error ? (j(), v("p", Ee, L(S.value.error), 1)) : (j(), v(p, { key: 2 }, [(j(!0), v(p, null, P(S.value.entries, (r) => (j(), g(Ce, {
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
				onToggle: ee,
				onPick: n[1] ||= (e) => i("pick", e),
				onContext: Y
			}, {
				"row-before-label": B((e) => [F(t.$slots, "row-before-label", w({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": B((e) => [F(t.$slots, "row-after-label", w({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), S.value.truncated ? (j(), v("p", De, L(o.value.truncated), 1)) : _("", !0)], 64))], 64)), (j(), g(m, { to: "body" }, [W.open ? (j(), v("div", {
				key: 0,
				ref_key: "menuRef",
				ref: G,
				class: "ft-menu",
				style: O({
					left: W.x + "px",
					top: W.y + "px"
				}),
				onContextmenu: n[10] ||= V(() => {}, ["prevent"])
			}, [
				e.editable ? (j(), v(p, { key: 0 }, [
					J.value ? (j(), v("button", {
						key: 0,
						class: "ft-item",
						type: "button",
						onClick: n[2] ||= (e) => Z("create-file")
					}, [x(a, { size: "16" }, {
						default: B(() => [...n[11] ||= [b("mdi-file-plus-outline", -1)]]),
						_: 1
					}), y("span", null, L(o.value.newFile), 1)])) : _("", !0),
					J.value ? (j(), v("button", {
						key: 1,
						class: "ft-item",
						type: "button",
						onClick: n[3] ||= (e) => Z("create-dir")
					}, [x(a, { size: "16" }, {
						default: B(() => [...n[12] ||= [b("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), y("span", null, L(o.value.newDir), 1)])) : _("", !0),
					J.value ? (j(), v("button", {
						key: 2,
						class: "ft-item",
						type: "button",
						onClick: n[4] ||= (e) => Z("upload")
					}, [x(a, { size: "16" }, {
						default: B(() => [...n[13] ||= [b("mdi-cloud-upload-outline", -1)]]),
						_: 1
					}), y("span", null, L(o.value.upload), 1)])) : _("", !0),
					y("button", {
						class: "ft-item",
						type: "button",
						disabled: !K.value,
						onClick: n[5] ||= (e) => Z("rename")
					}, [x(a, { size: "16" }, {
						default: B(() => [...n[14] ||= [b("mdi-form-textbox", -1)]]),
						_: 1
					}), y("span", null, L(o.value.rename), 1)], 8, Oe),
					y("button", {
						class: "ft-item danger",
						type: "button",
						disabled: !K.value,
						onClick: n[6] ||= (e) => Z("delete")
					}, [x(a, { size: "16" }, {
						default: B(() => [...n[15] ||= [b("mdi-trash-can-outline", -1)]]),
						_: 1
					}), y("span", null, L(o.value.delete), 1)], 8, ke),
					n[17] ||= y("div", { class: "ft-sep" }, null, -1),
					y("button", {
						class: "ft-item",
						type: "button",
						onClick: n[7] ||= (e) => Z("props")
					}, [x(a, { size: "16" }, {
						default: B(() => [...n[16] ||= [b("mdi-information-outline", -1)]]),
						_: 1
					}), y("span", null, L(o.value.props), 1)]),
					n[18] ||= y("div", { class: "ft-sep" }, null, -1)
				], 64)) : _("", !0),
				y("button", {
					class: "ft-item",
					type: "button",
					disabled: !K.value,
					onClick: n[8] ||= (e) => de("rel")
				}, [x(a, { size: "16" }, {
					default: B(() => [...n[19] ||= [b("mdi-content-copy", -1)]]),
					_: 1
				}), y("span", null, L(W.copied === "rel" ? o.value.copied : o.value.copyRel), 1)], 8, Ae),
				e.rootPath ? (j(), v("button", {
					key: 1,
					class: "ft-item",
					type: "button",
					onClick: n[9] ||= (e) => de("abs")
				}, [x(a, { size: "16" }, {
					default: B(() => [...n[20] ||= [b("mdi-link-variant", -1)]]),
					_: 1
				}), y("span", null, L(W.copied === "abs" ? o.value.copied : o.value.copyAbs), 1)])) : _("", !0),
				e.downloadOf ? (j(), v("button", {
					key: 2,
					class: "ft-item",
					type: "button",
					onClick: fe
				}, [x(a, { size: "16" }, {
					default: B(() => [b(L(J.value ? "mdi-folder-zip-outline" : "mdi-download"), 1)]),
					_: 1
				}), y("span", null, L(J.value ? o.value.downloadDir : o.value.downloadFile), 1)])) : _("", !0)
			], 36)) : _("", !0)]))], 512);
		};
	}
}, [["__scopeId", "data-v-32ca7798"]]), Me = { class: "file-head" }, Ne = { class: "crumbs" }, Pe = ["title", "onClick"], Fe = { class: "meta" }, Ie = /*#__PURE__*/ e({
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
		let n = e, r = t, i = h(() => {
			let e = String(n.path || "").split("/").filter(Boolean), t = "";
			return e.map((e) => (t = t ? `${t}/${e}` : e, {
				name: e,
				path: t
			}));
		}), a = h(() => {
			if (n.size === void 0 || n.size === null) return "";
			let e = Number(n.size) || 0;
			return e < 1024 ? `${e} 字节` : e < 1048576 ? `${(e / 1024).toFixed(1)} KB` : `${(e / 1024 / 1024).toFixed(1)} MB`;
		});
		function o(e, t) {
			t !== i.value.length - 1 && r("navigate", e.path);
		}
		return (t, n) => (j(), v("div", Me, [
			y("nav", Ne, [y("button", {
				class: E(["seg", { link: e.navigable }]),
				title: "回到根目录",
				onClick: n[0] ||= (e) => r("navigate", "")
			}, L(e.rootName), 3), (j(!0), v(p, null, P(i.value, (t, r) => (j(), v(p, { key: t.path }, [n[1] ||= y("span", { class: "sep" }, "/", -1), y("button", {
				class: E(["seg", {
					last: r === i.value.length - 1,
					link: e.navigable && r !== i.value.length - 1
				}]),
				title: t.path,
				onClick: (e) => o(t, r)
			}, L(t.name), 11, Pe)], 64))), 128))]),
			F(t.$slots, "actions", {}, void 0, !0),
			y("span", Fe, L(a.value), 1)
		]));
	}
}, [["__scopeId", "data-v-ca7b2c85"]]), Le = /*#__PURE__*/ e({
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
			let a = I("v-spacer"), o = I("v-btn");
			return j(), g(n, {
				"model-value": e.modelValue,
				"initial-width": 440,
				"initial-height": 280,
				"min-width": 340,
				"min-height": 200,
				"onUpdate:modelValue": i[2] ||= (e) => !e && r("answer", !1)
			}, {
				title: B(() => [...i[3] ||= [b("文件还没保存", -1)]]),
				actions: B(() => [
					x(a),
					x(o, {
						variant: "text",
						onClick: i[0] ||= (e) => r("answer", !1)
					}, {
						default: B(() => [...i[4] ||= [b("留在这里", -1)]]),
						_: 1
					}),
					x(o, {
						color: "error",
						variant: "flat",
						onClick: i[1] ||= (e) => r("answer", !0)
					}, {
						default: B(() => [...i[5] ||= [b("丢掉修改", -1)]]),
						_: 1
					})
				]),
				default: B(() => [b(" " + L(e.path || "当前文件") + " ", 1), i[6] ||= y("p", { class: "tip" }, "换过去之后这次的修改就没了，要保留就先按 Ctrl+S 保存。", -1)]),
				_: 1
			}, 8, ["model-value"]);
		};
	}
}, [["__scopeId", "data-v-d6dcbf86"]]);
// src/components/commons/FileEditor/useFileEditor.js
function Re({ loader: e, saver: t }) {
	let n = N(""), r = M({
		base: "",
		draft: "",
		loading: !1,
		error: "",
		saving: !1,
		saveError: ""
	}), i = 0, a = h(() => r.draft !== r.base);
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
var ze = {
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
function Be(e) {
	let t = o(e);
	return t === "markdown" ? ze.markdown : t ? ze.code : ze.plain;
}
function Ve(e) {
	return Be(e).modes;
}
function He(e, t) {
	return t.some((t) => t.id === e) ? e : "source";
}
function Ue(e, t) {
	return t > 0 ? "source" : e;
}
function We(e) {
	return {
		mode: "source",
		message: `视图加载失败${e && e.message ? `：${e.message}` : ""}`
	};
}
// src/components/commons/FileEditor/FileEditor.vue
var Ge = { class: "file-editor" }, Ke = {
	key: 1,
	class: "actions"
}, qe = {
	key: 1,
	class: "hint"
}, Je = {
	key: 3,
	class: "edit-wrap"
}, Ye = {
	key: 0,
	class: "hint bad edit-error"
}, Xe = {
	key: 1,
	class: "hint bad edit-error"
}, Ze = {
	key: 3,
	class: "hint"
}, Qe = /*#__PURE__*/ e({
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
		let r = e, a = n, o = S(), s = h(() => !!o?.vnode.props?.onNavigate), { path: c, state: l, dirty: u, load: d, save: f, discard: m, reset: y } = Re({
			loader: r.loader,
			saver: r.saver
		}), C = N(null);
		z(u, (e) => a("dirty", e));
		let w = N("source"), E = h(() => Ve(c.value)), D = h(() => E.value.find((e) => e.id === w.value) || null), O = te(null), A = N(!1), M = N(""), F = 0;
		function ne() {
			if (!F) return;
			let e = C.value;
			if (!e || typeof e.locate != "function") return;
			let t = F;
			F = 0, e.locate(t);
		}
		z(E, (e) => {
			w.value = He(w.value, e);
		}, { immediate: !0 }), z(D, async (e) => {
			if (O.value = null, A.value = !!e, e) {
				M.value = "";
				try {
					let t = await e.load();
					if (D.value !== e) return;
					O.value = t.default, await T(), ne();
				} catch (t) {
					if (D.value === e) {
						let e = We(t);
						M.value = e.message, w.value = e.mode;
					}
				} finally {
					D.value === e && (A.value = !1);
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
			m();
		}
		function ae(e) {
			a("definition", {
				path: c.value,
				...e
			});
		}
		function V(e) {
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
		let ce = N(!1), H = null;
		async function U(e, t = 0) {
			return M.value = "", w.value = Ue(w.value, t), F = t, await d(e) ? (await T(), t || C.value?.resetScroll(), ne(), !0) : (F = 0, !1);
		}
		async function W() {
			return !c.value || !await d(c.value) ? !1 : (await T(), C.value?.resetScroll(), !0);
		}
		function G() {
			q(), y();
		}
		function le() {
			return u.value ? ce.value ? Promise.resolve(!1) : (ce.value = !0, new Promise((e) => {
				H = e;
			})) : Promise.resolve(!0);
		}
		function K(e) {
			if (ce.value = !1, !H) return;
			let t = H;
			H = null, t(e);
		}
		function q() {
			K(!1);
		}
		let J = h(() => l.draft), Y = h(() => l.base);
		function ue(e) {
			l.draft = e == null ? "" : String(e);
		}
		return k(() => K(!1)), t({
			open: U,
			reload: W,
			close: G,
			save: re,
			discard: ie,
			confirmLeave: le,
			cancelLeave: q,
			path: c,
			dirty: u,
			text: J,
			base: Y,
			restore: ue
		}), (t, n) => {
			let r = I("v-btn"), o = I("v-btn-toggle"), d = I("v-chip");
			return j(), v("section", Ge, [
				R(c) ? (j(), g(Ie, {
					key: 0,
					"root-name": e.rootName,
					path: R(c),
					size: e.size,
					navigable: s.value,
					onNavigate: n[1] ||= (e) => a("navigate", e)
				}, {
					actions: B(() => [E.value.length > 1 ? (j(), g(o, {
						key: 0,
						modelValue: w.value,
						"onUpdate:modelValue": n[0] ||= (e) => w.value = e,
						density: "compact",
						variant: "text",
						divided: "",
						mandatory: "",
						class: "views"
					}, {
						default: B(() => [(j(!0), v(p, null, P(E.value, (e) => (j(), g(r, {
							key: e.id,
							value: e.id,
							size: "small"
						}, {
							default: B(() => [b(L(e.title), 1)]),
							_: 2
						}, 1032, ["value"]))), 128))]),
						_: 1
					}, 8, ["modelValue"])) : _("", !0), R(u) && !R(l).loading ? (j(), v("div", Ke, [
						x(d, {
							size: "x-small",
							variant: "flat",
							color: "modified"
						}, {
							default: B(() => [...n[6] ||= [b("未保存", -1)]]),
							_: 1
						}),
						x(r, {
							size: "small",
							variant: "text",
							color: "primary",
							loading: R(l).saving,
							onClick: re
						}, {
							default: B(() => [...n[7] ||= [b(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"]),
						x(r, {
							size: "small",
							variant: "text",
							disabled: R(l).saving,
							onClick: ie
						}, {
							default: B(() => [...n[8] ||= [b(" 放弃 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					])) : _("", !0)]),
					_: 1
				}, 8, [
					"root-name",
					"path",
					"size",
					"navigable"
				])) : _("", !0),
				R(l).loading ? (j(), v("p", qe, "正在读取文件…")) : R(l).error ? (j(), g(i, {
					key: 2,
					icon: "mdi-file-question-outline",
					"icon-size": 28,
					title: R(l).error,
					hint: "换一个文件试试，或者从左侧目录里下载它。"
				}, null, 8, ["title"])) : R(c) ? (j(), v("div", Je, [
					M.value ? (j(), v("p", Ye, L(M.value), 1)) : _("", !0),
					R(l).saveError ? (j(), v("p", Xe, L(R(l).saveError), 1)) : _("", !0),
					O.value ? (j(), g(ee(O.value), {
						key: 2,
						ref_key: "paneRef",
						ref: C,
						modelValue: R(l).draft,
						"onUpdate:modelValue": n[2] ||= (e) => R(l).draft = e,
						path: R(c),
						onSymbol: ae,
						onMenu: V,
						onRename: oe,
						onCaret: se,
						markers: e.markers,
						onEdit: n[3] ||= (e) => t.$emit("edit", { path: R(c) }),
						onHover: n[4] ||= (e) => t.$emit("hover", {
							path: R(c),
							...e
						}),
						onHoverEnd: n[5] ||= (e) => t.$emit("hover-end", { path: R(c) })
					}, null, 40, [
						"modelValue",
						"path",
						"markers"
					])) : A.value ? (j(), v("p", Ze, "正在准备视图…")) : _("", !0)
				])) : (j(), g(i, {
					key: 4,
					icon: "mdi-file-outline",
					hint: "从左边选一个文件，右边显示它的内容。"
				})),
				x(Le, {
					"model-value": ce.value,
					path: R(c),
					onAnswer: K
				}, null, 8, ["model-value", "path"])
			]);
		};
	}
}, [["__scopeId", "data-v-1e91d8a1"]]), $e = "web-shared-resizing";
function et({ area: e, initial: t, min: n = 0, max: r = 100, rightMin: i = 0, axis: a = "x", unit: o = "px", persist: s = "" }) {
	let c = N(f()), l = N(!1), u = 0, d = 0;
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
		l.value && (l.value = !1, window.removeEventListener("pointermove", m), document.body.classList.remove($e));
	}
	function g(t) {
		t.button === 0 && e.value && (l.value = !0, u = a === "x" ? t.clientX : t.clientY, d = c.value, t.preventDefault(), document.body.classList.add($e), window.addEventListener("pointermove", m), window.addEventListener("pointerup", h, { once: !0 }));
	}
	function _() {
		c.value = t;
	}
	return z(c, (e) => {
		if (s) try {
			window.localStorage.setItem(s, String(e));
		} catch {}
	}), k(h), {
		size: c,
		resizing: l,
		start: g,
		stop: h,
		reset: _
	};
}
// src/utils/services/serviceStatus.js
var tt = ["starting", "ready"];
function nt(e, t = tt) {
	return (e.services || []).filter((e) => e.run && t.includes(e.run.status)).length;
}
function rt(e, t = tt) {
	let n = [];
	for (let r of e || []) {
		let e = nt(r, t);
		e && n.push({
			id: r.id,
			name: r.alias || s(r.root),
			count: e
		});
	}
	return n;
}
// src/components/services/WorkspaceShell.vue
var it = { class: "brand" }, at = { class: "run-count" }, ot = { class: "side" }, st = { class: "content" }, ct = /*#__PURE__*/ e({
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
		let r = e, o = n, s = h(() => rt(r.workspaces));
		function c(e) {
			o("select-workspace", e);
		}
		let l = N(null), u = N(!0), { size: d, resizing: f, start: m, reset: S } = et({
			area: l,
			initial: 268,
			min: 200,
			rightMin: 420,
			persist: `${r.title}.shell.side-width`
		});
		return (n, r) => {
			let o = I("v-app-bar-nav-icon"), h = I("v-app-bar-title"), C = I("v-spacer"), T = I("v-chip"), D = I("v-list-item-title"), k = I("v-list-item"), A = I("v-list"), M = I("v-menu"), N = I("v-btn"), ee = I("v-app-bar"), te = I("v-main"), z = I("v-app");
			return j(), g(z, null, {
				default: B(() => [
					x(ee, {
						density: "comfortable",
						flat: "",
						border: "b",
						class: "app-bar"
					}, {
						default: B(() => [
							x(o, {
								title: u.value ? "收起左侧列表" : "展开左侧列表",
								onClick: r[0] ||= (e) => u.value = !u.value
							}, null, 8, ["title"]),
							x(h, null, {
								default: B(() => [y("span", it, L(e.title), 1)]),
								_: 1
							}),
							x(C),
							e.workspaces.length ? (j(), g(M, {
								key: 0,
								location: "bottom end"
							}, {
								activator: B(({ props: t }) => [x(T, w(t, {
									size: "small",
									variant: "tonal",
									class: "running",
									color: e.running ? "ready" : void 0,
									"prepend-icon": "mdi-play-circle-outline",
									title: e.running ? `所有工作区共 ${e.running} 个进程在跑` : "所有工作区都没有在跑的进程"
								}), {
									default: B(() => [b(L(e.running) + " 个在跑 ", 1)]),
									_: 1
								}, 16, ["color", "title"])]),
								default: B(() => [x(A, {
									density: "compact",
									class: "running-menu"
								}, {
									default: B(() => [(j(!0), v(p, null, P(s.value, (t) => (j(), g(k, {
										key: t.id,
										active: e.current && e.current.id === t.id,
										onClick: (e) => c(t.id)
									}, {
										append: B(() => [y("span", at, L(t.count) + " 个", 1)]),
										default: B(() => [x(D, { class: "run-name" }, {
											default: B(() => [b(L(t.name), 1)]),
											_: 2
										}, 1024)]),
										_: 2
									}, 1032, ["active", "onClick"]))), 128)), s.value.length ? _("", !0) : (j(), g(k, {
										key: 0,
										disabled: ""
									}, {
										default: B(() => [x(D, null, {
											default: B(() => [...r[3] ||= [b("没有在跑的进程", -1)]]),
											_: 1
										})]),
										_: 1
									}))]),
									_: 1
								})]),
								_: 1
							})) : _("", !0),
							F(n.$slots, "metrics", {}, void 0, !0),
							x(N, {
								icon: e.dark ? "mdi-weather-sunny" : "mdi-weather-night",
								title: "切换深浅色",
								variant: "text",
								onClick: e.toggleTheme
							}, null, 8, ["icon", "onClick"])
						]),
						_: 3
					}),
					x(t, {
						modelValue: e.snack.on,
						"onUpdate:modelValue": r[1] ||= (t) => e.snack.on = t,
						text: e.snack.text,
						color: e.snack.color
					}, null, 8, [
						"modelValue",
						"text",
						"color"
					]),
					x(te, { class: "fill-height" }, {
						default: B(() => [y("div", {
							ref_key: "shellRef",
							ref: l,
							class: "shell"
						}, [
							y("div", {
								class: "side-slot",
								style: O({ width: u.value ? `${R(d)}px` : "0px" })
							}, null, 4),
							y("div", {
								class: E(["side-layer", { folded: !u.value }]),
								style: O({ width: `${R(d)}px` })
							}, [y("aside", ot, [F(n.$slots, "sidebar", {}, void 0, !0)])], 6),
							ie(x(a, {
								axis: "x",
								active: R(f),
								onStart: R(m),
								onReset: R(S)
							}, null, 8, [
								"active",
								"onStart",
								"onReset"
							]), [[ne, u.value]]),
							y("main", st, [F(n.$slots, "default", { ws: e.current }, void 0, !0), e.current ? _("", !0) : (j(), g(i, w({ key: 0 }, e.empty, { onAction: r[2] ||= (e) => n.$emit("empty-action") }), null, 16))])
						], 512)]),
						_: 3
					})
				]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-67021267"]]), lt = "";
function ut(e, t) {
	let n = String(e.parent || "").trim();
	return n && t.has(n) ? n : lt;
}
function dt(e, t, n) {
	let r = new Map(t.map((e) => [e.id, e])), i = /* @__PURE__ */ new Set();
	for (let t of e) t && t.kind === "group" && t.id && i.add(t.id);
	let a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), c = [], l = /* @__PURE__ */ new Map(), u = (e, t) => {
		a.has(e) || a.set(e, []), a.get(e).push(t);
	};
	for (let t of e) if (t && t.id) {
		if (t.kind === "ws") {
			if (!r.has(t.id) || o.has(t.id)) continue;
			o.add(t.id), u(ut(t, i), t);
		} else if (t.kind === "group" && t.name) {
			if (s.has(t.id)) continue;
			s.add(t.id), c.push(t), l.set(t.id, t), u(ut(t, i), t);
		}
	}
	let d = (e) => {
		let t = e, n = /* @__PURE__ */ new Set();
		for (; t;) {
			if (n.has(t.id)) return !1;
			n.add(t.id);
			let e = ut(t, i);
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
	m(lt, 0);
	for (let e of c) p.has(e.id) || d(e) || (p.add(e.id), f.push({
		key: `group:${e.id}`,
		kind: "group",
		id: e.id,
		depth: 0,
		parent: lt,
		name: e.name,
		group: e
	}), n.has(e.id) || m(e.id, 1));
	for (let e of t) o.has(e.id) || f.push({
		key: `ws:${e.id}`,
		kind: "ws",
		id: e.id,
		depth: 0,
		parent: lt,
		ws: e
	});
	return f;
}
function ft(e) {
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
	a(lt, 0);
	for (let e of t.values()) for (let t of e) i.has(t.id) || (i.add(t.id), r.push({
		id: t.id,
		name: t.name,
		depth: 0
	}));
	return r;
}
function pt(e, t, n) {
	let r = String(n || ""), i = /* @__PURE__ */ new Set();
	for (; r && !i.has(r);) {
		if (r === t) return !0;
		i.add(r);
		let n = e.find((e) => e && e.kind === "group" && e.id === r);
		r = n ? String(n.parent || "") : "";
	}
	return !1;
}
function mt(e, t, n) {
	let r = new Set(t);
	return r.size ? e.map((e) => e.kind === "ws" && r.has(e.id) ? {
		...e,
		parent: n
	} : e) : e;
}
function ht(e, t) {
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
var gt = { class: "head" }, _t = { class: "head-title" }, vt = {
	key: 0,
	class: "none"
}, yt = { class: "gtext" }, bt = { class: "nm" }, xt = ["onClick"], St = { class: "tip" }, Ct = { class: "tip" }, wt = { class: "tip" }, Tt = /*#__PURE__*/ e({
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
		}, a = h(() => ({
			...i,
			...r.texts
		})), o = t, s = r.storageKey ? ce(r.storageKey, [], { writeDefaults: !1 }) : N([]), c = h(() => new Set(Array.isArray(s.value) ? s.value : [])), l = N(null), u = N(null), d = h(() => r.groups.filter((e) => e && e.kind === "group").length), f = h(() => dt(r.groups, r.workspaces, c.value)), m = h(() => ft(r.groups));
		function S() {
			return ht(r.groups, r.workspaces);
		}
		function C(e, t) {
			return pt(r.groups, e, t);
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
		function D() {
			return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
		}
		function ee(e) {
			s.value = [...e];
		}
		function te(e) {
			if (e.kind !== "group") {
				o("select", e.id);
				return;
			}
			let t = new Set(c.value);
			t.has(e.id) ? t.delete(e.id) : t.add(e.id), ee(t);
		}
		function ne(e) {
			if (!c.value.has(e)) return;
			let t = new Set(c.value);
			t.delete(e), ee(t);
		}
		function re(e) {
			let t = l.value, n = u.value, r = (t) => !!n && n.mode === t && n.kind === e.kind && n.id === e.id;
			return {
				"drag-src": !!t && t.kind === e.kind && t.id === e.id,
				"drop-before": r("before"),
				"drop-after": r("after"),
				"drop-into": r("into")
			};
		}
		function ie(e, t) {
			l.value = {
				kind: t.kind,
				id: t.id
			}, u.value = null, e.dataTransfer && (e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("text/plain", t.id));
		}
		function oe(e, t) {
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
		function se() {
			let e = l.value, t = u.value;
			if (!e || !t) return H();
			let n = S(), r = n.findIndex((t) => t.kind === e.kind && t.id === e.id);
			if (r < 0) return H();
			let i = n.splice(r, 1)[0];
			if (t.mode === "into") i.parent = t.id, n.push(i), ne(t.id);
			else {
				let e = n.findIndex((e) => e.kind === t.kind && e.id === t.id);
				e < 0 ? (i.parent = "", n.push(i)) : (i.parent = n[e].parent || "", n.splice(t.mode === "before" ? e : e + 1, 0, i));
			}
			w(n), H();
		}
		function H() {
			l.value = null, u.value = null;
		}
		let U = N(!1), W = N(""), G = N(!1), le = N(0), K = N(null), q = M({
			open: !1,
			x: 0,
			y: 0,
			mode: "blank",
			target: null
		}), J = N(!1), Y = N(null), ue = N(""), X = N(!1), de = N(!1), Z = N(null), fe = N(""), pe = N(!1), Q = N(null);
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
			Z.value = { id: e.id }, fe.value = e.name || "", de.value = !0, $();
		}
		function ye() {
			let e = (fe.value || "").trim().slice(0, 80);
			e && Z.value && (w(S().map((t) => t.kind === "group" && t.id === Z.value.id ? {
				...t,
				name: e
			} : t)), de.value = !1);
		}
		function be() {
			let e = S(), t = {
				kind: "group",
				id: D(),
				name: "新分组",
				parent: ""
			};
			e.push(t), w(e), $(), ve(t);
		}
		function xe() {
			let e = q.target;
			if (!e) return;
			let t = S(), n = {
				kind: "group",
				id: D(),
				name: "新分组",
				parent: e.id
			};
			t.push(n), w(t), ne(e.id), $(), ve(n);
		}
		function Se() {
			let e = q.target;
			if (!e) return;
			let t = S(), n = {
				kind: "group",
				id: D(),
				name: "新分组",
				parent: ""
			};
			t.push(n), T(t, "ws", e.id, n.id), w(t), $(), ve(n);
		}
		function Ce(e) {
			if (!q.target) return;
			let t = S();
			T(t, "ws", q.target.id, e), w(t), e && ne(e), $();
		}
		function Te() {
			Q.value = q.target, pe.value = !0, $();
		}
		function Ee() {
			let e = Q.value ? Q.value.id : "";
			if (e) {
				let t = S(), n = t.findIndex((t) => t.kind === "group" && t.id === e);
				if (n >= 0) {
					let r = t[n].parent || "";
					t.splice(n, 1);
					for (let n of t) (n.parent || "") === e && (n.parent = r);
					w(t);
				}
			}
			pe.value = !1;
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
			let n = t === "rel" && e.rel || e.root, r = await we(n);
			o("notice", {
				text: r ? `${a.value.copied}${n}` : a.value.copyFailed,
				color: r ? "primary" : "error"
			}), $();
		}
		A(() => {
			document.addEventListener("click", $), document.addEventListener("contextmenu", $), window.addEventListener("resize", $), window.addEventListener("blur", $);
		}), k(() => {
			document.removeEventListener("click", $), document.removeEventListener("contextmenu", $), window.removeEventListener("resize", $), window.removeEventListener("blur", $);
		});
		function Ae(e) {
			let t = String(e || "").split("/").filter(Boolean);
			return t.length ? t[t.length - 1] : e;
		}
		let je = N(""), Me = new Set(r.workspaces.map((e) => e.id));
		function Ne(e) {
			q.open = !1, Pe(), je.value = e ? e.id : "";
		}
		z(() => r.workspaces.map((e) => e.id).join(","), () => {
			let e = r.workspaces.filter((e) => !Me.has(e.id)).map((e) => e.id);
			if (Me = new Set(r.workspaces.map((e) => e.id)), !je.value || !e.length) return;
			let t = je.value;
			je.value = "", o("groups-change", mt(ht(r.groups, r.workspaces), e, t));
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
			let i = I("v-btn"), o = I("v-icon"), s = I("v-list-item-title"), l = I("v-list-item-subtitle"), u = I("v-list-item"), h = I("v-list"), S = I("v-text-field"), C = I("v-spacer");
			return j(), v("div", {
				class: "list",
				onContextmenu: V(_e, ["prevent", "stop"])
			}, [
				y("div", gt, [y("span", _t, L(a.value.headTitle), 1), x(i, {
					size: "small",
					variant: "text",
					color: "primary",
					"prepend-icon": "mdi-plus",
					loading: e.busy,
					onClick: Pe
				}, {
					default: B(() => [b(L(a.value.add), 1)]),
					_: 1
				}, 8, ["loading"])]),
				!e.workspaces.length && !d.value ? (j(), v("div", vt, L(a.value.empty), 1)) : _("", !0),
				x(h, {
					density: "compact",
					nav: "",
					class: "items",
					onDrop: V(se, ["prevent"])
				}, {
					default: B(() => [(j(!0), v(p, null, P(f.value, (n) => (j(), g(u, {
						key: n.key,
						active: n.kind === "ws" && n.id === e.current,
						"active-color": "primary",
						draggable: "true",
						style: O({ paddingLeft: `${12 + n.depth * 18}px` }),
						class: E(re(n)),
						onClick: (e) => te(n),
						onContextmenu: V((e) => ge(e, n), ["prevent", "stop"]),
						onDragstart: (e) => ie(e, n),
						onDragover: V((e) => oe(e, n), ["prevent"]),
						onDragend: H
					}, {
						append: B(() => [n.kind === "ws" ? (j(), g(i, {
							key: 0,
							icon: !0,
							size: "x-small",
							variant: "text",
							title: a.value.forgetTitle,
							class: "forget",
							onClick: V((e) => Ie(n.ws), ["stop"])
						}, {
							default: B(() => [x(o, { size: "18" }, {
								default: B(() => [...r[24] ||= [b("mdi-close", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["title", "onClick"])) : _("", !0)]),
						default: B(() => [(j(!0), v(p, null, P(n.depth, (e) => (j(), v("span", {
							key: e,
							class: "guide",
							style: O({ left: `${20 + (e - 1) * 18}px` })
						}, null, 4))), 128)), n.kind === "group" ? (j(), g(s, {
							key: 0,
							class: "gname"
						}, {
							default: B(() => [
								x(o, { size: "16" }, {
									default: B(() => [b(L(c.value.has(n.id) ? "mdi-chevron-right" : "mdi-chevron-down"), 1)]),
									_: 2
								}, 1024),
								x(o, { size: "16" }, {
									default: B(() => [...r[23] ||= [b("mdi-folder-outline", -1)]]),
									_: 1
								}),
								y("span", yt, L(n.name), 1)
							]),
							_: 2
						}, 1024)) : (j(), v(p, { key: 1 }, [x(s, {
							class: "name",
							title: n.ws.alias ? n.ws.root : ""
						}, {
							default: B(() => [y("span", bt, L(n.ws.alias || Ae(n.ws.root)), 1), F(t.$slots, "title-extra", { ws: n.ws }, void 0, !0)]),
							_: 2
						}, 1032, ["title"]), x(l, {
							class: "path",
							title: n.ws.url || n.ws.root
						}, {
							default: B(() => [b(L(n.ws.url || n.ws.root), 1)]),
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
				q.open ? (j(), v("div", {
					key: 1,
					class: "ctxmenu",
					style: O({
						left: q.x + "px",
						top: q.y + "px"
					}),
					onClick: r[7] ||= V(() => {}, ["stop"]),
					onContextmenu: r[8] ||= V(() => {}, ["prevent", "stop"])
				}, [q.mode === "ws" ? (j(), v(p, { key: 0 }, [
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[0] ||= (e) => De(q.target)
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[25] ||= [b("mdi-rename-box", -1)]]),
						_: 1
					}), b(L(a.value.menuAlias), 1)]),
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[1] ||= (e) => ke(q.target, "rel")
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[26] ||= [b("mdi-content-copy", -1)]]),
						_: 1
					}), b(L(a.value.copyRel), 1)]),
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[2] ||= (e) => ke(q.target, "abs")
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[27] ||= [b("mdi-content-copy", -1)]]),
						_: 1
					}), b(L(a.value.copyAbs), 1)]),
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[3] ||= (e) => q.mode = "pick"
					}, [
						x(o, { size: "16" }, {
							default: B(() => [...r[28] ||= [b("mdi-folder-move-outline", -1)]]),
							_: 1
						}),
						r[29] ||= b("移到分组 ", -1),
						r[30] ||= y("span", { class: "more" }, "›", -1)
					])
				], 64)) : q.mode === "pick" ? (j(), v(p, { key: 1 }, [
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[4] ||= (e) => Ce("")
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[31] ||= [b("mdi-format-list-bulleted", -1)]]),
						_: 1
					}), r[32] ||= b("移出分组 ", -1)]),
					(j(!0), v(p, null, P(m.value, (e) => (j(), v("button", {
						key: e.id,
						type: "button",
						class: "ctxitem",
						style: O({ paddingLeft: `${10 + e.depth * 18}px` }),
						onClick: (t) => Ce(e.id)
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[33] ||= [b("mdi-folder-outline", -1)]]),
						_: 1
					}), b(L(e.name), 1)], 12, xt))), 128)),
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: Se
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[34] ||= [b("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), r[35] ||= b("新建分组并移入 ", -1)])
				], 64)) : q.mode === "group" ? (j(), v(p, { key: 2 }, [
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[5] ||= (e) => Ne(q.target)
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[36] ||= [b("mdi-plus", -1)]]),
						_: 1
					}), b(L(a.value.menuAddInGroup), 1)]),
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: xe
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[37] ||= [b("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), r[38] ||= b("新建子分组 ", -1)]),
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[6] ||= (e) => ve(q.target)
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[39] ||= [b("mdi-rename-box", -1)]]),
						_: 1
					}), r[40] ||= b("重命名 ", -1)]),
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: Te
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[41] ||= [b("mdi-trash-can-outline", -1)]]),
						_: 1
					}), r[42] ||= b("删除分组 ", -1)])
				], 64)) : (j(), v("button", {
					key: 3,
					type: "button",
					class: "ctxitem",
					onClick: be
				}, [x(o, { size: "16" }, {
					default: B(() => [...r[43] ||= [b("mdi-folder-plus-outline", -1)]]),
					_: 1
				}), r[44] ||= b("新建分组 ", -1)]))], 36)) : _("", !0),
				x(n, {
					modelValue: J.value,
					"onUpdate:modelValue": r[11] ||= (e) => J.value = e,
					"initial-width": 460,
					"initial-height": 320,
					"min-width": 360,
					"min-height": 240
				}, {
					title: B(() => [b(L(a.value.aliasTitle), 1)]),
					actions: B(() => [
						x(C),
						x(i, {
							variant: "text",
							onClick: r[10] ||= (e) => J.value = !1
						}, {
							default: B(() => [...r[45] ||= [b("取消", -1)]]),
							_: 1
						}),
						x(i, {
							color: "primary",
							variant: "flat",
							loading: X.value,
							onClick: Oe
						}, {
							default: B(() => [...r[46] ||= [b(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"])
					]),
					default: B(() => [
						y("p", St, L(Y.value ? Y.value.root : ""), 1),
						x(S, {
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
						y("p", Ct, L(a.value.aliasHint), 1)
					]),
					_: 1
				}, 8, ["modelValue"]),
				x(n, {
					modelValue: de.value,
					"onUpdate:modelValue": r[14] ||= (e) => de.value = e,
					"initial-width": 440,
					"initial-height": 260,
					"min-width": 340,
					"min-height": 200
				}, {
					title: B(() => [...r[47] ||= [b("分组名称", -1)]]),
					actions: B(() => [
						x(C),
						x(i, {
							variant: "text",
							onClick: r[13] ||= (e) => de.value = !1
						}, {
							default: B(() => [...r[48] ||= [b("取消", -1)]]),
							_: 1
						}),
						x(i, {
							color: "primary",
							variant: "flat",
							disabled: !fe.value.trim(),
							onClick: ye
						}, {
							default: B(() => [...r[49] ||= [b(" 保存 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					]),
					default: B(() => [x(S, {
						modelValue: fe.value,
						"onUpdate:modelValue": r[12] ||= (e) => fe.value = e,
						label: "名称",
						density: "compact",
						variant: "outlined",
						maxlength: "80",
						autofocus: "",
						onKeyup: ae(ye, ["enter"])
					}, null, 8, ["modelValue"])]),
					_: 1
				}, 8, ["modelValue"]),
				x(n, {
					modelValue: pe.value,
					"onUpdate:modelValue": r[16] ||= (e) => pe.value = e,
					"initial-width": 440,
					"initial-height": 240,
					"min-width": 340,
					"min-height": 200
				}, {
					title: B(() => [...r[50] ||= [b("删除分组", -1)]]),
					actions: B(() => [
						x(C),
						x(i, {
							variant: "text",
							onClick: r[15] ||= (e) => pe.value = !1
						}, {
							default: B(() => [...r[51] ||= [b("取消", -1)]]),
							_: 1
						}),
						x(i, {
							color: "error",
							variant: "flat",
							onClick: Ee
						}, {
							default: B(() => [...r[52] ||= [b("删除", -1)]]),
							_: 1
						})
					]),
					default: B(() => [b(" " + L(Q.value ? Q.value.name : "") + " ", 1), r[53] ||= y("p", { class: "tip" }, "里面的子分组与工作区移到上一级，工作区本身不动。", -1)]),
					_: 1
				}, 8, ["modelValue"]),
				x(n, {
					modelValue: U.value,
					"onUpdate:modelValue": r[20] ||= (e) => U.value = e,
					"initial-width": 620,
					"initial-height": 460,
					"min-width": 420,
					"min-height": 300
				}, {
					title: B(() => [b(L(a.value.addTitle), 1)]),
					actions: B(() => [
						x(C),
						x(i, {
							variant: "text",
							onClick: r[19] ||= (e) => U.value = !1
						}, {
							default: B(() => [...r[54] ||= [b("取消", -1)]]),
							_: 1
						}),
						x(i, {
							color: "primary",
							variant: "flat",
							disabled: !W.value.trim() || !G.value,
							onClick: Fe
						}, {
							default: B(() => [b(L(a.value.addConfirm), 1)]),
							_: 1
						}, 8, ["disabled"])
					]),
					default: B(() => [(j(), g(R(me), {
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
				x(n, {
					modelValue: K.value,
					"onUpdate:modelValue": r[22] ||= (e) => K.value = e,
					"initial-width": 440,
					"initial-height": 260,
					"min-width": 340,
					"min-height": 200
				}, {
					title: B(() => [b(L(a.value.removeTitle), 1)]),
					actions: B(() => [
						x(C),
						x(i, {
							variant: "text",
							onClick: r[21] ||= (e) => K.value = null
						}, {
							default: B(() => [...r[55] ||= [b("取消", -1)]]),
							_: 1
						}),
						x(i, {
							color: "error",
							variant: "flat",
							onClick: Le
						}, {
							default: B(() => [b(L(a.value.removeConfirm), 1)]),
							_: 1
						})
					]),
					default: B(() => [b(" " + L(K.value ? K.value.root : "") + " ", 1), y("p", wt, L(a.value.removeText), 1)]),
					_: 1
				}, 8, ["modelValue"])
			], 32);
		};
	}
}, [["__scopeId", "data-v-593e1b9a"]]);
// src/composables/services/useWorkspaceState.js
function Et({ api: e, storageKey: t, extraState: n = {}, loadExtra: i = null, addedNotice: a = "已添加" }) {
	let o = M({
		workspaces: [],
		groups: [],
		...n
	}), s = ce(t, "", { writeDefaults: !1 }), c = N(!1), l = N(null), { snack: u, toast: d } = r(), f = null, p = 0, m = h(() => o.workspaces.find((e) => e.id === s.value) || null), g = h(() => o.workspaces.reduce((e, t) => e + nt(t), 0));
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
		running: g,
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
var Dt = {
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
		let t = e, { dark: n, toggle: r } = l({ rememberTheme: t.rememberTheme }), { state: i, current: a, currentId: o, adding: s, snack: u, toast: d, metrics: f, running: p, select: m, setGroups: h, refresh: v, act: y, start: b, addWorkspace: S, removeWorkspace: C, rescan: w, startService: T, stopService: E, saveService: D } = Et({
			api: t.api,
			storageKey: t.storageKey,
			extraState: t.extraState,
			addedNotice: t.addedNotice,
			loadExtra: t.loadExtra
		});
		return A(b), (t, l) => (j(), g(ct, {
			title: e.title,
			workspaces: R(i).workspaces,
			current: R(a),
			running: R(p),
			dark: R(n),
			snack: R(u),
			empty: e.empty,
			"toggle-theme": R(r),
			onEmptyAction: l[1] ||= (e) => R(S)(),
			onSelectWorkspace: R(m)
		}, {
			sidebar: B(() => [x(Tt, {
				workspaces: R(i).workspaces,
				groups: R(i).groups,
				current: R(o),
				busy: R(s),
				dirs: e.api.dirs,
				"save-alias": e.api.setAlias,
				texts: e.listTexts,
				"storage-key": e.collapsedKey,
				onSelect: R(m),
				onAdd: R(S),
				onRemove: R(C),
				onChanged: R(v),
				onGroupsChange: R(h),
				onNotice: l[0] ||= (e) => R(d)(e.text, e.color)
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
			metrics: B(() => [x(R(c), {
				dark: R(n),
				metrics: R(f)
			}, null, 8, ["dark", "metrics"])]),
			default: B(({ ws: e }) => [e ? F(t.$slots, "panel", {
				ws: e,
				state: R(i),
				dark: R(n),
				toast: R(d),
				act: R(y),
				startService: R(T),
				stopService: R(E),
				saveService: R(D),
				rescan: R(w),
				removeWorkspace: R(C),
				refresh: R(v)
			}, void 0, void 0, 0) : _("", !0)]),
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
}, Ot = { style: { width: "42%" } }, kt = { class: "svc-name" }, At = ["title"], jt = ["title"], Mt = { class: "status-line" }, Nt = {
	key: 0,
	class: "meta"
}, Pt = {
	key: 1,
	class: "meta"
}, Ft = ["title"], It = {
	key: 1,
	class: "meta"
}, Lt = {
	key: 2,
	class: "meta"
}, Rt = { class: "ops" }, zt = /*#__PURE__*/ e({
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
			let r = I("v-chip"), i = I("v-btn"), a = I("v-icon"), o = I("v-table");
			return j(), g(o, {
				density: "compact",
				class: "table"
			}, {
				default: B(() => [y("thead", null, [y("tr", null, [
					y("th", Ot, L(e.nameTitle), 1),
					n[0] ||= y("th", null, "参数", -1),
					n[1] ||= y("th", { style: { width: "200px" } }, "状态", -1),
					n[2] ||= y("th", { style: { width: "230px" } }, null, -1)
				])]), y("tbody", null, [(j(!0), v(p, null, P(e.rows, (o) => (j(), v("tr", { key: o.key }, [
					y("td", null, [y("div", kt, [y("span", null, L(o.title), 1), o.typeText ? (j(), g(r, {
						key: 0,
						size: "x-small",
						variant: "tonal",
						class: "type-chip"
					}, {
						default: B(() => [b(L(o.typeText), 1)]),
						_: 2
					}, 1024)) : _("", !0)]), e.showPath && o.path ? (j(), v("div", {
						key: 0,
						class: "svc-path",
						title: o.path
					}, L(o.path), 9, At)) : _("", !0)]),
					y("td", null, [y("div", {
						class: "cmd",
						title: o.cmd
					}, L(o.cmd), 9, jt)]),
					y("td", null, [y("div", Mt, [o.live ? (j(), v(p, { key: 0 }, [x(r, {
						size: "small",
						class: "status-chip",
						color: o.color,
						variant: "tonal",
						"prepend-icon": o.icon
					}, {
						default: B(() => [b(L(o.statusText), 1)]),
						_: 2
					}, 1032, ["color", "prepend-icon"]), o.port ? (j(), v("span", Nt, "端口 " + L(o.port), 1)) : o.started ? (j(), v("span", Pt, L(o.ago), 1)) : _("", !0)], 64)) : o.run ? (j(), v(p, { key: 1 }, [x(r, {
						size: "small",
						class: "status-chip",
						color: o.color,
						variant: "tonal",
						"prepend-icon": o.icon,
						onClick: (e) => t.$emit("log", o)
					}, {
						default: B(() => [b(L(o.statusText), 1)]),
						_: 2
					}, 1032, [
						"color",
						"prepend-icon",
						"onClick"
					]), o.err ? (j(), v("span", {
						key: 0,
						class: "meta err",
						title: o.err
					}, L(o.err), 9, Ft)) : o.started ? (j(), v("span", It, L(o.ago), 1)) : _("", !0)], 64)) : (j(), v("span", Lt, "—"))])]),
					y("td", Rt, [o.live ? (j(), v(p, { key: 0 }, [x(i, {
						size: "small",
						variant: "text",
						"prepend-icon": "mdi-text-box-outline",
						onClick: (e) => t.$emit("log", o)
					}, {
						default: B(() => [...n[3] ||= [b(" 日志 ", -1)]]),
						_: 1
					}, 8, ["onClick"]), x(i, {
						size: "small",
						color: "error",
						variant: "tonal",
						loading: o.stopping,
						onClick: (e) => t.$emit("stop", o)
					}, {
						default: B(() => [...n[4] ||= [b(" 停止 ", -1)]]),
						_: 1
					}, 8, ["loading", "onClick"])], 64)) : (j(), v(p, { key: 1 }, [
						x(i, {
							size: "small",
							color: "primary",
							variant: "flat",
							disabled: o.blocked,
							loading: o.starting,
							onClick: (e) => t.$emit("start", o)
						}, {
							default: B(() => [b(L(o.action), 1)]),
							_: 2
						}, 1032, [
							"disabled",
							"loading",
							"onClick"
						]),
						x(i, {
							size: "small",
							variant: "text",
							icon: !0,
							title: "参数",
							onClick: (e) => t.$emit("settings", o)
						}, {
							default: B(() => [x(a, { size: "20" }, {
								default: B(() => [...n[5] ||= [b("mdi-tune", -1)]]),
								_: 1
							})]),
							_: 1
						}, 8, ["onClick"]),
						o.run ? (j(), g(i, {
							key: 0,
							size: "small",
							variant: "text",
							"prepend-icon": "mdi-text-box-outline",
							onClick: (e) => t.$emit("log", o)
						}, {
							default: B(() => [...n[6] ||= [b(" 日志 ", -1)]]),
							_: 1
						}, 8, ["onClick"])) : _("", !0)
					], 64)), F(t.$slots, "row-extra", { row: o }, void 0, !0)])
				]))), 128))])]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-8df04734"]]), Bt = { class: "log-head" }, Vt = { class: "log-box" }, Ht = {
	key: 1,
	class: "log-empty"
}, Ut = /*#__PURE__*/ e({
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
			let r = I("v-spacer"), i = I("v-btn");
			return j(), v(p, null, [y("div", Bt, [
				n[2] ||= y("span", { class: "label" }, "日志", -1),
				x(r),
				e.more ? (j(), g(i, {
					key: 0,
					size: "small",
					variant: "text",
					"prepend-icon": "mdi-history",
					onClick: n[0] ||= (e) => t.$emit("load-more")
				}, {
					default: B(() => [...n[1] ||= [b(" 更早 ", -1)]]),
					_: 1
				})) : _("", !0)
			]), y("div", Vt, [e.text ? (j(), g(H, {
				key: 0,
				text: e.text,
				dark: e.dark,
				colorize: e.colorize
			}, null, 8, [
				"text",
				"dark",
				"colorize"
			])) : (j(), v("p", Ht, L(e.emptyText), 1))])], 64);
		};
	}
}, [["__scopeId", "data-v-d45becae"]]);
// src/utils/services/toolApi.js
function Wt(e, t = {}) {
	let { call: n } = u({ prefix: e });
	return {
		call: n,
		api: {
			state: () => n("GET", "/state"),
			stateStreamUrl: () => `${e}/state/stream`,
			log: (e, t = 0) => n("GET", `/log?run=${d(e)}&page=${t}`),
			logStreamUrl: (t) => `${e}/log/stream?run=${d(t)}`,
			dirs: (e = "") => n("GET", `/dirs${e ? `?path=${d(e)}` : ""}`),
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
// src/composables/services/useStoredChoice.js
function Gt(e, t, n) {
	let r = ce(e, n, { writeDefaults: !1 });
	return h({
		get: () => t.includes(r.value) ? r.value : n,
		set: (e) => {
			r.value = e;
		}
	});
}
// src/composables/commons/useFileTree.js
function Kt(e, t = () => ({})) {
	let n = M({});
	function r() {
		let t = typeof e == "function" ? e() : R(e);
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
	let s = h(() => o(i(r()), 0));
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
function qt({ api: e, ws: t, statusText: n = {} }) {
	let r = N(""), i = N(!1), a = N(0), o = N(""), s = N(""), c = N(""), l = null;
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
	return z(t, (e) => {
		if (!c.value || !e) return;
		let t = (e.services || []).find((e) => e.id === c.value);
		t && t.run && (o.value = n[t.run.status] || t.run.status);
	}), k(u), {
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
export { J as DirectoryNode, me as DirectoryPicker, Qe as FileEditor, je as FileTree, tt as LIVE_STATUSES, H as LogView, Ut as RunLogPanel, zt as ServiceTable, Dt as ToolApp, Tt as WorkspaceList, ct as WorkspaceShell, we as copyText, Wt as createToolApi, _e as fileIcon, nt as runningCount, f as symbolAt, Kt as useFileTree, qt as useRunLog, et as useSplitPane, Gt as useStoredChoice, Et as useWorkspaceState };
