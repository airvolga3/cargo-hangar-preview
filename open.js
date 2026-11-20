(async()=>{
 const notice=document.getElementById('notice');
 const fragment=new URLSearchParams(location.hash.slice(1));
 const token=fragment.get('v');
 if(!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)){
  notice.textContent='Откройте полную ссылку, которой с вами поделились.';return;
 }
 try{
  await navigator.serviceWorker.register('./viewer.js');
  const registration=await navigator.serviceWorker.ready;
  const channel=new MessageChannel();
  const ready=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('timeout')),45000);
   channel.port1.onmessage=({data})=>{clearTimeout(timer);data.ok?resolve():reject(new Error('access'));};
  });
  registration.active.postMessage({token},[channel.port2]);
  await ready;
  location.replace('./view/index.html');
 }catch{
  notice.textContent='Не удалось открыть сайт. Откройте полную ссылку в Safari, Chrome, Firefox или Edge и обновите страницу.';
 }
})();
