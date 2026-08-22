"use server"

import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import fs from "fs"
import path from "path"
async function requireAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("No autenticado")
  const role = (session.user as any).role
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    throw new Error("No autorizado")
  }
  return session.user
}

export async function cleanupRecycleBin() {
  await requireAdmin()

  // Find the date 7 days ago
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Hard delete Gastos older than 7 days
  await prisma.gasto.deleteMany({
    where: {
      deletedAt: {
        lte: sevenDaysAgo,
      },
    },
  })

  // Hard delete DiaObra older than 7 days
  await prisma.diaObra.deleteMany({
    where: {
      deletedAt: {
        lte: sevenDaysAgo,
      },
    },
  })

  // Hard delete Obra older than 7 days
  await prisma.obra.deleteMany({
    where: {
      deletedAt: {
        lte: sevenDaysAgo,
      },
    },
  })
}

import { logActivity } from "./logs"

export async function emptyRecycleBin() {
  const user = await requireAdmin()

  // First delete all gastos
  await prisma.gasto.deleteMany({
    where: {
      deletedAt: { not: null },
    },
  })

  // Then delete DiaObra
  await prisma.diaObra.deleteMany({
    where: {
      deletedAt: { not: null },
    },
  })

  // Then delete Obra
  await prisma.obra.deleteMany({
    where: {
      deletedAt: { not: null },
    },
  })


  await logActivity(
    user.id,
    "EMPTY_TRASH",
    "Papelera",
    "ALL",
    "Limpió la papelera de reciclaje"
  )

  revalidatePath("/", "layout")
  return { success: true }
}

export async function getRecycleBinItems() {
  await requireAdmin()

  const [obras, dias, gastos] = await Promise.all([
    prisma.obra.findMany({
      where: {
        deletedAt: { not: null },
      },
      orderBy: { deletedAt: "desc" },
    }),
    prisma.diaObra.findMany({
      where: {
        deletedAt: { not: null },
      },
      include: { obra: true },
      orderBy: { deletedAt: "desc" },
    }),
    prisma.gasto.findMany({
      where: {
        deletedAt: { not: null },
      },
      include: { diaObra: { include: { obra: true } } },
      orderBy: { deletedAt: "desc" },
    }),
  ])


  return {
    obras: JSON.parse(
      JSON.stringify(
        obras.map((o) => ({
          ...o,
          presupuestoTotal: Number(o.presupuestoTotal),
        }))
      )
    ),
    dias: JSON.parse(
      JSON.stringify(
        dias.map((d) => ({
          ...d,
          presupuestoDiario: Number(d.presupuestoDiario),
          obra: d.obra
            ? {
                ...d.obra,
                presupuestoTotal: Number(d.obra.presupuestoTotal),
              }
            : null,
        }))
      )
    ),
    gastos: JSON.parse(
      JSON.stringify(
        gastos.map((g) => ({
          ...g,
          subtotal: Number(g.subtotal),
          porcentajeIVA: Number(g.porcentajeIVA),
          iva: Number(g.iva),
          total: Number(g.total),
          diaObra: g.diaObra
            ? {
                ...g.diaObra,
                presupuestoDiario: Number(g.diaObra.presupuestoDiario),
                obra: g.diaObra.obra
                  ? {
                      ...g.diaObra.obra,
                      presupuestoTotal: Number(g.diaObra.obra.presupuestoTotal),
                    }
                  : null,
              }
            : null,
        }))
      )
    )
  }
}
