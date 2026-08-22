import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ObraEstado } from "@prisma/client"
import { auth } from "@/auth"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")

    if (!query || query.trim() === "") {
      return NextResponse.json({ obras: [], users: [] })
    }

    const queryUpper = query.toUpperCase()
    const estadoMatch = Object.keys(ObraEstado).includes(queryUpper)
      ? (queryUpper as ObraEstado)
      : undefined

    const whereObra: any = { deletedAt: null }
    if (estadoMatch) {
      whereObra.OR = [
        { nombre: { contains: query, mode: "insensitive" } },
        { estado: estadoMatch },
      ]
    } else {
      whereObra.nombre = { contains: query, mode: "insensitive" }
    }

    const obras = await prisma.obra.findMany({
      where: whereObra,
      select: {
        id: true,
        nombre: true,
        estado: true,
      },
      take: 5,
    })

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          { role: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } },
      },
      take: 5,
    })

    return NextResponse.json({ obras, users })
  } catch (error: any) {
    console.error("Search API Error:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
