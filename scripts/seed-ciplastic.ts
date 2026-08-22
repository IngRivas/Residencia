import "dotenv/config"
import { prisma } from "../lib/db"
import bcrypt from "bcryptjs"

async function main() {
  console.log("Iniciando script de poblacion para Ciplastic Rosarito...")

  let pinto = await prisma.user.findUnique({
    where: { email: "pinto@mcacorporation.com" },
  })
  if (!pinto) {
    pinto = await prisma.user.findFirst()
  }

  if (!pinto) {
    console.error("No hay usuarios en el sistema")
    process.exit(1)
  }

  let obra = await prisma.obra.findFirst({
    where: { nombre: "Ciplastic Rosarito" },
  })
  if (!obra) {
    obra = await prisma.obra.create({
      data: {
        nombre: "Ciplastic Rosarito",
        presupuestoTotal: 85000.0,
        estado: "ACTIVA",
        creadoPorId: pinto.id,
        miembros: {
          create: {
            userId: pinto.id,
            rol: "CAPTURISTA",
          },
        },
      },
    })
    console.log("✅ Obra Ciplastic Rosarito creada.")
  } else {
    console.log("ℹ️ Obra Ciplastic Rosarito ya existe.")
  }

  const fechas = [
    new Date(Date.now() - 20 * 86400000), // ~3 weeks ago
    new Date(Date.now() - 14 * 86400000), // ~2 weeks ago
    new Date(Date.now() - 7 * 86400000), // ~1 week ago
    new Date(Date.now() - 2 * 86400000), // 2 days ago
  ]

  const dias = []
  for (const d of fechas) {
    let dia = await prisma.diaObra.findUnique({
      where: { obraId_fecha: { obraId: obra.id, fecha: d } },
    })

    if (!dia) {
      dia = await prisma.diaObra.create({
        data: {
          obraId: obra.id,
          fecha: d,
          presupuestoDiario: 21250.0,
        },
      })
    }
    dias.push(dia)
  }
  console.log(`✅ Días de obra verificados/creados.`)

  const gastosExistentes = await prisma.gasto.count({
    where: { diaObraId: { in: dias.map((d) => d.id) } },
  })
  if (gastosExistentes === 0) {
    const gastosData = [
      {
        dia: dias[0].id,
        subtotal: 12000,
        iva: 1920,
        concepto: "Material eléctrico y cableado de alta tensión",
        proveedor: "Eléctrica del Sol",
        cat: "Materiales",
        isImprevisto: false,
        fotoId: "cables",
      },
      {
        dia: dias[0].id,
        subtotal: 8000,
        iva: 1280,
        concepto: "Renta de retroexcavadora pesada",
        proveedor: "Maquinaria Rental BCS",
        cat: "Herramientas",
        isImprevisto: false,
        fotoId: "maquina",
      },
      {
        dia: dias[1].id,
        subtotal: 15000,
        iva: 2400,
        concepto: "Nómina de albañiles e instaladores primera fase",
        proveedor: "Sindicato Local",
        cat: "Mano de Obra",
        isImprevisto: false,
        fotoId: "nomina",
      },
      {
        dia: dias[1].id,
        subtotal: 3500,
        iva: 560,
        concepto: "Reparación de tubería rota por retroexcavadora",
        proveedor: "Plomería Express 24/7",
        cat: "Materiales",
        isImprevisto: true,
        notaCapturista: "Accidente con la máquina requirió plomería urgente",
        fotoId: "tuberia",
      },
      {
        dia: dias[2].id,
        subtotal: 6000,
        iva: 960,
        concepto: "Fletes y acarreos de material desde Tijuana",
        proveedor: "Transportes Logistic",
        cat: "Transporte",
        isImprevisto: false,
        fotoId: "camion",
      },
      {
        dia: dias[3].id,
        subtotal: 4500,
        iva: 720,
        concepto: "Lotes de tubería PVC e hidrosanitaria Cédula 40",
        proveedor: "Home Depot",
        cat: "Materiales",
        isImprevisto: false,
        fotoId: "pvc",
      },
    ]

    for (const gd of gastosData) {
      const gasto = await prisma.gasto.create({
        data: {
          diaObraId: gd.dia,
          concepto: gd.concepto,
          proveedor: gd.proveedor,
          porcentajeIVA: 16.0,
          subtotal: gd.subtotal,
          iva: gd.iva,
          total: gd.subtotal + gd.iva,
          categoria: gd.cat,
          isImprevisto: gd.isImprevisto,
          notaCapturista: gd.notaCapturista || null,
          creadoPorId: pinto.id,
          estado: "VERIFICADO",
        },
      })
      await prisma.fotoFactura.create({
        data: {
          gastoId: gasto.id,
          url: `https://picsum.photos/seed/${gd.fotoId}/400/300`,
          publicId: `seed_public_${gd.fotoId}`,
        },
      })
    }
    console.log("✅ Gastos y fotos creados.")
  }

  console.log("🎉 Script Ciplastic Rosarito completado.")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
