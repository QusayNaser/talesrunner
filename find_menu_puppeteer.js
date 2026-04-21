const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set the cookie
  await page.setCookie({
    name: 'PHPSESSID',
    value: 'jh3lnkkovclf9eb0fmcc3uvit1',
    domain: 'www.talesrunner.us'
  });
  
  try {
    await page.goto('https://www.talesrunner.us/site/?page=newshoprenewal', { waitUntil: 'networkidle2' });
    
    const menus = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="menu="]'));
      return links.map(a => {
        const href = a.getAttribute('href');
        const match = href.match(/menu=(\d+)/);
        return match ? `${match[1]}: ${a.textContent.trim()}` : null;
      }).filter(Boolean);
    });
    
    console.log("Found menus:");
    console.log([...new Set(menus)].join('\n'));
    
  } catch (err) {
    console.error('Puppeteer failed:', err.message);
  } finally {
    await browser.close();
  }
}

main();
