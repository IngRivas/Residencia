"use client"

import React from "react"
import { TiltCard } from "@/components/ui/tilt-card"
import { formatCurrency } from "@/lib/formatters"
import { cn } from "@/lib/utils"

interface ObraSummaryCardProps {
  nombre: string
  totalBruto: number
  isActive: boolean
  onClick?: () => void
  className?: string
  isInner?: boolean
}

export function ObraSummaryCard({
  nombre,
  totalBruto,
  isActive,
  onClick,
  className,
  isInner = false,
}: ObraSummaryCardProps) {
  return (
    <TiltCard
      max={30}
      onClick={onClick}
      className={cn("cursor-pointer select-none", className)}
      cardClassName={cn(
        "rounded-2xl p-5 w-full min-w-[220px] h-[140px] flex flex-col justify-between text-white transition-transform duration-300 hover:scale-[1.02]",
        isInner ? "bg-zinc-700" : "bg-zinc-800",
        !isActive && "opacity-60 grayscale-[50%]",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white uppercase tracking-widest truncate pr-2" title={nombre}>
          {nombre}
        </span>
      </div>
      <div className="flex flex-col pointer-events-none">
        <span className="text-xs font-semibold text-white uppercase tracking-widest mb-1">
          Total Gasto
        </span>
        <span className="text-2xl font-black tracking-tight text-white truncate" title={formatCurrency(totalBruto)}>
          {formatCurrency(totalBruto)}
        </span>
      </div>
    </TiltCard>
  )
}
