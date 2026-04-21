const https = require('https');
const fs = require('fs');
const COOKIE = 'PHPSESSID=jh3lnkkovclf9eb0fmcc3uvit1';
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

async function main() {
  const html = await fetchPage(`${BASE}/site/?page=newshoprenewal&menu=18&pagenum=1&sort=last`);
  fs.writeFileSync('debug_shop.html', html);
  
  const menuRegex = /menu=(\d+)[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = menuRegex.exec(html)) !== null) {
      console.log(`menu=${match[1]}: ${match[2].replace(/<[^>]*>/g, '').trim()}`);
  }
}
main();
