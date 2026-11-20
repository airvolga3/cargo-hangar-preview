// The entire presentation runs in this tab. No installation or browser storage is required.
(async function openPresentation(){
 const notice=document.getElementById('notice'), retry=document.getElementById('retry');
 retry.onclick=()=>location.reload();
 const address=new URL(location.href),legacy=new URLSearchParams(address.hash.slice(1)).get('v');
 const token=address.searchParams.get('open')||legacy;
 if(!token || !/^[\w-]{43}$/.test(token)){
  notice.textContent='Для просмотра откройте полную ссылку из сообщения.';
  window.addEventListener('hashchange',()=>location.reload(),{once:true});return;
 }
 if(legacy){
  address.hash='';address.searchParams.set('open',token);
  history.replaceState(null,'',address);
 }
 const game=address.searchParams.get('game')==='1';
 const base=new URL('./',address);
 const route=(playing,anchor='')=>{
  const u=new URL(base);u.searchParams.set('open',token);if(playing)u.searchParams.set('game','1');
  u.hash=anchor;return u.href;
 };
 const encoder=new TextEncoder(),decoder=new TextDecoder();
 function decode64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
 try{
  const key=await crypto.subtle.importKey('raw',decode64(token.replace(/-/g,'+').replace(/_/g,'/')+'='),'AES-GCM',false,['decrypt']);
  async function load(name,file,signal,progress){
   const abort=new AbortController(),cancel=()=>abort.abort();
   let timer;
   function arm(){clearTimeout(timer);timer=setTimeout(cancel,60000);}
   if(signal?.aborted)cancel();
   signal?.addEventListener('abort',cancel,{once:true});arm();
   try{
    const res=await fetch(new URL(file,base),{signal:abort.signal,referrerPolicy:'no-referrer'});
    if(!res.ok)throw Error('HTTP '+res.status);
    let bytes;
    if(res.body && progress){
     const reader=res.body.getReader(),parts=[];let used=0,cap=Number(res.headers.get('Content-Length'));
     while(true){
      const {value,done}=await reader.read();if(done)break;
      parts.push(value);used+=value.length;arm();progress(used,cap);
     }
     bytes=new Uint8Array(used);let pos=0;for(const p of parts){bytes.set(p,pos);pos+=p.length;}
    }else bytes=new Uint8Array(await res.arrayBuffer());
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(0,12),additionalData:encoder.encode(name)},key,bytes.subarray(12));
    return pako.ungzip(new Uint8Array(plain));
   }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
  }
  const types={glb:'model/gltf-binary',mp4:'video/mp4',webp:'image/webp',zip:'application/zip'};
  const urls=new Map();
  const vd={
   url:name=>urls.get(name)||name,
   async response(name,signal){
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(name))),n=>n.toString(16).padStart(2,'0')).join('');
    const bytes=await load(name,'assets/'+hash+'.bin',signal);
    return new Response(bytes,{headers:{'Content-Type':types[name.split('.').pop()]||'application/octet-stream'}});
   },
   async mediaURL(name){return URL.createObjectURL(await (await vd.response(name)).blob());}
  };
  window.VD=vd;
  const file=game?'game-v2.bin':'home-voice.bin';
  const label=game?'Загружаем ангар':'Загружаем сайт';
  notice.textContent=label+'…';
  const bundle=JSON.parse(decoder.decode(await load(file,file,null,(n,total)=>{
   notice.textContent=label+' · '+(total?Math.min(100,Math.floor(n*100/total))+'%':(n/1048576).toFixed(1)+' МБ');
  })));
  const make=(data,type)=>URL.createObjectURL(new Blob([data],{type}));
  for(const [name,[type,data]] of Object.entries(bundle.media))urls.set(name,make(decode64(data),type));
  const quote=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp([...urls.keys()].sort((a,b)=>b.length-a.length).map(quote).join('|'),'g');
  const replaceMedia=s=>s.replace(pattern,p=>urls.get(p));
  let html=replaceMedia(bundle.html);
  for(const [name,source] of Object.entries(bundle.css))html=html.replace('href="'+name+'"','href="'+make(replaceMedia(source),'text/css')+'"');
  for(const [name,source] of Object.entries(bundle.js))html=html.replace('src="'+name+'"','src="'+make(replaceMedia(source),'text/javascript')+'"');
  if(game){
   html=html.replaceAll('href="../index.html#cargo-game"','href="'+route(false,'cargo-game')+'"').replaceAll('href="../index.html"','href="'+route(false)+'"');
  }else html=html.replaceAll('href="games/cargo-hangar.html"','href="'+route(true).replaceAll('&','&amp;')+'"');
  const targetHash=location.hash;
  document.open();document.write(html);document.close();
  window.addEventListener('load',()=>{
   if(targetHash)document.getElementById(targetHash.slice(1))?.scrollIntoView();
  },{once:true});
  document.addEventListener('click',async e=>{
   const a=e.target.closest('a[download]');if(!a || !a.getAttribute('href')?.endsWith('img/inspection/il-source.zip'))return;
   e.preventDefault();
   try{a.href=await vd.mediaURL('img/inspection/il-source.zip');a.click();}catch{a.title='Не удалось загрузить архив. Повторите нажатие.';}
  });
 }catch(error){
  notice.textContent='Не удалось открыть '+(game?'ангар':'сайт')+'. Проверьте соединение и повторите загрузку.';
  retry.hidden=false;
  console.error('Preview could not open:',error.name);
 }
})();
