const $=id=>document.getElementById(id),root=document.documentElement;
const ADOBE=["Animals","Buildings and Architecture","Business","Drinks","The Environment","States of Mind","Food","Graphic Resources","Hobbies and Leisure","Industry","Landscapes","Lifestyle","People","Plants and Flowers","Culture and Religion","Science","Social Issues","Sports","Technology","Transport","Travel"];
const SS=["Abstract","Animals/Wildlife","Arts","Backgrounds/Textures","Beauty/Fashion","Buildings/Landmarks","Business/Finance","Celebrities","Education","Food and Drink","Healthcare/Medical","Holidays","Industrial","Interiors","Miscellaneous","Nature","Objects","Parks/Outdoor","People","Religion","Science","Signs/Symbols","Sports/Recreation","Technology","Transportation","Vintage"];
const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
const MODELS=[['gemini-3.1-flash-lite','Gemini 3.1 Flash-Lite (recommended)'],['gemini-3.5-flash','Gemini 3.5 Flash'],['gemini-3-flash-preview','Gemini 3 Flash Preview'],['gemini-2.5-flash','Gemini 2.5 Flash'],['gemini-2.5-flash-lite','Gemini 2.5 Flash-Lite'],['gemini-2.5-pro','Gemini 2.5 Pro']];
let cfg=store.get('mn-cfg',{});
cfg={keys:Array.isArray(cfg.keys)?cfg.keys:String(cfg.keys||'').split('\n').map(x=>x.trim()).filter(Boolean),model:MODELS.some(m=>m[0]===cfg.model)?cfg.model:MODELS[0][0]};
let imgs=[],busy=false,stop=false,prog='';
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const LOGS=store.get('mn-log',[]),pad=n=>String(n).padStart(2,'0');
let logReady=false,logTouched=false;
const setLog=o=>{$('pbox').classList.toggle('min',!o);$('ltog').textContent=o?'Hide':'Show';if(o)$('log').scrollTop=$('log').scrollHeight};
function addLine(e){
  const d=document.createElement('div');d.className='ll l-'+e.l;
  [['lt',e.t],['lv',{info:'INFO',ok:'OK',warn:'WARN',err:'ERR'}[e.l]],['',e.m]].forEach(([c,t])=>{const x=document.createElement('span');if(c)x.className=c;x.textContent=t;d.appendChild(x)});
  const b=$('log'),near=b.scrollHeight-b.scrollTop-b.clientHeight<40;b.appendChild(d);if(near)b.scrollTop=b.scrollHeight;
}
function log(l,m){
  const n=new Date(),e={t:pad(n.getHours())+':'+pad(n.getMinutes())+':'+pad(n.getSeconds()),l,m};
  LOGS.push(e);if(LOGS.length>500)LOGS.shift();store.set('mn-log',LOGS);addLine(e);
  if(logReady&&!logTouched&&$('pbox').classList.contains('min'))setLog(true);
}
$('lclr').onclick=()=>{LOGS.length=0;$('log').innerHTML='';store.set('mn-log',[]);log('info','Log cleared')};
$('ltog').onclick=()=>{logTouched=true;setLog($('pbox').classList.contains('min'))};
$('lcopy').onclick=async()=>{
  const t=LOGS.map(e=>e.t+' ['+e.l.toUpperCase()+'] '+e.m).join('\n');
  try{await navigator.clipboard.writeText(t);log('info','Log copied to clipboard')}catch{log('warn','Could not copy the log')}
};

/* tema */
const modeBtn=$('mode');
modeBtn.onclick=()=>{const d=root.dataset.theme!=='dark';root.dataset.theme=d?'dark':'light';modeBtn.setAttribute('aria-checked',d);log('info','Theme: '+(d?'dark':'light'))};

/* modal umum */
function modal(title,html,btns){
  $('mT').textContent=title;$('mB').innerHTML=html;$('mX').innerHTML='';
  btns.forEach(([l,fn])=>{const b=document.createElement('button');b.className='btn';b.textContent=l;b.onclick=fn;$('mX').appendChild(b)});
  $('modal').hidden=false;
}
const closeM=()=>{$('modal').hidden=true};
$('modal').onclick=e=>{if(e.target===$('modal'))closeM()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeM()});
const note=(t,m)=>modal(t,'<p>'+esc(m)+'</p>',[['OK',closeM]]);

