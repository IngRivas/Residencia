"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { sileo } from "sileo"
import { getRoleSchedule, updateRoleSchedule } from "@/lib/actions/roles"

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"))
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"))

type ScheduleBlock = {
  id: string
  start: string | null
  end: string | null
  days: number[]
}

export default function HorariosCapturistasModal() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const router = useRouter()

  // State for multiple schedules
  const [schedules, setSchedules] = useState<ScheduleBlock[]>([
    { id: "1", start: null, end: null, days: [1, 2, 3, 4, 5] }
  ])
  const [activeBlockId, setActiveBlockId] = useState<string>("1")
  
  // Tab for "start" or "end" time of the current block
  const [activeTab, setActiveTab] = useState<"start" | "end">("start")

  useEffect(() => {
    let isMounted = true
    const fetchSchedule = async () => {
      if (open) {
        setFetching(true)
        try {
          const res = await getRoleSchedule("CAPTURISTA")
          if (isMounted) {
            if (res.schedules && res.schedules.length > 0) {
              const loaded = res.schedules.map((s: any, i: number) => ({
                id: String(i + 1),
                start: s.start || null,
                end: s.end || null,
                days: s.days || []
              }))
              setSchedules(loaded)
              setActiveBlockId(loaded[0].id)
            } else {
              setSchedules([{ id: "1", start: null, end: null, days: [1, 2, 3, 4, 5] }])
              setActiveBlockId("1")
            }
            setActiveTab("start")
          }
        } catch (err) {
          if (isMounted && err instanceof Error) {
            sileo.error({ title: "Error", description: err.message })
          }
        } finally {
          if (isMounted) setFetching(false)
        }
      }
    }
    if (open) fetchSchedule()
    return () => { isMounted = false }
  }, [open])

  const handleSubmit = async () => {
    setLoading(true)
    try {
      // Filter out completely empty blocks to avoid saving junk
      const validSchedules = schedules.filter(s => s.start !== null || s.end !== null || s.days.length > 0)
      
      const toSave = validSchedules.map(s => ({
        start: s.start,
        end: s.end,
        days: s.days
      }))

      await updateRoleSchedule("CAPTURISTA", toSave)
      
      setOpen(false)
      sileo.success({
        title: "Éxito",
        description: "Horarios de capturistas guardados",
      })
      router.refresh()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error al guardar los horarios."
      sileo.error({ title: "Error", description: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const currentBlockIndex = schedules.findIndex(s => s.id === activeBlockId)
  const currentBlock = schedules[currentBlockIndex] || schedules[0]

  const currentVal = currentBlock[activeTab] || "12:00"
  const [currentH, currentM] = currentVal.split(":")

  const handleTimeChange = (h: string, m: string) => {
    const newSchedules = [...schedules]
    newSchedules[currentBlockIndex] = {
      ...currentBlock,
      [activeTab]: `${h}:${m}`
    }
    setSchedules(newSchedules)
  }

  const clearCurrentBlock = () => {
    const newSchedules = [...schedules]
    newSchedules[currentBlockIndex] = {
      ...currentBlock,
      start: null,
      end: null
    }
    setSchedules(newSchedules)
  }

  const toggleDay = (dayIndex: number) => {
    const newSchedules = [...schedules]
    const days = currentBlock.days
    newSchedules[currentBlockIndex] = {
      ...currentBlock,
      days: days.includes(dayIndex) 
        ? days.filter(d => d !== dayIndex) 
        : [...days, dayIndex].sort()
    }
    setSchedules(newSchedules)
  }

  const addBlock = () => {
    if (schedules.length >= 3) {
      sileo.error({ title: "Límite", description: "Máximo 3 bloques de horario" })
      return
    }
    const newId = String(Date.now())
    setSchedules([...schedules, { id: newId, start: null, end: null, days: [] }])
    setActiveBlockId(newId)
  }

  const removeBlock = (id: string) => {
    if (schedules.length <= 1) return
    const newSchedules = schedules.filter(s => s.id !== id)
    setSchedules(newSchedules)
    if (activeBlockId === id) {
      setActiveBlockId(newSchedules[0].id)
    }
  }

  const dayNames = ["D", "L", "M", "M", "J", "V", "S"]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-full rounded-full border-none bg-white/5 px-4 text-xs font-medium text-muted-foreground transition-all hover:bg-white/10 hover:text-white"
        >
          Horario
        </Button>
      </DialogTrigger>
      
      <DialogContent
        showCloseButton={false}
        className="w-fit h-fit border-border/40 bg-[#1c1c1e] text-foreground p-0 rounded-[28px] gap-0 overflow-hidden shadow-2xl"
      >
        {fetching ? (
          <div className="flex justify-center items-center h-64 min-w-[360px] text-muted-foreground">Cargando...</div>
        ) : (
          <div className="flex flex-col">
            
            {/* Custom Top Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <Button 
                variant="ghost" 
                onClick={() => setOpen(false)} 
                className="text-primary hover:text-primary/80 font-normal px-2 h-8"
              >
                Cancelar
              </Button>
              <h3 className="font-semibold text-white">
                Horarios de Capturistas
              </h3>
              <Button 
                variant="ghost" 
                onClick={handleSubmit} 
                disabled={loading}
                className="text-primary hover:text-primary/80 font-semibold px-2 h-8"
              >
                Guardar
              </Button>
            </div>

            {/* Block Selector */}
            <div className="flex px-4 pt-4 pb-2 gap-2 overflow-x-auto no-scrollbar">
              {schedules.map((s, i) => (
                <div key={s.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => setActiveBlockId(s.id)}
                    className={cn(
                      "px-4 py-1.5 rounded-2xl text-xs transition-all whitespace-nowrap flex flex-col items-center justify-center min-w-[90px]",
                      activeBlockId === s.id 
                        ? "bg-white text-black" 
                        : "bg-[#2c2c2e] text-muted-foreground hover:bg-[#3a3a3c] hover:text-white"
                    )}
                  >
                    <span className="font-semibold">Horario {i + 1}</span>
                    <span className={cn(
                      "text-[10px] mt-[-2px]",
                      activeBlockId === s.id ? "text-black/70" : "opacity-70"
                    )}>
                      {s.start && s.end ? `${s.start} - ${s.end}` : "Sin horario"}
                    </span>
                  </button>
                  {schedules.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeBlock(s.id) }}
                      className="absolute -top-1 -right-1 bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {schedules.length < 3 && (
                <button
                  type="button"
                  onClick={addBlock}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary transition-all hover:bg-primary/20 flex items-center gap-1"
                >
                  <span className="text-lg leading-none mt-[-2px]">+</span>
                </button>
              )}
            </div>

            {/* Days Selector */}
            <div className="flex justify-center gap-2 px-4 pb-2 pt-2">
              {dayNames.map((day, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all text-sm",
                    currentBlock.days.includes(i) 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "bg-[#2c2c2e] text-muted-foreground hover:bg-[#3a3a3c] hover:text-white"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
            
            {/* Tabs */}
            <div className="flex px-4 py-2">
              <div className="flex w-full bg-black/40 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab("start")}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                    activeTab === "start" ? "bg-[#2c2c2e] text-white shadow-sm" : "text-muted-foreground hover:text-white"
                  )}
                >
                  Hora de Inicio
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("end")}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
                    activeTab === "end" ? "bg-[#2c2c2e] text-white shadow-sm" : "text-muted-foreground hover:text-white"
                  )}
                >
                  Hora de Fin
                </button>
              </div>
            </div>

            {/* Scroll Wheels Area */}
            <div className="relative flex items-center justify-center h-[240px] w-full px-8 select-none">
              
              {/* Highlight Bar Background */}
              <div className="absolute top-1/2 left-6 right-6 h-[48px] -translate-y-1/2 bg-white/10 rounded-xl pointer-events-none" />
              
              {/* Wheels */}
              <div className="flex items-center gap-4 z-10 w-full max-w-[200px] justify-between">
                <ScrollWheel 
                  options={HOURS} 
                  value={currentH} 
                  onChange={(h) => handleTimeChange(h, currentM)} 
                />
                
                <div className="text-2xl font-bold text-white pb-1">:</div>
                
                <ScrollWheel 
                  options={MINUTES} 
                  value={currentM} 
                  onChange={(m) => handleTimeChange(currentH, m)} 
                />
              </div>
              
              {/* Gradient Overlays for smooth fade out */}
              <div className="absolute top-0 left-0 right-0 h-[80px] bg-gradient-to-b from-[#1c1c1e] to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-gradient-to-t from-[#1c1c1e] to-transparent pointer-events-none" />
            </div>

            {/* Empty State / Clear Button */}
            <div className="h-14 flex justify-center items-center pb-2">
              {currentBlock.start === null && currentBlock.end === null ? (
                 <span className="text-xs text-rose-400 font-medium bg-rose-500/10 px-3 py-1 rounded-full">
                   Sin horario en este bloque
                 </span>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={clearCurrentBlock} 
                  className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 h-8 px-4 rounded-full"
                >
                  Limpiar horario
                </Button>
              )}
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ScrollWheel({ options, value, onChange }: { options: string[], value: string, onChange: (val: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ITEM_HEIGHT = 44

  const isProgrammaticScroll = useRef(false)
  const programmaticScrollTimeout = useRef<NodeJS.Timeout | null>(null)

  // 1. Wheel Interceptor: absolute 1-item steps
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    
    let isWheeling = false
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (isWheeling) return
      
      const direction = Math.sign(e.deltaY)
      const currentIndex = options.indexOf(value)
      let nextIndex = currentIndex + direction
      
      if (nextIndex < 0) nextIndex = 0
      if (nextIndex >= options.length) nextIndex = options.length - 1
      
      const selected = options[nextIndex]
      if (selected !== value) {
        onChange(selected)
      }
      
      isWheeling = true
      setTimeout(() => { isWheeling = false }, 50)
    }
    
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [value, options, onChange])

  // 2. Programmatic Scroll Sync
  useEffect(() => {
    if (!containerRef.current) return
    const currentIndex = Math.round(containerRef.current.scrollTop / ITEM_HEIGHT)
    const expectedIndex = options.indexOf(value)
    
    if (expectedIndex !== -1 && currentIndex !== expectedIndex) {
      isProgrammaticScroll.current = true
      if (programmaticScrollTimeout.current) clearTimeout(programmaticScrollTimeout.current)
      
      containerRef.current.scrollTo({ top: expectedIndex * ITEM_HEIGHT, behavior: 'smooth' })
      
      programmaticScrollTimeout.current = setTimeout(() => {
        isProgrammaticScroll.current = false
      }, 350)
    }
  }, [value, options])

  // 3. Manual touch/drag scrolling
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScroll.current) return // Prevent fighting the animation
    
    const container = e.currentTarget
    const index = Math.round(container.scrollTop / ITEM_HEIGHT)
    const selected = options[index]
    
    if (selected && selected !== value) {
      onChange(selected)
    }
  }

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="h-[240px] w-[80px] overflow-y-auto snap-y snap-mandatory relative"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        ::-webkit-scrollbar { display: none; }
      `}} />
      
      <div style={{ height: "98px" }} />
      
      {options.map((opt) => (
        <div 
          key={opt} 
          className={cn(
            "flex items-center justify-center text-3xl transition-all cursor-pointer duration-200 snap-center",
            opt === value ? "text-white font-medium scale-110" : "text-white/30 scale-90 hover:text-white/60"
          )}
          style={{ height: `${ITEM_HEIGHT}px` }}
          onClick={() => {
            onChange(opt)
          }}
        >
          {opt}
        </div>
      ))}
      
      <div style={{ height: "98px" }} />
    </div>
  )
}
