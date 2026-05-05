"use client";

import type { GenericFile, GenericMedia } from "@liason/core";
import VideoPlayer, {
  type MuxPlayerRefAttributes,
} from "@mux/mux-player-react";
import { useCallback, useEffect, useRef, useState } from "react";

import style from "./MediaPreview.module.css";

type File = GenericFile & { displayElm: "video" | "img" };

export default function MediaPreview({ media }: { media: GenericMedia }) {
  const fileTypeOrder = ["full", "main", "thumbnail"];
  const files: File[] = media.files.map((file) => ({
    ...file,
    displayElm: file.video && file.ext !== "gif" ? "video" : "img",
  }));

  files.sort(
    (a: File, b: File) =>
      (fileTypeOrder.indexOf(a.type) !== -1
        ? fileTypeOrder.indexOf(a.type)
        : fileTypeOrder.length) -
      (fileTypeOrder.indexOf(b.type) !== -1
        ? fileTypeOrder.indexOf(b.type)
        : fileTypeOrder.length),
  );

  const displayElms: Array<"img" | "video"> = Array.from(
    new Set(files.map((file) => file.displayElm)),
  );

  const displayElmsOrder = ["img", "video"];
  displayElms.sort(
    (a: string, b: string) =>
      (displayElmsOrder.indexOf(a) !== -1
        ? displayElmsOrder.indexOf(a)
        : displayElmsOrder.length) -
      (displayElmsOrder.indexOf(b) !== -1
        ? displayElmsOrder.indexOf(b)
        : displayElmsOrder.length),
  );

  const [displayedElm, setDisplayedElm] = useState(displayElms[0]);

  const file = files.find((file) => file.displayElm === displayedElm);

  const { mediaRef, containerRef, lockSize } = useMediaSizeLockWhenLoading();

  function toggleToNextDisplayFileType() {
    lockSize();
    setDisplayedElm(
      displayElms[
        Math.min(displayElms.indexOf(displayedElm) + 1, displayElms.length - 1)
      ],
    );
  }

  function renderFile(file: File) {
    if (file.displayElm === "video") {
      return (
        <VideoPlayer
          ref={mediaRef}
          src={file.url}
          autoPlay={displayElms.indexOf(displayedElm) > 0}
        />
      );
    }
    if (file.displayElm === "img") {
      // eslint-disable-next-line @next/next/no-img-element -- We can't use <Image /> since we're loading third-party images and generally have no idea what size they are
      return <img ref={mediaRef} key={file.url} src={file.url} alt="" />;
    }
    return (
      <div key={file.url}>
        Unsupported: <pre>{JSON.stringify(file, null, 2)}</pre>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={toggleToNextDisplayFileType}
      ref={(elm) => {
        containerRef.current = elm;
      }}
      className={style.root}
    >
      {file && renderFile(file)}
    </button>
  );
}

const useMediaLoaded = () => {
  const [loadedState, setLoadedState] = useState(false);
  const loadedRef = useRef(loadedState);
  const [mediaSrcState, setMediaSrcState] = useState<string>();
  const mediaSrcRef = useRef(mediaSrcState);

  const setLoaded = useCallback((loaded: boolean) => {
    if (loadedRef.current !== loaded) {
      loadedRef.current = loaded;
      setLoadedState(loaded);
    }
  }, []);

  const setMediaSrc = useCallback((src?: string) => {
    if (mediaSrcRef.current !== src) {
      mediaSrcRef.current = src;
      setMediaSrcState(src);
    }
  }, []);

  const previousRefValue = useRef<
    MuxPlayerRefAttributes | HTMLImageElement | null
  >(null);

  const mediaRef = useCallback(
    (mediaElm: MuxPlayerRefAttributes | HTMLImageElement | null) => {
      if (mediaElm === previousRefValue.current) {
        return;
      }
      // If node is null then the component it was attached to was unmounted
      if (mediaElm !== null) {
        setMediaSrc(mediaElm.src);
        if (mediaElm instanceof HTMLImageElement) {
          mediaElm.addEventListener("load", () => setLoaded(true));
          mediaElm.addEventListener("error", (error) =>
            console.error("Error when loading media:", error),
          );
          const intervalId = setInterval(() => {
            if (mediaElm.naturalHeight) {
              setLoaded(true);
              clearInterval(intervalId);
            }
          }, 100);
          if (mediaElm?.complete) {
            setLoaded(true);
          } else if (mediaElm?.complete === false) {
            setLoaded(false);
          }
        } else {
          setMediaSrc(mediaElm.src);
          mediaElm.addEventListener("loadedmetadata", () => setLoaded(true));

          if (mediaElm.readyState >= HTMLMediaElement.HAVE_METADATA) {
            setLoaded(true);
          } else if (mediaElm.readyState < HTMLMediaElement.HAVE_METADATA) {
            setLoaded(false);
          }
        }
      } else {
        setMediaSrc(undefined);
        setLoaded(false);
      }
      previousRefValue.current = mediaElm;
    },
    [setLoaded, setMediaSrc],
  );

  return { mediaRef, loaded: loadedState, mediaSrc: mediaSrcState };
};

const useMediaSizeLockWhenLoading = () => {
  const { mediaRef, loaded: mediaLoaded, mediaSrc } = useMediaLoaded();

  const containerRef = useRef<HTMLElement | null>(null);
  const lockedContainerSizeRef = useRef({ width: 0, height: 0 });

  const lockSize = useCallback(() => {
    if (containerRef.current) {
      if (lockedContainerSizeRef.current.width)
        containerRef.current.style.width = `${lockedContainerSizeRef.current.width}px`;
      if (lockedContainerSizeRef.current.height)
        containerRef.current.style.height = `${lockedContainerSizeRef.current.height}px`;
    }
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      if (mediaLoaded) {
        containerRef.current.style.width = "";
        containerRef.current.style.height = "";
        containerRef.current.style.opacity = "";
        const containerSize = containerRef.current.getBoundingClientRect();
        lockedContainerSizeRef.current.width = containerSize.width;
        lockedContainerSizeRef.current.height = containerSize.height;
      } else {
        lockSize();
      }
    }
  }, [mediaLoaded, lockSize]);

  return { mediaRef, containerRef, lockSize, mediaLoaded } as const;
};
