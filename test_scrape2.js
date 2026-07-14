
const fetch = require('node-fetch');
async function testScrape() {
  const res = await fetch('https://github.com/users/SHIKHARCHATURVEDI19/contributions');
  const html = await res.text();
  const tdRegex = /<td[^>]*data-date="([^"]+)"[^>]*id="([^"]+)"/g;
  const toolRegex = /<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]+)<\/tool-tip>/g;
  let toolMap = {};
  let toolMatch;
  while ((toolMatch = toolRegex.exec(html)) !== null) {
      toolMap[toolMatch[1]] = toolMatch[2];
  }
  let dates = [];
  let tdMatch;
  while ((tdMatch = tdRegex.exec(html)) !== null) {
      let date = tdMatch[1];
      let id = tdMatch[2];
      let tooltip = toolMap[id];
      if (tooltip && !tooltip.includes('No contributions')) {
         let countStr = tooltip.split(' ')[0];
         dates.push({ date, count: parseInt(countStr) });
      }
  }
  console.log('Total non-zero days found:', dates.length);
  if (dates.length > 0) {
    console.log('Most recent:', dates[dates.length - 1].date);
  }
}
testScrape();
