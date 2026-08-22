import { getRecycleBinItems, cleanupRecycleBin } from "@/lib/actions/papelera"
import { restoreObra, permanentDeleteObra } from "@/lib/actions/obras"
import {
  restoreDiaObraAdmin,
  permanentDeleteDiaObraAdmin,
  restoreExpenseAdmin,
  permanentDeleteExpenseAdmin,
} from "@/lib/actions/gastos"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/formatters"
import PapeleraClient from "./PapeleraClient"

export const dynamic = "force-dynamic"

export default async function PapeleraPage() {
  // Trigger cleanup when the page is loaded to ensure it meets the 7 days limit
  await cleanupRecycleBin()

  const { obras, dias, gastos } = await getRecycleBinItems()

  return (
    <div className="space-y-8">
      <div className="mb-10">
        <h1 className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">
          Papelera de Reciclaje
        </h1>
      </div>

      <PapeleraClient obras={obras} dias={dias} gastos={gastos} />
    </div>
  )
}
