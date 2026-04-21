const https = require('https');
https.get('https://www.talesrunner.us/site/?page=newshoprenewal&menu=17&pagenum=1&sort=last', {headers: {Cookie: 'PHPSESSID=ob2953o2fgf94lb5qdbs3dckum'}}, res => {
  let d=''; res.on('data', c=>d+=c);
  res.on('end', () => {
    const parts = d.split('item-wrapper');
    for(let i=1; i<2; i++) {
        const section = parts[i];
        const ts = section.indexOf('data-tooltip="');
        const tt = section.substring(ts+14, section.indexOf('"', ts+14));
        console.log(tt);
    }
  });
});
