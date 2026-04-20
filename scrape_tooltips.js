const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrape() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    // 1. Go to login
    await page.goto('https://www.talesrunner.us/site/?page=login', { waitUntil: 'networkidle2' });
    
    // 2. Fill login form
    await page.type('input[name="username"]', 'QusayNaser');
    await page.type('input[name="password"]', '123258');
    
    // Assuming the login button is a submit button or inside a form
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.keyboard.press('Enter')
    ]);
    
    // 3. Go to shop page
    await page.goto('https://www.talesrunner.us/site/?page=newshoprenewal&menu=18&pagenum=1&sort=last', { waitUntil: 'networkidle2' });
    
    // 4. Extract all data-tooltip attributes
    const tooltips = await page.evaluate(() => {
      const els = document.querySelectorAll('[data-tooltip]');
      return Array.from(els).map(el => el.getAttribute('data-tooltip'));
    });
    
    fs.writeFileSync('shop_tooltips.json', JSON.stringify(tooltips, null, 2));
    console.log(`Saved ${tooltips.length} tooltips`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}
scrape();
