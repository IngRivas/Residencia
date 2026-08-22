const fs = require('fs');
let c = fs.readFileSync('app/admin/contratistas/ContratistasSpreadsheetClient.tsx', 'utf-8');

c = c.replace(/export interface ContratistaGastoItem \{[\s\S]*?\}\n/, `export interface ContratistaGastoItem {
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
}
`);

fs.writeFileSync('app/admin/contratistas/ContratistasSpreadsheetClient.tsx', c);
console.log("Success");
