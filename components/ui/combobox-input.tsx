"use client"

import React, { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface ComboboxInputProps {
  label: string
  value: string
  onChange: (val: string) => void
  options: string[]
  placeholder?: string
  required?: boolean
  className?: string
  autoComplete?: string
}

export function ComboboxInput({
  label,
  value,
  onChange,
  options,
  placeholder = "Escribir o seleccionar...",
  required = false,
  className = "",
  autoComplete
}: ComboboxInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)

  // Calculate position
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }, [isOpen])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (inputRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  const filteredOptions = options
    .filter((nombre, index, self) => 
      self.indexOf(nombre) === index && 
      nombre.toLowerCase().includes(value.toLowerCase())
    )
    .sort((a, b) => a.localeCompare(b))

  useEffect(() => {
    setSelectedIndex(-1)
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsOpen(true)
      }
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev))
    } else if (e.key === "Enter" && selectedIndex >= 0 && selectedIndex < filteredOptions.length) {
      e.preventDefault()
      onChange(filteredOptions[selectedIndex])
      setIsOpen(false)
    } else if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    if (isOpen && selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" })
    }
  }, [selectedIndex, isOpen])

  return (
    <div className={`relative space-y-1.5 ${className}`}>
      <Label className="text-[10px] font-semibold text-muted-foreground uppercase">{label}</Label>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-[36px] w-full rounded-2xl bg-muted/60 px-3 py-2 text-xs text-foreground transition-colors focus:ring-1 focus:ring-primary/20 border-none"
          required={required}
        />
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      {isOpen && dropdownRect && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            zIndex: 9999,
          }}
          className="max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-border/50 bg-popover shadow-2xl p-1.5 space-y-0.5"
        >
          {filteredOptions.map((nombre, idx) => (
            <button
              key={idx}
              ref={el => { itemRefs.current[idx] = el }}
              type="button"
              className={cn(
                "flex w-full items-center min-h-[36px] truncate rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted/80 hover:text-foreground",
                selectedIndex === idx ? "bg-muted/80 text-foreground" : "text-foreground/90"
              )}
              onClick={() => {
                onChange(nombre)
                setIsOpen(false)
              }}
            >
              {nombre}
            </button>
          ))}
          {filteredOptions.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
              Presiona enter para agregar nuevo
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
