import { computed, onMounted, ref, useTemplateRef } from "vue";
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

		const mediaAsset = computed(
			() =>
				(props.media.assets?.media || props.media.files || []).toSorted(
					(a, b) =>
						// Listed in order of importance from most important to least important
						(b.videoCodec !== "hevc") - (a.videoCodec !== "hevc") || // Non-hevc streams preferred
						(b.isOriginalTranscode ?? false) -
							(a.isOriginalTranscode ?? false) || // isOriginalTranscode preferred
						(b.mimeType === "application/vnd.apple.mpegurl") -
							(a.mimeType === "application/vnd.apple.mpegurl") || // HLS preferred
						(b.isOriginalResolution ?? false) -
							(a.isOriginalResolution ?? false) || // isOriginalResolution preferred
						(b.duration ?? 0) - (a.duration ?? 0), // duration descending
				)[0],
		);

		const previewAsset = computed(
			() =>
				(
					props.media.assets?.preview ||
					props.media.files?.filter((file) => file.image) ||
					[]
				).toSorted(
					(a, b) =>
						// Listed in order of importance from most important to least important
						fileSortWeight(a) - fileSortWeight(b), // How close the size it to the displayed size from closest to furthest
				)[0],
		);

		const displayElement = computed(() =>
			mediaAsset.value?.video && mediaAsset.value?.ext !== "gif"
				? "video"
				: "image",
		);

		const videoRef = useTemplateRef("video-elm");

		onMounted(() => {
			const file = mediaAsset.value;

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
			mediaAsset,
			previewAsset,
			handleMouseEnter,
			handleMouseLeave,
		};
	},
	template: /* html */ `
    <div
      class="MediaPreview"
    >
			<div
				v-if="displayElement === 'video'"
				class="videoContainer"
			>
				<video
					ref="video-elm"
					preload="none"
					playsinline="true"
					muted="true"
					:poster="previewAsset?.url"
					:style="mediaAsset.aspectRatio ? {'aspect-ratio': mediaAsset.aspectRatio.width + ' / ' + mediaAsset.aspectRatio.height} : {}"
					controls="true"
				></video>
				<img
					v-if="previewAsset"
					:src="previewAsset?.url"
				>
			</div>
      <img
        v-else-if="displayElement === 'image'"
        :src="mediaAsset?.url"
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
