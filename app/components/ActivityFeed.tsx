"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { formatDistanceToNow, format } from "date-fns"
import { es } from "date-fns/locale"

interface ActivityLog {
  id: string
  action: string
  entityType: string
  details: string | null
  createdAt: Date
  user: {
    name: string
    email: string
    role?: { name: string }
  }
}

interface ActivityFeedProps {
  logs: ActivityLog[]
}

export default function ActivityFeed({ logs }: ActivityFeedProps) {
  return (
    <Card className="gap-1 border-border bg-card">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Actividad Reciente</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] scrollbar-thin space-y-4 overflow-y-auto pr-2">
          {logs.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hay actividad reciente.
            </p>
          ) : (
            logs.map((log, index) => {
              const actionCode = log.action
              const text = (log.details || log.action).toLowerCase()
              let dotColor = "bg-blue-500" // Azul por defecto o edición

              const isSuperAdmin = 
                log.user.role?.name === "SUPER_ADMIN" ||
                text.includes("superadmin") ||
                text.includes("super_admin") ||
                text.includes("super admin")

              if (isSuperAdmin) {
                dotColor = "bg-purple-500"
              } else if (
                ["ELIMINAR", "ELIMINAR_GASTO", "ELIMINAR_DIA", "REMOVER_MIEMBRO", "EMPTY_TRASH"].includes(actionCode) ||
                text.includes("definitivo") || text.includes("permanente") || (text.includes("eliminó") && !text.includes("papelera")) || text.includes("borró")
              ) {
                // Si la acción dice papelera pero NO es vaciar papelera ni definitivo, entonces es mover a papelera (amarillo)
                if (text.includes("papelera") && actionCode !== "EMPTY_TRASH" && !text.includes("definitivo")) {
                  dotColor = "bg-yellow-500"
                } else {
                  dotColor = "bg-red-500"
                }
              } else if (
                ["ARCHIVAR"].includes(actionCode) ||
                text.includes("papelera") || text.includes("archivó") || text.includes("archivada") || text.includes("pausó")
              ) {
                dotColor = "bg-yellow-500"
              } else if (
                ["RESTAURAR", "RESTAURAR_GASTO", "RESTAURAR_DIA"].includes(actionCode) ||
                text.includes("restauró") || text.includes("restaurada") || text.includes("restaurado")
              ) {
                dotColor = "bg-cyan-500"
              } else if (
                ["CREAR", "CREAR_DIA", "AGREGAR_GASTO", "AGREGAR_MIEMBRO"].includes(actionCode) ||
                text.includes("creó") || text.includes("creada") || text.includes("alta") || text.includes("agregó") || text.includes("registró")
              ) {
                dotColor = "bg-green-600"
              } else if (
                ["EDITAR", "EDITAR_GASTO", "ACTUALIZAR", "VERIFICAR_GASTO"].includes(actionCode) ||
                text.includes("editó") || text.includes("actualizó")
              ) {
                dotColor = "bg-blue-500"
              }

              return (
                <div key={log.id} className="relative pl-6">
                  {/* Timeline vertical line */}
                  {index !== logs.length - 1 && (
                    <div className="absolute top-6 bottom-[-16px] left-[9px] w-px bg-border/60"></div>
                  )}

                  {/* Timeline dot */}
                  <div
                    className={`absolute top-0.5 left-0 h-[19px] w-[19px] rounded-full border-2 border-background ${dotColor} flex items-center justify-center`}
                  >
                    <div className="h-2 w-2 rounded-full bg-background"></div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-foreground mt-[2px]">
                      {log.user.name}
                    </p>
                    <p className="inline-block rounded-md border border-border/40 bg-muted/40 p-2 text-xs text-muted-foreground">
                      {log.details || log.action}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm", {
                        locale: es,
                      })}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
