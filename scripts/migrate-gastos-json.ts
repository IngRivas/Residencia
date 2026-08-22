import fs from "fs"
import path from "path"
import { prisma } from "../lib/db"

async function migrate() {
  console.log("Iniciando migración de JSON a Prisma...")

  const getPath = (baseName: string) => {
    const jsonPath = path.join(process.cwd(), "EXPORT", `${baseName}.json`)
    const bakPath = path.join(process.cwd(), "EXPORT", `${baseName}.json.bak`)
    return fs.existsSync(jsonPath) ? jsonPath : (fs.existsSync(bakPath) ? bakPath : null)
  }

  const cardsPath = getPath("cards_obras")
  const adicionalesPath = getPath("gastos_adicionales")
  const eliminadosPath = getPath("gastos_eliminados")

  // 1. Migrar Cards
  if (cardsPath) {
    try {
      const cardsData = JSON.parse(fs.readFileSync(cardsPath, "utf8"))
      for (const c of cardsData) {
        if (typeof c === "string") {
          await prisma.spreadsheetCardConfig.upsert({
            where: { id: c },
            update: {},
            create: { id: c, type: "normal", obraId: c, isEnabled: true }
          })
        } else {
          await prisma.spreadsheetCardConfig.upsert({
            where: { id: c.id },
            update: {},
            create: {
              id: c.id,
              type: c.type,
              obraId: c.obraId,
              keyword: c.keyword || null,
              titulo: c.titulo || null,
              isEnabled: c.isEnabled !== false
            }
          })
        }
      }
      console.log(`✅ Migradas ${cardsData.length} tarjetas.`)
    } catch (e: any) {
      console.error("Error migrando cards:", e.message)
    }
  }

  // 2. Migrar Gastos Adicionales
  if (adicionalesPath) {
    try {
      const gastosData = JSON.parse(fs.readFileSync(adicionalesPath, "utf8"))
      for (const g of gastosData) {
        await prisma.spreadsheetGasto.upsert({
          where: { id: g.id },
          update: {},
          create: {
            id: g.id,
            fecha: g.fecha,
            fechaFormatted: g.fechaFormatted,
            year: g.year,
            month: g.month,
            obraId: g.obraId,
            obraNombre: g.obraNombre,
            proveedor: g.proveedor || "N/A",
            concepto: g.concepto,
            categoria: g.categoria || null,
            subtotal: g.subtotal || 0,
            subtotal16: g.subtotal16 || null,
            subtotal8: g.subtotal8 || null,
            subtotal0: g.subtotal0 || null,
            porcentajeIVA: g.porcentajeIVA || 0,
            iva: g.iva || 0,
            iva16: g.iva16 || null,
            iva8: g.iva8 || null,
            ieps: g.ieps || null,
            descuento: g.descuento || null,
            ivaRetenido: g.ivaRetenido || null,
            isrRetenido: g.isrRetenido || null,
            total: g.total || 0,
            notaCapturista: g.notaCapturista || null,
            creadoPorNombre: g.creadoPorNombre || "Sistema",
            estado: g.estado || "VERIFICADO",
            isDeleted: false
          }
        })
      }
      console.log(`✅ Migrados ${gastosData.length} gastos adicionales.`)
    } catch (e: any) {
      console.error("Error migrando gastos adicionales:", e.message)
    }
  }

  // 3. Migrar Gastos Eliminados
  if (eliminadosPath) {
    try {
      const eliminados = JSON.parse(fs.readFileSync(eliminadosPath, "utf8"))
      let count = 0
      for (const id of eliminados) {
        if (id.startsWith("manual-")) {
          // It's a manual gasto, just update it if it exists
          await prisma.spreadsheetGasto.updateMany({
            where: { id },
            data: { isDeleted: true }
          })
          count++
        } else if (id.startsWith("csv-")) {
          // It's a CSV row, create a stub
          await prisma.spreadsheetGasto.upsert({
            where: { id },
            update: { isDeleted: true },
            create: {
              id,
              fecha: "",
              fechaFormatted: "",
              year: 0,
              month: 0,
              obraId: "",
              obraNombre: "",
              proveedor: "",
              concepto: "",
              subtotal: 0,
              porcentajeIVA: 0,
              iva: 0,
              total: 0,
              creadoPorNombre: "Sistema",
              estado: "ELIMINADO",
              isDeleted: true
            }
          })
          count++
        }
      }
      console.log(`✅ Migrados ${count} gastos eliminados.`)
    } catch (e: any) {
      console.error("Error migrando gastos eliminados:", e.message)
    }
  }

  console.log("Migración completada.")
}

migrate()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
