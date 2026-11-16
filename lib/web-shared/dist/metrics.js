import { formatBytes as e } from "./format.js";
import { t } from "./_plugin-vue_export-helper.js";
import { computed as n, createBlock as r, createElementBlock as i, createElementVNode as a, createVNode as o, normalizeClass as s, onBeforeUnmount as c, onMounted as l, openBlock as u, ref as d, toDisplayString as f, watch as p } from "vue";
import { init as m, use as h } from "echarts/core";
import { LineChart as g } from "echarts/charts";
import { GridComponent as _, TooltipComponent as v } from "echarts/components";
import { CanvasRenderer as y } from "echarts/renderers";
// src/components/commons/Metrics/palette.js
var b = {
	light: {
		cpu: "#2563eb",
		mem: "#0d9488",
		disk: "#b45309",
		down: "#7c3aed",
		up: "#db2777",
		tip: "#ffffff",
		tipText: "#1d2129"
	},
	dark: {
		cpu: "#60a5fa",
		mem: "#2dd4bf",
		disk: "#fbbf24",
		down: "#a78bfa",
		up: "#f472b6",
		tip: "#262a30",
		tipText: "#e5e7eb"
	}
}, x = ["title"], S = { class: "line" }, C = { class: "name" }, w = /*#__PURE__*/ t({
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
		unit: {
			type: String,
			default: "percent"
		},
		autoMax: {
			type: Boolean,
			default: !1
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
	setup(t) {
		h([
			g,
			_,
			v,
			y
		]);
		let r = t, o = d(null), w = d(null), T = d("--"), E = [], D = [], O = null, k = null, A = n(() => r.unit === "percent" && w.value !== null && w.value >= r.hot), j = {
			units: [
				"B",
				"KB",
				"MB",
				"GB"
			],
			precision: [
				0,
				1,
				2,
				2
			]
		};
		function M(t) {
			return r.unit === "speed" ? `${e(t, j)}/s` : `${Math.round(t)}%`;
		}
		function N() {
			return b[r.dark ? "dark" : "light"];
		}
		function P() {
			let e = N(), t = e[r.color] || r.color || e.cpu;
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
					data: D.slice()
				},
				yAxis: {
					type: "value",
					show: !1,
					min: 0,
					max: r.autoMax ? (e) => Math.max(e.max, 1) : 100
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
					formatter: (e) => `${r.name} ${e[0].axisValue}　${M(e[0].value)}`
				},
				series: [{
					type: "line",
					data: E.slice(),
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
		function F() {
			let e = o.value;
			e && e.clientWidth && (O && O.dispose(), O = m(e, null, { renderer: "canvas" }), O.setOption(P()));
		}
		function I(e) {
			return (/* @__PURE__ */ new Date(e * 1e3)).toLocaleTimeString("zh-CN", { hour12: !1 });
		}
		return p(() => [r.time, r.value], ([e, t]) => {
			e && (typeof t == "number" ? (w.value = t, T.value = M(t), E.push(t), D.push(I(e)), E.length > r.points && (E.shift(), D.shift()), O && O.setOption({
				xAxis: { data: D.slice() },
				series: [{ data: E.slice() }]
			})) : (w.value = null, T.value = "--"));
		}, { immediate: !0 }), l(() => {
			k = new ResizeObserver(() => {
				let e = o.value;
				e && e.clientWidth && (O ? O.resize() : F());
			}), o.value && k.observe(o.value);
		}), c(() => {
			k && k.disconnect(), O && O.dispose();
		}), p(() => r.dark, () => {
			O && O.setOption(P(), !0);
		}), (e, n) => (u(), i("div", {
			class: "metric-cell",
			title: t.title
		}, [a("div", S, [a("span", C, f(t.name), 1), a("span", { class: s(["value", { hot: A.value }]) }, f(T.value), 3)]), a("div", {
			ref_key: "boxRef",
			ref: o,
			class: "chart"
		}, null, 512)], 8, x));
	}
}, [["__scopeId", "data-v-b3b536dc"]]), T = {
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
		let t = e, i = n(() => t.metrics && typeof t.metrics.cpu == "number" ? t.metrics.cpu : null), a = n(() => t.metrics ? t.metrics.time : null);
		return (t, n) => (u(), r(w, {
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
}, E = {
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
		let t = e, i = n(() => {
			let e = t.metrics && t.metrics.disk;
			return e && typeof e.percent == "number" ? e.percent : null;
		}), a = n(() => t.metrics ? t.metrics.time : null), o = n(() => {
			let e = t.metrics && t.metrics.disk;
			return e && e.mount ? `磁盘占用（${e.mount}）` : "磁盘占用";
		});
		return (t, n) => (u(), r(w, {
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
}, D = {
	__name: "MetricDownload",
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
		let t = e, i = n(() => t.metrics && t.metrics.net || null), a = n(() => i.value && typeof i.value.down == "number" ? i.value.down : null), o = n(() => t.metrics ? t.metrics.time : null), s = n(() => i.value && i.value.iface ? `下载速度（${i.value.iface}）` : "下载速度");
		return (t, n) => (u(), r(w, {
			name: "下载",
			title: s.value,
			color: "down",
			unit: "speed",
			"auto-max": "",
			dark: e.dark,
			value: a.value,
			time: o.value
		}, null, 8, [
			"title",
			"dark",
			"value",
			"time"
		]));
	}
}, O = {
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
		let t = e, i = n(() => {
			let e = t.metrics && t.metrics.mem;
			return e && typeof e.percent == "number" ? e.percent : null;
		}), a = n(() => t.metrics ? t.metrics.time : null);
		return (t, n) => (u(), r(w, {
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
}, k = {
	__name: "MetricUpload",
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
		let t = e, i = n(() => t.metrics && t.metrics.net || null), a = n(() => i.value && typeof i.value.up == "number" ? i.value.up : null), o = n(() => t.metrics ? t.metrics.time : null), s = n(() => i.value && i.value.iface ? `上传速度（${i.value.iface}）` : "上传速度");
		return (t, n) => (u(), r(w, {
			name: "上传",
			title: s.value,
			color: "up",
			unit: "speed",
			"auto-max": "",
			dark: e.dark,
			value: a.value,
			time: o.value
		}, null, 8, [
			"title",
			"dark",
			"value",
			"time"
		]));
	}
}, A = { class: "metrics" }, j = /*#__PURE__*/ t({
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
		return (t, n) => (u(), i("div", A, [
			o(T, {
				dark: e.dark,
				metrics: e.metrics
			}, null, 8, ["dark", "metrics"]),
			o(O, {
				dark: e.dark,
				metrics: e.metrics
			}, null, 8, ["dark", "metrics"]),
			o(E, {
				dark: e.dark,
				metrics: e.metrics
			}, null, 8, ["dark", "metrics"]),
			o(D, {
				dark: e.dark,
				metrics: e.metrics
			}, null, 8, ["dark", "metrics"]),
			o(k, {
				dark: e.dark,
				metrics: e.metrics
			}, null, 8, ["dark", "metrics"])
		]));
	}
}, [["__scopeId", "data-v-2cd18149"]]);
export { T as MetricCpu, E as MetricDisk, O as MetricMemory, w as MetricSparkline, j as Metrics, j as default };
