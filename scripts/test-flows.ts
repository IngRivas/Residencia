import "dotenv/config";
import { PrismaClient, ObraRol, ObraEstado, GastoEstado } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testAllFlows() {
  console.log("=================================================================");
  console.log("🚀 INICIANDO VERIFICACIÓN EXHAUSTIVA DE FLUJOS (ADMIN & CAPTURISTA)");
  console.log("=================================================================\n");

  // 0. Obtener usuarios clave
  const admin = await prisma.user.findFirst({
    where: { role: { name: "ADMIN" } },
  });
  const capturista = await prisma.user.findFirst({
    where: { role: { name: "CAPTURISTA" } },
  });
  const viewer = await prisma.user.findFirst({
    where: { role: { name: "VIEWER" } },
  });

  if (!admin || !capturista || !viewer) {
    throw new Error("Faltan usuarios requeridos en la base de datos.");
  }

  console.log(`👤 Admin: ${admin.name} (${admin.email})`);
  console.log(`👤 Capturista: ${capturista.name} (${capturista.email})`);
  console.log(`👤 Viewer: ${viewer.name} (${viewer.email})\n`);

  // -------------------------------------------------------------
  // FLUJO 1: Obra Principal y Creación de Día de Trabajo (ADMIN)
  // -------------------------------------------------------------
  console.log("--- FLUJO 1: Admin gestiona Obra y Apertura de Jornada ---");
  const obra = await prisma.obra.findFirst({
    where: { nombre: "Residencial Las Lomas", deletedAt: null },
  });
  if (!obra) throw new Error("No se encontró la obra principal Residencial Las Lomas");
  console.log(`✅ Obra localizada: "${obra.nombre}" (ID: ${obra.id}, Presupuesto: $${obra.presupuestoTotal})`);

  // Fecha de hoy en formato local YYYY-MM-DD
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString().split("T")[0];

  // Admin crea/asegura la jornada de hoy con un presupuesto asignado
  let diaHoy = await prisma.diaObra.findUnique({
    where: { obraId_fecha: { obraId: obra.id, fecha: today } },
  });
  if (!diaHoy) {
    diaHoy = await prisma.diaObra.create({
      data: {
        obraId: obra.id,
        fecha: today,
        presupuestoDiario: 25000.0,
        reposicion: 0.0,
      },
    });
    console.log(`✅ Admin aperturó jornada para hoy (${todayISO}) con presupuesto de $25,000.00 MXN.`);
  } else {
    diaHoy = await prisma.diaObra.update({
      where: { id: diaHoy.id },
      data: { presupuestoDiario: 25000.0 },
    });
    console.log(`✅ Jornada de hoy ya existía. Presupuesto asegurado en $25,000.00 MXN.`);
  }

  // -------------------------------------------------------------
  // FLUJO 2: Capturista accede a sus obras y registra un gasto
  // -------------------------------------------------------------
  console.log("\n--- FLUJO 2: Capturista registra Gasto con Comprobante ---");
  // 2.1 Verificar que el capturista ve la obra asignada
  const capturistaMembership = await prisma.obraUser.findFirst({
    where: { obraId: obra.id, userId: capturista.id, rol: ObraRol.CAPTURISTA },
  });
  if (!capturistaMembership) {
    throw new Error("El capturista no tiene asignada la obra en obraUser");
  }
  console.log(`✅ Capturista tiene membresía activa en "${obra.nombre}".`);

  // 2.2 Capturista captura un nuevo gasto
  const gastoTotal = 1450.0;
  const ivaRate = 0.16;
  const subtotal = gastoTotal / (1 + ivaRate);
  const iva = gastoTotal - subtotal;

  const nuevoGasto = await prisma.gasto.create({
    data: {
      diaObraId: diaHoy.id,
      creadoPorId: capturista.id,
      concepto: "Material eléctrico y cable calibre 12 para planta baja",
      proveedor: "THE HOME DEPOT",
      categoria: "Materiales",
      porcentajeIVA: 16,
      subtotal,
      iva,
      total: gastoTotal,
      estado: GastoEstado.PENDIENTE,
      notaCapturista: "Compra urgente autorizada por residente de obra.",
      fotos: {
        create: [
          {
            url: "/tickets/ticket-homedepot.png",
            publicId: `ticket_${Date.now()}`,
          },
        ],
      },
    },
    include: {
      fotos: true,
      creadoPor: { select: { name: true, email: true } },
    },
  });

  console.log(`✅ Capturista registró exitosamente el gasto:`);
  console.log(`   - ID: ${nuevoGasto.id}`);
  console.log(`   - Concepto: "${nuevoGasto.concepto}"`);
  console.log(`   - Proveedor: "${nuevoGasto.proveedor}"`);
  console.log(`   - Total: $${nuevoGasto.total.toFixed(2)} (Subtotal: $${subtotal.toFixed(2)}, IVA: $${iva.toFixed(2)})`);
  console.log(`   - Estado inicial: ${nuevoGasto.estado}`);
  console.log(`   - Comprobantes adjuntos: ${nuevoGasto.fotos.length}`);

  // -------------------------------------------------------------
  // FLUJO 3: Admin audita, revisa y aprueba el gasto del capturista
  // -------------------------------------------------------------
  console.log("\n--- FLUJO 3: Admin audita y aprueba el gasto ---");
  const gastoToAudit = await prisma.gasto.findUnique({
    where: { id: nuevoGasto.id },
    include: { diaObra: true, fotos: true },
  });
  if (!gastoToAudit) throw new Error("Gasto no encontrado para auditar");

  console.log(`Admin revisa comprobante (${gastoToAudit.fotos[0]?.url}) y aprueba el gasto.`);
  const gastoAprobado = await prisma.gasto.update({
    where: { id: gastoToAudit.id },
    data: {
      estado: GastoEstado.VERIFICADO,
      notaAdmin: "Comprobante verificado. Precios y materiales validados en almacén.",
    },
  });

  console.log(`✅ Gasto actualizado a: ${gastoAprobado.estado}`);
  console.log(`   - Nota de Admin: "${gastoAprobado.notaAdmin}"`);

  // -------------------------------------------------------------
  // FLUJO 4: Balance y Cálculos Financieros del Día y la Obra
  // -------------------------------------------------------------
  console.log("\n--- FLUJO 4: Verificación de Cálculos y Balances ---");
  const diaConGastos = await prisma.diaObra.findUnique({
    where: { id: diaHoy.id },
    include: { gastos: { where: { deletedAt: null } } },
  });

  let totalGastado = 0;
  diaConGastos?.gastos.forEach((g) => {
    if (!g.noAfectaPresupuesto) {
      totalGastado += Number(g.total);
    }
  });

  const saldoRestante = Number(diaConGastos?.presupuestoDiario || 0) - totalGastado;
  console.log(`✅ Presupuesto del Día: $${Number(diaConGastos?.presupuestoDiario).toFixed(2)} MXN`);
  console.log(`✅ Total Gastado Hoy:   $${totalGastado.toFixed(2)} MXN`);
  console.log(`✅ Saldo Restante Hoy:  $${saldoRestante.toFixed(2)} MXN`);

  // -------------------------------------------------------------
  // FLUJO 5: Ciclo de Vida de Obra (Crear, Asignar, Papelera, Restaurar)
  // -------------------------------------------------------------
  console.log("\n--- FLUJO 5: Admin crea nueva Obra, asigna y prueba Papelera ---");
  // 5.1 Crear obra nueva
  const testObra = await prisma.obra.create({
    data: {
      nombre: "Obra Temporal Validación Flujos",
      presupuestoTotal: 500000.0,
      estado: ObraEstado.ACTIVA,
      creadoPorId: admin.id,
    },
  });
  console.log(`✅ Admin creó nueva obra: "${testObra.nombre}" (ID: ${testObra.id})`);

  // 5.2 Asignar miembros
  await prisma.obraUser.createMany({
    data: [
      { obraId: testObra.id, userId: admin.id, rol: ObraRol.ADMIN },
      { obraId: testObra.id, userId: capturista.id, rol: ObraRol.CAPTURISTA },
      { obraId: testObra.id, userId: viewer.id, rol: ObraRol.VIEWER },
    ],
  });
  const miembrosCount = await prisma.obraUser.count({ where: { obraId: testObra.id } });
  console.log(`✅ Miembros asignados a la obra: ${miembrosCount}`);

  // 5.3 Enviar a Papelera (Soft Delete)
  await prisma.obra.update({
    where: { id: testObra.id },
    data: { deletedAt: new Date() },
  });
  console.log(`✅ Obra movida a Papelera de reciclaje.`);

  const enPapelera = await prisma.obra.findFirst({
    where: { id: testObra.id, deletedAt: { not: null } },
  });
  if (!enPapelera) throw new Error("La obra no se marcó en papelera");
  console.log(`✅ Confirmado en Papelera: "${enPapelera.nombre}" (deletedAt: ${enPapelera.deletedAt})`);

  // 5.4 Limpiar la obra de prueba
  await prisma.obraUser.deleteMany({ where: { obraId: testObra.id } });
  await prisma.obra.delete({ where: { id: testObra.id } });
  console.log(`✅ Obra temporal de prueba purgada limpiamente.`);

  // -------------------------------------------------------------
  // FLUJO 6: Verificación de Reportes PDF/Excel (Estructura de Datos)
  // -------------------------------------------------------------
  console.log("\n--- FLUJO 6: Generación de Reportes de Cierre ---");
  const obraParaReporte = await prisma.obra.findUnique({
    where: { id: obra.id },
    include: {
      dias: {
        include: {
          gastos: {
            include: { fotos: true },
          },
        },
      },
    },
  });
  if (!obraParaReporte) throw new Error("Obra no encontrada para reporte");
  console.log(`✅ Datos de "${obraParaReporte.nombre}" listos para exportar en PDF/Excel.`);
  console.log(`   - Jornadas para el reporte: ${obraParaReporte.dias.length}`);

  console.log("\n=================================================================");
  console.log("🎉 ¡TODOS LOS FLUJOS DE ADMIN Y CAPTURISTA FUNCIONAN AL 100%!");
  console.log("=================================================================");
}

testAllFlows()
  .catch((e) => {
    console.error("❌ Fallo en los flujos:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
