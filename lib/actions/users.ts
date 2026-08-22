"use server"

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import * as bcrypt from "bcryptjs"
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

export async function createUser(data: {
  name: string
  email: string
  password?: string
  roleId: string
}) {
  const adminUser = await requireAdmin()

  // Fetch the role to check if it's SUPER_ADMIN
  const roleRecord = await prisma.role.findUnique({
    where: { id: data.roleId },
  })
  if (!roleRecord) throw new Error("Rol no encontrado.")

  if (
    roleRecord.name === "SUPER_ADMIN" &&
    (adminUser as any).role !== "SUPER_ADMIN"
  ) {
    throw new Error("Un administrador no puede crear un SUPER_ADMIN.")
  }

  // Check if exists
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  })

  if (existing) {
    throw new Error("El usuario ya existe con este correo.")
  }

  const rawPassword =
    data.password && data.password.trim().length > 0
      ? data.password
      : "mcacorporation"
  const passwordHash = await bcrypt.hash(rawPassword, 10)

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: passwordHash,
      roleId: data.roleId,
    },
  })

  await logActivity(
    (adminUser as any).id,
    "CREAR",
    "Usuario",
    user.id,
    `Creó el usuario ${user.email} con rol ${roleRecord.name}`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return user
}

async function checkHierarchy(adminUser: any, targetUserId: string) {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { role: true },
  })
  if (!targetUser) throw new Error("Usuario no encontrado.")
  if (
    targetUser.role.name === "SUPER_ADMIN" &&
    adminUser.role !== "SUPER_ADMIN"
  ) {
    throw new Error(
      "Un administrador no puede modificar o eliminar a un SUPER_ADMIN."
    )
  }
}

export async function updateUserRole(userId: string, roleId: string) {
  const adminUser = await requireAdmin()
  await checkHierarchy(adminUser, userId)

  const roleRecord = await prisma.role.findUnique({ where: { id: roleId } })
  if (!roleRecord) throw new Error("Rol no encontrado.")

  if (
    roleRecord.name === "SUPER_ADMIN" &&
    (adminUser as any).role !== "SUPER_ADMIN"
  ) {
    throw new Error("Un administrador no puede asignar el rol de SUPER_ADMIN.")
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { roleId },
  })

  await logActivity(
    (adminUser as any).id,
    "ACTUALIZAR",
    "Usuario",
    user.id,
    `Actualizó el rol del usuario ${user.email} a ${roleRecord.name}`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return user
}

export async function deleteUser(userId: string) {
  const adminUser = await requireAdmin()
  await checkHierarchy(adminUser, userId)

  const userToDelete = await prisma.user.findUnique({ where: { id: userId } })

  await prisma.user.delete({
    where: { id: userId },
  })

  if (userToDelete) {
    await logActivity(
      (adminUser as any).id,
      "ELIMINAR",
      "Usuario",
      userId,
      `Eliminó permanentemente al usuario ${userToDelete.email}`
    )
  }

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return { success: true }
}

export async function changeUserPassword(
  userId: string,
  newPasswordRaw: string
) {
  const adminUser = await requireAdmin()
  await checkHierarchy(adminUser, userId)

  if (!newPasswordRaw || newPasswordRaw.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.")
  }

  const passwordHash = await bcrypt.hash(newPasswordRaw, 10)

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { password: passwordHash },
  })

  await logActivity(
    (adminUser as any).id,
    "ACTUALIZAR",
    "Usuario",
    userId,
    `Cambió la contraseña del usuario ${updatedUser.email}`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return { success: true }
}

export async function updateUserTextZoom(userId: string, textZoom: number) {
  const session = await auth()
  if (!session?.user) throw new Error("No autenticado")

  // El usuario solo puede actualizar su propio zoom
  if (session.user.id !== userId) {
    throw new Error("No autorizado")
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { textZoom },
  })

  revalidatePath("/", "layout")
  return user
}
