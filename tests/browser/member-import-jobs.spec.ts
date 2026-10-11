import {test,expect} from '@playwright/test';
import {Pool} from 'pg';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {databaseOptions} from '../../src/lib/database-options';
import {memberHeaders} from '../../src/domain/member-import';
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
  await page.goto('/admin/workspaces/onboarding');await page.getByLabel('Import mode').selectOption('existing-members');
  await page.getByLabel('CSV/XLSX (5 MB, 1,000 users)').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(rows.map(r=>r.join(',')).join('\n'))});
  await page.getByRole('button',{name:'Validate member workbook',exact:true}).click();
  await expect(page.getByRole('button',{name:'Start reviewed member import'})).toBeVisible();
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
 }finally{await db.end();}
});
