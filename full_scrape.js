const puppeteer = require('puppeteer');
const fs = require('fs');

const categories = require('./categories_output.json');

function parseStats(tooltip) {
  const statsObj = {};
  
  const statMatch = tooltip.match(/\[Stats\][^>]*>.*?<div[^>]*>([\s\S]*?)<\/div>/i) 
                 || tooltip.match(/<div[^>]*max-width[^>]*>([\s\S]*?)<\/div>/i);
  if (!statMatch) return statsObj;
  
  const statText = statMatch[1];
  
  const lines = statText.split(/<br[^>]*>|<\/p>|<\/div>/gi)
      .map(s => s.replace(/<[^>]*>/g, '').trim())
      .filter(s => s && !s.toLowerCase().includes('data not found'));
      
  for (let line of lines) {
      const match = line.match(/^(.+?)\s*([+-]\s*\d+\.?\d*\s*%?|1\s*Dash\s*Chance.+)$/i);
      if (match) {
          let key = match[1].trim();
          let val = match[2].trim().replace(/\s+/g, '');
          
          if (!val.startsWith('+') && !val.startsWith('-')) {
             if (val.match(/^\d/)) val = '+' + val;
          }
          
          statsObj[key] = val;
      } else {
          const match2 = line.match(/^([A-Za-z\s/]+)\s*(\d+\.?\d*\s*%?)$/);
          if (match2) {
              statsObj[match2[1].trim()] = '+' + match2[2].trim().replace(/\s+/g, '');
          }
      }
  }
  
  return statsObj;
}

const cheerio = require('cheerio');

function extractItems(html) {
  const items = [];
  const $ = cheerio.load(html);
  
  $('.item-wrapper').each((i, el) => {
      const tooltip = $(el).attr('data-tooltip');
      if (!tooltip) return;
      
      const imgMatch = $(el).find('img').attr('src');
      let image = imgMatch || null;
      if (image && !image.startsWith('http')) {
          image = image.replace('../../', 'https://www.talesrunner.us/');
      }
      
      // Parse the tooltip string as HTML
      const tooltipDecoded = tooltip.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      const $tooltip = cheerio.load(tooltipDecoded);
      
      const fullName = $tooltip('span').first().text().trim();
      if (!fullName) return;
      
      // Class
      let itemClass = 'None';
      $tooltip('span').each((i, span) => {
          const text = $(span).text().trim();
          if (['Mythology', 'Prestige', 'Legendary', 'Unique', 'Rare'].includes(text)) {
              itemClass = text;
          }
      });
      
      const statsObj = parseStats(tooltipDecoded);
      
      items.push({
        name: fullName,
        image: image,
        stats: statsObj,
        itemClass: itemClass
      });
  });
  
  return items;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    userDataDir: "./session"
  });
  const page = await browser.newPage();
  
  let allScrapedItems = [];
  const scrapedNames = new Set();

  if (fs.existsSync('master_scrape_results.json')) {
      try {
          allScrapedItems = JSON.parse(fs.readFileSync('master_scrape_results.json', 'utf8'));
          allScrapedItems.forEach(item => scrapedNames.add(item.name));
          console.log(`Loaded ${allScrapedItems.length} items from existing master_scrape_results.json`);
      } catch (e) {
          console.log('Could not load existing master_scrape_results.json, starting fresh.');
      }
  }
  
  for (const [baseUrl, menus] of Object.entries(categories)) {
      console.log(`\n\n=== Processing Shop: ${baseUrl} ===`);
      const isMarketplace = baseUrl.includes('Marketplace');
      const paramName = isMarketplace ? 'sub' : 'menu';
      const pageParam = isMarketplace ? 'num' : 'pagenum';
      
      const baseUrlClean = baseUrl.replace(/&(menu|sub|pagenum|num)=[^&]*/g, '');
      
      for (const menu of menus) {
          console.log(`\n=> Menu: ${menu.name} (ID: ${menu.id})`);
          
          for (let p = 1; p <= 300; p++) {
              let url = `${baseUrlClean}&${paramName}=${menu.id}&${pageParam}=${p}`;
              if (!url.includes('sort=')) url += '&sort=last';
              
              await page.goto(url, { waitUntil: "domcontentloaded" });
              
              try {
                  await page.waitForSelector(".item-wrapper", { timeout: 3000 });
              } catch (err) {
                  // If it times out, there are probably no items on this page
              }
              
              const html = await page.content();
              
              if (html.includes('ACCOUNT LOGIN') || html.includes('login_btn')) {
                  console.log('❌ Cookie expired or not logged in. Aborting.');
                  process.exit(1);
              }
              
              const items = extractItems(html);
              if (items.length === 0) {
                  console.log(`Page ${p}: 0 items. Moving to next menu.`);
                  break; // no more items in this menu
              }
              
              let newCount = 0;
              for (const item of items) {
                  if (!scrapedNames.has(item.name)) {
                      scrapedNames.add(item.name);
                      allScrapedItems.push(item);
                      newCount++;
                  }
              }
              
              console.log(`Page ${p}: Scraped ${items.length} items (${newCount} new). Total unique: ${allScrapedItems.length}`);
              
              // Save incrementally
              fs.writeFileSync('master_scrape_results.json', JSON.stringify(allScrapedItems, null, 2));
              
              await new Promise(r => setTimeout(r, 200)); // be nice to the server
          }
      }
  }
  
  console.log(`\n✅ Finished! Scraped ${allScrapedItems.length} unique items across all categories.`);
  
  await browser.close();
})();
