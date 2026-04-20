/**
 * Scrape item classes from talesrunner.us shop
 * Tooltip format: <span style='font-size:18px'>ITEM_NAME</span>
 * Item class: <span style='...color:gold'>CLASS_NAME</span>
 */
const https = require('https');
const fs = require('fs');

const COOKIE = 'PHPSESSID=jh3lnkkovclf9eb0fmcc3uvit1';
const BASE = 'https://www.talesrunner.us';

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Cookie': COOKIE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractItems(html) {
  const items = [];
  
  // Split by item-wrapper to get each item card
  const parts = html.split('item-wrapper');
  
  for (let i = 1; i < parts.length; i++) {
    const section = parts[i];
    
    // Get tooltip content (between data-tooltip=" and the closing ")
    const tooltipStart = section.indexOf('data-tooltip="');
    if (tooltipStart < 0) continue;
    
    const contentStart = tooltipStart + 14;
    const contentEnd = section.indexOf('" data-cf-modified', contentStart);
    const altEnd = section.indexOf('"><', contentStart);
    const end = contentEnd > 0 ? contentEnd : (altEnd > 0 ? altEnd : section.indexOf('">', contentStart));
    if (end < 0) continue;
    
    const tooltip = section.substring(contentStart, end);
    
    // Extract name: <span style='font-size:18px'>NAME</span>
    const nameMatch = tooltip.match(/font-size:18px[^>]*>([^<]+)</);
    const name = nameMatch ? nameMatch[1].trim() : null;
    
    // Extract item class: Item class:</span><br><span style='...'>CLASS</span>
    const classMatch = tooltip.match(/Item class:<\/span>.*?<span[^>]*>([^<]+)<\/span>/);
    const itemClass = classMatch ? classMatch[1].trim() : null;
    
    // Extract image URL from the card body (not tooltip)
    const imgMatch = section.match(/src="([^"]*itemimage[^"]*)"/);
    const image = imgMatch ? imgMatch[1] : null;
    
    if (name) {
      items.push({ name, itemClass, image });
    }
  }
  
  return items;
}

// Also extract category menu info
function extractMenus(html) {
  const menus = {};
  const menuRegex = /menu=(\d+)&[^"']*["'][^>]*>[\s\S]*?<\/a>/g;
  let match;
  while ((match = menuRegex.exec(html)) !== null) {
    const id = match[1];
    const text = match[0].replace(/<[^>]*>/g, '').trim();
    if (text && !menus[id]) menus[id] = text;
  }
  return menus;
}

async function scrapeCategory(menuId, menuName) {
  console.log(`\nScraping category: ${menuName} (menu=${menuId})...`);
  
  // Get first page to find total items
  const page1Url = `${BASE}/site/?page=newshoprenewal&menu=${menuId}&pagenum=1&sort=last`;
  const page1Html = await fetchPage(page1Url);
  
  const totalMatch = page1Html.match(/Available Items?\s*:\s*([\d,]+)/i);
  const total = totalMatch ? parseInt(totalMatch[1].replace(/,/g, '')) : 0;
  
  const page1Items = extractItems(page1Html);
  const perPage = page1Items.length || 80;
  const totalPages = Math.ceil(total / perPage);
  
  console.log(`  Total: ${total} items, ${totalPages} pages, ${page1Items.length} on page 1`);
  
  const allItems = [...page1Items];
  
  // Scrape remaining pages in batches
  const BATCH = 5;
  for (let i = 2; i <= totalPages; i += BATCH) {
    const promises = [];
    for (let j = i; j < Math.min(i + BATCH, totalPages + 1); j++) {
      const url = `${BASE}/site/?page=newshoprenewal&menu=${menuId}&pagenum=${j}&sort=last`;
      promises.push(fetchPage(url).then(html => extractItems(html)));
    }
    const results = await Promise.all(promises);
    results.forEach(items => allItems.push(...items));
    
    const progress = Math.min(i + BATCH - 1, totalPages);
    process.stdout.write(`\r  Pages ${i}-${progress}/${totalPages} (${allItems.length} items)`);
  }
  
  if (totalPages > 1) console.log('');
  console.log(`  Extracted ${allItems.length} items from ${menuName}`);
  return allItems;
}

async function main() {
  console.log('Testing connection...');
  const testHtml = await fetchPage(`${BASE}/site/?page=newshoprenewal&menu=18&pagenum=1&sort=last`);
  
  if (testHtml.includes('ACCOUNT LOGIN')) {
    console.log('ERROR: Not logged in! Cookie expired.');
    return;
  }
  
  // Category mapping: menu ID -> our part name
  // From the browse menu we found earlier
  const categories = {
    '18': 'all',      // ALL items
  };
  
  // Scrape ALL items from menu=18 (which has everything)
  const allItems = await scrapeCategory('18', 'ALL');
  
  // Build the classes map
  const itemClasses = {};
  let withClass = 0, withoutClass = 0;
  
  allItems.forEach(item => {
    if (item.itemClass) {
      itemClasses[item.name] = item.itemClass;
      withClass++;
    } else {
      itemClasses[item.name] = null;
      withoutClass++;
    }
  });
  
  console.log(`\n=== RESULTS ===`);
  console.log(`Total items extracted: ${allItems.length}`);
  console.log(`With item class: ${withClass}`);
  console.log(`Without item class: ${withoutClass}`);
  
  // Class distribution
  const dist = {};
  Object.values(itemClasses).forEach(c => {
    const key = c || 'None';
    dist[key] = (dist[key] || 0) + 1;
  });
  console.log('\nClass distribution:', JSON.stringify(dist, null, 2));
  
  // Save
  fs.writeFileSync('item_classes.json', JSON.stringify(itemClasses, null, 2));
  console.log('\nSaved to item_classes.json');
  
  // Now also scrape per-category to get part mapping
  console.log('\n\n=== SCRAPING PER CATEGORY FOR PART MAPPING ===');
  const categoryMenus = {
    '23': 'character',    // CHARACTERS
    '5': 'acchead',       // Heads (head accessories)
    '1': 'head',          // Hairs
    '6': 'accface',       // Face
    '9': 'accneck',       // Necks
    '2': 'topbody',       // Tops
    '3': 'downbody',      // Bottoms
    '7': 'acchand',       // Hands
    '12': 'accwrist',     // Bracelets
    '4': 'foot',          // Shoes
    '13': 'accbooster',   // Boosters & Charms
    '10': 'pet',          // Pets
    '11': 'expansion',    // SPECIAL
    '8': 'accback',       // Backs (wings)
    '14': 'acctail',      // Tails
    '16': 'etc',          // Others
    '20': 'object',       // Farm
  };
  
  const partMapping = {}; // item name -> part
  
  for (const [menuId, partName] of Object.entries(categoryMenus)) {
    const url = `${BASE}/site/?page=newshoprenewal&menu=${menuId}&pagenum=1&sort=last`;
    const html = await fetchPage(url);
    const items = extractItems(html);
    
    const totalMatch = html.match(/Available Items?\s*:\s*([\d,]+)/i);
    const total = totalMatch ? parseInt(totalMatch[1].replace(/,/g, '')) : items.length;
    
    console.log(`  menu=${menuId} (${partName}): ${total} items`);
    
    // Just record the part for items on page 1 (we'll verify mapping)
    items.forEach(item => {
      partMapping[item.name] = partName;
    });
  }
  
  fs.writeFileSync('part_mapping_sample.json', JSON.stringify(partMapping, null, 2));
  console.log('\nSaved part_mapping_sample.json');
}

main().catch(console.error);
