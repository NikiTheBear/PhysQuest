// Saved experiments and MCP use numbers. Only their presentation changes here.
const controls={
  closed:{type:'switch',label:'电路通断',options:['断开','闭合']},
  maskTop:{type:'switch',label:'遮住透镜上半部',options:['未遮挡','已遮挡']},
  axis:{type:'segments',label:'方向',options:['X','Y','Z']},
  objectShape:{type:'segments',label:'物体形状',options:['箭头','字母 F','蜡烛']},
  directivity:{type:'select',label:'指向性指数',options:['1','2','3','4','5','6','7','8'],first:1}
};

export function choiceSpec(key){return Object.hasOwn(controls,key)?controls[key]:null;}

export function allowedChoices(key,{min,max,step}){
  const control=choiceSpec(key);
  return control.options.map((label,i)=>({label,value:i+(control.first||0)}))
    .filter(({value})=>value>=min&&value<=max&&(value-min)%step===0);
}

export function choiceValue(input){
  return input.type==='checkbox'?Number(input.checked):Number(input.value);
}

export function updateChoice(element,value){
  for(const input of element.querySelectorAll('input, select')){
    if(input.type==='checkbox')input.checked=Boolean(value);
    else if(input.type==='radio')input.checked=Number(input.value)===value;
    else input.value=String(value);
  }
}

export function createChoice(key,bounds,title,value,name){
  const spec=choiceSpec(key),options=allowedChoices(key,bounds);
  const field=document.createElement('fieldset'),legend=document.createElement('legend');
  field.className='parameter-choice';field.dataset.choice=key;
  legend.textContent=title;field.append(legend);
  if(spec.type==='select'){
    const select=document.createElement('select');
    select.setAttribute('aria-label',title);
    options.forEach(o=>select.add(new Option(o.label,o.value)));
    field.append(select);
  }else if(spec.type==='switch'){
    const label=document.createElement('label'),input=document.createElement('input');
    label.className='toggle-choice';input.type='checkbox';input.setAttribute('role','switch');
    input.setAttribute('aria-label',title);
    const track=document.createElement('span');track.className='switch-track';
    label.append(input,track);
    for(const [i,text] of spec.options.entries()){
      const state=document.createElement('span');state.className=i?'when-on':'when-off';state.textContent=text;
      label.append(state);
    }
    field.append(label);
  }else{
    const group=document.createElement('div');group.className='segmented-choice';
    for(const option of options){
      const label=document.createElement('label'),input=document.createElement('input'),caption=document.createElement('span');
      input.type='radio';input.name=name;input.value=option.value;caption.textContent=option.label;
      label.append(input,caption);group.append(label);
    }
    field.append(group);
  }
  updateChoice(field,value);
  return field;
}
