import fs from "fs"
import path from "path"
import { GastoItem, ObraOption } from "@/app/admin/gastos/GastosSpreadsheetClient"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { prisma } from "@/lib/db"

function parseCSVLine(text: string): string[] {
  const result: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === "," && !inQuotes) {
      result.push(cur)
      cur = ""
    } else {
      cur += c
    }
  }
  result.push(cur)
  return result
}

function parseCurrency(str: string | undefined): number {
  if (!str) return 0
  const cleaned = str.replace(/[^0-9.-]+/g, "")
  const val = parseFloat(cleaned)
  return isNaN(val) ? 0 : val
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  const parts = dateStr.trim().split("/")
  if (parts.length !== 3) return null
  const month = parseInt(parts[0], 10) - 1
  const day = parseInt(parts[1], 10)
  let year = parseInt(parts[2], 10)
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null
  if (year < 100) year += 2000
  return new Date(Date.UTC(year, month, day, 12, 0, 0))
}

export async function getGastosHistoricos(mode: "active" | "deleted" = "active"): Promise<{
  gastos: GastoItem[]
  obras: ObraOption[]
  years: number[]
}> {
  const csvPath = path.join(process.cwd(), "EXPORT", "Gastos Membranas.csv")
  
  const items: GastoItem[] = []
  const obrasMap = new Map<string, string>()
  const yearsSet = new Set<number>()

  // Fetch all db items
  const dbGastos = await prisma.spreadsheetGasto.findMany()
  
  const dbGastoIds = new Set(dbGastos.map(g => g.id))
  
  // Permanent deletes file is still supported if they manually put things there
  const permanentesPath = path.join(process.cwd(), "EXPORT", "gastos_borrados_permanentes.json")
  let permanentes = new Set<string>()
  if (fs.existsSync(permanentesPath)) {
    try {
      permanentes = new Set(JSON.parse(fs.readFileSync(permanentesPath, "utf8")))
    } catch(e) {}
  }

  if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, "utf8")
    const lines = content.split(/\r?\n/)

    for (let i = 0; i < lines.length; i++) {
      const row = parseCSVLine(lines[i])
      if (row.length < 5) continue

      const fechaStr = row[0]?.trim()
      const obraNombre = row[1]?.trim()
      const proveedorNombre = row[2]?.trim() || "SIN PROVEEDOR"
      const observaciones = row[3]?.trim() || ""
      const unidad = row[4]?.trim() || ""
      const concepto = row[5]?.trim() || ""

      if (
        !fechaStr ||
        !obraNombre ||
        obraNombre.toUpperCase() === "OBRA" ||
        fechaStr.toUpperCase() === "FECHA"
      ) {
        continue
      }

      const dateObj = parseDate(fechaStr)
      if (!dateObj) continue

      const id = `csv-${i}`
      
      // If the record exists in DB (edited or deleted), skip the raw CSV version
      if (dbGastoIds.has(id)) continue

      if (mode === "active") {
        if (permanentes.has(id)) continue
      } else {
        if (!permanentes.has(id)) continue
      }

      let total = parseCurrency(row[19])
      if (total === 0) total = parseCurrency(row[18])
      if (total === 0) continue

      const sub8Real = parseCurrency(row[6])
      const sub8 = parseCurrency(row[7])
      const sub16Real = parseCurrency(row[8])
      const sub16 = parseCurrency(row[9])
      const sub0 = parseCurrency(row[10])

      const iva8Rate = row[11]?.trim()
      const iva8Val = parseCurrency(row[12])
      const iva16Rate = row[13]?.trim()
      const iva16Val = parseCurrency(row[14])

      let ivaPct = 0
      let iva = 0
      let subtotal = 0

      if (iva8Val > 0 || iva8Rate.includes("8") || sub8 > 0 || sub8Real > 0) {
        ivaPct = 8.0
        iva = iva8Val
        subtotal = sub8 || sub8Real || total - iva
      } else if (iva16Val > 0 || iva16Rate.includes("16") || sub16 > 0 || sub16Real > 0) {
        ivaPct = 16.0
        iva = iva16Val
        subtotal = sub16 || sub16Real || total - iva
      } else {
        ivaPct = 0.0
        subtotal = sub0 || total
        iva = 0
      }

      if (subtotal <= 0) {
        subtotal = Number((total / (1 + ivaPct / 100)).toFixed(2))
        iva = Number((total - subtotal).toFixed(2))
      }

      // Extras check
      const ieps = parseCurrency(row[15])
      const descuento = parseCurrency(row[16])
      const ivaRet = parseCurrency(row[17])
      const isrRet = parseCurrency(row[18])

      let year = dateObj.getUTCFullYear()
      // Fix historical typo in CSV (line 5100 has 5/5/2006 instead of 2026)
      if (year < 2020) {
        year = 2026
        dateObj.setUTCFullYear(2026)
      }
      const month = dateObj.getUTCMonth() + 1
      yearsSet.add(year)

      const fechaISO = dateObj.toISOString().split("T")[0]
      const fechaFormatted = format(dateObj, "dd/MM/yyyy", { locale: es })

      const obraKey = obraNombre.toLowerCase()
      if (!obrasMap.has(obraKey)) {
        obrasMap.set(obraKey, obraNombre.toUpperCase())
      }

      items.push({
        id,
        fecha: fechaISO,
        fechaFormatted,
        year,
        month,
        obraId: obraKey,
        obraNombre: obraNombre.toUpperCase(),
        proveedor: proveedorNombre.toUpperCase(),
        concepto: concepto.toUpperCase(),
        categoria: unidad || null,
        subtotal: subtotal,
        subtotal16: ivaPct === 16 ? subtotal : undefined,
        subtotal8: ivaPct === 8 ? subtotal : undefined,
        subtotal0: ivaPct === 0 ? subtotal : undefined,
        porcentajeIVA: ivaPct,
        iva: iva,
        iva16: ivaPct === 16 ? iva : undefined,
        iva8: ivaPct === 8 ? iva : undefined,
        total: total,
        ieps: ieps || undefined,
        descuento: descuento || undefined,
        ivaRetenido: ivaRet || undefined,
        isrRetenido: isrRet || undefined,
        notaCapturista: observaciones.trim() || null,
        creadoPorNombre: "Sistema",
        estado: "VERIFICADO",
      })
    }
  }

  // Load all DB records (additions and edits)
  for (const g of dbGastos) {
    if (mode === "active" && g.isDeleted) continue
    if (mode === "deleted" && !g.isDeleted) continue
    if (permanentes.has(g.id)) continue

    const item: GastoItem = {
      id: g.id,
      fecha: g.fecha,
      fechaFormatted: g.fechaFormatted,
      year: g.year,
      month: g.month,
      obraId: g.obraId.toLowerCase(),
      obraNombre: g.obraNombre.toUpperCase(),
      proveedor: g.proveedor,
      concepto: g.concepto,
      categoria: g.categoria,
      subtotal: Number(g.subtotal),
      subtotal16: g.subtotal16 ? Number(g.subtotal16) : undefined,
      subtotal8: g.subtotal8 ? Number(g.subtotal8) : undefined,
      subtotal0: g.subtotal0 ? Number(g.subtotal0) : undefined,
      porcentajeIVA: Number(g.porcentajeIVA),
      iva: Number(g.iva),
      iva16: g.iva16 ? Number(g.iva16) : undefined,
      iva8: g.iva8 ? Number(g.iva8) : undefined,
      total: Number(g.total),
      ieps: g.ieps ? Number(g.ieps) : undefined,
      descuento: g.descuento ? Number(g.descuento) : undefined,
      ivaRetenido: g.ivaRetenido ? Number(g.ivaRetenido) : undefined,
      isrRetenido: g.isrRetenido ? Number(g.isrRetenido) : undefined,
      notaCapturista: g.notaCapturista,
      creadoPorNombre: g.creadoPorNombre,
      estado: g.estado
    }
    
    items.unshift(item)
    yearsSet.add(item.year)
    const key = item.obraNombre.toLowerCase()
    if (!obrasMap.has(key)) {
      obrasMap.set(key, item.obraNombre.toUpperCase())
    }
  }

  const obrasList: ObraOption[] = Array.from(obrasMap.entries())
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const yearsList = Array.from(yearsSet).sort((a, b) => b - a)

  return {
    gastos: items,
    obras: obrasList,
    years: yearsList,
  }
}
