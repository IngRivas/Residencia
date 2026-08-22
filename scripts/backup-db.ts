import "dotenv/config"
import { prisma } from "../lib/db"
import fs from "fs"
import path from "path"

async function main() {
  console.log("Starting DB backup...")

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupDir = path.join(process.cwd(), "EXPORT")
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const backupFilePath = path.join(backupDir, `backup_before_migration_${timestamp}.json`)

  const data = {
    timestamp: new Date().toISOString(),
    roles: await prisma.role.findMany(),
    users: await prisma.user.findMany(),
    obras: await prisma.obra.findMany(),
    obraUsers: await prisma.obraUser.findMany(),
    proveedores: await prisma.proveedor.findMany(),
    diasObra: await prisma.diaObra.findMany(),
    gastos: await prisma.gasto.findMany(),
    fotos: await prisma.fotoFactura.findMany(),
  }

  fs.writeFileSync(backupFilePath, JSON.stringify(data, null, 2), "utf8")

  console.log(`Backup successfully saved to: ${backupFilePath}`)
  console.log(`Summary of backed up entities:
  - Roles: ${data.roles.length}
  - Users: ${data.users.length}
  - Obras: ${data.obras.length}
  - ObraUsers: ${data.obraUsers.length}
  - Proveedores: ${data.proveedores.length}
  - DiasObra: ${data.diasObra.length}
  - Gastos: ${data.gastos.length}
  - Fotos: ${data.fotos.length}
  `)
}

main()
  .catch((e) => {
    console.error("Error backing up database:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
