"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Filter } from "lucide-react"

export default function TableSortDropdown() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  // Only show this on pages that have tables (dashboard and archive)
  if (pathname !== "/admin" && pathname !== "/admin/archivo") {
    return null
  }

  const handleSort = (sortBy: string, explicitOrder?: "asc" | "desc") => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("sortBy", sortBy)

    if (explicitOrder) {
      params.set("sortOrder", explicitOrder)
    } else {
      // Toggle sort order if already sorting by this
      if (searchParams.get("sortBy") === sortBy) {
        params.set(
          "sortOrder",
          searchParams.get("sortOrder") === "desc" ? "asc" : "desc"
        )
      } else {
        params.set("sortOrder", "desc") // Default to desc for new sort
      }
    }

    router.push(`${pathname}?${params.toString()}`)
  }

  const activeSort = searchParams.get("sortBy")
  const activeOrder = searchParams.get("sortOrder")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-card px-4 text-sm font-semibold text-foreground/90 transition-all hover:bg-muted"
          title="Filtrar / Ordenar Tabla"
        >
          <Filter className="h-4 w-4" />
          <span>Filtrar</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={20}
        className="w-48 border-none shadow-none bg-background text-sm text-foreground"
      >
        <DropdownMenuItem
          onClick={() => handleSort("nombre", "asc")}
          className={`cursor-pointer ${
            (activeSort === "nombre" && activeOrder === "asc") || !activeSort
              ? "bg-muted font-bold text-blue-400"
              : ""
          }`}
        >
          Alfabético Ascendente (A-Z)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSort("nombre", "desc")}
          className={`cursor-pointer ${
            activeSort === "nombre" && activeOrder === "desc"
              ? "bg-muted font-bold text-blue-400"
              : ""
          }`}
        >
          Alfabético Descendente (Z-A)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSort("presupuesto")}
          className={`cursor-pointer ${activeSort === "presupuesto" ? "bg-muted font-bold text-blue-400" : ""}`}
        >
          Por Presupuesto
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSort("gastado")}
          className={`cursor-pointer ${activeSort === "gastado" ? "bg-muted font-bold text-blue-400" : ""}`}
        >
          Por Total Gastado
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSort("saldo")}
          className={`cursor-pointer ${activeSort === "saldo" ? "bg-muted font-bold text-blue-400" : ""}`}
        >
          Por Saldo Restante
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSort("fecha")}
          className={`cursor-pointer ${activeSort === "fecha" ? "bg-muted font-bold text-blue-400" : ""}`}
        >
          Por Fecha
        </DropdownMenuItem>

        {activeSort && (
          <>
            <div className="my-1 h-px bg-border" />
            <DropdownMenuItem
              onClick={() => router.push(pathname)}
              className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              Limpiar Filtros
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
