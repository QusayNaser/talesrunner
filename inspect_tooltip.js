const fs = require('fs');
const h = fs.readFileSync('debug_shop.html', 'utf8');

// Find the area around "Item class"
const idx = h.indexOf('Item class');
if (idx >= 0) {
  console.log('=== Context around "Item class" ===');
  console.log(h.substring(Math.max(0, idx - 300), idx + 200));
  console.log('\n');
}

// Find all unique tooltip formats - get first 3
let pos = 0;
for (let i = 0; i < 3; i++) {
  const dtIdx = h.indexOf('data-tooltip=', pos);
  if (dtIdx < 0) break;
  
  // Find the quote after data-tooltip=
  const quoteChar = h[dtIdx + 13]; // " or '
  const endIdx = h.indexOf(quoteChar, dtIdx + 14);
  const tooltip = h.substring(dtIdx + 14, Math.min(endIdx, dtIdx + 2000));
  
  console.log(`\n=== TOOLTIP ${i+1} (starts at ${dtIdx}) ===`);
  console.log(tooltip.substring(0, 1500));
  console.log('=== END ===\n');
  
  pos = endIdx + 1;
}
