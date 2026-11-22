/**
 * 报告用的极简 Markdown 渲染
 *
 * 为什么不用 markdown-it：这个仓库的 web 端只有 react 依赖，再引一个库不划算；
 * 更要紧的是报告内容里会混入学生自己写的反思（自由文本），所以**必须用 React 元素
 * 拼装、绝对不用 dangerouslySetInnerHTML**，避免把学生输入当 HTML 执行。
 *
 * 只支持报告里实际用到的语法：
 *   ## 二级标题 / ### 三级标题
 *   - 无序列表
 *   | a | b | 表格（含 |---| 分隔行）
 *   **加粗**、_斜体_
 *   其余按段落输出
 */
import type { ReactNode } from 'react';

/** 行内：**加粗** 与 _斜体_，其余原样（不解析 HTML、不解析链接） */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|_([^_]+)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b${i++}`}>{m[1]}</strong>);
    } else {
      nodes.push(<em key={`${keyPrefix}-i${i++}`}>{m[2]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const isTableRow = (line: string) => line.trim().startsWith('|') && line.trim().endsWith('|');
const isTableDivider = (line: string) => /^\|[\s:|-]+\|$/.test(line.trim());
const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 空行 = 段落分隔，跳过
    if (!trimmed) {
      i++;
      continue;
    }

    // 只写了一个 `#` 开头、但不是 `## ` / `### ` 的行（一级标题、`####` 之类）。
    // 报告里本来不该出现，但历史存档和外面粘进来的文本可能有。
    // **必须在这里吃掉 i**：否则会掉进下面的段落分支，而段落分支遇到 `#` 开头就 break、
    // i 又不前进 → 死循环把标签页挂死（local/AI-GRADING-SPEC.md §2.4 缺口 6）。
    if (trimmed.startsWith('#') && !trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
      blocks.push(
        <p key={key++} className="md-p">
          {renderInline(trimmed.replace(/^#+\s*/, ''), `p-${key}`)}
        </p>,
      );
      i++;
      continue;
    }

    // 标题
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h5 key={key++} className="md-h5">
          {renderInline(trimmed.slice(4), `h5-${key}`)}
        </h5>,
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h4 key={key++} className="md-h4">
          {renderInline(trimmed.slice(3), `h4-${key}`)}
        </h4>,
      );
      i++;
      continue;
    }

    // 表格：连续的 | 行
    if (isTableRow(trimmed)) {
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        if (!isTableDivider(lines[i])) rows.push(splitRow(lines[i]));
        i++;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div className="md-table-wrap" key={key++}>
          <table className="md-table">
            {head && (
              <thead>
                <tr>
                  {head.map((c, ci) => (
                    <th key={ci}>{renderInline(c, `th-${key}-${ci}`)}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci}>{renderInline(c, `td-${key}-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // 列表
    if (trimmed.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} className="md-list">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `li-${key}-${ii}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // 段落：连续的非空、非特殊行合并
    const para: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t || t.startsWith('#') || t.startsWith('- ') || isTableRow(t)) break;
      para.push(t);
      i++;
    }
    // 兜底：极端情况下（例如只有一行 '###'）上面的循环一行都没吃，这里也必须前进，
    // 否则外层 while 永远停在原地、把堆吃光。宁可丢一行，不能挂死标签页。
    if (para.length === 0) {
      i++;
      continue;
    }
    blocks.push(
      <p key={key++} className="md-p">
        {renderInline(para.join(' '), `p-${key}`)}
      </p>,
    );
  }

  return <div className="md-body">{blocks}</div>;
}
