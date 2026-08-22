"use server"

import { prisma } from "@/lib/db"

export async function deleteContratistaGastoFromModule(id: string) {
  try {
    await prisma.contratistaGasto.update({
      where: { id },
      data: { isDeleted: true }
    })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function createContratistaGastoFromModule(data: {
  fechaStr: string
  obraNombre: string
  periodo: string
  trabajoRealizado: string
  notas?: string
  contratista: string
  total: number
}) {
  try {
    const id = "ctgasto-" + crypto.randomUUID()
    const [y, m, d] = data.fechaStr.split("-")
    const fechaObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    
    await prisma.contratistaGasto.create({
      data: {
        id,
        fecha: fechaObj,
        fechaStr: data.fechaStr,
        obraNombre: data.obraNombre,
        periodo: data.periodo || "",
        trabajoRealizado: data.trabajoRealizado || "",
        notas: data.notas || "",
        contratista: data.contratista,
        total: data.total,
        creadoPorId: "system",
        creadoPorNombre: "Usuario",
      }
    })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function editContratistaGastoFromModule(id: string, data: {
  fechaStr: string
  obraNombre: string
  periodo: string
  trabajoRealizado: string
  notas?: string
  contratista: string
  total: number
}) {
  try {
    const [y, m, d] = data.fechaStr.split("-")
    const fechaObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
    
    await prisma.contratistaGasto.update({
      where: { id },
      data: {
        fecha: fechaObj,
        fechaStr: data.fechaStr,
        obraNombre: data.obraNombre,
        periodo: data.periodo || "",
        trabajoRealizado: data.trabajoRealizado || "",
        notas: data.notas || "",
        contratista: data.contratista,
        total: data.total,
      }
    })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
