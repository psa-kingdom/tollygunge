import test from "node:test";
import assert from "node:assert/strict";
import { pageFields, settingFields, setCmsValue, getCmsValue } from "../src/domain/cms-fields";
import { content, contentInput } from "../src/domain/operations";
import { homeDefaults } from "../src/domain/website-home";
import { settingsBody } from "../src/domain/website-settings";
import { sitePages } from "../src/domain/site-pages";
const body={...sitePages.about,sourceUrl:"",attribution:""};
test("visual page fields cover page copy and each section, and edits preserve unrelated content",()=>{
 const fields=pageFields(body);
 assert.ok(fields.some(f=>f.id==='title'));
 assert.equal(fields.filter(f=>f.type==='image').length,body.sections.length+1);
 const next=setCmsValue(body,['sections','1','text'],'Updated mission statement');
 assert.equal(next.sections[1].text,'Updated mission statement');
 assert.equal(body.sections[1].text,sitePages.about.sections[1].text);
 assert.deepEqual(next.sections[0],body.sections[0]);
 assert.equal(getCmsValue(next,['sections','1','text']),'Updated mission statement');
});
test("page image references require valid identifiers and descriptions and survive content validation",()=>{
 const id='12345678-1234-4234-8234-123456789012';
 const next={...body,heroMediaId:id,heroAlt:'Association meeting in Kolkata',sections:body.sections.map((s,i)=>i? s:{...s,mediaId:id,mediaAlt:'Members at the annual meeting'})};
 const parsed=content(next,'page');assert.equal(parsed.heroMediaId,id);assert.equal(parsed.sections[0].mediaId,id);
 assert.throws(()=>content({...next,heroMediaId:'../../private'},'page'));
 assert.throws(()=>content({...next,heroAlt:'x'},'page'));
});
test("legacy homepage settings acquire new editable copy defaults without changing existing copy",()=>{
 const legacy=structuredClone(homeDefaults) as Partial<typeof homeDefaults>;
 delete legacy.images;delete legacy.membershipContent;delete legacy.newsletterContent;delete legacy.eventContent;
 const parsed=settingsBody('home',legacy) as typeof homeDefaults;
 assert.deepEqual(parsed.copy,homeDefaults.copy);
 assert.deepEqual(parsed.membershipContent,homeDefaults.membershipContent);
 const fields=settingFields(parsed,'home');
 assert.ok(fields.some(f=>f.id==='membershipContent.plans.0.description'));
 assert.ok(!fields.some(f=>f.id==='copy.communityGuide11'));
 assert.equal(fields.find(f=>f.id==='links.button01Href')?.type,'link');
});
test("privacy content can be edited through the same validated page workflow",()=>{
 assert.equal(contentInput({kind:'page',slug:'privacy',version:0,body:{...sitePages.privacy,sourceUrl:'',attribution:''}}).body.sections.length,sitePages.privacy.sections.length);
});
