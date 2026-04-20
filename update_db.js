const fs = require('fs');

// Read all data
const itemsCleanStr = fs.readFileSync('items_clean.json', 'utf8');
const itemsClean = JSON.parse(itemsCleanStr);

const itemClassesStr = fs.readFileSync('item_classes.json', 'utf8');
const itemClasses = JSON.parse(itemClassesStr);

const partMappingStr = fs.readFileSync('part_mapping_sample.json', 'utf8');
const partMapping = JSON.parse(partMappingStr);

// Helper to determine the actual part based on the image path if partMapping is missing
function extractPart(imgPath) {
  const parts = imgPath.split('__');
  return parts.length >= 3 ? parts[2] : 'unknown';
}

let updatedCount = 0;
let fixedPartCount = 0;

for (let item of itemsClean) {
  // Add itemClass
  if (itemClasses[item.name]) {
    item.itemClass = itemClasses[item.name];
  } else {
    // Some items might not have a class, or might be named slightly differently
    // We could leave it empty or default
    item.itemClass = 'None';
  }
  
  // Fix part
  const websitePart = partMapping[item.name];
  if (websitePart) {
    // If the website tells us exactly what part it is, we can add it to the item.
    // Currently, script.js uses `item._part = extractPart(item.image);`
    // We can pre-compute the part here instead of relying on the image URL.
    // Let's add a "part" property directly to the JSON so the frontend can use it.
    item.part = websitePart;
  } else {
    // Fallback to the old logic if missing
    item.part = extractPart(item.image);
  }
  
  // We can also check if the extracted part from image differs from the website part
  const extracted = extractPart(item.image);
  if (websitePart && extracted !== websitePart) {
    fixedPartCount++;
  }
  
  updatedCount++;
}

console.log(`Processed ${updatedCount} items.`);
console.log(`Fixed parts for ${fixedPartCount} items where image path differed from category.`);

// Save back to items_clean.json
fs.writeFileSync('items_clean.json', JSON.stringify(itemsClean, null, 2));
console.log('Successfully updated items_clean.json');
