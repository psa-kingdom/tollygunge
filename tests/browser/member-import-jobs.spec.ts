import {test,expect} from '@playwright/test';
import {Pool} from 'pg';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {databaseOptions} from '../../src/lib/database-options';
import {memberHeaders} from '../../src/domain/member-import';
import { invitationDefaults } from '../../src/domain/invitation-template';
test('member import runs independently, reload restores progress and correction download preserves lineage',async({page,context})=>{
 test.skip(!process.env.TPA_DATABASE_NAME?.startsWith('tpa_onboarding_test_jobs_'),'Requires isolated job API and worker');
 const db=new Pool(databaseOptions()),actor=randomUUID(),token=randomBytes(32).toString('hex'),base=process.env.TPA_TEST_URL!;
 try{
  await db.query('INSERT INTO public."user"(id,name,email,"emailVerified") VALUES($1,\'Synthetic browser operator\',$2,true)',[actor,actor+'@example.invalid']);
  await db.query("INSERT INTO tpa.staff_roles(user_id,role) VALUES($1,'administrator')",[actor]);
  await db.query('INSERT INTO public."session"(id,token,"userId","expiresAt","updatedAt") VALUES($1,$2,$3,now()+interval \'1 hour\',now())',[randomUUID(),token,actor]);
  await context.addCookies([{name:'better-auth.session_token',value:encodeURIComponent(token+'.'+createHmac('sha256',process.env.BETTER_AUTH_SECRET!).update(token).digest('base64')),url:base}]);
  const prefix=randomUUID(),rows=[memberHeaders,['CA','Browser','Valid',prefix+'-001',prefix+'@example.invalid','9876543210','','','','','','',''],['CA','Browser','Invalid',prefix+'-002','bad','9876543210','','','','','','','']];
  const before=(await db.query('SELECT (SELECT count(*) FROM tpa.onboarding_invitations) invitations,(SELECT count(*) FROM tpa.onboarding_mail) mail')).rows[0];
  const fixture = await context.request.post('/api/staff/member-import-jobs', {
    headers: { Origin: base },
    multipart: { file: { name: 'synthetic.csv', mimeType: 'text/csv', buffer: Buffer.from(rows.map(r=>r.join(',')).join('\n')) } },
  });
  expect(fixture.ok()).toBeTruthy();
  const { id } = await fixture.json();
  await page.goto('/admin/workspaces/onboarding?id=' + id);
  await expect(page.getByLabel('Import mode')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Start reviewed member import'})).toBeVisible();
  const uploaded = page.getByRole('region', { name: 'Uploaded records' }).getByRole('table');
  await expect(uploaded.getByRole('row')).toHaveCount(3);
  const invalid = uploaded.getByRole('row').filter({ hasText: 'Browser Invalid' });
  await expect(invalid).toContainText('Needs correction');
  await invalid.getByText('Validation details', { exact: true }).click();
  await expect(invalid.locator('details[open]')).toHaveCount(1);
  const previewId=new URL(page.url()).searchParams.get('id');expect(previewId).toBeTruthy();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download source correction template'}).click();const downloaded=await download;const csv=await readFile((await downloaded.path())!,'utf8');expect(csv).toContain('Original Source Row');expect(csv).toContain('Original Source Hash');
  await page.getByRole('button',{name:'Start reviewed member import'}).click();await expect(page.getByRole('status').filter({hasText:'records processed'})).toBeVisible();
  await page.reload();await expect(page.getByRole('status').filter({hasText:'completed-with-issues'})).toBeVisible({timeout:180000});
  await expect(page.getByText(/Created: 1 · Skipped: 0 · Conflicts: 0 · Invalid: 1/)).toBeVisible();
  const job=(await db.query('SELECT id FROM tpa.member_import_jobs WHERE batch_id=$1',[previewId])).rows[0];
  const results=(await db.query('SELECT source_row,status FROM tpa.member_import_job_rows WHERE job_id=$1 ORDER BY ordinal',[job.id])).rows;expect(results).toEqual([{source_row:2,status:'created'},{source_row:3,status:'invalid'}]);
  // Force a frontend retry fixture for the already invalid row; worker revalidation must hold it again.
  await db.query("UPDATE tpa.member_import_job_rows SET status='failed',result='{"+ '"retryable":true,"reason":"Synthetic transient fixture"'+"}'::jsonb WHERE job_id=$1 AND source_row=3",[job.id]);
  await expect(page.getByRole('button',{name:'Retry temporary failures'})).toBeVisible({timeout:15000});await page.getByRole('button',{name:'Retry temporary failures'}).click();
  await expect(page.getByRole('status').filter({hasText:'completed-with-issues'})).toBeVisible({timeout:180000});
  await expect.poll(async()=> (await db.query('SELECT status FROM tpa.member_import_job_rows WHERE job_id=$1 AND source_row=3',[job.id])).rows[0].status,{timeout:180000}).toBe('invalid');
  expect((await db.query('SELECT count(*)::int n FROM tpa.memberships WHERE membership_number=$1',[prefix+'-001'])).rows[0].n).toBe(1);
  expect((await db.query('SELECT (SELECT count(*) FROM tpa.onboarding_invitations) invitations,(SELECT count(*) FROM tpa.onboarding_mail) mail')).rows[0]).toEqual(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
  await page.goto('/admin/workspaces/onboarding');
  const email = prefix + '-held@example.invalid';
  await page.getByLabel('CSV/XLSX (5 MB, 1,000 users)').setInputFiles({
    name: 'accounts.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Prefix,First Name,Last Name,Membership No.,Email,Mobile,Designation,Organisation,Address,Country,State,City,Pin,District\nCA,Held,Account,' + prefix + '-held,' + email + ',,Partner,Example,12 Road,India,West Bengal,Custom City,700001,Custom District'),
  });
  await page.getByRole('button', { name: 'Preview uploaded records', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Held Account');
  const uploadedRow = page.getByRole('region', { name: 'Uploaded records', exact: true }).getByRole('row').filter({ hasText: email });
  await uploadedRow.getByText('View uploaded fields', { exact: true }).click();
  await expect(uploadedRow).toContainText(prefix + '-held');
  await expect(uploadedRow).toContainText('Custom City');
  await expect(uploadedRow).toContainText('Partner');
  await expect(uploadedRow).toContainText('Example');
  const actions = page.locator('.import-preview-actions');
  await expect(actions.getByRole('button')).toHaveCount(2);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Accounts created with invitations held.');
  const hold = await db.query(
    'SELECT m.type FROM public."user" u JOIN tpa.account_invitation_holds h ON h.user_id=u.id JOIN tpa.people p ON p.user_id=u.id JOIN tpa.memberships m ON m.person_id=p.id WHERE u.email=$1 AND h.released_at IS NULL',
    [email],
  );
  expect(hold.rows).toEqual([{ type: 'Free' }]);
  const imported = await db.query('SELECT p.accepted,m.membership_number FROM public."user" u JOIN tpa.people p ON p.user_id=u.id JOIN tpa.memberships m ON m.person_id=p.id WHERE u.email=$1',[email]);
  expect(imported.rows[0].membership_number).toBe(prefix + '-held');
  expect(imported.rows[0].accepted.organization).toBe('Example');
  expect(imported.rows[0].accepted.addresses.correspondence.city).toBe('Custom City');
  expect(imported.rows[0].accepted.addresses.correspondence.district).toBe('Custom District');
  const template = randomUUID();
  await db.query(
    'INSERT INTO tpa.invitation_templates(id,subject,body,created_by,approved_by,approved_at) VALUES($1,$2,$3,$4,$4,now())',
    [template, invitationDefaults.subject, invitationDefaults.body, actor],
  );
  await db.query('UPDATE tpa.invitation_template_state SET latest_id=$1,approved_id=$1,revision=revision+1 WHERE singleton',[template]);
  await expect(page.getByRole('heading', { name: 'Review & send invitations' })).toBeVisible();
  await page.getByRole('button', { name: 'Review batch invitations' }).click();
  const recipients = page.getByRole('region', { name: 'Invitation recipients', exact: true });
  await expect(recipients.getByRole('row')).toHaveCount(2);
  await expect(recipients).toContainText(email);
  await expect(recipients).toContainText('On hold');
  await expect(page.frameLocator('iframe[title="Reviewed invitation email"]').getByText('Hello Held Account,')).toBeVisible();
  const send = page.getByRole('button', { name: 'Send 1 invitation', exact: true });
  await expect(send).toBeDisabled();

  expect((await db.query('SELECT (SELECT count(*) FROM tpa.onboarding_invitations) invitations,(SELECT count(*) FROM tpa.onboarding_mail) mail')).rows[0]).toEqual(before);
  await page.getByLabel('I verified the listed recipients and the approved email').check();
  await send.click();
  await expect(recipients).toContainText('Queued');
  await page.reload();
  await expect(recipients).toContainText('Queued');
  await expect(send).toHaveCount(0);
  expect((await db.query("SELECT count(*)::int AS count FROM tpa.onboarding_mail WHERE recipient=$1 AND kind='invitation'",[email])).rows[0].count).toBe(1);


 }finally{await db.end();}
});
