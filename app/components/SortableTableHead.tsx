"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react"
import { TableHead } from "@/components/ui/table"

interface SortableTableHeadProps {
  column: string
  label: string
  icon?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export default function SortableTableHead({ column, label, icon, className, style }: SortableTableHeadProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const currentSortBy = searchParams.get("sortBy")
  const currentSortOrder = searchParams.get("sortOrder")

  const handleSort = () => {
    const params = new URLSearchParams(searchParams.toString())

    if (currentSortBy === column) {
      if (currentSortOrder === "asc") {
        params.set("sortOrder", "desc")
      } else {
        params.delete("sortBy")
        params.delete("sortOrder")
      }
    } else {
      params.set("sortBy", column)
      params.set("sortOrder", "asc")
    }
    
    router.push(`${pathname}?${params.toString()}`)
  }

  const renderSortIcon = () => {
    if (currentSortBy !== column) {
      return <ArrowUpDown className="ml-1.5 inline-block h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
    }
    return currentSortOrder === "desc" ? (
      <ChevronDown className="ml-1.5 inline h-4 w-4 text-blue-400" />
    ) : (
      <ChevronUp className="ml-1.5 inline h-4 w-4 text-blue-400" />
    )
  }

  return (
    <TableHead onClick={handleSort} className={`cursor-pointer group text-white transition-colors select-none hover:bg-white/5 ${className || ""}`} style={style}>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-white/70">{icon}</span>}
        <span className="text-white">{label}</span>
        {renderSortIcon()}
      </div>
    </TableHead>
  )
}
