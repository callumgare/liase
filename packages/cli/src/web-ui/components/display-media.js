import PhotoSwipeLightbox from "photoswipe/lightbox";
import { onMounted, onUnmounted, toRefs, useTemplateRef } from "vue";
import "video.js";
import MediaPreview from "./media-preview.js";
export default {
  props: ["response"],
  components: {
    MediaPreview,
  },
  setup(props) {
    const { response } = toRefs(props);
    const galleryRef = useTemplateRef("gallery");
    let lightbox = null;

    onMounted(() => {
      lightbox = new PhotoSwipeLightbox({
        gallery: galleryRef.value,
        children: "a[data-pswp-src]",
        pswpModule: () => import("photoswipe"),
      });

      lightbox.on("itemData", (e) => {
        if (!e.itemData.w || !e.itemData.h) {
          const img = e.itemData.element?.querySelector("img");
          if (img?.naturalWidth) {
            e.itemData.w = img.naturalWidth;
            e.itemData.h = img.naturalHeight;
          }
        }
      });

      lightbox.on("contentLoad", (e) => {
        const { content } = e;
        if (content.data.type !== "video") return;

        e.preventDefault();

        const container = document.createElement("div");
        container.className = "pswp__video-container";

        const videoEl = document.createElement("video");
        videoEl.className = "video-js vjs-default-skin vjs-big-play-centered";
        container.appendChild(videoEl);

        content.element = container;

        const mimeType =
          content.data.element?.dataset.pswpMediaType || "video/mp4";

        const player = window.videojs(videoEl, {
          controls: true,
          autoplay: false,
          fill: true,
          sources: [{ src: content.data.src, type: mimeType }],
        });

        content._vjsPlayer = player;
        player.ready(() => content.onLoaded());
      });

      lightbox.on("contentSetDisplayedSize", (e) => {
        if (e.content.data.type !== "video") return;
        if (e.content.element) {
          e.content.element.style.width = `${e.width}px`;
          e.content.element.style.height = `${e.height}px`;
        }
      });

      lightbox.on("contentDeactivate", ({ content }) => {
        content._vjsPlayer?.pause();
      });

      lightbox.on("contentDestroy", ({ content }) => {
        if (content._vjsPlayer) {
          content._vjsPlayer.dispose();
          content._vjsPlayer = null;
        }
      });

      lightbox.init();
    });

    onUnmounted(() => {
      lightbox?.destroy();
      lightbox = null;
    });

    return { response };
  },
  template: /* html */ `
    <ul class="DisplayMedia" ref="gallery">
      <li v-for="media in response.media" :key="media.id">
        <media-preview :media="media" />
      </li>
    </ul>
  `,
};
