import { t as e } from "./_plugin-vue_export-helper-Djzt4Yr7.js";
import { computed as t, createBlock as n, createElementBlock as r, createElementVNode as i, createVNode as a, normalizeClass as o, onBeforeUnmount as s, onMounted as c, openBlock as l, ref as u, toDisplayString as d, watch as f } from "vue";
import { init as p, use as m } from "echarts/core";
import { LineChart as h } from "echarts/charts";
import { GridComponent as g, TooltipComponent as _ } from "echarts/components";
import { CanvasRenderer as v } from "echarts/renderers";
// src/components/Metrics/palette.js
var y = {
	light: {
		cpu: "#2563eb",
		mem: "#0d9488",
		disk: "#b45309",
		tip: "#ffffff",
		tipText: "#1d2129"
	},
	dark: {
		cpu: "#60a5fa",
		mem: "#2dd4bf",
		disk: "#fbbf24",
		tip: "#262a30",
		tipText: "#e5e7eb"
	}
}, b = ["title"], x = { class: "line" }, S = { class: "name" }, C = /*#__PURE__*/ e({
	__name: "MetricSparkline",
	props: {
		name: {
			type: String,
			required: !0
		},
		title: {
			type: String,
			default: ""
		},
		value: {
			type: Number,
			default: null
		},
		time: {
			type: Number,
			default: null
		},
		color: {
			type: String,
			default: "cpu"
		},
		hot: {
			type: Number,
			default: 85
		},
		dark: {
			type: Boolean,
			default: !1
		},
		points: {
			type: Number,
			default: 60
		}
	},
	setup(e) {
		m([
			h,
			g,
			_,
			v
		]);
		let n = e, a = u(null), C = u(null), w = u("--"), T = [], E = [], D = null, O = null, k = t(() => C.value !== null && C.value >= n.hot);
		function A() {
			return y[n.dark ? "dark" : "light"];
		}
		function j() {
			let e = A(), t = e[n.color] || n.color || e.cpu;
			return {
				animation: !1,
				grid: {
					left: 1,
					right: 1,
					top: 3,
					bottom: 1
				},
				xAxis: {
					type: "category",
					show: !1,
					boundaryGap: !1,
					data: E.slice()
				},
				yAxis: {
					type: "value",
					show: !1,
					min: 0,
					max: 100
				},
				tooltip: {
					trigger: "axis",
					confine: !0,
					backgroundColor: e.tip,
					borderWidth: 0,
					padding: [4, 8],
					textStyle: {
						color: e.tipText,
						fontSize: 12,
						fontFamily: "Roboto, sans-serif"
					},
					formatter: (e) => `${n.name} ${e[0].axisValue}　${e[0].value}%`
				},
				series: [{
					type: "line",
					data: T.slice(),
					showSymbol: !1,
					smooth: .25,
					lineStyle: {
						width: 1.5,
						color: t
					},
					areaStyle: {
						opacity: .16,
						color: t
					}
				}]
			};
		}
		function M() {
			let e = a.value;
			e && e.clientWidth && (D && D.dispose(), D = p(e, null, { renderer: "canvas" }), D.setOption(j()));
		}
		function N(e) {
			return (/* @__PURE__ */ new Date(e * 1e3)).toLocaleTimeString("zh-CN", { hour12: !1 });
		}
		return f(() => [n.time, n.value], ([e, t]) => {
			e && (typeof t == "number" ? (C.value = t, w.value = `${Math.round(t)}%`, T.push(t), E.push(N(e)), T.length > n.points && (T.shift(), E.shift()), D && D.setOption({
				xAxis: { data: E.slice() },
				series: [{ data: T.slice() }]
			})) : (C.value = null, w.value = "--"));
		}, { immediate: !0 }), c(() => {
			O = new ResizeObserver(() => {
				let e = a.value;
				e && e.clientWidth && (D ? D.resize() : M());
			}), a.value && O.observe(a.value);
		}), s(() => {
			O && O.disconnect(), D && D.dispose();
		}), f(() => n.dark, () => {
			D && D.setOption(j(), !0);
		}), (t, n) => (l(), r("div", {
			class: "metric-cell",
			title: e.title
		}, [i("div", x, [i("span", S, d(e.name), 1), i("span", { class: o(["value", { hot: k.value }]) }, d(w.value), 3)]), i("div", {
			ref_key: "boxRef",
			ref: a,
			class: "chart"
		}, null, 512)], 8, b));
	}
}, [["__scopeId", "data-v-2fa7f4fa"]]), w = {
	__name: "MetricCpu",
	props: {
		dark: {
			type: Boolean,
			default: !1
		},
		metrics: {
			type: Object,
			default: null
		}
	},
	setup(e) {
		let r = e, i = t(() => r.metrics && typeof r.metrics.cpu == "number" ? r.metrics.cpu : null), a = t(() => r.metrics ? r.metrics.time : null);
		return (t, r) => (l(), n(C, {
			name: "CPU",
			title: "CPU 占用",
			color: "cpu",
			dark: e.dark,
			value: i.value,
			time: a.value
		}, null, 8, [
			"dark",
			"value",
			"time"
		]));
	}
}, T = {
	__name: "MetricDisk",
	props: {
		dark: {
			type: Boolean,
			default: !1
		},
		metrics: {
			type: Object,
			default: null
		}
	},
	setup(e) {
		let r = e, i = t(() => {
			let e = r.metrics && r.metrics.disk;
			return e && typeof e.percent == "number" ? e.percent : null;
		}), a = t(() => r.metrics ? r.metrics.time : null), o = t(() => {
			let e = r.metrics && r.metrics.disk;
			return e && e.mount ? `磁盘占用（${e.mount}）` : "磁盘占用";
		});
		return (t, r) => (l(), n(C, {
			name: "磁盘",
			title: o.value,
			color: "disk",
			dark: e.dark,
			value: i.value,
			time: a.value
		}, null, 8, [
			"title",
			"dark",
			"value",
			"time"
		]));
	}
}, E = {
	__name: "MetricMemory",
	props: {
		dark: {
			type: Boolean,
			default: !1
		},
		metrics: {
			type: Object,
			default: null
		}
	},
	setup(e) {
		let r = e, i = t(() => {
			let e = r.metrics && r.metrics.mem;
			return e && typeof e.percent == "number" ? e.percent : null;
		}), a = t(() => r.metrics ? r.metrics.time : null);
		return (t, r) => (l(), n(C, {
			name: "内存",
			title: "内存占用",
			color: "mem",
			dark: e.dark,
			value: i.value,
			time: a.value
		}, null, 8, [
			"dark",
			"value",
			"time"
		]));
	}
}, D = { class: "metrics" }, O = /*#__PURE__*/ e({
	__name: "Metrics",
	props: {
		dark: {
			type: Boolean,
			default: !1
		},
		metrics: {
			type: Object,
			default: null
		}
	},
	setup(e) {
		return (t, n) => (l(), r("div", D, [
			a(w, {
				dark: e.dark,
				metrics: e.metrics
			}, null, 8, ["dark", "metrics"]),
			a(E, {
				dark: e.dark,
				metrics: e.metrics
			}, null, 8, ["dark", "metrics"]),
			a(T, {
				dark: e.dark,
				metrics: e.metrics
			}, null, 8, ["dark", "metrics"])
		]));
	}
}, [["__scopeId", "data-v-ced6e998"]]);
export { w as MetricCpu, T as MetricDisk, E as MetricMemory, C as MetricSparkline, O as Metrics, O as default };
