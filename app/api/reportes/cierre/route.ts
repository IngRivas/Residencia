import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import ExcelJS from "exceljs"
import fs from "fs"
import path from "path"
import { drawObraDetalle } from "@/lib/pdf/drawObraDetalle"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const user = session.user as any
  if (
    user.role !== "ADMIN" &&
    user.role !== "SUPER_ADMIN" &&
    user.role !== "VIEWER"
  ) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const obraId = searchParams.get("obraId")
  const format = searchParams.get("format") || "pdf" // pdf or excel
  const download = searchParams.get("download") === "true"

  const proveedoresList = await prisma.proveedor.findMany({
    select: { nombre: true, rfc: true },
  })
  const rfcMap = new Map<string, string>()
  proveedoresList.forEach((p) => {
    if (p.rfc) rfcMap.set(p.nombre, p.rfc)
  })

  if (!obraId) {
    return new NextResponse("Missing obraId", { status: 400 })
  }

  try {
    const obra = await prisma.obra.findFirst({
      where: { id: obraId, deletedAt: null },
      include: {
        creadoPor: true,
        miembros: { include: { user: true } },
        dias: {
          where: { deletedAt: null },
          include: {
            gastos: {
              where: { deletedAt: null },
              include: {
                creadoPor: true,
                fotos: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          orderBy: {
            fecha: "asc",
          },
        },
      },
    })

    if (!obra) {
      return new NextResponse("Obra not found", { status: 404 })
    }

    const proveedorFilter = searchParams.get("proveedor")
    if (proveedorFilter && proveedorFilter.trim() !== "") {
      obra.dias.forEach((dia) => {
        dia.gastos = dia.gastos.filter((g) => g.proveedor === proveedorFilter)
      })
      obra.dias = obra.dias.filter((dia) => dia.gastos.length > 0)
    }

    // Calculate metrics
    let budgetTotal = 0
    let totalSpent = 0
    let totalIva = 0
    let totalIva16 = 0
    let totalIva8 = 0
    let totalImprevistos = 0

    const daysList = obra.dias.map((dia) => {
      let spent = 0
      let dayIva = 0
      let has16 = false
      let has8 = false
      dia.gastos.forEach((gasto) => {
        if (!(gasto as any).noAfectaPresupuesto) {
          spent += Number(gasto.total)
        }
        if (gasto.isImprevisto) totalImprevistos += Number(gasto.total)
        const ivaVal = Number(gasto.iva)
        dayIva += ivaVal
        totalIva += ivaVal
        const pct = Number(gasto.porcentajeIVA)
        if (pct === 16) {
          totalIva16 += ivaVal
          has16 = true
        } else if (pct === 8) {
          totalIva8 += ivaVal
          has8 = true
        }
      })
      totalSpent += spent
      const budget = Number(dia.presupuestoDiario) + Number(dia.reposicion || 0)
      budgetTotal += budget

      const dayBreakdowns = []
      if (has16) dayBreakdowns.push("16%")
      if (has8) dayBreakdowns.push("8%")
      const dayIvaStr =
        dayBreakdowns.length > 0 ? ` (${dayBreakdowns.join(" y ")})` : ""

      return {
        fecha: dia.fecha.toLocaleDateString("es-MX", { timeZone: "UTC" }),
        presupuesto: budget,
        gastado: spent,
        iva: dayIva,
        ivaStr: dayIvaStr,
        saldo: budget - spent,
      }
    })

    if (obra.dias.length === 0) {
      budgetTotal = Number(obra.presupuestoTotal)
    }

    const finalBalance = budgetTotal - totalSpent

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook()

      const styleHeader = (row: any) => {
        row.eachCell((cell: any) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF1F3864" },
          }
          cell.font = {
            name: "Calibri",
            size: 11,
            bold: true,
            color: { argb: "FFFFFFFF" },
          }
          cell.alignment = { horizontal: "center", vertical: "middle" }
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          }
        })
      }

      const styleDataRow = (row: any, rowIndex: number) => {
        const bgColor = rowIndex % 2 === 0 ? "FFFFFFFF" : "FFDEEAF1"
        row.eachCell((cell: any) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bgColor },
          }
          cell.font = cell.font
            ? { ...cell.font, name: "Calibri", size: 11 }
            : { name: "Calibri", size: 11, color: { argb: "FF000000" } }
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          }
        })
      }

      // Sheet 1: General Summary
      const summarySheet = workbook.addWorksheet("Resumen General")
      const sumTitle = summarySheet.addRow(["Resumen General de Obra"])
      sumTitle.font = {
        name: "Calibri",
        size: 14,
        bold: true,
        color: { argb: "FFFFFFFF" },
      }
      sumTitle.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F3864" },
      }
      summarySheet.mergeCells(1, 1, 1, 2)
      summarySheet.addRow([])

      const sumHeaderRow = summarySheet.addRow(["Concepto", "Valor"])
      styleHeader(sumHeaderRow)

      let ivaBreakdownStr = ""
      const breakdowns = []
      if (totalIva16 > 0) breakdowns.push("16%")
      if (totalIva8 > 0) breakdowns.push("8%")
      if (breakdowns.length > 0)
        ivaBreakdownStr = ` (${breakdowns.join(" y ")})`

      const sumData = [
        ["Nombre de la Obra", obra.nombre],
        ["Responsable", obra.creadoPor?.name || "Desconocido"],
        ["Estado Actual", obra.estado],
        ["Presupuesto Total", budgetTotal],
        ["Total Gastado", totalSpent],
        [`Total IVA Acumulado${ivaBreakdownStr}`, totalIva],
        ["Saldo Final", finalBalance],
      ]

      sumData.forEach((d, i) => {
        const r = summarySheet.addRow(d)
        styleDataRow(r, i)
        const c1 = r.getCell(1)
        c1.font = { ...c1.font, bold: true }
        c1.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD9D9D9" },
        }

        const c2 = r.getCell(2)
        if (typeof d[1] === "number") {
          c2.numFmt = "$#,##0.00"
          c2.alignment = { horizontal: "right" }
        }

        if (d[0] === "Estado Actual" && d[1] === "ACTIVA") {
          c2.font = { ...c2.font, bold: true, color: { argb: "FF005400" } }
        }
        if (d[0] === "Saldo Final" && typeof d[1] === "number" && d[1] < 0) {
          c2.font = { ...c2.font, bold: true, color: { argb: "FFFF0000" } }
        }
      })

      summarySheet.columns.forEach((column) => {
        let maxLen = 0
        if (column && typeof column.eachCell === "function") {
          column.eachCell({ includeEmpty: true }, (cell) => {
            maxLen = Math.max(
              maxLen,
              cell.value ? cell.value.toString().length : 0
            )
          })
          column.width = maxLen < 15 ? 15 : maxLen + 2
        }
      })

      // Sheet 2: Days Detail
      const daysSheet = workbook.addWorksheet("Resumen Diario")
      daysSheet.views = [{ state: "frozen", ySplit: 3 }]
      const daysTitle = daysSheet.addRow(["Resumen Diario"])
      daysTitle.font = {
        name: "Calibri",
        size: 14,
        bold: true,
        color: { argb: "FFFFFFFF" },
      }
      daysTitle.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F3864" },
      }
      daysSheet.mergeCells(1, 1, 1, 4)
      daysSheet.addRow([])

      const daysHeader = daysSheet.addRow([
        "Fecha",
        "Presupuesto Asignado",
        "Total Gastado",
        "Saldo",
      ])
      styleHeader(daysHeader)

      daysList.forEach((day, i) => {
        const r = daysSheet.addRow([
          day.fecha,
          day.presupuesto,
          day.gastado,
          day.saldo,
        ])
        styleDataRow(r, i)
        r.getCell(2).numFmt = "$#,##0.00"
        r.getCell(2).alignment = { horizontal: "right" }
        r.getCell(3).numFmt = "$#,##0.00"
        r.getCell(3).alignment = { horizontal: "right" }

        const saldoCell = r.getCell(4)
        saldoCell.numFmt = "$#,##0.00"
        saldoCell.alignment = { horizontal: "right" }
        if (day.saldo < 0) {
          saldoCell.font = { ...saldoCell.font, color: { argb: "FFFF0000" } }
        } else {
          saldoCell.font = { ...saldoCell.font, color: { argb: "FF008000" } }
        }
      })

      daysSheet.columns.forEach((column) => {
        let maxLen = 0
        if (column && typeof column.eachCell === "function") {
          column.eachCell({ includeEmpty: true }, (cell) => {
            maxLen = Math.max(
              maxLen,
              cell.value ? cell.value.toString().length : 0
            )
          })
          column.width = maxLen < 15 ? 15 : maxLen + 2
        }
      })

      // Sheet: Reposiciones
      const reposiciones = obra.dias.filter(
        (d) => Number(d.reposicion || 0) > 0
      )
      if (reposiciones.length > 0) {
        const repSheet = workbook.addWorksheet("Reposiciones")
        repSheet.views = [{ state: "frozen", ySplit: 3 }]
        const repTitle = repSheet.addRow(["Detalle de Reposiciones"])
        repTitle.font = {
          name: "Calibri",
          size: 14,
          bold: true,
          color: { argb: "FFFFFFFF" },
        }
        repTitle.getCell(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1F3864" },
        }
        repSheet.mergeCells(1, 1, 1, 2)
        repSheet.addRow([])

        const repHeader = repSheet.addRow(["Fecha", "Monto de Reposición"])
        styleHeader(repHeader)

        reposiciones.forEach((dia, idx) => {
          const r = repSheet.addRow([
            dia.fecha.toLocaleDateString("es-MX", { timeZone: "UTC" }),
            Number(dia.reposicion),
          ])
          styleDataRow(r, idx)
          r.getCell(2).numFmt = "$#,##0.00"
          r.getCell(2).alignment = { horizontal: "right" }
        })

        repSheet.columns.forEach((column) => {
          let maxLen = 0
          if (column && typeof column.eachCell === "function") {
            column.eachCell({ includeEmpty: true }, (cell) => {
              maxLen = Math.max(
                maxLen,
                cell.value ? cell.value.toString().length : 0
              )
            })
            column.width = maxLen < 15 ? 15 : maxLen + 2
          }
        })
      }

      // Sheet 3: Expenses Detail
      const expensesSheet = workbook.addWorksheet("Detalle de Gastos")
      expensesSheet.views = [{ state: "frozen", ySplit: 3 }]
      const expTitle = expensesSheet.addRow(["Detalle de Gastos"])
      expTitle.font = {
        name: "Calibri",
        size: 14,
        bold: true,
        color: { argb: "FFFFFFFF" },
      }
      expTitle.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F3864" },
      }
      expensesSheet.mergeCells(1, 1, 1, 11)
      expensesSheet.addRow([])

      const expHeader = expensesSheet.addRow([
        "Concepto",
        "Proveedor",
        "RFC",
        "Subtotal 0%",
        "Subtotal 8%",
        "Subtotal 16%",
        "Total Subtotal",
        "IVA 8%",
        "IVA 16%",
        "Total",
        "Estado",
      ])
      styleHeader(expHeader)

      let expIndex = 0
      obra.dias.forEach((dia) => {
        dia.gastos.forEach((gasto) => {
          const conceptoStr = gasto.isImprevisto
            ? `[IMPREVISTO] ${gasto.concepto}`
            : gasto.concepto
          const sub = Number(gasto.subtotal)
          const ivaAmt = Number(gasto.iva)
          const ivaPct = Number(gasto.porcentajeIVA)

          let sub0 = 0,
            sub8 = 0,
            sub16 = 0
          let iva8 = 0,
            iva16 = 0
          if (ivaPct === 0) {
            sub0 = sub
          } else if (ivaPct === 8) {
            sub8 = sub
            iva8 = ivaAmt
          } else if (ivaPct === 16) {
            sub16 = sub
            iva16 = ivaAmt
          }

          const r = expensesSheet.addRow([
            conceptoStr,
            gasto.proveedor,
            rfcMap.get(gasto.proveedor) || "",
            sub0,
            sub8,
            sub16,
            sub,
            iva8,
            iva16,
            Number(gasto.total),
            gasto.estado,
          ])

          styleDataRow(r, expIndex++)

          for (let col = 4; col <= 10; col++) {
            r.getCell(col).numFmt = "$#,##0.00"
            r.getCell(col).alignment = { horizontal: "right" }
          }

          const estadoCell = r.getCell(11)
          if (gasto.estado === "PENDIENTE") {
            estadoCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFD966" },
            }
            estadoCell.font = {
              ...estadoCell.font,
              bold: true,
              color: { argb: "FFC65911" },
            }
          } else if (gasto.estado === "VERIFICADO") {
            estadoCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFE2EFDA" },
            }
            estadoCell.font = {
              ...estadoCell.font,
              bold: true,
              color: { argb: "FF375623" },
            }
          }
        })
      })

      expensesSheet.columns.forEach((column) => {
        let maxLen = 0
        if (column && typeof column.eachCell === "function") {
          column.eachCell({ includeEmpty: true }, (cell) => {
            maxLen = Math.max(
              maxLen,
              cell.value ? cell.value.toString().length : 0
            )
          })
          column.width = maxLen < 15 ? 15 : maxLen + 2
        }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      return new NextResponse(buffer, {
        headers: {
          "Content-Disposition": `attachment; filename="Reporte de obra (${obra.nombre}).xlsx"`,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      })
    }

    // Default: PDF Generation
    const pdfDoc = await PDFDocument.create()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    await drawObraDetalle(obra, pdfDoc, font, fontBold, proveedorFilter)

    const allPages = pdfDoc.getPages()
    const generationDate = new Date().toLocaleDateString("es-MX", {
      timeZone: "UTC",
    })
    allPages.forEach((p, index) => {
      const centerText = `Página ${index + 1} de ${allPages.length}`
      const cw = font.widthOfTextAtSize(centerText, 8)
      p.drawText(centerText, {
        x: 300 - cw / 2,
        y: 30,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      })

      const rightText = `Generado: ${generationDate}`
      const rw = font.widthOfTextAtSize(rightText, 8)
      p.drawText(rightText, {
        x: 570 - rw,
        y: 30,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      })
    })

    const pdfBytes = await pdfDoc.save()
    return new NextResponse(pdfBytes as any, {
      headers: {
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Reporte_Obra_${obra.nombre}.pdf"`,
        "Content-Type": "application/pdf",
      },
    })
  } catch (err) {
    console.error(err)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
