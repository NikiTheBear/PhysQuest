import {exportExperimentFile,readExperimentFile} from '../shared/workspace.js';

const prefix='fieldlab.archive.v1.';
export function saveArchive(storage,name,experiment){
  name=name.trim();
  if(!name||name.length>100)throw new Error('存档名称须为 1–100 个字符');
  const file=exportExperimentFile(experiment);
  readExperimentFile(file);
  const id=crypto.randomUUID(),savedAt=new Date().toISOString();
  storage.setItem(prefix+id,JSON.stringify({name,savedAt,file}));
  return id;
}
export function loadArchive(storage,id){
  const raw=storage.getItem(prefix+id);
  if(!raw)throw new Error('此存档已不存在');
  const {file}=JSON.parse(raw);
  readExperimentFile(file);
  return file;
}
export function listArchives(storage){
  const entries=[];
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    if(!key?.startsWith(prefix))continue;
    try{
      const {name,savedAt}=JSON.parse(storage.getItem(key));
      entries.push({id:key.slice(prefix.length),name,savedAt});
    }catch{continue;}
  }
  return entries.sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)));
}
export function deleteArchive(storage,id){storage.removeItem(prefix+id);}
