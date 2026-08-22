import "dotenv/config"
import { prisma } from "../lib/db"
import fs from "fs"
import path from "path"

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

async function main() {
  console.log("Starting Gastos Membranas import...")

  const csvPath = path.join(process.cwd(), "EXPORT", "Gastos Membranas.csv")
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at: ${csvPath}`)
  }

  // 1. Ensure Sistema User exists
  let sistemaUser = await prisma.user.findFirst({
    where: {
      OR: [{ name: "Sistema" }, { email: "sistema@spend.local" }],
    },
  })

  if (!sistemaUser) {
    let adminRole = await prisma.role.findUnique({ where: { name: "ADMIN" } })
    if (!adminRole) {
      adminRole = await prisma.role.findFirst()
    }

    const bcrypt = await import("bcryptjs")
    const hashedPassword = await bcrypt.hash("SistemaPassword123!", 10)

    const userData: any = {
      name: "Sistema",
      email: "sistema@spend.local",
      password: hashedPassword,
    }
    if (adminRole?.id) userData.roleId = adminRole.id

    sistemaUser = await prisma.user.create({
      data: userData,
    })
    console.log("Created Sistema user:", sistemaUser.id)
  } else {
    console.log("Using existing Sistema user:", sistemaUser.id)
  }

  // 2. Read and parse CSV lines
  const fileContent = fs.readFileSync(csvPath, "utf8")
  const rawLines = fileContent.split(/\r?\n/)
  console.log(`Total raw CSV lines: ${rawLines.length}`)

  const validRows: Array<{
    fecha: Date
    fechaStr: string
    obraNombre: string
    proveedorNombre: string
    observaciones: string
    unidad: string
    concepto: string
    subtotal: number
    ivaPct: number
    iva: number
    total: number
    extraNotes: string
  }> = []

  const uniqueObraNames = new Set<string>()
  const uniqueProveedorNames = new Set<string>()

  for (let i = 0; i < rawLines.length; i++) {
    const row = parseCSVLine(rawLines[i])
    if (row.length < 5) continue

    const fechaStr = row[0]?.trim()
    const obraNombre = row[1]?.trim()
    const proveedorNombre = row[2]?.trim() || "SIN PROVEEDOR"
    const observaciones = row[3]?.trim() || ""
    const unidad = row[4]?.trim() || ""
    const concepto = row[5]?.trim() || ""

    if (!fechaStr || !obraNombre || obraNombre.toUpperCase() === "OBRA" || fechaStr.toUpperCase() === "FECHA") {
      continue
    }

    const fecha = parseDate(fechaStr)
    if (!fecha) continue

    // Determine total
    let total = parseCurrency(row[19])
    if (total === 0) {
      total = parseCurrency(row[18])
    }
    if (total === 0) continue

    // Determine IVA rate and amounts
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

    // Extra taxes / discounts check
    const ieps = parseCurrency(row[15])
    const descuento = parseCurrency(row[16])
    const ivaRet = parseCurrency(row[17])
    const isrRet = parseCurrency(row[18])

    const extras: string[] = []
    if (ieps > 0) extras.push(`IEPS: $${ieps.toFixed(2)}`)
    if (descuento > 0) extras.push(`Descuento: $${descuento.toFixed(2)}`)
    if (ivaRet > 0) extras.push(`IVA Retenido: $${ivaRet.toFixed(2)}`)
    if (isrRet > 0) extras.push(`ISR Retenido: $${isrRet.toFixed(2)}`)

    const extraNotes = extras.length > 0 ? ` [${extras.join(" | ")}]` : ""

    uniqueObraNames.add(obraNombre)
    if (proveedorNombre) uniqueProveedorNames.add(proveedorNombre)

    validRows.push({
      fecha,
      fechaStr,
      obraNombre,
      proveedorNombre,
      observaciones,
      unidad,
      concepto: concepto || "GASTO GENERAL",
      subtotal,
      ivaPct,
      iva,
      total,
      extraNotes,
    })
  }

  console.log(`Parsed ${validRows.length} valid expense records.`)
  console.log(`Unique Obras (${uniqueObraNames.size}):`, Array.from(uniqueObraNames))
  console.log(`Unique Proveedores (${uniqueProveedorNames.size})`)

  // 3. Upsert Proveedores
  console.log("Upserting Proveedores...")
  for (const provName of uniqueProveedorNames) {
    await prisma.proveedor.upsert({
      where: { nombre: provName },
      update: {},
      create: { nombre: provName },
    })
  }

  // 4. Map and create Obras
  console.log("Ensuring Obras exist...")
  const obraMap = new Map<string, string>() // Name -> ID
  for (const name of uniqueObraNames) {
    let obra = await prisma.obra.findFirst({
      where: { nombre: name, deletedAt: null },
    })
    if (!obra) {
      obra = await prisma.obra.create({
        data: {
          nombre: name,
          presupuestoTotal: 0,
          creadoPorId: sistemaUser.id,
        },
      })
      console.log(`Created new Obra "${name}": ${obra.id}`)
    }
    obraMap.set(name, obra.id)
  }

  // 5. Ensure DiaObra entries exist
  console.log("Ensuring DiaObra entries exist...")
  const diaObraMap = new Map<string, string>() // `${obraId}_${fechaISO}` -> ID

  // Group rows by obraId + fechaISO
  const diaPairs = new Set<string>()
  for (const row of validRows) {
    const obraId = obraMap.get(row.obraNombre)
    if (!obraId) continue
    const key = `${obraId}_${row.fecha.toISOString()}`
    diaPairs.add(key)
  }

  for (const key of diaPairs) {
    const [obraId, fechaISO] = key.split("_")
    const fecha = new Date(fechaISO)

    let diaObra = await prisma.diaObra.findUnique({
      where: {
        obraId_fecha: {
          obraId,
          fecha,
        },
      },
    })

    if (!diaObra) {
      diaObra = await prisma.diaObra.create({
        data: {
          obraId,
          fecha,
          presupuestoDiario: 0,
          reposicion: 0,
        },
      })
    }
    diaObraMap.set(key, diaObra.id)
  }

  console.log(`Prepared ${diaObraMap.size} DiaObra records.`)

  // 6. Create Gastos in batch
  console.log("Inserting Gastos into database...")
  const gastoDataBatch = validRows
    .map((row) => {
      const obraId = obraMap.get(row.obraNombre)
      if (!obraId) return null
      const key = `${obraId}_${row.fecha.toISOString()}`
      const diaObraId = diaObraMap.get(key)
      if (!diaObraId) return null

      const notaCombined = `${row.observaciones}${row.extraNotes}`.trim() || null

      return {
        diaObraId,
        concepto: row.concepto,
        proveedor: row.proveedorNombre,
        porcentajeIVA: row.ivaPct,
        subtotal: row.subtotal,
        iva: row.iva,
        total: row.total,
        notaCapturista: notaCombined,
        categoria: row.unidad || null,
        estado: "VERIFICADO" as const,
        creadoPorId: sistemaUser.id,
      }
    })
    .filter((g): g is NonNullable<typeof g> => g !== null)

  const BATCH_SIZE = 500
  let totalInserted = 0

  for (let i = 0; i < gastoDataBatch.length; i += BATCH_SIZE) {
    const chunk = gastoDataBatch.slice(i, i + BATCH_SIZE)
    await prisma.gasto.createMany({
      data: chunk,
    })
    totalInserted += chunk.length
    console.log(`Inserted ${totalInserted} / ${gastoDataBatch.length} gastos...`)
  }

  const grandTotal = validRows.reduce((acc, r) => acc + r.total, 0)
  console.log(`
======================================================
MIGRATION COMPLETED SUCCESSFULLY!
- Total Obras processed: ${obraMap.size}
- Total Días de Obra created/used: ${diaObraMap.size}
- Total Gastos inserted: ${totalInserted}
- Grand Total Amount: $${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
======================================================
  `)
}

main()
  .catch((e) => {
    console.error("Migration error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
