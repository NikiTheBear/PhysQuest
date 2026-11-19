import { useEffect, useRef, useState } from 'react';
import KnowledgeMap from './components/knowledge-map/KnowledgeMap';
import KnowledgeCards from './components/knowledge-cards/KnowledgeCards';
import { KNOWLEDGE } from './data/content';
import { readRecords, saveRecords, downloadRecord, type ExplorationRecord } from './core/exploration-records';

type View = 'map' | 'lab' | 'cards' | 'report';
const workbenchUrl = import.meta.env.VITE_STATIC_WORKBENCH === '1' ? import.meta.env.BASE_URL + 'workbench.html?offline=1' : '/workbench';
const views: Record<View, string> = { map: '知识地图', lab: '自由实验台', cards: '知识卡', report: '探索记录' };
const initialView = (): View => { const v = new URLSearchParams(location.search).get('view'); return v === 'map' || v === 'cards' || v === 'report' ? v : 'lab'; };
export default function App() {
  const [view, setView] = useState<View>(initialView);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [topic, setTopic] = useState('');
  const [records, setRecords] = useState<ExplorationRecord[]>(readRecords);
  const [message, setMessage] = useState('');
  const [capturing, setCapturing] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const pending = useRef<{action:string;data:Record<string,string>} | null>(null);
  const captureId = useRef<string | null>(null);
  const captureTimer = useRef<ReturnType<typeof setTimeout>>();
  function send(action: string, data: Record<string, string> = {}) { frame.current?.contentWindow?.postMessage({ source: 'physquest', action, ...data }, location.origin); }
  function navigate(next: View) {
    setView(next); const url = new URL(location.href); url.searchParams.set('view', next);
    for (const key of ['lab', 'challenge', 'clean']) url.searchParams.delete(key);
    history.replaceState(null, '', url);
  }
  function openLab(domain = 'all', subject = '') {
    setTopic(subject); navigate('lab'); const data = { domain };
    if (ready) send('filter-library', data); else pending.current = {action:'filter-library',data};
  }
  function buildKnowledge(id:string,title:string,prompt:string){setTopic(title+' · AI 搭建');navigate('lab');const data={knowledgeId:id,title,prompt};if(ready)send('build-knowledge',data);else pending.current={action:'build-knowledge',data};}
  function openKnowledge(id: string) { openLab('optics', KNOWLEDGE.find(c => c.id === id)?.title || ''); }
  function capture() {
    if (!ready || capturing) return; captureId.current = crypto.randomUUID(); setCapturing(true);
    send('capture', { requestId: captureId.current });
    captureTimer.current = setTimeout(() => { captureId.current = null; setCapturing(false); setMessage('采集超时，请等待工作台保存完成后重试。'); }, 10000);
  }
  function persist(next: ExplorationRecord[]) { if (saveRecords(next)) setRecords(next); else setMessage('浏览器存储空间不足，请先导出记录。'); }
  useEffect(() => {
    document.documentElement.dataset.theme = 'light';
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.source !== 'fieldlab') return;
      if (event.data.type === 'ready') { setReady(true); setSlow(false); if (pending.current) { send(pending.current.action, pending.current.data); pending.current = null; } }
      if (event.data.type === 'capture' && captureId.current && event.data.requestId === captureId.current) {
        clearTimeout(captureTimer.current); captureId.current = null; setCapturing(false); const data = event.data.snapshot;
        if (!data?.experiment?.id || !data?.readings || !Number.isFinite(data.time)) { setMessage('采集失败，请重试。'); return; }
        const entry: ExplorationRecord = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), note: '' };
        const next = [entry, ...readRecords()].slice(0, 60);
        if (saveRecords(next)) { setRecords(next); setMessage('已保存配置与测量值，可在探索记录中添加观察。'); } else setMessage('浏览器存储空间不足，请先导出记录。');
      }
    };
    window.addEventListener('message', receive);
    return () => { window.removeEventListener('message', receive); clearTimeout(captureTimer.current); };
  }, []);
  useEffect(() => { if (ready) return; const timer = setTimeout(() => setSlow(true), 15000); return () => clearTimeout(timer); }, [ready]);
  useEffect(() => { send('visibility', { value: view === 'lab' ? 'visible' : 'hidden' }); }, [view, ready]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 7000); return () => clearTimeout(timer); }, [message]);
  return <div className="pq-app">
    <header className="pq-header"><button className="pq-brand" onClick={() => navigate('map')} aria-label="PhysQuest 首页"><span className="pq-logo" aria-hidden="true">pq</span><span><strong>探理实验室</strong><small>PhysQuest</small></span></button><nav aria-label="主导航">{(Object.keys(views) as View[]).map(key => <button key={key} aria-current={view === key ? 'page' : undefined} className={view === key ? 'active' : ''} onClick={() => navigate(key)}>{views[key]}</button>)}</nav><span className="pq-edition">自由探索版</span></header>
    {view === 'map' && <main className="pq-content"><KnowledgeMap onOpenModule={openLab} onOpenKnowledge={openKnowledge} onBuildKnowledge={buildKnowledge} /><footer className="pq-footer">PhysQuest 知识地图 · Fieldlab 仿真引擎 <a href="https://github.com/NikiTheBear/PhysQuest" target="_blank" rel="noreferrer">开源项目 · MIT</a></footer></main>}
    {view === 'cards' && <main className="pq-content"><div className="pq-page-heading"><span className="eyebrow">KNOWLEDGE LIBRARY</span><h1>理解，先于答案。</h1><p>阅读 PhysQuest 的 {KNOWLEDGE.length} 张凸透镜知识卡，再去自由实验台亲手搭建。</p></div><KnowledgeCards cards={KNOWLEDGE} onJump={card => openKnowledge(card.id)} /></main>}
    <main className="pq-lab" hidden={view !== 'lab'}><div className="pq-lab-bar"><div><strong>{topic || '自由搭建'}</strong><span>{topic ? '在工作台与 AI 协作，继续调整实验' : '器具、连接、目标，均可由你和 AI 编辑'}</span></div><div className="pq-lab-actions"><button disabled={!ready} onClick={() => send('spaces')}>实验文件</button><button disabled={!ready} onClick={() => send('help')}>操作指南</button><button disabled={!ready || capturing} onClick={capture}>{capturing ? '正在记录…' : '记录此刻'}</button><button className="btn-primary" disabled={!ready} onClick={() => send('open-ai')}>AI 协作</button></div></div>{!ready && <div className="pq-loading" role="status">{slow ? <>工作台加载较慢。<a href={workbenchUrl}>单独打开工作台</a></> : '正在连接实验工作台…'}</div>}<iframe ref={frame} src={workbenchUrl + (workbenchUrl.includes('?') ? '&' : '?') + 'embed=1&autoload=physquest'} title="Fieldlab 自由搭建物理实验台" className="pq-workbench-frame" onLoad={() => send('hello')} /></main>
    {view === 'report' && <main className="pq-content"><div className="pq-page-heading"><span className="eyebrow">EXPLORATION NOTES</span><h1>留下你的发现。</h1><p>在实验台点击“记录此刻”，保存器具配置和当时的测量值。记录保存在此浏览器，可导出备份。</p></div>{records.length === 0 ? <div className="pq-record-empty"><span className="pq-empty-mark">01</span><h2>你的第一条观察，从这里开始</h2><p>运行仿真，再记录现象与问题。</p><button className="btn-primary" onClick={() => openLab()}>进入自由实验台</button></div> : <div className="pq-record-list">{records.map(record => <article className="pq-record" key={record.id}><div className="pq-record-head"><div><span className="eyebrow">{new Date(record.createdAt).toLocaleString('zh-CN')}</span><h2>{record.experiment.title}</h2></div><button className="btn-ghost" onClick={() => downloadRecord(record)}>导出记录</button></div><p>{record.experiment.mode.toUpperCase()} · {record.experiment.components.length} 个器具 · {record.experiment.connections.length} 个连接 · t = {record.time.toFixed(3)} s</p>{record.experiment.goal && <p>探索目标：{record.experiment.goal}</p>}<div className="pq-readings">{Object.values(record.readings.channels).slice(0, 12).map((reading, i) => <div key={i}><span>{reading.label}</span><strong>{reading.valid!==false && Number.isFinite(reading.value) ? Number(reading.value.toPrecision(5)) : '—'} <small>{reading.unit}</small></strong></div>)}</div>{record.circuitError && <p className="pq-record-warning">电路求解提示：{record.circuitError}</p>}<label htmlFor={'note-' + record.id}>现象、解释与下一步</label><textarea id={'note-' + record.id} value={record.note} placeholder="观察到了什么？还想改变哪个条件？" maxLength={6000} onChange={event => persist(records.map(r => r.id === record.id ? {...r, note: event.target.value} : r))} /><details><summary>查看器具配置</summary><pre>{JSON.stringify(record.experiment, null, 2)}</pre></details></article>)}</div>}</main>}
    {message && <div className="pq-toast" role="status">{message}</div>}
  </div>;
}
