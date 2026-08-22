const fs = require('fs');

let c = fs.readFileSync('app/admin/contratistas/ContratistasSpreadsheetClient.tsx', 'utf-8');

const startStr = 'const columns: ColumnDef<ContratistaGastoItem>[] = useMemo(() => [';
const endStr = '  ], []);';

const startIdx = c.indexOf(startStr);
const endIdx = c.indexOf(endStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newColumns = `const columns: ColumnDef<ContratistaGastoItem>[] = useMemo(() => [
    {
      id: "fecha",
      sortKey: "fecha",
      label: "Fecha",
      render: (row) => (
        <td key="fecha" className="w-[8%] px-2 py-3 font-mono text-[10px] text-muted-foreground truncate">
          {row.fechaFormatted || row.fechaStr}
        </td>
      ),
    },
    {
      id: "obraNombre",
      sortKey: "obraNombre",
      label: "Obra",
      render: (row) => (
        <td key="obraNombre" className="w-[10%] px-2 py-3 text-[10px] font-medium truncate">
          {row.obraNombre}
        </td>
      ),
    },
    {
      id: "periodo",
      sortKey: "periodo",
      label: "Periodo",
      render: (row) => (
        <td key="periodo" className="w-[10%] px-2 py-3 text-[10px] text-muted-foreground truncate">
          {row.periodo}
        </td>
      ),
    },
    {
      id: "trabajoRealizado",
      sortKey: "trabajoRealizado",
      label: "Trabajo Realizado",
      render: (row) => (
        <td key="trabajoRealizado" className="w-[30%] px-2 py-3 text-[10px] text-muted-foreground truncate max-w-[200px]" title={row.trabajoRealizado}>
          {row.trabajoRealizado}
        </td>
      ),
    },
    {
      id: "contratista",
      sortKey: "contratista",
      label: "Contratista",
      render: (row) => (
        <td key="contratista" className="w-[15%] px-2 py-3 text-[10px] font-medium truncate">
          {row.contratista}
        </td>
      ),
    },
    {
      id: "total",
      sortKey: "total",
      label: "Total",
      rightAligned: true,
      render: (row) => (
        <td key="total" className="w-[10%] px-2 py-3 text-right font-mono text-[10px] font-bold text-foreground truncate">
          {formatCurrency(row.total)}
        </td>
      ),
    },
    {
      id: "capturista",
      label: "Capturista",
      render: (row) => (
        <td key="capturista" className="w-[10%] px-2 py-3 text-[10px] text-muted-foreground truncate" title={row.creadoPorNombre}>
          {row.creadoPorNombre}
        </td>
      ),
    }
  ], []);`;
  
  c = c.substring(0, startIdx) + newColumns + c.substring(endIdx + endStr.length);
  
  // also fix visibleColumns to remove capturista default
  c = c.replace(/const \[visibleColumns, setVisibleColumns\] = useState<string\[\]>\(\[[\s\S]*?\]\)/, 
`const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "fecha",
    "obraNombre",
    "periodo",
    "trabajoRealizado",
    "contratista",
    "total"
  ])`);

  // fix excel export inside the button
  const excelExportRegex = /filteredGastos.forEach\(g => \{[\s\S]*?worksheet.addRow\(rowData\)\n\s*\}\)/;
  c = c.replace(excelExportRegex, `filteredGastos.forEach(g => {
                const rowData: Record<string, any> = {}
                columns.filter(c => visibleColumns.includes(c.id)).forEach(c => {
                  if (c.id === "fecha") rowData[c.id] = g.fechaFormatted || g.fechaStr
                  else if (c.id === "obraNombre") rowData[c.id] = g.obraNombre
                  else if (c.id === "periodo") rowData[c.id] = g.periodo
                  else if (c.id === "trabajoRealizado") rowData[c.id] = g.trabajoRealizado
                  else if (c.id === "contratista") rowData[c.id] = g.contratista
                  else if (c.id === "total") rowData[c.id] = g.total
                  else if (c.id === "capturista") rowData[c.id] = g.creadoPorNombre
                })
                worksheet.addRow(rowData)
              })`);

  fs.writeFileSync('app/admin/contratistas/ContratistasSpreadsheetClient.tsx', c);
  console.log("Success");
} else {
  console.log("Could not find columns start or end");
}
