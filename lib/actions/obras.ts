"use server"

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { ObraEstado, ObraRol } from "@prisma/client"
import { logActivity } from "./logs"

// Verify if the current user is an admin or super admin
async function requireAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("No autenticado")
  const role = (session.user as any).role
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    throw new Error("No autorizado")
  }
  return session.user
}

export async function createObra(data: { nombre: string; adminIds: string[] }) {
  const user = await requireAdmin()

  const obra = await prisma.obra.create({
    data: {
      nombre: data.nombre,
      presupuestoTotal: 0,
      estado: ObraEstado.ACTIVA,
      creadoPorId: user.id!,
    },
  })

  // Asignar los administradores seleccionados
  if (data.adminIds && data.adminIds.length > 0) {
    const promises = data.adminIds.map((adminId) => {
      return prisma.obraUser.create({
        data: {
          obraId: obra.id,
          userId: adminId,
          rol: ObraRol.ADMIN,
        },
      })
    })
    await Promise.all(promises)
  }

  await logActivity(
    user.id!,
    "CREAR",
    "Obra",
    obra.id,
    `Dio de alta la obra "${obra.nombre}"`
  )

  revalidatePath("/", "layout")
  return { success: true }
}

export async function updateObra(
  id: string,
  data: { nombre: string; presupuestoTotal: number; estado: ObraEstado }
) {
  await requireAdmin()

  const obra = await prisma.obra.update({
    where: { id },
    data: {
      nombre: data.nombre,
      presupuestoTotal: data.presupuestoTotal,
      estado: data.estado,
    },
  })

  await logActivity(
    (await requireAdmin()).id!,
    "EDITAR",
    "Obra",
    obra.id,
    `Actualizó la obra "${obra.nombre}"`
  )

  revalidatePath("/", "layout")
  return { success: true }
}

export async function deleteObra(id: string) {
  await requireAdmin()

  const obra = await prisma.obra.update({
    where: { id },
    data: {
      estado: ObraEstado.ARCHIVADA,
    },
  })

  await logActivity(
    (await requireAdmin()).id!,
    "ARCHIVAR",
    "Obra",
    obra.id,
    `Archivó la obra "${obra.nombre}"`
  )

  revalidatePath("/", "layout")
  return { success: true }
}

export async function softDeleteObra(id: string) {
  await requireAdmin()

  const obra = await prisma.obra.findUnique({ where: { id } })
  if (!obra) throw new Error("Obra no encontrada")

  await prisma.obra.update({
    where: { id },
    data: { deletedAt: new Date() },
  })

  await logActivity(
    (await requireAdmin()).id!,
    "ELIMINAR",
    "Obra",
    id,
    `Movió la obra "${obra.nombre}" a la papelera`
  )

  revalidatePath("/", "layout")
  return { success: true }
}

export async function restoreObra(id: string) {
  await requireAdmin()

  const obra = await prisma.obra.update({
    where: { id },
    data: { deletedAt: null },
  })

  await logActivity(
    (await requireAdmin()).id!,
    "RESTAURAR",
    "Obra",
    id,
    `Restauró la obra "${obra.nombre}" de la papelera`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return { success: true }
}

export async function permanentDeleteObra(id: string) {
  await requireAdmin()

  const obra = await prisma.obra.findUnique({ where: { id } })
  if (!obra) throw new Error("Obra no encontrada")

  await prisma.obra.delete({
    where: { id },
  })

  await logActivity(
    (await requireAdmin()).id!,
    "ELIMINAR",
    "Obra",
    id,
    `Eliminó permanentemente la obra "${obra.nombre}"`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return { success: true }
}

export async function addMiembro(obraId: string, userId: string, rol: ObraRol) {
  await requireAdmin()

  if (!userId) {
    throw new Error("Debes seleccionar un usuario.")
  }

  const membership = await prisma.obraUser.upsert({
    where: {
      obraId_userId: {
        obraId,
        userId,
      },
    },
    update: { rol },
    create: {
      obraId,
      userId,
      rol,
    },
  })

  const assignedUser = await prisma.user.findUnique({ where: { id: userId } })
  const obraTarget = await prisma.obra.findUnique({ where: { id: obraId } })

  await logActivity(
    (await requireAdmin()).id!,
    "AGREGAR_MIEMBRO",
    "ObraUser",
    membership.id,
    `Asignó el rol de ${rol} a ${assignedUser?.name || "un miembro"} en la obra "${obraTarget?.nombre || "Desconocida"}"`
  )

  revalidatePath("/", "layout")
  return membership
}

export async function removeMiembro(obraId: string, userId: string) {
  await requireAdmin()

  const removedUser = await prisma.user.findUnique({ where: { id: userId } })
  const obraRemoved = await prisma.obra.findUnique({ where: { id: obraId } })

  await prisma.obraUser.delete({
    where: {
      obraId_userId: {
        obraId,
        userId,
      },
    },
  })

  await logActivity(
    (await requireAdmin()).id!,
    "REMOVER_MIEMBRO",
    "Obra",
    obraId,
    `Removió a ${removedUser?.name || "un miembro"} de la obra "${obraRemoved?.nombre || "Desconocida"}"`
  )

  revalidatePath("/", "layout")
  return { success: true }
}
