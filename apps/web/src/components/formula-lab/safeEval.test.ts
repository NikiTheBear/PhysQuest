import { describe, expect, it } from 'vitest';
import { safeEval, MATH_MEMBER_NAMES, BANNED_WORDS } from './safeEval';
import { LABS } from './labData';

/**
 * safeEval 的正式测试。
 *
 * 之前只有临时脚本在命令行里跑过一遍，没落地。这里把它钉成四组：
 *   ① 正常计算 —— 数据里真出现的写法都要算得对
 *   ② 必须拒绝 —— 任何试图摸到宿主环境的东西都返回 null
 *   ③ 边界 —— 除零 / 开方负数 / 溢出 / 空串一律 null（界面显示「—」）
 *   ④ 数据驱动 —— 把 formula-lab.json 里 78 条 formula 的 97 个 expr
 *      在默认输入下全跑一遍，一条都不许算不出来
 */

const V = (o: Record<string, number>) => o;

/* ============================================================
   ① 正常计算
   ============================================================ */

describe('safeEval · 正常计算', () => {
  it('三个变量相乘：k * v * gain', () => {
    expect(safeEval('k * v * gain', V({ k: 0.5, v: 0.5, gain: 1 }))).toBe(0.25);
    // gain 翻倍，结果翻倍（学生要看见的比例关系）
    expect(safeEval('k * v * gain', V({ k: 0.5, v: 0.5, gain: 2 }))).toBe(0.5);
  });

  it('嵌套除法 + 负指数：Math.pow(2, -t / half)', () => {
    expect(safeEval('Math.pow(2, -t / half)', V({ t: 5730, half: 5730 }))).toBe(0.5);
    expect(safeEval('Math.pow(2, -t / half)', V({ t: 0, half: 5730 }))).toBe(1);
    // 一个半衰期后剩四分之一
    expect(safeEval('Math.pow(2, -t / half)', V({ t: 11460, half: 5730 }))).toBe(0.25);
  });

  it('勾股：Math.sqrt(x*x + y*y)', () => {
    expect(safeEval('Math.sqrt(x*x + y*y)', V({ x: 3, y: 4 }))).toBe(5);
    expect(safeEval('Math.sqrt(x*x + y*y)', V({ x: 0, y: 0 }))).toBe(0);
  });

  it('声压级：Math.log10(p / p0)', () => {
    // 声压是基准的 1000 倍 → 60 dB（K-A4-03 的默认值就是这个）
    const spl = safeEval('20 * Math.log10(p / 0.00002)', V({ p: 0.02 }));
    expect(spl).not.toBeNull();
    expect(spl as number).toBeCloseTo(60, 10);
    // 10 倍声压 = +20 dB
    const a = safeEval('20 * Math.log10(p / 0.00002)', V({ p: 0.00002 })) as number;
    const b = safeEval('20 * Math.log10(p / 0.00002)', V({ p: 0.0002 })) as number;
    expect(b - a).toBeCloseTo(20, 10);
    // p0 写成变量也一样
    expect(safeEval('Math.log10(p / p0)', V({ p: 0.02, p0: 0.00002 })) as number).toBeCloseTo(3, 10);
  });

  it('常量 + 平方：Math.PI * r * r', () => {
    expect(safeEval('Math.PI * r * r', V({ r: 2 }))).toBeCloseTo(Math.PI * 4, 12);
    expect(safeEval('Math.PI * r * r', V({ r: 0.5 }))).toBeCloseTo(Math.PI * 0.25, 12);
  });

  it('一元负号：-x（以及 -(-x)、-(a + b)）', () => {
    expect(safeEval('-x', V({ x: 3 }))).toBe(-3);
    expect(safeEval('-x', V({ x: -3 }))).toBe(3);
    expect(safeEval('--x', V({ x: 3 }))).toBe(3);
    expect(safeEval('-(a + b)', V({ a: 1, b: 2 }))).toBe(-3);
    expect(safeEval('3 * -x', V({ x: 2 }))).toBe(-6);
  });

  it('科学计数法：6.674e-11 * m1 * m2 / (r*r)', () => {
    const f = safeEval('6.674e-11 * m1 * m2 / (r * r)', V({ m1: 5.97e24, m2: 70, r: 6371000 }));
    expect(f).not.toBeNull();
    // 地球表面上 70 kg 的人约 687 N
    expect(f as number).toBeCloseTo(687.137, 2);
  });

  it('前导小数点：.5 * x', () => {
    expect(safeEval('.5 * x', V({ x: 4 }))).toBe(2);
    expect(safeEval('.25 + .25', {})).toBe(0.5);
  });

  it('括号嵌套：((a + b) * (c - d)) / 2', () => {
    expect(safeEval('((a + b) * (c - d)) / 2', V({ a: 1, b: 2, c: 9, d: 3 }))).toBe(9);
    // 优先级：先乘除后加减
    expect(safeEval('1 + 2 * 3', {})).toBe(7);
    expect(safeEval('(1 + 2) * 3', {})).toBe(9);
    expect(safeEval('8 / 4 / 2', {})).toBe(1); // 左结合
    expect(safeEval('10 - 3 - 2', {})).toBe(5);
  });

  it('指数衰减：Math.exp(-t / tau)', () => {
    expect(safeEval('Math.exp(-t / tau)', V({ t: 0, tau: 2 }))).toBe(1);
    expect(safeEval('Math.exp(-t / tau)', V({ t: 5, tau: 2 }))).toBeCloseTo(Math.exp(-2.5), 12);
    expect(safeEval('Math.exp(-t / tau)', V({ t: 2, tau: 2 }))).toBeCloseTo(Math.exp(-1), 12);
  });

  it('常量：Math.E / Math.PI / Math.LN10 / Math.LN2', () => {
    expect(safeEval('Math.E', {})).toBeCloseTo(Math.E, 15);
    expect(safeEval('Math.PI', {})).toBeCloseTo(Math.PI, 15);
    expect(safeEval('Math.LN10', {})).toBeCloseTo(Math.LN10, 15);
    expect(safeEval('Math.LN2', {})).toBeCloseTo(Math.LN2, 15);
  });

  it('Math.min(a, b) + Math.max(c, d)', () => {
    expect(safeEval('Math.min(a, b) + Math.max(c, d)', V({ a: 3, b: 7, c: 2, d: 9 }))).toBe(12);
    // 多参数
    expect(safeEval('Math.min(5, 3, 9)', {})).toBe(3);
    expect(safeEval('Math.max(5, 3, 9)', {})).toBe(9);
  });

  it('剩余的 Math 成员都能用：abs / sin / cos / tan / log', () => {
    expect(safeEval('Math.abs(-7)', {})).toBe(7);
    expect(safeEval('Math.sin(0)', {})).toBe(0);
    expect(safeEval('Math.cos(0)', {})).toBe(1);
    expect(safeEval('Math.tan(0)', {})).toBe(0);
    expect(safeEval('Math.log(Math.E)', {})).toBeCloseTo(1, 15);
    // 等温做功：Math.log(v2 / v1)（K-T3-06 的写法）
    expect(safeEval('8.314 * n * t * Math.log(v2 / v1)', V({ n: 1, t: 300, v1: 10, v2: 20 })))
      .toBeCloseTo(8.314 * 300 * Math.log(2), 10);
  });

  it('空白随便加：`  2   *  3 `', () => {
    expect(safeEval('  2   *  3 ', {})).toBe(6);
    expect(safeEval('\t1\t+\n2\r', {})).toBe(3);
  });

  it('不读的量不影响结果，也不改传入的 vars（纯函数）', () => {
    const vars = { a: 2, b: 3, unused: 999 };
    const snapshot = { ...vars };
    expect(safeEval('a * b', vars)).toBe(6);
    expect(vars).toEqual(snapshot);
  });

  it('变量名允许下划线和数字（q0 / m1 / t_2）', () => {
    expect(safeEval('q0 * m1 + t_2', V({ q0: 2, m1: 3, t_2: 4 }))).toBe(10);
  });
});

