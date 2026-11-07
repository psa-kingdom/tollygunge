import {test,expect} from '@playwright/test';
import {build} from 'esbuild';
test.use({launchOptions:{executablePath:process.env.TPA_BROWSER_EXECUTABLE||undefined}});
let script:string;
test.beforeAll(async()=>{
 const result=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {PortalNavigation} from './src/components/portal-navigation';import {portalNavigation} from './src/domain/portal-navigation';createRoot(document.getElementById('root')).render(<><PortalNavigation groups={portalNavigation(['administrator'])} staff/><PortalNavigation groups={portalNavigation(['administrator'])} subsections canViewParticipants/></>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,jsx:'automatic',platform:'browser',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'navigation-fixture',setup(b){b.onResolve({filter:/\.css$/},()=>({path:'css',namespace:'fixture'}));b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},args=>({resolveDir:process.cwd(),contents:args.path==='css'?'export default {};':args.path==='navigation'?`export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{}});`:`import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link(props){return <a {...props}/>}`,loader:'jsx'}));}}]});script=result.outputFiles[0].text;
});
async function open(page:import('@playwright/test').Page,path:string){await page.route('http://portal.test/**',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));await page.goto('http://portal.test'+path);await page.addScriptTag({content:script});}
test('historical participants belong to Events and do not show online-only tabs',async({page})=>{
 await open(page,'/admin/workspaces/events?view=participants&eventDate=2026-10-03&tab=attendance');
 await expect(page.getByRole('navigation',{name:'Staff navigation'}).getByRole('link',{name:'Events',exact:true})).toHaveAttribute('aria-current','page');
 await expect(page.getByRole('navigation',{name:'Staff navigation'}).getByRole('link',{name:'Members',exact:true})).not.toHaveAttribute('aria-current','page');
 await expect(page.getByText('Past attendance registers')).toBeVisible();
 await expect(page.getByRole('link',{name:'Receipt status',exact:true})).toHaveCount(0);
 await expect(page.getByRole('combobox',{name:'Directory audience'})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'← All events'})).toHaveAttribute('href','/admin/workspaces/events');
});
test('online task links keep the selected event and source',async({page})=>{
 await open(page,'/admin/workspaces/events?view=participants&eventId=example&tab=payments');
 const nav=page.getByRole('navigation',{name:'Event participant sections'});
 await expect(nav.getByRole('link',{name:'Receipt status',exact:true})).toHaveAttribute('aria-current','page');
 for(const label of ['Registrations','Receipt status','Attendance']){
 const href=await nav.getByRole('link',{name:label,exact:true}).getAttribute('href');const url=new URL(href!,'http://portal.test');expect(url.searchParams.get('eventId')).toBe('example');expect(url.searchParams.get('source')).toBe('live');
 }
});
test('members keeps its own sections with an explicit event shortcut',async({page})=>{
 await open(page,'/admin/workspaces/members');
 await expect(page.getByRole('navigation',{name:'Staff navigation'}).getByRole('link',{name:'Members',exact:true})).toHaveAttribute('aria-current','page');
 await expect(page.getByRole('navigation',{name:'Members sections'}).getByRole('link',{name:'Directory',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Event attendance & participants →'})).toBeVisible();
 await expect(page.getByRole('combobox')).toHaveCount(0);
});
