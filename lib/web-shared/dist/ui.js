import { t as e } from "./_plugin-vue_export-helper-Djzt4Yr7.js";
import { createBlock as t, createCommentVNode as n, createElementBlock as r, createTextVNode as i, createVNode as a, normalizeStyle as o, openBlock as s, reactive as c, renderSlot as l, resolveComponent as u, toDisplayString as d, withCtx as f } from "vue";
// src/components/EmptyState.vue
var p = {
	key: 0,
	class: "empty-state-title"
}, m = {
	key: 1,
	class: "empty-state-hint"
}, h = /*#__PURE__*/ e({
	__name: "EmptyState",
	props: {
		icon: {
			type: String,
			default: "mdi-view-dashboard-outline"
		},
		title: {
			type: String,
			default: ""
		},
		hint: {
			type: String,
			default: ""
		},
		action: {
			type: String,
			default: ""
		},
		actionIcon: {
			type: String,
			default: "mdi-folder-plus"
		},
		hintWidth: {
			type: Number,
			default: 460
		}
	},
	emits: ["action"],
	setup(e) {
		return (c, h) => {
			let g = u("v-icon"), _ = u("v-btn");
			return s(), r("div", {
				class: "empty-state",
				style: o({ "--empty-hint-width": `${e.hintWidth}px` })
			}, [
				a(g, {
					size: "56",
					color: "on-surface-variant"
				}, {
					default: f(() => [i(d(e.icon), 1)]),
					_: 1
				}),
				e.title ? (s(), r("p", p, d(e.title), 1)) : n("", !0),
				e.hint ? (s(), r("p", m, d(e.hint), 1)) : n("", !0),
				l(c.$slots, "actions", {}, () => [e.action ? (s(), t(_, {
					key: 0,
					color: "primary",
					variant: "flat",
					"prepend-icon": e.actionIcon,
					onClick: h[0] ||= (e) => c.$emit("action")
				}, {
					default: f(() => [i(d(e.action), 1)]),
					_: 1
				}, 8, ["prepend-icon"])) : n("", !0)], !0),
				l(c.$slots, "default", {}, void 0, !0)
			], 4);
		};
	}
}, [["__scopeId", "data-v-747b1a8f"]]), g = {
	__name: "ToastHost",
	props: {
		modelValue: {
			type: Boolean,
			default: !1
		},
		text: {
			type: String,
			default: ""
		},
		color: {
			type: String,
			default: "grey"
		},
		timeout: {
			type: [Number, String],
			default: 4e3
		}
	},
	emits: ["update:modelValue"],
	setup(e) {
		return (n, r) => {
			let a = u("v-snackbar");
			return s(), t(a, {
				"model-value": e.modelValue,
				color: e.color,
				timeout: e.timeout,
				location: "bottom right",
				"onUpdate:modelValue": r[0] ||= (e) => n.$emit("update:modelValue", e)
			}, {
				default: f(() => [i(d(e.text), 1)]),
				_: 1
			}, 8, [
				"model-value",
				"color",
				"timeout"
			]);
		};
	}
};
// src/composables/useToast.js
function _(e = "grey") {
	let t = c({
		on: !1,
		text: "",
		color: e
	});
	function n(n, r = e) {
		t.text = n, t.color = r, t.on = !0;
	}
	function r() {
		t.on = !1;
	}
	return {
		snack: t,
		toast: n,
		close: r
	};
}
export { h as EmptyState, g as ToastHost, _ as useToast };
