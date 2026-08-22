import { prisma } from "@/lib/db"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export async function getContratistasHistoricos() {
  try {
    const dbGastos = await prisma.contratistaGasto.findMany({
      where: { isDeleted: false },
      orderBy: { fecha: "desc" }
    })
    
    const gastos = dbGastos.map(g => {
      // Ensure date object is valid, otherwise fallback
      const dateObj = new Date(g.fechaStr + "T12:00:00")
      const fechaFormatted = isNaN(dateObj.getTime()) ? g.fechaStr : format(dateObj, "dd/MM/yyyy", { locale: es })

      return {
        ...g,
        fecha: g.fecha.toISOString(),
        fechaFormatted,
        year: parseInt(g.fechaStr.substring(0, 4), 10)
      }
    })

    // Extract unique obras
    const uniqueObrasStr = Array.from(new Set(gastos.map(g => g.obraNombre).filter(Boolean)))
    const obras = uniqueObrasStr.map(nombre => ({
      id: nombre,
      nombre: nombre
    }))

    // Extract unique years
    const years = Array.from(new Set(gastos.map(g => g.year))).sort((a, b) => b - a)
    
    return { gastos, obras, years }
  } catch (error) {
    console.error("Error fetching contratistas historicos:", error)
    return { gastos: [], obras: [], years: [] }
  }
}
