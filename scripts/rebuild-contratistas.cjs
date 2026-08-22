const fs = require('fs');

let c = fs.readFileSync('app/admin/gastos/GastosSpreadsheetClient.tsx', 'utf8');

// 1. Rename GastoItem -> ContratistaGastoItem
c = c.replace(/export interface GastoItem \{[\s\S]*?\}/, `export interface ContratistaGastoItem {
  id: string
  fecha: string
  fechaStr: string
  fechaFormatted?: string
  year: number
  obraNombre: string
  periodo: string | null
  trabajoRealizado: string | null
  contratista: string
  total: number
  creadoPorId: string
  creadoPorNombre: string
  createdAt: any
  updatedAt: any
  isDeleted: boolean
}`);

// 2. Rename functions and components
c = c.replace(/GastosSpreadsheetClient/g, 'ContratistasSpreadsheetClient');
c = c.replace(/createGastoFromModule/g, 'createContratistaGastoFromModule');
c = c.replace(/deleteGastoFromModule/g, 'deleteContratistaGastoFromModule');
c = c.replace(/saveCardsObras/g, 'saveContratistaCards');
c = c.replace(/EditGastoDialog/g, 'EditContratistaDialog');

c = c.replace(/import \{ createContratistaGastoFromModule, deleteContratistaGastoFromModule \} from "@\/lib\/actions\/gastos-module"/, 'import { createContratistaGastoFromModule, deleteContratistaGastoFromModule } from "@/lib/actions/contratistas-module"');
c = c.replace(/import \{ saveContratistaCards \} from "@\/lib\/actions\/cards-module"/, 'import { saveContratistaCards } from "@/lib/actions/contratistas-cards"');

// 3. Replace columns
c = c.replace(/const columns: ColumnDef<ContratistaGastoItem>\[\] = \[[\s\S]*?\]\s*const \[visibleColumns/, `const columns: ColumnDef<ContratistaGastoItem>[] = [
    {
      id: "fecha",
      label: "Fecha",
      width: "18%",
      render: (row) => (
        <td key="fecha" className="w-[18%] px-2 py-3 font-medium text-[10px] whitespace-nowrap text-muted-foreground truncate">
          {row.fechaFormatted || row.fechaStr}
        </td>
      ),
    },
    {
      id: "obraNombre",
      label: "Obra",
      width: "25%",
      render: (row) => (
        <td key="obraNombre" className="w-[25%] px-2 py-3 font-semibold text-[10px] text-primary truncate" title={row.obraNombre}>
          {row.obraNombre}
        </td>
      ),
    },
    {
      id: "periodo",
      label: "Periodo",
      width: "15%",
      render: (row) => (
        <td key="periodo" className="w-[15%] px-2 py-3 text-[10px] text-muted-foreground truncate" title={row.periodo || ""}>
          {row.periodo}
        </td>
      ),
    },
    {
      id: "trabajoRealizado",
      label: "Trabajo Realizado",
      width: "45%",
      render: (row) => (
        <td key="trabajoRealizado" className="w-[45%] px-2 py-3 text-[10px] text-muted-foreground truncate" title={row.trabajoRealizado || ""}>
          {row.trabajoRealizado}
        </td>
      ),
    },
    {
      id: "contratista",
      label: "Contratista",
      width: "20%",
      render: (row) => (
        <td key="contratista" className="w-[20%] px-2 py-3 text-[10px] font-medium truncate text-foreground" title={row.contratista}>
          {row.contratista}
        </td>
      ),
    },
    {
      id: "total",
      label: "Total",
      width: "18%",
      render: (row) => (
        <td key="total" className="w-[18%] px-2 py-3 text-right font-semibold text-[11px] text-foreground tabular-nums tracking-tight">
          {formatCurrency(row.total)}
        </td>
      ),
    },
    {
      id: "capturista",
      label: "Capturista",
      width: "15%",
      render: (row) => (
        <td key="capturista" className="w-[15%] px-2 py-3 text-right text-[9px] text-muted-foreground truncate">
          {row.creadoPorNombre}
        </td>
      ),
    },
  ]
  
  const [visibleColumns`);

fs.writeFileSync('app/admin/contratistas/ContratistasSpreadsheetClient.tsx', c);
console.log('Copied and replaced columns');
