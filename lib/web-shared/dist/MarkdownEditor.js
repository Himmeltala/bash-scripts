import { t as e } from "./TextEditor.js";
import { createBlock as t, openBlock as n, ref as r } from "vue";
// src/components/FileEditor/handlers/markdown/MarkdownEditor.vue
var i = {
	__name: "MarkdownEditor",
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
	setup(i, { expose: a }) {
		let o = r(null);
		return a({
			resetScroll: () => o.value?.resetScroll(),
			locate: (e) => o.value?.locate(e)
		}), (r, a) => (n(), t(e, {
			ref_key: "editorRef",
			ref: o,
			"model-value": i.modelValue,
			language: "markdown",
			"onUpdate:modelValue": a[0] ||= (e) => r.$emit("update:modelValue", e)
		}, null, 8, ["model-value"]));
	}
};
export { i as default };
