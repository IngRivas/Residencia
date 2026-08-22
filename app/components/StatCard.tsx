import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReactNode } from "react"

interface StatCardProps {
  title: string
  value: ReactNode
  data?: number[]
}

export default function StatCard({ title, value, data = [] }: StatCardProps) {
  // Generate SVG path dynamically based on data points
  const generatePath = (dataArray: number[]) => {
    if (!dataArray || dataArray.length === 0) {
      return { fill: "", stroke: "" }
    }
    if (dataArray.length === 1) {
      return {
        fill: "M0,100 L0,50 L400,50 L400,100 Z",
        stroke: "M0,50 L400,50",
      }
    }

    const max = Math.max(...dataArray)
    const min = Math.min(...dataArray)
    const range = max - min || 1 // Evitar división por cero

    // Mapear a SVG viewport (X: 0 a 400, Y: 10 a 90 para dejar márgenes)
    const points = dataArray.map((val, i) => {
      const x = (i / (dataArray.length - 1)) * 400
      const y = 90 - ((val - min) / range) * 80
      return { x, y }
    })

    // Crear curva suavizada (bezier)
    let d = `M${points[0].x},${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      const cp1x = points[i - 1].x + (points[i].x - points[i - 1].x) / 2
      const cp1y = points[i - 1].y
      const cp2x = points[i - 1].x + (points[i].x - points[i - 1].x) / 2
      const cp2y = points[i].y
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${points[i].x},${points[i].y}`
    }

    return {
      fill: `${d} L400,100 L0,100 Z`,
      stroke: d,
    }
  }

  const path = generatePath(data)

  return (
    <Card className="group relative overflow-hidden border-border bg-card">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 text-slate-500 opacity-[0.05] transition-opacity duration-500 group-hover:opacity-[0.09] dark:text-slate-400 dark:opacity-10 dark:group-hover:opacity-20">
        <svg
          viewBox="0 0 400 100"
          fill="none"
          preserveAspectRatio="none"
          className="h-24 w-full"
        >
          <path d={path.fill} fill="currentColor" />
          <path
            d={path.stroke}
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
        </svg>
      </div>
      <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-2xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  )
}
