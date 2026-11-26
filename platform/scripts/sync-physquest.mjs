import {cp,readFile,mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
const source=resolve(process.argv[2]||(existsSync('../apps/web/package.json')?'..':'../PhysQuest'));
const packageJson=JSON.parse(await readFile(source+'/apps/web/package.json','utf8'));
if(packageJson.name!=='physquest-web')throw new Error('Expected a PhysQuest checkout');
await mkdir('physquest/apps',{recursive:true});await mkdir('physquest/shared',{recursive:true});
// 先清理旧源码与知识数据目录（保留 node_modules），避免主仓已删文件残留导致构建报错
await rm('physquest/apps/web/src',{recursive:true,force:true});
await rm('physquest/shared/knowledge-data',{recursive:true,force:true});
await cp(source+'/apps/web','physquest/apps/web',{recursive:true,filter:p=>!/(?:^|\/)(node_modules|dist)(?:\/|$)|\.tsbuildinfo$/.test(p)});
await cp(source+'/shared/knowledge-data','physquest/shared/knowledge-data',{recursive:true});
await cp(source+'/LICENSE','physquest/LICENSE');
console.log('Synced PhysQuest source snapshot.');
