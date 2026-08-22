import { prisma } from "../lib/db";
async function main() {
  const userId = "cmt4u0tcx00068cbr3xv3zkmh"; // Sofía Ruiz
  const diaObraId = "cmt4u0u90000q8cbru2m6uodu"; // 21 de Agosto en Lomas

  console.log("Eliminando gastos...");
  const result = await prisma.gasto.deleteMany({
    where: {
      creadoPorId: userId,
      diaObraId: diaObraId
    }
  });
  console.log(`Eliminados ${result.count} gastos de Sofía del día 21.`);
}
main().then(() => prisma.$disconnect());
