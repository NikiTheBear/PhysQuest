/**
 * AI 提示词
 *
 * `SYSTEM` 是文档 §3.2 的全文，**逐字**复制，不要改 —— 那五条禁令是整个设计的护栏。
 * `renderGradingPacket` 按 §3.3 的排版拼「评分包」，数字全部来自本地计算。
 *
 * 一处刻意的取舍（§7.1 末段）：读数表**只放通道值**，不放原始 params 里的 `h`，
 * 否则 AI 会拿 imageHeight 和 h 一除，自己说出「一半」这种没有出处的倍数。
 */

import { STAGE_LABEL } from '../contracts';
import {
  changeTableMarkdown,
  checkTableMarkdown,
  readingTableMarkdown,
} from './comparison';
import { observationLabel } from './rubric';
import type { GradingInput } from './types';

/* ============================================================
 * system：固定不变，不含任何学生数据
 * ========================================================== */

export const SYSTEM = `你是「探理实验室」的评分助手。你只做两件事：给四个维度各写一句评语，以及判断学生反思里的句子跟给定的对照表对不对得上。

【绝对禁止】
1. 不许自己算任何物理量。不许做加减乘除、不许比较大小、不许用公式推导。
   你需要的所有比较结果都已经算好，放在【对照表 T】里，每一行的「引擎判定」就是唯一答案。
2. 不许修改、补充、纠正任何读数。你可以引用【读数表 R】里的数字，但必须逐字照抄，
   包括小数位数（例如 -2.8571 不能写成 -2.86，0.0111 不能写成 0.01）。
3. 不许在评语里出现【读数表 R】【分数表】以外的新数字。想说的是「变大了」就说变大了，
   不要自己算一个倍数出来。
4. 不许替学生写反思。不许输出「可以这样写」「建议改成」「参考范文」这类内容。
   你只能指出他写的哪一句跟哪一行读数不符。
5. 不许输出 markdown、代码块、解释性前言。只输出一个 JSON 对象。

【你的两个任务】
任务一：写评语。四个维度各一句，中文，30–60 字。
  - 必须引用至少一个【读数表 R】或【对照表 T】里的编号或数字，让人能核对。
  - 分数已经算好了，见【分数表】。你不能改分数，评语要和分数一致：
    分数 100 就正面说清「对在哪」；分数 80–99 就指出差的那一点；分数 <80 就给出下一步具体动作。
  - 语气像一个不夸张的物理老师：说事实，不夸奖，不训斥，不用感叹号。
任务二：判断结论（conclusion 维度）。通读学生反思，找出【可核对的陈述】——
  即那些说了「像多大 / 正立还是倒立 / 光屏上有没有像 / 变亮还是变暗 / 变大还是变小」的句子。
  每一句对到【对照表 T】里最接近的一行，给出 agree（一致）/ contradict（相反）/ unrelated（表里没有对应行）。
  quote 必须是从反思里逐字截取的连续片段，不许改写、不许拼接。
  然后给一个总档位：
    excellent —— 所有陈述都对得上，并且至少有一句明确说了「改了哪个量 → 哪个量怎么变」
    solid     —— 所有陈述都对得上，但只是描述现象，没把变量和结果连起来
    shaky     —— 有可核对的陈述，但含糊到没法判定（例如「像变大了」却没说比什么大）
    wrong     —— 至少一句和读数直接相反
  如果反思里一句可核对的陈述都没有，档位给 shaky，claims 给空数组。

【输出格式】严格按下面这个结构，不要多字段，不要少字段：
{
  "version": 1,
  "challengeId": "输入里的挑战 id，照抄",
  "dimensions": {
    "assembly":    { "text": "一句评语", "refs": ["R1"] },
    "observation": { "text": "一句评语", "refs": ["R2"] },
    "variables":   { "text": "一句评语", "refs": ["V1"] },
    "conclusion":  { "text": "一句评语", "refs": ["T2"] }
  },
  "claims": [
    { "quote": "反思里的原句", "checkId": "T2", "verdict": "agree", "note": "一句话" }
  ],
  "conclusionBand": "excellent | solid | shaky | wrong",
  "summary": "两句话以内的总体说明，不许出现新的数字"
}

refs 可以是 R1/R2…（读数）、V1/V2…（变化）、T1/T2…（对照）、或无（写 []）。
某一维度被标了 insufficient 时，text 写「这一项本次数据不足，不评价」，refs 给 []。`;

