const browser = require('browser-use');
const fs = require('fs');
const https = require('https');
const http = require('http');

const lines = [
  { id: 10050, name: '1号线' },
  { id: 10051, name: '2/8号线' },
  { id: 10052, name: '3号线' },
  { id: 10053, name: '4号线' },
  { id: 10054, name: '5号线' },
  { id: 10055, name: '6号线' },
  { id: 10056, name: '6号线支线' },
  { id: 10057, name: '7号线' },
  { id: 10058, name: '9号线' },
  { id: 10059, name: '10号线' },
  { id: 10060, name: '11号线' },
  { id: 10061, name: '12号线' },
  { id: 10062, name: '13号线' },
  { id: 10063, name: '14号线' },
  { id: 10064, name: '16号线' },
  { id: 10065, name: '20号线' },
];

function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        downloadImage(res.headers.location, filename).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        fs.writeFileSync(filename, Buffer.concat(chunks));
        resolve();
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  await browser.open('https://szmc-intweb.shenzhenmc.com/jimu/10049/#/');
  await new Promise(r => setTimeout(r, 3000));
  
  const allData = {};
  
  for (const line of lines) {
    console.log(`Downloading ${line.name}...`);
    try {
      await browser.open(`https://szmc-intweb.shenzhenmc.com/jimu/${line.id}/`);
      await new Promise(r => setTimeout(r, 2000));
      
      const images = await browser.eval("Array.from(document.querySelectorAll('.long-image-card-container img')).map(img => img.src)");
      
      for (let i = 0; i < images.length; i++) {
        const filename = `data/line_${line.id}_${i + 1}.png`;
        await downloadImage(images[i], filename);
        console.log(`  Downloaded ${filename}`);
      }
      
      allData[line.name] = images.map((_, i) => `line_${line.id}_${i + 1}.png`);
    } catch (error) {
      console.error(`Error downloading ${line.name}:`, error.message);
    }
  }
  
  fs.writeFileSync('data/line_images.json', JSON.stringify(allData, null, 2));
  console.log('Done!');
  await browser.close();
}

main().catch(console.error);
