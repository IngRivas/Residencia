"use server"

import { prisma } from "@/lib/db"

export async function getContratistaCards() {
  try {
    const cards = await prisma.contratistaCardConfig.findMany()
    return cards
  } catch (e) {
    return []
  }
}

export async function saveContratistaCards(cardsData: any[]) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.contratistaCardConfig.deleteMany()
      if (cardsData.length > 0) {
        await tx.contratistaCardConfig.createMany({
          data: cardsData.map(c => ({
            id: c.id,
            type: c.type,
            obraId: c.obraId,
            keyword: c.keyword || null,
            titulo: c.titulo || null,
            fechaInicio: c.fechaInicio || null,
            fechaFin: c.fechaFin || null,
            isEnabled: c.isEnabled !== false
          }))
        })
      }
    })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
