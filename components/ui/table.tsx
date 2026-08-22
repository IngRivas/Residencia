"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const ZOOM_SCALE: Record<number, number> = {
  [-1]: 1.0,
  [0]: 1.1,
  [1]: 1.2,
  [2]: 1.3,
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const [zoomLevel, setZoomLevel] = React.useState(0)

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 1, 2))
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 1, -1))

  return (
    <div className="flex w-full flex-col gap-2">
      <div
        data-slot="table-container"
        className="relative w-full overflow-x-auto rounded-lg bg-card/40 shadow-sm backdrop-blur-md transition-all duration-300 has-[tbody.is-animating]:!overflow-hidden"
        style={{ zoom: ZOOM_SCALE[zoomLevel] }}
      >
        <table
          data-slot="table"
          className={cn(
            "w-full caption-bottom border-collapse text-sm",
            className
          )}
          {...props}
        />
      </div>
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-muted/45", className)}
      {...props}
    />
  )
}

function TableBody({
  className,
  children,
  ...props
}: React.ComponentProps<"tbody">) {
  const [isAnimating, setIsAnimating] = React.useState(true)
  const childrenArray = React.Children.toArray(children)

  React.useEffect(() => {
    setIsAnimating(true)
    const totalDuration = 600 + childrenArray.length * 50
    const timer = setTimeout(() => {
      setIsAnimating(false)
    }, totalDuration)

    return () => clearTimeout(timer)
  }, [childrenArray.length])

  return (
    <tbody
      data-slot="table-body"
      className={cn(
        "[&_tr:last-child]:border-0",
        isAnimating && "is-animating",
        className
      )}
      {...props}
    >
      {childrenArray.map((child, index) => {
        if (React.isValidElement(child)) {
          const childElement = child as React.ReactElement<any>
          return React.cloneElement(childElement, {
            className: cn(childElement.props.className, "animate-fade-blur"),
            style: {
              ...(childElement.props.style || {}),
              animationDelay: `${index * 0.05}s`,
            },
          })
        }
        return child
      })}
    </tbody>
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("bg-muted/60 font-semibold text-white", className)}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "transition-all even:bg-muted/60 hover:bg-muted/40 data-[state=selected]:bg-muted/65",
        className
      )}
      {...props}
    />
  )
}

import {
  Building2,
  Wallet,
  DollarSign,
  Calendar,
  Activity,
  Info,
  Tag,
  User,
  Hash,
  FileText,
  Percent,
} from "lucide-react"

function TableHead({
  className,
  children,
  ...props
}: React.ComponentProps<"th">) {
  let content = children

  if (typeof children === "string") {
    const text = children.toLowerCase()
    let Icon = Tag

    if (text.includes("obra") || text.includes("proyecto")) Icon = Building2
    else if (text.includes("presupuesto") || text.includes("monto"))
      Icon = Wallet
    else if (
      text.includes("gastado") ||
      text.includes("gasto") ||
      text.includes("pago") ||
      text.includes("total")
    )
      Icon = DollarSign
    else if (
      text.includes("saldo") ||
      text.includes("balance") ||
      text.includes("restante")
    )
      Icon = Activity
    else if (
      text.includes("estado") ||
      text.includes("status") ||
      text.includes("rol")
    )
      Icon = Info
    else if (
      text.includes("fecha") ||
      text.includes("inicio") ||
      text.includes("cierre")
    )
      Icon = Calendar
    else if (
      text.includes("nombre") ||
      text.includes("usuario") ||
      text.includes("cliente")
    )
      Icon = User
    else if (
      text.includes("id") ||
      text.includes("folio") ||
      text.includes("#")
    )
      Icon = Hash
    else if (text.includes("descripci")) Icon = FileText
    else if (text.includes("porcentaje") || text.includes("%")) Icon = Percent

    if (text.trim() !== "") {
      content = (
        <div
          className={cn(
            "flex items-center gap-1.5",
            className?.includes("text-right") && "justify-end",
            className?.includes("justify-center") && "justify-center"
          )}
        >
          <Icon className="h-3.5 w-3.5 text-inherit" />
          {children}
        </div>
      )
    }
  }

  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 px-2 text-left align-middle text-xs font-bold text-white [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    >
      {content}
    </th>
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-2 py-2 align-middle text-xs text-white [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
