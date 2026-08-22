import * as fs from "fs"
import * as path from "path"
import { parse } from "csv-parse/sync"
import { prisma } from "../lib/db"

async function main() {
  const csvPath = path.join(process.cwd(), "EXPORT", "Gastos Membranas jacobo page.csv")
  
  if (!fs.existsSync(csvPath)) {
    console.error(`No se encontro el archivo: ${csvPath}`)
    process.exit(1)
  }

  const fileContent = fs.readFileSync(csvPath, "utf-8")
  
  const records = parse(fileContent, {
    skip_empty_lines: true,
    relax_quotes: true,
  })

  let count = 0
  
  const cleanStr = (str: any) => {
    if (!str) return ""
    return String(str).trim()
  }

  const parseCurrency = (val: string) => {
    if (!val) return 0
    const clean = val.replace(/[\$, ]/g, '')
    return parseFloat(clean) || 0
  }

  for (const row of records) {
    const rawFecha = cleanStr(row[2])
    
    if (!rawFecha || !rawFecha.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      continue
    }

    const obraNombre = cleanStr(row[3])
    const periodo = cleanStr(row[4])
    const trabajoRealizado = cleanStr(row[5])
    const contratista = cleanStr(row[6])
    const totalRaw = cleanStr(row[7])

    const total = parseCurrency(totalRaw)
    
    const [m, d, y] = rawFecha.split("/")
    const fechaObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    
    const mStr = m.padStart(2, '0')
    const dStr = d.padStart(2, '0')
    const fechaStr = `${y}-${mStr}-${dStr}`

    const uniqueId = `csv-jacobo-${count}`

    await prisma.contratistaGasto.upsert({
      where: { id: uniqueId },
      update: {},
      create: {
        id: uniqueId,
        fecha: fechaObj,
        fechaStr: fechaStr,
        obraNombre: obraNombre || "N/A",
        periodo,
        trabajoRealizado,
        contratista: contratista || "N/A",
        total: total,
        creadoPorNombre: "Sistema (CSV)",
      }
    })
    
    count++
  }

  console.log(`✅ Migradas ${count} filas de contratistas exitosamente.`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
