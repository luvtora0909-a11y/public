import test from 'node:test';
import assert from 'node:assert/strict';
import {generateSupportReply} from '../src/integrations.js';
import {initialState} from '../src/domain.js';
test('multilingual replies use structured output, contain separate customer text and never claim sending',async t=>{
  const previous=globalThis.fetch;t.after(()=>{globalThis.fetch=previous;});let captured;
  globalThis.fetch=async(url,options)=>{captured=JSON.parse(options.body);return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({detectedLanguage:'es',summaryZh:'客户询问配送',reply:'Vamos a verificar el estado del pedido.',needsReview:true,reviewNotes:['缺少核实的物流状态']})}]}]})};};
  const d=await generateSupportReply(initialState(),{aiKey:'fixture-only'},{channel:'Instagram',language:'es',message:'¿Dónde está mi pedido?',facts:'',policy:''});
  assert.equal(d.language,'es');assert.equal(d.sent,false);assert.equal(d.needsReview,true);assert.match(d.reply,/verificar/);
  assert.equal(captured.text.format.type,'json_schema');assert.equal(captured.store,false);assert.match(captured.instructions,/不编造/);
  assert.equal(JSON.parse(captured.input).targetLanguage,'es');assert.equal(JSON.stringify(d).includes('fixture-only'),false);
  await assert.rejects(generateSupportReply(initialState(),{aiKey:'fixture-only'},{channel:'Instagram',language:'unknown',message:'hi'}),/目标语言/);
});
test('missing key and malformed AI replies fail without saving or sending',async t=>{
  const previous=globalThis.fetch;t.after(()=>{globalThis.fetch=previous;});
  await assert.rejects(generateSupportReply(initialState(),{},{channel:'Instagram',language:'auto',message:'hi'}),/配置/);
  globalThis.fetch=async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'not JSON'}]}]})});
  await assert.rejects(generateSupportReply(initialState(),{aiKey:'fixture-only'},{channel:'Instagram',language:'auto',message:'hi'}),/结构无效/);
});
