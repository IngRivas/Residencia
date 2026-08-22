import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import CreateUserModal from "@/app/components/CreateUserModal"
import UserActions from "@/app/components/UserActions"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import SortableTableHead from "@/app/components/SortableTableHead"
import { User as UserIcon, Mail, Shield, Calendar } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string, sortBy?: string, sortOrder?: string }>
}) {
  const params = await searchParams
  const search = params?.search || ""
  const sortBy = params?.sortBy || "createdAt"
  const sortOrder = params?.sortOrder === "asc" ? "asc" : "desc"

  const session = await auth()
  const user = session?.user as any

  if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
    redirect("/403")
  }

  let orderBy: any = {}
  if (sortBy === "nombre") {
    orderBy = { name: sortOrder }
  } else if (sortBy === "email") {
    orderBy = { email: sortOrder }
  } else if (sortBy === "rol") {
    orderBy = { role: { name: sortOrder } }
  } else {
    orderBy = { createdAt: sortOrder }
  }

  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { role: { name: { contains: search } } },
          ],
        }
      : undefined,
    orderBy,
    include: {
      role: true,
    },
  })

  const roles = await prisma.role.findMany({
    orderBy: { createdAt: "asc" },
  })

  return (
    <div className="space-y-6">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight">
            Administrar Usuarios
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/usuarios/roles"
            className={buttonVariants({ variant: "secondary" })}
          >
            Gestión de Roles
          </Link>
          <CreateUserModal roles={roles} />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead column="nombre" label="Nombre" icon={<UserIcon className="h-4 w-4" />} />
            <SortableTableHead column="email" label="Email" icon={<Mail className="h-4 w-4" />} />
            <SortableTableHead column="rol" label="Rol Global" icon={<Shield className="h-4 w-4" />} />
            <SortableTableHead column="createdAt" label="Fecha de Registro" icon={<Calendar className="h-4 w-4" />} />
            <TableHead className="w-[280px] text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-semibold text-foreground/90">
                {u.name}
              </TableCell>
              <TableCell className="text-foreground/80">{u.email}</TableCell>
              <TableCell>
                <span className="text-sm font-medium text-foreground capitalize">
                  {u.role.name.replace(/_/g, " ").toLowerCase()}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {u.createdAt.toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <UserActions
                  id={u.id}
                  email={u.email}
                  roleId={u.roleId}
                  roleName={u.role.name}
                  currentUserId={user.id}
                  currentUserRole={user.role}
                  availableRoles={roles}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
