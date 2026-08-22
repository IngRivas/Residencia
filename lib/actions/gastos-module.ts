"use server"

import { revalidatePath } from "next/cache"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { prisma } from "@/lib/db"

export async function createGastoFromModule(formData: {
  obraId: string
  fechaStr: string // YYYY-MM-DD
  concepto: string
  proveedor: string
  categoria?: string
  subtotal: number
  porcentajeIVA: number // 0, 8, 16
  ieps?: number
  descuento?: number
  ivaRetenido?: number
  isrRetenido?: number
  notaCapturista?: string
}) {
  try {
    const { obraId, fechaStr, concepto, proveedor = "N/A", categoria, subtotal, porcentajeIVA, ieps, descuento, ivaRetenido, isrRetenido, notaCapturista } = formData

    if (!obraId || !fechaStr || !concepto) {
      return { success: false, error: "Obra, Fecha y Concepto son obligatorios." }
    }

    const fecha = new Date(`${fechaStr}T12:00:00.000Z`)
    if (isNaN(fecha.getTime())) {
      return { success: false, error: "Fecha inválida." }
    }

    const sub = Number(subtotal) || 0
    const valDescuento = Number(descuento) || 0
    const subtotalConDescuento = sub - valDescuento
    
    const ivaPct = Number(porcentajeIVA) || 0
    const iva = Number(((subtotalConDescuento * ivaPct) / 100).toFixed(2))
    
    const valIeps = Number(ieps) || 0
    const valIvaRet = Number(ivaRetenido) || 0
    const valIsrRet = Number(isrRetenido) || 0
    
    const total = Number((subtotalConDescuento + iva + valIeps - valIvaRet - valIsrRet).toFixed(2))

    const year = fecha.getUTCFullYear()
    const month = fecha.getUTCMonth() + 1
    const fechaISO = fecha.toISOString().split("T")[0]
    const fechaFormatted = format(fecha, "dd/MM/yyyy", { locale: es })

    const newItem = await prisma.spreadsheetGasto.create({
      data: {
        id: `manual-${Date.now()}`,
        fecha: fechaISO,
        fechaFormatted,
        year,
        month,
        obraId: obraId.toLowerCase(),
        obraNombre: obraId,
        proveedor: proveedor.trim(),
        concepto: concepto.trim(),
        categoria: categoria?.trim() || null,
        subtotal: sub,
        subtotal16: ivaPct === 16 ? subtotalConDescuento : null,
        subtotal8: ivaPct === 8 ? subtotalConDescuento : null,
        subtotal0: ivaPct === 0 ? subtotalConDescuento : null,
        porcentajeIVA: ivaPct,
        iva,
        iva16: ivaPct === 16 ? iva : null,
        iva8: ivaPct === 8 ? iva : null,
        total,
        ieps: ieps || null,
        descuento: descuento || null,
        ivaRetenido: ivaRetenido || null,
        isrRetenido: isrRetenido || null,
        notaCapturista: notaCapturista?.trim() || null,
        creadoPorNombre: "Sistema",
        estado: "VERIFICADO",
        isDeleted: false
      }
    })

    revalidatePath("/admin/gastos")
    return { success: true, gastoId: newItem.id }
  } catch (error: any) {
    console.error("Error creating gasto in module:", error)
    return { success: false, error: error.message || "Error al crear el gasto." }
  }
}

