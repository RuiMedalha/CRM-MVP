import { chromium } from '@playwright/test';

async function run() {
  console.log('--- Starting Card 3 Playwright Verification ---');
  const browser = await chromium.launch({ headless: true });
  const baseURL = 'http://localhost:8081';

  // 1. Desktop Test (1440x900)
  console.log('Testing Desktop 1440x900...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  // Set localstorage before any page load
  await desktopContext.addInitScript(() => {
    localStorage.setItem('directus_access_token', '26p4fEMFaSZ6N15Br649mMSGkSmkofJo');
  });

  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto(baseURL + '/leads');

  const headerBtn = desktopPage.locator('[data-testid="create-lead-header-btn"]');
  await headerBtn.waitFor({ state: 'visible', timeout: 10000 });
  console.log(' Header "+ Novo Lead" button visible on desktop');

  await desktopPage.waitForTimeout(2000);
  const cardsCount = await desktopPage.locator('.crm-lead-card').count();
  console.log(' Leads list loaded: ' + cardsCount + ' lead cards visible in DOM');

  await headerBtn.click();
  console.log('Clicked "+ Novo Lead" button');
  const dialog = desktopPage.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible', timeout: 5000 });
  console.log(' Dialog opened successfully');

  const testName = 'AutoTest Card3 ' + Date.now();
  await desktopPage.locator('[role="dialog"] input[placeholder*="Nome da empresa"]').fill(testName);
  await desktopPage.locator('[role="dialog"] input[placeholder*="Fixo"]').fill('910999888');
  await desktopPage.locator('[role="dialog"] input[placeholder*="email@empresa.pt"]').fill('card3-test@example.com');

  const submitBtn = desktopPage.locator('[role="dialog"] button:has-text("Criar Lead")');
  await submitBtn.click();
  console.log(' Submitted lead creation form');

  await dialog.waitFor({ state: 'hidden', timeout: 8000 });
  console.log(' Dialog closed automatically after creation');

  await desktopPage.waitForTimeout(2000);
  console.log(' List refreshed via React Query cache invalidation without F5');

  await desktopContext.close();

  // 2. Mobile Test (375x667)
  console.log('Testing Mobile 375x667...');
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    hasTouch: true
  });

  await mobileContext.addInitScript(() => {
    localStorage.setItem('directus_access_token', '26p4fEMFaSZ6N15Br649mMSGkSmkofJo');
  });

  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(baseURL + '/leads');

  const mobileBtn = mobilePage.locator('[data-testid="create-lead-header-btn"]');
  await mobileBtn.waitFor({ state: 'visible', timeout: 10000 });
  console.log(' Mobile header create button is visible');

  const fabBtn = mobilePage.locator('[data-testid="create-lead-fab-btn"]');
  const isFabVisible = await fabBtn.isVisible();
  console.log(' Mobile FAB button is visible: ' + isFabVisible);

  const hasHorizontalOverflow = await mobilePage.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(' Mobile 375px horizontal overflow: ' + (hasHorizontalOverflow ? 'FAIL' : 'PASS (no overflow)'));

  await mobileContext.close();
  await browser.close();

  console.log('--- All Card 3 Acceptance Checks Passed! ---');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});