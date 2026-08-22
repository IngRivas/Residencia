import { Suspense } from "react"
import { getGastosHistoricos } from "@/lib/gastos-historicos"
import GastosSpreadsheetClient from "./GastosSpreadsheetClient"
import { getCardsObras } from "@/lib/actions/cards-module"

import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AdminGastosPage() {
  const { gastos, obras, years } = await getGastosHistoricos()
  const initialCards = await getCardsObras()
  
  // Fetch contratista gastos to add to the totals in the cards
  const contratistaGastos = await prisma.contratistaGasto.findMany({
    where: { isDeleted: false },
    select: { obraNombre: true, total: true, trabajoRealizado: true }
  })

  return (
    <div className="min-h-screen w-full">
      <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
        <GastosSpreadsheetClient
          initialGastos={gastos}
          obras={obras}
          availableYears={years}
          initialCards={initialCards}
          contratistaGastos={contratistaGastos}
        />
      </Suspense>
    </div>
  )
}
