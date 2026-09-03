import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import RoleModal from "@/app/components/RoleModal"
import RoleActions from "./RoleActions" // We'll create this to handle deletion
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function RolesPage() {
  const session = await auth()
  const user = session?.user as any

  if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
    redirect("/403")
  }

  const roles = await prisma.role.findMany({
    orderBy: { isSystem: "desc" }, // System roles first
    include: {
      _count: {
        select: { users: true },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            Gestión de Roles
          </h1>
          <p className="mt-1 text-muted-foreground">
            Crea nuevos roles y configura sus permisos de acceso.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/usuarios"
            className={buttonVariants({ variant: "outline" })}
          >
            Volver a Usuarios
          </Link>
          {user.role === "SUPER_ADMIN" && <RoleModal />}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rol</TableHead>
            <TableHead>Permisos</TableHead>
            <TableHead>Usuarios Asignados</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-semibold text-foreground/90 capitalize">
                {r.name.replace(/_/g, " ").toLowerCase()}
              </TableCell>
              <TableCell className="max-w-[350px]">
                {JSON.parse(r.permissions).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {JSON.parse(r.permissions).map((p: string) => (
                      <span
                        key={p}
                        className="rounded-full border border-border/50 bg-accent/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/60 italic">
                    Sin permisos
                  </span>
                )}
              </TableCell>
              <TableCell>
                <span className="rounded-full border border-border/50 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {r._count.users}{" "}
                  {r._count.users === 1 ? "usuario" : "usuarios"}
                </span>
              </TableCell>
              <TableCell>
                {r.isSystem ? (
                  <span className="inline-flex items-center rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-bold text-purple-400">
                    SISTEMA
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                    PERSONALIZADO
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-3">
                  <RoleModal role={{ ...r, permissions: JSON.parse(r.permissions) }} />
                  {user.role === "SUPER_ADMIN" && !r.isSystem && (
                    <RoleActions id={r.id} roleName={r.name} />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