export async function editGastoFromModule(id: string, formData: {
  obraId: string
  fechaStr: string
  concepto: string
  proveedor: string
  categoria?: string
  subtotal: number
  porcentajeIVA: number
  ieps?: number
  descuento?: number
  ivaRetenido?: number
  isrRetenido?: number
  notaCapturista?: string
}) {
  try {
    const { obraId, fechaStr, concepto, proveedor = "N/A", categoria, subtotal, porcentajeIVA, ieps, descuento, ivaRetenido, isrRetenido, notaCapturista } = formData

    if (!id || !obraId || !fechaStr || !concepto) {
      return { success: false, error: "ID, Obra, Fecha y Concepto son obligatorios." }
    }

    const fecha = new Date(`${fechaStr}T12:00:00.000Z`)
    if (isNaN(fecha.getTime())) {
      return { success: false, error: "Fecha inválida." }
    }

    const sub = Number(subtotal) || 0
    const valDescuento = Number(descuento) || 0
    const subtotalConDescuento = sub - valDescuento
    
    const ivaPct = Number(porcentajeIVA) || 0
    const iva = Number(((subtotalConDescuento * ivaPct) / 100).toFixed(2))
    
    const valIeps = Number(ieps) || 0
    const valIvaRet = Number(ivaRetenido) || 0
    const valIsrRet = Number(isrRetenido) || 0
    
    const total = Number((subtotalConDescuento + iva + valIeps - valIvaRet - valIsrRet).toFixed(2))

    const year = fecha.getUTCFullYear()
    const month = fecha.getUTCMonth() + 1
    const fechaISO = fecha.toISOString().split("T")[0]
    const fechaFormatted = format(fecha, "dd/MM/yyyy", { locale: es })

    const data = {
      fecha: fechaISO,
      fechaFormatted,
      year,
      month,
      obraId: obraId.toLowerCase(),
      obraNombre: obraId,
      proveedor: proveedor.trim(),
      concepto: concepto.trim(),
      categoria: categoria?.trim() || null,
      subtotal: sub,
      subtotal16: ivaPct === 16 ? subtotalConDescuento : null,
      subtotal8: ivaPct === 8 ? subtotalConDescuento : null,
      subtotal0: ivaPct === 0 ? subtotalConDescuento : null,
      porcentajeIVA: ivaPct,
      iva,
      iva16: ivaPct === 16 ? iva : null,
      iva8: ivaPct === 8 ? iva : null,
      total,
      ieps: ieps || null,
      descuento: descuento || null,
      ivaRetenido: ivaRetenido || null,
      isrRetenido: isrRetenido || null,
      notaCapturista: notaCapturista?.trim() || null,
    }

    const existing = await prisma.spreadsheetGasto.findUnique({
      where: { id }
    })

    if (existing) {
      await prisma.spreadsheetGasto.update({
        where: { id },
        data
      })
    } else {
      await prisma.spreadsheetGasto.create({
        data: {
          id,
          ...data,
          creadoPorNombre: "Sistema (Editado)",
          estado: "VERIFICADO",
          isDeleted: false
        }
      })
    }

    revalidatePath("/admin/gastos")
    return { success: true }
  } catch (error: any) {
    console.error("Error editing gasto in module:", error)
    return { success: false, error: error.message || "Error al editar el gasto." }
  }
}

export async function deleteGastoFromModule(id: string) {
  try {
    // We check if it exists in DB. If it's a CSV row that doesn't exist yet, we create a stub to mark it deleted.
    const existing = await prisma.spreadsheetGasto.findUnique({
      where: { id }
    })

    if (existing) {
      await prisma.spreadsheetGasto.update({
        where: { id },
        data: { isDeleted: true }
      })
    } else {
      // It's a CSV row that we need to mark as deleted
      await prisma.spreadsheetGasto.create({
        data: {
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
    }
    
    revalidatePath("/admin/gastos")
    return { success: true }
  } catch (error: any) {
    console.error("Error deleting gasto:", error)
    return { success: false, error: error.message || "Error al eliminar el gasto." }
  }
}

export async function fixObrasEnMayusculas() {
  try {
    const gastos = await prisma.spreadsheetGasto.findMany()
    let count = 0
    for (const gasto of gastos) {
      if (gasto.obraNombre && gasto.obraNombre !== gasto.obraNombre.toUpperCase()) {
        await prisma.spreadsheetGasto.update({
          where: { id: gasto.id },
          data: { obraNombre: gasto.obraNombre.toUpperCase(), obraId: gasto.obraId.toLowerCase() }
        })
        count++
      }
    }
    const contratistas = await prisma.contratistaGasto.findMany()
    let cCount = 0
    for (const c of contratistas) {
      if (c.obraNombre && c.obraNombre !== c.obraNombre.toUpperCase()) {
        await prisma.contratistaGasto.update({
          where: { id: c.id },
          data: { obraNombre: c.obraNombre.toUpperCase() }
        })
        cCount++
      }
    }
    revalidatePath("/admin/gastos")
    return { success: true, count, cCount }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
