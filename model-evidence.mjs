// Heritage local-first evidence reporter for ONE ACTUAL browser GPU model attempt.
// Reports ONLY synthetic fixture results. No personal text, generated prose, hardware
// fingerprint, origin URL or browser user agent. A report is NOT proof of narrator facts.
export const SYNTHETIC_STORY=[
 'Hồi nhỏ tôi sống ở Cần Thơ, gần một con sông.',
 'Tết đến, tôi cùng mẹ gói bánh tét và ngồi nghe bà kể chuyện.',
 'Tôi chỉ nhớ khoảng năm 1985 gia đình chuyển nhà, nhưng không nhớ chính xác ngày nào.'
].join('\n\n');
export function createSyntheticEvidence({mode,modelId,elapsedMs,gpuAdapter,editorial=null,segments=null,errorCode=null}){
 if(mode!=='synthetic')throw Error('evidence.synthetic_only');
 if(typeof modelId!=='string'||modelId.length>100||
   typeof elapsedMs!=='number'||!Number.isFinite(elapsedMs)||elapsedMs<0||
   typeof gpuAdapter!=='boolean')throw Error('evidence.invalid_metrics');
 const acceptable=['NO_WEBGPU','MODEL_IMPORT_FAILED','MODEL_LOAD_OR_GENERATION_FAILED',
  'INVALID_MODEL_OUTPUT','UNKNOWN_ERROR'];
 if(errorCode!==null&&!acceptable.includes(errorCode))throw Error('evidence.invalid_error');
 let chapterCount=0,paragraphCount=0,totalCitations=0,distinctCitations=0,numberFlags=0,nameFlags=0;
 if(editorial!==null){
  if(!Array.isArray(editorial?.chapters)||!Array.isArray(segments))throw Error('evidence.invalid_editorial');
  chapterCount=editorial.chapters.length;
  const sourceIds=new Set(segments.map(s=>s.id)),cited=new Set();
  for(const ch of editorial.chapters){
   for(const para of ch.paragraphs||[]){
    paragraphCount++;
    for(const id of para.sourceSegmentIds||[]){
     if(!sourceIds.has(id))throw Error('evidence.invalid_citation');
     totalCitations++;cited.add(id);
    }
   }
  }
  distinctCitations=cited.size;
  numberFlags=(editorial.warnings||[]).filter(w=>w.type==='unmatched_number').length;
  nameFlags=(editorial.warnings||[]).filter(w=>w.type==='unmatched_capitalization').length;
 }
 return {
  schema:'heritage.synthetic-local-model-evidence.v1',
  syntheticFixture:true,
  containsTranscript:false,
  containsGeneratedText:false,
  modelId,
  engine:'WebLLM (browser WebGPU)',
  status:errorCode||(!editorial?'NOT_COMPLETED':'MODEL_RETURNED_STRUCTURED_DRAFT'),
  gpuAdapter,
  elapsedMs:Math.round(elapsedMs),
  chapterCount,paragraphCount,totalCitations,distinctCitations,
  sourceSegmentCount:segments?.length||0,numberFlags,nameFlags,
  meaning:'A model-returned JSON draft with valid citation IDs does not prove Vietnamese accuracy, factual fidelity, data security or narrator consent. Actual speech recognizer and GPU model correctness require separate evaluation.'
 };
}
