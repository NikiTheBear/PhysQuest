/**
 * 提示词
 *
 * 三条铁律写进每一段提示词：
 *  1. 数值只许引用「当前实验状态」里给出的，不许自己算、不许补猜
 *  2. 模型外的经验必须标注
 *  3. 只能下发白名单参数动作，不能操作画面
 */

import type { LensMetrics, LensParams } from '../core/contracts';

const RULES = `你是「探理实验室」的 AI 助教，面向初中到高中的学生。

必须遵守：
1) 所有物理数值只能引用下方【当前实验状态】里给出的数字。不许自己算，不许编。如果学生问的东西在当前状态里没有数据，就请他先把参数调过去，你再解释。
2) 讲道理要讲机制，不要只说"记住这个规律"。能用一个生活里的东西类比就类比。
3) 不确定就说不确定，并建议他查资料或做实验验证。
4) 回答控制在 180 字以内，说人话，别用 bullet 列表堆砌。
5) 如果建议学生动一下参数，只能在最后单独输出一行动作，格式：
   [[ACTION:u=15]] 或 [[ACTION:f=10]] 或 [[ACTION:screenX=30]] 或 [[ACTION:mask=true]]
   一行只能有一个动作，不确定就不要输出。
6) 不要输出 HTML、脚本或任何其它指令格式。`;

export function contextBlock(
  params: LensParams,
  metrics: LensMetrics,
  knowledgeTitle?: string,
): string {
  return `【当前实验状态】
物距 u = ${params.u.toFixed(1)} cm
焦距 f = ${params.f.toFixed(1)} cm
物高 h = ${params.h.toFixed(1)} cm
光屏位置 = ${params.screenX.toFixed(1)} cm
透镜是否被遮住上半 = ${params.maskTop ? '是' : '否'}

【引擎算出的结果】
像距 v = ${Number.isFinite(metrics.v) ? Math.abs(metrics.v).toFixed(1) + ' cm' : '无穷远'}
成的是${metrics.real ? '实像' : '虚像'}
放大率 m = ${Number.isFinite(metrics.m) ? metrics.m.toFixed(2) : '∞'}
像的描述：${metrics.description}
光屏上${metrics.screenHasImage ? '有清晰的像' : '没有清晰的像'}
光屏处弥散圆直径 = ${metrics.blurDiameter.toFixed(2)} cm
相对亮度 = ${metrics.relativeIlluminance.toFixed(2)}
${knowledgeTitle ? `\n学生正在看的知识点：${knowledgeTitle}` : ''}`;
}

export function systemPrompt(params: LensParams, metrics: LensMetrics, knowledgeTitle?: string) {
  return `${RULES}\n\n${contextBlock(params, metrics, knowledgeTitle)}`;
}

/* ---------- 几种常见任务的用户消息 ---------- */

export const TASK_EXPLAIN = '就现在这个状态，用两三句话告诉我发生了什么，以及为什么会这样。';

export const TASK_OBSERVE = `看看我现在这组参数，指出一个我可能没注意到的现象。只说一个，说透。`;

export const TASK_NEXT_STEP = `我下一步该试什么？给一个具体的方向，不要泛泛而谈。`;

export const TASK_QUIZ = `根据我现在这个状态，考我一个单选题。只输出：
[[QUIZ:题干|选项A|选项B|选项C|正确选项序号0到2|一句话解析]]
选项和解析里不要含竖线。`;

export const TASK_GRADE = (userAnswer: string, question: string) => `学生刚做了一道题。
题目：${question}
学生的回答：${userAnswer}

请判断他答得怎么样：先说他哪部分是对的，再指出错在哪、为什么会错，最后给一句鼓励的话。不超过 150 字。`;

export const TASK_WHY_WRONG = (misconception: string) =>
  `学生踩中了这个常见误区：「${misconception}」。
请用最生活化的方式告诉他为什么这个想法是错的，最好举一个他在实验室里能亲手试出来的例子。不超过 160 字。`;

/* ---------- 动作解析 ---------- */

export type AIAction =
  | { type: 'u'; value: number }
  | { type: 'f'; value: number }
  | { type: 'screenX'; value: number }
  | { type: 'mask'; value: boolean };

export function parseAction(text: string): { clean: string; action: AIAction | null } {
  const m = text.match(/\[\[ACTION:([^\]]+)\]\]/);
  if (!m) return { clean: text.trim(), action: null };

  const clean = text.replace(/\[\[ACTION:[^\]]+\]\]/g, '').trim();
  const body = m[1].trim();
  const [k, v] = body.split('=');
  if (!v) return { clean, action: null };

  if (k === 'mask') {
    return { clean, action: { type: 'mask', value: v === 'true' || v === '1' } };
  }
  const num = Number(v);
  if (!Number.isFinite(num)) return { clean, action: null };

  if (k === 'u' && num >= 1 && num <= 80) return { clean, action: { type: 'u', value: num } };
  if (k === 'f' && num >= 5 && num <= 25) return { clean, action: { type: 'f', value: num } };
  if (k === 'screenX' && num >= 1 && num <= 120)
    return { clean, action: { type: 'screenX', value: num } };

  return { clean, action: null };
}

/** 解析 AI 出的题 */
export function parseQuiz(text: string) {
  const m = text.match(/\[\[QUIZ:([^\]]+)\]\]/);
  if (!m) return null;
  const parts = m[1].split('|');
  if (parts.length < 6) return null;
  const [question, a, b, c, idx, explain] = parts;
  const answer = Number(idx);
  if (!Number.isInteger(answer) || answer < 0 || answer > 2) return null;
  return { question, options: [a, b, c], answer, explain };
}