/* ============================================================
   ② 必须拒绝
   ============================================================ */

describe('safeEval · 必须拒绝', () => {
  const REJECT: Array<[string, string]> = [
    ['window.location', 'window'],
    ['document.cookie', 'document / cookie'],
    ['fetch("x")', 'fetch'],
    ['constructor', 'constructor'],
    ['this', 'this'],
    ['globalThis', 'globalThis'],
    ['eval("1")', 'eval'],
    ['new Function("1")', 'new Function'],
    ['Math.random()', 'Math.random 不在白名单'],
    ['Math.constructor', 'Math.constructor'],
    ['1; 2', '分号不在字符白名单'],
    ['`1`', '反引号不在字符白名单'],
    ['alert,1', 'alert'],
    ['foo * 2', '未知变量'],
    ['Math', '裸 Math（没有成员）'],
    // —— 多补几条同族的 ——
    ['localStorage.token', 'localStorage'],
    ['process.exit(1)', 'process 未定义 + 括号'],
    ['Math["PI"]', '方括号不在字符白名单'],
    ['Math.prototype', 'prototype'],
    ['x => x', '箭头函数不支持'],
    ['0x10', '十六进制字面量（0x10 会被拆成 0 和 x10）'],
    ['1 % 2', '取模不在字符白名单'],
    ['2 ^ 3', '乘方符号不在字符白名单（要用 Math.pow）'],
    ['Math.max.length', '属性访问'],
    ['Math . max . call(null, 1)', '链式属性'],
    ['window["alert"]', '方括号'],
    ["'1'", '单引号字符串'],
    ['Math.sin(1)(2)', '调用结果再调用'],
  ];

  for (const [expr, why] of REJECT) {
    it(`拒绝 ${JSON.stringify(expr)}（${why}）`, () => {
      // 只给 x，不给 foo —— 否则 foo * 2 是能算的
      expect(safeEval(expr, { x: 1 })).toBeNull();
    });
  }

  // 任务书点名要逐条 assert 的那几条，单独列一遍，失败时能一眼看出是哪个漏了
  const MUST = [
    'window.location',
    'document.cookie',
    'fetch("x")',
    'constructor',
    'this',
    'globalThis',
    'eval("1")',
    'new Function("1")',
    'Math.random()',
    'Math.constructor',
    '1; 2',
    '`1`',
    'alert,1',
    'foo * 2',
    'Math',
  ];

  it('任务书点名的 15 条全部返回 null', () => {
    for (const expr of MUST) {
      expect(safeEval(expr, { x: 1, Math: 1 }), `漏了：${expr}`).toBeNull();
    }
  });

  it('关键字黑名单是子串匹配，大小写不敏感', () => {
    expect(safeEval('WINDOW', {})).toBeNull();
    expect(safeEval('GlObAlThIs', {})).toBeNull();
    expect(safeEval('FetCH', {})).toBeNull();
  });

  it('`Math` 写成变量名也不行（变量表里塞一个也叫 Math 的键）', () => {
    expect(safeEval('Math', { Math: 3 })).toBeNull();
    expect(safeEval('Math + 1', { Math: 3 })).toBeNull();
  });

  it('超长 / 超多 token 的输入直接拒（挡住「一万个括号」）', () => {
    expect(safeEval(`${'('.repeat(300)}1${')'.repeat(300)}`, {})).toBeNull();
    expect(safeEval('1+'.repeat(300) + '1', {})).toBeNull();
  });

  it('全角 / Unicode 减号、空格不认', () => {
    expect(safeEval('1 − 2', {})).toBeNull(); // U+2212
    expect(safeEval('1\u00a0+ 2', {})).toBeNull(); // 不换行空格
  });
});

