import "dotenv/config"
import { prisma } from "../lib/db"

async function main() {
  console.log("Iniciando llenado de comprobantes genéricos...")

  // Buscar todos los gastos que NO tengan comprobantes, o en su defecto
  // podemos buscar todos los gastos excluyendo el de "Takis"
  const todosLosGastos = await prisma.gasto.findMany({
    include: { fotos: true },
  })

  let agregadas = 0

  for (const gasto of todosLosGastos) {
    // Si ya tiene foto (por ejemplo el de Takis que acabamos de restaurar), lo saltamos
    if (gasto.fotos && gasto.fotos.length > 0) {
      continue
    }

    // Agregar la foto genérica /obras.jpg
    await prisma.fotoFactura.create({
      data: {
        gastoId: gasto.id,
        url: "/obras.jpg",
        publicId: "seed_obras_generic_" + gasto.id,
      },
    })

    agregadas++
  }

  console.log(
    `✅ ¡Listo! Se agregaron ${agregadas} fotos (obras.jpg) a los gastos sin comprobante.`
  )
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())
