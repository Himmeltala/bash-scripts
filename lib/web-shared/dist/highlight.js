import e from "highlight.js/lib/core";
import t from "highlight.js/lib/languages/bash";
import n from "highlight.js/lib/languages/css";
import r from "highlight.js/lib/languages/ini";
import i from "highlight.js/lib/languages/java";
import a from "highlight.js/lib/languages/javascript";
import o from "highlight.js/lib/languages/json";
import s from "highlight.js/lib/languages/markdown";
import c from "highlight.js/lib/languages/python";
import l from "highlight.js/lib/languages/sql";
import u from "highlight.js/lib/languages/typescript";
import d from "highlight.js/lib/languages/xml";
import f from "highlight.js/lib/languages/yaml";
// src/utils/highlight.js
var p = {
	bash: t,
	css: n,
	ini: r,
	java: i,
	javascript: a,
	json: o,
	markdown: s,
	python: c,
	sql: l,
	typescript: u,
	xml: d,
	yaml: f
};
for (let [t, n] of Object.entries(p)) e.registerLanguage(t, n);
var m = {
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	jsx: "javascript",
	ts: "typescript",
	tsx: "typescript",
	vue: "xml",
	html: "xml",
	htm: "xml",
	xml: "xml",
	svg: "xml",
	json: "json",
	css: "css",
	scss: "css",
	less: "css",
	java: "java",
	py: "python",
	sh: "bash",
	bash: "bash",
	sql: "sql",
	yml: "yaml",
	yaml: "yaml",
	md: "markdown",
	markdown: "markdown",
	ini: "ini",
	properties: "ini",
	conf: "ini",
	env: "ini"
}, h = 204800;
function g(e) {
	let t = String(e || "").split("/").pop() || "", n = t.lastIndexOf(".");
	return n < 0 ? "" : m[t.slice(n + 1).toLowerCase()] || "";
}
function _(e) {
	return String(e || "").split("/").pop() || "";
}
function v(e) {
	return e.replace(/[&<>]/g, (e) => ({
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;"
	})[e]);
}
function y(t, n) {
	if (!t) return "";
	if (!n || t.length > 204800) return v(t);
	try {
		return e.highlight(t, {
			language: n,
			ignoreIllegals: !0
		}).value;
	} catch {
		return v(t);
	}
}
export { h as MAX_HIGHLIGHT, _ as fileBase, y as highlightCode, g as languageOf };
