"use client"

import { useState } from "react"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"
import { Button } from "@/components/ui/button"

interface GastoImagesViewerProps {
  fotos: { url: string }[]
}

export default function GastoImagesViewer({ fotos }: GastoImagesViewerProps) {
  const [open, setOpen] = useState(false)

  if (!fotos || fotos.length === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[9px] font-bold tracking-wider text-muted-foreground/40 uppercase"
        title="Sin imágenes"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
          className="h-3 w-3"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
          />
        </svg>
        0
      </span>
    )
  }

  const slides = fotos.map((f) => ({ src: f.url }))

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[9px] font-bold tracking-wider text-primary uppercase transition-colors hover:text-primary/80"
        onClick={() => setOpen(true)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
          className="h-3 w-3"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
          />
        </svg>
        {fotos.length}
      </button>

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        slides={slides}
        carousel={{ finite: slides.length <= 1 }}
        styles={{
          container: { backgroundColor: "rgba(0,0,0,0.95)" },
        }}
      />
    </>
  )
}
