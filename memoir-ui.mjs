import {generateMemoir,segmentVietnameseNarration,assessEditedMemoir,MODEL_CHOICES} from './memoir-ai.mjs';
import {SYNTHETIC_STORY,createSyntheticEvidence} from './model-evidence.mjs';
const $=id=>document.getElementById(id);
let output=null,working=false,originalSource='',lastGpuCheck=null,
 selectedModel=MODEL_CHOICES.quality,
 syntheticFixtureActive=false,syntheticEvidence=null;
function setEvidence(report){
 syntheticEvidence=report;
 $('model-evidence').hidden=!syntheticFixtureActive;
 $('evidence-download').disabled=!report;
 if(!report){
  $('evidence-status').textContent='Chưa chạy AI với câu chuyện hư cấu trên thiết bị này.';
 }else{
  $('evidence-status').textContent=report.status==='MODEL_RETURNED_STRUCTURED_DRAFT'?
   'Model đã trả về JSON hợp lệ: '+report.chapterCount+' chương, '+report.paragraphCount+
   ' đoạn, tổng thời gian '+report.elapsedMs+' ms. Chất lượng tiếng Việt và độ đúng sự thật CHƯA được xác minh.':
   'Lần chạy chưa thành công ('+report.status+'), thời gian '+report.elapsedMs+
   ' ms. Báo cáo không có dữ liệu cá nhân.';
 }
}
function setStatus(x){$('model-status').textContent=x}
function clearResult(){
 output=null;$('draft-area').hidden=true;$('draft-content').replaceChildren();
 $('warning-list').replaceChildren();$('draft-status').textContent='Chưa tạo bản thảo.';
}
function controls(){
 const v=$('narration').value;$('source-count').textContent=v.length+'/5000 ký tự';
 $('generate').disabled=working||!$('allow-model').checked||v.trim().length<25||v.length>5000;
 $('narration').disabled=working;$('synthetic').disabled=working;$('erase').disabled=working;
 $('allow-model').disabled=working;
 $('gpu-check').disabled=working;
 $('model-choice').disabled=working;
}
try{
 const handoff=sessionStorage.getItem('heritage-memoir-handoff-v1');
 sessionStorage.removeItem('heritage-memoir-handoff-v1');
 if(handoff&&handoff.length<=5500){const j=JSON.parse(handoff);if(typeof j?.text==='string'&&j.text.length<=5000)$('narration').value=j.text}
}catch{try{sessionStorage.removeItem('heritage-memoir-handoff-v1')}catch{}}
controls();
async function checkWebGpu(){
 if(!navigator.gpu?.requestAdapter){
  lastGpuCheck=false;
  $('gpu-status').textContent='Không có WebGPU trên trình duyệt này. Chưa tải gì.';
  return false;
 }
 try{
  const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
  const needsF16=$('model-choice').value==='quality';
  const hasF16=!!adapter?.features?.has?.('shader-f16');
  lastGpuCheck=!!adapter&&(!needsF16||hasF16);
  $('gpu-status').textContent=!adapter?
   'Trình duyệt không cấp WebGPU adapter. Không nên tải model. Chưa tải AI.':
   needsF16&&!hasF16?
   'Qwen 1.5B cần shader-f16 nhưng GPU không báo hỗ trợ. Có thể chọn bản 0.5B chỉ để thử kỹ thuật, không tự chuyển. Chưa tải model.':
   'WebGPU adapter đạt kiểm tra sơ bộ cho '+(needsF16?'Qwen 1.5B':'Qwen 0.5B')+
   '. Chưa tải model; chưa bảo đảm đủ bộ nhớ GPU hoặc suy luận thành công.';
  return lastGpuCheck;
 }catch{
  lastGpuCheck=false;
  $('gpu-status').textContent='Kiểm tra GPU thất bại. Không tải model; có thể do quyền/driver/hệ điều hành.';
  return false;
 }
}
$('gpu-check').addEventListener('click',checkWebGpu);
if(!navigator.gpu)setStatus('Thiết bị chưa báo hỗ trợ WebGPU. AI trên trình duyệt nhiều khả năng không chạy được; không tự gửi transcript lên máy chủ.');
else setStatus('Có API WebGPU. Chưa tải model; hãy thử bằng dữ liệu hư cấu trước.');
$('narration').addEventListener('input',()=>{
 syntheticFixtureActive=false;setEvidence(null);clearResult();controls();
});
$('allow-model').addEventListener('change',controls);
$('model-choice').addEventListener('change',()=>{
 selectedModel=MODEL_CHOICES[$('model-choice').value]||MODEL_CHOICES.quality;
 lastGpuCheck=null;clearResult();setEvidence(null);controls();
 $('gpu-status').textContent='Đã đổi mô hình. Hãy kiểm tra WebGPU trước khi tải; không tự tải model.';
});
$('synthetic').addEventListener('click',()=>{
 $('narration').value=SYNTHETIC_STORY;
 syntheticFixtureActive=true;setEvidence(null);
 clearResult();controls();setStatus('Đã điền chuyện mẫu hư cấu. Chỉ tải model nếu tự nguyện đồng ý.');
});
$('erase').addEventListener('click',()=>{
 clearResult();$('narration').value='';$('allow-model').checked=false;originalSource='';
 syntheticFixtureActive=false;setEvidence(null);
 try{sessionStorage.removeItem('heritage-memoir-handoff-v1')}catch{}
 controls();setStatus('Đã xóa transcript và bản thảo trong trang. Model đã tải (nếu có) có thể còn trong bộ nhớ/cache của trình duyệt.');
});
function download(blob,filename){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function refreshWarnings(){
 if(!output)return;
 output.editorial.warnings=assessEditedMemoir(output.editorial,output.segments);
 const list=$('warning-list');list.replaceChildren();
 if(output.editorial.warnings.length){
  for(const w of output.editorial.warnings){
   const li=document.createElement('li');li.textContent='Chương '+(w.chapter+1)+', đoạn '+(w.paragraph+1)+': '+
    (w.type==='unmatched_number'?'Số':'Tên riêng/chữ hoa')+' “'+w.term+'” không có trong câu nguồn đã trích. Cần nghe lại audio gốc.';
   list.append(li);
  }
 }else{
  const li=document.createElement('li');li.textContent='Không tìm thấy tên/số lạ theo phép kiểm tra hạn chế. KHÔNG chứng minh AI hoặc nội dung đã sửa là đúng.';
  list.append(li);
 }
}
function render(){
 const root=$('draft-content');root.replaceChildren();
 const heading=document.createElement('h2');heading.textContent=output.editorial.title;root.append(heading);
 const sources=new Map(output.segments.map(s=>[s.id,s.text]));
 for(const [i,chapter] of output.editorial.chapters.entries()){
  const group=document.createElement('section');group.className='chapter';
  const h=document.createElement('h3');h.textContent='Chương '+(i+1)+' · '+chapter.title;group.append(h);
  for(const [j,p] of chapter.paragraphs.entries()){
   const article=document.createElement('article'),label=document.createElement('label');
   label.textContent='Đoạn '+(j+1)+' · chỉnh sửa nếu AI viết sai';
   const area=document.createElement('textarea');area.value=p.text;area.maxLength=1300;
   area.setAttribute('aria-label','Chương '+(i+1)+' đoạn '+(j+1));
   const printable=document.createElement('p');printable.className='print-paragraph';printable.textContent=p.text;
   area.addEventListener('input',()=>{
    p.text=area.value;printable.textContent=area.value;
    refreshWarnings();
    $('draft-status').textContent='Đã sửa bản nháp. VẪN CHƯA PHÊ DUYỆT.';
   });
   const cite=document.createElement('p');cite.className='cite';cite.textContent='Nguồn: '+p.sourceSegmentIds.map(id=>id+': '+sources.get(id)).join(' | ');
   article.append(label,area,printable,cite);group.append(article);
  }
  root.append(group);
 }
 refreshWarnings();
 $('draft-status').textContent='AI đã tạo bản nháp có dẫn nguồn. Cần kiểm tra từng câu với người kể.';
 $('draft-area').hidden=false;
 $('draft-area').scrollIntoView({block:'start',behavior:'smooth'});
}
$('generate').addEventListener('click',async()=>{
 if(working||!$('allow-model').checked)return;
 const start=performance.now(),isSample=syntheticFixtureActive&&$('narration').value===SYNTHETIC_STORY;
 let gpuReady=false,modelPhase='GPU';
 const recordFailure=code=>{
  if(!isSample)return;
  setEvidence(createSyntheticEvidence({mode:'synthetic',modelId:selectedModel,
   gpuAdapter:gpuReady,elapsedMs:performance.now()-start,errorCode:code}));
 };
 if(!await checkWebGpu()){
  setStatus('Không có WebGPU adapter sử dụng được. Không tải thư viện hoặc model.');
  recordFailure('NO_WEBGPU');return;
 }
 gpuReady=true;
 const text=$('narration').value.trim();
 try{segmentVietnameseNarration(text)}catch{
  setStatus('Lời kể quá ngắn, dài hoặc quá nhiều đoạn để thử model nhỏ.');
  return;
 }
 working=true;controls();clearResult();if(isSample)setEvidence(null);
 originalSource=text;
 try{
  // Consent gate already checked, synthetic sample is the only eligible telemetry.
  setStatus('Đang lấy thư viện AI đã chọn; có thể cần tải mô hình vào thiết bị…');
  modelPhase='IMPORT';
  const {CreateMLCEngine}=await import('https://esm.sh/@mlc-ai/web-llm@0.2.85?bundle');
  if(typeof CreateMLCEngine!=='function')throw Error('Missing WebLLM engine');
  modelPhase='INFERENCE';
  const result=await generateMemoir(text,{createEngine:CreateMLCEngine,onProgress:setStatus,modelId:selectedModel});
  output=result;render();
  if(isSample)setEvidence(createSyntheticEvidence({mode:'synthetic',
   modelId:selectedModel,gpuAdapter:true,elapsedMs:performance.now()-start,
   editorial:output.editorial,segments:output.segments}));
  setStatus('Đã biên tập bằng mô hình trên trình duyệt; phải kiểm tra nội dung trước khi dùng.');
 }catch(error){
  recordFailure(modelPhase==='IMPORT'?'MODEL_IMPORT_FAILED':
   /invalid_json|invalid_structure|invalid_chapter|unsourced_paragraph|too_long|response_too_large/u.test(String(error?.message||''))?
   'INVALID_MODEL_OUTPUT':'MODEL_LOAD_OR_GENERATION_FAILED');
  setStatus('Không tạo được bản AI: '+String(error?.message||error).slice(0,220)+
   '. Không có bản giả và không dùng API cloud BuiTai. Thử thiết bị hỗ trợ WebGPU hoặc chờ bản dịch vụ bảo mật.');
 }finally{working=false;controls()}
});
$('evidence-download').addEventListener('click',()=>{
 if(!syntheticFixtureActive||!syntheticEvidence)return;
 const safe=JSON.stringify(syntheticEvidence,null,2);
 download(new Blob([safe],{type:'application/json;charset=utf-8'}),
  'heritage-SYNTHETIC-model-check-no-story.json');
});
$('download-draft').addEventListener('click',()=>{
 if(!output)return;
 const payload={status:'NEEDS_NARRATOR_APPROVAL',engine:'browser-webgpu',modelId:selectedModel,
  sourceTranscript:originalSource,sourceSegments:output.segments,
  title:output.editorial.title,chapters:output.editorial.chapters,warnings:output.editorial.warnings,
  notice:'AI output is unverified. Not evidence of consent. Audio original must be reviewed separately.'};
 download(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),
  'heritage-ai-memoir-UNAPPROVED.json');
});
$('print-draft').addEventListener('click',()=>{if(output)window.print()});
window.addEventListener('beforeunload',e=>{if($('narration').value.trim()||output){e.preventDefault();e.returnValue=''}});
