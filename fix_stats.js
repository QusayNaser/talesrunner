const fs = require('fs');
const data = require('./items_clean.json');
let count = 0;

const mapping = {
  'TR to EXP': "Gain TR's as Bonus EXP",
  'EXP to TR': "Gain EXP's as Bonus TR",
  'Dash Chance upon Obstacle Hit': '1 Dash Chance upon Obstacle Hit',
  'Evade Chance upon Obstacle Hit': '1 Evade Chance upon Obstacle Hit'
};

data.forEach(i => {
  if (!i.stats) return;
  Object.keys(mapping).forEach(oldKey => {
    if (i.stats[oldKey]) {
      i.stats[mapping[oldKey]] = i.stats[oldKey];
      delete i.stats[oldKey];
      count++;
    }
  });
});

console.log('Updated items:', count);
fs.writeFileSync('items_clean.json', JSON.stringify(data, null, 2));
