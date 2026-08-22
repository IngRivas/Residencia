import "dotenv/config"
import { prisma } from "../lib/db"

async function main() {
  const targetObra = await prisma.obra.findFirst({
    where: { nombre: "Altalia III" },
  })

  if (!targetObra) {
    console.error("Altalia III no encontrada.")
    return
  }

  // Borrar todas las demas obras
  const otrasObras = await prisma.obra.findMany({
    where: { nombre: { not: "Altalia III" } },
    select: { id: true },
  })

  const obraIds = otrasObras.map((o: any) => o.id)

  if (obraIds.length > 0) {
    console.log(`Borrando ${obraIds.length} obras que no son Altalia III...`)
    try {
      await prisma.fotoFactura.deleteMany({
        where: { gasto: { diaObra: { obraId: { in: obraIds } } } },
      })
      await prisma.gasto.deleteMany({
        where: { diaObra: { obraId: { in: obraIds } } },
      })
      await prisma.diaObra.deleteMany({
        where: { obraId: { in: obraIds } },
      })
      await prisma.obraUser.deleteMany({
        where: { obraId: { in: obraIds } },
      })
      await prisma.obra.deleteMany({
        where: { id: { in: obraIds } },
      })
      console.log("✅ Limpieza de otras obras completada.")
    } catch (e) {
      console.error(
        "Error al borrar obras relacionadas. Es posible que el schema use on cascade y se pueda usar deleteMany directamente:",
        e
      )
      try {
        await prisma.obra.deleteMany({ where: { id: { in: obraIds } } })
        console.log("✅ Limpieza de otras obras completada (por cascada).")
      } catch (e2) {
        console.error("Error definitivo:", e2)
      }
    }
  } else {
    console.log("✅ No hay otras obras para borrar.")
  }

  // Anadir imagenes a gastos de Altalia III
  const gastosAltalia = await prisma.gasto.findMany({
    where: { diaObra: { obraId: targetObra.id } },
  })

  console.log(
    `Añadiendo imágenes a ${gastosAltalia.length} gastos de Altalia III...`
  )

  const imageUrls = [
    "https://images.unsplash.com/photo-1541888081622-c43916298516?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
    "https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
    "https://plus.unsplash.com/premium_photo-1661919210043-fd847a58522d?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
  ]

  for (const gasto of gastosAltalia) {
    const hasFotos = await prisma.fotoFactura.count({
      where: { gastoId: gasto.id },
    })
    if (hasFotos === 0) {
      const randomImg = imageUrls[Math.floor(Math.random() * imageUrls.length)]
      await prisma.fotoFactura.create({
        data: {
          gastoId: gasto.id,
          url: randomImg,
          publicId:
            "dummy_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        },
      })
    }
  }

  console.log("✅ Imágenes añadidas.")
  console.log(
    "🎉 Script completado. Quedan solo roles, usuarios y la obra Altalia III con sus imagenes."
  )
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
