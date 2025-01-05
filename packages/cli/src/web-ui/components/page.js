import { computed, ref, useTemplateRef, watch } from "vue";
import DisplayMedia from "./display-media.js";
import "@alenaksu/json-viewer";
export default {
	components: {
		DisplayMedia,
	},
	setup() {
		const emptyQuery = {
			id: Date.now(),
			name: "untitled query",
			requestString: "{}",
			secretsSet: "",
			cacheNetworkRequests: "always",
		};
		const queries = ref(
			JSON.parse(
				localStorage.getItem("queries") || JSON.stringify([emptyQuery]),
			),
		);
		watch(
			queries,
			() => {
				console.log("queries changed", queries);
				localStorage.setItem("queries", JSON.stringify(queries.value));
			},
			{ deep: true },
		);

		const currentQueryId = ref(
			JSON.parse(localStorage.getItem("currentQueryId")) ||
				queries.value[0]?.id,
		);
		watch(currentQueryId, () => {
			localStorage.setItem("currentQueryId", currentQueryId.value);
		});

		const currentQuery = computed(() => {
			const currentQuery = queries.value?.find(
				(query) => query.id === currentQueryId.value,
			);
			if (!currentQuery) {
				console.info("Queries", queries.value);
				if (queries.value?.length) {
					console.warn(
						"Could not find current query with id:",
						currentQueryId.value,
					);
					const firstQuery = queries.value[0];
					currentQueryId.value = firstQuery.id;
					return firstQuery;
				}
				throw Error(
					`Could not find current query with id: ${currentQueryId.value}`,
				);
			}
			return currentQuery;
		});
		const queryName = ref(currentQuery.value.name);
		watch(currentQuery, () => {
			queryName.value = currentQuery.value.name;
		});

		const secretsSets = ref([]);
		async function updateSecretsSets() {
			const res = await fetch("/secrets-sets");
			secretsSets.value = await res.json();
		}
		updateSecretsSets();

		const requestValid = computed(() => {
			try {
				JSON.parse(currentQuery.value?.requestString);
				return true;
			} catch (error) {
				return false;
			}
		});
		const responseView = ref(localStorage.getItem("responseView") || "visual");
		watch(responseView, () => {
			localStorage.setItem("responseView", responseView.value);
		});
		const response = ref("");
		const loadingStatus = ref("finished");
		async function fetchMedia() {
			loadingStatus.value = "loading";
			try {
				const res = await fetch("/", {
					method: "POST",
					body: JSON.stringify({
						mediaFinderRequest: JSON.parse(currentQuery.value?.requestString),
						secretsSet: currentQuery.value?.secretsSet,
						cacheNetworkRequests: currentQuery.value?.cacheNetworkRequests,
					}),
				});
				response.value = await res.json();
				if (res.ok) {
					loadingStatus.value = "finished";
				} else {
					loadingStatus.value = "error";
				}
			} catch (error) {
				loadingStatus.value = "error";
				response.value = { error };
			}
		}
		fetchMedia();

		function saveNewQuery() {
			const clonedCurrentQuery = JSON.parse(JSON.stringify(currentQuery.value));
			const newQuery = {
				...clonedCurrentQuery,
				id: Date.now(),
				name: queryName.value,
			};
			queries.value.push(newQuery);
			currentQueryId.value = newQuery.id;
		}

		function renameCurrentQuery() {
			currentQuery.value.name = queryName.value;
		}

		function handleRequestChange(event) {
			currentQuery.value.requestString = JSON.stringify(
				JSON.parse(event.target.value),
				null,
				2,
			);
		}

		const jsonViewerRef = useTemplateRef("json-viewer");

		watch([response, responseView], () => {
			if (responseView.value === "json") {
				setTimeout(() => {
					jsonViewerRef.value?.expand("media.0");
				}, 100);
			}
		});
		return {
			response,
			fetchMedia,
			responseView,
			requestValid,
			loadingStatus,
			handleRequestChange,
			secretsSets,
			currentQuery,
			currentQueryId,
			queries,
			queryName,
			saveNewQuery,
			renameCurrentQuery,
		};
	},
	template: /* html */ `
    <div class="options">
			<div class="group">
				<div class="group">
					<label for="current-query">Current query:</label>
					<select name="current-query" id="current-query" v-model="currentQueryId">
						<option v-for="query, index in queries" :value="query.id">{{index}} - {{query.name}}</option>
					</select>
				</div>
				<div class="group">
					<label for="new-query-name">Query name:</label>
					<input name="query-name" id="new-query-name" v-model="queryName" />
					<button @click="saveNewQuery">Save as new query</button>
					<button @click="renameCurrentQuery">Rename current query</button>
				</div>
			</div>
      <textarea
        :style="{'background-color': requestValid ? 'rgba(56, 255, 0, 0.06)' : '#ff00001a'}"
        id="request"
        v-model="currentQuery.requestString"
        @change="handleRequestChange"
      ></textarea>
			<div class="group">
				<div class="group">
					<label for="secret-set">Secrets Set:</label>
					<select name="secret-set" id="secret-set" v-model="currentQuery.secretsSet">
						<option value="">--None--</option>
						<option v-for="secretsSet in secretsSets" :value="secretsSet">{{secretsSet}}</option>
					</select>
				</div>
				<div class="group">
					<label for="cache-network-requests">Cache Network Requests:</label>
					<select name="cache-network-requests" id="cache-network-requests" v-model="currentQuery.cacheNetworkRequests">
						<option value="never">Never</option>
						<option value="auto">Auto</option>
						<option value="always">Always</option>
					</select>
				</div>
				<button @click="fetchMedia" :disabled="!requestValid">Fetch</button>
			</div>
    </div>
    <div class="buttons">
      <button @click="responseView = responseView === 'json' ? 'visual' : 'json'">Show {{responseView === 'json' ? 'Media' : 'JSON'}}</button>
    </div>
		<div v-if="loadingStatus !== 'finished'">{{loadingStatus}}</div>
		<div
			v-if="loadingStatus === 'error'"
		>
			<pre class="error" v-html="response?.error"></pre>
		</div>
		<template v-else>
			<json-viewer
				v-if="responseView === 'json'"
				id="response"
				:data="response"
				ref="json-viewer"
			/>
			<display-media
				v-else
				:response="response"
			/>
		</template>
  `,
};
