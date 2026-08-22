import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const gastos = await prisma.spreadsheetGasto.findMany()
    let count = 0
    for (const gasto of gastos) {
      if (gasto.obraNombre && gasto.obraNombre !== gasto.obraNombre.toUpperCase()) {
        await prisma.spreadsheetGasto.update({
          where: { id: gasto.id },
          data: { obraNombre: gasto.obraNombre.toUpperCase(), obraId: gasto.obraId.toLowerCase() }
        })
        count++
      }
    }

    const contratistas = await prisma.contratistaGasto.findMany()
    let cCount = 0
    for (const c of contratistas) {
      if (c.obraNombre && c.obraNombre !== c.obraNombre.toUpperCase()) {
        await prisma.contratistaGasto.update({
          where: { id: c.id },
          data: { obraNombre: c.obraNombre.toUpperCase() }
        })
        cCount++
      }
    }

    return NextResponse.json({ success: true, count, cCount })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
