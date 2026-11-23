import { createJsonClient as e, encodeParam as t } from "./http.js";
// src/utils/services/toolApi.js
function n(n, r = {}) {
	let { call: i } = e({ prefix: n });
	return {
		call: i,
		api: {
			state: () => i("GET", "/state"),
			stateStreamUrl: () => `${n}/state/stream`,
			log: (e, n = 0) => i("GET", `/log?run=${t(e)}&page=${n}`),
			logStreamUrl: (e) => `${n}/log/stream?run=${t(e)}`,
			dirs: (e = "") => i("GET", `/dirs${e ? `?path=${t(e)}` : ""}`),
			addWorkspace: (e) => i("POST", "/workspaces", { root: e }),
			forgetWorkspace: (e) => i("POST", "/forget", { ws: e }),
			setAlias: (e, t) => i("POST", "/alias", {
				ws: e,
				alias: t
			}),
			saveGroups: (e) => i("POST", "/groups", { nodes: e }),
			rescan: (e) => i("POST", "/rescan", { ws: e }),
			start: (e) => i("POST", "/start", e),
			stop: (e) => i("POST", "/stop", { run: e }),
			update: (e) => i("POST", "/update", e),
			...r
		}
	};
}
export { n as createToolApi };
