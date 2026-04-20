const puppeteer = require('puppeteer');
const fs = require('fs');

const categories = [
  { id: 'ordinary', url: 'https://talesrunner.fandom.com/zh/wiki/%E5%88%86%E9%A1%9E:%E6%99%AE%E9%80%9A%E7%B4%9A%E6%94%B6%E8%97%8F%E5%93%81' },
  { id: 'rare', url: 'https://talesrunner.fandom.com/zh/wiki/%E5%88%86%E9%A1%9E:%E7%A8%80%E6%9C%89%E7%B4%9A%E6%94%B6%E8%97%8F%E5%93%81' },
  { id: 'unique', url: 'https://talesrunner.fandom.com/zh/wiki/%E5%88%86%E9%A1%9E:%E7%8D%A8%E7%89%B9%E7%B4%9A%E6%94%B6%E8%97%8F%E5%93%81' },
  { id: 'legend', url: 'https://talesrunner.fandom.com/zh/wiki/%E5%88%86%E9%A1%9E:%E5%82%B3%E8%AA%AA%E7%B4%9A%E6%94%B6%E8%97%8F%E5%93%81' },
  { id: 'prestige', url: 'https://talesrunner.fandom.com/zh/wiki/%E5%88%86%E9%A1%9E:%E5%A8%81%E6%9C%9B%E7%B4%9A%E6%94%B6%E8%97%8F%E5%93%81' },
  { id: 'mythic', url: 'https://talesrunner.fandom.com/zh/wiki/%E5%88%86%E9%A1%9E:%E7%A5%9E%E8%A9%B1%E8%A3%9D%E5%82%99' }
];

async function scrapeCategory(page, startUrl) {
  let allItems = [];
  let currentUrl = startUrl;

  while (currentUrl) {
    console.log(`Navigating to: ${currentUrl}`);
    await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait a brief moment for dynamic scripts if any
    await new Promise(r => setTimeout(r, 2000));

    const data = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.category-page__member-link'))
                         .map(el => el.textContent.trim());
      
      const nextBtn = document.querySelector('.category-page__pagination-next');
      const nextUrl = nextBtn ? nextBtn.href : null;
      
      return { items, nextUrl };
    });

    allItems = allItems.concat(data.items);
    currentUrl = data.nextUrl;
  }
  
  return allItems;
}

async function run() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  const results = {};

  try {
    for (const cat of categories) {
      console.log(`=== Scraping ${cat.id} ===`);
      const items = await scrapeCategory(page, cat.url);
      console.log(`Found ${items.length} items for ${cat.id}`);
      results[cat.id] = items;
    }

    fs.writeFileSync('wiki_rarities.json', JSON.stringify(results, null, 2));
    console.log('Finished scraping! Saved to wiki_rarities.json');
  } catch (err) {
    console.error('Scraping error:', err);
  } finally {
    await browser.close();
  }
}

run();
