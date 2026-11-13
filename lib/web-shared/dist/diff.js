import { highlightCode as e, languageOf as t } from "./highlight.js";
import { t as n } from "./_plugin-vue_export-helper-Djzt4Yr7.js";
import { Fragment as r, computed as i, createBlock as a, createCommentVNode as o, createElementBlock as s, createElementVNode as c, createTextVNode as l, nextTick as u, normalizeClass as d, openBlock as f, ref as p, renderList as ee, renderSlot as m, resolveComponent as te, toDisplayString as h, watch as g, withCtx as _ } from "vue";
// src/components/DiffView/DiffView.vue
var v = { class: "diff" }, y = {
	key: 0,
	class: "head"
}, b = { class: "headline" }, x = ["title"], S = {
	key: 2,
	class: "readonly"
}, C = {
	key: 1,
	class: "hint"
}, w = {
	key: 2,
	class: "hint bad"
}, T = {
	key: 3,
	class: "hint"
}, E = {
	key: 4,
	class: "body mono"
}, ne = {
	key: 0,
	class: "wide"
}, re = { class: "ln" }, ie = { class: "ln" }, ae = { class: "sign" }, oe = ["innerHTML"], se = { class: "ln" }, ce = { class: "ln" }, le = { class: "sign" }, ue = [
	"onInput",
	"onKeydown",
	"onPaste"
], de = ["innerHTML", "onClick"], D = /*#__PURE__*/ n({
	__name: "DiffView",
	props: {
		text: {
			type: String,
			default: ""
		},
		kind: {
			type: String,
			default: "diff"
		},
		title: {
			type: String,
			default: ""
		},
		path: {
			type: String,
			default: ""
		},
		truncated: {
			type: Boolean,
			default: !1
		},
		loading: {
			type: Boolean,
			default: !1
		},
		error: {
			type: String,
			default: ""
		},
		editable: {
			type: Boolean,
			default: !1
		},
		baseText: {
			type: String,
			default: ""
		},
		readOnlyReason: {
			type: String,
			default: ""
		},
		texts: {
			type: Object,
			default: () => ({})
		}
	},
	emits: ["dirty"],
	setup(n, { expose: D, emit: fe }) {
		let O = n, k = fe, A = {
			loading: "正在取差异…",
			empty: "这里没有可显示的内容。",
			truncated: "已截断",
			fileNote: "未纳入版本控制，显示文件内容"
		}, j = i(() => ({
			...A,
			...O.texts
		})), M = i(() => {
			let e = O.text || "";
			return e && e.split("\n").length <= 2e3 && e.length <= 204800 ? t(O.path) : "";
		}), N = i(() => {
			let t = O.text || "";
			if (!t) return [];
			let n = t.split("\n"), r = M.value, i = (t) => ({
				...t,
				html: e(t.text, r)
			}), a = [], o = 0, s = 0;
			if (O.kind === "file") return n.map((e, t) => i({
				type: "add",
				sign: "+",
				old: "",
				new: t + 1,
				text: e
			}));
			for (let e of n) if (e.startsWith("Index: ") || e.startsWith("====") || e.startsWith("\\ ")) a.push({
				type: "meta",
				text: e
			});
			else if (e.startsWith("---") || e.startsWith("+++")) a.push({
				type: "meta",
				text: e
			});
			else if (e.startsWith("@@")) {
				let t = e.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
				t && (o = Number(t[1]), s = Number(t[2])), a.push({
					type: "hunk",
					text: e
				});
			} else e.startsWith("+") ? a.push(i({
				type: "add",
				sign: "+",
				old: "",
				new: s++,
				text: e.slice(1)
			})) : e.startsWith("-") ? a.push(i({
				type: "del",
				sign: "-",
				old: o++,
				new: "",
				text: e.slice(1)
			})) : e.startsWith(" ") ? a.push(i({
				type: "ctx",
				sign: "",
				old: o++,
				new: s++,
				text: e.slice(1)
			})) : a.push({
				type: "meta",
				text: e
			});
			return a;
		}), P = i(() => O.baseText.replace(/\r\n?/g, "\n").split("\n")), F = 0, I = /* @__PURE__ */ new Map(), L = {}, R = /* @__PURE__ */ new Map(), z = p(0), B = p(0), V = p(!1), H = (e) => `${e.start}:${e.end}`, U = (t) => ({
			id: ++F,
			text: t,
			html: e(t, M.value)
		});
		function W(t, n) {
			t.text = n, t.html = e(n, M.value);
		}
		let G = i(() => {
			R.clear();
			let e = [], t = null;
			for (let n of N.value) n.type === "add" || n.type === "ctx" ? t && n.new === t.end + 1 ? (t.end = n.new, t.rows.push(n), R.set(n, t)) : (t = {
				start: n.new,
				end: n.new,
				rows: [n]
			}, e.push(t), R.set(n, t)) : t = null;
			return e;
		});
		function pe(e) {
			let t = H(e);
			if (L[t]) return L[t];
			let n = P.value.slice(e.start - 1, e.end), r = n.length === e.rows.length ? n : e.rows.map((e) => e.text);
			return L[t] = {
				start: e.start,
				end: e.end,
				base: [...r],
				lines: r.map(U)
			}, L[t];
		}
		let K = i(() => {
			z.value, G.value;
			let e = [], t = /* @__PURE__ */ new Set(), n = 0;
			return N.value.forEach((r, i) => {
				let a = O.editable ? R.get(r) : null;
				if (a) {
					let r = H(a);
					if (t.has(r)) return;
					t.add(r);
					let i = pe(a);
					i.lines.forEach((t, r) => {
						let o = a.rows[r], s = o ? o.sign : "+";
						e.push({
							kind: "edit",
							key: "e" + t.id,
							region: i,
							index: r,
							line: t,
							old: r === 0 ? a.rows[0].old : "",
							new: a.start + r + n,
							sign: s,
							cls: s === "+" ? "add" : "ctx"
						});
					}), n += i.lines.length - a.rows.length;
				} else r.type === "meta" || r.type === "hunk" ? e.push({
					kind: "plain",
					key: "p" + i,
					row: r,
					cls: r.type
				}) : e.push({
					kind: "plain",
					key: "p" + i,
					row: r,
					cls: r.type,
					old: r.old,
					new: r.new === "" ? "" : r.new + n
				});
			}), e;
		});
		function q() {
			let e = !1;
			for (let t of G.value) {
				let n = L[H(t)];
				if (n && (n.lines.length !== n.base.length || n.lines.some((e, t) => e.text !== n.base[t]))) {
					e = !0;
					break;
				}
			}
			e !== V.value && (V.value = e, k("dirty", e));
		}
		function J(e) {
			e && (B.value = e.line.id), z.value += 1, q(), e && u(() => {
				let t = I.get(e.line.id);
				t && $(t, e.offset);
			});
		}
		function me(e, t) {
			e ? (I.set(t.line.id, e), e.textContent !== t.line.text && (e.textContent = t.line.text)) : I.delete(t.line.id);
		}
		function Y(e) {
			let t = window.getSelection();
			if (!t || !t.rangeCount) return null;
			let n = t.getRangeAt(0);
			return !e.contains(n.startContainer) || !e.contains(n.endContainer) ? null : {
				start: X(e, n.startContainer, n.startOffset),
				end: X(e, n.endContainer, n.endOffset)
			};
		}
		function X(e, t, n) {
			let r = document.createRange();
			return r.selectNodeContents(e), r.setEnd(t, n), r.toString().length;
		}
		function Z(e, t) {
			let n = Y(e);
			return !n || n.start !== n.end ? !1 : t === "start" ? n.start === 0 : n.end === e.textContent.length;
		}
		function Q(e) {
			let t = e.currentTarget, n = null, r = 0;
			if (document.caretRangeFromPoint) {
				let t = document.caretRangeFromPoint(e.clientX, e.clientY);
				t && (n = t.startContainer, r = t.startOffset);
			} else if (document.caretPositionFromPoint) {
				let t = document.caretPositionFromPoint(e.clientX, e.clientY);
				t && (n = t.offsetNode, r = t.offset);
			}
			if (!t || !n || !t.contains(n)) return t ? t.textContent.length : 0;
			let i = document.createRange();
			return i.selectNodeContents(t), i.setEnd(n, r), i.toString().length;
		}
		function $(e, t) {
			e.focus();
			let n = window.getSelection();
			if (!n) return;
			let r = document.createRange(), i = e.firstChild;
			i && i.nodeType === Node.TEXT_NODE ? r.setStart(i, Math.min(t, i.textContent.length)) : r.setStart(e, 0), r.collapse(!0), n.removeAllRanges(), n.addRange(r);
		}
		function he(e, t) {
			let n = window.getSelection();
			if (n && !n.isCollapsed) return;
			let r = Q(t);
			B.value = e.line.id, u(() => {
				let t = I.get(e.line.id);
				t && $(t, r);
			});
		}
		function ge(e, t) {
			W(e.line, t.target.textContent), q();
		}
		function _e(e, t) {
			if (t.isComposing) return;
			let n = t.target;
			if (t.key === "Enter") {
				t.preventDefault();
				let r = Y(n), i = r ? r.start : n.textContent.length, a = n.textContent;
				W(e.line, a.slice(0, i));
				let o = U(a.slice(i));
				e.region.lines.splice(e.index + 1, 0, o), J({
					line: o,
					offset: 0
				});
			} else if (t.key === "Backspace" && Z(n, "start")) {
				if (t.preventDefault(), e.index === 0) return;
				let r = e.region.lines[e.index - 1], i = r.text.length;
				W(r, r.text + n.textContent), e.region.lines.splice(e.index, 1), J({
					line: r,
					offset: i
				});
			} else if (t.key === "Delete" && Z(n, "end")) {
				if (e.index >= e.region.lines.length - 1) return;
				t.preventDefault();
				let r = n.textContent.length, i = e.region.lines[e.index + 1];
				W(e.line, n.textContent + i.text), e.region.lines.splice(e.index + 1, 1), J({
					line: e.line,
					offset: r
				});
			}
		}
		function ve(t, n) {
			n.preventDefault();
			let r = n.clipboardData ? n.clipboardData.getData("text/plain") : "";
			if (!r) return;
			let i = n.target, a = Y(i), o = a ? a.start : i.textContent.length, s = a ? a.end : i.textContent.length, c = i.textContent, l = r.replace(/\r\n?/g, "\n").split("\n");
			if (W(t.line, c.slice(0, o) + l[0]), l.length === 1) {
				W(t.line, t.line.text + c.slice(s)), i.textContent = t.line.text, $(i, o + l[0].length), q();
				return;
			}
			let u = l.slice(1), d = u.map((e) => U(e));
			d[d.length - 1].text += c.slice(s), d[d.length - 1].html = e(d[d.length - 1].text, M.value), t.region.lines.splice(t.index + 1, 0, ...d), J({
				line: d[d.length - 1],
				offset: u[u.length - 1].length
			});
		}
		function ye() {
			let e = G.value.map((e) => L[H(e)]).filter(Boolean), t = P.value, n = [], r = 0;
			for (let i of e) n.push(...t.slice(r, i.start - 1)), n.push(...i.lines.map((e) => e.text)), r = i.end;
			return n.push(...t.slice(r)), n.join("\n");
		}
		function be() {
			B.value = 0;
			for (let e of Object.keys(L)) delete L[e];
			z.value += 1, V.value && (V.value = !1, k("dirty", !1));
		}
		return g(() => [
			O.text,
			O.baseText,
			O.editable
		], () => {
			B.value = 0;
			for (let e of Object.keys(L)) delete L[e];
			z.value += 1, V.value && (V.value = !1, k("dirty", !1));
		}), D({
			collect: ye,
			resetEdits: be
		}), (e, t) => {
			let i = te("v-chip");
			return f(), s("div", v, [n.title ? (f(), s("div", y, [c("div", b, [
				c("span", {
					class: "title mono",
					title: n.title
				}, h(n.title), 9, x),
				n.kind === "file" && j.value.fileNote ? (f(), a(i, {
					key: 0,
					size: "x-small",
					variant: "flat",
					color: "unversioned"
				}, {
					default: _(() => [l(h(j.value.fileNote), 1)]),
					_: 1
				})) : o("", !0),
				n.truncated ? (f(), a(i, {
					key: 1,
					size: "x-small",
					variant: "flat",
					color: "modified"
				}, {
					default: _(() => [l(h(j.value.truncated), 1)]),
					_: 1
				})) : o("", !0),
				n.readOnlyReason ? (f(), s("span", S, h(n.readOnlyReason), 1)) : o("", !0)
			]), m(e.$slots, "actions", {}, void 0, !0)])) : o("", !0), n.loading ? (f(), s("p", C, h(j.value.loading), 1)) : n.error ? (f(), s("p", w, h(n.error), 1)) : K.value.length ? (f(), s("div", E, [(f(!0), s(r, null, ee(K.value, (e) => (f(), s("div", {
				key: e.key,
				class: d(["row", e.cls])
			}, [e.kind === "plain" ? (f(), s(r, { key: 0 }, [e.row.type === "meta" || e.row.type === "hunk" ? (f(), s("span", ne, h(e.row.text), 1)) : (f(), s(r, { key: 1 }, [
				c("span", re, h(e.old), 1),
				c("span", ie, h(e.new), 1),
				c("span", ae, h(e.row.sign), 1),
				c("span", {
					class: "text",
					innerHTML: e.row.html
				}, null, 8, oe)
			], 64))], 64)) : (f(), s(r, { key: 1 }, [
				c("span", se, h(e.old), 1),
				c("span", ce, h(e.new), 1),
				c("span", le, h(e.sign), 1),
				e.line.id === B.value ? (f(), s("span", {
					key: 0,
					ref_for: !0,
					ref: (t) => me(t, e),
					class: "text edit",
					contenteditable: "true",
					spellcheck: "false",
					onInput: (t) => ge(e, t),
					onKeydown: (t) => _e(e, t),
					onPaste: (t) => ve(e, t)
				}, null, 40, ue)) : (f(), s("span", {
					key: 1,
					class: "text edit-idle",
					innerHTML: e.line.html,
					onClick: (t) => he(e, t)
				}, null, 8, de))
			], 64))], 2))), 128))])) : (f(), s("div", T, h(j.value.empty), 1))]);
		};
	}
}, [["__scopeId", "data-v-35669e01"]]);
export { D as DiffView, D as default };
