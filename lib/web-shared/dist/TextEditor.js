import { t as e } from "./_plugin-vue_export-helper.js";
import { highlightCode as t } from "./highlight.js";
import { Fragment as n, computed as r, createBlock as i, createElementBlock as a, createElementVNode as o, nextTick as s, normalizeStyle as c, openBlock as l, ref as u, renderList as d, toDisplayString as f, vShow as p, withDirectives as m, withKeys as h, withModifiers as g } from "vue";
// src/components/FileEditor/widgets/EditorPane.vue
var _ = { class: "edit-body" }, v = { class: "edit-stage" }, y = {
	class: "layer-code",
	"aria-hidden": "true"
}, b = ["innerHTML"], x = ["value", "onKeydown"], S = /*#__PURE__*/ e({
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
	setup(e, { expose: t, emit: i }) {
		let S = e, C = i, w = u(null), T = u(null), E = u(null), D = u(!1), O = u(0), k = u(0), A = u(20), j = u(10), M = r(() => ({
			top: `${j.value + O.value * A.value - k.value}px`,
			height: `${A.value}px`
		}));
		function N() {
			let e = E.value;
			if (!e) return;
			let t = getComputedStyle(e);
			A.value = parseFloat(t.lineHeight) || 20, j.value = parseFloat(t.paddingTop) || 10;
		}
		function P() {
			let e = E.value;
			if (!e) return;
			let t = e.selectionDirection === "backward" ? e.selectionStart : e.selectionEnd, n = e.value.slice(0, t), r = 0;
			for (let e = 0; e < n.length; e += 1) n.charCodeAt(e) === 10 && (r += 1);
			O.value = r, k.value = e.scrollTop;
		}
		function F() {
			N(), D.value = !0, P();
		}
		function I(e) {
			C("update:modelValue", e.target.value), P();
		}
		function L(e) {
			T.value && (T.value.style.transform = `translate(${-e.scrollLeft}px, ${-e.scrollTop}px)`), w.value && (w.value.scrollTop = e.scrollTop);
		}
		function R(e) {
			L(e.target), k.value = e.target.scrollTop;
		}
		function z(e) {
			let t = e.target, n = t.selectionStart, r = t.selectionEnd;
			C("update:modelValue", `${S.modelValue.slice(0, n)}    ${S.modelValue.slice(r)}`), s(() => {
				t.selectionStart = n + 4, t.selectionEnd = n + 4, P();
			});
		}
		function B() {
			let e = E.value;
			e && (e.scrollTop = 0, e.scrollLeft = 0, L(e), O.value = 0, k.value = 0);
		}
		async function V(e) {
			await s();
			let t = E.value;
			if (!t) return;
			let n = S.modelValue.split("\n"), r = Math.min(Math.max(Number(e) || 1, 1), n.length), i = 0;
			for (let e = 0; e < r - 1; e += 1) i += n[e].length + 1;
			t.focus(), t.setSelectionRange(i, i + n[r - 1].length);
			let a = parseFloat(getComputedStyle(t).lineHeight) || 20;
			t.scrollTop = Math.max(0, (r - 1) * a - t.clientHeight / 3), L(t), N(), D.value = !0, P();
		}
		return t({
			resetScroll: B,
			locate: V
		}), (t, r) => (l(), a("div", _, [o("div", {
			ref_key: "gutterRef",
			ref: w,
			class: "gutter",
			"aria-hidden": "true"
		}, [(l(!0), a(n, null, d(e.lineCount, (e) => (l(), a("div", {
			key: e,
			class: "ln"
		}, f(e), 1))), 128))], 512), o("div", v, [
			m(o("div", {
				class: "cur-line",
				style: c(M.value),
				"aria-hidden": "true"
			}, null, 4), [[p, D.value]]),
			o("pre", y, [o("code", {
				ref_key: "codeRef",
				ref: T,
				innerHTML: e.highlighted
			}, null, 8, b)]),
			o("textarea", {
				ref_key: "editorRef",
				ref: E,
				value: e.modelValue,
				class: "editor",
				wrap: "off",
				spellcheck: "false",
				onInput: I,
				onScroll: R,
				onKeydown: h(g(z, ["prevent"]), ["tab"]),
				onKeyup: P,
				onMouseup: P,
				onFocus: F,
				onBlur: r[0] ||= (e) => D.value = !1
			}, null, 40, x)
		])]));
	}
}, [["__scopeId", "data-v-9cecb1f1"]]), C = {
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
	emits: ["update:modelValue"],
	setup(e, { expose: n }) {
		let a = e, o = u(null), s = r(() => a.modelValue.endsWith("\n") ? a.modelValue.slice(0, -1) : a.modelValue), c = r(() => t(s.value, a.language)), d = r(() => a.modelValue.split("\n").length);
		return n({
			resetScroll: () => o.value?.resetScroll(),
			locate: (e) => o.value?.locate(e)
		}), (t, n) => (l(), i(S, {
			ref_key: "paneRef",
			ref: o,
			"model-value": e.modelValue,
			highlighted: c.value,
			"line-count": d.value,
			"onUpdate:modelValue": n[0] ||= (e) => t.$emit("update:modelValue", e)
		}, null, 8, [
			"model-value",
			"highlighted",
			"line-count"
		]));
	}
};
export { C as t };
