import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import MemberManager from "@/app/components/MemberManager"
import { ChevronLeftIcon } from "lucide-react"

export const dynamic = "force-dynamic"

interface MiembrosPageProps {
  params: Promise<{ id: string }>
}

export default async function MiembrosPage({ params }: MiembrosPageProps) {
  const { id } = await params

  const [obra, availableUsers] = await Promise.all([
    prisma.obra.findFirst({
      where: { id, deletedAt: null },
      include: {
        miembros: {
          include: {
            user: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } },
      },
    }),
  ])

  if (!obra) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <Link
            href={`/admin/obras/${obra.id}`}
            className="rounded-full p-2 transition-colors hover:bg-muted"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
          <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            Gestión de Miembros
          </h1>
        </div>
        <p className="text-muted-foreground">
          Asigna usuarios y roles a la obra <strong>{obra.nombre}</strong>
        </p>
      </div>

      <Card className="border-border bg-card p-6 shadow-sm">
        <MemberManager
          obraId={obra.id}
          availableUsers={availableUsers}
          miembros={obra.miembros.map((m) => ({
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            rol: m.rol,
          }))}
        />
      </Card>
    </div>
  )
}
