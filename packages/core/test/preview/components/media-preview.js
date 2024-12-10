import { ref, useTemplateRef, computed, onMounted } from "vue";
import "hls.js";
export default {
  props: ["media"],
  setup(props) {
    const maxHeight = computed(() =>
      Math.max(...props.media.files.map((file) => file.height || 0)),
    );

    const thumbnailDisplayHeight = 200;
    const fileSortWeight = (file) => {
      let weight = file.height
        ? Math.abs(file.height - thumbnailDisplayHeight) /
          Math.max(maxHeight.value, thumbnailDisplayHeight)
        : 1;
      if (!file.hasVideo) weight += 1;
      return weight;
    };

    const files = computed(
      () =>
        props.media.files?.toSorted(
          (a, b) => fileSortWeight(a) - fileSortWeight(b),
        ) || [],
    );

    const displayElement = computed(() =>
      files.value.some((file) => file.video && file.ext !== "gif")
        ? "video"
        : "image",
    );
    const videoFile = computed(() =>
      files.value.find((file) => file.video && file.ext !== "gif"),
    );
    const imageFile = computed(() =>
      files.value.find((file) => file.image || file.ext === "gif"),
    );

    const getSrc = (file) =>
      `${document.location.origin}/file/${props.media.id}/${file?.id}/${file?.url}`;

    const posterSrc = computed(() => {
      if (imageFile.value) {
        return getSrc(imageFile.value);
      } else if (videoFile.value) {
        return `${document.location.origin}/file/poster/${props.media.id}/${videoFile.value?.id}/${thumbnailDisplayHeight}`;
      } else {
        return "";
      }
    });

    const videoRef = useTemplateRef("video-elm");

    onMounted(() => {
      const file = videoFile.value;

      if (!file || videoRef.value === null) {
        return;
      }

      if (file.ext === "m3u8") {
        if (videoRef.value.canPlayType("application/vnd.apple.mpegurl")) {
          videoRef.value.src = file.url;
        } else if (window.Hls.isSupported()) {
          const hls = new window.Hls();
          hls.loadSource(file.url);
          hls.attachMedia(videoRef.value);
        } else {
          throw Error("Browser can't play HLS");
        }
      } else {
        videoRef.value.src = file.url;
      }
    });

    const hoverOverPlayCountdown = ref(null);
    function handleMouseEnter() {
      hoverOverPlayCountdown.value = setTimeout(
        () => videoRef.value?.play(),
        300,
      );
    }
    function handleMouseLeave() {
      clearTimeout(hoverOverPlayCountdown.value);
      videoRef.value?.pause();
    }
    return {
      displayElement,
      imageFile,
      videoFile,
      handleMouseEnter,
      handleMouseLeave,
      posterSrc,
    };
  },
  template: /* html */ `
    <div
      class="MediaPreview"
    >
      <video
        v-if="displayElement === 'video'"
        ref="video-elm"
        preload="none"
        playsinline="true"
        muted="true"
        :poster="imageFile?.url"
        :style="{'aspect-ratio': videoFile.aspectRatio.width + ' / ' + videoFile.aspectRatio.height}"
        controls="true"
      ></video>
      <img
        v-else-if="displayElement === 'image'"
        :src="imageFile.url"
      >
      <div v-else>
        Unknown display type {{ displayElement }}
      </div>
      <div class="info">
        {{ media.title }}
      </div>
    </div>
  `,
};
