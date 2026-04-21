const https = require('https');
const fs = require('fs');

const COOKIE = 'PHPSESSID=ob2953o2fgf94lb5qdbs3dckum';
const BASE = 'https://www.talesrunner.us';

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Cookie': COOKIE,
        'User-Agent': 'Mozilla/5.0'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseStats(tooltip) {
  const statsObj = {};
  
  // Find the div that contains stats
  const statMatch = tooltip.match(/\[Stats\][^>]*>.*?<div[^>]*>([\s\S]*?)<\/div>/i) 
                 || tooltip.match(/<div[^>]*max-width[^>]*>([\s\S]*?)<\/div>/i);
  if (!statMatch) return statsObj;
  
  const statText = statMatch[1];
  
  // Stats are often separated by <br> or just text nodes
  const lines = statText.split(/<br[^>]*>|<\/p>|<\/div>/gi)
      .map(s => s.replace(/<[^>]*>/g, '').trim())
      .filter(s => s && !s.toLowerCase().includes('data not found'));
      
  for (let line of lines) {
      // e.g. "Bonus TR + 150 %" -> key: "Bonus TR", val: "150%"
      // e.g. "Strength + 2" -> key: "Strength", val: "+2"
      // e.g. "Dash Chance upon Obstacle Hit + 5 %"
      const match = line.match(/^(.+?)\s*([+-]\s*\d+\.?\d*\s*%?|1\s*Dash\s*Chance.+)$/i);
      if (match) {
          let key = match[1].trim();
          let val = match[2].trim().replace(/\s+/g, '');
          
          if (!val.startsWith('+') && !val.startsWith('-')) {
             if (val.match(/^\d/)) val = '+' + val;
          }
          
          statsObj[key] = val;
      } else {
          // Alternative regex for missing + sign: "Luck 500%" -> "Luck" "+500%"
          const match2 = line.match(/^([A-Za-z\s/]+)\s*(\d+\.?\d*\s*%?)$/);
          if (match2) {
              statsObj[match2[1].trim()] = '+' + match2[2].trim().replace(/\s+/g, '');
          }
      }
  }
  
  return statsObj;
}

function extractItems(html) {
  const items = [];
  const parts = html.split('item-wrapper');
  for (let i = 1; i < parts.length; i++) {
    const section = parts[i];
    const tooltipStart = section.indexOf('data-tooltip="');
    if (tooltipStart < 0) continue;
    
    const contentStart = tooltipStart + 14;
    const contentEnd = section.indexOf('" data-cf-modified', contentStart);
    const altEnd = section.indexOf('"><', contentStart);
    let end = contentEnd > 0 ? contentEnd : (altEnd > 0 ? altEnd : section.indexOf('">', contentStart));
    
    // Some tooltips might have " inside them if escaped, but usually it's simple
    if (end < 0) continue;
    
    const tooltip = section.substring(contentStart, end);
    
    const nameMatch = tooltip.match(/font-size:18px[^>]*>([^<]+)</);
    const fullName = nameMatch ? nameMatch[1].trim() : null;
    
    const classMatch = tooltip.match(/Item class:<\/span>.*?<span[^>]*>([^<]+)<\/span>/);
    const itemClass = classMatch ? classMatch[1].trim() : 'None';
    
    const imgMatch = section.match(/src="([^"]*itemimage[^"]*)"/);
    let image = imgMatch ? imgMatch[1] : null;
    if (image && !image.startsWith('http')) {
        image = image.replace('../../', 'https://www.talesrunner.us/');
    }
    
    // Parse stats
    const statsObj = parseStats(tooltip);
    
    if (fullName) {
      items.push({
        name: fullName,
        image: image,
        stats: statsObj,
        itemClass: itemClass,
        part: "accsymbol"
      });
    }
  }
  return items;
}

async function main() {
  console.log('Fetching menus...');
  const mainHtml = await fetchPage(`${BASE}/site/?page=newshoprenewal&menu=18&pagenum=1&sort=last`);
  
  if (mainHtml.includes('ACCOUNT LOGIN')) {
      console.log('❌ Cookie expired!');
      return;
  }
  
  const menuRegex = /menu=(\d+)[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  let symbolMenuId = null;
  while ((match = menuRegex.exec(mainHtml)) !== null) {
      const text = match[2].replace(/<[^>]*>/g, '').trim();
      if (text.toLowerCase().includes('symbol')) {
          symbolMenuId = match[1];
          console.log(`✅ Found Symbol menu: ${symbolMenuId} (${text})`);
      }
  }
  
  if (!symbolMenuId) {
      // fallback
      symbolMenuId = '17';
      console.log('Using fallback symbol menu 17');
  }
  
  const allItems = [];
  let p = 1;
  while (true) {
      const url = `${BASE}/site/?page=newshoprenewal&menu=${symbolMenuId}&pagenum=${p}&sort=last`;
      const html = await fetchPage(url);
      const items = extractItems(html);
      
      if (items.length === 0) break;
      allItems.push(...items);
      console.log(`Page ${p}: Scraped ${items.length} items.`);
      p++;
  }
  
  console.log(`Done! Total symbols: ${allItems.length}`);
  fs.writeFileSync('scraped_symbols.json', JSON.stringify(allItems, null, 2));
}

main().catch(console.error);
