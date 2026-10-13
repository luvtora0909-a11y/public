export const modules = [
  ['foundation','经营底座','数据口径、权限、预算、审计与备份','首期可用'],
  ['catalog','商品与品牌','商品事实、SKU、毛利、品牌规范与选品','首期部分可用'],
  ['creative','图片与视频','统一商品图、分镜、广告视频、平台适配与素材授权','素材库可用 · 生成待接入'],
  ['seo','SEO 与转化','Listing、关键词、内外链、Feed、移动端与结账','待接入'],
  ['ads','广告与宣发','Meta / Google / TikTok、实验、预算与归因','CSV 分析可用 · 投放待接入'],
  ['social','社媒与直播','Instagram、Facebook、TikTok、Pinterest、YouTube、达人','待接入'],
  ['retention','活动与留存','促销、邮件、弃购、复购、会员与联盟','待接入'],
  ['fulfillment','订单与供应链','库存、备货、物流、尾程配送与异常订单','订单只读同步可用'],
  ['support','客服与售后','咨询、身份核验、工单、退款、客诉与知识库','待接入'],
  ['security','网站安全','监测、备份、授权扫描、测试环境与 Codex 整改','待接入'],
  ['finance','经营复盘','贡献利润、现金流、竞品、趋势、日报与次日任务','手动复盘可用'],
];
export function initialState() {
  return { version: 1, settings: { site: 'https://luvtora.com', budget: 45, expectedSkus: 42, timezone: 'America/Los_Angeles', brand: '美国市场饰品品牌；材质、尺寸和性能仅使用已核实资料。', audience: '', aiModel: 'gpt-4.1-mini' }, products: [], orders: [], ads: [], assets: [], plans: [], reports: [], audit: [], lastSync: null,
    tasks: [
      ['验证移动端购买、支付与追踪', 'foundation'], ['同步商品并补齐成本、材质和物流资料', 'catalog'], ['选择 3–5 个主推产品并制定素材方案', 'creative'], ['导入 Meta 报表并检查购买漏斗', 'ads'], ['建立配送与退换政策知识库', 'support']
    ].map(([title,module]) => ({ id: crypto.randomUUID(), title, module, status: 'todo', owner: '店主', due: '', createdAt: new Date().toISOString() })) };
}
export function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i=0; i<text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i+1] === '"') { field += '"'; i++; }
      else if (!quoted && field.length) throw new Error('CSV 引号格式错误');
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if(c==='\r' && text[i+1]==='\n') i++; row.push(field); if(row.some(x=>x.trim())) rows.push(row); row=[]; field=''; }
    else field += c;
  }
  if (quoted) throw new Error('CSV 引号未闭合');
  row.push(field); if(row.some(x=>x.trim())) rows.push(row);
  if(rows.length < 2) throw new Error('CSV 至少需要表头和一条数据');
  const headers = rows.shift().map(x=>x.trim().toLowerCase());
  if(new Set(headers).size !== headers.length) throw new Error('CSV 表头重复');
  return rows.map((r,i)=> { if(r.length!==headers.length) throw new Error(`CSV 第 ${i+2} 行列数错误`); return Object.fromEntries(headers.map((h,j)=>[h,r[j].trim()])); });
}
export function parseAds(text) {
  const rows = parseCsv(text);
  const required = ['date','campaign','spend','impressions','clicks','purchases','revenue'];
  if(required.some(k=> !(k in rows[0]))) throw new Error('请使用模板列：'+required.join(', '));
  return rows.map((r,i)=> {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || Number.isNaN(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0,10)!==r.date) throw new Error(`第 ${i+2} 行日期无效`);
    if(!r.campaign || r.campaign.length>200) throw new Error(`第 ${i+2} 行广告名称无效`);
    const result = { date:r.date, campaign:r.campaign, currency:'USD' };
    if(r.currency && r.currency.toUpperCase()!=='USD') throw new Error('当前仅支持 USD 广告报表，请勿混用币种');
    for(const key of required.slice(2)) {
      const n=Number(r[key]); if(!r[key] || !Number.isFinite(n) || n<0) throw new Error(`第 ${i+2} 行 ${key} 无效`);
      if(['impressions','clicks','purchases'].includes(key) && !Number.isInteger(n)) throw new Error(`第 ${i+2} 行 ${key} 必须为整数`);
      result[key]=n;
    }
    if(result.clicks>result.impressions) throw new Error(`第 ${i+2} 行点击数超过展示数`);
    return result;
  });
}
export function mergeAds(existing, incoming) {
  const map=new Map(existing.map(r=>[JSON.stringify([r.date,r.campaign]),r]));
  for(const r of incoming) map.set(JSON.stringify([r.date,r.campaign]),r);
  return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function metrics(state) {
  const a = state.ads.reduce((x,r)=> { for(const k of ['spend','impressions','clicks','purchases','revenue']) x[k]+=r[k]; return x; }, {spend:0,impressions:0,clicks:0,purchases:0,revenue:0});
  const dated=state.ads.map(r=>r.date).sort();
  const paid=state.orders.filter(o=>['processing','completed'].includes(o.status));
  const salesByCurrency={}; for(const o of paid) salesByCurrency[o.currency]=(salesByCurrency[o.currency]||0)+o.total;
  return {...a,ctr:a.impressions ? a.clicks/a.impressions*100:null,roas:a.spend ? a.revenue/a.spend:null,cpa:a.purchases ? a.spend/a.purchases:null,adRatio:a.revenue ? a.spend/a.revenue*100:null, period:dated.length?`${dated[0]} 至 ${dated.at(-1)}`:null, salesByCurrency, paidOrders:paid.length, lowStock:state.products.filter(p=>p.manageStock && p.stock!==null && p.stock<=3).length};
}
export function makeReport(state) {
  const m=metrics(state), findings=[];
  if(!state.lastSync) findings.push('WooCommerce 尚未同步，无法确认订单、库存和实际商品数量。');
  if(!state.ads.length) findings.push('尚未导入广告数据，无法判断 CTR、ROAS 或获客成本。');
  else {
    if(m.spend>0 && m.purchases===0) findings.push('已导入报表有广告花费但无归因购买。先核查追踪、落地页与结账，勿仅凭此自动停投。');
    const days={}; for(const r of state.ads) days[r.date]=(days[r.date]||0)+r.spend;
    const over=Object.entries(days).filter(([,s])=>s>state.settings.budget);
    if(over.length) findings.push(`${over.length} 天的导入花费超过 $${state.settings.budget}/日设定；这是告警，程序未修改平台预算。`);
  }
  if(m.lowStock) findings.push(`${m.lowStock} 个已同步商品库存 ≤ 3，请核实变体库存与补货周期。`);
  findings.push('商品成本、物流、退款及支付手续费尚未完整核算，ROAS 不代表净利润。');
  return { id:crypto.randomUUID(), createdAt:new Date().toISOString(), period:m.period, metrics:m, findings, next:state.tasks.filter(t=>t.status!=='done').map(t=>({title:t.title,owner:t.owner,due:t.due})), mode:'规则复盘 · 手动触发' };
}
