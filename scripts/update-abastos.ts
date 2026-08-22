import { prisma } from '../lib/db';

async function run() {
  const records = await prisma.contratistaGasto.findMany({
    where: {
      obraNombre: {
        contains: "ABASTOS",
        mode: "insensitive"
      }
    }
  });
  
  console.log(`Found ${records.length} records with ABASTOS.`);
  let count = 0;
  for (const r of records) {
    if (r.obraNombre.toUpperCase().includes("CENTRAL DE ABASTOS")) {
      await prisma.contratistaGasto.update({
        where: { id: r.id },
        data: { obraNombre: "ABASTOS" }
      });
      count++;
    }
  }
  console.log(`Updated ${count} records from CENTRAL DE ABASTOS to ABASTOS.`);
}

run();
