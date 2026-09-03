"use server"

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { logActivity } from "@/lib/actions/logs"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("No autenticado")
  const role = (session.user as any).role
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    throw new Error("No autorizado. Requiere rol ADMIN o SUPER_ADMIN.")
  }
  return session.user
}

export async function createRole(data: {
  name: string
  permissions: string[]
}) {
  const adminUser = await requireAdmin()
  if ((adminUser as any).role !== "SUPER_ADMIN") {
    throw new Error("Solo los Super Administradores pueden crear nuevos roles.")
  }

  const roleName = data.name.toUpperCase().trim().replace(/\s+/g, "_")

  const existing = await prisma.role.findUnique({
    where: { name: roleName },
  })

  if (existing) {
    throw new Error("Ya existe un rol con este nombre.")
  }

  const role = await prisma.role.create({
    data: {
      name: roleName,
      permissions: JSON.stringify(data.permissions),
      isSystem: false,
    },
  })

  await logActivity(
    (adminUser as any).id,
    "CREAR",
    "ROL",
    role.id,
    `Creó el rol ${role.name}`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return role
}

export async function updateRoleSchedule(
  roleName: string,
  schedules: any[]
) {
  const adminUser = await requireAdmin()

  const role = await prisma.role.findUnique({ where: { name: roleName } })
  if (!role) throw new Error("Rol no encontrado.")

  const updatedRole = await prisma.role.update({
    where: { id: role.id },
    data: { schedules },
  })

  await logActivity(
    (adminUser as any).id,
    "ACTUALIZAR",
    "ROL",
    role.id,
    `Actualizó los horarios del rol ${role.name}`
  )

  revalidatePath("/", "layout")
  return updatedRole
}

export async function getRoleSchedule(roleName: string) {
  const adminUser = await requireAdmin()
  const role = await prisma.role.findUnique({ where: { name: roleName } })
  if (!role) throw new Error("Rol no encontrado.")
  return { schedules: role.schedules ? (role.schedules as any[]) : [] }
}

export async function updateRole(
  roleId: string,
  data: { permissions: string[] }
) {
  const adminUser = await requireAdmin()

  const role = await prisma.role.findUnique({ where: { id: roleId } })
  if (!role) throw new Error("Rol no encontrado.")

  if (
    role.name === "SUPER_ADMIN" &&
    (adminUser as any).role !== "SUPER_ADMIN"
  ) {
    throw new Error(
      "Solo un Super Administrador puede modificar los permisos del rol SUPER_ADMIN."
    )
  }

  // Protect SUPER_ADMIN from losing vital permissions if they edit it themselves
  const finalPermissions = data.permissions
  if (role.name === "SUPER_ADMIN") {
    const vital = ["manage_roles", "manage_users"]
    vital.forEach((v) => {
      if (!finalPermissions.includes(v)) finalPermissions.push(v)
    })
  }

  const updatedRole = await prisma.role.update({
    where: { id: roleId },
    data: { permissions: JSON.stringify(finalPermissions) },
  })

  await logActivity(
    (adminUser as any).id,
    "ACTUALIZAR",
    "ROL",
    role.id,
    `Actualizó los permisos del rol ${role.name}`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return updatedRole
}

export async function deleteRole(roleId: string) {
  const adminUser = await requireAdmin()
  if ((adminUser as any).role !== "SUPER_ADMIN") {
    throw new Error("Solo los Super Administradores pueden eliminar roles.")
  }

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { _count: { select: { users: true } } },
  })

  if (!role) throw new Error("Rol no encontrado.")

  if (role.isSystem) {
    throw new Error(
      "No se pueden eliminar los roles del sistema (isSystem = true)."
    )
  }

  if (role._count.users > 0) {
    throw new Error("No se puede eliminar un rol que tiene usuarios asignados.")
  }

  await prisma.role.delete({
    where: { id: roleId },
  })

  await logActivity(
    (adminUser as any).id,
    "ELIMINAR",
    "ROL",
    role.id,
    `Eliminó el rol ${role.name} de forma permanente`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return { success: true }
}
