import {CATALOG} from './catalog.js';

export function instrumentPlane(kind){
  return ['circuit','acoustics'].includes(CATALOG[kind]?.domain)||kind==='microphone'?'xz':'xy';
}

export function verticalAxis(doc){
  return doc?.plane2d==='xz'?2:1;
}

export function normalAxis(doc){
  return 3-verticalAxis(doc);
}
