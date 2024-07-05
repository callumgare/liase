'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { GenericFile, GenericMedia } from "media-finder"

type File = GenericFile & {displayElm: "video" | "img"}

export default function MediaPreview({media}: {media: GenericMedia}) {
    const fileTypeOrder = ["thumbnail", "full", "main"]
    const files: File[] = media.files.map(file => ({
        ...file,
        displayElm: (file.video && file.ext !== "gif") ? "video" : "img"
    }))

    let fileTypes: any = new Set(files.map(file => file.type))
    fileTypes = [...fileTypes]
    fileTypes.sort((a: any, b: any) => (
        (fileTypeOrder.indexOf(a) !== -1 ? fileTypeOrder.indexOf(a) : fileTypeOrder.length)
        -  
        (fileTypeOrder.indexOf(b) !== -1 ? fileTypeOrder.indexOf(b) : fileTypeOrder.length)
    ))

    const [displayedFileType, setDisplayedFileType] = useState(fileTypes[0])

    const file = files.find(file => file.type === displayedFileType)

    function toggleToNextDisplayFileType() {
        setDisplayedFileType(
            fileTypes.at(
                (fileTypes.indexOf(displayedFileType) + 1) % fileTypes.length
            )
        )
    }

    const [mediaRef, containerRef] = useMediaSizeLockWhenLoading()

    function renderFile(file: File) {
        if (file.displayElm === "video") {
            return <video ref={mediaRef} key={file.url} autoPlay={true}>
                <source src={file.url} />
            </video>
        } else if (file.displayElm === "img") {
            // eslint-disable-next-line @next/next/no-img-element -- We can't use <Image /> since we're loading third-party images and generally have no idea what size they are
            return <img ref={mediaRef} key={file.url} src={file.url} alt="" />
        } else {
            return <div key={file.url}>
                Unsupported: <pre>{JSON.stringify(file, null, 2)}</pre>
            </div>
        }

    }
    return <div onClick={toggleToNextDisplayFileType} ref={elm => {containerRef.current = elm}}>
        {file && renderFile(file)}
    </div>
}


const useMediaLoaded = () => {
    const [loaded, setLoaded] = useState(false)
    const refLoaded = useRef(false)

    const onLoad = () => {
        if (!refLoaded.current) {
            refLoaded.current = true
            setLoaded(true)
        }
    }

    const onUnload = () => {
        if (refLoaded.current) {
            refLoaded.current = false
            setLoaded(false)
        }
    }

    const ref = useCallback((mediaElm: HTMLVideoElement | HTMLImageElement | null) => {
        // If node is null then the component it was attached to was unmounted
        if (mediaElm !== null) {
            if (mediaElm instanceof HTMLImageElement) {
                mediaElm.addEventListener('load', () => onLoad)
                mediaElm.addEventListener('error', (error) => console.error("Error when loading media:", error))
                const intervalId = setInterval(
                    () => {
                        if (mediaElm.naturalHeight) {
                            onLoad()
                            clearInterval(intervalId)
                        }
                    },
                    100
                )
                if (mediaElm?.complete) {
                    onLoad()
                } else if (mediaElm?.complete === false) {
                    onUnload()
                }

            } else if (mediaElm instanceof HTMLVideoElement) {
                mediaElm.addEventListener("loadedmetadata", onLoad)

                if (mediaElm.readyState >= HTMLMediaElement.HAVE_METADATA) {
                    onLoad();
                } else if (mediaElm.readyState < HTMLMediaElement.HAVE_METADATA) {
                    onUnload()
                }
            }
        }
    }, []);

    return [ref, loaded] as const
}


const useMediaSizeLockWhenLoading = () => {
    const [mediaRef, mediaLoaded] = useMediaLoaded()

    const containerRef = useRef<HTMLElement | null>(null)
    const lockedContainerSizeRef = useRef({width: 0, height: 0})

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
                containerRef.current.style.width = `${lockedContainerSizeRef.current.width}px`
                containerRef.current.style.height = `${lockedContainerSizeRef.current.height}px`
                containerRef.current.style.opacity = `0`
            }
        }
    }, [mediaLoaded])

    return [mediaRef, containerRef, mediaLoaded] as const
}