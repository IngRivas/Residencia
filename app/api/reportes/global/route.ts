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
  const format = searchParams.get("format") || "pdf"
  const status = searchParams.get("status") || "all"
  const search = searchParams.get("search") || ""
  const download = searchParams.get("download") === "true"
  const minBudget = searchParams.get("minBudget")
    ? parseFloat(searchParams.get("minBudget")!)
    : undefined
  const maxBudget = searchParams.get("maxBudget")
    ? parseFloat(searchParams.get("maxBudget")!)
    : undefined

  try {
    const whereClause: any = { deletedAt: null }

    if (status === "active") {
      whereClause.estado = { in: ["ACTIVA", "PAUSADA"] }
    } else if (status === "archived") {
      whereClause.estado = { in: ["ARCHIVADA", "CERRADA"] }
    }

    if (search) {
      whereClause.nombre = { contains: search, mode: "insensitive" }
    }

    // Wait, dynamic budget is calculated on runtime, but filtering on DB with budget range can use gte/lte on base presupuestoTotal
    if (minBudget !== undefined || maxBudget !== undefined) {
      whereClause.presupuestoTotal = {}
      if (minBudget !== undefined) whereClause.presupuestoTotal.gte = minBudget
      if (maxBudget !== undefined) whereClause.presupuestoTotal.lte = maxBudget
    }

    const Obras = await prisma.obra.findMany({
      where: whereClause,
      include: {
        creadoPor: true,
        miembros: { include: { user: true } },
        dias: {
          where: { deletedAt: null },
          orderBy: { fecha: "asc" },
          include: {
            gastos: {
              where: {
                deletedAt: null,
                estado: { in: ["PENDIENTE", "VERIFICADO"] },
              },
              include: { creadoPor: true, fotos: true },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
      orderBy: {
        nombre: "asc",
      },
    })

    let grandTotalBudget = 0
    let grandTotalSpent = 0

    const formattedObras = Obras.map((obra) => {
      let budget = 0
      let spent = 0
      let ivaTotal = 0

      obra.dias.forEach((dia) => {
        budget += Number(dia.presupuestoDiario) + Number(dia.reposicion || 0)
        dia.gastos.forEach((gasto) => {
          if (!(gasto as any).noAfectaPresupuesto) {
            spent += Number(gasto.total)
            ivaTotal += Number(gasto.iva)
          }
        })
      })

      if (obra.dias.length === 0) {
        budget = Number(obra.presupuestoTotal)
      }

      const balance = budget - spent

      grandTotalBudget += budget
      grandTotalSpent += spent

      return {
        nombre: obra.nombre,
        presupuesto: budget,
        gastado: spent,
        iva: ivaTotal,
        saldo: balance,
        estado: obra.estado,
      }
    })

    const grandTotalBalance = grandTotalBudget - grandTotalSpent

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet("Reporte Global de Obras")

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

      sheet.views = [{ state: "frozen", ySplit: 3 }]

      const titleText =
        status === "archived"
          ? "REPORTE DE ARCHIVOS DE OBRA"
          : "REPORTE GLOBAL DE OBRAS"
      const titleRow = sheet.addRow([titleText])
      titleRow.font = {
        name: "Calibri",
        size: 14,
        bold: true,
        color: { argb: "FFFFFFFF" },
      }
      titleRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F3864" },
      }
      sheet.mergeCells(1, 1, 1, 6)

      const dateRow = sheet.addRow([
        `Generado: ${new Date().toLocaleDateString("es-MX", { timeZone: "UTC" })}`,
      ])
      dateRow.font = {
        name: "Calibri",
        size: 11,
        italic: true,
        color: { argb: "FF595959" },
      }
      sheet.addRow([])

      const headerRow = sheet.addRow([
        "Obra",
        "Presupuesto Total Asignado",
        "Gasto Total Acumulado",
        "IVA Total Acumulado",
        "Saldo",
        "Estado",
      ])
      styleHeader(headerRow)

      formattedObras.forEach((o, i) => {
        const r = sheet.addRow([
          o.nombre,
          o.presupuesto,
          o.gastado,
          o.iva,
          o.saldo,
          o.estado,
        ])
        styleDataRow(r, i)

        for (let col = 2; col <= 5; col++) {
          r.getCell(col).numFmt = "$#,##0.00"
          r.getCell(col).alignment = { horizontal: "right" }
        }

        const estadoCell = r.getCell(6)
        if (o.estado === "ACTIVA") {
          estadoCell.font = {
            ...estadoCell.font,
            bold: true,
            color: { argb: "FF008000" },
          }
        }

        const saldoCell = r.getCell(5)
        if (o.saldo < 0) {
          saldoCell.font = { ...saldoCell.font, color: { argb: "FFFF0000" } }
        }
      })

      sheet.addRow([])
      const totalRow = sheet.addRow([
        "TOTALES CONSOLIDADOS",
        grandTotalBudget,
        grandTotalSpent,
        formattedObras.reduce((acc, curr) => acc + curr.iva, 0),
        grandTotalBalance,
        "",
      ])
      styleDataRow(totalRow, formattedObras.length + 1)

      totalRow.eachCell((cell, colNumber) => {
        cell.font = { ...cell.font, bold: true }
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD9D9D9" },
        }
        if (colNumber >= 2 && colNumber <= 5) {
          cell.numFmt = "$#,##0.00"
          cell.alignment = { horizontal: "right" }
        }
      })

      const saldoTotalCell = totalRow.getCell(5)
      if (grandTotalBalance < 0) {
        saldoTotalCell.font = {
          ...saldoTotalCell.font,
          color: { argb: "FFFF0000" },
        }
      }

      sheet.columns.forEach((column) => {
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
          "Content-Disposition":
            'attachment; filename="Reporte_Global_Obras.xlsx"',
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      })
    }

    // Default PDF Generation
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([600, 800])
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Title Block separator line
    page.drawLine({
      start: { x: 30, y: 730 },
      end: { x: 570, y: 730 },
      thickness: 1.5,
      color: rgb(0, 0, 0),
    })

    try {
      const logoPath = path.join(
        process.cwd(),
        "public",
        "Logo MCA horizontal.png"
      )
      const logoImageBytes = fs.readFileSync(logoPath)
      const logoImage = await pdfDoc.embedPng(logoImageBytes)
      const logoDims = logoImage.scaleToFit(180, 40)

      const logoY = 765 - logoDims.height / 2

      page.drawImage(logoImage, {
        x: 30,
        y: logoY,
        width: logoDims.width,
        height: logoDims.height,
      })
    } catch (e) {
      console.error("Error loading logo:", e)
    }

    const titleText =
      status === "archived"
        ? "REPORTE DE ARCHIVOS DE OBRA"
        : "REPORTE GLOBAL DE OBRAS"
    const titleWidth = fontBold.widthOfTextAtSize(titleText, 16)

    page.drawText(titleText, {
      x: 600 - 30 - titleWidth,
      y: 765 - 6,
      size: 16,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    // Consolidated Metrics Card
    page.drawRectangle({
      x: 30,
      y: 590,
      width: 540,
      height: 105,
      color: rgb(0.96, 0.98, 0.96),
      borderColor: rgb(0.9, 0.92, 0.9),
      borderWidth: 1,
    })

    page.drawText("Totales Generales Consolidados", {
      x: 45,
      y: 672,
      size: 11,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    })
    page.drawText(
      `Presupuesto Asignado Global: $${grandTotalBudget.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      { x: 45, y: 648, size: 9, font, color: rgb(0.2, 0.2, 0.2) }
    )
    page.drawText(
      `Gasto Global Acumulado: $${grandTotalSpent.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      { x: 45, y: 631, size: 9, font, color: rgb(0.2, 0.2, 0.2) }
    )
    page.drawText(
      `Saldo Global Restante: $${grandTotalBalance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      {
        x: 45,
        y: 614,
        size: 9,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2), // Neutral color
      }
    )

    // Draw Obras Table
    page.drawText("Detalle General por Obra", {
      x: 30,
      y: 550,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    })

    let yPos = 525
    page.drawLine({
      start: { x: 30, y: yPos + 10 },
      end: { x: 570, y: yPos + 10 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    })

    page.drawText("Obra", {
      x: 45,
      y: yPos,
      size: 9,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    })
    page.drawText("Presupuesto", {
      x: 180,
      y: yPos,
      size: 9,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    })
    page.drawText("Gasto", {
      x: 290,
      y: yPos,
      size: 9,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    })
    page.drawText("Saldo", {
      x: 400,
      y: yPos,
      size: 9,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    })
    page.drawText("Estado", {
      x: 500,
      y: yPos,
      size: 9,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    })

    page.drawLine({
      start: { x: 30, y: yPos - 5 },
      end: { x: 570, y: yPos - 5 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    })
    yPos -= 20

    formattedObras.slice(0, 20).forEach((obra) => {
      page.drawText(obra.nombre.slice(0, 22), {
        x: 45,
        y: yPos,
        size: 8.5,
        font,
        color: rgb(0.2, 0.2, 0.2),
      })
      page.drawText(`$${obra.presupuesto.toLocaleString()}`, {
        x: 180,
        y: yPos,
        size: 8.5,
        font,
        color: rgb(0.2, 0.2, 0.2),
      })
      page.drawText(`$${obra.gastado.toLocaleString()}`, {
        x: 290,
        y: yPos,
        size: 8.5,
        font,
        color: rgb(0.2, 0.2, 0.2),
      })
      page.drawText(`$${obra.saldo.toLocaleString()}`, {
        x: 400,
        y: yPos,
        size: 8.5,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.2), // Neutral color
      })
      page.drawText(obra.estado, {
        x: 500,
        y: yPos,
        size: 8.5,
        font,
        color: rgb(0.4, 0.4, 0.4),
      })

      yPos -= 18
    })

    // --- MEGA REPORT LOOP: Details for each active obra ---
    const summaryPagesCount = pdfDoc.getPageCount()
    for (const obra of Obras) {
      await drawObraDetalle(obra, pdfDoc, font, fontBold)
    }

    const allPages = pdfDoc.getPages()
    const generationDate = new Date().toLocaleDateString("es-MX", {
      timeZone: "UTC",
    })
    allPages.forEach((p, index) => {
      if (index < summaryPagesCount) {
        p.drawLine({
          start: { x: 30, y: 45 },
          end: { x: 570, y: 45 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        })
        p.drawText("REPORTE GLOBAL", {
          x: 30,
          y: 30,
          size: 8,
          font,
          color: rgb(0.5, 0.5, 0.5),
        })
      }

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
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Reporte_Global_Obras.pdf"`,
        "Content-Type": "application/pdf",
      },
    })
  } catch (err) {
    console.error(err)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
