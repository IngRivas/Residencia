import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import ExcelJS from "exceljs"
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
  const format = searchParams.get("format") || "pdf"
  const search = searchParams.get("search") || ""
  const download = searchParams.get("download") === "true"

  try {
    const whereClause: any = {}
    if (search) {
      whereClause.OR = [
        { nombre: { contains: search, mode: "insensitive" } },
        { rfc: { contains: search, mode: "insensitive" } },
      ]
    }

    const proveedores = await prisma.proveedor.findMany({
      where: whereClause,
      orderBy: { nombre: "asc" },
    })

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet("Proveedores")

      const headerRow = sheet.addRow([
        "Nombre del Proveedor",
        "RFC",
        "Fecha de Registro",
      ])

      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0F172A" },
        }
        cell.alignment = { horizontal: "center", vertical: "middle" }
      })
      headerRow.height = 25

      proveedores.forEach((p, i) => {
        const r = sheet.addRow([
          p.nombre,
          p.rfc || "Sin RFC",
          p.createdAt.toLocaleDateString("es-MX"),
        ])
        r.height = 20
        r.eachCell((cell) => {
          cell.alignment = { vertical: "middle" }
        })
        if (i % 2 === 0) {
          r.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" },
            }
          })
        }
      })

      sheet.columns.forEach((column) => {
        let maxLen = 0
        if (column && typeof column.eachCell === "function") {
          column.eachCell({ includeEmpty: true }, (cell) => {
            maxLen = Math.max(
              maxLen,
              cell.value ? cell.value.toString().length : 0
            )
          })
          column.width = maxLen < 20 ? 20 : maxLen + 2
        }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      return new NextResponse(buffer, {
        headers: {
          "Content-Disposition":
            'attachment; filename="Reporte_Proveedores.xlsx"',
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      })
    }

    // Default PDF Generation
    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([600, 800])
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    // Header logic
    const drawHeader = async (p: any) => {
      p.drawLine({
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
        p.drawImage(logoImage, {
          x: 30,
          y: logoY,
          width: logoDims.width,
          height: logoDims.height,
        })
      } catch (e) {
        // Logo not found, ignore
      }

      const titleText = "REPORTE DE PROVEEDORES"
      const titleWidth = fontBold.widthOfTextAtSize(titleText, 16)
      p.drawText(titleText, {
        x: 600 - 30 - titleWidth,
        y: 765 - 6,
        size: 16,
        font: fontBold,
        color: rgb(0, 0, 0),
      })

      p.drawText("Nombre del Proveedor", {
        x: 40,
        y: 700,
        size: 10,
        font: fontBold,
        color: rgb(0.3, 0.3, 0.3),
      })
      p.drawText("RFC", {
        x: 300,
        y: 700,
        size: 10,
        font: fontBold,
        color: rgb(0.3, 0.3, 0.3),
      })
      p.drawText("Fecha de Registro", {
        x: 450,
        y: 700,
        size: 10,
        font: fontBold,
        color: rgb(0.3, 0.3, 0.3),
      })
      p.drawLine({
        start: { x: 30, y: 695 },
        end: { x: 570, y: 695 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      })
    }

    await drawHeader(page)

    let yPos = 675

    for (const p of proveedores) {
      if (yPos < 60) {
        page = pdfDoc.addPage([600, 800])
        await drawHeader(page)
        yPos = 675
      }

      page.drawText(p.nombre.slice(0, 45), {
        x: 40,
        y: yPos,
        size: 9,
        font,
        color: rgb(0.2, 0.2, 0.2),
      })
      page.drawText(p.rfc || "Sin RFC", {
        x: 300,
        y: yPos,
        size: 9,
        font,
        color: rgb(0.2, 0.2, 0.2),
      })
      page.drawText(p.createdAt.toLocaleDateString("es-MX"), {
        x: 450,
        y: yPos,
        size: 9,
        font,
        color: rgb(0.2, 0.2, 0.2),
      })

      yPos -= 20
    }

    const allPages = pdfDoc.getPages()
    const generationDate = new Date().toLocaleDateString("es-MX", {
      timeZone: "UTC",
    })
    allPages.forEach((p, index) => {
      p.drawLine({
        start: { x: 30, y: 45 },
        end: { x: 570, y: 45 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      })
      p.drawText("CATÁLOGO DE PROVEEDORES", {
        x: 30,
        y: 30,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      })

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
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Reporte_Proveedores.pdf"`,
        "Content-Type": "application/pdf",
      },
    })
  } catch (err) {
    console.error(err)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
