const puppeteer = require('puppeteer');

async function testPuppeteer() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Try the "Ordinary" (普通) category
  try {
    await page.goto('https://talesrunner.fandom.com/zh/wiki/%E5%88%86%E9%A1%9E:%E6%99%AE%E9%80%9A%E7%B4%9A%E6%94%B6%E8%97%8F%E5%93%81', { waitUntil: 'networkidle2' });
    
    const items = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.category-page__member-link')).map(el => el.textContent.trim());
    });
    
    console.log(`Successfully scraped ${items.length} items from Ordinary category.`);
    if (items.length > 0) {
      console.log('Sample:', items.slice(0, 5));
    }
  } catch (err) {
    console.error('Puppeteer failed:', err.message);
  } finally {
    await browser.close();
  }
}

testPuppeteer();
