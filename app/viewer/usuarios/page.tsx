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

export const dynamic = "force-dynamic"

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const params = await searchParams
  const search = params?.search || ""

  const session = await auth()
  const user = session?.user as any

  if (user?.role !== "VIEWER") {
    redirect("/403")
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
    orderBy: {
      createdAt: "desc",
    },
    include: {
      role: true,
    },
  })

  return (
    <div className="space-y-6">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight">Usuarios</h1>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rol Global</TableHead>
            <TableHead>Fecha de Registro</TableHead>
            <TableHead className="w-[280px] text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id} className="h-[65px]">
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
              <TableCell className="w-[280px] text-right"></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
