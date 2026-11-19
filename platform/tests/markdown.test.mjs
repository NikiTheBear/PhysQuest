import test from 'node:test';
import assert from 'node:assert/strict';
import {renderMarkdown} from '../web/markdown.js';
test('chat renders Markdown without executing raw HTML or unsafe links',()=>{
  const html=renderMarkdown('**步骤**\n\n1. 调整电阻\n\n`R = U/I`\n\n<script>alert(1)</script> [点此](javascript:alert(1))');
  for(const tag of ['<strong>','<ol>','<code>','&lt;script&gt;'])assert.ok(html.includes(tag));
  assert.doesNotMatch(html,/<script>|href="javascript:/i);
});
