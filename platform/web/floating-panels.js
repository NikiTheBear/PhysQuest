// Panel visibility is independent of the simulation and its canvas size.
export function floatingPanels(){
  const buttons=[...document.querySelectorAll('[data-panel]')];
  const isChat=name=>name==='chat'||name==='properties';
  function open(name,show=true){
    const active=buttons.find(b=>b.dataset.panel===name);
    if(!active)return;
    if(show){
      for(const b of buttons){
        if(b!==active&&(window.matchMedia('(max-width: 760px)').matches||
            (isChat(name)&&isChat(b.dataset.panel))))open(b.dataset.panel,false);
      }
    }
    active.setAttribute('aria-expanded',String(show));
    const id=active.getAttribute('aria-controls');
    const visible=buttons.some(b=>b.getAttribute('aria-controls')===id&&b.getAttribute('aria-expanded')==='true');
    document.getElementById(id).classList.toggle('stage-hidden',!visible);
  }
  buttons.forEach(b=>open(b.dataset.panel,false));
  return {open,buttons};
}
