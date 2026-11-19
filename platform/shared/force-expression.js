// Compile the arithmetic grammar once per force source. No JavaScript evaluation.
const variables=new Set('t x y z vx vy vz speed m'.split(' '));
const functions={sin:Math.sin,cos:Math.cos,abs:Math.abs,sqrt:Math.sqrt,exp:Math.exp};
export function compileForce(source){
  if(typeof source!=='string'||!source.trim()||source.length>160)throw new Error('力表达式须为 1–160 个字符');
  const tokens=source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_]\w*|[^\s]/g);
  let index=0;
  const take=value=>tokens[index]===value && (++index,true);
  function atom(){
    const token=tokens[index++];
    if(token==='('){const inner=sum();if(!take(')'))throw new Error('力表达式缺少右括号');return inner;}
    if(token==='pi')return ()=>Math.PI;
    if(variables.has(token))return values=>values[token];
    if(Object.hasOwn(functions,token)&&take('(')){
      const arg=sum();if(!take(')'))throw new Error('函数缺少右括号');
      return values=>functions[token](arg(values));
    }
    if(token && /^[.\d]/.test(token)&&Number.isFinite(Number(token)))return ()=>Number(token);
    throw new Error('无法识别的力表达式项：'+(token||'末尾'));
  }
  function unary(){
    if(take('-')){const arg=unary();return v=>-arg(v);}
    if(take('+'))return unary();
    const left=atom();if(!take('^'))return left;
    const right=unary();return v=>left(v)**right(v);
  }
  function product(){
    let result=unary();
    while(tokens[index]==='*'||tokens[index]==='/'){
      const op=tokens[index++],left=result,right=unary();result=v=>op==='*'?left(v)*right(v):left(v)/right(v);
    }
    return result;
  }
  function sum(){
    let result=product();
    while(tokens[index]==='+'||tokens[index]==='-'){
      const op=tokens[index++],left=result,right=product();result=v=>op==='+'?left(v)+right(v):left(v)-right(v);
    }
    return result;
  }
  const evaluate=sum();if(index!==tokens.length)throw new Error('力表达式中有多余符号');
  return evaluate;
}
