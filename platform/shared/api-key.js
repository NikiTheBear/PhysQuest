// Credentials travel in HTTP headers. Keep Unicode in the message body only.
export function readDeepSeekKey(input){
  let key=typeof input==='string'?input.trim():'';
  const pair={'"':'"',"'":"'","“":"”","‘":"’","`":"`"};
  if(Object.hasOwn(pair,key[0])&&key.at(-1)===pair[key[0]])key=key.slice(1,-1).trim();
  if(!key)throw new Error('请在设置中填写 DeepSeek API Key。');
  if(!/^[\x21-\x7e]{8,256}$/.test(key))throw new Error('密钥格式有误。请在设置中只粘贴 API Key，去掉中文说明、空格和不可见字符。');
  return key;
}
