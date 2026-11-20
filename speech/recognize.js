import {configureWasm, initWhisper} from './index.js';
configureWasm({threads:false,worker:false});

self.onmessage=async ({data})=>{
 try {
  const context=await initWhisper({
   filePath:new URL('./ggml-base-q5_1.bin',import.meta.url).href,
   useGpu:false,cacheModel:true,modelCacheName:'vd-whisper-base-q5-v1'
  });
  self.postMessage({phase:'processing'});
  // The recorder produces canonical 44-byte-header mono 16 kHz PCM WAVs.
  const samples=new Int16Array(await data.audio.arrayBuffer(),44);
  const result=await context.transcribeData(samples,{
   language:data.language,maxThreads:1,temperature:0,beamSize:1,bestOf:1,
   onProgress:percent=>self.postMessage({phase:'processing',percent})
  }).promise;
  self.postMessage({text:result.result.trim()});
 }catch(error){self.postMessage({error:String(error?.message||error)});}
};
