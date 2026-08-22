import { prisma } from "../lib/db"
async function main() {
  const fotos = await prisma.fotoFactura.findMany()
  console.log(fotos)
}
main().finally(() => prisma.$disconnect())
