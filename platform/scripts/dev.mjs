import http from 'node:http';
import { readFile,writeFile,mkdir,rename,stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const dataDirectory=process.env.FIELDLAB_DATA_DIR||'.local';
await mkdir(dataDirectory,{recursive:true});
const etag=body=>createHash('sha256').update(body).digest('hex');
// Local R2-compatible persistence. Mutations execute serially through this queue.
let queue=Promise.resolve();
const bucket={async get(key){try{const body=await readFile(dataDirectory+'/'+encodeURIComponent(key),'utf8');return{etag:etag(body),json:async()=>JSON.parse(body)};}catch(e){if(e.code==='ENOENT')return null;throw e;}},async put(key,body,options={}){const result=queue.then(async()=>{const current=await this.get(key),headers=options.onlyIf;if(headers?.get('If-None-Match')==='*'&&current)return null;if(headers?.get('If-Match')&&headers.get('If-Match')!=='"'+current?.etag+'"')return null;const file=dataDirectory+'/'+encodeURIComponent(key);await writeFile(file+'.tmp',body);await rename(file+'.tmp',file);return{etag:etag(body)};});queue=result.catch(()=>{});return result;}};
const port=Number(process.env.PORT||4317);
const server=http.createServer(async(req,res)=>{try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>512000){res.writeHead(413);res.end('Request too large');return;}chunks.push(chunk);}const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-user');const request=new Request('http://127.0.0.1:'+port+req.url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});const workerPath=resolve('dist/server/index.js');const worker=await import(pathToFileURL(workerPath).href+'?mtime='+(await stat(workerPath)).mtimeMs);const result=await worker.default.fetch(request,{BUCKET:bucket});res.writeHead(result.status,Object.fromEntries(result.headers));if(result.body){for await(const chunk of result.body)res.write(chunk);}res.end();}catch(e){console.error(e.message);res.writeHead(500);res.end('Local server error');}});
server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
