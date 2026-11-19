import test from 'node:test';
import assert from 'node:assert/strict';
import {blankWorkspace,activeExperiment} from '../shared/catalog.js';
import {mutate} from '../shared/workspace.js';
import {saveArchive,listArchives,loadArchive,deleteArchive} from '../web/archives.js';
test('named snapshots survive edits and load as independent experiments',()=>{
 const data=new Map(),storage={get length(){return data.size},key:i=>[...data.keys()][i],setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k),removeItem:k=>data.delete(k)};
 const w=mutate(blankWorkspace(),'add_component',{kind:'box'}).workspace,d=activeExperiment(w);
 const first=saveArchive(storage,'初始状态',d);
 d.components[0].params.mass=4;
 saveArchive(storage,'初始状态',d);
 assert.equal(listArchives(storage).length,2);
 const loaded=mutate(w,'import_experiment',{file:loadArchive(storage,first)}).workspace;
 assert.equal(activeExperiment(loaded).components[0].params.mass,1);
 assert.notEqual(activeExperiment(loaded).components[0].id,d.components[0].id);
 assert.equal(loaded.experiments[0].components[0].params.mass,4);
 deleteArchive(storage,first);assert.equal(listArchives(storage).length,1);
});
