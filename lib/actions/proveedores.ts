"use server"

import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("No autorizado")
  const user = session.user as any
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    throw new Error("Permisos insuficientes")
  }
}

export async function getProveedores() {
  await requireAdmin()
  return prisma.proveedor.findMany({
    orderBy: { nombre: "asc" },
  })
}

export async function addProveedor(data: { nombre: string; rfc?: string }) {
  await requireAdmin()
  if (!data.nombre.trim()) throw new Error("El nombre es requerido")

  const existing = await prisma.proveedor.findUnique({
    where: { nombre: data.nombre.trim() },
  })
  if (existing) {
    throw new Error("Ya existe un proveedor con ese nombre")
  }

  const prov = await prisma.proveedor.create({
    data: {
      nombre: data.nombre.trim(),
      rfc: data.rfc?.trim() || null,
    },
  })

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return prov
}

export async function updateProveedor(
  id: string,
  data: { nombre: string; rfc?: string }
) {
  await requireAdmin()
  const cleanName = data.nombre.trim()
  if (!cleanName) throw new Error("El nombre es requerido")

  const current = await prisma.proveedor.findUnique({ where: { id } })
  if (!current) throw new Error("Proveedor no encontrado")

  const existing = await prisma.proveedor.findUnique({
    where: { nombre: cleanName },
  })

  // Si intentan renombrar a un proveedor que YA EXISTE (ej. "Hom depot" -> "Home Depot")
  if (existing && existing.id !== id) {
    // 1. Reasignar todos los gastos del proveedor mal escrito al nombre correcto
    await prisma.gasto.updateMany({
      where: { proveedor: current.nombre },
      data: { proveedor: existing.nombre },
    })
    // 2. Si el proveedor nuevo no tenía RFC pero el viejo sí, lo pasamos
    if (!existing.rfc && data.rfc?.trim()) {
      await prisma.proveedor.update({
        where: { id: existing.id },
        data: { rfc: data.rfc.trim() },
      })
    }
    // 3. Eliminar el registro mal escrito
    await prisma.proveedor.delete({ where: { id } })

    revalidatePath("/", "layout")
    revalidatePath("/", "layout")
    return existing
  }

  // Si el nombre nuevo no existe, hacemos un renombramiento normal
  // 1. Actualizamos todos los gastos vinculados para no romper el historial
  if (current.nombre !== cleanName) {
    await prisma.gasto.updateMany({
      where: { proveedor: current.nombre },
      data: { proveedor: cleanName },
    })
  }

  // 2. Actualizamos el catálogo
  const prov = await prisma.proveedor.update({
    where: { id },
    data: {
      nombre: cleanName,
      rfc: data.rfc?.trim() || null,
    },
  })

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return prov
}

export async function deleteProveedor(id: string) {
  await requireAdmin()
  const prov = await prisma.proveedor.delete({
    where: { id },
  })

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return prov
}