/* ============================================================
   ③ 边界：算不出来就 null
   ============================================================ */

describe('safeEval · 边界一律 null', () => {
  it('除零', () => {
    expect(safeEval('1/0', {})).toBeNull();
    expect(safeEval('0/0', {})).toBeNull();
    expect(safeEval('x / 0', V({ x: 5 }))).toBeNull();
    expect(safeEval('1/(2-2)', {})).toBeNull();
  });

  it('空串 / 全空格 / 只有符号', () => {
    expect(safeEval('', {})).toBeNull();
    expect(safeEval('   ', {})).toBeNull();
    expect(safeEval('\t\n', {})).toBeNull();
    expect(safeEval('-', {})).toBeNull();
    expect(safeEval('()', {})).toBeNull();
  });

  it('定义域外：Math.sqrt(-1) / Math.log(0) / Math.log(-1)', () => {
    expect(safeEval('Math.sqrt(-1)', {})).toBeNull();
    expect(safeEval('Math.log(0)', {})).toBeNull();
    expect(safeEval('Math.log(-1)', {})).toBeNull();
    expect(safeEval('Math.log10(0)', {})).toBeNull();
    expect(safeEval('Math.sqrt(x)', V({ x: -4 }))).toBeNull();
  });

  it('溢出：1e308 * 10 → Infinity → null', () => {
    expect(safeEval('1e308 * 10', {})).toBeNull();
    expect(safeEval('Math.pow(10, 400)', {})).toBeNull();
    expect(safeEval('Math.exp(1000)', {})).toBeNull();
  });

  it('字面量本身超出 double 范围也拒（1e400 在 tokenize 阶段就扔）', () => {
    expect(safeEval('1e400', {})).toBeNull();
    expect(safeEval('1e400 * 0', {})).toBeNull();
  });

  it('Infinity / NaN 这类名字当变量也不行', () => {
    expect(safeEval('Infinity', {})).toBeNull();
    expect(safeEval('NaN', {})).toBeNull();
    expect(safeEval('Infinity + 1', {})).toBeNull();
  });

  it('变量值本身是 NaN / Infinity 时，等同于「未知变量」', () => {
    expect(safeEval('x * 2', { x: NaN })).toBeNull();
    expect(safeEval('x * 2', { x: Infinity })).toBeNull();
    expect(safeEval('x * 2', { x: -Infinity })).toBeNull();
  });

  it('非字符串参数（防御性，防止 JSON 里字段被改成数字）', () => {
    // @ts-expect-error 故意传错类型
    expect(safeEval(42, {})).toBeNull();
    // @ts-expect-error
    expect(safeEval(null, {})).toBeNull();
    // @ts-expect-error
    expect(safeEval(undefined, {})).toBeNull();
  });

  it('语法不完整一律 null', () => {
    expect(safeEval('1 +', {})).toBeNull();
    expect(safeEval('* 2', {})).toBeNull();
    expect(safeEval('(1 + 2', {})).toBeNull();
    expect(safeEval('1 + 2)', {})).toBeNull();
    expect(safeEval('Math.sqrt 4', {})).toBeNull();
    expect(safeEval('Math.sqrt(4, 5)', {})).toBeNull(); // 参数个数不对：sqrt 只收 1 个
    expect(safeEval('Math.sqrt()', {})).toBeNull();
    expect(safeEval('Math.pow(2)', {})).toBeNull();
    expect(safeEval('Math.log(1, 2)', {})).toBeNull();
    expect(safeEval('1 2', {})).toBeNull(); // 两个数字相邻
    expect(safeEval('1.2.3', {})).toBeNull();
  });
});

