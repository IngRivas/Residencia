import { prisma } from "../lib/db";
async function main() {
  const gastos = await prisma.gasto.findMany({
    orderBy: { createdAt: "desc" },
    take: 2,
    select: { concepto: true, total: true, estado: true, notaAdmin: true }
  });
  console.log(JSON.stringify(gastos, null, 2));
}
main().then(() => prisma.$disconnect());
