"use server"

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: string
) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details,
      },
    })
    // Revalidar admin siempre que haya nueva actividad para que el panel principal se actualice
    revalidatePath("/", "layout")
  } catch (error) {
    console.error("Error logging activity:", error)
  }
}

export async function getRecentActivity(limit = 20) {
  try {
    const logs = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: { name: true, email: true, role: { select: { name: true } } },
        },
      },
    })
    return logs
  } catch (error) {
    console.error("Error fetching activity:", error)
    return []
  }
}
