import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,parseAds,parseCsv,mergeAds,metrics,makeReport} from '../src/domain.js';
import {privateAddress} from '../src/integrations.js';
const header='date,campaign,spend,impressions,clicks,purchases,revenue,currency\n';
test('quoted CSV, currency validation and duplicate import do not inflate spend',()=>{
  const rows=parseAds(header+'2026-10-12,"Gift, A",45,1000,20,2,100,USD\n');
  assert.equal(rows[0].campaign,'Gift, A');const state=initialState();state.ads=mergeAds(rows,rows);
  const m=metrics(state);assert.equal(m.spend,45);assert.equal(m.ctr,2);assert.equal(m.cpa,22.5);assert.equal(m.roas,100/45);
  assert.throws(()=>parseAds(header+'2026-10-12,A,45,1000,20,2,100,EUR'),/USD/);
  assert.throws(()=>parseAds(header+'2026-02-30,A,45,1000,20,2,100,USD'),/日期/);
  assert.throws(()=>parseAds(header+'2026-10-12,A,,1000,20,2,100,USD'),/spend/);
  assert.throws(()=>parseCsv('a,b\n"unfinished,b'),/未闭合/);
});
test('zero purchases produce unknown CPA and reports flag overspend without claiming execution',()=>{
  const s=initialState();s.ads=parseAds(header+'2026-10-12,A,46,1000,20,0,0,USD');
  assert.equal(metrics(s).cpa,null);assert.equal(metrics(s).adRatio,null);
  const report=makeReport(s);assert.match(report.findings.join('\n'),/超过/);assert.match(report.findings.join('\n'),/无归因购买/);assert.equal(report.mode,'规则复盘 · 手动触发');
});
test('order currencies are kept separate and refunds are not called profit',()=>{
  const s=initialState();s.orders=[{status:'completed',currency:'USD',total:30},{status:'processing',currency:'EUR',total:20},{status:'cancelled',currency:'USD',total:50}];
  assert.deepEqual(metrics(s).salesByCurrency,{USD:30,EUR:20});assert.equal(metrics(s).paidOrders,2);
});
test('private storefront destinations are blocked',()=>{
  for(const ip of ['127.0.0.1','10.0.0.2','169.254.169.254','192.168.0.1','172.31.1.2','::1','::ffff:127.0.0.1'])assert.equal(privateAddress(ip),true);
  assert.equal(privateAddress('93.184.216.34'),false);
});
