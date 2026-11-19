import { validateExperiment } from '../shared/workspace.js';

// A visual draft never changes the persisted workspace or its undo history.
export function parameterPreview(experiment,{componentId,key,value,environment=false,collider}){
  const draft=structuredClone(experiment);
  if(environment)draft.environment[key]=value;
  else {
    const component=draft.components.find(c=>c.id===componentId);
    if(!component)throw new Error('器具不存在');
    if(collider)component.collider=structuredClone(collider);else component.params[key]=value;
  }
  return validateExperiment(draft);
}
