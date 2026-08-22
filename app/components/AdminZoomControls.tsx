"use client"

import { useState, useEffect } from "react"
import { updateUserTextZoom } from "@/lib/actions/users"
import Magnet from "@/app/components/Magnet"

interface AdminZoomControlsProps {
  userId?: string
  initialTextZoom?: number
  targetId?: string
}

export default function AdminZoomControls({
  userId,
  initialTextZoom = 0,
  targetId,
}: AdminZoomControlsProps) {
  const [textSize, setTextSize] = useState(initialTextZoom)

  useEffect(() => {
    const smallClass = "text-small-mode"
    const largeClass = "text-large-mode"
    const xlargeClass = "text-xlarge-mode"

    const root = targetId
      ? document.getElementById(targetId)
      : document.documentElement

    if (!root) return

    root.classList.remove(smallClass, largeClass, xlargeClass)

    if (textSize === -1) root.classList.add(smallClass)
    else if (textSize === 1) root.classList.add(largeClass)
    else if (textSize === 2) root.classList.add(xlargeClass)
  }, [textSize, targetId])

  const handleZoomIn = () => {
    const next = Math.min(textSize + 1, 2)
    if (next !== textSize) {
      setTextSize(next)
      if (userId && !targetId) {
        updateUserTextZoom(userId, next).catch(console.error)
      }
    }
  }

  const handleZoomOut = () => {
    const next = Math.max(textSize - 1, -1)
    if (next !== textSize) {
      setTextSize(next)
      if (userId && !targetId) {
        updateUserTextZoom(userId, next).catch(console.error)
      }
    }
  }

  return (
    <Magnet padding={20} magnetStrength={3}>
      <div className="flex items-center overflow-hidden rounded-lg border border-black bg-black">
        <button
          onClick={handleZoomOut}
          className="p-1.5 text-white/60 transition-colors hover:bg-zinc-900 hover:text-white"
          title={
            targetId ? "Tabla: Disminuir tamaño" : "Página: Disminuir tamaño"
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 12h-15"
            />
          </svg>
        </button>
        <div className="h-5 w-px bg-zinc-800" />
        <button
          onClick={handleZoomIn}
          className="p-1.5 text-white/60 transition-colors hover:bg-zinc-900 hover:text-white"
          title={
            targetId ? "Tabla: Aumentar tamaño" : "Página: Aumentar tamaño"
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </button>
      </div>
    </Magnet>
  )
}
