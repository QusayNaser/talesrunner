const https = require('https');

const COOKIE = 'PHPSESSID=8n6bgtoqk6ds4iva84p46pnlc2';
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

function extractItems(html) {
  const items = [];
  const parts = html.split('item-wrapper');
  for (let i = 1; i < parts.length; i++) {
    const section = parts[i];
    const tooltipStart = section.indexOf('data-tooltip="');
    if (tooltipStart < 0) continue;
    
    const contentStart = tooltipStart + 14;
    const end = section.indexOf('">', contentStart);
    if (end < 0) continue;
    
    const tooltip = section.substring(contentStart, end);
    const nameMatch = tooltip.match(/font-size:18px[^>]*>([^<]+)</);
    const name = nameMatch ? nameMatch[1].trim() : null;
    
    if (name) {
      items.push({ name });
    }
  }
  return items;
}

async function main() {
  for (let i = 1; i <= 30; i++) {
    if (i === 18) continue; // Skip ALL
    const url = `${BASE}/site/?page=newshoprenewal&menu=${i}&pagenum=1&sort=last`;
    const html = await fetchPage(url);
    if (html.includes('ACCOUNT LOGIN')) {
        console.log(`Menu ${i}: ERROR Cookie Expired!`);
        return;
    }
    const items = extractItems(html);
    if (items.length > 0) {
      console.log(`Menu ${i}: ${items.length} items on page 1. First item: ${items[0].name}`);
    } else {
        // console.log(`Menu ${i}: Empty`);
    }
  }
}

main().catch(console.error);
