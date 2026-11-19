import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { blankWorkspace, activeExperiment } from '../shared/catalog.js';
import { mutate, readExperimentFile, exportExperimentFile } from '../shared/workspace.js';
import { EXPERIMENT_FILES } from '../shared/experiment-library.js';
import { runTool } from '../worker/operations.js';
import { Simulation } from '../shared/physics.js';
import { solve } from '../shared/physquest-lens.js';
test('five original challenges preserve content, initial parameters and downloadable file data',async()=>{
 const originals=JSON.parse(await readFile(new URL('../physquest/shared/knowledge-data/optics-lens/challenges.json',import.meta.url),'utf8')).challenges;
 assert.equal(EXPERIMENT_FILES.length,originals.length);
 for(const original of originals){const file=EXPERIMENT_FILES.find(f=>f.experiment.source.challengeId===original.id);assert.deepEqual(file.experiment.learning,original);assert.deepEqual(JSON.parse(await readFile(new URL('../experiments/'+original.id+'.pqexp.json',import.meta.url),'utf8')),file);readExperimentFile(file);assert.equal(file.experiment.components[0].params.u,original.id==='CH-O2-02'?20:30);}
});
test('autoload initializes once and preserves all existing user changes',()=>{
 const before=blankWorkspace();let o=runTool(before,'bootstrap_physquest');const w=o.workspace,id=w.activeId;
 assert.equal(w.experiments.length,1);assert.equal(activeExperiment(w).components[0].kind,'lens_bench');assert.equal(before.revision,0);
 o=runTool(w,'bootstrap_physquest');assert.equal(o.workspace.revision,w.revision);assert.equal(o.workspace.activeId,id);
 const custom=mutate(blankWorkspace(),'update_experiment',{title:'我的空间'}).workspace;assert.equal(runTool(custom,'bootstrap_physquest').workspace.activeId,custom.activeId);assert.equal(activeExperiment(custom).components.length,0);
});
test('file load creates editable copies, export/import preserves learning and edits',()=>{
 let o=runTool(blankWorkspace(),'load_experiment_file',{fileId:'CH-O2-02'}),doc=activeExperiment(o.workspace),id=doc.components[0].id;
 o=runTool(o.workspace,'update_component',{componentId:id,params:{u:15,screenX:30,maskTop:1}});
 o=runTool(o.workspace,'update_experiment',{goal:'我的新目标',learning:{hint:'新的提示'}});
 const file=runTool(o.workspace,'export_experiment').result,round=runTool(o.workspace,'import_experiment',{file});
 assert.equal(round.workspace.experiments.length,3);const copy=activeExperiment(round.workspace);assert.notEqual(copy.components[0].id,id);assert.equal(copy.components[0].params.u,15);assert.equal(copy.goal,'我的新目标');assert.deepEqual(copy.learning,{hint:'新的提示'});assert.equal(copy.control.running,false);
});
test('import remaps mechanical references and wire connections atomically',()=>{
 let w=blankWorkspace();for(const kind of ['anchor','body','spring','battery','resistor'])w=mutate(w,'add_component',{kind}).workspace;
 let d=activeExperiment(w);w=mutate(w,'update_component',{componentId:d.components[2].id,refs:{a:d.components[0].id,b:d.components[1].id}}).workspace;
 w=mutate(w,'connect_components',{kind:'wire',source:d.components[3].id,sourcePort:'a',target:d.components[4].id,targetPort:'b'}).workspace;
 const file=exportExperimentFile(activeExperiment(w)),copy=activeExperiment(mutate(w,'import_experiment',{file}).workspace);assert.equal(copy.components[2].refs.a,copy.components[0].id);assert.equal(copy.connections[0].source,copy.components[3].id);
 const bad=structuredClone(file);bad.experiment.connections[0].target='missing';assert.throws(()=>mutate(w,'import_experiment',{file:bad}));assert.equal(w.experiments.length,1);
 assert.throws(()=>readExperimentFile({...file,version:9}),/版本/);
});
test('converted lens apparatus preserves original real, virtual, parallel and masking calculations',()=>{
 const file=EXPERIMENT_FILES[0];
 for(const params of [{u:30},{u:20,screenX:20},{u:15,screenX:30},{u:5},{u:10},{maskTop:1}]){
  const d=readExperimentFile(file);Object.assign(d.components[0].params,params);const c=d.components[0],m=solve({...c.params,maskTop:!!c.params.maskTop}),s=new Simulation(d),ch=s.readings.channels;
  assert.equal(ch[c.id+':v'].value,m.v);assert.equal(ch[c.id+':relativeIlluminance'].value,m.relativeIlluminance);assert.equal(ch[c.id+':real'].value,Number(m.real));assert.equal(ch[c.id+':m'].valid,Number.isFinite(m.m));if(Number.isFinite(m.m))assert.equal(ch[c.id+':m'].value,m.m);
 }
});
test('invalid original apparatus options and oversized learning metadata reject before saving',()=>{
 let w=runTool(blankWorkspace(),'load_experiment_file',{fileId:'CH-O2-01'}).workspace;const c=activeExperiment(w).components[0];
 assert.throws(()=>mutate(w,'update_component',{componentId:c.id,params:{maskTop:.5}}),/整数/);
 assert.throws(()=>mutate(w,'update_experiment',{learning:{hint:'x'.repeat(13000)}}),/12 KB/);
});
