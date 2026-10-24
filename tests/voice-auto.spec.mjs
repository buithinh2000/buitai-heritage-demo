import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

let browser,server,base;
before(async()=>{
 server=createServer(async(req,res)=>{
  if(!['/','/index.html','/voice-auto.html'].includes(req.url)){res.writeHead(404);res.end();return;}
  const name=req.url==='/'?'index.html':req.url.slice(1);
  const body=await readFile(resolve(name),'utf8');
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(body);
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
});
after(async()=>{await browser?.close();await new Promise(done=>server?.close(done))});
async function pageFor(mock='local'){
 const page=await browser.newPage({acceptDownloads:true});
 await page.addInitScript(mode=>{
  if(mode==='none'){
   Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:undefined});
   Object.defineProperty(window,'webkitSpeechRecognition',{configurable:true,value:undefined});
   return;
  }
  class Speech{
   static async available(){return mode==='local'?'available':'unavailable'}
   static async install(){return true}
   start(){
    window.__recognition=this;
    queueMicrotask(()=>{
     this.onresult?.({resultIndex:0,results:[{0:{transcript:'Tôi lớn lên ở Huế cùng ông bà.'},isFinal:true}]});
    });
   }
   stop(){this.onend?.()}
  }
  window.SpeechRecognition=Speech;
  window.webkitSpeechRecognition=Speech;
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{
   getUserMedia:async()=>({getTracks:()=>[{stop:()=>{window.__stopped=true}}]})
  }});
  class FakeMediaRecorder{
   constructor(stream){this.stream=stream;this.state='inactive';this.mimeType='audio/webm'}
   start(){this.state='recording'}
   stop(){
    this.state='inactive';
    queueMicrotask(()=>{
     this.ondataavailable?.({data:new Blob(['FAKE-AUDIO'],{type:'audio/webm'})});
     this.onstop?.();
    });
   }
  }
  window.MediaRecorder=FakeMediaRecorder;
 },mock);
 const requests=[];
 page.on('request',req=>{if(!req.url().startsWith(base)&&!req.url().startsWith('blob:'))requests.push(req.url())});
 await page.goto(base+'/voice-auto.html');
 return {page,requests};
}
test('front page exposes speech-first path before manual fallback',async()=>{
 const page=await browser.newPage();
 try{
  await page.goto(base+'/index.html');
  assert.equal(await page.locator('#voice-auto-link').getAttribute('href'),'./voice-auto.html');
  assert.match(await page.locator('#voice-auto-link').innerText(),/tự chép lời/i);
 }finally{await page.close()}
});
test('supported on-device Vietnamese speech → draft → text/audio export with no web requests',async()=>{
 const {page,requests}=await pageFor('local');
 try{
  assert.equal(await page.locator('#start').isDisabled(),true);
  await page.locator('#consent-record').check();
  await page.locator('#start').waitFor({state:'visible'});
  assert.equal(await page.locator('#start').isEnabled(),true);
  await page.locator('#start').click();
  await page.locator('#transcript').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.getElementById('transcript').value.includes('Huế'));
  assert.equal(await page.locator('#transcript').inputValue(),'Tôi lớn lên ở Huế cùng ông bà.');
  await page.locator('#stop').click();
  await page.waitForFunction(()=>!document.getElementById('download-audio').disabled);
  await page.locator('#transcript').fill('Tôi lớn lên ở Huế.');
  await page.locator('#preview').click();
  assert.match(await page.locator('#book').innerText(),/Tôi lớn lên ở Huế\./);
  assert.match(await page.locator('#book').innerText(),/CHƯA PHÊ DUYỆT/);
  const txtEvent=page.waitForEvent('download');
  await page.locator('#download-text').click();
  const txt=await txtEvent;
  assert.match(txt.suggestedFilename(),/chua-duyet/);
  const audioEvent=page.waitForEvent('download');
  await page.locator('#download-audio').click();
  assert.match((await audioEvent).suggestedFilename(),/giong-noi-goc/);
  assert.deepEqual(requests,[]);
 }finally{await page.close()}
});
test('remote browser engine requires separate informed consent; no auto fallback',async()=>{
 const {page,requests}=await pageFor('remote');
 try{
  await page.locator('#consent-record').check();
  assert.equal(await page.locator('#start').isDisabled(),true);
  await page.locator('#recognition-mode').selectOption('browser');
  assert.equal(await page.locator('#remote-label').isVisible(),true);
  assert.equal(await page.locator('#start').isDisabled(),true);
  await page.locator('#consent-remote').check();
  assert.equal(await page.locator('#start').isEnabled(),true);
  await page.locator('#start').click();
  await page.waitForFunction(()=>document.getElementById('transcript').value.includes('Huế'));
  await page.locator('#consent-remote').uncheck();
  assert.equal(await page.locator('#transcript').inputValue(),'');
  await page.waitForTimeout(120);
  assert.equal(await page.locator('#download-audio').isDisabled(),true);
  assert.equal(await page.locator('#playback').isHidden(),true);
  assert.deepEqual(requests,[]);
 }finally{await page.close()}
});
test('unsupported browser cannot fake recognition output',async()=>{
 const {page}=await pageFor('none');
 try{
  await page.locator('#consent-record').check();
  await page.locator('#recognition-mode').selectOption('browser');
  await page.locator('#consent-remote').check();
  assert.equal(await page.locator('#start').isDisabled(),true);
  assert.match(await page.locator('#record-status').textContent(),/Không hỗ trợ/);
  assert.equal(await page.locator('#transcript').inputValue(),'');
 }finally{await page.close()}
});
