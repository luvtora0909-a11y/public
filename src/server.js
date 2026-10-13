import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Store } from './store.js';
import { modules, metrics, parseAds, mergeAds, makeReport, initialState } from './domain.js';
import { syncWoo, generatePlan } from './integrations.js';
const uiDir=fileURLToPath(new URL('../ui/',import.meta.url));
const text=(value,max=2000)=>String(value??'').trim().slice(0,max);
function settingValues(input,previous) {
  const s={...previous};
  for(const k of ['site','brand','audience','aiModel']) if(k in input) s[k]=text(input[k],k==='brand'||k==='audience'?5000:300);
  const url=new URL(s.site); if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||(url.port&&url.port!=='443')) throw new Error('请填写无凭证的 HTTPS 网站地址');
  if('budget' in input) { s.budget=Number(input.budget); if(!Number.isFinite(s.budget)||s.budget<0||s.budget>100000) throw new Error('预算无效'); }
  if(!s.aiModel || !/^[\w.-]+$/.test(s.aiModel)) throw new Error('模型名称无效');
  return s;
}
export function validateBackup(data) {
  if(data?.format!=='luvtora-backup-v1'||data.state?.version!==1) throw new Error('请选择本程序导出的 v1 备份');
  const source=data.state, base=initialState();
  for(const key of ['products','orders','ads','assets','tasks','plans','reports','audit']) {
    if(!Array.isArray(source[key]) || source[key].length>10000) throw new Error('备份数据结构无效：'+key);
  }
  base.settings=settingValues(source.settings,base.settings);
  // Strictly constrain persisted data; renderer escapes all text and never renders AI HTML.
  base.products=source.products.map(p=>({id:text(p.id,100),name:text(p.name),sku:text(p.sku,100),type:text(p.type,40),price:text(p.price,50),stock:Number.isFinite(p.stock)?p.stock:null,manageStock:!!p.manageStock,stockStatus:text(p.stockStatus,40),image:/^https:\/\//.test(p.image||'')?text(p.image):'',permalink:/^https:\/\//.test(p.permalink||'')?text(p.permalink):''}));
  base.orders=source.orders.map(o=> { if(!Number.isFinite(o.total)||o.total<0) throw new Error('备份订单金额无效'); return {id:text(o.id,100),status:text(o.status,40),total:o.total,currency:text(o.currency,10),date:text(o.date,100),items:[]}; });
  const csv=['date,campaign,spend,impressions,clicks,purchases,revenue,currency',...source.ads.map(r=>[r.date,r.campaign,r.spend,r.impressions,r.clicks,r.purchases,r.revenue,r.currency||'USD'].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(','))].join('\n');
  base.ads=source.ads.length?mergeAds([],parseAds(csv)):[];
  base.assets=source.assets.map(a=>({...assetValues(a),id:text(a.id,100),createdAt:text(a.createdAt,100)}));
  if(base.assets.reduce((n,a)=>n+a.dataUrl.length,0)>24000000) throw new Error('素材总量超过第一版 24MB 限制');
  base.tasks=source.tasks.map(t=>({...taskValues(t),id:text(t.id,100),createdAt:text(t.createdAt,100)}));
  base.plans=source.plans.map(p=>({id:text(p.id,100),brief:text(p.brief,6000),content:text(p.content,40000),model:text(p.model,100),productId:p.productId?text(p.productId,100):null,createdAt:text(p.createdAt,100),executed:false}));
  base.reports=source.reports.map(r=>({id:text(r.id,100),createdAt:text(r.createdAt,100),period:text(r.period,100),mode:'从备份恢复的历史复盘',findings:Array.isArray(r.findings)?r.findings.map(x=>text(x)):[],next:Array.isArray(r.next)?r.next.map(t=>({title:text(t.title),owner:text(t.owner,100),due:text(t.due,30)})):[]}));
  base.lastSync=source.lastSync?text(source.lastSync,100):null; base.orderWindow=text(source.orderWindow,200);
  return base;
}
function taskValues(t) {
  const title=text(t.title,300); if(!title) throw new Error('任务名称不能为空');
  if(!modules.some(m=>m[0]===t.module)) throw new Error('任务模块无效');
  if(!['todo','doing','done'].includes(t.status||'todo')) throw new Error('任务状态无效');
  const due=text(t.due,10); if(due && (!/^\d{4}-\d{2}-\d{2}$/.test(due)||Number.isNaN(Date.parse(due)))) throw new Error('截止日期无效');
  return {title,module:t.module,status:t.status||'todo',owner:text(t.owner,100)||'店主',due};
}
function assetValues(a) {
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(a.dataUrl||'');
  if(!match) throw new Error('素材仅支持 PNG / JPEG / WebP 图片；视频生成与视频文件管理待下一阶段接入');
  const bytes=Buffer.from(match[2],'base64');
  const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid||bytes.length>4000000) throw new Error('图片格式不符或超过 4MB');
  return {name:text(a.name,200)||'未命名图片',productId:text(a.productId,100),rights:text(a.rights,1000),dataUrl:a.dataUrl};
}
async function body(req) {
  let size=0; const chunks=[];
  for await (const chunk of req) { size+=chunk.length; if(size>32000000) throw new Error('请求超过 32MB'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new Error('JSON 数据无效'); }
}
export async function createService({dataDir=path.resolve('.local-data'),vault,port=0,integrations={syncWoo,generatePlan}}={}) {
  const store=await new Store(dataDir).init(); let sessionSecrets={};
  vault??={persistent:false,read:async()=>sessionSecrets,write:async x=>{sessionSecrets=x;}};
  const token=randomBytes(32).toString('hex'); let origin, syncing=false, generating=false;
  const html=await fs.readFile(path.join(uiDir,'index.html'),'utf8');
  const server=http.createServer(async(req,res)=> {
    const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    try {
      if(req.headers.host!==new URL(origin).host) return json(403,{error:'Host rejected'});
      const url=new URL(req.url,origin), method=req.method;
      if(req.headers.origin && req.headers.origin!==origin) return json(403,{error:'跨站请求已拒绝'});
      if(url.pathname.startsWith('/api/')) {
        const supplied=Buffer.from(req.headers['x-luvtora-token']||''); const expected=Buffer.from(token);
        if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)) return json(403,{error:'会话验证失败，请重新打开程序'});
        if(method==='GET' && url.pathname==='/api/state') {
          const c=await vault.read(); return json(200,{...store.state,modules,metrics:metrics(store.state),connections:{woo:!!(c.wooKey&&c.wooSecret),ai:!!c.aiKey,persistent:vault.persistent,meta:false,codex:false,google:false,tiktok:false},runtime:{mode:'本地运行，关闭程序后任务不执行',syncing,generating}});
        }
        if(method==='GET' && url.pathname==='/api/backup') return json(200,{format:'luvtora-backup-v1',exportedAt:new Date().toISOString(),state:store.state});
        if(method!=='POST') return json(404,{error:'接口不存在'});
        if(!req.headers['content-type']?.startsWith('application/json')) return json(415,{error:'需要 JSON 请求'});
        const input=await body(req);
        switch(url.pathname) {
          case '/api/settings': {
            const settings=settingValues(input,store.state.settings), c=await vault.read();
            const siteChanged=new URL(settings.site).origin!==new URL(store.state.settings.site).origin;
            if(siteChanged) {delete c.wooKey;delete c.wooSecret;}
            for(const k of ['wooKey','wooSecret','aiKey']) if(input[k]) { if(typeof input[k]!=='string'||input[k].length>1000) throw new Error('凭证格式无效'); c[k]=input[k].trim(); }
            if(input.clearWoo) { delete c.wooKey; delete c.wooSecret; }
            if(input.clearAI) delete c.aiKey;
            await vault.write(c); await store.change('更新品牌、预算或连接设置（不记录凭证）',s=>{s.settings=settings;if(siteChanged){s.products=[];s.orders=[];s.lastSync=null;s.orderWindow='';}}); break;
          }
          case '/api/woo/sync': {
            if(syncing) return json(409,{error:'同步正在进行'}); syncing=true;
            try { const site=store.state.settings.site; const synced=await integrations.syncWoo(site,await vault.read()); await store.change('WooCommerce 只读同步商品和近 30 天订单',s=>{if(s.settings.site!==site) throw new Error('同步期间站点已改变，请重新同步');Object.assign(s,synced);}); } finally {syncing=false;} break;
          }
          case '/api/ads/import': { const rows=parseAds(String(input.csv||'')); await store.change(`导入 ${rows.length} 行 USD 广告报表（按日期和广告名称去重）`,s=>{s.ads=mergeAds(s.ads,rows);}); break; }
          case '/api/tasks/save': {
            const values=taskValues(input);
            await store.change('保存运营任务',s=>{const found=s.tasks.find(t=>t.id===input.id);if(input.id&&!found) throw new Error('任务不存在');if(found)Object.assign(found,values);else s.tasks.push({...values,id:crypto.randomUUID(),createdAt:new Date().toISOString()});});break;
          }
          case '/api/tasks/delete': await store.change('删除运营任务',s=>{s.tasks=s.tasks.filter(t=>t.id!==input.id);}); break;
          case '/api/assets/add': {const values=assetValues(input);await store.change('添加本地图片素材',s=>{if(s.assets.reduce((n,a)=>n+a.dataUrl.length,0)+values.dataUrl.length>24000000)throw new Error('素材总量超过第一版 24MB 限制');s.assets.unshift({...values,id:crypto.randomUUID(),createdAt:new Date().toISOString()});});break;}
          case '/api/assets/delete': await store.change('删除本地图片素材',s=>{s.assets=s.assets.filter(a=>a.id!==input.id);});break;
          case '/api/plans/generate': {
            if(generating) return json(409,{error:'已有 AI 方案生成任务，请稍候'}); generating=true;
            try {const plan=await integrations.generatePlan(structuredClone(store.state),await vault.read(),input);await store.change('通过已配置 API 生成方案（未发布或执行）',s=>s.plans.unshift(plan));}finally{generating=false;}break;
          }
          case '/api/reports/create': await store.change('手动生成规则复盘',s=>s.reports.unshift(makeReport(s)));break;
          case '/api/backup/restore': {const restored=validateBackup(input);if(syncing||generating)throw new Error('请等待当前任务完成后恢复备份');if(new URL(restored.settings.site).origin!==new URL(store.state.settings.site).origin){const c=await vault.read();delete c.wooKey;delete c.wooSecret;await vault.write(c);}await store.change('恢复本地备份（不含凭证；跨站恢复清除店铺凭证）',s=>{for(const k of Object.keys(s))delete s[k];Object.assign(s,restored);});break;}
          default:return json(404,{error:'接口不存在'});
        }
        return json(200,{ok:true});
      }
      if(method!=='GET')return json(405,{error:'方法不支持'});
      res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
      if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html.replace('SESSION_TOKEN',token));}
      const files={'/app.js':'text/javascript; charset=utf-8','/style.css':'text/css; charset=utf-8'};
      if(files[url.pathname]){res.setHeader('Content-Type',files[url.pathname]);return res.end(await fs.readFile(path.join(uiDir,url.pathname.slice(1))));}
      json(404,{error:'资源不存在'});
    } catch(error) {json(400,{error:error.message});}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  origin='http://127.0.0.1:'+server.address().port;
  return {server,url:origin,store};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const service=await createService({port:Number(process.env.LUVTORA_PORT||4317),dataDir:process.env.LUVTORA_DATA_DIR||path.resolve('.local-data')});
  console.log('Luvtora development server:',service.url,'（开发模式凭证仅存于内存）');
}
