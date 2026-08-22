const fs = require('fs');
const content = fs.readFileSync('EXPORT/Gastos Membranas jacobo page.csv', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  const parts = line.split(',');
  if (parts.length >= 8) {
    const contratista = parts[6].trim().replace(/^"|"$/g, '');
    const obra = parts[3].trim().replace(/^"|"$/g, '');
    if (contratista === 'REFUERZO' || contratista === 'CAPILLA' || obra === 'LICA') {
      console.log('Row ' + i + ':', line);
    }
  }
}
