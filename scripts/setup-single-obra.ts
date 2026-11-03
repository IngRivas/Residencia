import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  console.log("Iniciando limpieza y configuración: solo 'Residencial Las Lomas'...");

  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No hay usuarios en la base de datos.");

  // 1. Buscar o crear "Residencial Las Lomas"
  let lomas = await prisma.obra.findFirst({
    where: {
      nombre: { contains: "Las Lomas", mode: "insensitive" },
      deletedAt: null,
    },
  });

  if (!lomas) {
    lomas = await prisma.obra.create({
      data: {
        nombre: "Residencial Las Lomas",
        presupuestoTotal: 2500000.0,
        estado: "ACTIVA",
        creadoPorId: user.id,
      },
    });
    console.log(`Creada nueva obra: "${lomas.nombre}"`);
  } else {
    // Asegurar que esté ACTIVA y con nombre limpio
    await prisma.obra.update({
      where: { id: lomas.id },
      data: { nombre: "Residencial Las Lomas", estado: "ACTIVA" },
    });
    console.log(`Obra seleccionada: "${lomas.nombre}" (ID: ${lomas.id})`);
  }

  // 2. Eliminar todas las demás obras y sus dependencias
  const otherObras = await prisma.obra.findMany({
    where: {
      id: { not: lomas.id },
    },
    select: { id: true, nombre: true },
  });

  console.log(`Eliminando ${otherObras.length} otras obras...`);
  for (const o of otherObras) {
    // Borrar fotos de gastos
    const gastos = await prisma.gasto.findMany({
      where: { diaObra: { obraId: o.id } },
      select: { id: true },
    });
    for (const g of gastos) {
      await prisma.fotoFactura.deleteMany({ where: { gastoId: g.id } });
    }
    await prisma.gasto.deleteMany({ where: { diaObra: { obraId: o.id } } });
    await prisma.diaObra.deleteMany({ where: { obraId: o.id } });
    await prisma.obraUser.deleteMany({ where: { obraId: o.id } });
    await prisma.obra.delete({ where: { id: o.id } });
    console.log(`  - Eliminada: ${o.nombre}`);
  }

  // 3. En "Residencial Las Lomas", limpiar todos los días anteriores para dejar EXACTAMENTE 1 DÍA
  const diasLomas = await prisma.diaObra.findMany({
    where: { obraId: lomas.id },
    select: { id: true },
  });

  for (const d of diasLomas) {
    const gastos = await prisma.gasto.findMany({
      where: { diaObraId: d.id },
      select: { id: true },
    });
    for (const g of gastos) {
      await prisma.fotoFactura.deleteMany({ where: { gastoId: g.id } });
    }
    await prisma.gasto.deleteMany({ where: { diaObraId: d.id } });
    await prisma.diaObra.delete({ where: { id: d.id } });
  }

  // 4. Crear el ÚNICO día de trabajo para hoy
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const unicoDia = await prisma.diaObra.create({
    data: {
      obraId: lomas.id,
      fecha: today,
      presupuestoDiario: 10000.0,
      reposicion: 0.0,
    },
  });

  console.log(`Creado único día de trabajo: ${unicoDia.fecha.toISOString().split("T")[0]} (ID: ${unicoDia.id})`);

  // Asegurar proveedores en el catálogo
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

  // 5. Inyectar los 2 gastos de prueba
  // GASTO 1: Válido (Pintura The Home Depot -> Total $1,948.80)
  const gasto1 = await prisma.gasto.create({
    data: {
      diaObraId: unicoDia.id,
      creadoPorId: user.id,
      concepto: "Pintura blanca 19L y brochas para muros",
      proveedor: "THE HOME DEPOT",
      categoria: "Materiales",
      porcentajeIVA: 16,
      subtotal: 1680.0,
      iva: 268.8,
      total: 1948.8,
      estado: "PENDIENTE",
      notaCapturista: "Ticket de The Home Depot para pintura en muros interiores.",
      fotos: {
        create: [
          {
            url: "/tickets/ticket-homedepot.png",
            publicId: "ticket_homedepot_valido",
          },
        ],
      },
    },
  });

  // GASTO 2: Discrepancia / Fraude (Combustible Gasomex -> Ticket marca $450.00 pero declaró $1,200.00)
  const gasto2 = await prisma.gasto.create({
    data: {
      diaObraId: unicoDia.id,
      creadoPorId: user.id,
      concepto: "Combustible para revolvedora y generador de obra",
      proveedor: "ESTACION DE SERVICIO GASOMEX",
      categoria: "Combustible",
      porcentajeIVA: 16,
      subtotal: 1034.48,
      iva: 165.52,
      total: 1200.0, // En el ticket dice $450.00
      estado: "PENDIENTE",
      notaCapturista: "Carga de gasolina Magna para equipo en campo.",
      fotos: {
        create: [
          {
            url: "/tickets/ticket-gasolina.png",
            publicId: "ticket_gasolina_rechazado",
          },
        ],
      },
    },
  });

  console.log(`\n✅ ¡Configuración terminada exitosamente!`);
  console.log(`- Obra activa única: Residencial Las Lomas`);
  console.log(`- 1 único día de trabajo con 2 gastos de prueba:`);
  console.log(`  1) Válido: "${gasto1.concepto}" - $1,948.80 (THE HOME DEPOT)`);
  console.log(`  2) Falso / Discrepancia: "${gasto2.concepto}" - $1,200.00 vs $450.00 real (GASOMEX)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

