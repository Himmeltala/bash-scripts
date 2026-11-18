import { t as e } from "./_plugin-vue_export-helper.js";
import { highlightCode as t } from "./highlight.js";
import { Fragment as n, computed as r, createBlock as i, createElementBlock as a, createElementVNode as o, nextTick as s, normalizeStyle as c, openBlock as l, ref as u, renderList as d, toDisplayString as f, vShow as p, withDirectives as m, withKeys as h, withModifiers as g } from "vue";
// src/utils/commons/codeSymbol.js
var _ = /[\p{L}\p{N}_$@]/u;
function v(e, t) {
	let n = String(e ?? "");
	if (!Number.isInteger(t) || t < 0 || t > n.length) return null;
	let r = t;
	if (r >= n.length || !_.test(n[r])) {
		let e = n[r];
		if (e !== void 0 && !/\s/.test(e)) return null;
		--r;
	}
	if (r < 0 || !_.test(n[r])) return null;
	let i = r, a = r + 1;
	for (; i > 0 && _.test(n[i - 1]);) --i;
	for (; a < n.length && _.test(n[a]);) a += 1;
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
var y = { class: "edit-body" }, b = { class: "edit-stage" }, x = {
	class: "layer-code",
	"aria-hidden": "true"
}, S = ["innerHTML"], C = ["value", "onKeydown"], w = /*#__PURE__*/ e({
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
	emits: [
		"update:modelValue",
		"symbol",
		"menu",
		"rename",
		"caret"
	],
	setup(e, { expose: t, emit: i }) {
		let _ = e, w = i, T = u(null), E = u(null), D = u(null), O = u(!1), k = u(0), A = u(0), j = u(20), M = u(10), N = r(() => ({
			top: `${M.value + k.value * j.value - A.value}px`,
			height: `${j.value}px`
		}));
		function P() {
			let e = D.value;
			if (!e) return;
			let t = getComputedStyle(e);
			j.value = parseFloat(t.lineHeight) || 20, M.value = parseFloat(t.paddingTop) || 10;
		}
		function F() {
			let e = D.value;
			if (!e) return;
			let t = e.selectionDirection === "backward" ? e.selectionStart : e.selectionEnd, n = e.value.slice(0, t), r = 0;
			for (let e = 0; e < n.length; e += 1) n.charCodeAt(e) === 10 && (r += 1);
			k.value = r, A.value = e.scrollTop;
			let i = n.lastIndexOf("\n") + 1;
			w("caret", {
				line: r + 1,
				column: t - i + 1
			});
		}
		function I() {
			P(), O.value = !0, F();
		}
		function L(e) {
			w("update:modelValue", e.target.value), F();
		}
		function R(e) {
			if (!(e.ctrlKey || e.metaKey) || e.button !== 0) return;
			let t = D.value;
			if (!t) return;
			let n = v(t.value, t.selectionStart);
			n && (e.preventDefault(), w("symbol", n));
		}
		function z(e) {
			let t = D.value;
			if (!t) return;
			let n = v(t.value, t.selectionStart);
			n && (e.preventDefault(), w("menu", {
				...n,
				x: e.clientX,
				y: e.clientY
			}));
		}
		function B(e) {
			if (e.key !== "F2") return;
			let t = D.value;
			if (!t) return;
			let n = v(t.value, t.selectionStart);
			n && (e.preventDefault(), w("rename", n));
		}
		function V(e) {
			E.value && (E.value.style.transform = `translate(${-e.scrollLeft}px, ${-e.scrollTop}px)`), T.value && (T.value.scrollTop = e.scrollTop);
		}
		function H(e) {
			V(e.target), A.value = e.target.scrollTop;
		}
		function U(e) {
			let t = e.target, n = t.selectionStart, r = t.selectionEnd;
			w("update:modelValue", `${_.modelValue.slice(0, n)}    ${_.modelValue.slice(r)}`), s(() => {
				t.selectionStart = n + 4, t.selectionEnd = n + 4, F();
			});
		}
		function W() {
			let e = D.value;
			e && (e.scrollTop = 0, e.scrollLeft = 0, V(e), k.value = 0, A.value = 0);
		}
		async function G(e) {
			await s();
			let t = D.value;
			if (!t) return;
			let n = _.modelValue.split("\n"), r = Math.min(Math.max(Number(e) || 1, 1), n.length), i = 0;
			for (let e = 0; e < r - 1; e += 1) i += n[e].length + 1;
			t.focus(), t.setSelectionRange(i, i + n[r - 1].length);
			let a = parseFloat(getComputedStyle(t).lineHeight) || 20;
			t.scrollTop = Math.max(0, (r - 1) * a - t.clientHeight / 3), V(t), P(), O.value = !0, F();
		}
		return t({
			resetScroll: W,
			locate: G
		}), (t, r) => (l(), a("div", y, [o("div", {
			ref_key: "gutterRef",
			ref: T,
			class: "gutter",
			"aria-hidden": "true"
		}, [(l(!0), a(n, null, d(e.lineCount, (e) => (l(), a("div", {
			key: e,
			class: "ln"
		}, f(e), 1))), 128))], 512), o("div", b, [
			m(o("div", {
				class: "cur-line",
				style: c(N.value),
				"aria-hidden": "true"
			}, null, 4), [[p, O.value]]),
			o("pre", x, [o("code", {
				ref_key: "codeRef",
				ref: E,
				innerHTML: e.highlighted
			}, null, 8, S)]),
			o("textarea", {
				ref_key: "editorRef",
				ref: D,
				value: e.modelValue,
				class: "editor",
				wrap: "off",
				spellcheck: "false",
				onInput: L,
				onScroll: H,
				onKeydown: [h(g(U, ["prevent"]), ["tab"]), B],
				onKeyup: F,
				onMouseup: F,
				onFocus: I,
				onBlur: r[0] ||= (e) => O.value = !1,
				onClick: R,
				onContextmenu: z
			}, null, 40, C)
		])]));
	}
}, [["__scopeId", "data-v-f7f992f9"]]), T = {
	__name: "TextEditor",
	props: {
		modelValue: {
			type: String,
			default: ""
		},
		language: {
			type: String,
			default: ""
		}
	},
	emits: [
		"update:modelValue",
		"symbol",
		"menu",
		"rename",
		"caret"
	],
	setup(e, { expose: n }) {
		let a = e, o = u(null), s = r(() => a.modelValue.endsWith("\n") ? a.modelValue.slice(0, -1) : a.modelValue), c = r(() => t(s.value, a.language)), d = r(() => a.modelValue.split("\n").length);
		return n({
			resetScroll: () => o.value?.resetScroll(),
			locate: (e) => o.value?.locate(e)
		}), (t, n) => (l(), i(w, {
			ref_key: "paneRef",
			ref: o,
			"model-value": e.modelValue,
			highlighted: c.value,
			"line-count": d.value,
			"onUpdate:modelValue": n[0] ||= (e) => t.$emit("update:modelValue", e),
			onSymbol: n[1] ||= (e) => t.$emit("symbol", e),
			onMenu: n[2] ||= (e) => t.$emit("menu", e),
			onRename: n[3] ||= (e) => t.$emit("rename", e),
			onCaret: n[4] ||= (e) => t.$emit("caret", e)
		}, null, 8, [
			"model-value",
			"highlighted",
			"line-count"
		]));
	}
};
export { T as t };
