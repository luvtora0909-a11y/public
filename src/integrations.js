import dns from 'node:dns/promises';
import net from 'node:net';
import https from 'node:https';
export function privateAddress(ip) {
  if(net.isIP(ip)===4) { const [a,b]=ip.split('.').map(Number); return a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127); }
  if(net.isIP(ip)===6) return true; // fail closed; IPv4 storefront destinations only in v0.1
  return true;
}
export async function validateSite(site) {
  const url=new URL(site);
  if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash || (url.port && url.port!=='443')) throw new Error('站点必须为不含凭证、查询参数的 HTTPS 地址');
  const addresses=await dns.lookup(url.hostname,{all:true});
  const ipv4=addresses.filter(a=>a.family===4);
  if(!ipv4.length || addresses.some(a=>a.family===4 && privateAddress(a.address)) || ['localhost','localhost.localdomain'].includes(url.hostname)) throw new Error('仅允许公网 IPv4 HTTPS 商店地址');
  return url.toString().replace(/\/$/,'');
}
async function pinnedRequest(url,headers) {
  const addresses=await dns.lookup(url.hostname,{all:true});
  if(addresses.some(a=>a.family===4&&privateAddress(a.address))) throw new Error('拒绝访问私有网络地址');
  const address=addresses.find(a=>a.family===4&&!privateAddress(a.address));
  if(!address)throw new Error('目标没有可用公网 IPv4 地址');
  return new Promise((resolve,reject)=>{
    const request=https.get(url,{headers,lookup:(_host,options,callback)=>callback(null,...(options?.all?[[{address:address.address,family:4}]]:[address.address,4]))},response=>{
      let size=0;const chunks=[];
      response.on('data',chunk=>{size+=chunk.length;if(size>20000000)request.destroy(new Error('商店响应超过 20MB'));else chunks.push(chunk);});
      response.on('error',reject);
      response.on('end',()=>{try{resolve({status:response.statusCode,pages:response.headers['x-wp-totalpages'],data:JSON.parse(Buffer.concat(chunks).toString())});}catch{reject(new Error('商店返回了非 JSON 响应，请检查 REST API 是否开放'));}});
    });
    const timer=setTimeout(()=>request.destroy(new Error('商店请求超时')),25000);
    request.on('close',()=>clearTimeout(timer));request.on('error',reject);
  });
}
async function wooRequest(site,path,creds,params={}) {
  const url=new URL(site+'/wp-json/wc/v3/'+path);
  for(const [k,v] of Object.entries(params)) url.searchParams.set(k,String(v));
  const response=await pinnedRequest(url,{Authorization:'Basic '+Buffer.from(creds.wooKey+':'+creds.wooSecret).toString('base64'),Accept:'application/json'});
  if(response.status<200||response.status>=300) throw new Error(`WooCommerce 返回 ${response.status}。检查只读 API 权限、站点地址及安全插件；凭证未记录到日志。`);
  const data=response.data; if(!Array.isArray(data)) throw new Error('WooCommerce 响应不是预期列表');
  return {data,pages:Number(response.pages || 1)};
}
export async function syncWoo(site,creds) {
  if(!creds.wooKey||!creds.wooSecret) throw new Error('请先配置 WooCommerce 只读 API 凭证');
  site=await validateSite(site);
  const all=async (resource,params) => {
    let result=[],pages=1;
    for(let page=1;page<=pages;page++) { const r=await wooRequest(site,resource,creds,{...params,per_page:100,page}); pages=r.pages; if(!Number.isInteger(pages)||pages>20) throw new Error('同步超过 2,000 条上限，需实现增量同步；未覆盖原数据'); result.push(...r.data); }
    return result;
  };
  const products=await all('products',{});
  const after=new Date(Date.now()-30*86400000).toISOString().replace(/\.\d+Z$/,'');
  const orders=await all('orders',{after,dates_are_gmt:true});
  return {products:products.map(p=>({id:p.id,name:p.name,sku:p.sku,type:p.type,price:p.price,stock:p.stock_quantity??null,manageStock:!!p.manage_stock,stockStatus:p.stock_status,image:p.images?.[0]?.src||'',permalink:p.permalink})),orders:orders.map(o=>({id:o.id,status:o.status,total:Number(o.total),currency:o.currency,date:o.date_created_gmt,items:o.line_items?.map(x=>({productId:x.product_id,quantity:x.quantity,name:x.name}))||[]})),lastSync:new Date().toISOString(),orderWindow:'近 30 天 · processing / completed 金额未扣退款、税费及运费'};
}
export async function generatePlan(state,creds,input) {
  if(!creds.aiKey) throw new Error('请在连接设置中配置 OpenAI API 密钥；ChatGPT 订阅不等于 API 额度');
  const product=state.products.find(p=>String(p.id)===String(input.productId));
  const brief=String(input.brief||'').trim(); if(!brief || brief.length>6000) throw new Error('请填写 1–6,000 字的任务要求');
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+creds.aiKey,'Content-Type':'application/json'},signal:AbortSignal.timeout(90000),body:JSON.stringify({model:state.settings.aiModel,instructions:'你是 Luvtora 饰品运营策划。输出中文 Markdown。仅提出方案，不宣称已执行。区分已知事实与待核实假设。不得编造商品材质、客户评价、效果数据或合规承诺。视频方案包含开头、逐镜头脚本、时长、字幕、视觉、平台适配、授权检查与测试标准。广告方案需遵守预算；没有成本时不承诺利润。列出执行步骤、依赖、审批及验证方法。',input:JSON.stringify({brand:state.settings.brand,audience:state.settings.audience,budgetUSDPerDay:state.settings.budget,product:product||null,request:brief}),max_output_tokens:3500,store:false})});
  if(!response.ok) throw new Error(`AI 接口返回 ${response.status}，请检查额度、密钥或模型权限。`);
  const data=await response.json();
  const content=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
  if(!content) throw new Error('AI 未返回文本方案，请稍后重试');
  return {id:crypto.randomUUID(),createdAt:new Date().toISOString(),brief,productId:product?.id||null,content,model:state.settings.aiModel,usage:data.usage,executed:false};
}
