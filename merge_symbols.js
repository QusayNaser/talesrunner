const fs = require('fs');
const clean = require('./items_clean.json');
const symbols = require('./scraped_symbols.json');

symbols.forEach(item => {
    // Fix image path
    if (item.image) {
        try {
            const urlObj = new URL(item.image);
            const parts = urlObj.pathname.split('/').filter(Boolean);
            const filename = parts.join('__');
            item.image = 'images/' + filename;
        } catch(e) {
            // ignore if not URL
        }
    }
    clean.push(item);
});

fs.writeFileSync('items_clean.json', JSON.stringify(clean, null, 2));
console.log(`Merged ${symbols.length} symbols. New total: ${clean.length} items.`);
