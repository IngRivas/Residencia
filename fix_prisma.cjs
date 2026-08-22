const fs = require('fs');

const files = [
  'app/components/ProjectDaysTable.tsx',
  'app/components/ObrasTable.tsx',
  'app/components/ObraActions.tsx',
  'app/components/MemberManager.tsx',
  'app/components/DayExpensesSummary.tsx',
  'app/components/CloseProjectButton.tsx',
  'app/components/CapturaMobileView.tsx',
];

const enums = ['ObraEstado', 'GastoEstado', 'ObraRol'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Replace import { Enum } with import type { Enum }
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+["']@prisma\/client["']/g;
  content = content.replace(importRegex, (match, p1) => {
    changed = true;
    return `import type { ${p1.trim()} } from "@prisma/client"`;
  });

  // Replace Enum.KEY with "KEY"
  enums.forEach(enumName => {
    const enumRegex = new RegExp(enumName + '\\\.([A-Z0-Z_]+)', 'g');
    content = content.replace(enumRegex, (match, p1) => {
      changed = true;
      return '"' + p1 + '"';
    });
  });

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed ' + file);
  }
});
