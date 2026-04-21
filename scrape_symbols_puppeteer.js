const puppeteer = require("puppeteer");
const fs = require("fs");

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    userDataDir: "./session",
    defaultViewport: null
  });

  const page = await browser.newPage();

  console.log("Navigating to shop...");
  await page.goto("https://www.talesrunner.us/site/?page=newshoprenewal", {
    waitUntil: "networkidle2"
  });

  // Check if logged in
  const html = await page.content();
  if (html.includes("ACCOUNT LOGIN")) {
    console.log("❌ Not logged in! Session cookie might be expired or not in ./session.");
    await browser.close();
    return;
  }
  console.log("✅ Logged in successfully.");

  // Find the Symbol menu
  console.log("Extracting menus...");
  const menus = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="menu="]'));
    return links.map(a => {
      const href = a.getAttribute("href");
      const match = href.match(/menu=(\d+)/);
      return match ? { id: match[1], text: a.innerText.trim() } : null;
    }).filter(Boolean);
  });

  let symbolMenuId = null;
  for (const m of menus) {
    if (m.text.toLowerCase().includes("symbol")) {
      symbolMenuId = m.id;
      break;
    }
  }

  if (!symbolMenuId) {
    console.log("❌ Could not find Symbol menu. Menus available:");
    console.log(menus);
    await browser.close();
    return;
  }

  console.log(`✅ Found Symbol menu: ID ${symbolMenuId}`);

  // Now scrape the symbol pages
  let p = 1;
  let allItems = [];
  while (true) {
    const url = `https://www.talesrunner.us/site/?page=newshoprenewal&menu=${symbolMenuId}&sort=last&pagenum=${p}`;
    console.log(`Scraping page ${p}...`);
    await page.goto(url, { waitUntil: "networkidle2" });
    
    const itemsExist = await page.$(".item-wrapper");
    if (!itemsExist) {
        break; // No more items
    }

    const items = await page.evaluate(() => {
      const nodes = document.querySelectorAll(".item-wrapper");
      return Array.from(nodes).map(el => {
        const img = el.querySelector("img")?.src || null;
        const shortName = el.querySelector("p")?.innerText.trim() || null;
        const tooltip = el.getAttribute("data-tooltip");
        let fullName = null;
        let stats = [];

        if (tooltip) {
          const parsed = new DOMParser().parseFromString(tooltip, "text/html");
          fullName = parsed.querySelector("span")?.innerText || null;
          const statBox = parsed.querySelector("div div");
          if (statBox) {
            stats = statBox.innerText
              .split("\n")
              .map(s => s.trim())
              .filter(Boolean)
              .filter(s => !s.toLowerCase().includes("data not found"));
          }
        }
        return {
          shortName,
          fullName,
          image: img,
          stats
        };
      });
    });

    if (items.length === 0) break;
    allItems.push(...items);
    console.log(`  Got ${items.length} items`);
    p++;
  }

  console.log(`🎉 Done scraping symbols! Total: ${allItems.length}`);
  fs.writeFileSync("scraped_symbols.json", JSON.stringify(allItems, null, 2));
  
  // Wait a bit and close
  await new Promise(r => setTimeout(r, 1000));
  await browser.close();
}

run().catch(console.error);
