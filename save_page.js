const https = require('https');
const fs = require('fs');

const COOKIE = 'PHPSESSID=jh3lnkkovclf9eb0fmcc3uvit1';

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

async function main() {
  const html = await fetchPage('https://www.talesrunner.us/site/?page=newshoprenewal&menu=18&pagenum=1&sort=last');
  fs.writeFileSync('debug_shop.html', html);
  console.log('Saved! Length:', html.length);
  
  // Search for tooltip patterns
  console.log('\nSearching for patterns...');
  const patterns = [
    'data-tooltip', 'Item class', 'item-class', 'itemclass',
    'tooltipped', 'material-tooltip', 'tooltip-content',
    'Mythology', 'Prestige', 'Legendary', 'Unique',
    'card-content', 'card-image', 'card-action',
    'Old Price', 'New Price', 'Unlock'
  ];
  
  patterns.forEach(p => {
    const count = (html.match(new RegExp(p, 'gi')) || []).length;
    if (count > 0) console.log(`  "${p}": ${count} occurrences`);
  });
  
  // Find sections around "Unlock"  
  const unlockIdx = html.indexOf('Unlock');
  if (unlockIdx >= 0) {
    console.log('\n--- Around "Unlock" ---');
    console.log(html.substring(Math.max(0, unlockIdx - 2000), unlockIdx + 200));
  }
  
  // Find tooltipped elements
  const tipIdx = html.indexOf('tooltipped');
  if (tipIdx >= 0) {
    console.log('\n--- Around "tooltipped" ---');
    console.log(html.substring(Math.max(0, tipIdx - 200), tipIdx + 1500));
  }
}

main().catch(console.error);
