"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { updateUserTextZoom } from "@/lib/actions/users"

interface CapturaHeaderMenuProps {
  userId?: string
  initialTextZoom?: number
}

export default function CapturaHeaderMenu({
  userId,
  initialTextZoom = 0,
}: CapturaHeaderMenuProps) {
  const [textSize, setTextSize] = useState(initialTextZoom)

  function getZoomValue(size: number): string {
    if (size <= -1) return "1.0"
    if (size === 1) return "1.2"
    if (size >= 2) return "1.3"
    return "1.1" // default (0)
  }

  useEffect(() => {
    const root = document.documentElement
    root.style.zoom = getZoomValue(textSize)
  }, [textSize])

  const handleZoomIn = () => {
    const next = Math.min(textSize + 1, 2)
    if (next !== textSize) {
      setTextSize(next)
      if (userId) {
        updateUserTextZoom(userId, next).catch(console.error)
      }
    }
  }

  const handleZoomOut = () => {
    const next = Math.max(textSize - 1, -1)
    if (next !== textSize) {
      setTextSize(next)
      if (userId) {
        updateUserTextZoom(userId, next).catch(console.error)
      }
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center overflow-hidden rounded-lg border border-border bg-card">
        <button
          onClick={handleZoomOut}
          className="p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Disminuir Letra"
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
        <div className="h-5 w-px bg-muted" />
        <button
          onClick={handleZoomIn}
          className="p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Aumentar Letra"
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="rounded-lg border border-transparent p-2 text-muted-foreground transition-all hover:border-border/80 hover:bg-muted/50 hover:text-foreground"
            aria-label="Menú de opciones"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="mt-1 w-52 animate-in rounded-xl border-border bg-background/95 p-1.5 text-foreground/80 shadow-2xl backdrop-blur-xl duration-200 zoom-in-95 fade-in"
        >
          <DropdownMenuItem
            asChild
            className="group cursor-pointer rounded-lg px-3 py-3 transition-colors focus:bg-muted focus:text-foreground"
          >
            <Link
              href="/captura/historial"
              className="flex w-full items-center"
            >
              <div className="mr-3 rounded-md bg-muted/50 p-1.5 transition-colors group-hover:bg-muted">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="h-4 w-4 text-foreground/80"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              </div>
              <span className="text-sm font-medium text-foreground/90">
                Historial de Gastos
              </span>
            </Link>
          </DropdownMenuItem>

          <div className="mx-2 my-1.5 h-px bg-muted/60" />

          <DropdownMenuItem
            onClick={async () => {
              await signOut({ callbackUrl: "/login" })
            }}
            className="mt-1 cursor-pointer border-t border-border py-2.5 text-rose-500 focus:bg-rose-500/10 focus:text-rose-400"
          >
            <div className="mr-3 rounded-md bg-rose-500/10 p-1.5 transition-colors group-hover:bg-rose-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-4 w-4 text-rose-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
                />
              </svg>
            </div>
            <span className="text-sm font-medium">Cerrar Sesión</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
