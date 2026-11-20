import { t as e } from "./_plugin-vue_export-helper.js";
import { n as t, r as n, t as r } from "./useToast.js";
import { n as i, t as a } from "./SplitHandle.js";
import { languageOf as o } from "./highlight.js";
import { baseName as s } from "./format.js";
import { t as c } from "./Metrics2.js";
import { useThemeToggle as l } from "./theme.js";
import { createJsonClient as u, encodeParam as d } from "./http.js";
import { symbolAt as f } from "./text.js";
import { Fragment as p, Teleport as m, computed as h, createBlock as g, createCommentVNode as _, createElementBlock as v, createElementVNode as y, createTextVNode as b, createVNode as x, guardReactiveProps as S, mergeProps as C, nextTick as w, normalizeClass as T, normalizeProps as E, normalizeStyle as D, onBeforeUnmount as O, onMounted as k, openBlock as A, reactive as j, ref as M, renderList as N, renderSlot as P, resolveComponent as F, resolveDynamicComponent as I, shallowRef as ee, toDisplayString as L, unref as R, vShow as te, watch as z, watchEffect as ne, withCtx as B, withDirectives as re, withKeys as ie, withModifiers as V } from "vue";
import { Terminal as ae } from "@xterm/xterm";
import { FitAddon as oe } from "@xterm/addon-fit";
import { useLocalStorage as se } from "@vueuse/core";
var ce = /*#__PURE__*/ e({
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
		}, r = M(null), i = null, a = null, o = null, s = "";
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
		return k(() => {
			i = new ae({
				convertEol: !0,
				disableStdin: !0,
				cursorBlink: !1,
				scrollback: 5e3,
				fontFamily: "'JetBrains Mono', Roboto, 'Noto Sans SC', 'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
				fontSize: 12,
				lineHeight: 1.3,
				theme: c(t.dark)
			}), a = new oe(), i.loadAddon(a), i.open(r.value), requestAnimationFrame(() => i && a.fit()), document.fonts && document.fonts.load("12px 'JetBrains Mono'").then(() => i && a.fit()).catch(() => {}), o = new ResizeObserver(() => {
				i && a.fit();
			}), o.observe(r.value), i.attachCustomKeyEventHandler(f), d(t.text || "");
		}), z(() => t.text, (e) => d(e || "")), z(() => t.dark, (e) => {
			i && (i.options.theme = c(e));
		}), O(() => {
			o && o.disconnect(), i && i.dispose(), o = null, i = null;
		}), (t, n) => (A(), v("div", {
			ref_key: "host",
			ref: r,
			class: T(["term", { deeper: e.dark }]),
			style: D(e.height ? {
				height: e.height,
				flex: "0 0 auto"
			} : null)
		}, null, 6));
	}
}, [["__scopeId", "data-v-619b1e01"]]), H = { class: "node" }, U = ["title"], W = {
	key: 0,
	class: "kids"
}, G = {
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
		let n = e, r = t, i = M(!1), a = M(!1), o = M(""), s = M(null);
		z(() => n.selected === n.node.path, (e) => {
			e && w(() => s.value && s.value.scrollIntoView({ block: "nearest" }));
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
			let r = F("v-icon"), u = F("v-btn"), d = F("DirectoryNode", !0);
			return A(), v("div", H, [y("div", {
				ref_key: "rowEl",
				ref: s,
				class: T(["row", { selected: e.node.path === e.selected }]),
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
				}, L(e.node.name), 9, U)
			], 2), i.value ? (A(), v("div", W, [a.value ? (A(), v("p", G, "正在读取…")) : o.value ? (A(), v("p", K, L(o.value), 1)) : e.node.children ? (A(), v(p, { key: 2 }, [(A(!0), v(p, null, N(e.node.children, (r) => (A(), g(d, {
				key: r.path,
				node: r,
				selected: e.selected,
				loader: e.loader,
				onPick: n[0] ||= (e) => t.$emit("pick", e)
			}, null, 8, [
				"node",
				"selected",
				"loader"
			]))), 128)), e.node.children.length ? _("", !0) : (A(), v("p", q, "没有子目录"))], 64)) : _("", !0)])) : _("", !0)]);
		};
	}
}, [["__scopeId", "data-v-9e855642"]]), Y = { class: "picker" }, le = {
	key: 0,
	class: "tip"
}, X = { class: "tree" }, ue = { class: "root" }, Z = ["title"], de = {
	key: 0,
	class: "hint bad"
}, fe = {
	key: 0,
	class: "hint"
}, pe = /*#__PURE__*/ e({
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
		let n = e, r = t, i = M(""), a = M(null), o = M(!0), s = M(""), c = h({
			get: () => n.modelValue,
			set: (e) => r("update:modelValue", e)
		}), l = h(() => {
			let e = String(n.modelValue || "").trim();
			return e === "~" ? e = i.value : e.startsWith("~/") && (e = i.value + e.slice(1)), e.replace(/\/+$/, "");
		}), u = h(() => !i.value || !l.value ? !1 : n.validate ? !!n.validate(l.value, i.value) : l.value === i.value || l.value.startsWith(i.value + "/"));
		ne(() => r("update:valid", u.value));
		function d(e) {
			c.value = e.path;
		}
		return k(async () => {
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
			let r = F("v-text-field"), f = F("v-icon"), m = F("v-progress-circular");
			return A(), v("div", Y, [
				e.tip ? (A(), v("p", le, L(e.tip), 1)) : _("", !0),
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
				y("div", X, [y("div", ue, [
					x(f, { size: "18" }, {
						default: B(() => [...n[1] ||= [b("mdi-home-outline", -1)]]),
						_: 1
					}),
					y("span", {
						class: "root-label",
						title: i.value || "~"
					}, "~", 8, Z),
					o.value ? (A(), g(m, {
						key: 0,
						size: "12",
						width: "2",
						indeterminate: ""
					})) : _("", !0)
				]), s.value ? (A(), v("p", de, L(s.value), 1)) : a.value ? (A(), v(p, { key: 1 }, [(A(!0), v(p, null, N(a.value, (t) => (A(), g(J, {
					key: t.path,
					node: t,
					selected: l.value,
					loader: e.loader,
					onPick: d
				}, null, 8, [
					"node",
					"selected",
					"loader"
				]))), 128)), a.value.length ? _("", !0) : (A(), v("p", fe, "家目录下没有子目录"))], 64)) : _("", !0)])
			]);
		};
	}
}, [["__scopeId", "data-v-a4b93ef9"]]), Q = {
	icon: "mdi-file-outline",
	color: ""
}, me = {
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
}, he = {
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
function ge(e) {
	let t = String(e || "").split("/").pop().toLowerCase(), n = me[t];
	if (n) return n;
	let r = t.lastIndexOf(".");
	return r < 0 ? Q : he[t.slice(r + 1)] || Q;
}
// src/components/commons/FileTree/FileTreeNode.vue
var _e = { class: "branch" }, $ = ["data-path", "data-type"], ve = {
	key: 1,
	class: "arrow-space"
}, ye = ["title"], be = {
	key: 0,
	class: "hint bad"
}, xe = {
	key: 0,
	class: "hint"
}, Se = /*#__PURE__*/ e({
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
		}, s = h(() => n.keyOf(n.node)), c = h(() => n.dirOf(n.node)), l = h(() => n.expanded[s.value] === !0), u = h(() => n.cache[s.value] || o), d = h(() => c.value ? null : ge(n.nameOf(n.node))), f = h(() => c.value ? l.value ? "mdi-folder-open-outline" : "mdi-folder-outline" : d.value.icon), m = h(() => c.value ? null : d.value.color ? { color: d.value.color } : null);
		function S() {
			n.pickOnRowClick && (c.value ? r("toggle", s.value) : r("pick", n.node));
		}
		function w(e) {
			r("context", {
				node: n.node,
				event: e
			});
		}
		return (t, n) => {
			let i = F("v-icon"), o = F("v-btn"), d = F("v-progress-circular"), h = F("FileTreeNode", !0);
			return A(), v("div", _e, [y("div", {
				class: T(["row", [e.rowClass ? e.rowClass(e.node) : null, { clickable: e.pickOnRowClick }]]),
				"data-path": s.value,
				"data-type": e.node.type,
				style: D({ paddingLeft: 4 + e.depth * 18 + "px" }),
				onClick: S,
				onContextmenu: V(w, ["prevent", "stop"])
			}, [
				c.value ? (A(), g(o, {
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
				}, 8, ["title"])) : (A(), v("span", ve)),
				c.value && l.value && u.value.loading ? (A(), g(d, {
					key: 2,
					indeterminate: "",
					size: 14,
					width: 2,
					class: "spin"
				})) : (A(), g(i, {
					key: 3,
					size: "16",
					class: T(c.value ? "folder" : "file"),
					style: D(m.value)
				}, {
					default: B(() => [b(L(f.value), 1)]),
					_: 1
				}, 8, ["class", "style"])),
				P(t.$slots, "row-before-label", {
					node: e.node,
					open: l.value,
					state: u.value
				}, void 0, !0),
				y("span", {
					class: T(["label", e.labelClass]),
					title: s.value
				}, L(e.nameOf(e.node)), 11, ye),
				P(t.$slots, "row-after-label", {
					node: e.node,
					open: l.value,
					state: u.value
				}, void 0, !0)
			], 46, $), c.value && l.value ? (A(), v(p, { key: 0 }, [u.value.error ? (A(), v("p", be, L(u.value.error), 1)) : (A(), v(p, { key: 1 }, [(A(!0), v(p, null, N(u.value.entries, (i) => (A(), g(h, {
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
				"row-before-label": B((e) => [P(t.$slots, "row-before-label", C({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": B((e) => [P(t.$slots, "row-after-label", C({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), u.value.truncated ? (A(), v("p", xe, L(a.value.truncated), 1)) : _("", !0)], 64))], 64)) : _("", !0)]);
		};
	}
}, [["__scopeId", "data-v-f0de9fb7"]]);
// src/utils/commons/clipboard.js
async function Ce(e) {
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
var we = {
	key: 0,
	class: "root-loading"
}, Te = {
	key: 1,
	class: "hint bad"
}, Ee = {
	key: 0,
	class: "hint"
}, De = ["disabled"], Oe = ["disabled"], ke = ["disabled"], Ae = /*#__PURE__*/ e({
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
		}, c = j({}), l = j({}), u = M(!1), d = M(null), f = h(() => r.root ? r.keyOf(r.root) : ""), T = h(() => l[f.value] || s);
		async function I(e, t = !1) {
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
			c[e] = !c[e], c[e] && I(e);
		}
		async function R(e) {
			c[f.value] = !0, await I(f.value);
			let t = f.value;
			for (let n of String(e || "").split("/").filter(Boolean)) t = t ? `${t}/${n}` : n, await I(t), c[t] = !0;
		}
		function te() {
			return Object.keys(c).filter((e) => c[e]);
		}
		async function ne(e) {
			let t = Array.isArray(e) ? e : [];
			await Promise.all(t.map(async (e) => {
				c[e] = !0, await I(e);
			}));
		}
		function re() {
			for (let e of Object.keys(c)) c[e] = !1;
			c[f.value] = !0;
		}
		function ie() {
			for (let e of Object.keys(l)) delete l[e];
			for (let e of Object.keys(c)) delete c[e];
			c[f.value] = !0, I(f.value);
		}
		async function ae(e) {
			await I(e, !0);
		}
		async function oe() {
			let e = Object.keys(c).filter((e) => c[e]);
			await Promise.all(e.map((e) => I(e, !0)));
		}
		function se(e) {
			let t = d.value ? d.value.querySelectorAll("[data-path]") : [];
			for (let n of t) if (n.dataset.path === e) {
				n.scrollIntoView({ block: "nearest" });
				return;
			}
		}
		async function ce() {
			await Promise.all(Object.keys(l).map((e) => I(e, !0)));
		}
		function H() {
			r.active && !u.value && (u.value = !0, c[f.value] = !0, I(f.value));
		}
		r.active && H(), k(H), z(() => r.active, (e) => {
			e && H();
		});
		let U = j({
			open: !1,
			x: 0,
			y: 0,
			node: null,
			copied: ""
		}), W = M(null), G = 0, K = h(() => U.node ? String(r.keyOf(U.node) || "") : ""), q = h(() => {
			if (!U.node || !r.rootPath) return "";
			let e = r.rootPath.replace(/\/+$/, ""), t = K.value;
			return t ? `${e}/${t}` : e;
		}), J = h(() => U.node ? r.dirOf(U.node) : !1);
		function Y({ node: e, event: t }) {
			U.node = e, U.copied = "", U.x = t.clientX, U.y = t.clientY, U.open = !0, w(le);
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
			t && await Ce(t) && (U.copied = e, clearTimeout(G), G = setTimeout(X, 700));
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
		function pe(e) {
			e.key === "Escape" && X();
		}
		function Q() {
			U.open && X();
		}
		function me(e) {
			let t = e ? "addEventListener" : "removeEventListener";
			document[t]("mousedown", fe, !0), document[t]("keydown", pe, !0), window[t]("scroll", Q, !0), window[t]("resize", Q);
		}
		return z(() => U.open, (e) => me(e)), O(() => {
			X(), me(!1);
		}), t({
			reveal: R,
			reload: ie,
			reloadDir: ae,
			reloadExpanded: oe,
			refreshAll: ce,
			scrollTo: se,
			toggle: ee,
			collapseAll: re,
			expandedKeys: te,
			restoreExpanded: ne
		}), (t, n) => {
			let r = F("v-progress-circular"), a = F("v-icon");
			return A(), v("div", {
				ref_key: "rootRef",
				ref: d,
				class: "file-tree"
			}, [e.root ? (A(), g(Se, {
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
				"row-before-label": B((e) => [P(t.$slots, "row-before-label", E(S(e)), void 0, !0)]),
				"row-after-label": B((e) => [P(t.$slots, "row-after-label", E(S(e)), void 0, !0)]),
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
			])) : (A(), v(p, { key: 1 }, [T.value.loading ? (A(), v("div", we, [x(r, {
				indeterminate: "",
				size: 14,
				width: 2
			})])) : T.value.error ? (A(), v("p", Te, L(T.value.error), 1)) : (A(), v(p, { key: 2 }, [(A(!0), v(p, null, N(T.value.entries, (r) => (A(), g(Se, {
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
				"row-before-label": B((e) => [P(t.$slots, "row-before-label", C({ ref_for: !0 }, e), void 0, !0)]),
				"row-after-label": B((e) => [P(t.$slots, "row-after-label", C({ ref_for: !0 }, e), void 0, !0)]),
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
			]))), 128)), T.value.truncated ? (A(), v("p", Ee, L(o.value.truncated), 1)) : _("", !0)], 64))], 64)), (A(), g(m, { to: "body" }, [U.open ? (A(), v("div", {
				key: 0,
				ref_key: "menuRef",
				ref: W,
				class: "ft-menu",
				style: D({
					left: U.x + "px",
					top: U.y + "px"
				}),
				onContextmenu: n[10] ||= V(() => {}, ["prevent"])
			}, [
				e.editable ? (A(), v(p, { key: 0 }, [
					J.value ? (A(), v("button", {
						key: 0,
						class: "ft-item",
						type: "button",
						onClick: n[2] ||= (e) => Z("create-file")
					}, [x(a, { size: "16" }, {
						default: B(() => [...n[11] ||= [b("mdi-file-plus-outline", -1)]]),
						_: 1
					}), y("span", null, L(o.value.newFile), 1)])) : _("", !0),
					J.value ? (A(), v("button", {
						key: 1,
						class: "ft-item",
						type: "button",
						onClick: n[3] ||= (e) => Z("create-dir")
					}, [x(a, { size: "16" }, {
						default: B(() => [...n[12] ||= [b("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), y("span", null, L(o.value.newDir), 1)])) : _("", !0),
					J.value ? (A(), v("button", {
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
					}), y("span", null, L(o.value.rename), 1)], 8, De),
					y("button", {
						class: "ft-item danger",
						type: "button",
						disabled: !K.value,
						onClick: n[6] ||= (e) => Z("delete")
					}, [x(a, { size: "16" }, {
						default: B(() => [...n[15] ||= [b("mdi-trash-can-outline", -1)]]),
						_: 1
					}), y("span", null, L(o.value.delete), 1)], 8, Oe),
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
					onClick: n[8] ||= (e) => ue("rel")
				}, [x(a, { size: "16" }, {
					default: B(() => [...n[19] ||= [b("mdi-content-copy", -1)]]),
					_: 1
				}), y("span", null, L(U.copied === "rel" ? o.value.copied : o.value.copyRel), 1)], 8, ke),
				e.rootPath ? (A(), v("button", {
					key: 1,
					class: "ft-item",
					type: "button",
					onClick: n[9] ||= (e) => ue("abs")
				}, [x(a, { size: "16" }, {
					default: B(() => [...n[20] ||= [b("mdi-link-variant", -1)]]),
					_: 1
				}), y("span", null, L(U.copied === "abs" ? o.value.copied : o.value.copyAbs), 1)])) : _("", !0),
				e.downloadOf ? (A(), v("button", {
					key: 2,
					class: "ft-item",
					type: "button",
					onClick: de
				}, [x(a, { size: "16" }, {
					default: B(() => [b(L(J.value ? "mdi-folder-zip-outline" : "mdi-download"), 1)]),
					_: 1
				}), y("span", null, L(J.value ? o.value.downloadDir : o.value.downloadFile), 1)])) : _("", !0)
			], 36)) : _("", !0)]))], 512);
		};
	}
}, [["__scopeId", "data-v-5b2607f4"]]), je = { class: "file-head" }, Me = { class: "crumbs" }, Ne = ["title", "onClick"], Pe = { class: "meta" }, Fe = /*#__PURE__*/ e({
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
		return (t, n) => (A(), v("div", je, [
			y("nav", Me, [y("button", {
				class: "seg",
				title: "回到根目录",
				onClick: n[0] ||= (e) => r("navigate", "")
			}, L(e.rootName), 1), (A(!0), v(p, null, N(i.value, (e, t) => (A(), v(p, { key: e.path }, [n[1] ||= y("span", { class: "sep" }, "/", -1), y("button", {
				class: T(["seg", { last: t === i.value.length - 1 }]),
				title: e.path,
				onClick: (n) => o(e, t)
			}, L(e.name), 11, Ne)], 64))), 128))]),
			P(t.$slots, "actions", {}, void 0, !0),
			y("span", Pe, L(a.value), 1)
		]));
	}
}, [["__scopeId", "data-v-0a2775f2"]]), Ie = /*#__PURE__*/ e({
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
			let a = F("v-spacer"), o = F("v-btn");
			return A(), g(n, {
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
function Le({ loader: e, saver: t }) {
	let n = M(""), r = j({
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
var Re = {
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
function ze(e) {
	let t = o(e);
	return t === "markdown" ? Re.markdown : t ? Re.code : Re.plain;
}
function Be(e) {
	return ze(e).modes;
}
function Ve(e, t) {
	return t.some((t) => t.id === e) ? e : "source";
}
function He(e, t) {
	return t > 0 ? "source" : e;
}
function Ue(e) {
	return {
		mode: "source",
		message: `视图加载失败${e && e.message ? `：${e.message}` : ""}`
	};
}
// src/components/commons/FileEditor/FileEditor.vue
var We = { class: "file-editor" }, Ge = {
	key: 1,
	class: "actions"
}, Ke = {
	key: 1,
	class: "hint"
}, qe = {
	key: 3,
	class: "edit-wrap"
}, Je = {
	key: 0,
	class: "hint bad edit-error"
}, Ye = {
	key: 1,
	class: "hint bad edit-error"
}, Xe = {
	key: 3,
	class: "hint"
}, Ze = /*#__PURE__*/ e({
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
		let r = e, a = n, { path: o, state: s, dirty: c, load: l, save: u, discard: d, reset: f } = Le({
			loader: r.loader,
			saver: r.saver
		}), m = M(null);
		z(c, (e) => a("dirty", e));
		let y = M("source"), S = h(() => Be(o.value)), C = h(() => S.value.find((e) => e.id === y.value) || null), T = ee(null), E = M(!1), D = M(""), k = 0;
		function j() {
			if (!k) return;
			let e = m.value;
			if (!e || typeof e.locate != "function") return;
			let t = k;
			k = 0, e.locate(t);
		}
		z(S, (e) => {
			y.value = Ve(y.value, e);
		}, { immediate: !0 }), z(C, async (e) => {
			if (T.value = null, E.value = !!e, e) {
				D.value = "";
				try {
					let t = await e.load();
					if (C.value !== e) return;
					T.value = t.default, await w(), j();
				} catch (t) {
					if (C.value === e) {
						let e = Ue(t);
						D.value = e.message, y.value = e.mode;
					}
				} finally {
					C.value === e && (E.value = !1);
				}
			}
		}, { immediate: !0 });
		async function P() {
			let e = o.value, t = await u();
			return t && a("saved", {
				path: e,
				data: t
			}), t;
		}
		function te() {
			d();
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
		function V(e) {
			a("caret", {
				path: o.value,
				...e
			});
		}
		let ae = M(!1), oe = null;
		async function se(e, t = 0) {
			return D.value = "", y.value = He(y.value, t), k = t, await l(e) ? (await w(), t || m.value?.resetScroll(), j(), !0) : (k = 0, !1);
		}
		async function ce() {
			return !o.value || !await l(o.value) ? !1 : (await w(), m.value?.resetScroll(), !0);
		}
		function H() {
			G(), f();
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
		let K = h(() => s.draft), q = h(() => s.base);
		function J(e) {
			s.draft = e == null ? "" : String(e);
		}
		return O(() => W(!1)), t({
			open: se,
			reload: ce,
			close: H,
			save: P,
			discard: te,
			confirmLeave: U,
			cancelLeave: G,
			path: o,
			dirty: c,
			text: K,
			base: q,
			restore: J
		}), (t, n) => {
			let r = F("v-btn"), l = F("v-btn-toggle"), u = F("v-chip");
			return A(), v("section", We, [
				R(o) ? (A(), g(Fe, {
					key: 0,
					"root-name": e.rootName,
					path: R(o),
					size: e.size,
					onNavigate: n[1] ||= (e) => a("navigate", e)
				}, {
					actions: B(() => [S.value.length > 1 ? (A(), g(l, {
						key: 0,
						modelValue: y.value,
						"onUpdate:modelValue": n[0] ||= (e) => y.value = e,
						density: "compact",
						variant: "text",
						divided: "",
						mandatory: "",
						class: "views"
					}, {
						default: B(() => [(A(!0), v(p, null, N(S.value, (e) => (A(), g(r, {
							key: e.id,
							value: e.id,
							size: "small"
						}, {
							default: B(() => [b(L(e.title), 1)]),
							_: 2
						}, 1032, ["value"]))), 128))]),
						_: 1
					}, 8, ["modelValue"])) : _("", !0), R(c) && !R(s).loading ? (A(), v("div", Ge, [
						x(u, {
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
							loading: R(s).saving,
							onClick: P
						}, {
							default: B(() => [...n[7] ||= [b(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"]),
						x(r, {
							size: "small",
							variant: "text",
							disabled: R(s).saving,
							onClick: te
						}, {
							default: B(() => [...n[8] ||= [b(" 放弃 ", -1)]]),
							_: 1
						}, 8, ["disabled"])
					])) : _("", !0)]),
					_: 1
				}, 8, [
					"root-name",
					"path",
					"size"
				])) : _("", !0),
				R(s).loading ? (A(), v("p", Ke, "正在读取文件…")) : R(s).error ? (A(), g(i, {
					key: 2,
					icon: "mdi-file-question-outline",
					"icon-size": 28,
					title: R(s).error,
					hint: "换一个文件试试，或者从左侧目录里下载它。"
				}, null, 8, ["title"])) : R(o) ? (A(), v("div", qe, [
					D.value ? (A(), v("p", Je, L(D.value), 1)) : _("", !0),
					R(s).saveError ? (A(), v("p", Ye, L(R(s).saveError), 1)) : _("", !0),
					T.value ? (A(), g(I(T.value), {
						key: 2,
						ref_key: "paneRef",
						ref: m,
						modelValue: R(s).draft,
						"onUpdate:modelValue": n[2] ||= (e) => R(s).draft = e,
						path: R(o),
						onSymbol: ne,
						onMenu: re,
						onRename: ie,
						onCaret: V,
						markers: e.markers,
						onEdit: n[3] ||= (e) => t.$emit("edit", { path: R(o) }),
						onHover: n[4] ||= (e) => t.$emit("hover", {
							path: R(o),
							...e
						}),
						onHoverEnd: n[5] ||= (e) => t.$emit("hover-end", { path: R(o) })
					}, null, 40, [
						"modelValue",
						"path",
						"markers"
					])) : E.value ? (A(), v("p", Xe, "正在准备视图…")) : _("", !0)
				])) : (A(), g(i, {
					key: 4,
					icon: "mdi-file-outline",
					hint: "从左边选一个文件，右边显示它的内容。"
				})),
				x(Ie, {
					"model-value": ae.value,
					path: R(o),
					onAnswer: W
				}, null, 8, ["model-value", "path"])
			]);
		};
	}
}, [["__scopeId", "data-v-6b41639b"]]), Qe = "web-shared-resizing";
function $e({ area: e, initial: t, min: n = 0, max: r = 100, rightMin: i = 0, axis: a = "x", unit: o = "px", persist: s = "" }) {
	let c = M(f()), l = M(!1), u = 0, d = 0;
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
		l.value && (l.value = !1, window.removeEventListener("pointermove", m), document.body.classList.remove(Qe));
	}
	function g(t) {
		t.button === 0 && e.value && (l.value = !0, u = a === "x" ? t.clientX : t.clientY, d = c.value, t.preventDefault(), document.body.classList.add(Qe), window.addEventListener("pointermove", m), window.addEventListener("pointerup", h, { once: !0 }));
	}
	function _() {
		c.value = t;
	}
	return z(c, (e) => {
		if (s) try {
			window.localStorage.setItem(s, String(e));
		} catch {}
	}), O(h), {
		size: c,
		resizing: l,
		start: g,
		stop: h,
		reset: _
	};
}
// src/utils/services/serviceStatus.js
var et = ["starting", "ready"];
function tt(e, t = et) {
	return (e.services || []).filter((e) => e.run && t.includes(e.run.status)).length;
}
function nt(e, t = et) {
	let n = [];
	for (let r of e || []) {
		let e = tt(r, t);
		e && n.push({
			id: r.id,
			name: r.alias || s(r.root),
			count: e
		});
	}
	return n;
}
// src/components/services/WorkspaceShell.vue
var rt = { class: "brand" }, it = { class: "run-count" }, at = { class: "side" }, ot = { class: "content" }, st = /*#__PURE__*/ e({
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
		let r = e, o = n, s = h(() => nt(r.workspaces));
		function c(e) {
			o("select-workspace", e);
		}
		let l = M(null), u = M(!0), { size: d, resizing: f, start: m, reset: S } = $e({
			area: l,
			initial: 268,
			min: 200,
			rightMin: 420,
			persist: `${r.title}.shell.side-width`
		});
		return (n, r) => {
			let o = F("v-app-bar-nav-icon"), h = F("v-app-bar-title"), w = F("v-spacer"), E = F("v-chip"), O = F("v-list-item-title"), k = F("v-list-item"), j = F("v-list"), M = F("v-menu"), I = F("v-btn"), ee = F("v-app-bar"), z = F("v-main"), ne = F("v-app");
			return A(), g(ne, null, {
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
								default: B(() => [y("span", rt, L(e.title), 1)]),
								_: 1
							}),
							x(w),
							e.workspaces.length ? (A(), g(M, {
								key: 0,
								location: "bottom end"
							}, {
								activator: B(({ props: t }) => [x(E, C(t, {
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
								default: B(() => [x(j, {
									density: "compact",
									class: "running-menu"
								}, {
									default: B(() => [(A(!0), v(p, null, N(s.value, (t) => (A(), g(k, {
										key: t.id,
										active: e.current && e.current.id === t.id,
										onClick: (e) => c(t.id)
									}, {
										append: B(() => [y("span", it, L(t.count) + " 个", 1)]),
										default: B(() => [x(O, { class: "run-name" }, {
											default: B(() => [b(L(t.name), 1)]),
											_: 2
										}, 1024)]),
										_: 2
									}, 1032, ["active", "onClick"]))), 128)), s.value.length ? _("", !0) : (A(), g(k, {
										key: 0,
										disabled: ""
									}, {
										default: B(() => [x(O, null, {
											default: B(() => [...r[3] ||= [b("没有在跑的进程", -1)]]),
											_: 1
										})]),
										_: 1
									}))]),
									_: 1
								})]),
								_: 1
							})) : _("", !0),
							P(n.$slots, "metrics", {}, void 0, !0),
							x(I, {
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
					x(z, { class: "fill-height" }, {
						default: B(() => [y("div", {
							ref_key: "shellRef",
							ref: l,
							class: "shell"
						}, [
							y("div", {
								class: "side-slot",
								style: D({ width: u.value ? `${R(d)}px` : "0px" })
							}, null, 4),
							y("div", {
								class: T(["side-layer", { folded: !u.value }]),
								style: D({ width: `${R(d)}px` })
							}, [y("aside", at, [P(n.$slots, "sidebar", {}, void 0, !0)])], 6),
							re(x(a, {
								axis: "x",
								active: R(f),
								onStart: R(m),
								onReset: R(S)
							}, null, 8, [
								"active",
								"onStart",
								"onReset"
							]), [[te, u.value]]),
							y("main", ot, [P(n.$slots, "default", { ws: e.current }, void 0, !0), e.current ? _("", !0) : (A(), g(i, C({ key: 0 }, e.empty, { onAction: r[2] ||= (e) => n.$emit("empty-action") }), null, 16))])
						], 512)]),
						_: 3
					})
				]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-67021267"]]), ct = "";
function lt(e, t) {
	let n = String(e.parent || "").trim();
	return n && t.has(n) ? n : ct;
}
function ut(e, t, n) {
	let r = new Map(t.map((e) => [e.id, e])), i = /* @__PURE__ */ new Set();
	for (let t of e) t && t.kind === "group" && t.id && i.add(t.id);
	let a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), c = [], l = /* @__PURE__ */ new Map(), u = (e, t) => {
		a.has(e) || a.set(e, []), a.get(e).push(t);
	};
	for (let t of e) if (t && t.id) {
		if (t.kind === "ws") {
			if (!r.has(t.id) || o.has(t.id)) continue;
			o.add(t.id), u(lt(t, i), t);
		} else if (t.kind === "group" && t.name) {
			if (s.has(t.id)) continue;
			s.add(t.id), c.push(t), l.set(t.id, t), u(lt(t, i), t);
		}
	}
	let d = (e) => {
		let t = e, n = /* @__PURE__ */ new Set();
		for (; t;) {
			if (n.has(t.id)) return !1;
			n.add(t.id);
			let e = lt(t, i);
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
	m(ct, 0);
	for (let e of c) p.has(e.id) || d(e) || (p.add(e.id), f.push({
		key: `group:${e.id}`,
		kind: "group",
		id: e.id,
		depth: 0,
		parent: ct,
		name: e.name,
		group: e
	}), n.has(e.id) || m(e.id, 1));
	for (let e of t) o.has(e.id) || f.push({
		key: `ws:${e.id}`,
		kind: "ws",
		id: e.id,
		depth: 0,
		parent: ct,
		ws: e
	});
	return f;
}
function dt(e) {
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
	a(ct, 0);
	for (let e of t.values()) for (let t of e) i.has(t.id) || (i.add(t.id), r.push({
		id: t.id,
		name: t.name,
		depth: 0
	}));
	return r;
}
function ft(e, t, n) {
	let r = String(n || ""), i = /* @__PURE__ */ new Set();
	for (; r && !i.has(r);) {
		if (r === t) return !0;
		i.add(r);
		let n = e.find((e) => e && e.kind === "group" && e.id === r);
		r = n ? String(n.parent || "") : "";
	}
	return !1;
}
function pt(e, t, n) {
	let r = new Set(t);
	return r.size ? e.map((e) => e.kind === "ws" && r.has(e.id) ? {
		...e,
		parent: n
	} : e) : e;
}
function mt(e, t) {
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
var ht = { class: "head" }, gt = { class: "head-title" }, _t = {
	key: 0,
	class: "none"
}, vt = { class: "gtext" }, yt = { class: "nm" }, bt = ["onClick"], xt = { class: "tip" }, St = { class: "tip" }, Ct = { class: "tip" }, wt = /*#__PURE__*/ e({
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
		})), o = t, s = r.storageKey ? se(r.storageKey, [], { writeDefaults: !1 }) : M([]), c = h(() => new Set(Array.isArray(s.value) ? s.value : [])), l = M(null), u = M(null), d = h(() => r.groups.filter((e) => e && e.kind === "group").length), f = h(() => ut(r.groups, r.workspaces, c.value)), m = h(() => dt(r.groups));
		function S() {
			return mt(r.groups, r.workspaces);
		}
		function C(e, t) {
			return ft(r.groups, e, t);
		}
		function w(e) {
			o("groups-change", e);
		}
		function E(e, t, n, r) {
			let i = e.find((e) => e.kind === t && e.id === n);
			i ? i.parent = r : e.push({
				kind: t,
				id: n,
				parent: r
			});
		}
		function I() {
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
		function ae(e, t) {
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
		function ce() {
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
		let U = M(!1), W = M(""), G = M(!1), K = M(0), q = M(null), J = j({
			open: !1,
			x: 0,
			y: 0,
			mode: "blank",
			target: null
		}), Y = M(!1), le = M(null), X = M(""), ue = M(!1), Z = M(!1), de = M(null), fe = M(""), Q = M(!1), me = M(null);
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
			de.value = { id: e.id }, fe.value = e.name || "", Z.value = !0, $();
		}
		function ye() {
			let e = (fe.value || "").trim().slice(0, 80);
			e && de.value && (w(S().map((t) => t.kind === "group" && t.id === de.value.id ? {
				...t,
				name: e
			} : t)), Z.value = !1);
		}
		function be() {
			let e = S(), t = {
				kind: "group",
				id: I(),
				name: "新分组",
				parent: ""
			};
			e.push(t), w(e), $(), ve(t);
		}
		function xe() {
			let e = J.target;
			if (!e) return;
			let t = S(), n = {
				kind: "group",
				id: I(),
				name: "新分组",
				parent: e.id
			};
			t.push(n), w(t), ne(e.id), $(), ve(n);
		}
		function Se() {
			let e = J.target;
			if (!e) return;
			let t = S(), n = {
				kind: "group",
				id: I(),
				name: "新分组",
				parent: ""
			};
			t.push(n), E(t, "ws", e.id, n.id), w(t), $(), ve(n);
		}
		function we(e) {
			if (!J.target) return;
			let t = S();
			E(t, "ws", J.target.id, e), w(t), e && ne(e), $();
		}
		function Te() {
			me.value = J.target, Q.value = !0, $();
		}
		function Ee() {
			let e = me.value ? me.value.id : "";
			if (e) {
				let t = S(), n = t.findIndex((t) => t.kind === "group" && t.id === e);
				if (n >= 0) {
					let r = t[n].parent || "";
					t.splice(n, 1);
					for (let n of t) (n.parent || "") === e && (n.parent = r);
					w(t);
				}
			}
			Q.value = !1;
		}
		function De(e) {
			le.value = e, X.value = e.alias || "", Y.value = !0, $();
		}
		async function Oe() {
			if (le.value) {
				ue.value = !0;
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
					ue.value = !1;
				}
			}
		}
		async function ke(e, t) {
			let n = t === "rel" && e.rel || e.root, r = await Ce(n);
			o("notice", {
				text: r ? `${a.value.copied}${n}` : a.value.copyFailed,
				color: r ? "primary" : "error"
			}), $();
		}
		k(() => {
			document.addEventListener("click", $), document.addEventListener("contextmenu", $), window.addEventListener("resize", $), window.addEventListener("blur", $);
		}), O(() => {
			document.removeEventListener("click", $), document.removeEventListener("contextmenu", $), window.removeEventListener("resize", $), window.removeEventListener("blur", $);
		});
		function Ae(e) {
			let t = String(e || "").split("/").filter(Boolean);
			return t.length ? t[t.length - 1] : e;
		}
		let je = M(""), Me = new Set(r.workspaces.map((e) => e.id));
		function Ne(e) {
			J.open = !1, Pe(), je.value = e ? e.id : "";
		}
		z(() => r.workspaces.map((e) => e.id).join(","), () => {
			let e = r.workspaces.filter((e) => !Me.has(e.id)).map((e) => e.id);
			if (Me = new Set(r.workspaces.map((e) => e.id)), !je.value || !e.length) return;
			let t = je.value;
			je.value = "", o("groups-change", pt(mt(r.groups, r.workspaces), e, t));
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
			let i = F("v-btn"), o = F("v-icon"), s = F("v-list-item-title"), l = F("v-list-item-subtitle"), u = F("v-list-item"), h = F("v-list"), S = F("v-text-field"), C = F("v-spacer");
			return A(), v("div", {
				class: "list",
				onContextmenu: V(_e, ["prevent", "stop"])
			}, [
				y("div", ht, [y("span", gt, L(a.value.headTitle), 1), x(i, {
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
				!e.workspaces.length && !d.value ? (A(), v("div", _t, L(a.value.empty), 1)) : _("", !0),
				x(h, {
					density: "compact",
					nav: "",
					class: "items",
					onDrop: V(ce, ["prevent"])
				}, {
					default: B(() => [(A(!0), v(p, null, N(f.value, (n) => (A(), g(u, {
						key: n.key,
						active: n.kind === "ws" && n.id === e.current,
						"active-color": "primary",
						draggable: "true",
						style: D({ paddingLeft: `${12 + n.depth * 18}px` }),
						class: T(re(n)),
						onClick: (e) => te(n),
						onContextmenu: V((e) => ge(e, n), ["prevent", "stop"]),
						onDragstart: (e) => ae(e, n),
						onDragover: V((e) => oe(e, n), ["prevent"]),
						onDragend: H
					}, {
						append: B(() => [n.kind === "ws" ? (A(), g(i, {
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
						default: B(() => [(A(!0), v(p, null, N(n.depth, (e) => (A(), v("span", {
							key: e,
							class: "guide",
							style: D({ left: `${20 + (e - 1) * 18}px` })
						}, null, 4))), 128)), n.kind === "group" ? (A(), g(s, {
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
								y("span", vt, L(n.name), 1)
							]),
							_: 2
						}, 1024)) : (A(), v(p, { key: 1 }, [x(s, {
							class: "name",
							title: n.ws.alias ? n.ws.root : ""
						}, {
							default: B(() => [y("span", yt, L(n.ws.alias || Ae(n.ws.root)), 1), P(t.$slots, "title-extra", { ws: n.ws }, void 0, !0)]),
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
				J.open ? (A(), v("div", {
					key: 1,
					class: "ctxmenu",
					style: D({
						left: J.x + "px",
						top: J.y + "px"
					}),
					onClick: r[7] ||= V(() => {}, ["stop"]),
					onContextmenu: r[8] ||= V(() => {}, ["prevent", "stop"])
				}, [J.mode === "ws" ? (A(), v(p, { key: 0 }, [
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[0] ||= (e) => De(J.target)
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[25] ||= [b("mdi-rename-box", -1)]]),
						_: 1
					}), b(L(a.value.menuAlias), 1)]),
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[1] ||= (e) => ke(J.target, "rel")
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[26] ||= [b("mdi-content-copy", -1)]]),
						_: 1
					}), b(L(a.value.copyRel), 1)]),
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[2] ||= (e) => ke(J.target, "abs")
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[27] ||= [b("mdi-content-copy", -1)]]),
						_: 1
					}), b(L(a.value.copyAbs), 1)]),
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[3] ||= (e) => J.mode = "pick"
					}, [
						x(o, { size: "16" }, {
							default: B(() => [...r[28] ||= [b("mdi-folder-move-outline", -1)]]),
							_: 1
						}),
						r[29] ||= b("移到分组 ", -1),
						r[30] ||= y("span", { class: "more" }, "›", -1)
					])
				], 64)) : J.mode === "pick" ? (A(), v(p, { key: 1 }, [
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[4] ||= (e) => we("")
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[31] ||= [b("mdi-format-list-bulleted", -1)]]),
						_: 1
					}), r[32] ||= b("移出分组 ", -1)]),
					(A(!0), v(p, null, N(m.value, (e) => (A(), v("button", {
						key: e.id,
						type: "button",
						class: "ctxitem",
						style: D({ paddingLeft: `${10 + e.depth * 18}px` }),
						onClick: (t) => we(e.id)
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[33] ||= [b("mdi-folder-outline", -1)]]),
						_: 1
					}), b(L(e.name), 1)], 12, bt))), 128)),
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: Se
					}, [x(o, { size: "16" }, {
						default: B(() => [...r[34] ||= [b("mdi-folder-plus-outline", -1)]]),
						_: 1
					}), r[35] ||= b("新建分组并移入 ", -1)])
				], 64)) : J.mode === "group" ? (A(), v(p, { key: 2 }, [
					y("button", {
						type: "button",
						class: "ctxitem",
						onClick: r[5] ||= (e) => Ne(J.target)
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
						onClick: r[6] ||= (e) => ve(J.target)
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
				], 64)) : (A(), v("button", {
					key: 3,
					type: "button",
					class: "ctxitem",
					onClick: be
				}, [x(o, { size: "16" }, {
					default: B(() => [...r[43] ||= [b("mdi-folder-plus-outline", -1)]]),
					_: 1
				}), r[44] ||= b("新建分组 ", -1)]))], 36)) : _("", !0),
				x(n, {
					modelValue: Y.value,
					"onUpdate:modelValue": r[11] ||= (e) => Y.value = e,
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
							onClick: r[10] ||= (e) => Y.value = !1
						}, {
							default: B(() => [...r[45] ||= [b("取消", -1)]]),
							_: 1
						}),
						x(i, {
							color: "primary",
							variant: "flat",
							loading: ue.value,
							onClick: Oe
						}, {
							default: B(() => [...r[46] ||= [b(" 保存 ", -1)]]),
							_: 1
						}, 8, ["loading"])
					]),
					default: B(() => [
						y("p", xt, L(le.value ? le.value.root : ""), 1),
						x(S, {
							modelValue: X.value,
							"onUpdate:modelValue": r[9] ||= (e) => X.value = e,
							label: "别名",
							density: "compact",
							variant: "outlined",
							maxlength: "80",
							clearable: "",
							autofocus: "",
							onKeyup: ie(Oe, ["enter"])
						}, null, 8, ["modelValue"]),
						y("p", St, L(a.value.aliasHint), 1)
					]),
					_: 1
				}, 8, ["modelValue"]),
				x(n, {
					modelValue: Z.value,
					"onUpdate:modelValue": r[14] ||= (e) => Z.value = e,
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
							onClick: r[13] ||= (e) => Z.value = !1
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
						onKeyup: ie(ye, ["enter"])
					}, null, 8, ["modelValue"])]),
					_: 1
				}, 8, ["modelValue"]),
				x(n, {
					modelValue: Q.value,
					"onUpdate:modelValue": r[16] ||= (e) => Q.value = e,
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
							onClick: r[15] ||= (e) => Q.value = !1
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
					default: B(() => [b(" " + L(me.value ? me.value.name : "") + " ", 1), r[53] ||= y("p", { class: "tip" }, "里面的子分组与工作区移到上一级，工作区本身不动。", -1)]),
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
					default: B(() => [(A(), g(R(pe), {
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
				x(n, {
					modelValue: q.value,
					"onUpdate:modelValue": r[22] ||= (e) => q.value = e,
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
							onClick: r[21] ||= (e) => q.value = null
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
					default: B(() => [b(" " + L(q.value ? q.value.root : "") + " ", 1), y("p", Ct, L(a.value.removeText), 1)]),
					_: 1
				}, 8, ["modelValue"])
			], 32);
		};
	}
}, [["__scopeId", "data-v-593e1b9a"]]);
// src/composables/services/useWorkspaceState.js
function Tt({ api: e, storageKey: t, extraState: n = {}, loadExtra: i = null, addedNotice: a = "已添加" }) {
	let o = j({
		workspaces: [],
		groups: [],
		...n
	}), s = se(t, "", { writeDefaults: !1 }), c = M(!1), l = M(null), { snack: u, toast: d } = r(), f = null, p = 0, m = h(() => o.workspaces.find((e) => e.id === s.value) || null), g = h(() => o.workspaces.reduce((e, t) => e + tt(t), 0));
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
	async function N() {
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
		start: N,
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
var Et = {
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
		let t = e, { dark: n, toggle: r } = l({ rememberTheme: t.rememberTheme }), { state: i, current: a, currentId: o, adding: s, snack: u, toast: d, metrics: f, running: p, select: m, setGroups: h, refresh: v, act: y, start: b, addWorkspace: S, removeWorkspace: C, rescan: w, startService: T, stopService: E, saveService: D } = Tt({
			api: t.api,
			storageKey: t.storageKey,
			extraState: t.extraState,
			addedNotice: t.addedNotice,
			loadExtra: t.loadExtra
		});
		return k(b), (t, l) => (A(), g(st, {
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
			sidebar: B(() => [x(wt, {
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
			default: B(({ ws: e }) => [e ? P(t.$slots, "panel", {
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
}, Dt = { style: { width: "42%" } }, Ot = { class: "svc-name" }, kt = ["title"], At = ["title"], jt = { class: "status-line" }, Mt = {
	key: 0,
	class: "meta"
}, Nt = {
	key: 1,
	class: "meta"
}, Pt = ["title"], Ft = {
	key: 1,
	class: "meta"
}, It = {
	key: 2,
	class: "meta"
}, Lt = { class: "ops" }, Rt = /*#__PURE__*/ e({
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
			let r = F("v-chip"), i = F("v-btn"), a = F("v-icon"), o = F("v-table");
			return A(), g(o, {
				density: "compact",
				class: "table"
			}, {
				default: B(() => [y("thead", null, [y("tr", null, [
					y("th", Dt, L(e.nameTitle), 1),
					n[0] ||= y("th", null, "参数", -1),
					n[1] ||= y("th", { style: { width: "200px" } }, "状态", -1),
					n[2] ||= y("th", { style: { width: "230px" } }, null, -1)
				])]), y("tbody", null, [(A(!0), v(p, null, N(e.rows, (o) => (A(), v("tr", { key: o.key }, [
					y("td", null, [y("div", Ot, [y("span", null, L(o.title), 1), o.typeText ? (A(), g(r, {
						key: 0,
						size: "x-small",
						variant: "tonal",
						class: "type-chip"
					}, {
						default: B(() => [b(L(o.typeText), 1)]),
						_: 2
					}, 1024)) : _("", !0)]), e.showPath && o.path ? (A(), v("div", {
						key: 0,
						class: "svc-path",
						title: o.path
					}, L(o.path), 9, kt)) : _("", !0)]),
					y("td", null, [y("div", {
						class: "cmd",
						title: o.cmd
					}, L(o.cmd), 9, At)]),
					y("td", null, [y("div", jt, [o.live ? (A(), v(p, { key: 0 }, [x(r, {
						size: "small",
						class: "status-chip",
						color: o.color,
						variant: "tonal",
						"prepend-icon": o.icon
					}, {
						default: B(() => [b(L(o.statusText), 1)]),
						_: 2
					}, 1032, ["color", "prepend-icon"]), o.port ? (A(), v("span", Mt, "端口 " + L(o.port), 1)) : o.started ? (A(), v("span", Nt, L(o.ago), 1)) : _("", !0)], 64)) : o.run ? (A(), v(p, { key: 1 }, [x(r, {
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
					]), o.err ? (A(), v("span", {
						key: 0,
						class: "meta err",
						title: o.err
					}, L(o.err), 9, Pt)) : o.started ? (A(), v("span", Ft, L(o.ago), 1)) : _("", !0)], 64)) : (A(), v("span", It, "—"))])]),
					y("td", Lt, [o.live ? (A(), v(p, { key: 0 }, [x(i, {
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
					}, 8, ["loading", "onClick"])], 64)) : (A(), v(p, { key: 1 }, [
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
						o.run ? (A(), g(i, {
							key: 0,
							size: "small",
							variant: "text",
							"prepend-icon": "mdi-text-box-outline",
							onClick: (e) => t.$emit("log", o)
						}, {
							default: B(() => [...n[6] ||= [b(" 日志 ", -1)]]),
							_: 1
						}, 8, ["onClick"])) : _("", !0)
					], 64)), P(t.$slots, "row-extra", { row: o }, void 0, !0)])
				]))), 128))])]),
				_: 3
			});
		};
	}
}, [["__scopeId", "data-v-8df04734"]]), zt = { class: "log-head" }, Bt = { class: "log-box" }, Vt = {
	key: 1,
	class: "log-empty"
}, Ht = /*#__PURE__*/ e({
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
			let r = F("v-spacer"), i = F("v-btn");
			return A(), v(p, null, [y("div", zt, [
				n[2] ||= y("span", { class: "label" }, "日志", -1),
				x(r),
				e.more ? (A(), g(i, {
					key: 0,
					size: "small",
					variant: "text",
					"prepend-icon": "mdi-history",
					onClick: n[0] ||= (e) => t.$emit("load-more")
				}, {
					default: B(() => [...n[1] ||= [b(" 更早 ", -1)]]),
					_: 1
				})) : _("", !0)
			]), y("div", Bt, [e.text ? (A(), g(ce, {
				key: 0,
				text: e.text,
				dark: e.dark,
				colorize: e.colorize
			}, null, 8, [
				"text",
				"dark",
				"colorize"
			])) : (A(), v("p", Vt, L(e.emptyText), 1))])], 64);
		};
	}
}, [["__scopeId", "data-v-d45becae"]]);
// src/utils/services/toolApi.js
function Ut(e, t = {}) {
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
function Wt(e, t, n) {
	let r = se(e, n, { writeDefaults: !1 });
	return h({
		get: () => t.includes(r.value) ? r.value : n,
		set: (e) => {
			r.value = e;
		}
	});
}
// src/composables/commons/useFileTree.js
function Gt(e, t = () => ({})) {
	let n = j({});
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
function Kt({ api: e, ws: t, statusText: n = {} }) {
	let r = M(""), i = M(!1), a = M(0), o = M(""), s = M(""), c = M(""), l = null;
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
	}), O(u), {
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
export { J as DirectoryNode, pe as DirectoryPicker, Ze as FileEditor, Ae as FileTree, et as LIVE_STATUSES, ce as LogView, Ht as RunLogPanel, Rt as ServiceTable, Et as ToolApp, wt as WorkspaceList, st as WorkspaceShell, Ce as copyText, Ut as createToolApi, ge as fileIcon, tt as runningCount, f as symbolAt, Gt as useFileTree, Kt as useRunLog, $e as useSplitPane, Wt as useStoredChoice, Tt as useWorkspaceState };
