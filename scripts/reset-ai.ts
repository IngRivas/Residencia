import { prisma } from "../lib/db";
async function main() {
  await prisma.gasto.updateMany({
    where: { concepto: { contains: "Prueba correcta" } },
    data: { subtotal: 1098.99, iva: 104.40, total: 1203.39, estado: "PENDIENTE", notaAdmin: null }
  });
  await prisma.gasto.updateMany({
    where: { concepto: { contains: "fraude" } },
    data: { estado: "PENDIENTE", notaAdmin: null }
  });
  console.log("Valores arreglados y reseteados");
}
main().then(() => prisma.$disconnect());
