// Renders the social preview card and the PNG icons from tools/templates.
// Needs a local server at the repo root (python3 -m http.server 8000) and
// Playwright:  node tools/render-og.js [http://localhost:8000]
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:8000').replace(/\/$/, '');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(base + '/tools/templates/og.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'assets/img/og.jpg', type: 'jpeg', quality: 86 });
  for (const [size, file] of [[180, 'assets/img/apple-touch-icon.png'], [32, 'assets/img/favicon-32.png']]) {
    await page.setViewportSize({ width: size, height: size });
    await page.goto(base + '/tools/templates/icon.html', { waitUntil: 'networkidle' });
    await page.screenshot({ path: file });
  }
  await browser.close();
  console.log('Wrote assets/img/og.jpg, apple-touch-icon.png and favicon-32.png');
})();
