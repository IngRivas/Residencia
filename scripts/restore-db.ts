import "dotenv/config"
import { prisma } from "../lib/db"
import fs from "fs"
import path from "path"

async function main() {
  console.log("Restoring DB to pre-migration backup state...")

  const backupPath = path.join(
    process.cwd(),
    "EXPORT",
    "backup_before_migration_2026-07-23T19-49-32-443Z.json"
  )

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found at: ${backupPath}`)
  }

  const raw = fs.readFileSync(backupPath, "utf8")
  const backup = JSON.parse(raw)

  console.log("Clearing current tables...")
  // Clear tables in reverse dependency order
  await prisma.fotoFactura.deleteMany()
  await prisma.gasto.deleteMany()
  await prisma.diaObra.deleteMany()
  await prisma.obraUser.deleteMany()
  await prisma.obra.deleteMany()
  await prisma.proveedor.deleteMany()

  // Remove Sistema user if created
  await prisma.user.deleteMany({
    where: {
      email: "sistema@spend.local",
    },
  })

  console.log("Restoring original entities from backup...")

  // Restore Proveedores
  if (backup.proveedores && backup.proveedores.length > 0) {
    for (const p of backup.proveedores) {
      await prisma.proveedor.create({
        data: {
          id: p.id,
          nombre: p.nombre,
          rfc: p.rfc || null,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
        },
      })
    }
  }

  // Restore Obras
  if (backup.obras && backup.obras.length > 0) {
    for (const o of backup.obras) {
      await prisma.obra.create({
        data: {
          id: o.id,
          nombre: o.nombre,
          presupuestoTotal: o.presupuestoTotal,
          estado: o.estado,
          creadoPorId: o.creadoPorId || null,
          createdAt: new Date(o.createdAt),
          updatedAt: new Date(o.updatedAt),
          deletedAt: o.deletedAt ? new Date(o.deletedAt) : null,
        },
      })
    }
  }

  // Restore ObraUsers
  if (backup.obraUsers && backup.obraUsers.length > 0) {
    for (const ou of backup.obraUsers) {
      await prisma.obraUser.create({
        data: {
          id: ou.id,
          obraId: ou.obraId,
          userId: ou.userId,
          rol: ou.rol,
        },
      })
    }
  }

  // Restore DiasObra
  if (backup.diasObra && backup.diasObra.length > 0) {
    for (const d of backup.diasObra) {
      await prisma.diaObra.create({
        data: {
          id: d.id,
          obraId: d.obraId,
          fecha: new Date(d.fecha),
          presupuestoDiario: d.presupuestoDiario,
          reposicion: d.reposicion || 0,
          createdAt: new Date(d.createdAt),
          deletedAt: d.deletedAt ? new Date(d.deletedAt) : null,
        },
      })
    }
  }

  // Restore Gastos
  if (backup.gastos && backup.gastos.length > 0) {
    for (const g of backup.gastos) {
      await prisma.gasto.create({
        data: {
          id: g.id,
          diaObraId: g.diaObraId,
          concepto: g.concepto,
          proveedor: g.proveedor,
          porcentajeIVA: g.porcentajeIVA,
          subtotal: g.subtotal,
          iva: g.iva,
          total: g.total,
          notaCapturista: g.notaCapturista || null,
          notaAdmin: g.notaAdmin || null,
          categoria: g.categoria || null,
          isImprevisto: g.isImprevisto || false,
          noAfectaPresupuesto: g.noAfectaPresupuesto || false,
          estado: g.estado,
          creadoPorId: g.creadoPorId || null,
          createdAt: new Date(g.createdAt),
          deletedAt: g.deletedAt ? new Date(g.deletedAt) : null,
        },
      })
    }
  }

  // Restore Fotos
  if (backup.fotos && backup.fotos.length > 0) {
    for (const f of backup.fotos) {
      await prisma.fotoFactura.create({
        data: {
          id: f.id,
          gastoId: f.gastoId,
          url: f.url,
          publicId: f.publicId,
        },
      })
    }
  }

  console.log("Database successfully restored to exact pre-migration state!")
}

main()
  .catch((e) => {
    console.error("Restore error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
