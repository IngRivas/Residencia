"use client"

import { useState } from "react"
import PdfPreviewModal from "./PdfPreviewModal"

interface PdfPreviewButtonProps {
  url: string
  title: string
  className?: string
  children: React.ReactNode
}

export default function PdfPreviewButton({
  url,
  title,
  className,
  children,
}: PdfPreviewButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className}
      >
        {children}
      </button>
      <PdfPreviewModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        url={url}
        title={title}
      />
    </>
  )
}
