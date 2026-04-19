const puppeteer = require("puppeteer");
const fs = require("fs");

const BASE_URL = "https://www.talesrunner.us/site/?page=newshoprenewal&menu=18&sort=last&pagenum=";

async function run() {
  const browser = await puppeteer.launch({
    headless: false, // IMPORTANT (so you can login)
    userDataDir: "./session", // saves login
    defaultViewport: null
  });

  const page = await browser.newPage();

  // 1. Open site and wait for manual login
  await page.goto("https://www.talesrunner.us/site/", {
    waitUntil: "networkidle2"
  });

  console.log("👉 Login manually in the opened browser.");
  console.log("👉 When done, press ENTER here...");

  await new Promise(resolve => process.stdin.once("data", resolve));

  // 2. Start scraping
  let allItems = [];

  for (let p = 1; p <= 152; p++) {
    const url = BASE_URL + p;

    console.log("Scraping page", p);

    await page.goto(url, { waitUntil: "networkidle2" });

    // wait for items (important)
    await page.waitForSelector(".item-wrapper", { timeout: 10000 }).catch(() => {
      console.log("⚠️ No items found on page", p);
      return;
    });

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

    console.log(`✅ Page ${p}: ${items.length} items`);

    allItems.push(...items);

    // small delay (avoid blocking)
    await new Promise(r => setTimeout(r, 500));
  }

  // 3. Save results
  fs.writeFileSync("items.json", JSON.stringify(allItems, null, 2));

  console.log("🎉 DONE. Total items:", allItems.length);

  // browser stays open so you can reuse session
}

run();