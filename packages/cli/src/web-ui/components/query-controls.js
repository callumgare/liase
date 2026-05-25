import { computed, ref, watch } from "vue";

export default {
  props: {
    currentQuery: Object,
    currentQueryId: [Number, String],
    queries: Array,
    secretsSets: Array,
  },
  emits: ["update:currentQueryId", "fetch", "duplicate"],
  setup(props, { emit }) {
    const sources = ref([]);

    async function loadSources() {
      const res = await fetch("/sources");
      sources.value = await res.json();
    }
    loadSources();

    const parsedRequest = computed(() => {
      try {
        return JSON.parse(props.currentQuery?.requestString || "{}");
      } catch {
        return {};
      }
    });

    const selectedSourceId = computed({
      get: () => parsedRequest.value?.source || "",
      set: (sourceId) => {
        if (!sourceId) {
          props.currentQuery.requestString = JSON.stringify({}, null, 2);
        } else {
          props.currentQuery.requestString = JSON.stringify(
            { source: sourceId },
            null,
            2,
          );
        }
      },
    });

    const selectedSource = computed(() =>
      sources.value.find((s) => s.id === selectedSourceId.value),
    );

    const selectedQueryTypeId = computed({
      get: () => parsedRequest.value?.queryType || "",
      set: (queryTypeId) => {
        if (!queryTypeId) {
          props.currentQuery.requestString = JSON.stringify(
            { source: selectedSourceId.value },
            null,
            2,
          );
        } else {
          props.currentQuery.requestString = JSON.stringify(
            { source: selectedSourceId.value, queryType: queryTypeId },
            null,
            2,
          );
        }
      },
    });

    const selectedRequestHandler = computed(() =>
      selectedSource.value?.requestHandlers.find(
        (rh) => rh.id === selectedQueryTypeId.value,
      ),
    );

    const fieldEntries = computed(() =>
      Object.entries(selectedRequestHandler.value?.schemaFields || {}).filter(
        ([, schema]) =>
          !(schema.type === "other" && schema.zodTypeName === "ZodNever"),
      ),
    );

    function isEnumField(schema) {
      return (
        Array.isArray(schema.type) &&
        schema.type.every((t) => t.type === "literal")
      );
    }

    function enumValues(schema) {
      return schema.type.map((t) => t.value);
    }

    function getFieldType(schema) {
      if (isEnumField(schema)) return "enum";
      if (typeof schema.type === "string") return schema.type;
      return "union";
    }

    function getNumberMin(schema) {
      return schema.checks?.find((c) => c.kind === "min")?.value;
    }

    function getNumberMax(schema) {
      return schema.checks?.find((c) => c.kind === "max")?.value;
    }

    const requestValid = computed(() => {
      try {
        JSON.parse(props.currentQuery?.requestString);
        return true;
      } catch {
        return false;
      }
    });

    function getFieldValue(fieldName) {
      return parsedRequest.value?.[fieldName];
    }

    function setFieldValue(fieldName, value) {
      const current = { ...parsedRequest.value };
      if (
        value === "" ||
        value === undefined ||
        value === null ||
        (typeof value === "number" && Number.isNaN(value)) ||
        (Array.isArray(value) && value.length === 0)
      ) {
        delete current[fieldName];
      } else {
        current[fieldName] = value;
      }
      props.currentQuery.requestString = JSON.stringify(current, null, 2);
    }

    function handleRequestChange(event) {
      try {
        props.currentQuery.requestString = JSON.stringify(
          JSON.parse(event.target.value),
          null,
          2,
        );
      } catch {
        // Leave as-is if invalid JSON
      }
    }

    function handleArrayFieldChange(fieldName, event) {
      const raw = event.target.value;
      setFieldValue(
        fieldName,
        raw
          ? raw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      );
    }

    function duplicateQuery() {
      emit("duplicate");
    }

    return {
      sources,
      selectedSourceId,
      selectedSource,
      selectedQueryTypeId,
      selectedRequestHandler,
      fieldEntries,
      isEnumField,
      enumValues,
      getFieldType,
      getNumberMin,
      getNumberMax,
      handleArrayFieldChange,
      requestValid,
      parsedRequest,
      getFieldValue,
      setFieldValue,
      handleRequestChange,
      duplicateQuery,
    };
  },
  template: /* html */ `
    <div class="options">
      <div class="group">
        <div class="group">
          <label for="current-query">Current query:</label>
          <select name="current-query" id="current-query" :value="currentQueryId" @change="$emit('update:currentQueryId', parseInt($event.target.value) || $event.target.value)">
            <option v-for="query, index in queries" :value="query.id">{{index}} - {{query.name}}</option>
          </select>
        </div>
        <div class="group">
          <label for="query-name">Query name:</label>
          <input name="query-name" id="query-name" v-model="currentQuery.name" />
        </div>
        <button @click="duplicateQuery">Duplicate query</button>
      </div>

      <div class="group">
        <div class="group">
          <label for="source-select">Source:</label>
          <select name="source-select" id="source-select" :value="selectedSourceId" @change="selectedSourceId = $event.target.value">
            <option value="">--Select a source--</option>
            <option v-for="source in sources" :value="source.id">{{source.displayName}}</option>
          </select>
        </div>
        <div class="group" v-if="selectedSourceId && selectedSource">
          <label for="query-type-select">Query type:</label>
          <select name="query-type-select" id="query-type-select" :value="selectedQueryTypeId" @change="selectedQueryTypeId = $event.target.value">
            <option value="">--Select a query type--</option>
            <option v-for="handler in selectedSource.requestHandlers" :value="handler.id">{{handler.displayName}}</option>
          </select>
        </div>
      </div>

      <div v-if="selectedRequestHandler && fieldEntries.length" class="group schema-fields">
        <div v-for="[name, schema] in fieldEntries" :key="name" class="field-row">
          <label :for="'field-' + name">
            {{ name }} <em>({{ getFieldType(schema) }})</em><span v-if="!schema.optional" title="required"> *</span>
          </label>
          <template v-if="getFieldType(schema) === 'boolean'">
            <input
              type="checkbox"
              :id="'field-' + name"
              :checked="getFieldValue(name) ?? schema.default ?? false"
              @change="setFieldValue(name, $event.target.checked)"
            />
          </template>
          <template v-else-if="getFieldType(schema) === 'number'">
            <input
              type="number"
              :id="'field-' + name"
              :value="getFieldValue(name) ?? ''"
              @change="setFieldValue(name, $event.target.value === '' ? undefined : Number($event.target.value))"
              :min="getNumberMin(schema)"
              :max="getNumberMax(schema)"
              :placeholder="schema.default !== undefined ? String(schema.default) : ''"
            />
          </template>
          <template v-else-if="getFieldType(schema) === 'enum'">
            <select
              :id="'field-' + name"
              :value="getFieldValue(name) ?? schema.default ?? ''"
              @change="setFieldValue(name, $event.target.value || undefined)"
            >
              <option value="">--None--</option>
              <option v-for="val in enumValues(schema)" :value="val">{{val}}</option>
            </select>
          </template>
          <template v-else-if="getFieldType(schema) === 'array'">
            <input
              type="text"
              :id="'field-' + name"
              :value="Array.isArray(getFieldValue(name)) ? getFieldValue(name).join(', ') : ''"
              @input="handleArrayFieldChange(name, $event)"
              placeholder="comma-separated values"
            />
          </template>
          <template v-else>
            <input
              type="text"
              :id="'field-' + name"
              :value="getFieldValue(name) ?? ''"
              @input="setFieldValue(name, $event.target.value || undefined)"
              :placeholder="schema.default !== undefined ? String(schema.default) : ''"
            />
          </template>
          <small v-if="schema.description" class="field-description">{{schema.description}}</small>
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
        <button @click="$emit('fetch')" :disabled="!requestValid">Fetch</button>
      </div>
    </div>
  `,
};
