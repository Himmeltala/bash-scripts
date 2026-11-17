import { t as e } from "./_plugin-vue_export-helper.js";
import { createBlock as t, createCommentVNode as n, createElementBlock as r, createElementVNode as i, createTextVNode as a, createVNode as o, normalizeClass as s, normalizeStyle as c, openBlock as l, renderSlot as u, resolveComponent as d, toDisplayString as f, withCtx as p } from "vue";
// src/layouts/commons/EmptyState.vue
var m = {
	key: 0,
	class: "empty-state-title"
}, h = ["title"], g = {
	key: 2,
	class: "empty-state-hint"
}, _ = /*#__PURE__*/ e({
	__name: "EmptyState",
	props: {
		icon: {
			type: String,
			default: "mdi-view-dashboard-outline"
		},
		iconSize: {
			type: Number,
			default: 56
		},
		title: {
			type: String,
			default: ""
		},
		path: {
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
		return (i, s) => {
			let _ = d("v-icon"), v = d("v-btn");
			return l(), r("div", {
				class: "empty-state",
				style: c({ "--empty-hint-width": `${e.hintWidth}px` })
			}, [
				o(_, {
					size: e.iconSize,
					color: "on-surface-variant"
				}, {
					default: p(() => [a(f(e.icon), 1)]),
					_: 1
				}, 8, ["size"]),
				e.title ? (l(), r("p", m, f(e.title), 1)) : n("", !0),
				e.path ? (l(), r("div", {
					key: 1,
					class: "empty-state-path mono",
					title: e.path
				}, f(e.path), 9, h)) : n("", !0),
				e.hint ? (l(), r("p", g, f(e.hint), 1)) : n("", !0),
				u(i.$slots, "actions", {}, () => [e.action ? (l(), t(v, {
					key: 0,
					color: "primary",
					variant: "flat",
					"prepend-icon": e.actionIcon,
					onClick: s[0] ||= (e) => i.$emit("action")
				}, {
					default: p(() => [a(f(e.action), 1)]),
					_: 1
				}, 8, ["prepend-icon"])) : n("", !0)], !0),
				u(i.$slots, "default", {}, void 0, !0)
			], 4);
		};
	}
}, [["__scopeId", "data-v-06555845"]]), v = ["title"], y = /*#__PURE__*/ e({
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
		let n = e, a = t;
		function o(e) {
			n.disabled || a("start", e);
		}
		function c() {
			n.disabled || a("reset");
		}
		return (t, n) => (l(), r("div", {
			class: s(["handle", [e.axis, {
				active: !e.disabled && e.active,
				disabled: e.disabled
			}]]),
			title: e.disabled ? "" : e.title,
			onPointerdown: o,
			onDblclick: c
		}, [...n[0] ||= [i("span", { class: "grip" }, null, -1)]], 42, v));
	}
}, [["__scopeId", "data-v-21babece"]]);
export { _ as n, y as t };