/* tampilan */
function render(){
  const n=imgs.length,has=n>0;
  $('clear').hidden=$('gen').hidden=$('dl').hidden=!has;
  $('gen').textContent=busy?'Stop'+prog:'Generate';
  const g=$('grid');g.innerHTML='';
  if(!has)return;
  imgs.forEach((o,i)=>{
    const c=document.createElement('div');c.className='card';
    const t=document.createElement('div');t.className='tile';
    const im=document.createElement('img');im.src=o.url;im.alt='Uploaded image '+(i+1);t.appendChild(im);
    {const k=o.st||'p',s=document.createElement('span');s.className='st st-'+k;s.textContent={p:'Pending',run:'Processing…',ok:'Done',err:'Failed'}[k];t.appendChild(s)}
    const r=document.createElement('div');r.className='row';
    const e=document.createElement('button');e.className='del';e.textContent='Edit';e.onclick=()=>edit(i);
    const d=document.createElement('button');d.className='del';d.textContent='Delete';d.setAttribute('aria-label','Delete image '+(i+1));
    d.onclick=()=>{if(busy){log('warn','Delete blocked while generating: '+o.f.name);return}log('info','Deleted image: '+o.f.name);imgs.splice(i,1);render()};
    if(o.st==='err'){
      const x=document.createElement('button');x.className='del rg';x.setAttribute('aria-label','Regenerate image '+(i+1));
      x.innerHTML='<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/></svg><span>Regenerate</span>';
      x.disabled=busy;x.onclick=()=>{log('info','Regenerate requested: '+o.f.name);run([o])};r.append(e,x,d);
    }else r.append(e,d);
    c.append(t,r);g.appendChild(c);
  });
}

/* upload + duplikat */
$('upload').onclick=()=>$('file').click();
async function thumb(f){
  try{
    const b=await createImageBitmap(f),s=Math.min(1,400/Math.max(b.width,b.height));
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(b.width*s));c.height=Math.max(1,Math.round(b.height*s));
    c.getContext('2d').drawImage(b,0,0,c.width,c.height);b.close&&b.close();
    return c.toDataURL('image/jpeg',.8);
  }catch{
    log('warn','Thumbnail fallback used for '+f.name);
    return new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.onerror=()=>r('');fr.readAsDataURL(f)});
  }
}
$('file').onchange=async()=>{
  const all=[...$('file').files],fs=all.filter(f=>f.type.startsWith('image/'));$('file').value='';
  log('info','Upload: '+all.length+' file(s) selected'+(all.length>fs.length?', '+(all.length-fs.length)+' skipped (not an image)':''));
  const dups=[];
  for(const f of fs){
    const key=[f.name,f.size,f.lastModified].join('|');
    if(imgs.some(o=>o.key===key)){dups.push(f.name);log('warn','Skipped duplicate: '+f.name);continue}
    imgs.push({f,key,url:await thumb(f),st:'',title:'',kw:[],ac:1,sc:[],il:false});
    log('ok','Added: '+f.name+' ('+Math.round(f.size/1024)+' KB)');
  }
  log('info','Upload finished: '+(fs.length-dups.length)+' added, '+dups.length+' duplicate(s)');
  render();
  if(dups.length)note('Duplicate image',dups.length===1?'“'+dups[0]+'” was not added because it has already been uploaded.':dups.length+' images were not added because they have already been uploaded:\n'+dups.slice(0,5).join('\n')+(dups.length>5?'\n+'+(dups.length-5)+' more':''));
};
$('clear').onclick=()=>{if(busy){log('warn','Delete all blocked while generating');return}log('info','Deleted all images ('+imgs.length+')');imgs=[];render()};

