import { Suspense } from "react"
import { getContratistasHistoricos } from "@/lib/contratistas-historicos"
import ContratistasSpreadsheetClient from "./ContratistasSpreadsheetClient"
import { getContratistaCards } from "@/lib/actions/contratistas-cards"

export const dynamic = "force-dynamic"

export default async function AdminContratistasPage() {
  const { gastos, obras, years } = await getContratistasHistoricos()
  const initialCards = await getContratistaCards()

  return (
    <div className="min-h-screen w-full">
      <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando...</div>}>
        <ContratistasSpreadsheetClient
          initialGastos={gastos}
          obras={obras}
          availableYears={years}
          initialCards={initialCards}
        />
      </Suspense>
    </div>
  )
}
