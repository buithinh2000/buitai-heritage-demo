import test from 'node:test';
import assert from 'node:assert/strict';
import {MODEL_ID,segmentVietnameseNarration,makeEditorialPrompt,validateMemoirDraft,generateMemoir,assessEditedMemoir}
 from '../memoir-ai.mjs';

const speech='Tôi sống ở Huế với bà ngoại. Tết đến cả nhà gói bánh. Tôi không nhớ ngày nào.';
const sample=()=>{
 const segments=segmentVietnameseNarration(speech);
 return {segments,result:{title:'Ký ức ngày Tết',chapters:[
  {title:'Tuổi thơ',paragraphs:[{text:'Tôi sống ở Huế cùng bà ngoại.',
   sourceSegmentIds:['seg-001']}]},
  {title:'Ngày Tết',paragraphs:[{text:'Cả nhà cùng gói bánh vào dịp Tết.',
   sourceSegmentIds:['seg-002']}]}
 ]}};
};
test('Vietnamese narration becomes deterministic bounded source segments',()=>{
 const result=segmentVietnameseNarration(speech);
 assert.ok(result.length>=2);
 assert.equal(result[0].id,'seg-001');
 assert.match(result[0].text,/Huế/);
 assert.throws(()=>segmentVietnameseNarration('hi'),/source_length/);
 assert.throws(()=>segmentVietnameseNarration('x'.repeat(5001)),/source_length/);
 const prompt=makeEditorialPrompt(result);
 assert.match(prompt,/Không bịa|không tự thêm/iu);
 assert.match(prompt,/seg-001/);
});
test('model output must preserve real paragraph citations and require narrator approval',()=>{
 const {segments,result}=sample();
 const draft=validateMemoirDraft(JSON.stringify(result),segments);
 assert.equal(draft.reviewStatus,'NEEDS_NARRATOR_APPROVAL');
 assert.equal(draft.chapters.length,2);
 assert.deepEqual(draft.chapters[1].paragraphs[0].sourceSegmentIds,['seg-002']);
 assert.throws(()=>validateMemoirDraft(JSON.stringify({...result,chapters:[
  {title:'Sai',paragraphs:[{text:'Bịa thêm.',sourceSegmentIds:['seg-999']}]}]}),segments),/unsourced_paragraph/);
 assert.throws(()=>validateMemoirDraft('this is prose',segments),/invalid_json/);
});
test('unmentioned numbers are review flags not automatic truth approval',()=>{
 const {segments,result}=sample();
 result.chapters[0].paragraphs[0].text='Năm 1985, tôi sống ở Huế.';
 const draft=validateMemoirDraft(result,segments);
 assert.ok(draft.warnings.some(x=>x.term==='1985'));
 assert.equal(draft.reviewStatus,'NEEDS_NARRATOR_APPROVAL');
});
test('fake model adapter only tests control flow and always unloads, not real inference',async()=>{
 const {segments,result}=sample();
 let seenModel='',unloaded=false,requested=[],progress=[];
 const createEngine=async(model,opts)=>{
  seenModel=model;opts.initProgressCallback({text:'Loaded simulated engine'});
  return {chat:{completions:{create:async x=>{
   requested=x.messages;
   return {choices:[{message:{content:JSON.stringify(result)}}]};
  }}},unload:async()=>{unloaded=true}};
 };
 const out=await generateMemoir(speech,{createEngine,onProgress:x=>progress.push(x)});
 assert.equal(seenModel,MODEL_ID);
 assert.equal(out.segments.length,segments.length);
 assert.equal(out.editorial.reviewStatus,'NEEDS_NARRATOR_APPROVAL');
 assert.ok(requested.some(x=>x.role==='user'&&x.content.includes('seg-001')));
 assert.ok(progress.some(x=>/simulated/.test(x)));
 assert.equal(unloaded,true);
});
test('AI failure never fabricates a success memoir',async()=>{
 let unloaded=false;
 await assert.rejects(
  generateMemoir(speech,{createEngine:async()=>({
   chat:{completions:{create:async()=>({choices:[{message:{content:'Not JSON'}}]})}},
   unload:async()=>{unloaded=true}
  })}),/invalid_json/);
 assert.equal(unloaded,true);
});

test('post-edit warning recalculation flags unsupported years and proper names without approval',()=>{
 const {segments,result}=sample();
 result.chapters[0].paragraphs[0].text='Năm 1975 tôi đã tới Đà Nẵng.';
 const cues=assessEditedMemoir(result,segments);
 assert.ok(cues.some(w=>w.term==='1975'&&w.type==='unmatched_number'));
 assert.ok(cues.some(w=>w.term==='Đà Nẵng'&&w.type==='unmatched_capitalization'));
 result.chapters[0].paragraphs[0].text='Tôi sống ở Huế với bà ngoại.';
 const after=assessEditedMemoir(result,segments);
 assert.equal(after.some(w=>w.term==='1975'),false);
 assert.equal(after.some(w=>w.term==='Đà Nẵng'),false);
 assert.equal(result.chapters[0].paragraphs[0].sourceSegmentIds[0],'seg-001');
});
