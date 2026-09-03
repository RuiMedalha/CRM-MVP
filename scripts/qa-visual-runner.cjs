const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DIRECTUS_TOKEN = '26p4fEMFaSZ6N15Br649mMSGkSmkofJo';
const BASE_URL = 'http://localhost:8080';

const PAGES = [
  { name: 'dashboard', url: '/', key: 'dashboard' },
  { name: 'leads', url: '/leads', key: 'leads' },
  { name: 'relatorios', url: '/relatorios', key: 'relatorios' },
  { name: 'inbox', url: '/inbox', key: 'inbox' },
  { name: 'customer360', url: '/customer360/1', key: 'customer360' },
  { name: 'definicoes-ia-providers', url: '/definicoes/ia-providers', key: 'ia-providers' },
  { name: 'definicoes-aparencia', url: '/definicoes/aparencia', key: 'aparencia' },
  { name: 'definicoes-whatsapp', url: '/definicoes/whatsapp', key: 'whatsapp' },
  { name: 'pipelines', url: '/pipelines', key: 'pipelines' },
];

async function runAudit() {
  const screenshotsDir = path.join(process.cwd(), 'docs', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  // Set auth token in localStorage
  await page.goto(BASE_URL + '/auth');
  await page.evaluate((token) => {
    localStorage.setItem('directus_access_token', token);
    localStorage.setItem('directus_user_email', 'crm@hotelequip.pt');
  }, DIRECTUS_TOKEN);

  const results = [];

  for (const p of PAGES) {
    const consoleLogs = { error: [], warning: [], log: [] };
    const onConsole = msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') consoleLogs.error.push(text);
      else if (type === 'warning') consoleLogs.warning.push(text);
    };
    const onPageError = err => {
      consoleLogs.error.push('PageError: ' + err.message);
    };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    console.log('\nNavigating to ' + p.name + ' (' + p.url + ')...');
    let finalUrl = '';
    let status = 'PASS';
    let notes = [];

    try {
      await page.goto(BASE_URL + p.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000); // allow react state & charts to settle
      finalUrl = page.url();

      const pageTitle = await page.title();
      const bodyText = await page.evaluate(() => document.body.innerText);

      // Check if 404 or redirect to auth
      if (finalUrl.includes('/auth')) {
        status = 'FAIL';
        notes.push('Redirected to /auth (Authentication failed/required)');
      } else if (bodyText.includes('404') || bodyText.includes('Página não encontrada') || bodyText.includes('Page Not Found') || bodyText.includes('Não Encontrado')) {
        status = 'FAIL';
        notes.push('Page rendered 404 / Not Found');
      }

      // Check for visual elements
      const elementSummary = await page.evaluate(() => {
        return {
          h1: Array.from(document.querySelectorAll('h1, h2')).map(el => el.innerText.trim()).filter(Boolean).slice(0, 10),
          buttons: Array.from(document.querySelectorAll('button')).map(el => el.innerText.trim()).filter(Boolean).slice(0, 15),
          hasRecharts: !!document.querySelector('.recharts-responsive-container, .recharts-surface, svg.recharts-surface'),
          hasTable: !!document.querySelector('table, [role="grid"], [role="table"], .virtual-table'),
          tabs: Array.from(document.querySelectorAll('[role="tab"], .tabs-trigger, button[data-state]')).map(el => el.innerText.trim()),
          hasCards: document.querySelectorAll('.card, [class*="Card"], [class*="card"]').length,
          canvasCount: document.querySelectorAll('canvas').length,
          svgCount: document.querySelectorAll('svg').length,
        };
      });

      // Save screenshot in both root and docs/screenshots
      const screenshotFilenameRoot = 'qa-' + p.name + '.png';
      const screenshotFilenameDocs = path.join(screenshotsDir, 'qa-' + p.name + '.png');
      
      await page.screenshot({ path: screenshotFilenameRoot, fullPage: false });
      await page.screenshot({ path: screenshotFilenameDocs, fullPage: false });

      results.push({
        name: p.name,
        requestedUrl: p.url,
        finalUrl,
        pageTitle,
        status,
        notes,
        consoleErrors: consoleLogs.error,
        consoleWarnings: consoleLogs.warning,
        elementSummary,
        screenshotRoot: screenshotFilenameRoot,
        screenshotDocs: screenshotFilenameDocs,
      });

    } catch (err) {
      console.error('Error on ' + p.name + ':', err.message);
      results.push({
        name: p.name,
        requestedUrl: p.url,
        finalUrl,
        status: 'FAIL',
        notes: ['Exception: ' + err.message],
        consoleErrors: consoleLogs.error,
        consoleWarnings: consoleLogs.warning,
      });
    } finally {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
    }
  }

  await browser.close();

  fs.writeFileSync(
    path.join(process.cwd(), 'docs', 'qa-results.json'),
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  console.log('\n=== AUDIT RESULTS SUMMARY ===');
  for (const r of results) {
    console.log('[' + r.status + '] ' + r.name + ' (' + r.requestedUrl + ') -> ' + r.finalUrl);
    if (r.notes && r.notes.length > 0) {
      console.log('   Notes: ' + r.notes.join(', '));
    }
    if (r.consoleErrors && r.consoleErrors.length > 0) {
      console.log('   Errors (' + r.consoleErrors.length + '): ' + r.consoleErrors.slice(0, 3).join(' | '));
    }
    if (r.consoleWarnings && r.consoleWarnings.length > 0) {
      console.log('   Warnings (' + r.consoleWarnings.length + '): ' + r.consoleWarnings.slice(0, 2).join(' | '));
    }
  }
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
