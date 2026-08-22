"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import CustomPdfViewer from "./CustomPdfViewer"

interface PdfPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  url: string | null
  title: string
}

export default function PdfPreviewModal({
  isOpen,
  onClose,
  url,
  title,
}: PdfPreviewModalProps) {
  if (!url) return null

  const downloadUrl = url.includes("?")
    ? `${url}&download=true`
    : `${url}?download=true`

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={title}
        className="m-auto flex h-[90dvh] w-[95dvw] max-w-[1400px] flex-col gap-4 overflow-hidden border-border bg-zinc-950 p-4 backdrop-blur-xl sm:max-w-[1400px] sm:rounded-xl"
      >
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-border/50 bg-zinc-900/50">
          <CustomPdfViewer url={url} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
