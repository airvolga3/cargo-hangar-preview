const scope=new URL(self.registration.scope);
const prefix=scope.pathname+'view/';
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',webp:'image/webp',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',svg:'image/svg+xml',webm:'video/webm',mp4:'video/mp4',glb:'model/gltf-binary',ttf:'font/ttf',woff2:'font/woff2',zip:'application/zip',txt:'text/plain; charset=utf-8',md:'text/plain; charset=utf-8',json:'application/json'};
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
const enc=new TextEncoder();
async function keyStore(mode,callback){
 const db=await new Promise((resolve,reject)=>{
  const request=indexedDB.open('vd-view-'+scope.pathname,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('viewer');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction('viewer',mode);
   const request=callback(tx.objectStore('viewer'));
   tx.oncomplete=()=>resolve(request.result);tx.onabort=()=>reject(tx.error);
  });
 }finally{db.close();}
}
async function unpack(name,key){
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(name))),b=>b.toString(16).padStart(2,'0')).join('');
 const r=await fetch(new URL('assets/'+hash+'.bin',scope));
 if(!r.ok)throw new Error('missing');
 const bytes=new Uint8Array(await r.arrayBuffer());
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:enc.encode(name)},key,bytes.slice(12));
 return new Blob([plain]).stream().pipeThrough(new DecompressionStream('gzip'));
}
let sessionKey;
self.addEventListener('message',event=>{
 if(!event.source || !event.source.url.startsWith(scope.href) || !event.ports[0])return;
 event.waitUntil((async()=>{
  try{
   const token=event.data.token;
   if(!/^[a-zA-Z0-9_-]{43}$/.test(token))throw new Error('key');
   const raw=Uint8Array.from(atob(token.replace(/-/g,'+').replace(/_/g,'/')+'='),c=>c.charCodeAt(0));
   const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
   const stream=await unpack('index.html',key);await stream.cancel();
   await keyStore('readwrite',s=>s.put(key,'key'));sessionKey=key;
   event.ports[0].postMessage({ok:true});
  }catch{event.ports[0].postMessage({ok:false});}
 })());
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==scope.origin || !url.pathname.startsWith(prefix))return;
 event.respondWith((async()=>{
  const key=sessionKey || await keyStore('readonly',s=>s.get('key'));
  if(!key)return Response.redirect(scope.href,302);
  sessionKey=key;
  const name=decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
  try{
   const stream=await unpack(name,key);
   const headers={'Content-Type':types[name.split('.').pop()] || 'application/octet-stream','Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
   const range=event.request.headers.get('Range');
   if(range){
    const blob=await new Response(stream).blob(),m=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(!m || (!m[1]&&!m[2]))return new Response(null,{status:416});
    const start=m[1]?Number(m[1]):Math.max(0,blob.size-Number(m[2])),end=m[1]&&m[2]?Math.min(Number(m[2]),blob.size-1):blob.size-1;
    if(start>end || start>=blob.size)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+blob.size}});
    return new Response(blob.slice(start,end+1),{status:206,headers:{...headers,'Content-Range':'bytes '+start+'-'+end+'/'+blob.size,'Accept-Ranges':'bytes','Content-Length':end-start+1}});
   }
   return new Response(stream,{headers});
  }catch{return new Response('Материал недоступен',{status:404});}
 })());
});
