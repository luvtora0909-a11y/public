import {test,expect} from '@playwright/test';
test('usable workspace: navigation, task persistence, CSV analysis, report and media validation',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.getByRole('heading',{name:'经营总览',exact:true})).toBeVisible();
  await expect(page.getByText('尚未连接真实经营数据。',{exact:false})).toBeVisible();
  await page.screenshot({path:'test-results/overview.png',fullPage:true});
  await page.locator('nav').getByRole('button',{name:'运营任务'}).click();
  await page.getByLabel('任务内容').fill('核实商品材质 <script>bad()</script>');await page.getByLabel('截止日期').fill('2026-10-15');
  await page.getByRole('button',{name:'添加任务'}).click();await expect(page.getByText('核实商品材质 <script>bad()</script>',{exact:true})).toBeVisible();
  await page.reload();await page.locator('nav').getByRole('button',{name:'运营任务'}).click();await expect(page.getByText('核实商品材质 <script>bad()</script>',{exact:true})).toBeVisible();
  await page.locator('nav').getByRole('button',{name:'广告分析'}).click();
  await page.getByLabel('广告 CSV 文件').setInputFiles({name:'ads.csv',mimeType:'text/csv',buffer:Buffer.from('date,campaign,spend,impressions,clicks,purchases,revenue\n2026-10-12,Gift test,45,1000,20,0,0')});
  await page.getByRole('button',{name:'导入并分析'}).click();await expect(page.getByRole('cell',{name:'Gift test',exact:true})).toBeVisible();await expect(page.getByText('2.00%',{exact:true})).toBeVisible();
  await page.locator('nav').getByRole('button',{name:'复盘与记录'}).click();await page.getByRole('button',{name:'生成当前复盘'}).click();await expect(page.getByText('已导入报表有广告花费但无归因购买。',{exact:false})).toBeVisible();
  await page.locator('nav').getByRole('button',{name:'素材工作室'}).click();
  await page.locator('input[name=file]').setInputFiles({name:'supplier.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')});
  await page.getByLabel('使用权与备注').fill('仅测试素材');await page.getByRole('button',{name:'保存图片'}).click();await expect(page.getByRole('heading',{name:'supplier.png'})).toBeVisible();
  await page.locator('nav').getByRole('button',{name:'AI 方案'}).click();await expect(page.getByRole('button',{name:'生成方案（产生 API 费用）'})).toBeDisabled();
  await page.locator('nav').getByRole('button',{name:'完整实施路线'}).click();await expect(page.getByRole('heading',{name:'社媒与直播'})).toBeVisible();
  expect(errors).toEqual([]);
});
test('sidebar navigation remains accessible at the minimum desktop height',async({page})=>{
  await page.setViewportSize({width:1050,height:720});await page.goto('/');
  await page.locator('nav').getByRole('button',{name:'复盘与记录'}).click();await expect(page.getByRole('heading',{name:'复盘与记录',exact:true})).toBeVisible();
  await page.locator('nav').getByRole('button',{name:'连接与设置'}).click();await expect(page.getByRole('heading',{name:'连接与设置',exact:true})).toBeVisible();
});
test('interface language persists and multilingual support is explicitly a draft workflow',async({page})=>{
  await page.goto('/');await page.locator('#ui-language').selectOption('en-US');await expect(page.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();
  await page.locator('nav').getByRole('button',{name:'Customer support'}).click();await expect(page.getByRole('heading',{name:'Multilingual support & after-sales'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Draft reply (API charges apply)'})).toBeDisabled();
  await expect(page.locator('select[name=language] option')).toHaveCount(17);
  await page.locator('#ui-language').selectOption('zh-CN');await expect(page.getByRole('heading',{name:'多语言客服',exact:true})).toBeVisible();await expect(page.locator('#backup')).toHaveText('导出备份 ↗');
});
