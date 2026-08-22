"use server"

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { GastoEstado } from "@prisma/client"
import { logActivity } from "./logs"
import fs from "fs"
import path from "path"

async function requireUser() {
  const session = await auth()
  if (!session?.user) throw new Error("No autenticado")
  return session.user
}

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) throw new Error("No autenticado")
  const role = (session.user as any).role
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    throw new Error("No autorizado")
  }
  return session.user
}

// Get unique proveedores for an obra (used for datalist autocomplete)
export async function getUniqueProveedores(obraId: string) {
  // Returns all providers from the global Proveedor catalog
  const proveedores = await prisma.proveedor.findMany({
    orderBy: { nombre: "asc" },
    select: { nombre: true },
  })
  return proveedores.map((p) => p.nombre)
}

// Quickly add a new provider to the catalog (allowed for capturistas)
export async function quickAddProveedor(nombre: string) {
  await requireUser()
  const provName = nombre?.trim()
  if (!provName) return { success: false }

  await prisma.proveedor.upsert({
    where: { nombre: provName },
    update: {},
    create: { nombre: provName },
  })

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")

  return { success: true }
}

// Get unique categories for an obra
export async function getUniqueCategorias(obraId: string) {
  const gastos = await prisma.gasto.findMany({
    where: { diaObra: { obraId } },
    select: { categoria: true },
    distinct: ["categoria"],
  })
  return gastos.map((g) => g.categoria).filter(Boolean) as string[]
}

