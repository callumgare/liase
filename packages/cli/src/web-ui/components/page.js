import { computed, ref, useTemplateRef, watch } from "vue";
import DisplayMedia from "./display-media.js";
import "@alenaksu/json-viewer";
export default {
	components: {
		DisplayMedia,
	},
	setup() {
		const requestString = ref(
			localStorage.getItem("mediaFinderRequest") ||
				JSON.stringify(
					{
						source: "bluesky",
						queryType: "search",
					},
					null,
					2,
				),
		);

		const secretsSets = ref([]);

		const secretsSet = ref(localStorage.getItem("secretsSet") || "");
		watch(secretsSet, () => {
			localStorage.setItem("secretsSet", secretsSet.value);
		});
		async function updateSecretsSets() {
			const res = await fetch("/secrets-sets");
			secretsSets.value = await res.json();
		}
		updateSecretsSets();

		const requestValid = computed(() => {
			try {
				JSON.parse(requestString.value);
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
						mediaFinderRequest: JSON.parse(requestString.value),
						secretsSet: secretsSet.value,
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

		function handleRequestChange(event) {
			requestString.value = JSON.stringify(
				JSON.parse(event.target.value),
				null,
				2,
			);
			localStorage.setItem("mediaFinderRequest", requestString.value);
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
			requestString,
			fetchMedia,
			responseView,
			requestValid,
			loadingStatus,
			handleRequestChange,
			secretsSets,
			secretsSet,
		};
	},
	template: /* html */ `
    <div class="options">
      <textarea
        :style="{'background-color': requestValid ? 'rgba(56, 255, 0, 0.06)' : '#ff00001a'}"
        id="request"
        v-model="requestString"
        @change="handleRequestChange"
      ></textarea>
			<div class="group">
				<div class="group">
					<label for="secret-set">Secrets Set:</label>

					<select name="secret-set" id="secret-set" v-model="secretsSet">
						<option value="">--None--</option>
						<option v-for="secretsSet in secretsSets" :value="secretsSet">{{secretsSet}}</option>
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
