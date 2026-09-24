import { firefox } from 'playwright-core';
import { execSync } from 'node:child_process';

async function test() {
  console.log('Resolving Camoufox launch options...');
  const raw = execSync('python -c "from camoufox import launch_options; import json; print(json.dumps(launch_options(headless=True)))"').toString();
  const opts = JSON.parse(raw);

  console.log('Launching browser via playwright-core with camoufox config...');
  const browser = await firefox.launch({
    executablePath: opts.executable_path,
    headless: true,
    env: opts.env,
    firefoxUserPrefs: opts.firefox_user_prefs,
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  console.log('Navigating to example.com...');
  await page.goto('https://example.com');
  console.log('SUCCESS! PAGE TITLE:', await page.title());
  await browser.close();
}

test().catch(e => {
  console.error('FAILED:', e);
  process.exit(1);
});
