import { t as e } from "./_plugin-vue_export-helper.js";
import { computed as t, createBlock as n, createCommentVNode as r, createElementVNode as i, createTextVNode as a, createVNode as o, normalizeClass as s, onBeforeUnmount as c, openBlock as l, reactive as u, ref as d, renderSlot as f, resolveComponent as p, toDisplayString as m, watch as h, withCtx as g } from "vue";
// src/composables/commons/useDialogLayout.js
function _(e) {
	function t() {
		try {
			let t = JSON.parse(window.localStorage.getItem(e) || "{}");
			return t && typeof t == "object" ? t : {};
		} catch {
			return {};
		}
	}
	function n(e) {
		if (!e) return null;
		let n = t()[e];
		return n && [
			"x",
			"y",
			"w",
			"h"
		].every((e) => Number.isFinite(n[e])) ? {
			x: n.x,
			y: n.y,
			w: n.w,
			h: n.h
		} : null;
	}
	function r(n, r) {
		if (n) try {
			window.localStorage.setItem(e, JSON.stringify({
				...t(),
				[n]: r
			}));
		} catch {}
	}
	return {
		get: n,
		remember: r
	};
}
var v = /*#__PURE__*/ e({
	__name: "FloatingDialog",
	props: {
		modelValue: {
			type: Boolean,
			default: !1
		},
		initialWidth: {
			type: Number,
			default: 760
		},
		initialHeight: {
			type: Number,
			default: 620
		},
		minWidth: {
			type: Number,
			default: 480
		},
		minHeight: {
			type: Number,
			default: 380
		},
		storageKey: {
			type: String,
			default: ""
		},
		storage: {
			type: String,
			default: "dialog-layouts"
		},
		persistent: {
			type: Boolean,
			default: !1
		}
	},
	emits: ["update:modelValue"],
	setup(e, { emit: a }) {
		let u = e, m = a, v = _(u.storage), y = v.get(u.storageKey), b = d(y ? {
			w: y.w,
			h: y.h
		} : D()), x = d(y ? {
			x: y.x,
			y: y.y
		} : {
			x: 0,
			y: 0
		}), S = d(!!y), C = d(!1), w = null, T = t(() => ({
			position: "fixed",
			left: `${x.value.x}px`,
			top: `${x.value.y}px`,
			margin: "0"
		}));
		function E(e, t, n) {
			return Math.min(Math.max(e, t), n);
		}
		function D() {
			return {
				w: Math.min(u.initialWidth, Math.max(u.minWidth, window.innerWidth - 48)),
				h: Math.min(u.initialHeight, Math.max(u.minHeight, window.innerHeight - 48))
			};
		}
		function O() {
			x.value = {
				x: Math.max(0, Math.round((window.innerWidth - b.value.w) / 2)),
				y: Math.max(0, Math.round((window.innerHeight - b.value.h) / 2))
			};
		}
		function k() {
			x.value = {
				x: E(x.value.x, 0, Math.max(0, window.innerWidth - b.value.w)),
				y: E(x.value.y, 0, Math.max(0, window.innerHeight - b.value.h))
			};
		}
		h(() => u.modelValue, (e) => {
			e && (b.value = {
				w: E(b.value.w, u.minWidth, Math.max(u.minWidth, window.innerWidth - 48)),
				h: E(b.value.h, u.minHeight, Math.max(u.minHeight, window.innerHeight - 48))
			}, S.value ? k() : O());
		}, { immediate: !0 });
		function A(e) {
			e.button === 0 && (e.target.closest("button, a, input, textarea, select, [role=\"button\"]") || (e.preventDefault(), M("move", e)));
		}
		function j(e) {
			e.button === 0 && (e.preventDefault(), M("resize", e));
		}
		function M(e, t) {
			w = {
				mode: e,
				x: t.clientX,
				y: t.clientY,
				px: x.value.x,
				py: x.value.y,
				w: b.value.w,
				h: b.value.h
			}, C.value = !0, document.body.style.userSelect = "none", window.addEventListener("pointermove", N), window.addEventListener("pointerup", P, { once: !0 });
		}
		function N(e) {
			if (!w) return;
			let t = e.clientX - w.x, n = e.clientY - w.y;
			if (S.value = !0, w.mode === "move") {
				x.value = {
					x: E(w.px + t, 0, Math.max(0, window.innerWidth - b.value.w)),
					y: E(w.py + n, 0, Math.max(0, window.innerHeight - b.value.h))
				};
				return;
			}
			let r = Math.max(u.minWidth, Math.min(window.innerWidth - 48, window.innerWidth - x.value.x)), i = Math.max(u.minHeight, Math.min(window.innerHeight - 48, window.innerHeight - x.value.y));
			b.value = {
				w: E(w.w + t, u.minWidth, r),
				h: E(w.h + n, u.minHeight, i)
			};
		}
		function P() {
			let e = w !== null;
			w = null, C.value = !1, document.body.style.userSelect = "", window.removeEventListener("pointermove", N), e && F();
		}
		function F() {
			v.remember(u.storageKey, {
				x: x.value.x,
				y: x.value.y,
				w: b.value.w,
				h: b.value.h
			});
		}
		function I() {
			S.value = !1, O(), F();
		}
		return c(P), (t, a) => {
			let c = p("v-card-title"), u = p("v-card-text"), d = p("v-card-actions"), h = p("v-card"), _ = p("v-dialog");
			return l(), n(_, {
				"model-value": e.modelValue,
				width: b.value.w,
				height: b.value.h,
				"content-props": { style: T.value },
				persistent: e.persistent,
				scrollable: "",
				"onUpdate:modelValue": a[0] ||= (e) => m("update:modelValue", e)
			}, {
				default: g(() => [o(h, { class: s(["dialog", { moving: C.value }]) }, {
					default: g(() => [
						o(c, {
							class: "title d-flex align-center",
							title: "拖动标题移动窗口，双击回到屏幕中间",
							onPointerdown: A,
							onDblclick: I
						}, {
							default: g(() => [f(t.$slots, "title", {}, void 0, !0)]),
							_: 3
						}),
						o(u, { class: "body" }, {
							default: g(() => [f(t.$slots, "default", {}, void 0, !0)]),
							_: 3
						}),
						t.$slots.actions ? (l(), n(d, { key: 0 }, {
							default: g(() => [f(t.$slots, "actions", {}, void 0, !0)]),
							_: 3
						})) : r("", !0),
						i("span", {
							class: "resize-grip",
							title: "拖动调整窗口大小",
							onPointerdown: j
						}, null, 32)
					]),
					_: 3
				}, 8, ["class"])]),
				_: 3
			}, 8, [
				"model-value",
				"width",
				"height",
				"content-props",
				"persistent"
			]);
		};
	}
}, [["__scopeId", "data-v-0c218dc6"]]), y = {
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
		return (t, r) => {
			let i = p("v-snackbar");
			return l(), n(i, {
				"model-value": e.modelValue,
				color: e.color,
				timeout: e.timeout,
				location: "bottom right",
				"onUpdate:modelValue": r[0] ||= (e) => t.$emit("update:modelValue", e)
			}, {
				default: g(() => [a(m(e.text), 1)]),
				_: 1
			}, 8, [
				"model-value",
				"color",
				"timeout"
			]);
		};
	}
};
// src/composables/commons/useToast.js
function b(e = "grey") {
	let t = u({
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
export { y as n, v as r, b as t };
