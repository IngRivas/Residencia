import { PrismaClient } from '@prisma/client'
import { createGastoFromModule, editGastoFromModule, deleteGastoFromModule } from './lib/actions/gastos-module'

const prisma = new PrismaClient()

async function run() {
  console.log('--- TEST CREATE ---')
  const createRes = await createGastoFromModule({
    obraId: 'test-obra',
    fechaStr: '2026-07-27',
    concepto: 'Test Concept',
    proveedor: 'Test Provider',
    categoria: 'Pza',
    subtotal: 100,
    porcentajeIVA: 16,
    notaCapturista: 'Initial Note'
  })
  console.log('Create result:', createRes)
  
  if (!createRes.success) return;
  
  // Find the created gasto
  const gasto = await prisma.spreadsheetGasto.findFirst({
    where: { concepto: 'Test Concept' },
    orderBy: { createdAt: 'desc' }
  })
  
  if (!gasto) {
    console.log('Could not find created gasto in DB')
    return
  }
  console.log('Created Gasto ID:', gasto.id)
  console.log('Gasto Subtotal:', gasto.subtotal)
  
  console.log('--- TEST EDIT ---')
  const editRes = await editGastoFromModule(gasto.id, {
    obraId: 'test-obra-edited',
    fechaStr: '2026-07-28',
    concepto: 'Test Concept Edited',
    proveedor: 'Test Provider Edited',
    categoria: 'Kg',
    subtotal: 200,
    porcentajeIVA: 8,
    notaCapturista: 'Edited Note'
  })
  console.log('Edit result:', editRes)
  
  const editedGasto = await prisma.spreadsheetGasto.findUnique({
    where: { id: gasto.id }
  })
  console.log('Edited Gasto Subtotal:', editedGasto?.subtotal)
  console.log('Edited Gasto Concepto:', editedGasto?.concepto)
  
  console.log('--- TEST DELETE ---')
  const delRes = await deleteGastoFromModule(gasto.id)
  console.log('Delete result:', delRes)
  
  const deletedGasto = await prisma.spreadsheetGasto.findUnique({
    where: { id: gasto.id }
  })
  console.log('Deleted Gasto isDeleted flag:', deletedGasto?.isDeleted)
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