/* ============================================================
 * user：评分包
 * ========================================================== */

const GOAL_MET_TEXT: Record<'yes' | 'no' | 'unknown', string> = {
  yes: '达成了',
  no: '还没达到',
  unknown: '数据不足，无法判定',
};

function scoreText(score: number | null): string {
  return score === null ? '数据不足，本次不评' : String(score);
}

function requiredObservationsText(input: GradingInput): string {
  const req = input.challenge.requiredObservations;
  if (req.length === 0) return '这一关没有能落到通道上的观测项。';
  const parts = req.map(observationLabel);
  const optional = input.challenge.optionalObservations;
  const tail = optional.length
    ? `另可看（不加分，只写进评语）：${optional.map(observationLabel).join('、')}`
    : '';
  return `必看：${parts.join('、')}。${tail}`;
}

function unmappableText(input: GradingInput): string {
  const list = input.challenge.unmappableObservations;
  if (list.length === 0) return '';
  return `无法核对（原话，不在读数表里，不要拿它当判据）：${list.join('；')}`;
}

function seenText(input: GradingInput): string {
  const seen = input.seenObservations;
  if (seen.length === 0) return '学生没有自报看过哪些读数。';
  return seen.map(observationLabel).join('、');
}

export function renderGradingPacket(input: GradingInput): string {
  const lines: string[] = [];
  const c = input.challenge;

  lines.push('【评分包 v1】');
  lines.push('');
  lines.push(`挑战：${c.id} ${c.title}`);
  lines.push(`实验台：${c.labId}`);
  lines.push(`本关目标（引擎判定）：${c.winText} → ${GOAL_MET_TEXT[c.goalMet]}`);
  lines.push(`学生学段：${STAGE_LABEL[input.stage]}`);
  lines.push('');

  lines.push('【分数表】← 这些分数已经由本地规则算好。你只能引用，不能修改。');
  lines.push(`组装合法 D1   = ${scoreText(input.scores.assembly.score)}`);
  lines.push(`观测项   D2   = ${scoreText(input.scores.observation.score)}`);
  lines.push(`变量控制 D3   = ${scoreText(input.scores.variables.score)}`);
  lines.push('结论     D4   = 由你判定档位（excellent / solid / shaky / wrong）');
  lines.push('');

  lines.push('【这一关该看的读数】');
  lines.push(requiredObservationsText(input));
  const unmap = unmappableText(input);
  if (unmap) lines.push(unmap);
  lines.push('');

  lines.push('【学生自报看过的读数】');
  lines.push(seenText(input));
  lines.push('');

  lines.push('【读数表 R】');
  lines.push(...readingTableMarkdown(input.facts));
  lines.push('');

  lines.push('【变化表 V】');
  lines.push(...changeTableMarkdown(input.changes));
  lines.push('');

  lines.push('【对照表 T】');
  lines.push(...checkTableMarkdown(input.checks));
  lines.push('');

  lines.push('【学生的反思（原文，不许改写）】');
  lines.push('"""');
  lines.push(input.reflection.text);
  lines.push('"""');
  lines.push('');
  lines.push('请按 system 里规定的 JSON 结构输出。');

  return lines.join('\n');
}

export function buildPrompt(input: GradingInput): { system: string; user: string } {
  return { system: SYSTEM, user: renderGradingPacket(input) };
}

/** 给 UI / 测试用：这一关该看什么（中文名） */
export function requiredObservationsLabel(input: GradingInput): string {
  return input.challenge.requiredObservations.map(observationLabel).join('、') || '（无）';
}
