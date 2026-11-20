// Panel visibility is independent of the simulation and its canvas size.
export function floatingPanels(){
  const buttons=[...document.querySelectorAll('[data-panel]')];
  const compact=window.matchMedia('(max-width: 760px)');
  let lastPanel;
  const isChat=name=>name==='chat'||name==='properties';
  const isLeft=name=>name==='tuning'||name==='library';
  function open(name,show=true){
    const active=buttons.find(b=>b.dataset.panel===name);
    if(!active)return;
    if(show){
      lastPanel=name;
      for(const b of buttons){
        if(b!==active&&(compact.matches||
            (isChat(name)&&isChat(b.dataset.panel))||(isLeft(name)&&isLeft(b.dataset.panel))))open(b.dataset.panel,false);
      }
    }
    active.setAttribute('aria-expanded',String(show));
    const id=active.getAttribute('aria-controls');
    const visible=buttons.some(b=>b.getAttribute('aria-controls')===id&&b.getAttribute('aria-expanded')==='true');
    document.getElementById(id).classList.toggle('stage-hidden',!visible);
  }
  buttons.forEach(b=>open(b.dataset.panel,false));
  compact.addEventListener('change',()=>{
    if(!compact.matches)return;
    const visible=buttons.filter(b=>b.getAttribute('aria-expanded')==='true');
    const keep=visible.find(b=>b.dataset.panel===lastPanel)||visible.at(-1);
    if(keep)open(keep.dataset.panel);
  });
  return {open,buttons};
}
