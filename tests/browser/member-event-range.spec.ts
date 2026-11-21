import { test, expect } from "@playwright/test";
import { build } from "esbuild";
let js: string, css: string;
test.beforeAll(async () => {
  const r = await build({stdin:{contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {MemberEventJourney} from './src/components/member-event-journey';import styles from './src/components/portal-theme.module.css';function Fixture(){const [from,setFrom]=useState(''),[to,setTo]=useState('');return <main className={styles.portal}><MemberEventJourney from={from} to={to} onFromChange={setFrom} onToChange={setTo}/></main>}createRoot(document.getElementById('root')).render(<Fixture/>);`,resolveDir:process.cwd(),loader:"tsx"},bundle:true,write:false,outfile:"fixture.js",platform:"browser",jsx:"automatic",define:{"process.env":"{}","process.env.NODE_ENV":'"production"'}});
  js=r.outputFiles.find(f=>f.path.endsWith('.js'))!.text;css=r.outputFiles.find(f=>f.path.endsWith('.css'))!.text;
});
test("member calendar filters an inclusive date range and clears it", async ({page}) => {
  await page.route('http://events.test/**',route=>route.fulfill({contentType:'text/html',body:'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>'}));
  await page.route('**/api/member/event-journey',route=>route.fulfill({json:{attendanceCount:1,attendedEvents:[{id:'event',title:'November seminar',starts_at:'2026-11-01T18:30:00Z'}],historicalAttendance:[{date:'2026-10-01',title:'October seminar',source:'workbook'},{date:'2026-09-30',title:'September seminar',source:'workbook'}],badges:[],resources:[]}}));
  await page.goto('http://events.test/');await page.addStyleTag({content:css});await page.addScriptTag({content:js});
  await expect(page.getByRole('link',{name:'September seminar'})).toBeVisible();
  await page.getByLabel('From date',{exact:true}).fill('2026-10-01');
  await page.getByLabel('To date',{exact:true}).fill('2026-11-02');
  await expect(page.getByRole('link',{name:'September seminar'})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'October seminar'})).toBeVisible();
  await expect(page.getByRole('link',{name:'November seminar'})).toBeVisible();
  await page.getByLabel('To date',{exact:true}).fill('2026-09-01');await expect(page.getByRole('alert')).toContainText('From date must be on or before To date');
  await page.getByRole('button',{name:'Clear dates'}).click();await expect(page.getByRole('link',{name:'September seminar'})).toBeVisible();
  await page.screenshot({path:`output/playwright/member-event-range/${test.info().project.name}.png`,fullPage:true});
});
