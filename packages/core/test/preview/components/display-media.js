import { toRefs } from "vue";
import MediaPreview from "./media-preview.js";
export default {
  props: ["response"],
  components: {
    MediaPreview,
  },
  setup(props) {
    const { response } = toRefs(props);
    return { response };
  },
  template: /* html */ `
    <ul class="DisplayMedia">
      <li v-for="media in response.media" :key="media.id">
        <media-preview :media="media" />
      </li>
    </ul>
  `,
};
