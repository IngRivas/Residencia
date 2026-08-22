import "dotenv/config"
import { prisma } from "../lib/db"

async function main() {
  console.log("Buscando gasto con concepto 'Takis'...")
  const takisGasto = await prisma.gasto.findFirst({
    where: {
      concepto: {
        contains: "Takis",
        mode: "insensitive",
      },
    },
  })

  if (!takisGasto) {
    console.log(
      "No se encontró ningún gasto con la palabra 'Takis'. No se eliminarán fotos para evitar borrar la equivocada."
    )
    return
  }

  console.log(`Encontrado gasto 'Takis': ID ${takisGasto.id}`)

  // Buscar fotos que NO pertenecen al gasto de takis
  const fotosParaEliminar = await prisma.fotoFactura.findMany({
    where: {
      gastoId: {
        not: takisGasto.id,
      },
    },
  })

  console.log(`Encontradas ${fotosParaEliminar.length} fotos de otros gastos.`)

  let deleted = 0
  for (const foto of fotosParaEliminar) {
    await prisma.fotoFactura.delete({ where: { id: foto.id } })
    deleted++
  }

  console.log(
    `Eliminadas exitosamente ${deleted} fotos. Únicamente se conservaron las fotos del gasto '${takisGasto.concepto}'.`
  )
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())
