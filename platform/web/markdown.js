import MarkdownIt from 'markdown-it';

const parser=new MarkdownIt({html:false,breaks:true}).disable('image');
parser.enable('table');
parser.renderer.rules.table_open=()=>'<div class="chat-table-scroll" tabindex="0" role="region" aria-label="表格"><table>\n';
parser.renderer.rules.table_close=()=>'</table></div>\n';
parser.validateLink=url=>/^https?:\/\//i.test(url)||/^mailto:/i.test(url);
parser.renderer.rules.link_open=(tokens,index,options,env,renderer)=>{
  tokens[index].attrSet('target','_blank');
  tokens[index].attrSet('rel','noopener noreferrer');
  return renderer.renderToken(tokens,index,options);
};
export function renderMarkdown(text){return parser.render(text);}
