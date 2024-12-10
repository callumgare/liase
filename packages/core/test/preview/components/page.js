import { ref, computed, watch, useTemplateRef } from "vue";
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
          body: requestString.value,
        });
        const data = await res.json();
        response.value = data;
      } catch (err) {
        loadingStatus.value = "error";
        throw err;
      }
      loadingStatus.value = "finished";
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
    };
  },
  template: /* html */ `
    <div class="controls">
      <textarea
        :style="{'background-color': requestValid ? 'rgba(56, 255, 0, 0.06)' : '#ff00001a'}"
        id="request"
        v-model="requestString"
        @change="handleRequestChange"
      ></textarea>
    </div>
    <div class="buttons">
      <button @click="fetchMedia" :disabled="!requestValid">Fetch</button>
      <button @click="responseView = responseView === 'json' ? 'visual' : 'json'">Show {{responseView === 'json' ? 'Media' : 'JSON'}}</button>
    </div>
    <div v-if="loadingStatus !== 'finished'">{{loadingStatus}}</div>
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
  `,
};
