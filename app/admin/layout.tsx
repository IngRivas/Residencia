import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import AdminDock from "@/app/components/AdminDock"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const user = session.user as any
  const userRole = user.role?.toUpperCase() || ""
  if (userRole === "VIEWER") {
    redirect("/viewer")
  } else if (userRole === "CAPTURISTA") {
    redirect("/captura")
  } else if (userRole !== "SUPER_ADMIN" && userRole !== "ADMIN" && userRole !== "ADMINISTRADOR") {
    redirect("/403")
  }

  const fullUser = await prisma.user.findUnique({ where: { id: user.id } })
  const initialTextZoom = fullUser?.textZoom || 0

  return (
    <div
      id="admin-main-content"
      className="flex min-h-screen origin-bottom flex-col bg-background pb-24 font-sans text-foreground"
    >
      <main className="mt-4 w-full flex-1">
        <div className="w-full px-4 py-4 sm:px-6 lg:px-8">{children}</div>
      </main>

      <AdminDock
        role={user.role}
        user={user}
        initialTextZoom={initialTextZoom}
      />
    </div>
  )
}
