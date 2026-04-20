const axios = require('axios');
const cheerio = require('cheerio');

async function testScrape() {
  try {
    const url = 'https://talesrunner.fandom.com/zh/wiki/%E5%88%86%E9%A1%9E:%E6%99%AE%E9%80%9A%E7%B4%9A%E6%94%B6%E8%97%8F%E5%93%81';
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    });
    const $ = cheerio.load(data);
    const items = [];
    $('.category-page__member-link').each((i, el) => {
      items.push($(el).text().trim());
    });
    console.log(`Found ${items.length} items on the first page.`);
    if (items.length > 0) {
      console.log('Examples:', items.slice(0, 5));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}
testScrape();
