import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import fs from "fs"
import path from "path"
import { prisma } from "@/lib/db"

export const drawObraDetalle = async (
  obra: any,
  pdfDoc: PDFDocument,
  font: any,
  fontBold: any,
  proveedorFilter: string | null = null
) => {
  const obraPages: any[] = []

  const addPage = () => {
    const p = pdfDoc.addPage([600, 800])
    obraPages.push(p)
    return p
  }

  const drawRightText = (
    currentPage: any,
    text: string,
    rightX: number,
    y: number,
    size: number,
    fontToUse: any,
    color: any
  ) => {
    const w = fontToUse.widthOfTextAtSize(text, size)
    currentPage.drawText(text, {
      x: rightX - w,
      y,
      size,
      font: fontToUse,
      color,
    })
  }

  const wrapText = (
    text: string,
    maxWidth: number,
    fontToUse: any,
    fontSize: number
  ): string[] => {
    if (!text) return [""]
    const words = text.replace(/\n/g, " ").split(" ")
    let lines: string[] = []
    let currentLine = words[0] || ""
    for (let i = 1; i < words.length; i++) {
      const word = words[i]
      const width = fontToUse.widthOfTextAtSize(
        currentLine + " " + word,
        fontSize
      )
      if (width < maxWidth) currentLine += " " + word
      else {
        lines.push(currentLine)
        currentLine = word
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines
  }

  let page = addPage()
  const accentColor = rgb(0.12, 0.16, 0.22) // Subtle dark accent

  // Cover Page Header
  page.drawRectangle({
    x: 0,
    y: 790,
    width: 600,
    height: 10,
    color: accentColor,
  })

  let logoCenterY = 750

  try {
    const logoPath = path.join(
      process.cwd(),
      "public",
      "Logo MCA horizontal.png"
    )
    const logoImageBytes = fs.readFileSync(logoPath)
    const logoImage = await pdfDoc.embedPng(logoImageBytes)
    const logoDims = logoImage.scaleToFit(180, 40)
    const logoY = 750 - logoDims.height / 2
    page.drawImage(logoImage, {
      x: 30,
      y: logoY,
      width: logoDims.width,
      height: logoDims.height,
    })
    logoCenterY = 750
  } catch (e) {
    console.error("Error loading logo:", e)
  }

  let titleText = "Reporte financiero de obra"
  if (proveedorFilter && proveedorFilter.trim() !== "") {
    titleText = `Reporte financiero proveedor ${proveedorFilter}`
  }
  titleText = titleText.toUpperCase()

  const titleWidth = fontBold.widthOfTextAtSize(titleText, 10)
  page.drawText(titleText, {
    x: 570 - titleWidth,
    y: logoCenterY - 4,
    size: 10,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  })
  page.drawLine({
    start: { x: 30, y: 710 },
    end: { x: 570, y: 710 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  })

  // Calc Metrics
  let budgetTotal = 0
  let totalSpent = 0
  let totalIva = 0
  let totalIva16 = 0
  let totalIva8 = 0
  let totalImprevistos = 0

  let firstDate: Date | null = null
  let lastDate: Date | null = null

  const daysList = obra.dias.map((dia: any) => {
    let spent = 0
    let dayIva = 0
    let has16 = false
    let has8 = false

    const fDate = new Date(dia.fecha)
    if (!firstDate || fDate < firstDate) firstDate = fDate
    if (!lastDate || fDate > lastDate) lastDate = fDate

    dia.gastos.forEach((gasto: any) => {
      spent += Number(gasto.total)
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
    return {
      fecha: dia.fecha.toLocaleDateString("es-MX", { timeZone: "UTC" }),
      presupuesto: budget,
      gastado: spent,
      iva: dayIva,
      ivaStr: dayBreakdowns.length > 0 ? ` (${dayBreakdowns.join(" y ")})` : "",
      saldo: budget - spent,
    }
  })

  if (obra.dias.length === 0) budgetTotal = Number(obra.presupuestoTotal)
  const finalBalance = budgetTotal - totalSpent
  const porcentajeConsumido =
    budgetTotal > 0 ? ((totalSpent / budgetTotal) * 100).toFixed(1) : "0.0"
  const dateRangeStr =
    firstDate && lastDate
      ? `Del ${(firstDate as Date).toLocaleDateString("es-MX", { timeZone: "UTC" })} al ${(lastDate as Date).toLocaleDateString("es-MX", { timeZone: "UTC" })}`
      : "Sin fechas registradas"

  const proveedoresList = await prisma.proveedor.findMany({
    select: { nombre: true, rfc: true },
  })
  const rfcMap = new Map<string, string>()
  proveedoresList.forEach((p) => {
    if (p.rfc) rfcMap.set(p.nombre, p.rfc)
  })

  // Cover Content
  page.drawText(obra.nombre, {
    x: 30,
    y: 660,
    size: 24,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })
  page.drawText(dateRangeStr, {
    x: 30,
    y: 640,
    size: 12,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })

  page.drawText("Resumen Financiero Global", {
    x: 45,
    y: 565,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })

  page.drawText(`Presupuesto Total Asignado:`, {
    x: 45,
    y: 535,
    size: 11,
    font,
    color: rgb(0.3, 0.3, 0.3),
  })
  drawRightText(
    page,
    `$${budgetTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
    260,
    535,
    11,
    fontBold,
    rgb(0.1, 0.1, 0.1)
  )

  page.drawText(`Gasto Acumulado (${porcentajeConsumido}%):`, {
    x: 45,
    y: 515,
    size: 11,
    font,
    color: rgb(0.3, 0.3, 0.3),
  })
  drawRightText(
    page,
    `$${totalSpent.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
    260,
    515,
    11,
    fontBold,
    rgb(0.1, 0.1, 0.1)
  )

  page.drawText(`Saldo Restante:`, {
    x: 45,
    y: 490,
    size: 12,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  })
  drawRightText(
    page,
    `$${finalBalance.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
    260,
    490,
    12,
    fontBold,
    rgb(0.1, 0.1, 0.1)
  )

  let ivaBreakdownStr = ""
  if (totalIva16 > 0 || totalIva8 > 0) {
    const bd = []
    if (totalIva16 > 0) bd.push("16%")
    if (totalIva8 > 0) bd.push("8%")
    ivaBreakdownStr = ` (${bd.join(" y ")})`
  }

  page.drawText(`IVA Total Acumulado${ivaBreakdownStr}:`, {
    x: 300,
    y: 535,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  })
  drawRightText(
    page,
    `$${totalIva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
    550,
    535,
    10,
    fontBold,
    rgb(0.1, 0.1, 0.1)
  )

  page.drawText(`Total de Imprevistos / Urgencias:`, {
    x: 300,
    y: 515,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  })
  drawRightText(
    page,
    `$${totalImprevistos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
    550,
    515,
    10,
    fontBold,
    rgb(0.8, 0.2, 0.2)
  )

  if (totalSpent === 0) {
    page.drawText("Sin gastos registrados", {
      x: 230,
      y: 400,
      size: 14,
      font: fontBold,
      color: rgb(0.6, 0.6, 0.6),
    })
  } else {
    // ---------------------------------------------------------
    // PAGE: Resumen Diario
    // ---------------------------------------------------------
    page = addPage()
    let yPos = 730

    const drawHeaderDiario = () => {
      page.drawRectangle({
        x: 0,
        y: 790,
        width: 600,
        height: 10,
        color: accentColor,
      })
      page.drawText(`Resumen Diario - ${obra.nombre}`, {
        x: 30,
        y: 750,
        size: 14,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      })

      page.drawRectangle({
        x: 30,
        y: yPos - 15,
        width: 540,
        height: 25,
        color: rgb(0.92, 0.92, 0.92),
      })
      page.drawText("Fecha", {
        x: 40,
        y: yPos,
        size: 9,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      })
      drawRightText(
        page,
        "Ppto. Asignado",
        200,
        yPos,
        9,
        fontBold,
        rgb(0.1, 0.1, 0.1)
      )
      drawRightText(
        page,
        "Gasto Diario",
        320,
        yPos,
        9,
        fontBold,
        rgb(0.1, 0.1, 0.1)
      )
      drawRightText(
        page,
        "IVA Diario",
        440,
        yPos,
        9,
        fontBold,
        rgb(0.1, 0.1, 0.1)
      )
      drawRightText(
        page,
        "Ppto. Restante",
        560,
        yPos,
        9,
        fontBold,
        rgb(0.1, 0.1, 0.1)
      )
      yPos -= 30
    }

    drawHeaderDiario()

    daysList.forEach((day: any, index: number) => {
      if (yPos < 60) {
        page = addPage()
        yPos = 730
        drawHeaderDiario()
      }

      if (index % 2 === 0) {
        page.drawRectangle({
          x: 30,
          y: yPos - 5,
          width: 540,
          height: 16,
          color: rgb(0.97, 0.97, 0.97),
        })
      }

      page.drawText(day.fecha, {
        x: 40,
        y: yPos,
        size: 9,
        font,
        color: rgb(0.2, 0.2, 0.2),
      })
      drawRightText(
        page,
        `$${day.presupuesto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
        200,
        yPos,
        9,
        font,
        rgb(0.2, 0.2, 0.2)
      )
      drawRightText(
        page,
        `$${day.gastado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
        320,
        yPos,
        9,
        font,
        rgb(0.2, 0.2, 0.2)
      )
      drawRightText(
        page,
        `$${day.iva.toLocaleString("es-MX", { minimumFractionDigits: 2 })}${day.ivaStr}`,
        440,
        yPos,
        8,
        font,
        rgb(0.2, 0.2, 0.2)
      )
      drawRightText(
        page,
        `$${day.saldo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
        560,
        yPos,
        9,
        fontBold,
        rgb(0.2, 0.2, 0.2)
      )

      yPos -= 16
    })

    // ---------------------------------------------------------
    // PAGE: Desglose de Gastos
    // ---------------------------------------------------------
    page = addPage()
    yPos = 730

    const drawHeaderGastos = () => {
      page.drawRectangle({
        x: 0,
        y: 790,
        width: 600,
        height: 10,
        color: accentColor,
      })
      page.drawText(`Desglose de Gastos - ${obra.nombre}`, {
        x: 30,
        y: 750,
        size: 14,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      })

      page.drawRectangle({
        x: 30,
        y: yPos - 15,
        width: 540,
        height: 25,
        color: rgb(0.92, 0.92, 0.92),
      })
      page.drawText("Fecha", {
        x: 35,
        y: yPos,
        size: 8,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      })
      page.drawText("Concepto", {
        x: 100,
        y: yPos,
        size: 8,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      })
      page.drawText("Resp / Prov.", {
        x: 260,
        y: yPos,
        size: 8,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      })
      drawRightText(
        page,
        "Subtotal",
        410,
        yPos,
        8,
        fontBold,
        rgb(0.1, 0.1, 0.1)
      )
      drawRightText(page, "IVA $", 490, yPos, 8, fontBold, rgb(0.1, 0.1, 0.1))
      drawRightText(page, "Total", 565, yPos, 8, fontBold, rgb(0.1, 0.1, 0.1))
      yPos -= 30
    }

    drawHeaderGastos()

    let gastoIndex = 0
    for (const diaObra of obra.dias) {
      const dateStr = diaObra.fecha.toLocaleDateString("es-MX", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
      })

      for (const g of diaObra.gastos) {
        const conceptoLines = wrapText(g.concepto, 150, font, 8)
        const provRfc = rfcMap.get(g.proveedor)
        const provStr = provRfc
          ? `${g.proveedor} (RFC: ${provRfc})`
          : g.proveedor
        const provResp = wrapText(
          `${g.creadoPor?.name || "N/A"} / ${provStr}`,
          90,
          font,
          7
        )
        const maxLines = Math.max(conceptoLines.length, provResp.length, 1)
        const totalHeight = maxLines * 10 + 10

        if (yPos - totalHeight < 50) {
          page = addPage()
          yPos = 730
          drawHeaderGastos()
        }

        if (gastoIndex % 2 === 0) {
          page.drawRectangle({
            x: 30,
            y: yPos - totalHeight + 8,
            width: 540,
            height: totalHeight,
            color: rgb(0.97, 0.97, 0.97),
          })
        }

        page.drawText(dateStr, {
          x: 35,
          y: yPos,
          size: 8,
          font,
          color: rgb(0.3, 0.3, 0.3),
        })

        for (let i = 0; i < maxLines; i++) {
          if (conceptoLines[i]) {
            page.drawText(conceptoLines[i], {
              x: 100,
              y: yPos - i * 10,
              size: 8,
              font,
              color: rgb(0.2, 0.2, 0.2),
            })
            if (g.isImprevisto) {
              const tw = font.widthOfTextAtSize(conceptoLines[i], 8)
              page.drawLine({
                start: { x: 100, y: yPos - i * 10 - 1 },
                end: { x: 100 + tw, y: yPos - i * 10 - 1 },
                thickness: 0.5,
                color: rgb(0.2, 0.2, 0.2),
              })
            }
          }
          if (provResp[i]) {
            page.drawText(provResp[i], {
              x: 260,
              y: yPos - i * 10,
              size: 7,
              font,
              color: rgb(0.4, 0.4, 0.4),
            })
          }
        }

        drawRightText(
          page,
          `$${Number(g.subtotal).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
          410,
          yPos,
          8,
          font,
          rgb(0.2, 0.2, 0.2)
        )
        drawRightText(
          page,
          `$${Number(g.iva).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
          490,
          yPos,
          8,
          font,
          rgb(0.2, 0.2, 0.2)
        )
        drawRightText(
          page,
          `$${Number(g.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
          565,
          yPos,
          8,
          fontBold,
          rgb(0.1, 0.1, 0.1)
        )

        yPos -= totalHeight
        gastoIndex++
      }
    }

    // ---------------------------------------------------------
    // PAGE: Reposiciones
    // ---------------------------------------------------------
    const diasConReposicion = obra.dias.filter(
      (d: any) => Number(d.reposicion || 0) > 0
    )
    if (diasConReposicion.length > 0) {
      page = addPage()
      yPos = 730

      const drawHeaderReposiciones = () => {
        page.drawRectangle({
          x: 0,
          y: 790,
          width: 600,
          height: 10,
          color: accentColor,
        })
        page.drawText(`Desglose de Reposiciones - ${obra.nombre}`, {
          x: 30,
          y: 750,
          size: 14,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        })

        page.drawRectangle({
          x: 30,
          y: yPos - 15,
          width: 540,
          height: 25,
          color: rgb(0.92, 0.92, 0.92),
        })
        page.drawText("Fecha", {
          x: 40,
          y: yPos,
          size: 9,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        })
        drawRightText(
          page,
          "Monto de Reposición",
          560,
          yPos,
          9,
          fontBold,
          rgb(0.1, 0.1, 0.1)
        )
        yPos -= 30
      }

      drawHeaderReposiciones()

      diasConReposicion.forEach((dia: any, index: number) => {
        if (yPos < 60) {
          page = addPage()
          yPos = 730
          drawHeaderReposiciones()
        }

        if (index % 2 === 0) {
          page.drawRectangle({
            x: 30,
            y: yPos - 5,
            width: 540,
            height: 16,
            color: rgb(0.97, 0.97, 0.97),
          })
        }

        const dateStr = dia.fecha.toLocaleDateString("es-MX", {
          timeZone: "UTC",
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        page.drawText(dateStr, {
          x: 40,
          y: yPos,
          size: 9,
          font,
          color: rgb(0.2, 0.2, 0.2),
        })
        drawRightText(
          page,
          `$${Number(dia.reposicion).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
          560,
          yPos,
          9,
          font,
          rgb(0.2, 0.2, 0.2)
        )

        yPos -= 16
      })
    }

    // ---------------------------------------------------------
    // PAGE: Fotos
    // ---------------------------------------------------------
    const allGastosWithPhotos = obra.dias
      .flatMap((dia: any) => dia.gastos)
      .filter((g: any) => g.fotos && g.fotos.length > 0)
    if (allGastosWithPhotos.length > 0) {
      page = addPage()
      yPos = 730

      const drawHeaderFotos = () => {
        page.drawRectangle({
          x: 0,
          y: 790,
          width: 600,
          height: 10,
          color: accentColor,
        })
        page.drawText(`Anexo de Comprobantes - ${obra.nombre}`, {
          x: 30,
          y: 750,
          size: 14,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        })
        page.drawLine({
          start: { x: 30, y: 735 },
          end: { x: 570, y: 735 },
          thickness: 1,
          color: rgb(0.8, 0.8, 0.8),
        })
        yPos = 710
      }

      drawHeaderFotos()

      for (const g of allGastosWithPhotos) {
        for (const foto of g.fotos) {
          if (yPos < 250) {
            page = addPage()
            drawHeaderFotos()
          }

          page.drawText(
            `Gasto: ${g.concepto} ($${Number(g.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })})`,
            {
              x: 30,
              y: yPos,
              size: 10,
              font: fontBold,
              color: rgb(0.2, 0.2, 0.2),
            }
          )
          yPos -= 10

          try {
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
              const filePath = path.join(process.cwd(), "public", finalUrl)
              imgBuffer = fs.readFileSync(filePath)
            } else {
              const imgRes = await fetch(finalUrl)
              if (!imgRes.ok) throw new Error("Failed to fetch image")
              imgBuffer = await imgRes.arrayBuffer()
            }

            let embeddedImage
            try {
              embeddedImage = await pdfDoc.embedJpg(imgBuffer)
            } catch {
              embeddedImage = await pdfDoc.embedPng(imgBuffer)
            }

            const imgDims = embeddedImage.scaleToFit(500, 200)
            page.drawImage(embeddedImage, {
              x: 30,
              y: yPos - imgDims.height,
              width: imgDims.width,
              height: imgDims.height,
            })
            yPos -= imgDims.height + 20
          } catch (error) {
            console.error("Error embedding image:", error)
            page.drawText("[Error al cargar la imagen]", {
              x: 30,
              y: yPos - 15,
              size: 8,
              font,
              color: rgb(0.8, 0.2, 0.2),
            })
            yPos -= 30
          }
        }
      }
    }
  }

  // ---------------------------------------------------------
  // Apply Footers to all pages for this Obra (Left part only)
  // ---------------------------------------------------------
  obraPages.forEach((p) => {
    p.drawLine({
      start: { x: 30, y: 45 },
      end: { x: 570, y: 45 },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    })
    p.drawText(`Proyecto: ${obra.nombre}`, {
      x: 30,
      y: 30,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    })
  })
}
