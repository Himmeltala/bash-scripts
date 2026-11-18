import { t as e } from "./codeSymbol.js";
import { t } from "./_plugin-vue_export-helper.js";
import { highlightCode as n } from "./highlight.js";
import { Fragment as r, computed as i, createBlock as a, createElementBlock as o, createElementVNode as s, nextTick as c, normalizeClass as l, normalizeStyle as u, openBlock as d, ref as f, renderList as p, toDisplayString as m, vShow as h, withDirectives as g, withKeys as _, withModifiers as v } from "vue";
// src/components/commons/FileEditor/widgets/EditorPane.vue
var y = { class: "edit-body" }, b = { class: "edit-stage" }, x = {
	class: "layer-code",
	"aria-hidden": "true"
}, S = ["innerHTML"], C = ["value", "onKeydown"], w = /*#__PURE__*/ t({
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
		},
		markers: {
			type: Object,
			default: () => ({})
		}
	},
	emits: [
		"update:modelValue",
		"symbol",
		"menu",
		"rename",
		"caret",
		"edit"
	],
	setup(t, { expose: n, emit: a }) {
		let w = t, T = a, E = f(null), D = f(null), O = f(null), k = f(!1), A = f(0), j = f(0), M = f(20), N = f(10), P = i(() => ({
			top: `${N.value + A.value * M.value - j.value}px`,
			height: `${M.value}px`
		}));
		function F() {
			let e = O.value;
			if (!e) return;
			let t = getComputedStyle(e);
			M.value = parseFloat(t.lineHeight) || 20, N.value = parseFloat(t.paddingTop) || 10;
		}
		function I() {
			let e = O.value;
			if (!e) return;
			let t = e.selectionDirection === "backward" ? e.selectionStart : e.selectionEnd, n = e.value.slice(0, t), r = 0;
			for (let e = 0; e < n.length; e += 1) n.charCodeAt(e) === 10 && (r += 1);
			A.value = r, j.value = e.scrollTop;
			let i = n.lastIndexOf("\n") + 1;
			T("caret", {
				line: r + 1,
				column: t - i + 1
			});
		}
		function L() {
			F(), k.value = !0, I();
		}
		function R(e) {
			T("update:modelValue", e.target.value), T("edit"), I();
		}
		function z(e) {
			let t = w.markers ? w.markers[e] : "";
			return t === "error" ? "has-error" : t === "warning" ? "has-warning" : t === "info" || t === "hint" ? "has-info" : "";
		}
		function B(t) {
			if (!(t.ctrlKey || t.metaKey) || t.button !== 0) return;
			let n = O.value;
			if (!n) return;
			let r = e(n.value, n.selectionStart);
			r && (t.preventDefault(), T("symbol", r));
		}
		function V(t) {
			let n = O.value;
			if (!n) return;
			let r = e(n.value, n.selectionStart);
			r && (t.preventDefault(), T("menu", {
				...r,
				x: t.clientX,
				y: t.clientY
			}));
		}
		function H(t) {
			if (t.key !== "F2") return;
			let n = O.value;
			if (!n) return;
			let r = e(n.value, n.selectionStart);
			r && (t.preventDefault(), T("rename", r));
		}
		function U(e) {
			D.value && (D.value.style.transform = `translate(${-e.scrollLeft}px, ${-e.scrollTop}px)`), E.value && (E.value.scrollTop = e.scrollTop);
		}
		function W(e) {
			U(e.target), j.value = e.target.scrollTop;
		}
		function G(e) {
			let t = e.target, n = t.selectionStart, r = t.selectionEnd;
			T("update:modelValue", `${w.modelValue.slice(0, n)}    ${w.modelValue.slice(r)}`), c(() => {
				t.selectionStart = n + 4, t.selectionEnd = n + 4, I();
			});
		}
		function K() {
			let e = O.value;
			e && (e.scrollTop = 0, e.scrollLeft = 0, U(e), A.value = 0, j.value = 0);
		}
		async function q(e) {
			await c();
			let t = O.value;
			if (!t) return;
			let n = w.modelValue.split("\n"), r = Math.min(Math.max(Number(e) || 1, 1), n.length), i = 0;
			for (let e = 0; e < r - 1; e += 1) i += n[e].length + 1;
			t.focus(), t.setSelectionRange(i, i + n[r - 1].length);
			let a = parseFloat(getComputedStyle(t).lineHeight) || 20;
			t.scrollTop = Math.max(0, (r - 1) * a - t.clientHeight / 3), U(t), F(), k.value = !0, I();
		}
		return n({
			resetScroll: K,
			locate: q
		}), (e, n) => (d(), o("div", y, [s("div", {
			ref_key: "gutterRef",
			ref: E,
			class: "gutter",
			"aria-hidden": "true"
		}, [(d(!0), o(r, null, p(t.lineCount, (e) => (d(), o("div", {
			key: e,
			class: l(["ln", z(e)])
		}, m(e), 3))), 128))], 512), s("div", b, [
			g(s("div", {
				class: "cur-line",
				style: u(P.value),
				"aria-hidden": "true"
			}, null, 4), [[h, k.value]]),
			s("pre", x, [s("code", {
				ref_key: "codeRef",
				ref: D,
				innerHTML: t.highlighted
			}, null, 8, S)]),
			s("textarea", {
				ref_key: "editorRef",
				ref: O,
				value: t.modelValue,
				class: "editor",
				wrap: "off",
				spellcheck: "false",
				onInput: R,
				onScroll: W,
				onKeydown: [_(v(G, ["prevent"]), ["tab"]), H],
				onKeyup: I,
				onMouseup: I,
				onFocus: L,
				onBlur: n[0] ||= (e) => k.value = !1,
				onClick: B,
				onContextmenu: V
			}, null, 40, C)
		])]));
	}
}, [["__scopeId", "data-v-d23ded23"]]), T = {
	__name: "TextEditor",
	props: {
		modelValue: {
			type: String,
			default: ""
		},
		language: {
			type: String,
			default: ""
		},
		markers: {
			type: Object,
			default: () => ({})
		}
	},
	emits: [
		"update:modelValue",
		"symbol",
		"menu",
		"rename",
		"caret",
		"edit"
	],
	setup(e, { expose: t }) {
		let r = e, o = f(null), s = i(() => r.modelValue.endsWith("\n") ? r.modelValue.slice(0, -1) : r.modelValue), c = i(() => n(s.value, r.language)), l = i(() => r.modelValue.split("\n").length);
		return t({
			resetScroll: () => o.value?.resetScroll(),
			locate: (e) => o.value?.locate(e)
		}), (t, n) => (d(), a(w, {
			ref_key: "paneRef",
			ref: o,
			"model-value": e.modelValue,
			highlighted: c.value,
			"line-count": l.value,
			markers: e.markers,
			"onUpdate:modelValue": n[0] ||= (e) => t.$emit("update:modelValue", e),
			onSymbol: n[1] ||= (e) => t.$emit("symbol", e),
			onMenu: n[2] ||= (e) => t.$emit("menu", e),
			onRename: n[3] ||= (e) => t.$emit("rename", e),
			onCaret: n[4] ||= (e) => t.$emit("caret", e),
			onEdit: n[5] ||= (e) => t.$emit("edit")
		}, null, 8, [
			"model-value",
			"highlighted",
			"line-count",
			"markers"
		]));
	}
};
export { T as t };
