const fs = require('fs');

const masterPath = 'master_scrape_results.json';
const targetPath = 'items_clean.json';

if (!fs.existsSync(masterPath)) {
    console.log('Error: master_scrape_results.json not found. Did the scrape finish?');
    process.exit(1);
}

const masterItems = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
const cleanItems = JSON.parse(fs.readFileSync(targetPath, 'utf8'));

// Build lookup maps for master scrape items
const masterNameMap = new Map();
const masterImageMap = new Map();

for (const item of masterItems) {
    if (item.name && item.name.trim() !== 'No data') {
        masterNameMap.set(item.name.trim(), item);
    }
    if (item.image) {
        // Use filename only for image map as path might differ slightly
        const imgFile = item.image.split('/').pop();
        masterImageMap.set(imgFile, item);
    }
}

let updatedStatsCount = 0;
let conversionUpdatedCount = 0;
let newItemsCount = 0;

// 1. Update stats for existing items
for (const item of cleanItems) {
    let scrapedMatch = null;
    
    // Try matching by name first
    if (item.name && item.name.trim() !== 'No data') {
        scrapedMatch = masterNameMap.get(item.name.trim());
    }
    
    // Try matching by image filename if no name match or if name is 'No data'
    if (!scrapedMatch && item.image) {
        const imgFile = item.image.split('/').pop();
        scrapedMatch = masterImageMap.get(imgFile);
    }

    if (scrapedMatch) {
        const oldStatsJson = JSON.stringify(item.stats || {});
        const newStatsJson = JSON.stringify(scrapedMatch.stats || {});
        
        if (oldStatsJson !== newStatsJson) {
            // Check if conversion stats changed
            const conversionKeys = ["Gain EXP's as Bonus TR", "Gain TR's as Bonus EXP"];
            let conversionChanged = false;
            conversionKeys.forEach(k => {
                if ((item.stats[k] || null) !== (scrapedMatch.stats[k] || null)) {
                    conversionChanged = true;
                }
            });
            
            if (conversionChanged) conversionUpdatedCount++;
            
            item.stats = scrapedMatch.stats;
            if (item.name === 'No data' && scrapedMatch.name !== 'No data') {
                item.name = scrapedMatch.name;
            }
            if (item.itemClass === 'None' && scrapedMatch.itemClass !== 'None') {
                item.itemClass = scrapedMatch.itemClass;
            }
            updatedStatsCount++;
        }
        
        // Remove from maps to isolate truly "new" items
        if (scrapedMatch.name) masterNameMap.delete(scrapedMatch.name);
        const imgFile = scrapedMatch.image.split('/').pop();
        masterImageMap.delete(imgFile);
    }
}

// 2. Add remaining missing items
for (const [name, newItem] of masterNameMap.entries()) {
    cleanItems.push(newItem);
    newItemsCount++;
}

fs.writeFileSync(targetPath, JSON.stringify(cleanItems, null, 2));

console.log(`✅ Merge Complete!`);
console.log(`- Updated/Corrected stats for ${updatedStatsCount} items.`);
console.log(`  (Specifically fixed conversion stats for ${conversionUpdatedCount} items)`);
console.log(`- Added ${newItemsCount} completely new items.`);