/* API key settings */
const mask=k=>k.length>10?k.slice(0,4)+'••••'+k.slice(-4):'••••';
$('set').onclick=()=>{
  let ks=[...cfg.keys];
  log('info','Opened API Key settings ('+ks.length+' key(s) saved)');
  modal('Gemini API Key',
    '<div style="display:flex;flex-direction:column;gap:4px"><label for="fk">API Key</label>'+
    '<div style="display:flex;gap:8px;align-items:stretch"><div class="kf" style="flex:1;min-width:0"><input id="fk" type="password" autocomplete="off" spellcheck="false" placeholder="Paste API Key">'+
    '<button type="button" class="kbtn" id="kb" aria-label="Show saved API Keys" hidden><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button></div><button type="button" class="btn" id="ka" style="height:auto">Add</button></div>'+
    '<div id="kl" hidden></div></div>'+
    '<label>Model<select id="fm">'+MODELS.map(([v,l])=>'<option value="'+v+'"'+(v===cfg.model?' selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
    '<small>Use multiple Gemini API Keys from different Google accounts</small>',
    [['Done',()=>{add();commit();closeM()}]]);
  const commit=()=>{cfg={keys:ks,model:$('fm').value};store.set('mn-cfg',cfg)};
  const draw=()=>{
    $('kb').hidden=!ks.length;
    if(!ks.length){$('kl').hidden=true;$('kb').classList.remove('open')}
    $('kl').innerHTML='';
    ks.forEach((k,i)=>{
      const r=document.createElement('div');r.className='kr';
      const t=document.createElement('span');t.textContent=(i+1)+'. '+mask(k);
      const d=document.createElement('button');d.className='del';d.textContent='Delete';d.onclick=()=>{log('info','API Key removed: #'+(i+1)+' '+mask(k));ks.splice(i,1);commit();draw()};
      r.append(t,d);$('kl').appendChild(r);
    });
  };
  const add=()=>{
    const v=$('fk').value.replace(/\s+/g,'');$('fk').value='';
    if(v&&!ks.includes(v)){ks.push(v);commit();draw();$('kl').hidden=false;$('kb').classList.add('open');log('ok','API Key added: '+mask(v)+' ('+ks.length+' saved)')}
    else if(v)log('warn','API Key already saved: '+mask(v));
  };
  $('fk').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add()}};
  $('ka').onclick=add;
  $('kb').onclick=()=>{const o=$('kl').hidden;$('kl').hidden=!o;$('kb').classList.toggle('open',o)};
  $('fm').onchange=()=>{commit();log('info','Model changed to '+cfg.model)};
  draw();
  if(matchMedia('(hover:hover)').matches)$('fk').focus();
};

/* gemini */
async function shrink(f){
  const b=await createImageBitmap(f),s=Math.min(1,1024/Math.max(b.width,b.height));
  const c=document.createElement('canvas');c.width=Math.round(b.width*s);c.height=Math.round(b.height*s);
  c.getContext('2d').drawImage(b,0,0,c.width,c.height);b.close&&b.close();
  return c.toDataURL('image/jpeg',.85).split(',')[1];
}
const prompt=()=>'You are a microstock metadata expert. Analyze the image and reply ONLY with JSON: {"title":"descriptive English title, max 150 characters","keywords":["exactly 60 distinct, relevant keywords (single words or short phrases), most important first"],"adobe":<number from: '+ADOBE.map((c,i)=>(i+1)+'='+c).join(', ')+'>,"shutterstock":["1 or 2 names from: '+SS.join(', ')+'"],"illustration":<true if illustration, vector or 3D render, else false>}. Never use brand names, trademarks or personal names. Choose the Adobe category by the main subject (for example Animals for animal subjects, Technology for computers); use People only when human figures are the main subject.';
const clean=k=>String(k).trim().toLowerCase().replace(/\s+/g,' ');
const more=o=>'Image title: "'+o.title+'". Existing keywords: '+o.kw.join(', ')+'. Reply ONLY with JSON {"keywords":[...]} containing '+(55-o.kw.length)+' NEW distinct relevant microstock keywords that are not in the existing list, most important first. No brand names.';
async function gem0(key,parts,signal){
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(cfg.model)+':generateContent',{
    method:'POST',signal,headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify({contents:[{parts}],generationConfig:{responseMimeType:'application/json',temperature:.4}})
  });
  if(!r.ok){let m='';try{m=((await r.json()).error||{}).message||''}catch{}const e=new Error('HTTP '+r.status+(m?' - '+m.slice(0,160):''));e.status=r.status;throw e}
  const j=await r.json(),c=j.candidates?.[0],t=(c?.content?.parts||[]).map(p=>p.text||'').join('');
  if(!t)throw new Error('Empty response ('+(j.promptFeedback?.blockReason||c?.finishReason||'no candidates')+')');
  try{return JSON.parse(t.replace(/```json|```/g,'').trim())}catch{throw new Error('Invalid JSON in response')}
}
const TIMEOUT=60000;
async function gem(key,parts){
  const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),TIMEOUT);
  try{return await gem0(key,parts,ac.signal)}
  catch(e){if(e.name==='AbortError')throw new Error('Timeout: no response after '+TIMEOUT/1000+'s');throw e}
  finally{clearTimeout(tm)}
}
const ask=(key,b64)=>gem(key,[{text:prompt()},{inline_data:{mime_type:'image/jpeg',data:b64}}]);
function apply(o,r){
  o.title=String(r.title||'').trim().slice(0,200);
  o.kw=[...new Set((r.keywords||[]).map(clean).filter(Boolean))].slice(0,50);
  o.ac=Math.min(21,Math.max(1,Math.round(+r.adobe)||1));
  o.sc=(r.shutterstock||[]).filter(c=>SS.includes(c)).slice(0,2);
  o.il=!!r.illustration;
}

