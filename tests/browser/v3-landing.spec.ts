import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { databaseOptions } from '../../src/lib/database-options';

test('v3 landing lists only the next three published public events', async ({ page }, info) => {
  test.skip(!process.env.TPA_DATABASE_NAME?.startsWith('tpa_onboarding_test_'), 'Requires disposable database');
  const db = new Pool(databaseOptions()), actor=randomUUID(), prefix='V3 synthetic '+randomUUID().slice(0,8);
  try {
    await db.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'V3 event fixture\',$2,true)', [actor,actor+'@example.invalid']);
    for(const [suffix,days,status,visibility] of [['one',1,'published','public'],['two',2,'published','public'],['three',3,'published','public'],['four',4,'published','public'],['past',-1,'published','public'],['draft',1,'draft','public'],['private',1,'published','members']] as const) {
      await db.query("INSERT INTO tpa.events(id,title,description,location,starts_at,ends_at,capacity,status,visibility,updated_by) VALUES($1,$2,'Synthetic preview only','Synthetic Kolkata venue',now()+$3*interval '1 day',now()+$3*interval '1 day'+interval '1 hour',10,$4,$5,$6)",[randomUUID(),prefix+' '+suffix,days,status,visibility,actor]);
    }
    await page.goto('/');
    const list=page.locator('.v3-event-list'); await expect(list.locator('li')).toHaveCount(3);
    for(const suffix of ['one','two','three']) await expect(list).toContainText(prefix+' '+suffix);
    for(const suffix of ['four','past','draft','private']) await expect(list).not.toContainText(prefix+' '+suffix);
    await expect(list.locator('time').first()).toHaveAttribute('datetime', /Z$/);
    await page.locator('.v3-events').screenshot({path:info.outputPath('published-events.png')});
    await list.locator('h3 a').first().click(); await expect(page).toHaveURL(/\/events\/[a-f0-9-]+$/);
  } finally {
    await db.query('DELETE FROM tpa.events WHERE updated_by=$1',[actor]);
    await db.query('DELETE FROM public."user" WHERE id=$1',[actor]);await db.end();
  }
});
