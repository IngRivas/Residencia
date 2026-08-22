"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { CardConfig } from "@/app/admin/gastos/GastosSpreadsheetClient"

export async function getCardsObras(): Promise<CardConfig[]> {
  try {
    const cards = await prisma.spreadsheetCardConfig.findMany()
    // Transform Prisma data to CardConfig
    return cards.map(c => ({
      id: c.id,
      type: c.type as "normal" | "custom",
      obraId: c.obraId,
      keyword: c.keyword || undefined,
      titulo: c.titulo || undefined,
      fechaInicio: c.fechaInicio || undefined,
      fechaFin: c.fechaFin || undefined,
      isEnabled: c.isEnabled
    }))
  } catch (error) {
    console.error("Error leyendo cards:", error)
    return []
  }
}

export async function saveCardsObras(obras: CardConfig[]) {
  try {
    // Delete all existing and insert new (simple sync approach)
    await prisma.$transaction(async (tx) => {
      await tx.spreadsheetCardConfig.deleteMany()
      if (obras.length > 0) {
        await tx.spreadsheetCardConfig.createMany({
          data: obras.map(o => ({
            id: o.id,
            type: o.type,
            obraId: o.obraId,
            keyword: o.keyword || null,
            titulo: o.titulo || null,
            fechaInicio: o.fechaInicio || null,
            fechaFin: o.fechaFin || null,
            isEnabled: o.isEnabled !== false // Default to true
          }))
        })
      }
    })
    
    revalidatePath("/admin/gastos")
    return { success: true }
  } catch (error) {
    console.error("Error guardando cards:", error)
    return { success: false }
  }
}
