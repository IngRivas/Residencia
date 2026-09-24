import { PrismaClient, ObraRol, ObraEstado, GastoEstado } from "@prisma/client"
import * as bcrypt from "bcryptjs"
import "dotenv/config"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding database with extensive sandbox mock data...")

  // Clean existing data
  await prisma.fotoFactura.deleteMany()
  await prisma.gasto.deleteMany()
  await prisma.diaObra.deleteMany()
  await prisma.obraUser.deleteMany()
  await prisma.obra.deleteMany()
  await prisma.user.deleteMany()
  await prisma.role.deleteMany()

  // Hash passwords
  const passwordHash = await bcrypt.hash("14102003", 10)

  // 1. Create Roles
  const superAdminRole = await prisma.role.create({
    data: {
      name: "SUPER_ADMIN",
      permissions: JSON.stringify([
        "manage_roles",
        "manage_users",
        "manage_obras",
        "manage_expenses",
        "view_reports",
      ]),
      isSystem: true,
    },
  })

  const adminRole = await prisma.role.create({
    data: {
      name: "ADMIN",
      permissions: JSON.stringify([
        "manage_users",
        "manage_obras",
        "manage_expenses",
        "view_reports",
      ]),
      isSystem: true,
    },
  })

  const capturistaRole = await prisma.role.create({
    data: {
      name: "CAPTURISTA",
      permissions: JSON.stringify(["manage_expenses", "view_reports"]),
      isSystem: true,
    },
  })

  const viewerRole = await prisma.role.create({
    data: {
      name: "VIEWER",
      permissions: JSON.stringify(["view_reports"]),
      isSystem: true,
    },
  })

  console.log("Roles seeded.")

  // 2. Create Users
  const superadmin = await prisma.user.create({
    data: {
      name: "Julio Exzacarias",
      email: "jrbdk147@gmail.com",
      password: passwordHash,
      roleId: superAdminRole.id,
    },
  })

  const admin = await prisma.user.create({
    data: {
      name: "Carlos Mendoza (Admin)",
      email: "admin@proyecto.com",
      password: passwordHash,
      roleId: adminRole.id,
    },
  })

  const capturista = await prisma.user.create({
    data: {
      name: "Sofía Ruiz (Capturista)",
      email: "capturista@proyecto.com",
      password: passwordHash,
      roleId: capturistaRole.id,
    },
  })

  const viewer = await prisma.user.create({
    data: {
      name: "Ing. Roberto Gómez (Viewer)",
      email: "viewer@proyecto.com",
      password: passwordHash,
      roleId: viewerRole.id,
    },
  })

  console.log("Standard credentials created.")

  // 2. Create Obras (Different states: ACTIVA, PAUSADA, ARCHIVADA, CERRADA)
  const obra1 = await prisma.obra.create({
    data: {
      nombre: "Residencial Las Lomas",
      presupuestoTotal: 2500000.0,
      estado: ObraEstado.ACTIVA,
      creadoPorId: superadmin.id,
    },
  })

  const obra2 = await prisma.obra.create({
    data: {
      nombre: "Plaza Central",
      presupuestoTotal: 1200000.0,
      estado: ObraEstado.ACTIVA,
      creadoPorId: superadmin.id,
    },
  })

  const obraPausada = await prisma.obra.create({
    data: {
      nombre: "Hospital Civil Poniente",
      presupuestoTotal: 5000000.0,
      estado: ObraEstado.PAUSADA,
      creadoPorId: superadmin.id,
    },
  })

  const obraArchivada = await prisma.obra.create({
    data: {
      nombre: "Bodega Industrial Norte",
      presupuestoTotal: 750000.0,
      estado: ObraEstado.ARCHIVADA,
      creadoPorId: superadmin.id,
    },
  })

  const obraCerrada = await prisma.obra.create({
    data: {
      nombre: "Condominio San Carlos",
      presupuestoTotal: 900000.0,
      estado: ObraEstado.CERRADA,
      creadoPorId: superadmin.id,
    },
  })

  console.log("Obras seeded in all lifecycle states.")

  // 3. Assign Members
  await prisma.obraUser.createMany({
    data: [
      // Project 1 memberships
      { obraId: obra1.id, userId: admin.id, rol: ObraRol.ADMIN },
      { obraId: obra1.id, userId: capturista.id, rol: ObraRol.CAPTURISTA },
      { obraId: obra1.id, userId: viewer.id, rol: ObraRol.VIEWER },

      // Project 2 memberships (shows selection screen to capturista)
      { obraId: obra2.id, userId: capturista.id, rol: ObraRol.CAPTURISTA },
      { obraId: obra2.id, userId: viewer.id, rol: ObraRol.VIEWER },

      // Paused project memberships
      { obraId: obraPausada.id, userId: admin.id, rol: ObraRol.ADMIN },
      {
        obraId: obraPausada.id,
        userId: capturista.id,
        rol: ObraRol.CAPTURISTA,
      },

      // Closed/Archived membership logs
      { obraId: obraCerrada.id, userId: admin.id, rol: ObraRol.ADMIN },
      { obraId: obraArchivada.id, userId: admin.id, rol: ObraRol.ADMIN },
    ],
  })

  console.log("Project assignments configured.")

  // Dates definition
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(today.getDate() - 2)

  const formatDay = (date: Date) =>
    new Date(date.toISOString().split("T")[0] + "T00:00:00")

  // ==================== OBRA 1: RESIDENCIAL LAS LOMAS ====================

  // Day 1 (Today)
  const day1Obra1 = await prisma.diaObra.create({
    data: {
      obraId: obra1.id,
      fecha: formatDay(today),
      presupuestoDiario: 50000.0,
    },
  })

  await prisma.gasto.create({
    data: {
      diaObraId: day1Obra1.id,
      concepto: "Compra de 10 toneladas de varilla de 1/2",
      proveedor: "Aceros de México S.A. de C.V.",
      porcentajeIVA: 16.0,
      subtotal: 21551.72,
      iva: 3448.28,
      total: 25000.0,
      notaCapturista: "Entregado a pie de obra. Factura XML adjunta.",
      creadoPorId: capturista.id,
      estado: GastoEstado.VERIFICADO,
      notaAdmin: "Varillas verificadas en el almacén central de la obra.",
      fotos: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800",
            publicId: "varilla_img_1",
          },
        ],
      },
    },
  })

  await prisma.gasto.create({
    data: {
      diaObraId: day1Obra1.id,
      concepto: "Combustible Diesel camión de carga",
      proveedor: "Servicio Gasolinero Lomas",
      porcentajeIVA: 8.0,
      subtotal: 4629.63,
      iva: 370.37,
      total: 5000.0,
      notaCapturista: "Llenado de tanque authorized por residencia.",
      creadoPorId: capturista.id,
      estado: GastoEstado.PENDIENTE,
    },
  })

  // Day 2 (Yesterday)
  const day2Obra1 = await prisma.diaObra.create({
    data: {
      obraId: obra1.id,
      fecha: formatDay(yesterday),
      presupuestoDiario: 40000.0,
    },
  })

  await prisma.gasto.create({
    data: {
      diaObraId: day2Obra1.id,
      concepto: "Renta de excavadora retro hidráulica",
      proveedor: "Maquinaria Pesada del Norte",
      porcentajeIVA: 16.0,
      subtotal: 17241.38,
      iva: 2758.62,
      total: 20000.0,
      notaCapturista:
        "Renta correspondiente a la jornada de excavación de cimientos.",
      creadoPorId: capturista.id,
      estado: GastoEstado.VERIFICADO,
      notaAdmin: "Trabajo completado según cronograma del día.",
    },
  })

  await prisma.gasto.create({
    data: {
      diaObraId: day2Obra1.id,
      concepto: "Herramientas menores (palas, picos, carretillas)",
      proveedor: "Ferretería Industrial S.A.",
      porcentajeIVA: 16.0,
      subtotal: 6896.55,
      iva: 1103.45,
      total: 8000.0,
      notaCapturista: "Reposición de equipo de mano para cuadrilla 3.",
      creadoPorId: capturista.id,
      estado: GastoEstado.RECHAZADO,
      notaAdmin:
        "Gasto rechazado. Falta firma de autorización en el vale de entrega.",
    },
  })

  // ==================== OBRA 2: PLAZA CENTRAL ====================

  const day1Obra2 = await prisma.diaObra.create({
    data: {
      obraId: obra2.id,
      fecha: formatDay(today),
      presupuestoDiario: 35000.0,
    },
  })

  await prisma.gasto.create({
    data: {
      diaObraId: day1Obra2.id,
      concepto: "Compra de cemento gris (100 sacos)",
      proveedor: "Materiales y Prefabricados Monterrey",
      porcentajeIVA: 16.0,
      subtotal: 12931.03,
      iva: 2068.97,
      total: 15000.0,
      notaCapturista: "Cemento para colado de trabes principales.",
      creadoPorId: capturista.id,
      estado: GastoEstado.PENDIENTE,
    },
  })

  await prisma.gasto.create({
    data: {
      diaObraId: day1Obra2.id,
      concepto: "Flete y acarreo de arena de río (3 viajes)",
      proveedor: "Transportes del Centro S.A.",
      porcentajeIVA: 8.0,
      subtotal: 5555.56,
      iva: 444.44,
      total: 6000.0,
      notaCapturista: "Viaje de arena para mezcla.",
      creadoPorId: capturista.id,
      estado: GastoEstado.VERIFICADO,
    },
  })

  // ==================== OBRA CERRADA: CONDOMINIO SAN CARLOS ====================

  const day1ObraCerrada = await prisma.diaObra.create({
    data: {
      obraId: obraCerrada.id,
      fecha: formatDay(twoDaysAgo),
      presupuestoDiario: 60000.0,
    },
  })

  await prisma.gasto.create({
    data: {
      diaObraId: day1ObraCerrada.id,
      concepto: "Pintura vinílica y acabados finales",
      proveedor: "Pinturas Sherwin Williams",
      porcentajeIVA: 16.0,
      subtotal: 34482.76,
      iva: 5517.24,
      total: 40000.0,
      notaCapturista:
        "Aplicación de segunda mano en interiores de departamentos.",
      creadoPorId: capturista.id,
      estado: GastoEstado.VERIFICADO,
      notaAdmin: "Verificado y cerrado. Acabados conformes.",
    },
  })

  await prisma.gasto.create({
    data: {
      diaObraId: day1ObraCerrada.id,
      concepto: "Limpieza fina de entrega de departamentos",
      proveedor: "Servicios Clean & Clear",
      porcentajeIVA: 16.0,
      subtotal: 8620.69,
      iva: 1379.31,
      total: 10000.0,
      notaCapturista: "Limpieza final para entrega a clientes.",
      creadoPorId: capturista.id,
      estado: GastoEstado.VERIFICADO,
    },
  })

  console.log("Days and Expenses seeded successfully.")
  console.log("Prisma Seeding Completed!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
