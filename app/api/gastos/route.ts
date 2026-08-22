import { prisma } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const diaObraId = searchParams.get("diaObraId")

  if (!diaObraId) {
    return new NextResponse("Missing diaObraId", { status: 400 })
  }

  try {
    const gastos = await prisma.gasto.findMany({
      where: {
        diaObraId,
        deletedAt: null,
      },
      include: {
        fotos: true,
        creadoPor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: { select: { name: true } },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(gastos)
  } catch (err) {
    console.error(err)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