/* ============================================================
   ④ 数据驱动：formula-lab.json 全量
   ============================================================ */

describe('safeEval · 97 条真实数据', () => {
  const labs = Object.values(LABS).filter((l) => l.kind === 'formula');

  it('数据规模对得上（86 条 formula / 105 条 expr）', () => {
    expect(labs).toHaveLength(86);
    expect(labs.reduce((n, l) => n + l.outputs.length, 0)).toBe(105);
  });

  it('所有 formula 的 outputs[].expr 在默认输入下都能算出有限数', () => {
    for (const lab of labs) {
      const vars = Object.fromEntries(lab.inputs.map((i) => [i.key, i.default]));
      for (const out of lab.outputs) {
        const v = safeEval(out.expr, vars);
        expect(v, `${lab.title} 的 ${out.label}: ${out.expr}`).not.toBeNull();
        expect(Number.isFinite(v as number), `${lab.title} 的 ${out.label} 不是有限数`).toBe(true);
      }
    }
  });

  it('表达式的每个变量都能在 inputs 里找到（不会静默变成「—」）', () => {
    const missing: string[] = [];

    /**
     * 把表达式拆成「标识符 / 数字 / 其它」：标识符整段吃掉（f1、t0、m1 是一个名字，
     * 不能拆成 f + 1），数字字面量整段吃掉（含 6.674e-11 这种指数部分）。
     */
    const identifiers = (expr: string): string[] => {
      const bare = expr.replace(/Math\s*\.\s*[A-Za-z_][A-Za-z0-9_]*/g, ' ');
      const re = /([A-Za-z_][A-Za-z0-9_]*)|(\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/g;
      const out: string[] = [];
      for (const m of bare.matchAll(re)) if (m[1]) out.push(m[1]);
      return out;
    };

    for (const lab of labs) {
      const keys = new Set(lab.inputs.map((i) => i.key));
      for (const out of lab.outputs) {
        for (const name of identifiers(out.expr)) {
          if (!keys.has(name)) missing.push(`${lab.title} / ${out.expr} → ${name}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('数据里用到的每个 Math.* 都在白名单里（漏一个这条就红）', () => {
    const used = new Set<string>();
    for (const lab of labs) {
      for (const out of lab.outputs) {
        for (const m of out.expr.matchAll(/Math\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)/g)) {
          used.add(m[1]);
        }
      }
    }
    // 当前实际用量：PI×7 sqrt×5 exp×5 log×2 pow×2 log10×1 max×1
    expect([...used].sort()).toEqual(['PI', 'exp', 'log', 'log10', 'max', 'pow', 'sqrt']);
    for (const name of used) {
      expect(MATH_MEMBER_NAMES.has(name), `白名单漏了 Math.${name}`).toBe(true);
    }
  });

  it('输入变量名不会撞上关键字黑名单（黑名单是子串匹配，容易误伤）', () => {
    const collisions: string[] = [];
    for (const lab of labs) {
      for (const inp of lab.inputs) {
        const k = inp.key.toLowerCase();
        for (const w of BANNED_WORDS) {
          if (k.includes(w)) collisions.push(`${lab.title} / ${inp.key} 撞上 ${w}`);
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it('把 78 条 × {min, default, max} 的角点组合全跑一遍，不崩（算不出来可以，但不许抛异常）', () => {
    let evals = 0;
    const nulls: string[] = [];
    for (const lab of labs) {
      let combos: number[][] = [[]];
      for (const inp of lab.inputs) {
        const next: number[][] = [];
        for (const c of combos) for (const v of [inp.min, inp.default, inp.max]) next.push([...c, v]);
        combos = next;
      }
      for (const c of combos) {
        const vars = Object.fromEntries(lab.inputs.map((inp, k) => [inp.key, c[k]]));
        for (const out of lab.outputs) {
          evals += 1;
          const v = safeEval(out.expr, vars);
          if (v === null) nulls.push(`${lab.title} [${c.join(', ')}] ${out.expr}`);
        }
      }
    }
    // 2967 次求值，绝大多数都有值
    expect(evals).toBeGreaterThan(2900);
    // 角点上算不出来的只有三种物理上「本来就没定义」的情况：
    //   厚透镜 d = f1 = f2 时分母为 0；原子能级两条能量相等；量子隧穿 E > V0 时根号下为负
    // 这些返回 null 是**对的**（界面显示「—」+ 提示），不是数据错。
    expect(nulls.length).toBeLessThan(40);
    for (const n of nulls) {
      expect(n).toMatch(/厚透镜|原子能级|量子隧穿/);
    }
  });

  it('Math.log10 那条（声压级）确实算得出 60 dB', () => {
    const lab = LABS['K-A4-03'];
    expect(lab?.kind).toBe('formula');
    if (lab?.kind !== 'formula') return;
    const vars = Object.fromEntries(lab.inputs.map((i) => [i.key, i.default]));
    expect(safeEval(lab.outputs[0].expr, vars)).toBeCloseTo(60, 6);
  });

  it('Math.log(x)/Math.LN10 与 Math.log10(x) 等价，但后者更准', () => {
    const viaLog10 = safeEval('20 * Math.log10(p / 0.00002)', V({ p: 0.02 })) as number;
    const viaLn = safeEval('20 * Math.log(p / 0.00002) / Math.LN10', V({ p: 0.02 })) as number;
    expect(viaLog10).toBe(60);
    expect(viaLn).toBeCloseTo(60, 12);
    // 两者在浮点层面只差最后一位，默认仍走 log10（注释里有理由）
    expect(Math.abs(viaLog10 - viaLn)).toBeLessThan(1e-12);
    expect(Math.log10(1000)).toBe(3);
    expect(Math.log(1000) / Math.LN10).not.toBe(3); // 2.9999999999999996
  });
});
