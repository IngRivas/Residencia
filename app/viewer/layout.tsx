import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import ViewerDock from "@/app/components/ViewerDock"

export default async function ViewerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const user = session.user as any
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    redirect("/admin")
  } else if (user.role === "CAPTURISTA") {
    redirect("/captura")
  } else if (user.role !== "VIEWER") {
    redirect("/403")
  }

  const fullUser = await prisma.user.findUnique({ where: { id: user.id } })
  const initialTextZoom = fullUser?.textZoom || 0

  return (
    <div
      id="viewer-main-content"
      className="flex min-h-screen origin-bottom flex-col bg-background pb-24 font-sans text-foreground"
    >
      <main className="mt-4 w-full flex-1">
        <div className="w-full px-4 py-4 sm:px-6 lg:px-8">{children}</div>
      </main>

      <ViewerDock user={user} initialTextZoom={initialTextZoom} />
    </div>
  )
}
