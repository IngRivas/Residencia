import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
  adapter: PrismaPg | undefined
}

const connectionString = process.env.DATABASE_URL

if (!globalForPrisma.pool) {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 15000,
  })

  // Capturador de errores para evitar que caídas de conexiones inactivas en Neon tiren la app
  pool.on("error", (err) => {
    console.error("Neon/PostgreSQL Pool Error (recuperando):", err.message)
  })

  globalForPrisma.pool = pool
  globalForPrisma.adapter = new PrismaPg(pool)
  globalForPrisma.prisma = new PrismaClient({
    adapter: globalForPrisma.adapter,
  })
}

export const pool = globalForPrisma.pool!
export const adapter = globalForPrisma.adapter!
export const prisma = globalForPrisma.prisma!

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
  globalForPrisma.pool = pool
  globalForPrisma.adapter = adapter
}
