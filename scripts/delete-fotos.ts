import "dotenv/config"
import { prisma } from "../lib/db"

async function main() {
  console.log("Eliminando fotos rotas de la base de datos...")
  const result = await prisma.fotoFactura.deleteMany({})
  console.log(`✅ ${result.count} fotos eliminadas.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
