const fs = require('fs');
const html = fs.readFileSync('debug_shop.html', 'utf8');
const regex = /.{0,50}Symbol.{0,50}/gi;
let match;
while ((match = regex.exec(html)) !== null) {
  console.log(match[0]);
}
