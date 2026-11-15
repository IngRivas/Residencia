import "dotenv/config";
import { PrismaClient, ObraRol, ObraEstado } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function clean() {
  console.log("🧹 Limpiando toda la mockdata y eliminando contratistas...");

  // 1. Eliminar datos de Contratistas
  try {
    await prisma.contratistaCardConfig.deleteMany();
    await prisma.contratistaGasto.deleteMany();
    console.log("✅ Tablas de Contratistas limpiadas al 100%.");
  } catch (err: any) {
    console.warn("Aviso en contratistas:", err.message);
  }

  // 2. Eliminar Obras de prueba / mock (todas excepto Residencial Las Lomas)
  const mockObras = await prisma.obra.findMany({
    where: {
      nombre: {
        not: "Residencial Las Lomas",
      },
    },
    select: { id: true, nombre: true },
  });

  console.log(`Eliminando ${mockObras.length} obras mock...`);
  for (const o of mockObras) {
    const dias = await prisma.diaObra.findMany({ where: { obraId: o.id }, select: { id: true } });
    for (const d of dias) {
      const gastos = await prisma.gasto.findMany({ where: { diaObraId: d.id }, select: { id: true } });
      for (const g of gastos) {
        await prisma.fotoFactura.deleteMany({ where: { gastoId: g.id } });
      }
      await prisma.gasto.deleteMany({ where: { diaObraId: d.id } });
    }
    await prisma.diaObra.deleteMany({ where: { obraId: o.id } });
    await prisma.obraUser.deleteMany({ where: { obraId: o.id } });
    await prisma.obra.delete({ where: { id: o.id } });
    console.log(`  - Eliminada obra mock: "${o.nombre}"`);
  }

  // 3. Limpiar gastos y días mock de "Residencial Las Lomas"
  let lomas = await prisma.obra.findFirst({
    where: { nombre: "Residencial Las Lomas" },
  });

  const superAdmin = await prisma.user.findFirst({
    where: { role: { name: "SUPER_ADMIN" } },
  });

  if (!lomas) {
    lomas = await prisma.obra.create({
      data: {
        nombre: "Residencial Las Lomas",
        presupuestoTotal: 2500000.0,
        estado: ObraEstado.ACTIVA,
        creadoPorId: superAdmin!.id,
      },
    });
    console.log("✅ Creada obra principal limpia: Residencial Las Lomas");
  } else {
    await prisma.obra.update({
      where: { id: lomas.id },
      data: {
        estado: ObraEstado.ACTIVA,
        deletedAt: null,
      },
    });
  }

  // Limpiar días y gastos anteriores
  const diasLomas = await prisma.diaObra.findMany({ where: { obraId: lomas.id } });
  for (const d of diasLomas) {
    const gastos = await prisma.gasto.findMany({ where: { diaObraId: d.id } });
    for (const g of gastos) {
      await prisma.fotoFactura.deleteMany({ where: { gastoId: g.id } });
    }
    await prisma.gasto.deleteMany({ where: { diaObraId: d.id } });
  }
  await prisma.diaObra.deleteMany({ where: { obraId: lomas.id } });
  console.log("✅ Residencial Las Lomas limpiada de gastos mock.");

  // 4. Asegurar asignación de miembros en Residencial Las Lomas
  const users = await prisma.user.findMany({ include: { role: true } });
  for (const u of users) {
    let assignedRol: ObraRol = ObraRol.VIEWER;
    if (u.role.name === "SUPER_ADMIN" || u.role.name === "ADMIN") {
      assignedRol = ObraRol.ADMIN;
    } else if (u.role.name === "CAPTURISTA") {
      assignedRol = ObraRol.CAPTURISTA;
    }

    await prisma.obraUser.upsert({
      where: { obraId_userId: { obraId: lomas.id, userId: u.id } },
      update: { rol: assignedRol },
      create: { obraId: lomas.id, userId: u.id, rol: assignedRol },
    });
  }
  console.log("✅ Miembros configurados en Residencial Las Lomas.");

  console.log("\n✨ ¡Base de datos limpia y sin mockdata lista para probar flujos!");
}

clean()
  .catch((e) => {
    console.error("Error al limpiar:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
