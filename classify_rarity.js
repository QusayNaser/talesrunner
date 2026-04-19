const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

const items = JSON.parse(fs.readFileSync('items_clean.json', 'utf-8'));

async function getCornerColor(imgPath) {
  try {
    const img = await loadImage(imgPath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    // Fill with white first so transparent areas become white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
    
    // Sample corner pixels (inside rounded corners - offset by ~6px)
    const samples = [];
    const off = 6;
    const positions = [
      [off, off], [off+1, off+1], [off+2, off+2],
      [img.width-off, off], [img.width-off-1, off+1],
      [off, img.height-off], [off+1, img.height-off-1],
      [img.width-off, img.height-off],
      // Also sample mid-edges
      [img.width/2, off], [off, img.height/2]
    ];
    
    for (const [x, y] of positions) {
      const px = Math.min(Math.max(Math.floor(x), 0), img.width-1);
      const py = Math.min(Math.max(Math.floor(y), 0), img.height-1);
      const pixel = ctx.getImageData(px, py, 1, 1).data;
      samples.push({ r: pixel[0], g: pixel[1], b: pixel[2] });
    }
    
    // Average
    const avg = { r: 0, g: 0, b: 0 };
    samples.forEach(s => { avg.r += s.r; avg.g += s.g; avg.b += s.b; });
    avg.r = Math.round(avg.r / samples.length);
    avg.g = Math.round(avg.g / samples.length);
    avg.b = Math.round(avg.b / samples.length);
    
    return avg;
  } catch (e) {
    return null;
  }
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function classifyByColor(rgb) {
  if (!rgb) return 'unknown';
  const { r, g, b } = rgb;
  const { h, s, l } = rgbToHsl(r, g, b);
  
  // White/Very light → ordinary
  if (l >= 85) return 'ordinary';
  
  // Very low saturation + light → ordinary
  if (s < 15 && l > 60) return 'ordinary';
  
  // Yellow/Orange/Gold backgrounds → rare (h ~30-60)
  if (h >= 20 && h <= 60 && s > 30 && l > 35) return 'rare';
  
  // Purple range → unique (h ~260-310, medium-high lightness)
  if (h >= 250 && h <= 320 && s > 20 && l >= 25 && l <= 75) return 'unique';
  
  // Red/crimson → legend (h 0-20 or 340-360)
  if ((h <= 20 || h >= 340) && s > 30 && l >= 20 && l <= 75) return 'legend';
  
  // Pink-magenta → could be unique or legend
  if (h >= 300 && h <= 345 && s > 30 && l >= 30) return 'unique';
  
  // Dark blue → prestige (h ~200-260, low lightness)
  if (h >= 190 && h <= 270 && s > 20 && l < 35) return 'prestige';
  
  // Dark with some purple → prestige
  if (l < 25 && s > 15 && h >= 200 && h <= 320) return 'prestige';
  
  // Very dark overall → prestige
  if (l < 20 && s > 10) return 'prestige';
  
  // Gray/medium → ordinary
  if (s < 20) return 'ordinary';
  
  // Green-ish or other bright → rare  
  if (h >= 60 && h <= 180 && l > 40) return 'rare';
  
  return 'ordinary';
}

async function run() {
  let count = 0;
  const rarityCounts = {};
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (item.image.includes('_ef_my')) {
      item.rarity = 'mythic';
    } else {
      const color = await getCornerColor(item.image);
      item.rarity = classifyByColor(color);
    }
    
    rarityCounts[item.rarity] = (rarityCounts[item.rarity] || 0) + 1;
    count++;
    if (count % 1000 === 0) process.stdout.write(`${count}/${items.length}...\n`);
  }
  
  console.log('\nRarity distribution:', JSON.stringify(rarityCounts, null, 2));
  
  // Verify with samples
  for (const rarity of ['ordinary','rare','unique','legend','prestige','mythic']) {
    const sample = items.filter(i => i.rarity === rarity).slice(0, 2);
    console.log(`\n${rarity}:`, sample.map(i => ({ name: i.name, stats: Object.keys(i.stats).length })));
  }
  
  fs.writeFileSync('items_clean.json', JSON.stringify(items, null, 2));
  console.log('\nSaved!');
}

run().catch(console.error);
