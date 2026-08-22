import "dotenv/config"
import { prisma } from "../lib/db"
import bcrypt from "bcryptjs"

async function main() {
  console.log("Iniciando script de poblacion para Altalia III...")

  // 1. Obtener Rol
  let role = await prisma.role.findFirst({ where: { name: "CAPTURISTA" } })
  if (!role) {
    role = await prisma.role.findFirst()
  }
  if (!role) {
    console.error("No hay roles en el sistema.")
    process.exit(1)
  }

  // 2. Crear usuario pinto@mcacorporation.com
  let pinto = await prisma.user.findUnique({
    where: { email: "pinto@mcacorporation.com" },
  })
  if (!pinto) {
    const hashedPassword = await bcrypt.hash("123456", 10)
    pinto = await prisma.user.create({
      data: {
        name: "Pinto Test",
        email: "pinto@mcacorporation.com",
        password: hashedPassword,
        roleId: role.id,
      },
    })
    console.log("✅ Usuario pinto@mcacorporation.com creado.")
  } else {
    console.log("ℹ️ Usuario pinto@mcacorporation.com ya existe.")
  }

  // 3. Crear obra Altalia III
  let obra = await prisma.obra.findFirst({ where: { nombre: "Altalia III" } })
  if (!obra) {
    obra = await prisma.obra.create({
      data: {
        nombre: "Altalia III",
        presupuestoTotal: 150000.0,
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
    console.log(
      "✅ Obra Altalia III creada con pinto asignado como CAPTURISTA."
    )
  } else {
    console.log("ℹ️ Obra Altalia III ya existe.")
    // Asegurarse de que Pinto esté asignado
    const existeMiembro = await prisma.obraUser.findFirst({
      where: { obraId: obra.id, userId: pinto.id },
    })
    if (!existeMiembro) {
      await prisma.obraUser.create({
        data: {
          obraId: obra.id,
          userId: pinto.id,
          rol: "CAPTURISTA",
        },
      })
      console.log("✅ Usuario Pinto asignado a Altalia III.")
    }
  }

  // 4. Crear dias de obra
  const dias = []
  for (let i = 2; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)

    // Check if day exists
    let dia = await prisma.diaObra.findUnique({
      where: {
        obraId_fecha: {
          obraId: obra.id,
          fecha: d,
        },
      },
    })

    if (!dia) {
      dia = await prisma.diaObra.create({
        data: {
          obraId: obra.id,
          fecha: d,
          presupuestoDiario: 10000.0,
        },
      })
    }
    dias.push(dia)
  }
  console.log(`✅ ${dias.length} Días de obra verificados/creados.`)

  // 5. Crear gastos
  for (const dia of dias) {
    // Solo si el día no tiene gastos
    const gastosExistentes = await prisma.gasto.count({
      where: { diaObraId: dia.id },
    })
    if (gastosExistentes === 0) {
      await prisma.gasto.createMany({
        data: [
          {
            diaObraId: dia.id,
            concepto: "Materiales basicos",
            proveedor: "Home Depot",
            porcentajeIVA: 16.0,
            subtotal: 1000.0,
            iva: 160.0,
            total: 1160.0,
            categoria: "Materiales",
            isImprevisto: false,
            creadoPorId: pinto.id,
          },
          {
            diaObraId: dia.id,
            concepto: "Reparación de herramienta",
            proveedor: "Taller Lopez",
            porcentajeIVA: 16.0,
            subtotal: 500.0,
            iva: 80.0,
            total: 580.0,
            categoria: "Herramientas",
            isImprevisto: true,
            notaCapturista:
              "La pulidora se averió y requería reparación urgente",
            creadoPorId: pinto.id,
          },
        ],
      })
    }
  }
  console.log("✅ Gastos de prueba (incluyendo imprevistos) creados.")
  console.log("🎉 Script completado.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
