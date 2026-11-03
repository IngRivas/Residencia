import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  console.log("Iniciando inyección de datos de prueba para IA...");

  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No hay usuarios en la base de datos.");

  const activeObras = await prisma.obra.findMany({
    where: { estado: "ACTIVA", deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (activeObras.length === 0) {
    const newObra = await prisma.obra.create({
      data: {
        nombre: "Obra Residencial de Prueba IA",
        presupuestoTotal: 250000,
        estado: "ACTIVA",
        creadoPorId: user.id,
      },
    });
    activeObras.push(newObra);
  }

  console.log(`Obras activas encontradas (${activeObras.length}): ${activeObras.map((o) => o.nombre).join(", ")}`);

  // Asegurar proveedores en el catálogo
  await prisma.proveedor.upsert({
    where: { nombre: "MATERIALES Y FERRETERIA DEL NORTE" },
    update: {},
    create: { nombre: "MATERIALES Y FERRETERIA DEL NORTE", rfc: "MFN980415AB3" },
  });
  await prisma.proveedor.upsert({
    where: { nombre: "THE HOME DEPOT" },
    update: {},
    create: { nombre: "THE HOME DEPOT", rfc: "HDM001017AS1" },
  });
  await prisma.proveedor.upsert({
    where: { nombre: "ESTACION DE SERVICIO GASOMEX" },
    update: {},
    create: { nombre: "ESTACION DE SERVICIO GASOMEX", rfc: "ESG891102TX4" },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Inyectar en cada obra activa para que esté en cualquiera que abra el usuario
  for (const obra of activeObras) {
    let diaObra = await prisma.diaObra.findFirst({
      where: { obraId: obra.id, deletedAt: null },
      orderBy: { fecha: "desc" },
    });

    if (!diaObra) {
      diaObra = await prisma.diaObra.create({
        data: {
          obraId: obra.id,
          fecha: today,
          presupuestoDiario: 15000,
        },
      });
    }

    // Limpiar gastos de prueba anteriores en este día para no duplicar
    const oldGastos = await prisma.gasto.findMany({
      where: {
        diaObraId: diaObra.id,
        concepto: { contains: "Prueba IA" },
      },
      select: { id: true },
    });
    for (const g of oldGastos) {
      await prisma.fotoFactura.deleteMany({ where: { gastoId: g.id } });
      await prisma.gasto.delete({ where: { id: g.id } });
    }

    // GASTO 1: Materiales de Construcción (VÁLIDO -> Será APROBADO)
    await prisma.gasto.create({
      data: {
        diaObraId: diaObra.id,
        creadoPorId: user.id,
        concepto: "Prueba IA: Cemento, varilla 3/8 y alambre recocido",
        proveedor: "MATERIALES Y FERRETERIA DEL NORTE",
        categoria: "Materiales",
        porcentajeIVA: 16,
        subtotal: 4500.0,
        iva: 720.0,
        total: 5220.0,
        estado: "PENDIENTE",
        notaCapturista: "Ticket de Ferretería del Norte para colado de losas.",
        fotos: {
          create: [
            {
              url: "/tickets/ticket-ferreteria-aprobado.png",
              publicId: "ticket_ferreteria_aprobado",
            },
          ],
        },
      },
    });

    // GASTO 2: Pintura The Home Depot (VÁLIDO -> Será APROBADO)
    await prisma.gasto.create({
      data: {
        diaObraId: diaObra.id,
        creadoPorId: user.id,
        concepto: "Prueba IA: Pintura vinílica blanca y rodillos",
        proveedor: "THE HOME DEPOT",
        categoria: "Acabados",
        porcentajeIVA: 16,
        subtotal: 3570.0,
        iva: 571.2,
        total: 4141.2,
        estado: "PENDIENTE",
        notaCapturista: "Compra en The Home Depot Otay para detallado de muros.",
        fotos: {
          create: [
            {
              url: "/tickets/ticket-homedepot-aprobado.png",
              publicId: "ticket_homedepot_aprobado",
            },
          ],
        },
      },
    });

    // GASTO 3: Gasolina inflada (FRAUDE / DISCREPANCIA -> Será RECHAZADO)
    await prisma.gasto.create({
      data: {
        diaObraId: diaObra.id,
        creadoPorId: user.id,
        concepto: "Prueba IA: Combustible para generador eléctrico",
        proveedor: "ESTACION DE SERVICIO GASOMEX",
        categoria: "Combustible",
        porcentajeIVA: 16,
        subtotal: 1293.1,
        iva: 206.9,
        total: 1500.0, // Ticket marca $450.00
        estado: "PENDIENTE",
        notaCapturista: "Carga de gasolina para revolvedoras en campo.",
        fotos: {
          create: [
            {
              url: "/tickets/ticket-combustible-rechazado.png",
              publicId: "ticket_combustible_rechazado",
            },
          ],
        },
      },
    });

    console.log(`✅ Inyectados 3 gastos en la obra "${obra.nombre}"`);
  }

  console.log("\n🚀 ¡Datos listos en todas las obras activas!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
