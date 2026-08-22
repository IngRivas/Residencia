import { prisma } from "../lib/db"

async function main() {
  console.log("Borrando todos los logs de actividad...")
  const result = await prisma.activityLog.deleteMany()
  console.log(
    `Se han eliminado ${result.count} logs de actividad exitosamente.`
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