/* generate dengan rotasi key */
$('gen').onclick=()=>{
  if(busy){stop=true;log('warn','Stop requested');return}
  const todo=imgs.filter(o=>o.st!=='ok');
  if(!todo.length){log('info','Generate skipped: all images already have metadata');note('Generate','All images already have metadata.');return}
  run(todo);
};
async function run(todo){
  if(busy)return;
  const keys=cfg.keys;
  if(!keys.length){log('warn','Generate blocked: no API Key saved');$('set').click();return}
  busy=true;stop=false;render();
  log('info','Generate started: '+todo.length+' image(s), '+keys.length+' key(s), model '+cfg.model);
  const cool=keys.map(()=>0),nm=k=>'Key #'+(k+1)+' ('+mask(keys[k])+')';
  let done=0,fail=0,good=0,last=-1;
  for(const o of todo){
    if(stop)break;
    prog=' '+(done+1)+'/'+todo.length;
    o.st='run';render();
    log('info','['+(done+1)+'/'+todo.length+'] Processing '+o.f.name);
    let ok=false;
    try{
      const b64=await shrink(o.f);
      log('info','Resized '+o.f.name+' for upload ('+Math.round(b64.length*.75/1024)+' KB)');
      for(let a=0;a<keys.length*3&&!stop&&!ok;a++){
        const base=Math.floor(done/3)%keys.length;
        let k=-1;
        for(let s=0;s<keys.length;s++){const i=(base+s)%keys.length;if(cool[i]<=Date.now()){k=i;break}}
        if(k<0){log('warn','All keys are paused, waiting 5s');await sleep(5000);continue}
        if(k!==last){log('info','Using '+nm(k)+(k!==base?' (failover)':' (rotation)'));last=k}
        if(a>0)log('info','Retry attempt '+(a+1)+' for '+o.f.name);
        try{
          apply(o,await ask(keys[k],b64));ok=true;
          log('ok',o.f.name+': metadata received | '+o.kw.length+' keywords | Adobe: '+o.ac+' ('+ADOBE[o.ac-1]+') | Shutterstock: '+(o.sc.join(' + ')||'-')+(o.il?' | illustration':''));
          for(let t=0;t<2&&o.kw.length<50;t++){
            log('warn',o.f.name+': '+o.kw.length+'/50 keywords, requesting more');
            try{const m=await gem(keys[k],[{text:more(o)}]);o.kw=[...new Set([...o.kw,...(m.keywords||[]).map(clean).filter(Boolean)])].slice(0,50)}
            catch(e){log('warn','Keyword top-up failed - '+(e.message||e));break}
          }
          log(o.kw.length>=50?'ok':'warn',o.f.name+': '+o.kw.length+'/50 keywords');
        }catch(e){
          const wait=e.status===429?60000:e.status===400||e.status===403?3600000:15000;
          cool[k]=Date.now()+wait;
          log('err',o.f.name+': '+nm(k)+' failed - '+(e.message||e)+' (key paused '+Math.round(wait/1000)+'s)');
        }
      }
    }catch(e){log('err',o.f.name+': could not read or resize image - '+(e.message||e))}
    o.st=ok?'ok':stop?'':'err';
    if(ok)good++;else if(!stop){fail++;log('err',o.f.name+': failed after all attempts')}
    done++;
  }
  busy=false;prog='';render();
  if(stop)log('warn','Generate stopped by user');
  log(fail?'warn':'ok','Generate finished: '+good+' succeeded, '+fail+' failed');
  if(fail)note('Generate',fail+(fail>1?' images':' image')+' failed. Check the log for details, then use Regenerate or Generate to retry.');
}

