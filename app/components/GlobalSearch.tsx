"use client"

import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"

export default function GlobalSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(searchParams?.get("search") || "")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync state if URL changes externally
  useEffect(() => {
    const currentSearch = searchParams?.get("search") || ""
    if (query !== currentSearch) {
      setQuery(currentSearch)
    }
  }, [searchParams])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      if (!searchParams) return
      const currentSearch = searchParams.get("search") || ""

      // Avoid infinite loop by only pushing if the query is actually different from the URL
      if (query.trim() === currentSearch) return

      const params = new URLSearchParams(searchParams.toString())
      if (query.trim()) {
        params.set("search", query.trim())
      } else {
        params.delete("search")
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, pathname, router, searchParams])

  const handleOpenChange = (val: boolean) => {
    setOpen(val)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="flex h-full w-full items-center justify-center border-none bg-transparent text-inherit transition-colors outline-none"
          title="Buscar en esta página"
        >
          <Search className="h-6 w-6 shrink-0" />
        </button>
      </DialogTrigger>
      {/* Remove backdrop opacity if possible, or just keep it default. We add a custom overlay class to hide backdrop to see results */}
      <DialogContent
        title="Buscar en esta página"
        className="border-border bg-background text-foreground shadow-2xl sm:max-w-md"
      >
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="h-12 rounded-xl border-border bg-card pl-9 text-lg text-foreground"
            autoFocus
          />
        </div>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          Los resultados se filtrarán automáticamente en la página actual.
        </p>
      </DialogContent>
    </Dialog>
  )
}
