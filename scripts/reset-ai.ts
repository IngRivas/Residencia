import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  console.log("Reseteando los gastos de prueba a estado PENDIENTE...");

  const res = await prisma.gasto.updateMany({
    data: {
      estado: "PENDIENTE",
      notaAdmin: null,
    },
  });

  console.log(`✅ ${res.count} gastos reseteados a PENDIENTE sin notas.`);
  console.log("Ya puedes volver a presionar el botón '✨ Asistente IA' en la pantalla.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
