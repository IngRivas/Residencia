import { prisma } from "../lib/db";
async function main() {
  const users = await prisma.user.findMany();
  console.log("Usuarios en BD:", users.map(u => ({ id: u.id, name: u.name, email: u.email })));
  
  const dias = await prisma.diaObra.findMany({
    where: {
      obra: { nombre: { contains: "lomas" } },
    }
  });
  console.log("Dias de obra en Lomas:", dias.map(d => ({ id: d.id, fecha: d.fecha })));
}
main().then(() => prisma.$disconnect());
