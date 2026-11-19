import { n as e, t } from "./SplitHandle.js";
import { t as n } from "./_plugin-vue_export-helper.js";
import { createCommentVNode as r, createElementBlock as i, createVNode as a, openBlock as o, resolveComponent as s, toDisplayString as c } from "vue";
// src/layouts/commons/LoadingState.vue
var l = { class: "loading-state" }, u = {
	key: 0,
	class: "loading-state-hint"
}, d = /*#__PURE__*/ n({
	__name: "LoadingState",
	props: {
		hint: {
			type: String,
			default: "正在加载…"
		},
		size: {
			type: Number,
			default: 36
		},
		width: {
			type: Number,
			default: 3
		}
	},
	setup(e) {
		return (t, n) => {
			let d = s("v-progress-circular");
			return o(), i("div", l, [a(d, {
				indeterminate: "",
				size: e.size,
				width: e.width,
				color: "primary"
			}, null, 8, ["size", "width"]), e.hint ? (o(), i("p", u, c(e.hint), 1)) : r("", !0)]);
		};
	}
}, [["__scopeId", "data-v-56d2db02"]]);
export { e as EmptyState, d as LoadingState, t as SplitHandle };
