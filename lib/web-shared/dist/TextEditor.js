import { t as e } from "./_plugin-vue_export-helper.js";
import { highlightCode as t } from "./highlight.js";
import { Fragment as n, computed as r, createBlock as i, createElementBlock as a, createElementVNode as o, nextTick as s, normalizeClass as c, normalizeStyle as l, openBlock as u, ref as d, renderList as f, toDisplayString as p, vShow as m, withDirectives as h, withKeys as g, withModifiers as _ } from "vue";
// src/utils/commons/codeSymbol.js
var v = /[\p{L}\p{N}_$@]/u;
function y(e, t) {
	let n = String(e ?? "");
	if (!Number.isInteger(t) || t < 0 || t > n.length) return null;
	let r = t;
	if (r >= n.length || !v.test(n[r])) {
		let e = n[r];
		if (e !== void 0 && !/\s/.test(e)) return null;
		--r;
	}
	if (r < 0 || !v.test(n[r])) return null;
	let i = r, a = r + 1;
	for (; i > 0 && v.test(n[i - 1]);) --i;
	for (; a < n.length && v.test(n[a]);) a += 1;
	let o = n.slice(i, a);
	if (!o) return null;
	let s = 0, c = 0;
	for (let e = 0; e < i; e += 1) n[e] === "\n" && (s += 1, c = e + 1);
	return {
		word: o,
		line: s,
		character: i - c
	};
}
// src/components/commons/FileEditor/widgets/EditorPane.vue
var b = { class: "edit-body" }, x = { class: "edit-stage" }, S = {
	class: "layer-code",
	"aria-hidden": "true"
}, C = ["innerHTML"], w = ["value", "onKeydown"], T = /*#__PURE__*/ e({
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
	setup(e, { expose: t, emit: i }) {
		let v = e, T = i, E = d(null), D = d(null), O = d(null), k = d(!1), A = d(0), j = d(0), M = d(20), N = d(10), P = r(() => ({
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
			let t = v.markers ? v.markers[e] : "";
			return t === "error" ? "has-error" : t === "warning" ? "has-warning" : t === "info" || t === "hint" ? "has-info" : "";
		}
		function B(e) {
			if (!(e.ctrlKey || e.metaKey) || e.button !== 0) return;
			let t = O.value;
			if (!t) return;
			let n = y(t.value, t.selectionStart);
			n && (e.preventDefault(), T("symbol", n));
		}
		function V(e) {
			let t = O.value;
			if (!t) return;
			let n = y(t.value, t.selectionStart);
			n && (e.preventDefault(), T("menu", {
				...n,
				x: e.clientX,
				y: e.clientY
			}));
		}
		function H(e) {
			if (e.key !== "F2") return;
			let t = O.value;
			if (!t) return;
			let n = y(t.value, t.selectionStart);
			n && (e.preventDefault(), T("rename", n));
		}
		function U(e) {
			D.value && (D.value.style.transform = `translate(${-e.scrollLeft}px, ${-e.scrollTop}px)`), E.value && (E.value.scrollTop = e.scrollTop);
		}
		function W(e) {
			U(e.target), j.value = e.target.scrollTop;
		}
		function G(e) {
			let t = e.target, n = t.selectionStart, r = t.selectionEnd;
			T("update:modelValue", `${v.modelValue.slice(0, n)}    ${v.modelValue.slice(r)}`), s(() => {
				t.selectionStart = n + 4, t.selectionEnd = n + 4, I();
			});
		}
		function K() {
			let e = O.value;
			e && (e.scrollTop = 0, e.scrollLeft = 0, U(e), A.value = 0, j.value = 0);
		}
		async function q(e) {
			await s();
			let t = O.value;
			if (!t) return;
			let n = v.modelValue.split("\n"), r = Math.min(Math.max(Number(e) || 1, 1), n.length), i = 0;
			for (let e = 0; e < r - 1; e += 1) i += n[e].length + 1;
			t.focus(), t.setSelectionRange(i, i + n[r - 1].length);
			let a = parseFloat(getComputedStyle(t).lineHeight) || 20;
			t.scrollTop = Math.max(0, (r - 1) * a - t.clientHeight / 3), U(t), F(), k.value = !0, I();
		}
		return t({
			resetScroll: K,
			locate: q
		}), (t, r) => (u(), a("div", b, [o("div", {
			ref_key: "gutterRef",
			ref: E,
			class: "gutter",
			"aria-hidden": "true"
		}, [(u(!0), a(n, null, f(e.lineCount, (e) => (u(), a("div", {
			key: e,
			class: c(["ln", z(e)])
		}, p(e), 3))), 128))], 512), o("div", x, [
			h(o("div", {
				class: "cur-line",
				style: l(P.value),
				"aria-hidden": "true"
			}, null, 4), [[m, k.value]]),
			o("pre", S, [o("code", {
				ref_key: "codeRef",
				ref: D,
				innerHTML: e.highlighted
			}, null, 8, C)]),
			o("textarea", {
				ref_key: "editorRef",
				ref: O,
				value: e.modelValue,
				class: "editor",
				wrap: "off",
				spellcheck: "false",
				onInput: R,
				onScroll: W,
				onKeydown: [g(_(G, ["prevent"]), ["tab"]), H],
				onKeyup: I,
				onMouseup: I,
				onFocus: L,
				onBlur: r[0] ||= (e) => k.value = !1,
				onClick: B,
				onContextmenu: V
			}, null, 40, w)
		])]));
	}
}, [["__scopeId", "data-v-d23ded23"]]), E = {
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
	setup(e, { expose: n }) {
		let a = e, o = d(null), s = r(() => a.modelValue.endsWith("\n") ? a.modelValue.slice(0, -1) : a.modelValue), c = r(() => t(s.value, a.language)), l = r(() => a.modelValue.split("\n").length);
		return n({
			resetScroll: () => o.value?.resetScroll(),
			locate: (e) => o.value?.locate(e)
		}), (t, n) => (u(), i(T, {
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
export { E as t };
