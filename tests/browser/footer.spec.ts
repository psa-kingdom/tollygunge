import {test,expect} from '@playwright/test';

test('complete footer exposes grouped working destinations and keyboard navigation',async({page,request})=>{
  await page.goto('/');
  const footer=page.locator('footer.footer-complete'),navigation=footer.getByRole('navigation',{name:'Footer',exact:true});
  await expect(navigation.getByRole('heading',{level:2})).toHaveText(['Association','Explore','Connect']);
  const links=navigation.getByRole('link');await expect(links).toHaveCount(11);
  const targets=await links.evaluateAll(elements=>elements.map(e=>e.getAttribute('href')!));
  for(const href of targets){
    const url=new URL(href,'http://localhost');const response=await request.get(url.pathname);expect(response.status(),href).toBe(200);
    if(url.hash){await page.goto(href);await expect(page.locator(url.hash)).toHaveCount(1);}
  }
  await page.goto('/',{waitUntil:'networkidle'});const first=page.locator('footer nav a').first();await first.focus();await expect(first).toBeFocused();await page.keyboard.press('Tab');await expect(page.locator('footer nav a').nth(1)).toBeFocused();
  expect(await page.locator('footer nav a').nth(1).evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.goto('/about');await expect(page.locator('footer').getByRole('navigation',{name:'Footer',exact:true})).toBeVisible();
});