/* editor */
const opts=(arr,sel,num)=>arr.map((c,i)=>'<option value="'+(num?i+1:esc(c))+'"'+((num?i+1===sel:c===sel)?' selected':'')+'>'+(num?(i+1)+' - ':'')+esc(c)+'</option>').join('');
function edit(i){
  const o=imgs[i];
  modal('Edit metadata',
    '<label>Title (<span id="tc"></span>)<input id="et" value="'+esc(o.title)+'"></label>'+
    '<label>Keywords, comma separated (<span id="kc"></span>)<textarea id="ek">'+esc(o.kw.join(', '))+'</textarea></label>'+
    '<label>Adobe Stock category<select id="ea">'+opts(ADOBE,o.ac,true)+'</select></label>'+
    '<label>Shutterstock category 1<select id="e1"><option value=""></option>'+opts(SS,o.sc[0])+'</select></label>'+
    '<label>Shutterstock category 2<select id="e2"><option value=""></option>'+opts(SS,o.sc[1])+'</select></label>'+
    '<label><span><input id="ei" type="checkbox"'+(o.il?' checked':'')+'> Illustration</span></label>',
    [['Cancel',closeM],['Save',()=>{
      o.title=$('et').value.trim().slice(0,200);
      o.kw=[...new Set($('ek').value.split(',').map(clean).filter(Boolean))].slice(0,50);
      o.ac=+$('ea').value;o.sc=[$('e1').value,$('e2').value].filter(Boolean);o.il=$('ei').checked;
      if(o.title&&o.kw.length)o.st='ok';
      log('info','Edited metadata: '+o.f.name+' ('+o.kw.length+' keywords)');
      closeM();render();
    }]]);
  const cnt=()=>{$('tc').textContent=$('et').value.length+'/200';$('kc').textContent=$('ek').value.split(',').filter(s=>s.trim()).length+'/50'};
  $('et').oninput=$('ek').oninput=cnt;cnt();
}

/* ekspor CSV */
const cell=v=>{v=String(v);return/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
function saveCsv(name,rows){
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(rows.map(r=>r.map(cell).join(',')).join('\r\n'));
  a.download=name;document.body.appendChild(a);a.click();a.remove();
}
$('dl').onclick=()=>{
  const ok=imgs.filter(o=>o.st==='ok');
  if(!ok.length){log('warn','Download skipped: no metadata yet');note('Download','No metadata yet. Press Generate first.');return}
  const miss=imgs.length-ok.length,short=ok.filter(o=>o.kw.length<50).length,long=ok.filter(o=>o.f.name.length>30).length;
  modal('Download CSV','<p>'+ok.length+' images ready to export.'+(miss?'\n'+miss+' images are not finished and will not be included.':'')+(short?'\n'+short+' image(s) have fewer than 50 keywords. Use Edit to add more.':'')+(long?'\n'+long+' filename(s) are longer than 30 characters (Adobe Stock limit). Rename the files before uploading.':'')+'</p>',[
    ['Cancel',closeM],
    ['Adobe Stock',()=>{saveCsv('adobe_stock.csv',[['Filename','Title','Keywords','Category','Releases'],...ok.map(o=>[o.f.name,o.title,o.kw.slice(0,49).join(', '),o.ac,''])]);log('ok','Exported adobe_stock.csv: '+ok.length+' row(s), 49 keywords each');closeM()}],
    ['Shutterstock',()=>{saveCsv('shutterstock.csv',[['Filename','Description','Keywords','Categories','Illustration','Mature Content','Editorial'],...ok.map(o=>[o.f.name,o.title,o.kw.slice(0,50).join(','),o.sc.length?o.sc.join(','):'Miscellaneous',o.il?'Yes':'No','No','No'])]);log('ok','Exported shutterstock.csv: '+ok.length+' row(s), 50 keywords each');closeM()}]
  ]);
};
LOGS.forEach(addLine);
log('info','App started - '+new Date().toLocaleString());
logReady=true;
render();
