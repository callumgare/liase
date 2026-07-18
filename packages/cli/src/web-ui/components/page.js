import { computed, ref, useTemplateRef, watch } from "vue";
import DisplayMedia from "./display-media.js";
import QueryControls from "./query-controls.js";
import "@alenaksu/json-viewer";
export default {
  components: {
    DisplayMedia,
    QueryControls,
  },
  setup() {
    const emptyQuery = {
      id: Date.now(),
      name: "untitled query",
      requestString: "{}",
      secretsSet: "",
      cachedResponseStrategy: "if-cached",
    };
    const queries = ref(
      JSON.parse(
        localStorage.getItem("queries") || JSON.stringify([emptyQuery]),
      ),
    );
    watch(
      queries,
      () => localStorage.setItem("queries", JSON.stringify(queries.value)),
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

    const secretsSets = ref([]);
    async function updateSecretsSets() {
      const res = await fetch("/secrets-sets");
      secretsSets.value = await res.json();
    }
    updateSecretsSets();

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
            liaseRequest: JSON.parse(currentQuery.value?.requestString),
            secretsSet: currentQuery.value?.secretsSet,
            cachedResponseStrategy: currentQuery.value?.cachedResponseStrategy,
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

    function duplicateQuery() {
      const clonedCurrentQuery = JSON.parse(JSON.stringify(currentQuery.value));
      const newQuery = {
        ...clonedCurrentQuery,
        id: Date.now(),
      };
      queries.value.push(newQuery);
      currentQueryId.value = newQuery.id;
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
      loadingStatus,
      secretsSets,
      currentQuery,
      currentQueryId,
      queries,
      duplicateQuery,
    };
  },
  template: /* html */ `
    <query-controls
      :current-query="currentQuery"
      :current-query-id="currentQueryId"
      :queries="queries"
      :secrets-sets="secretsSets"
      @update:currentQueryId="currentQueryId = $event"
      @fetch="fetchMedia"
      @duplicate="duplicateQuery"
    />
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
