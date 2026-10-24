import test from 'node:test';
import assert from 'node:assert/strict';
import {SYNTHETIC_STORY,createSyntheticEvidence} from '../model-evidence.mjs';
test('only fixed synthetic fixture can create a no-content local model evidence report',()=>{
 assert.ok(SYNTHETIC_STORY.includes('Cần Thơ'));
 const report=createSyntheticEvidence({mode:'synthetic',modelId:'Qwen2.5-0.5B-Instruct-q4f32_1-MLC',
  gpuAdapter:true,elapsedMs:1234.7,
  segments:[{id:'seg-001',text:'Bản ghi hư cấu: một người kể về quê.'}],
  editorial:{chapters:[{paragraphs:[{text:'Chuyện cá nhân không được lưu vào báo cáo.',sourceSegmentIds:['seg-001']}]}],
   warnings:[{type:'unmatched_number',term:'1985'}]}
 });
 assert.equal(report.status,'MODEL_RETURNED_STRUCTURED_DRAFT');
 assert.equal(report.elapsedMs,1235);
 assert.equal(report.paragraphCount,1);
 assert.equal(report.sourceSegmentCount,1);
 assert.equal(report.distinctCitations,1);
 assert.equal(report.numberFlags,1);
 assert.equal(report.containsTranscript,false);
 assert.equal(report.containsGeneratedText,false);
 const serialized=JSON.stringify(report);
 assert.doesNotMatch(serialized,/Chuyện cá nhân|Bản ghi hư cấu|1985|Cần Thơ/);
 assert.match(report.meaning,/does not prove/);
});
test('error reports include an allowlisted code but no error text, URL or device fingerprint',()=>{
 const report=createSyntheticEvidence({mode:'synthetic',modelId:'Qwen2.5-0.5B-Instruct-q4f32_1-MLC',
  gpuAdapter:false,elapsedMs:17,errorCode:'NO_WEBGPU'});
 assert.equal(report.status,'NO_WEBGPU');
 assert.equal(report.chapterCount,0);
 assert.equal(report.sourceSegmentCount,0);
 assert.equal(report.elapsedMs,17);
 assert.deepEqual(Object.keys(report).filter(x=>/url|useragent|hardware|transcript|generatedText/i.test(x)),
  ['containsTranscript','containsGeneratedText']);
});
test('refuse non-synthetic telemetry and forged citations',()=>{
 const baseline={modelId:'model',gpuAdapter:true,elapsedMs:1};
 assert.throws(()=>createSyntheticEvidence({...baseline,mode:'personal'}),/synthetic_only/);
 assert.throws(()=>createSyntheticEvidence({...baseline,mode:'synthetic',errorCode:'secret private story'}),/invalid_error/);
 assert.throws(()=>createSyntheticEvidence({...baseline,mode:'synthetic',segments:[],
  editorial:{chapters:[{paragraphs:[{text:'Test',sourceSegmentIds:['invented']}]}]}}),
  /invalid_citation/);
});
