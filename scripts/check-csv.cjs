const fs = require('fs');
const content = fs.readFileSync('EXPORT/Gastos Membranas jacobo page.csv', 'utf8');
const lines = content.split('\n');

const obras = new Map();
const periodos = new Map();
const contratistas = new Map();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const parts = line.split(',');
  if (parts.length >= 8) {
    const obra = parts[3].trim().replace(/^"|"$/g, '');
    const periodo = parts[4].trim().replace(/^"|"$/g, '');
    const contratista = parts[6].trim().replace(/^"|"$/g, '');
    
    if (obra) obras.set(obra, (obras.get(obra) || 0) + 1);
    if (periodo) periodos.set(periodo, (periodos.get(periodo) || 0) + 1);
    if (contratista) contratistas.set(contratista, (contratistas.get(contratista) || 0) + 1);
  }
}

console.log('--- OBRAS ---');
console.log(Array.from(obras.entries()).sort((a,b) => b[1] - a[1]));
console.log('--- CONTRATISTAS ---');
console.log(Array.from(contratistas.entries()).sort((a,b) => b[1] - a[1]));
