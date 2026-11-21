import { formatBytes as e, formatClock as t } from "./format.js";
import { t as n } from "./_plugin-vue_export-helper.js";
import { computed as r, createBlock as i, createElementBlock as a, createElementVNode as o, createVNode as s, normalizeClass as c, onBeforeUnmount as l, onMounted as u, openBlock as d, ref as f, toDisplayString as p, watch as m } from "vue";
import { init as h, use as g } from "echarts/core";
import { LineChart as _ } from "echarts/charts";
import { GridComponent as v, TooltipComponent as y } from "echarts/components";
import { CanvasRenderer as b } from "echarts/renderers";
// src/components/commons/Metrics/palette.js
var x = {
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
}, S = ["title"], C = { class: "line" }, w = { class: "name" }, T = /*#__PURE__*/ n({
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
	setup(n) {
		g([
			_,
			v,
			y,
			b
		]);
		let i = n, s = f(null), T = f(null), E = f("--"), D = [], O = [], k = null, A = null, j = r(() => i.unit === "percent" && T.value !== null && T.value >= i.hot), M = {
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
		function N(t) {
			return i.unit === "speed" ? `${e(t, M)}/s` : `${Math.round(t)}%`;
		}
		function P() {
			return x[i.dark ? "dark" : "light"];
		}
		function F() {
			let e = P(), t = e[i.color] || i.color || e.cpu;
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
					data: O.slice()
				},
				yAxis: {
					type: "value",
					show: !1,
					min: 0,
					max: i.autoMax ? (e) => Math.max(e.max, 1) : 100
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
					formatter: (e) => `${i.name} ${e[0].axisValue}　${N(e[0].value)}`
				},
				series: [{
					type: "line",
					data: D.slice(),
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
		function I() {
			let e = s.value;
			e && e.clientWidth && (k && k.dispose(), k = h(e, null, { renderer: "canvas" }), k.setOption(F()));
		}
		return m(() => [i.time, i.value], ([e, n]) => {
			e && (typeof n == "number" ? (T.value = n, E.value = N(n), D.push(n), O.push(t(e, { fallback: "" })), D.length > i.points && (D.shift(), O.shift()), k && k.setOption({
				xAxis: { data: O.slice() },
				series: [{ data: D.slice() }]
			})) : (T.value = null, E.value = "--"));
		}, { immediate: !0 }), u(() => {
			A = new ResizeObserver(() => {
				let e = s.value;
				e && e.clientWidth && (k ? k.resize() : I());
			}), s.value && A.observe(s.value);
		}), l(() => {
			A && A.disconnect(), k && k.dispose();
		}), m(() => i.dark, () => {
			k && k.setOption(F(), !0);
		}), (e, t) => (d(), a("div", {
			class: "metric-cell",
			title: n.title
		}, [o("div", C, [o("span", w, p(n.name), 1), o("span", { class: c(["value", { hot: j.value }]) }, p(E.value), 3)]), o("div", {
			ref_key: "boxRef",
			ref: s,
			class: "chart"
		}, null, 512)], 8, S));
	}
}, [["__scopeId", "data-v-46649df6"]]), E = {
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
		let t = e, n = r(() => t.metrics && typeof t.metrics.cpu == "number" ? t.metrics.cpu : null), a = r(() => t.metrics ? t.metrics.time : null);
		return (t, r) => (d(), i(T, {
			name: "CPU",
			title: "CPU 占用",
			color: "cpu",
			dark: e.dark,
			value: n.value,
			time: a.value
		}, null, 8, [
			"dark",
			"value",
			"time"
		]));
	}
}, D = {
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
		let t = e, n = r(() => {
			let e = t.metrics && t.metrics.disk;
			return e && typeof e.percent == "number" ? e.percent : null;
		}), a = r(() => t.metrics ? t.metrics.time : null), o = r(() => {
			let e = t.metrics && t.metrics.disk;
			return e && e.mount ? `磁盘占用（${e.mount}）` : "磁盘占用";
		});
		return (t, r) => (d(), i(T, {
			name: "磁盘",
			title: o.value,
			color: "disk",
			dark: e.dark,
			value: n.value,
			time: a.value
		}, null, 8, [
			"title",
			"dark",
			"value",
			"time"
		]));
	}
}, O = {
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
		let t = e, n = r(() => t.metrics && t.metrics.net || null), a = r(() => n.value && typeof n.value.down == "number" ? n.value.down : null), o = r(() => t.metrics ? t.metrics.time : null), s = r(() => n.value && n.value.iface ? `下载速度（${n.value.iface}）` : "下载速度");
		return (t, n) => (d(), i(T, {
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
}, k = {
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
		let t = e, n = r(() => {
			let e = t.metrics && t.metrics.mem;
			return e && typeof e.percent == "number" ? e.percent : null;
		}), a = r(() => t.metrics ? t.metrics.time : null);
		return (t, r) => (d(), i(T, {
			name: "内存",
			title: "内存占用",
			color: "mem",
			dark: e.dark,
			value: n.value,
			time: a.value
		}, null, 8, [
			"dark",
			"value",
			"time"
		]));
	}
}, A = {
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
		let t = e, n = r(() => t.metrics && t.metrics.net || null), a = r(() => n.value && typeof n.value.up == "number" ? n.value.up : null), o = r(() => t.metrics ? t.metrics.time : null), s = r(() => n.value && n.value.iface ? `上传速度（${n.value.iface}）` : "上传速度");
		return (t, n) => (d(), i(T, {
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
}, j = { class: "metrics" }, M = /*#__PURE__*/ n({
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
		return (t, n) => (d(), a("div", j, [
			s(E, {
				dark: e.dark,
				metrics: e.metrics
			}, null, 8, ["dark", "metrics"]),
			s(k, {
				dark: e.dark,
				metrics: e.metrics
			}, null, 8, ["dark", "metrics"]),
			s(D, {
				dark: e.dark,
				metrics: e.metrics
			}, null, 8, ["dark", "metrics"]),
			s(O, {
				dark: e.dark,
				metrics: e.metrics
			}, null, 8, ["dark", "metrics"]),
			s(A, {
				dark: e.dark,
				metrics: e.metrics
			}, null, 8, ["dark", "metrics"])
		]));
	}
}, [["__scopeId", "data-v-2cd18149"]]);
export { T as a, E as i, k as n, D as r, M as t };
