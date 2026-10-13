import { promises as fs } from 'node:fs';
import path from 'node:path';
import { initialState } from './domain.js';
export class Store {
  constructor(dir) { this.dir=dir; this.file=path.join(dir,'state.json'); this.tail=Promise.resolve(); }
  async init() {
    await fs.mkdir(this.dir,{recursive:true,mode:0o700});
    try { this.state=JSON.parse(await fs.readFile(this.file,'utf8')); if(this.state.version!==1) throw new Error('不支持此数据版本'); }
    catch(e) { if(e.code!=='ENOENT') throw e; this.state=initialState(); await this.persist(this.state); }
    return this;
  }
  async persist(state) { const temp=this.file+'.tmp'; await fs.writeFile(temp,JSON.stringify(state),{mode:0o600}); await fs.rename(temp,this.file); }
  change(action,fn) {
    const next=this.tail.catch(()=>{}).then(async()=> {
      const state=structuredClone(this.state); const result=fn(state);
      state.audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),action}); state.audit=state.audit.slice(0,300);
      await this.persist(state); this.state=state; return result;
    }); this.tail=next; return next;
  }
}
