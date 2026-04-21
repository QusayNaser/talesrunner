const puppeteer = require('puppeteer');

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setCookie({ name: 'PHPSESSID', value: 'ob2953o2fgf94lb5qdbs3dckum', domain: 'www.talesrunner.us' });
  
  await page.goto('https://www.talesrunner.us/site/?page=newshoprenewal&menu=17&pagenum=1&sort=last', { waitUntil: 'networkidle2' });
  
  const tooltips = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.item-wrapper')).map(el => {
        return el.getAttribute('data-tooltip');
    }).filter(Boolean);
  });
  
  console.log(tooltips[0]);
  await browser.close();
}
run().catch(console.error);
