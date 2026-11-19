import { ASSETS } from '../.generated/assets.js';
import { blankWorkspace, activeExperiment, CATALOG, COUPLINGS } from '../shared/catalog.js';
import { mutate } from '../shared/workspace.js';
import { simulate } from '../shared/physics.js';
import { TOOLS } from './tools.js';
import { runTool } from './operations.js';
import { runDeepSeek } from './deepseek.js';
const response=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
class ApiError extends Error {constructor(message,status=400){super(message);this.status=status;}}
async function readWorkspace(env,user) {
  if(!env.BUCKET)throw new ApiError('实验存储尚未连接',503);
  const key='workspaces/'+encodeURIComponent(user)+'.json',file=await env.BUCKET.get(key);
  return {key,etag:file?.etag,workspace:file?await file.json():blankWorkspace()};
}
async function operate(env,user,name,args,expectedRevision) {
  if(!args||typeof args!=='object'||Array.isArray(args))throw new ApiError('工具参数必须为对象');
  for(let attempt=0;attempt<3;attempt++) {
    const {key,etag,workspace}=await readWorkspace(env,user);
    if(name==='get_workspace') {
      if(!etag){const saved=await env.BUCKET.put(key,JSON.stringify(workspace),{onlyIf:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:'application/json'}});if(!saved)continue;}
      return {workspace,result:workspace};
    }
    if(['list_instruments','simulate_experiment','list_experiment_files','export_experiment','list_knowledge_prompts','get_knowledge_prompt'].includes(name))return runTool(workspace,name,args);
    if(expectedRevision!==undefined&&expectedRevision!==workspace.revision)throw new ApiError('实验已被另一窗口或 AI 修改，请同步后重试。当前草稿已保留。',409);
    const output=runTool(workspace,name,args);
    const saved=await env.BUCKET.put(key,JSON.stringify(output.workspace),{onlyIf:new Headers(etag?{'If-Match':'"'+etag+'"'}:{'If-None-Match':'*'}),httpMetadata:{contentType:'application/json'}});
    if(saved)return output;
    if(expectedRevision!==undefined)throw new ApiError('保存冲突，请同步后重试。',409);
  }
  throw new ApiError('当前正在更新，请重试',409);
}
export async function handleRpc(rpc,env,user) {
  if(!rpc||rpc.jsonrpc!=='2.0'||typeof rpc.method!=='string')return {jsonrpc:'2.0',id:rpc?.id??null,error:{code:-32600,message:'Invalid Request'}};
  if(rpc.id===undefined)return null;
  const reply=result=>({jsonrpc:'2.0',id:rpc.id,result});
  if(rpc.method==='server/discover')return reply({supportedVersions:['2026-07-28'],capabilities:{tools:{}},serverInfo:{name:'fieldlab',version:'2.0.0'}});
  if(rpc.method==='initialize')return reply({protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'fieldlab',version:'2.0.0'},instructions:'自由搭建平台。先调用 list_instruments 获取参数；create_experiment 创建空白空间，list_experiment_files 和 load_experiment_file 可载入原版实验为可编辑副本。所有原版实验均可由人和 AI 修改，不含强制关卡。list_knowledge_prompts/get_knowledge_prompt 可读取知识地图实验提示词，必须遵守其模型边界。'});
  if(rpc.method==='ping')return reply({});
  if(rpc.method==='tools/list')return reply({tools:TOOLS});
  if(rpc.method==='tools/call') {
    if(!TOOLS.some(t=>t.name===rpc.params?.name))return {jsonrpc:'2.0',id:rpc.id,error:{code:-32602,message:'Unknown tool'}};
    try{const {result}=await operate(env,user,rpc.params.name,rpc.params.arguments||{});return reply({content:[{type:'text',text:JSON.stringify(result)}],isError:false});}
    catch(e){return reply({content:[{type:'text',text:e.message}],isError:true});}
  }
  return {jsonrpc:'2.0',id:rpc.id,error:{code:-32601,message:'Method not found'}};
}
export default { async fetch(request,env) {
  const url=new URL(request.url),path=url.pathname;
  try {
    if(path.startsWith('/api/')||path==='/mcp') {
      const user=request.headers.get('oai-authenticated-user-id');
      if(!user&&path!=='/mcp')throw new ApiError('请登录以访问你的实验空间',401);
      if(request.method==='POST') {
        const origin=request.headers.get('origin');if(origin&&origin!==url.origin)throw new ApiError('不允许跨站修改',403);
        if(Number(request.headers.get('content-length'))>(path==='/api/command'?4000000:512000))throw new ApiError('请求过大',413);
      }
      if(path==='/api/state'&&request.method==='GET')return response((await operate(env,user,'get_workspace',{})).workspace);
      if(path==='/api/ai/chat'&&request.method==='POST'){
        const raw=await request.text();if(raw.length>150000)throw new ApiError('对话请求过大',413);const body=JSON.parse(raw);
        const {key:storageKey,etag,workspace}=await readWorkspace(env,user);
        if(body.revision!==workspace.revision)throw new ApiError('空间已更新，请同步后重试',409);
        const result=await runDeepSeek({workspace,body,key:request.headers.get('X-DeepSeek-Key'),signal:request.signal});
        if(request.signal.aborted)throw new ApiError('请求已取消，修改未保存',499);
        if(result.changed){
          result.workspace.revision=workspace.revision+1;
          const saved=await env.BUCKET.put(storageKey,JSON.stringify(result.workspace),{onlyIf:new Headers(etag?{'If-Match':'"'+etag+'"'}:{'If-None-Match':'*'}),httpMetadata:{contentType:'application/json'}});
          if(!saved)throw new ApiError('AI 生成期间空间已被修改，本轮未覆盖你的修改，请重试',409);
        }
        return response(result);
      }
      if(path==='/api/command'&&request.method==='POST'){const raw=await request.text();if(raw.length>4000000)throw new ApiError('请求过大',413);const body=JSON.parse(raw);return response(await operate(env,user,body.name,body.arguments||{},body.revision));}
      if(path==='/mcp'&&request.method==='POST'){const raw=await request.text();if(raw.length>512000)throw new ApiError('请求过大',413);let rpc;try{rpc=JSON.parse(raw);}catch{return response({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}},400);}if(rpc?.method==='tools/call'&&!user)throw new ApiError('请登录以使用实验工具',401);const result=await handleRpc(rpc,env,user);return result?response(result):new Response(null,{status:202});}
      return response({error:'Method not allowed'},405);
    }
    if(request.method!=='GET'&&request.method!=='HEAD')return response({error:'Method not allowed'},405);
    const asset=ASSETS[path==='/'||path==='/index.html'?'/physquest.html':path==='/workbench'?'/index.html':path];
    if(!asset)return new Response('Not found',{status:404});
    return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':path.endsWith('.js')?'public, max-age=0, must-revalidate':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'"}});
  } catch(e){return response({error:e.message},e.status||400);}
}};
