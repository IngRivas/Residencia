"use client"

import { sileo } from "sileo"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CopyableTextProps {
  text: string
  className?: string
  label?: string
}

export default function CopyableText({
  text,
  className,
  label = "Texto",
}: CopyableTextProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    sileo.success({
      title: "Copiado",
      description: `${label} copiado al portapapeles.`,
    })
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span
          onClick={handleCopy}
          className={cn(
            "group -mx-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 transition-colors hover:bg-muted/80 active:bg-muted",
            className
          )}
        >
          {text}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
            />
          </svg>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">Clic para copiar</p>
      </TooltipContent>
    </Tooltip>
  )
}
