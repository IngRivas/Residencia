import "dotenv/config"
import { prisma } from "../lib/db"

async function main() {
  const takisGasto = await prisma.gasto.findFirst({
    where: {
      concepto: {
        contains: "Takis",
      },
    },
  })

  if (!takisGasto) {
    console.log("No se encontró gasto de Takis.")
    return
  }

  // Verificar si ya tiene foto
  const tieneFoto = await prisma.fotoFactura.findFirst({
    where: { gastoId: takisGasto.id },
  })
  if (!tieneFoto) {
    await prisma.fotoFactura.create({
      data: {
        gastoId: takisGasto.id,
        url: "https://i.ytimg.com/vi/Wj0wUvO_aA4/maxresdefault.jpg", // Foto de takis
        publicId: "seed_takis_123",
      },
    })
    console.log(
      "✅ Se restauró la foto del gasto de Takis Fuego en la base de datos."
    )
  } else {
    console.log("El gasto de Takis ya tiene foto.")
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())
