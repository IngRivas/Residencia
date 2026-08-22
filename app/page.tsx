import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"

export default async function Home() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const userRole = (session.user as any).role?.toUpperCase() || ""
  const userId = session.user.id

  if (userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "ADMINISTRADOR") {
    redirect("/admin")
  }

  if (userRole === "CAPTURISTA") {
    // Fetch assigned active projects
    const memberships = await prisma.obraUser.findMany({
      where: {
        userId,
        rol: "CAPTURISTA",
        obra: {
          estado: "ACTIVA",
        },
      },
      include: {
        obra: true,
      },
      orderBy: {
        obra: {
          nombre: "asc",
        },
      },
    })

    if (memberships.length === 1) {
      redirect(`/captura/${memberships[0].obraId}`)
    } else {
      redirect("/captura")
    }
  }

  if (userRole === "VIEWER") {
    redirect("/viewer")
  }

  // Fallback
  redirect("/403")
}