// Find or create DiaObra and save expense
export async function addGasto(
  obraId: string,
  gastoData: {
    fecha: string // YYYY-MM-DD
    concepto: string
    proveedor: string
    categoria?: string
    isImprevisto?: boolean
    restarPresupuesto?: boolean
    importeTotal: number
    porcentajeIVA: number // 8 or 16
    notaCapturista?: string
    fotos?: { url: string; publicId: string }[]
  }
) {
  const user = await requireUser()

  const fechaDate = new Date(gastoData.fecha + "T00:00:00")

  // Find or create DiaObra
  let diaObra = await prisma.diaObra.findUnique({
    where: {
      obraId_fecha: {
        obraId,
        fecha: fechaDate,
      },
    },
  })

  if (!diaObra) {
    diaObra = await prisma.diaObra.create({
      data: {
        obraId,
        fecha: fechaDate,
        presupuestoDiario: 0.0, // Default to 0, admin can set it
      },
    })
  }

  // Calculate fields
  const total = gastoData.importeTotal
  const ivaRate = gastoData.porcentajeIVA / 100
  const subtotal = total / (1 + ivaRate)
  const iva = total - subtotal

  // Check if admin to not affect budget
  const isAdmin =
    (user as any).role === "ADMIN" || (user as any).role === "SUPER_ADMIN"

  let noAfectaPresupuesto = false // default for capturistas (always affects budget)
  if (isAdmin) {
    if (typeof gastoData.restarPresupuesto !== "undefined") {
      noAfectaPresupuesto = !gastoData.restarPresupuesto
    } else {
      noAfectaPresupuesto = true // backward compatibility
    }
  }

  // Auto-register proveedor in catalog if it doesn't exist
  if (gastoData.proveedor && gastoData.proveedor.trim()) {
    const provName = gastoData.proveedor.trim()
    await prisma.proveedor.upsert({
      where: { nombre: provName },
      update: {},
      create: { nombre: provName },
    })
  }

  const gasto = await prisma.gasto.create({
    data: {
      diaObraId: diaObra.id,
      concepto: gastoData.concepto,
      proveedor: gastoData.proveedor,
      categoria: gastoData.categoria || null,
      isImprevisto: gastoData.isImprevisto || false,
      noAfectaPresupuesto,
      porcentajeIVA: gastoData.porcentajeIVA,
      subtotal,
      iva,
      total,
      notaCapturista: gastoData.notaCapturista || "",
      creadoPorId: user.id!,
      estado: GastoEstado.PENDIENTE,
      fotos: {
        create:
          gastoData.fotos?.map((f) => ({
            url: f.url,
            publicId: f.publicId,
          })) || [],
      },
    },
  })

  const obra = await prisma.obra.findUnique({
    where: { id: obraId },
    select: { nombre: true },
  })
  await logActivity(
    user.id!,
    "AGREGAR_GASTO",
    "Gasto",
    gasto.id,
    `Registró gasto por $${total} en concepto "${gastoData.concepto}" en la obra "${obra?.nombre || obraId}"`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return { success: true, id: gasto.id }
}

// Set or update DiaObra budget
export async function setPresupuestoDiario(
  diaObraId: string,
  presupuesto: number
) {
  await requireAdmin()

  const dia = await prisma.diaObra.update({
    where: { id: diaObraId },
    data: {
      presupuestoDiario: presupuesto,
    },
  })

  revalidatePath("/", "layout")
  return { success: true }
}

// Set or update DiaObra reposicion
export async function setReposicionDiaria(
  diaObraId: string,
  reposicion: number
) {
  await requireAdmin()

  const dia = await prisma.diaObra.update({
    where: { id: diaObraId },
    data: {
      reposicion: reposicion,
    },
  })

  revalidatePath("/", "layout")
  return { success: true }
}

// Verify expense (Admin only)
export async function verifyGasto(
  gastoId: string,
  data: { estado: GastoEstado; notaAdmin?: string }
) {
  await requireAdmin()

  const gasto = await prisma.gasto.update({
    where: { id: gastoId },
    data: {
      estado: data.estado,
      notaAdmin: data.notaAdmin,
    },
    include: {
      diaObra: true,
    },
  })

  await logActivity(
    (await requireAdmin()).id!,
    "VERIFICAR_GASTO",
    "Gasto",
    gastoId,
    `Cambió el estado del gasto a ${data.estado}`
  )

  revalidatePath("/", "layout")
  return { success: true }
}

// Save admin note only (without changing estado)
export async function saveAdminNote(gastoId: string, nota: string) {
  await requireAdmin()

  const gasto = await prisma.gasto.update({
    where: { id: gastoId },
    data: { notaAdmin: nota },
    include: { diaObra: true },
  })

  revalidatePath("/", "layout")
  return { success: true }
}

// Delete admin note
export async function deleteAdminNote(gastoId: string) {
  await requireAdmin()

  const gasto = await prisma.gasto.update({
    where: { id: gastoId },
    data: { notaAdmin: "" },
    include: { diaObra: true },
  })

  revalidatePath("/", "layout")
  return { success: true }
}

// Update VAT (IVA) for an expense
export async function updateGastoIva(gastoId: string, porcentajeIVA: number) {
  await requireAdmin()

  const currentGasto = await prisma.gasto.findUnique({
    where: { id: gastoId },
    include: { diaObra: true },
  })

  if (!currentGasto) {
    throw new Error("Gasto no encontrado")
  }

  // Calculate new values based on existing total
  const total = Number(currentGasto.total)
  const ivaRate = porcentajeIVA / 100
  const subtotal = total / (1 + ivaRate)
  const iva = total - subtotal

  const gasto = await prisma.gasto.update({
    where: { id: gastoId },
    data: {
      porcentajeIVA,
      subtotal,
      iva,
    },
    include: { diaObra: true },
  })

  revalidatePath("/", "layout")
  return { success: true }
}

// Edit gasto fields (Admin only) — does NOT change importe total
export async function updateGastoAdmin(
  gastoId: string,
  data: {
    concepto: string
    proveedor: string
    categoria?: string
    isImprevisto: boolean
    restarPresupuesto?: boolean
    porcentajeIVA: number
    total: number
    notaCapturista?: string
  }
) {
  const admin = await requireAdmin()

  const currentGasto = await prisma.gasto.findUnique({
    where: { id: gastoId },
    include: { diaObra: true },
  })

  if (!currentGasto) throw new Error("Gasto no encontrado")

  // Recalculate subtotal/iva with the new total
  const totalNum = data.total
  const ivaRate = data.porcentajeIVA / 100
  const subtotal = totalNum / (1 + ivaRate)
  const iva = totalNum - subtotal

  const updateData: any = {
    concepto: data.concepto,
    proveedor: data.proveedor,
    categoria: data.categoria || null,
    isImprevisto: data.isImprevisto,
    porcentajeIVA: data.porcentajeIVA,
    total: totalNum,
    subtotal,
    iva,
    notaCapturista: data.notaCapturista ?? currentGasto.notaCapturista,
  }

  if (typeof data.restarPresupuesto !== "undefined") {
    updateData.noAfectaPresupuesto = !data.restarPresupuesto
  }

  const gasto = await prisma.gasto.update({
    where: { id: gastoId },
    data: updateData,
    include: { diaObra: true },
  })

  const formatter = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
  const fechaStr = formatter.format(gasto.diaObra.fecha)
  const fechaStrCap = fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1)
  await logActivity(
    admin.id!,
    "EDITAR_GASTO",
    "Gasto",
    gastoId,
    `Modifico el gasto ${data.concepto} del dia ${fechaStrCap}`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return { success: true }
}

export async function softDeleteExpenseAdmin(gastoId: string) {
  await requireAdmin()

  const gasto = await prisma.gasto.update({
    where: { id: gastoId },
    data: { deletedAt: new Date() },
    include: { diaObra: true },
  })

  const obra = await prisma.obra.findUnique({
    where: { id: gasto.diaObra.obraId },
    select: { nombre: true },
  })
  await logActivity(
    (await requireAdmin()).id!,
    "ELIMINAR_GASTO",
    "Gasto",
    gastoId,
    `Envió un gasto a la papelera en la obra "${obra?.nombre || gasto.diaObra.obraId}"`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return true
}

export async function restoreExpenseAdmin(gastoId: string) {
  const admin = await requireAdmin()

  if (gastoId.startsWith("csv-") || gastoId.startsWith("manual-")) {
    const eliminadosPath = path.join(process.cwd(), "EXPORT", "gastos_eliminados.json")
    if (fs.existsSync(eliminadosPath)) {
      try {
        let eliminados = JSON.parse(fs.readFileSync(eliminadosPath, "utf8")) as string[]
        eliminados = eliminados.filter(id => id !== gastoId)
        fs.writeFileSync(eliminadosPath, JSON.stringify(eliminados, null, 2), "utf8")
      } catch(e) {}
    }
    await logActivity(
      admin.id!,
      "RESTAURAR_GASTO",
      "Gasto",
      gastoId,
      `Restauró un gasto histórico/importado de la papelera`
    )
    revalidatePath("/", "layout")
    return true
  }

  const gasto = await prisma.gasto.update({
    where: { id: gastoId },
    data: { deletedAt: null },
    include: { diaObra: true },
  })

  const obra = await prisma.obra.findUnique({
    where: { id: gasto.diaObra.obraId },
    select: { nombre: true },
  })
  await logActivity(
    admin.id!,
    "RESTAURAR_GASTO",
    "Gasto",
    gastoId,
    `Restauró un gasto de la papelera en la obra "${obra?.nombre || gasto.diaObra.obraId}"`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return true
}

export async function permanentDeleteExpenseAdmin(gastoId: string) {
  const admin = await requireAdmin()

  if (gastoId.startsWith("csv-") || gastoId.startsWith("manual-")) {
    const eliminadosPath = path.join(process.cwd(), "EXPORT", "gastos_eliminados.json")
    const permanentesPath = path.join(process.cwd(), "EXPORT", "gastos_borrados_permanentes.json")
    
    if (fs.existsSync(eliminadosPath)) {
      try {
        let eliminados = JSON.parse(fs.readFileSync(eliminadosPath, "utf8")) as string[]
        eliminados = eliminados.filter(id => id !== gastoId)
        fs.writeFileSync(eliminadosPath, JSON.stringify(eliminados, null, 2), "utf8")
      } catch(e) {}
    }
    
    let permanentes: string[] = []
    if (fs.existsSync(permanentesPath)) {
      try {
        permanentes = JSON.parse(fs.readFileSync(permanentesPath, "utf8")) as string[]
      } catch(e) {}
    }
    if (!permanentes.includes(gastoId)) {
      permanentes.push(gastoId)
      fs.writeFileSync(permanentesPath, JSON.stringify(permanentes, null, 2), "utf8")
    }

    await logActivity(
      admin.id!,
      "ELIMINAR_GASTO",
      "Gasto",
      gastoId,
      `Eliminó permanentemente un gasto histórico/importado`
    )
    revalidatePath("/", "layout")
    return true
  }

  const gasto = await prisma.gasto.findUnique({
    where: { id: gastoId },
    include: { diaObra: true },
  })

  if (!gasto) throw new Error("Gasto no encontrado")

  await prisma.gasto.delete({ where: { id: gastoId } })

  const obra = await prisma.obra.findUnique({
    where: { id: gasto.diaObra.obraId },
    select: { nombre: true },
  })
  await logActivity(
    admin.id!,
    "ELIMINAR_GASTO",
    "Gasto",
    gastoId,
    `Eliminó un gasto permanentemente en la obra "${obra?.nombre || gasto.diaObra.obraId}"`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return true
}

// Create DiaObra manually (Admin only)
export async function createDiaObraAdmin(
  obraId: string,
  data: { fecha: string; presupuestoDiario: number }
) {
  await requireAdmin()

  const fechaDate = new Date(data.fecha + "T00:00:00")

  const existing = await prisma.diaObra.findUnique({
    where: {
      obraId_fecha: {
        obraId,
        fecha: fechaDate,
      },
    },
  })

  if (existing) {
    return { error: "El día seleccionado ya está registrado en esta obra." }
  }

  const dia = await prisma.diaObra.create({
    data: {
      obraId,
      fecha: fechaDate,
      presupuestoDiario: data.presupuestoDiario,
    },
  })

  const obraInfo = await prisma.obra.findUnique({
    where: { id: obraId },
    select: { nombre: true },
  })
  await logActivity(
    (await requireAdmin()).id!,
    "CREAR_DIA",
    "DiaObra",
    dia.id,
    `Agregó el día de trabajo ${data.fecha} en la obra "${obraInfo?.nombre || obraId}"`
  )

  revalidatePath("/", "layout")
  return { success: true }
}

export async function softDeleteDiaObraAdmin(diaObraId: string) {
  await requireAdmin()

  const diaObra = await prisma.diaObra.update({
    where: { id: diaObraId },
    data: { deletedAt: new Date() },
  })

  // Also soft delete all its gastos
  await prisma.gasto.updateMany({
    where: { diaObraId },
    data: { deletedAt: new Date() },
  })

  const obraInfo = await prisma.obra.findUnique({
    where: { id: diaObra.obraId },
    select: { nombre: true },
  })
  await logActivity(
    (await requireAdmin()).id!,
    "ELIMINAR_DIA",
    "DiaObra",
    diaObraId,
    `Envió el día de trabajo y sus gastos a la papelera en la obra "${obraInfo?.nombre || diaObra.obraId}"`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return true
}

export async function restoreDiaObraAdmin(diaObraId: string) {
  await requireAdmin()

  const diaObra = await prisma.diaObra.update({
    where: { id: diaObraId },
    data: { deletedAt: null },
  })

  // Restore all its gastos too
  await prisma.gasto.updateMany({
    where: { diaObraId },
    data: { deletedAt: null },
  })

  const obraInfo = await prisma.obra.findUnique({
    where: { id: diaObra.obraId },
    select: { nombre: true },
  })
  await logActivity(
    (await requireAdmin()).id!,
    "RESTAURAR_DIA",
    "DiaObra",
    diaObraId,
    `Restauró el día de trabajo y sus gastos en la obra "${obraInfo?.nombre || diaObra.obraId}"`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return true
}

export async function permanentDeleteDiaObraAdmin(diaObraId: string) {
  await requireAdmin()

  const diaObra = await prisma.diaObra.findUnique({ where: { id: diaObraId } })
  if (!diaObra) throw new Error("Día no encontrado")

  await prisma.diaObra.delete({ where: { id: diaObraId } })

  const obraInfo = await prisma.obra.findUnique({
    where: { id: diaObra.obraId },
    select: { nombre: true },
  })
  await logActivity(
    (await requireAdmin()).id!,
    "ELIMINAR_DIA",
    "DiaObra",
    diaObraId,
    `Eliminó permanentemente el día de trabajo y sus gastos en la obra "${obraInfo?.nombre || diaObra.obraId}"`
  )

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return true
}

export async function verifyGastosBatchWithAI(obraId: string) {
  const admin = await requireAdmin()
  const { verifyExpenseWithAI } = await import("@/lib/ai-verifier")

  // Obtener todos los gastos PENDIENTE de la obra con sus fotos
  const gastosPendientes = await prisma.gasto.findMany({
    where: {
      diaObra: { obraId },
      estado: "PENDIENTE",
      deletedAt: null
    },
    include: {
      fotos: true
    }
  })

  let procesados = 0
  let aprobados = 0
  let rechazados = 0

  for (const gasto of gastosPendientes) {
    if (!gasto.fotos || gasto.fotos.length === 0) continue

    const imageUrls = gasto.fotos.map(f => f.url)
    const aiResult = await verifyExpenseWithAI(
      {
        concepto: gasto.concepto,
        proveedor: gasto.proveedor,
        total: Number(gasto.total),
        subtotal: Number(gasto.subtotal),
        iva: Number(gasto.iva)
      },
      imageUrls
    )

    const nuevoEstado = aiResult.valido ? GastoEstado.VERIFICADO : GastoEstado.RECHAZADO
    const notaPrevia = gasto.notaAdmin ? gasto.notaAdmin + "\n\n" : ""
    const nuevaNota = notaPrevia + (aiResult.valido ? "✨ Verificado por IA: " : "🤖 Rechazado por IA: ") + aiResult.razon

    await prisma.gasto.update({
      where: { id: gasto.id },
      data: {
        estado: nuevoEstado,
        notaAdmin: nuevaNota
      }
    })

    if (aiResult.valido) aprobados++
    else rechazados++
    procesados++
  }

  if (procesados > 0) {
    const obra = await prisma.obra.findUnique({ where: { id: obraId } })
    await logActivity(
      admin.id!,
      "VERIFICAR_GASTO",
      "Gasto",
      "BATCH_AI",
      `Ejecutó verificación por IA en "${obra?.nombre || obraId}". Aprobados: ${aprobados}, Rechazados: ${rechazados}`
    )
  }

  revalidatePath("/", "layout")
  revalidatePath("/", "layout")
  return { success: true, procesados, aprobados, rechazados }
}
