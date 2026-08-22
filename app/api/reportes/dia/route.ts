import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import ExcelJS from "exceljs"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import fs from "fs"
import path from "path"

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
  const diaObraId = searchParams.get("diaObraId")
  const format = searchParams.get("format") || "excel"
  const download = searchParams.get("download") === "true"

  if (!diaObraId) {
    return new NextResponse("Missing diaObraId", { status: 400 })
  }

  try {
    const diaObra = await prisma.diaObra.findUnique({
      where: { id: diaObraId },
      include: {
        obra: {
          include: {
            creadoPor: true,
            miembros: { include: { user: true } },
          },
        },
        gastos: {
          include: {
            creadoPor: true,
            fotos: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    })

    if (!diaObra) {
      return new NextResponse("Dia de obra not found", { status: 404 })
    }

    const proveedores = await prisma.proveedor.findMany({
      select: { nombre: true, rfc: true },
    })
    const rfcMap = new Map<string, string>()
    proveedores.forEach((p) => {
      if (p.rfc) rfcMap.set(p.nombre, p.rfc)
    })

    const proveedorFilter = searchParams.get("proveedor")
    if (proveedorFilter && proveedorFilter.trim() !== "") {
      diaObra.gastos = diaObra.gastos.filter(
        (g) => g.proveedor === proveedorFilter
      )
    }

    const dayBudget =
      Number(diaObra.presupuestoDiario) + Number(diaObra.reposicion || 0)
    let totalSpent = 0
    let totalIva = 0

    diaObra.gastos.forEach((g) => {
      if (!(g as any).noAfectaPresupuesto) {
        totalSpent += Number(g.total)
        totalIva += Number(g.iva)
      }
    })

    const balance = dayBudget - totalSpent
    const dateStr = diaObra.fecha.toLocaleDateString("es-MX", {
      timeZone: "UTC",
    })

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet(`Día ${dateStr.replace(/\//g, "-")}`)

      const titleRow = sheet.addRow([`Reporte Diario de Obra - Ciplastic`])
      titleRow.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } }
      titleRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F3864" },
      }

      const dateRow = sheet.addRow([`Fecha: ${dateStr}`])
      dateRow.font = { italic: true, color: { argb: "FF595959" } }
      sheet.addRow([])

      const summaryHeader = sheet.addRow([
        "Presupuesto Diario",
        "Total Gastado",
        "Saldo de la Jornada",
        "IVA Acumulado",
      ])
      summaryHeader.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2E75B6" },
        }
      })

      const summaryVals = sheet.addRow([
        dayBudget,
        totalSpent,
        balance,
        totalIva,
      ])
      summaryVals.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFFFF" },
        }
        cell.numFmt = "$#,##0.00"
      })

      sheet.addRow([])
      sheet.addRow([])

      // Freeze header row
      sheet.views = [{ state: "frozen", ySplit: 8 }]

      const headerRow = sheet.addRow([
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
        "Registrado Por",
        "Nota Capturista",
        "Nota Admin",
      ])
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1F3864" },
        }
        cell.alignment = { horizontal: "center", vertical: "middle" }
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        }
      })

      let rowIndex = 0

      diaObra.gastos.forEach((g) => {
        const conceptoStr = g.isImprevisto
          ? `[IMPREVISTO] ${g.concepto}`
          : g.concepto
        const sub = Number(g.subtotal)
        const ivaAmt = Number(g.iva)
        const ivaPct = Number(g.porcentajeIVA)

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

        const row = sheet.addRow([
          conceptoStr,
          g.proveedor,
          rfcMap.get(g.proveedor) || "",
          sub0,
          sub8,
          sub16,
          sub,
          iva8,
          iva16,
          Number(g.total),
          g.estado,
          g.creadoPor?.name || g.creadoPor?.email || "Desconocido",
          g.notaCapturista || "",
          g.notaAdmin || "",
        ])

        // Alternating background and borders
        const bgColor = rowIndex % 2 === 0 ? "FFFFFFFF" : "FFDEEAF1"
        row.eachCell((cell, colNumber) => {
          cell.font = { color: { argb: "FF000000" } }
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bgColor },
          }
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          }

          // Currency format & right align for amount columns (4 to 10)
          if (colNumber >= 4 && colNumber <= 10) {
            cell.alignment = { horizontal: "right" }
          }
        })

        // Conditional formatting for "Estado" (column 11)
        const estadoCell = row.getCell(11)
        if (g.estado === "PENDIENTE") {
          estadoCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFD966" },
          }
          estadoCell.font = { bold: true, color: { argb: "FFC65911" } }
        } else if (g.estado === "VERIFICADO") {
          estadoCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE2EFDA" },
          }
          estadoCell.font = { color: { argb: "FF375623" } }
        }

        rowIndex++
      })

      sheet.getColumn(4).numFmt = "$#,##0.00"
      sheet.getColumn(5).numFmt = "$#,##0.00"
      sheet.getColumn(6).numFmt = "$#,##0.00"
      sheet.getColumn(7).numFmt = "$#,##0.00"
      sheet.getColumn(8).numFmt = "$#,##0.00"
      sheet.getColumn(9).numFmt = "$#,##0.00"
      sheet.getColumn(10).numFmt = "$#,##0.00"

      sheet.columns.forEach((column) => {
        let maxLen = 0
        if (column && typeof column.eachCell === "function") {
          column.eachCell({ includeEmpty: true }, (cell) => {
            const val = cell.value ? cell.value.toString() : ""
            if (val.length > maxLen) {
              maxLen = val.length
            }
          })
          column.width = Math.max(maxLen + 2, 12)
        }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const fileName = `Gastos_Diarios_${diaObra.obra.nombre.replace(/\s+/g, "_")}_${dateStr.replace(/\//g, "-")}.xlsx`

      return new NextResponse(buffer, {
        headers: {
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      })
    }

    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([600, 800])
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const drawHeader = async (currentPage: any) => {
      currentPage.drawLine({
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
        currentPage.drawImage(logoImage, {
          x: 30,
          y: logoY,
          width: logoDims.width,
          height: logoDims.height,
        })
      } catch (e) {
        console.error("Error loading logo:", e)
      }

      const title = "REPORTE DIARIO DE OBRA"
      const titleWidth = fontBold.widthOfTextAtSize(title, 10)
      currentPage.drawText(title, {
        x: 600 - 30 - titleWidth,
        y: 765 - 6,
        size: 10,
        font: fontBold,
        color: rgb(0, 0, 0),
      })
    }

    await drawHeader(page)
    page.drawText(`Obra: ${diaObra.obra.nombre}`, {
      x: 30,
      y: 705,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    })
    page.drawText(`Fecha: ${dateStr}`, {
      x: 30,
      y: 688,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    })

    page.drawText(
      `Presupuesto Diario: $${dayBudget.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      { x: 45, y: 635, size: 10, font, color: rgb(0.2, 0.2, 0.2) }
    )
    page.drawText(
      `Total Gastado: $${totalSpent.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      { x: 45, y: 615, size: 10, font, color: rgb(0.2, 0.2, 0.2) }
    )
    page.drawText(
      `IVA Acumulado: $${totalIva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      { x: 45, y: 595, size: 10, font, color: rgb(0.2, 0.2, 0.2) }
    )
    page.drawText(
      `Saldo de la Jornada: $${balance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      { x: 300, y: 635, size: 12, font: fontBold, color: rgb(0.2, 0.2, 0.2) }
    )

    page.drawText("Desglose de Gastos", {
      x: 30,
      y: 535,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    })

    let yPos = 510
    page.drawLine({
      start: { x: 30, y: yPos + 10 },
      end: { x: 570, y: yPos + 10 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    })

    page.drawText("Responsable", {
      x: 30,
      y: yPos,
      size: 8,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    })
    page.drawText("Concepto", {
      x: 95,
      y: yPos,
      size: 8,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    })
    page.drawText("Proveedor", {
      x: 190,
      y: yPos,
      size: 8,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    })
    page.drawText("RFC", {
      x: 270,
      y: yPos,
      size: 8,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    })
    page.drawText("Subtotal", {
      x: 340,
      y: yPos,
      size: 8,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    })
    page.drawText("IVA $", {
      x: 400,
      y: yPos,
      size: 8,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    })
    page.drawText("Total", {
      x: 460,
      y: yPos,
      size: 8,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    })
    page.drawText("Estado", {
      x: 520,
      y: yPos,
      size: 8,
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

    const wrapText = (
      text: string,
      maxWidth: number,
      fontToUse: any,
      fontSize: number
    ): string[] => {
      if (!text) return [""]
      const words = text.split(" ")
      let lines: string[] = []
      let currentLine = words[0] || ""

      for (let i = 1; i < words.length; i++) {
        const word = words[i]
        const width = fontToUse.widthOfTextAtSize(
          currentLine + " " + word,
          fontSize
        )
        if (width < maxWidth) {
          currentLine += " " + word
        } else {
          lines.push(currentLine)
          currentLine = word
        }
      }
      if (currentLine) lines.push(currentLine)
      return lines
    }

    for (const g of diaObra.gastos) {
      const responsableLines = wrapText(
        g.creadoPor?.name || "Desconocido",
        60,
        font,
        8
      )
      const conceptoLines = wrapText(g.concepto, 90, font, 8)
      const proveedorLines = wrapText(g.proveedor, 75, font, 8)
      const rfcLines = wrapText(rfcMap.get(g.proveedor) || "-", 60, font, 8)
      const maxLines = Math.max(
        responsableLines.length,
        conceptoLines.length,
        proveedorLines.length,
        rfcLines.length,
        1
      )

      if (yPos - maxLines * 10 < 50) {
        page = pdfDoc.addPage([600, 800])
        await drawHeader(page)
        yPos = 700
      }

      page.drawText(
        `$${Number(g.subtotal).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
        { x: 340, y: yPos, size: 8, font, color: rgb(0.2, 0.2, 0.2) }
      )
      page.drawText(
        `$${Number(g.iva).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
        { x: 400, y: yPos, size: 8, font, color: rgb(0.2, 0.2, 0.2) }
      )
      page.drawText(
        `$${Number(g.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
        { x: 460, y: yPos, size: 8, font, color: rgb(0.2, 0.2, 0.2) }
      )
      page.drawText(g.estado, {
        x: 520,
        y: yPos,
        size: 7,
        font,
        color: rgb(0.4, 0.4, 0.4),
      })

      for (let i = 0; i < maxLines; i++) {
        if (responsableLines[i]) {
          page.drawText(responsableLines[i], {
            x: 30,
            y: yPos - i * 10,
            size: 8,
            font,
            color: rgb(0.2, 0.2, 0.2),
          })
        }
        if (conceptoLines[i]) {
          page.drawText(conceptoLines[i], {
            x: 95,
            y: yPos - i * 10,
            size: 8,
            font,
            color: rgb(0.2, 0.2, 0.2),
          })
          if (g.isImprevisto) {
            const textWidth = font.widthOfTextAtSize(conceptoLines[i], 8)
            page.drawLine({
              start: { x: 95, y: yPos - i * 10 - 2 },
              end: { x: 95 + textWidth, y: yPos - i * 10 - 2 },
              thickness: 0.5,
              color: rgb(0.2, 0.2, 0.2),
            })
          }
        }
        if (proveedorLines[i]) {
          page.drawText(proveedorLines[i], {
            x: 190,
            y: yPos - i * 10,
            size: 8,
            font,
            color: rgb(0.2, 0.2, 0.2),
          })
        }
      }

      yPos -= maxLines * 10 + 5
    }

    // No legend

    // Images Section
    const gastosWithPhotos = diaObra.gastos.filter(
      (g) => g.fotos && g.fotos.length > 0
    )
    if (gastosWithPhotos.length > 0) {
      page = pdfDoc.addPage([600, 800])
      await drawHeader(page)

      let imgYPos = 700
      page.drawText("Anexo: Comprobantes de Gastos", {
        x: 30,
        y: imgYPos,
        size: 14,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      })
      imgYPos -= 30

      for (const g of gastosWithPhotos) {
        for (const foto of g.fotos) {
          if (imgYPos < 250) {
            page = pdfDoc.addPage([600, 800])
            await drawHeader(page)
            imgYPos = 700
          }

          page.drawText(
            `Gasto: ${g.concepto} ($${Number(g.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })})`,
            {
              x: 30,
              y: imgYPos,
              size: 10,
              font: fontBold,
              color: rgb(0.2, 0.2, 0.2),
            }
          )
          imgYPos -= 10

          try {
            // Fetch image from URL
            let finalUrl = foto.url
            if (finalUrl.includes("res.cloudinary.com")) {
              const uploadIndex = finalUrl.indexOf("/upload/")
              if (uploadIndex !== -1) {
                finalUrl =
                  finalUrl.substring(0, uploadIndex + 8) +
                  "f_jpg/" +
                  finalUrl.substring(uploadIndex + 8)
              }
            }

            let imgBuffer: any
            if (finalUrl.startsWith("/")) {
              const fs = require("fs")
              const path = require("path")
              const filePath = path.join(process.cwd(), "public", finalUrl)
              imgBuffer = fs.readFileSync(filePath)
            } else {
              const imgRes = await fetch(finalUrl)
              if (!imgRes.ok) throw new Error("Failed to fetch image")
              imgBuffer = await imgRes.arrayBuffer()
            }

            // Try to embed as PNG or JPG
            let embeddedImage
            try {
              embeddedImage = await pdfDoc.embedJpg(imgBuffer)
            } catch (e) {
              embeddedImage = await pdfDoc.embedPng(imgBuffer)
            }

            const imgDims = embeddedImage.scaleToFit(540, 250)

            page.drawImage(embeddedImage, {
              x: 30,
              y: imgYPos - imgDims.height,
              width: imgDims.width,
              height: imgDims.height,
            })

            imgYPos -= imgDims.height + 40 // Move down for next image
          } catch (e) {
            console.error("Failed to load image for PDF:", e)
            page.drawText("(Error al cargar la imagen)", {
              x: 30,
              y: imgYPos - 20,
              size: 10,
              font,
              color: rgb(0.8, 0.2, 0.2),
            })
            imgYPos -= 40
          }
        }
      }
    }

    const pdfBytes = await pdfDoc.save()
    const pdfFileName = `Reporte_Diario_${diaObra.obra.nombre.replace(/\s+/g, "_")}_${dateStr.replace(/\//g, "-")}.pdf`

    return new NextResponse(pdfBytes as any, {
      headers: {
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${pdfFileName}"`,
        "Content-Type": "application/pdf",
      },
    })
  } catch (err) {
    console.error(err)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
