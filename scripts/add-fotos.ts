import "dotenv/config"
import { prisma } from "../lib/db"

async function main() {
  console.log("Añadiendo un par de imagenes a gastos...")

  // Clean all previous just in case
  await prisma.fotoFactura.deleteMany({})

  const gastos = await prisma.gasto.findMany({ take: 2 })
  for (const g of gastos) {
    await prisma.fotoFactura.create({
      data: {
        gastoId: g.id,
        url: "/Logo MCA horizontal.png",
        publicId: "dummy",
      },
    })
  }
  console.log(`✅ Se añadieron ${gastos.length} fotos a los primeros gastos.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
