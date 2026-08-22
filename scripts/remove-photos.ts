import "dotenv/config"
import { prisma } from "../lib/db"

async function main() {
  const fotos = await prisma.fotoFactura.findMany()
  let deleted = 0
  for (const foto of fotos) {
    if (!foto.url.toLowerCase().includes("takis")) {
      await prisma.fotoFactura.delete({ where: { id: foto.id } })
      deleted++
    }
  }
  console.log(`Eliminadas ${deleted} fotos. Quedan las de Takis.`)
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())
