import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
let js: string, css: string;
test.beforeAll(async () => {
  const result = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {MembershipPaymentConfirmation,MemberMembershipPayments} from './src/components/membership-payments';import styles from './src/components/portal-theme.module.css';createRoot(document.getElementById('root')).render(<main className={styles.portal}><MembershipPaymentConfirmation/><MemberMembershipPayments/></main>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, outfile: 'fixture.js', platform: 'browser', jsx: 'automatic', define: { 'process.env': '{}', 'process.env.NODE_ENV': '"production"' } });
  js = result.outputFiles.find(f => f.path.endsWith('.js'))!.text;
  css = result.outputFiles.find(f => f.path.endsWith('.css'))!.text;
});
test('staff reviews recipient, explicitly confirms payment and safely retries a failed response', async ({ page }) => {
  const posts: Record<string, unknown>[] = [];
  await page.route('https://membership.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' }));
  await page.route('**/api/**', route => {
    if (route.request().method() === 'POST') {
      posts.push(route.request().postDataJSON());
      return route.fulfill({ status: posts.length === 1 ? 503 : 200, json: posts.length === 1 ? { error: 'Unavailable' } : { saved: true } });
    }
    if (route.request().url().includes('/staff/')) return route.fulfill({ json: { member: { person_id: '22222222-2222-4222-8222-222222222222', name: 'Example Member', email: 'member@example.test', membership_number: 'L-12', type: 'Life', version: 3 }, payments: [] } });
    return route.fulfill({ json: { payments: [{ id: 'receipt', amount_paise: 100050, paid_on: '2026-01-02', method: 'UPI', reference: 'OLD-123', membership_type: 'Life' }] } });
  });
  await page.goto('https://membership.test/'); await page.addStyleTag({ content: css }); await page.addScriptTag({ content: js });
  await expect(page.getByRole('region', { name: 'Membership transactions' })).toContainText('OLD-123');
  await page.getByLabel('Membership number', { exact: true }).fill('L-12');
  await page.getByRole('button', { name: 'Find member' }).click();
  await expect(page.getByRole('heading', { name: 'Example Member · L-12' })).toBeVisible();
  await page.getByLabel('Amount received (₹)').fill('1000.50');
  await page.getByLabel('Payment date', { exact: true }).fill('2026-01-02');
  await page.getByLabel('Transaction / receipt reference').fill('NEW-123');
  const confirm = page.getByRole('button', { name: 'Confirm payment and send email' });
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.screenshot({ path: `output/playwright/membership-payments/${test.info().project.name}.png`, fullPage: true });
  await confirm.click();
  await expect(page.getByRole('status')).toContainText('temporarily unavailable');
  await confirm.click();
  await expect(page.getByRole('status')).toContainText('Confirmation email queued');
  expect(posts).toHaveLength(2); expect(posts[0].id).toBe(posts[1].id);
  expect(posts[1]).toMatchObject({ confirmed: true, reference: 'NEW-123', amount: '1000.50', membershipVersion: 3 });
});
