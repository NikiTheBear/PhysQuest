export interface ExplorationRecord {
  id: string; createdAt: string; note: string; time: number;
  experiment: { id: string; title: string; goal: string; mode: '2d' | '3d'; components: unknown[]; connections: unknown[]; [key: string]: unknown };
  readings: { channels: Record<string, {label: string; value: number; unit: string; valid?: boolean}>; [key: string]: unknown };
  circuitError?: string | null;
}
const KEY = 'physquest.freebuild.records.v1';
export function readRecords(): ExplorationRecord[] {
  try { const value = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(value)) return [];
    return value.filter(r => typeof r.id === 'string' && typeof r.note === 'string' && Number.isFinite(r.time) && ['2d','3d'].includes(r.experiment?.mode) && Array.isArray(r.experiment?.components) && Array.isArray(r.experiment?.connections) && r.readings?.channels && typeof r.readings.channels === 'object').slice(0,60);
  } catch { return []; }
}
export function saveRecords(records: ExplorationRecord[]) { try { localStorage.setItem(KEY, JSON.stringify(records)); return true; } catch { return false; } }
export function downloadRecord(record: ExplorationRecord) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
  const link = document.createElement('a'); link.href=url; link.download=record.experiment.title+'-探索记录.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),3000);
}
