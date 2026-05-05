'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { GenericFile, GenericMedia } from "media-finder"
import VideoPlayer, {MuxPlayerRefAttributes} from '@mux/mux-player-react';

import style from "./MediaPreview.module.css";

type File = GenericFile & {displayElm: "video" | "img"}

export default function MediaPreview({media}: {media: GenericMedia}) {
    const fileTypeOrder = ["full", "main", "thumbnail"]
    const files: File[] = media.files.map(file => ({
        ...file,
        displayElm: (file.video && file.ext !== "gif") ? "video" : "img"
    }))

    files.sort((a: any, b: any) => (
        (fileTypeOrder.indexOf(a.type) !== -1 ? fileTypeOrder.indexOf(a.type) : fileTypeOrder.length)
        -  
        (fileTypeOrder.indexOf(b.type) !== -1 ? fileTypeOrder.indexOf(b.type) : fileTypeOrder.length)
    ))

    let displayElms: any = new Set(files.map(file => file.displayElm))
    displayElms = [...displayElms]

    const displayElmsOrder = ["img", "video"]
    displayElms.sort((a: any, b: any) => (
        (displayElmsOrder.indexOf(a) !== -1 ? displayElmsOrder.indexOf(a) : displayElmsOrder.length)
        -  
        (displayElmsOrder.indexOf(b) !== -1 ? displayElmsOrder.indexOf(b) : displayElmsOrder.length)
    ))

    const [displayedElm, setDisplayedElm] = useState(displayElms[0])

    const file = files.find(file => file.displayElm === displayedElm)

    const {mediaRef, containerRef, lockSize} = useMediaSizeLockWhenLoading()

    function toggleToNextDisplayFileType() {
        lockSize()
        setDisplayedElm(
            displayElms.at(
                Math.min(
                    displayElms.indexOf(displayedElm) + 1,
                    displayElms.length - 1
                )
            )
        )
    }


    function renderFile(file: File) {
        if (file.displayElm === "video") {
            return <VideoPlayer ref={mediaRef} src={file.url} autoPlay={displayElms.indexOf(displayedElm) > 0} />
        } else if (file.displayElm === "img") {
            // eslint-disable-next-line @next/next/no-img-element -- We can't use <Image /> since we're loading third-party images and generally have no idea what size they are
            return <img ref={mediaRef} key={file.url} src={file.url} alt="" />
        } else {
            return <div key={file.url}>
                Unsupported: <pre>{JSON.stringify(file, null, 2)}</pre>
            </div>
        }

    }
    return (
        <div
            onClick={toggleToNextDisplayFileType}
            ref={elm => {containerRef.current = elm}}
            className={style.root}
        >
            {file && renderFile(file)}
        </div>
    )
}


const useMediaLoaded = () => {
    const [loadedState, setLoadedState] = useState(false)
    const loadedRef = useRef(loadedState)
    const [mediaSrcState, setMediaSrcState] = useState<string>()
    const mediaSrcRef = useRef(mediaSrcState)

    const setLoaded = (loaded: boolean) => {
        if (loadedRef.current !== loaded) {
            loadedRef.current = loaded
            setLoadedState(loaded)
        }
    }

    const setMediaSrc = (src?: string) => {
        if (mediaSrcRef.current !== src) {
            mediaSrcRef.current = src
            setMediaSrcState(src)
        }
    }

    const previousRefValue = useRef<MuxPlayerRefAttributes | HTMLImageElement | null>(null)

    const mediaRef = useCallback((mediaElm: MuxPlayerRefAttributes | HTMLImageElement | null) => {
        if (mediaElm === previousRefValue.current) {
            return
        }
        // If node is null then the component it was attached to was unmounted
        if (mediaElm !== null) {
            setMediaSrc(mediaElm.src)
            if (mediaElm instanceof HTMLImageElement) {
                mediaElm.addEventListener('load', () => setLoaded(true))
                mediaElm.addEventListener('error', (error) => console.error("Error when loading media:", error))
                const intervalId = setInterval(
                    () => {
                        if (mediaElm.naturalHeight) {
                            setLoaded(true)
                            clearInterval(intervalId)
                        }
                    },
                    100
                )
                if (mediaElm?.complete) {
                    setLoaded(true)
                } else if (mediaElm?.complete === false) {
                    setLoaded(false)
                }

            } else {
                setMediaSrc(mediaElm.src)
                mediaElm.addEventListener("loadedmetadata", () => setLoaded(true))

                if (mediaElm.readyState >= HTMLMediaElement.HAVE_METADATA) {
                    setLoaded(true);
                } else if (mediaElm.readyState < HTMLMediaElement.HAVE_METADATA) {
                    setLoaded(false)
                }
            }
        } else {
            setMediaSrc(undefined)
            setLoaded(false)
        }
        previousRefValue.current = mediaElm
    }, []);

    return {mediaRef, loaded: loadedState, mediaSrc: mediaSrcState}
}


const useMediaSizeLockWhenLoading = () => {
    const {mediaRef, loaded: mediaLoaded, mediaSrc} = useMediaLoaded()

    const containerRef = useRef<HTMLElement | null>(null)
    const lockedContainerSizeRef = useRef({width: 0, height: 0})

    function lockSize() {
        if (containerRef.current) {
            if (lockedContainerSizeRef.current.width) containerRef.current.style.width = `${lockedContainerSizeRef.current.width}px`
            if (lockedContainerSizeRef.current.height) containerRef.current.style.height = `${lockedContainerSizeRef.current.height}px`
        }
    }

    useEffect(() => {
        if (containerRef.current) {
            if (mediaLoaded) {
                containerRef.current.style.width = ""
                containerRef.current.style.height = ""
                containerRef.current.style.opacity = ""
                const containerSize = containerRef.current.getBoundingClientRect()
                lockedContainerSizeRef.current.width = containerSize.width
                lockedContainerSizeRef.current.height = containerSize.height
            } else {
                lockSize()
            }
        }
    }, [mediaLoaded, mediaSrc])

    return {mediaRef, containerRef, lockSize, mediaLoaded} as const
}