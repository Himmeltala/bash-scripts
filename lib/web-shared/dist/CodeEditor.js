import { t as e } from "./TextEditor.js";
import { languageOf as t } from "./highlight.js";
import { createBlock as n, openBlock as r, ref as i, unref as a } from "vue";
// src/components/FileEditor/handlers/code/CodeEditor.vue
var o = {
	__name: "CodeEditor",
	props: {
		modelValue: {
			type: String,
			default: ""
		},
		path: {
			type: String,
			default: ""
		}
	},
	emits: ["update:modelValue"],
	setup(o, { expose: s }) {
		let c = i(null);
		return s({
			resetScroll: () => c.value?.resetScroll(),
			locate: (e) => c.value?.locate(e)
		}), (i, s) => (r(), n(e, {
			ref_key: "editorRef",
			ref: c,
			"model-value": o.modelValue,
			language: a(t)(o.path),
			"onUpdate:modelValue": s[0] ||= (e) => i.$emit("update:modelValue", e)
		}, null, 8, ["model-value", "language"]));
	}
};
export { o as default };
