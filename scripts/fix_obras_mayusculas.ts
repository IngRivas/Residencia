import { config } from "dotenv"
config({ path: ".env.local" })
import { prisma } from "../lib/db"

async function main() {
  console.log("Iniciando actualización de obras a mayúsculas...")
  
  const gastos = await prisma.spreadsheetGasto.findMany()
  console.log(`Se encontraron ${gastos.length} gastos en la base de datos.`)
  
  let count = 0
  for (const gasto of gastos) {
    if (gasto.obraNombre && gasto.obraNombre !== gasto.obraNombre.toUpperCase()) {
      await prisma.spreadsheetGasto.update({
        where: { id: gasto.id },
        data: {
          obraNombre: gasto.obraNombre.toUpperCase(),
          obraId: gasto.obraId.toLowerCase()
        }
      })
      count++
    }
  }
  console.log(`Se actualizaron ${count} registros de SpreadsheetGasto.`)

  const contratistas = await prisma.contratistaGasto.findMany()
  let cCount = 0
  for (const c of contratistas) {
    if (c.obraNombre && c.obraNombre !== c.obraNombre.toUpperCase()) {
      await prisma.contratistaGasto.update({
        where: { id: c.id },
        data: {
          obraNombre: c.obraNombre.toUpperCase()
        }
      })
      cCount++
    }
  }
  console.log(`Se actualizaron ${cCount} registros de ContratistaGasto.`)
  
  console.log("¡Proceso terminado!")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
