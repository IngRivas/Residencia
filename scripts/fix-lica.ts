import { prisma } from '../lib/db';
async function run() {
  const bad = await prisma.contratistaGasto.findMany({ where: { obraNombre: 'LICA' }});
  console.log('LICA rows:', bad.length);
  if (bad.length > 0) {
    await prisma.contratistaGasto.updateMany({ where: { obraNombre: 'LICA' }, data: { obraNombre: 'LUCA' } });
    console.log('Fixed LICA to LUCA');
  }
}
run();
