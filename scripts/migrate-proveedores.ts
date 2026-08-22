import { prisma } from "../lib/db"

async function main() {
  console.log("Migrating existing proveedores...")

  // Get all unique proveedores from Gasto table
  const gastos = await prisma.gasto.findMany({
    select: { proveedor: true },
    distinct: ["proveedor"],
  })

  const uniqueProveedores = gastos.map((g) => g.proveedor).filter(Boolean)

  console.log(
    `Found ${uniqueProveedores.length} unique proveedores from existing gastos.`
  )

  let added = 0
  for (const provName of uniqueProveedores) {
    const name = provName.trim()
    if (!name) continue

    const existing = await prisma.proveedor.findUnique({
      where: { nombre: name },
    })

    if (!existing) {
      await prisma.proveedor.create({
        data: { nombre: name },
      })
      added++
    }
  }

  console.log(`Successfully added ${added} new proveedores to the catalog.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
