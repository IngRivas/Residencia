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

    return NextResponse.json({ success: true, count })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
