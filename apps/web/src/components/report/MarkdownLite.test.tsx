import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MarkdownLite } from './MarkdownLite';

const render = (text: string) => renderToStaticMarkup(createElement(MarkdownLite, { text }));

describe('报告 Markdown 渲染', () => {
  it('二级标题、列表、段落都渲染成真元素', () => {
    const html = render('## 一、模型声明\n\n- 第一条\n- 第二条\n\n普通段落。');
    expect(html).toContain('<h4');
    expect(html).toContain('一、模型声明');
    expect(html).toContain('<ul');
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).toContain('<p');
  });

  it('表格渲染成 thead/tbody，分隔行不会被当成数据', () => {
    const html = render(
      ['| # | 物距u | 结果 |', '|---|---|---|', '| 1 | 30.0 | 倒立缩小 |'].join('\n'),
    );
    expect(html).toContain('<table');
    expect(html).toContain('<thead');
    expect(html).toContain('<tbody');
    expect(html.match(/<th[ >]/g)).toHaveLength(3);
    expect(html).toContain('倒立缩小');
    // 分隔行 |---|---|---| 不该出现
    expect(html).not.toContain('---');
    expect(html.match(/<tr/g)).toHaveLength(2); // 表头 1 + 数据 1
  });

  it('加粗与斜体生效', () => {
    const html = render('这是**重点**和_强调_。');
    expect(html).toContain('<strong>重点</strong>');
    expect(html).toContain('<em>强调</em>');
  });

  it('学生输入里的 HTML 被当成文字，不会执行', () => {
    const html = render('我的反思：<script>alert(1)</script><img src=x onerror=alert(2)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('一级标题不会死循环（文档 §2.4 缺口 6）', () => {
    const html = render('# 凸透镜成像 · 学习报告\n\n## 一、模型声明\n');
    expect(html).toContain('md-body');
    expect(html).toContain('凸透镜成像 · 学习报告');
    expect(html).toContain('<h4');
  });

  it('孤立的 # / #### 也吃得下去，不会原地打转', () => {
    expect(render('#')).toContain('md-body');
    expect(render('#### 四级')).toContain('md-body');
    expect(render('#\n#\n# 标题')).toContain('md-body');
  });

  it('空行与空内容不崩', () => {
    expect(render('')).toContain('md-body');
    expect(render('\n\n\n')).toContain('md-body');
  });
});
