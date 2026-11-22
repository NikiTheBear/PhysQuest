/**
 * 公式实验室的表达式求值器（白名单沙箱）
 *
 * 为什么不用 new Function / eval：
 *   formula-lab.json 里的 `expr` 是**数据**，不是我们写的代码。哪怕是自家生成的
 *   JSON，也可能被手改、被脚本污染、被下游流程替换。一旦把它交给 JS 引擎去编译，
 *   就等于把页面（以及页面里的 localStorage token）的控制权交出去。
 *
 * 所以这里是三层：
 *   ① 字符白名单 —— 只认数字、字母、下划线、+ - * / ( ) . , 和空白
 *   ② 关键字黑名单 —— window / document / fetch / import / require / eval / Function /
 *      constructor / prototype / this / globalThis …… 一律拒
 *   ③ Math 成员白名单 —— Math. 后面只允许 pow sqrt abs sin cos tan log log10 exp min max
 *      这几个方法，和 PI / E / LN10 / LN2 四个常量
 *   三层都过了，也不交给引擎：下面自己写了一个极小的递归下降求值器，
 *   只认「四则运算 + 括号 + 一元正负 + Math 函数调用」，其它任何东西都是语法错误。
 *
 * 求值结果：非有限数（NaN / ±Infinity）、除零、未知变量、任何语法错误 → 一律返回 null，
 * 让界面显示「—」，而不是把 Infinity 印在屏幕上。
 */

/** ① 字符白名单：注意里面没有 `^` `%` `[` `]` `{` `}` `;` `'` `"` `:` 等 */
const ALLOWED_CHARS = /^[0-9a-zA-Z_+\-*/().,\s]*$/;

/**
 * ② 关键字黑名单（大小写不敏感的子串检查）
 *
 * 注意：是**子串**匹配（`lower.includes(word)`），所以将来若出现 `newton`（力的单位）、
 * `interval`、`alerts`、`deletes` 这类变量名会被误伤成「—」。现在 193 个输入名 /
 * 97 条表达式都没踩到（safeEval.test.ts 里有断言盯着：新数据一旦撞上，那条测试直接红）。
 */
const BANNED_WORDS = [
  'window',
  'document',
  'fetch',
  'import',
  'require',
  'eval',
  'function',
  'constructor',
  'prototype',
  'this',
  'globalthis',
  'alert',
  'location',
  'cookie',
  'localstorage',
  'sessionstorage',
  'xmlhttprequest',
  'worker',
  'importscripts',
  'settimeout',
  'setinterval',
  'new',
  'delete',
  'typeof',
  'await',
  'debugger',
];

/**
 * ③ Math 常量白名单
 *
 * PI / E 是物理公式里真会写的两个；
 * LN10 / LN2 是给对数换算留的出口（见下面 MATH_FN 的审计注释）。
 * 常量只是数字，多开放一个值不会多一分执行能力，所以这张表可以比方法表宽松。
 */
const MATH_CONST: Record<string, number> = {
  PI: Math.PI,
  E: Math.E,
  LN10: Math.LN10,
  LN2: Math.LN2,
};

/**
 * ③ Math 方法白名单。
 *
 * ── 为什么会有 log10 ──
 * 最初拟的清单是「pow sqrt abs sin cos tan log exp min max」10 项，里面没有 log10。
 * 但 K-A4-03「声压级与分贝」的表达式就是 `20 * Math.log10(p / 0.00002)`，
 * 缺了它那一条会永远算不出来（界面显示「—」），所以补进来。补的是标准库函数，
 * 不引入任何新的执行能力，风险为零。
 *
 * ── 实际用量审计（97 条 formula 的 97 个 expr，本次改动时逐条核对）──
 *   出现过的成员只有 6 个：
 *     Math.PI     ×7  波的干涉 / 电流的磁效应 / 二极管 / 坡印廷 / 波函数
 *     Math.sqrt   ×5  卫星速度 ×2 / 麦克斯韦速率 ×2 / 量子隧穿
 *     Math.exp    ×5  粘滞流体 ×2 / 热传导 / 量子隧穿 / 费米-狄拉克
 *     Math.log    ×2  等值过程（等温做功）/ 熵的统计意义
 *     Math.pow    ×2  放射性（半衰期）n 与 frac
 *     Math.log10  ×1  声压级（就是当初为它加的那个）
 *   没用到但已在白名单：abs sin cos tan min max。留着是因为它们属于
 *   「四则 + 初等函数」这条线，将来补知识点（交流电要 sin、光学要 tan）用得上。
 *   结论：**没有漏项** —— 97 条里每一个 Math.* 都能被这张表覆盖（test 里有对
 *   全量数据的断言；一旦 JSON 里出现新成员，那条断言会直接失败，而不是界面上
 *   悄悄变成「—」）。
 *
 * ── 有没有等价但更安全的写法？──
 * 有：`Math.log(x) / Math.LN10` 和 `Math.log10(x)` 数学上完全等价。但原先
 * `Math.LN10` **不在**白名单里（MATH_CONST 只有 PI / E），所以那种写法以前会被
 * 第三道闸门直接拒掉——「更安全的写法」当时其实写不出来。现在 LN10 / LN2 补进
 * 常量表了，两种写法都能跑。
 *
 * 但**默认仍然用 Math.log10**，理由是精度：
 *   Math.log10(1000)         → 3
 *   Math.log(1000) / Math.LN10 → 2.9999999999999996
 * 后者会让声压级在 60 dB 上多加一小段尾巴。另外 Math.log10 是 ES2015 标准函数，
 * Node 12+ 和所有现代浏览器都有，没有兼容性理由绕开它。
 */
const MATH_FN: Record<string, (...args: number[]) => number> = {
  pow: (a, b) => Math.pow(a, b),
  sqrt: (a) => Math.sqrt(a),
  abs: (a) => Math.abs(a),
  sin: (a) => Math.sin(a),
  cos: (a) => Math.cos(a),
  tan: (a) => Math.tan(a),
  log: (a) => Math.log(a),
  log10: (a) => Math.log10(a),
  exp: (a) => Math.exp(a),
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
};

/**
 * 每个白名单函数接受几个参数（`-1` = 可变长）。
 *
 * 为什么需要这张表：不写的话 `Math.sqrt(4, 5)` 会被静默算成 2（sqrt 自己忽略
 * 多余参数），`Math.pow(2)` 算成 NaN（然后被 NaN 检查拦下，返回 null——结果
 * 是对的，但原因却是「算出来是 NaN」而不是「参数个数不对」）。现在多一个少一个
 * 都直接当语法错误抛，错在哪一眼就能看出来。
 */
const MATH_ARITY: Record<string, number> = {
  pow: 2,
  sqrt: 1,
  abs: 1,
  sin: 1,
  cos: 1,
  tan: 1,
  log: 1,
  log10: 1,
  exp: 1,
  min: -1,
  max: -1,
};

/** 白名单成员的名字集合（方法 + 常量），给 mathMembersAllowed 和测试用 */
const MATH_MEMBER_NAMES = new Set<string>([...Object.keys(MATH_FN), ...Object.keys(MATH_CONST)]);

/** 表达式长度 / token 数上限，挡掉「一万个括号」这类恶心输入 */
const MAX_LENGTH = 400;
const MAX_TOKENS = 240;

/** Math. 后面的成员必须在白名单里 */
function mathMembersAllowed(src: string): boolean {
  const refs = src.match(/Math\s*\.\s*[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  const raw = src.match(/Math/g) ?? [];
  // 有裸露的 Math（比如 `Maths`、`Math` 后面没有 .成员）就拒
  if (refs.length !== raw.length) return false;
  for (const ref of refs) {
    const member = ref.slice(ref.indexOf('.') + 1).trim();
    if (!MATH_MEMBER_NAMES.has(member)) return false;
  }
  return true;
}

/** 语法错误：内部用异常跳出递归，外面统一 catch 成 null */
class ExprError extends Error {}

type Tok =
  | { k: 'num'; v: number }
  | { k: 'name'; v: string }
  | { k: 'op'; v: '+' | '-' | '*' | '/' }
  | { k: 'lp' }
  | { k: 'rp' }
  | { k: 'comma' }
  | { k: 'dot' };

const NUM_RE = /^\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/;
const DOT_NUM_RE = /^\.\d+(?:[eE][+-]?\d+)?/;
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*/;

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i += 1;
      continue;
    }
    if (c >= '0' && c <= '9') {
      const m = NUM_RE.exec(src.slice(i));
      if (!m) throw new ExprError('bad number');
      const v = Number(m[0]);
      if (!Number.isFinite(v)) throw new ExprError('bad number');
      out.push({ k: 'num', v });
      i += m[0].length;
      continue;
    }
    if (c === '.') {
      const m = DOT_NUM_RE.exec(src.slice(i));
      if (m) {
        const v = Number(m[0]);
        if (!Number.isFinite(v)) throw new ExprError('bad number');
        out.push({ k: 'num', v });
        i += m[0].length;
        continue;
      }
      // `Math.PI` 里的点
      out.push({ k: 'dot' });
      i += 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = NAME_RE.exec(src.slice(i));
      if (!m) throw new ExprError('bad name');
      out.push({ k: 'name', v: m[0] });
      i += m[0].length;
      continue;
    }
    if (c === '+' || c === '-' || c === '*' || c === '/') {
      out.push({ k: 'op', v: c });
      i += 1;
      continue;
    }
    if (c === '(') {
      out.push({ k: 'lp' });
      i += 1;
      continue;
    }
    if (c === ')') {
      out.push({ k: 'rp' });
      i += 1;
      continue;
    }
    if (c === ',') {
      out.push({ k: 'comma' });
      i += 1;
      continue;
    }
    throw new ExprError(`unexpected char ${c}`);
  }
  return out;
}

/**
 * 递归下降：
 *   expr    := term (('+' | '-') term)*
 *   term    := unary (('*' | '/') unary)*
 *   unary   := ('+' | '-') unary | primary
 *   primary := number | name | '(' expr ')'
 *   name    := Math '.' member '(' args ')' | variable
 *
 * 没有 `^`：字符白名单里就没有它，需要幂就用 Math.pow（`Math.pow(2, -t / half)` 走得通）。
 */
class Parser {
  private i = 0;

  constructor(
    private readonly toks: Tok[],
    private readonly vars: Record<string, number>,
  ) {}

  parse(): number {
    const v = this.expr();
    if (this.i !== this.toks.length) throw new ExprError('trailing token');
    return v;
  }

  private peek(): Tok | undefined {
    return this.toks[this.i] as Tok | undefined;
  }

  private expr(): number {
    let left = this.term();
    for (;;) {
      const t = this.peek();
      if (t && t.k === 'op' && (t.v === '+' || t.v === '-')) {
        this.i += 1;
        const right = this.term();
        left = t.v === '+' ? left + right : left - right;
      } else {
        return left;
      }
    }
  }

  private term(): number {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (t && t.k === 'op' && (t.v === '*' || t.v === '/')) {
        this.i += 1;
        const right = this.unary();
        if (t.v === '*') {
          left *= right;
        } else {
          if (right === 0) throw new ExprError('divide by zero');
          left /= right;
        }
      } else {
        return left;
      }
    }
  }

  private unary(): number {
    const t = this.peek();
    if (t && t.k === 'op' && (t.v === '+' || t.v === '-')) {
      this.i += 1;
      const v = this.unary();
      return t.v === '-' ? -v : v;
    }
    return this.primary();
  }

  private primary(): number {
    const t = this.toks[this.i] as Tok | undefined;
    this.i += 1;
    if (!t) throw new ExprError('unexpected end');
    if (t.k === 'num') return t.v;
    if (t.k === 'lp') {
      const v = this.expr();
      const r = this.toks[this.i] as Tok | undefined;
      this.i += 1;
      if (!r || r.k !== 'rp') throw new ExprError('missing )');
      return v;
    }
    if (t.k === 'name') return this.name(t.v);
    throw new ExprError('unexpected token');
  }

  private args(): number[] {
    const lp = this.toks[this.i] as Tok | undefined;
    this.i += 1;
    if (!lp || lp.k !== 'lp') throw new ExprError('expected (');
    const out: number[] = [];
    if (this.peek()?.k === 'rp') {
      this.i += 1;
      return out;
    }
    for (;;) {
      out.push(this.expr());
      const t = this.toks[this.i] as Tok | undefined;
      this.i += 1;
      if (!t) throw new ExprError('unclosed call');
      if (t.k === 'comma') continue;
      if (t.k === 'rp') return out;
      throw new ExprError('bad call separator');
    }
  }

  private name(id: string): number {
    if (id === 'Math') {
      if (this.peek()?.k !== 'dot') throw new ExprError('Math without member');
      this.i += 1;
      const mem = this.toks[this.i] as Tok | undefined;
      this.i += 1;
      if (!mem || mem.k !== 'name') throw new ExprError('bad Math member');
      if (Object.prototype.hasOwnProperty.call(MATH_CONST, mem.v)) {
        return MATH_CONST[mem.v];
      }
      const fn = Object.prototype.hasOwnProperty.call(MATH_FN, mem.v) ? MATH_FN[mem.v] : undefined;
      if (!fn) throw new ExprError(`Math.${mem.v} not allowed`);
      const argv = this.args();
      const want = MATH_ARITY[mem.v] ?? -1;
      if (want >= 0 && argv.length !== want) {
        throw new ExprError(`Math.${mem.v} expects ${want} arg(s), got ${argv.length}`);
      }
      const out = fn(...argv);
      if (typeof out !== 'number' || Number.isNaN(out)) throw new ExprError('bad math result');
      return out;
    }

    const v = this.vars[id];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new ExprError(`unknown variable ${id}`);
    return v;
  }
}

/**
 * 安全求值。任何可疑输入、任何算不出来的结果 → null。
 *
 * @param expr 来自 formula-lab.json 的表达式字符串
 * @param vars 变量表（一般就是当前滑杆的值）
 */
export function safeEval(expr: string, vars: Record<string, number>): number | null {
  if (typeof expr !== 'string') return null;
  const src = expr.trim();
  if (src.length === 0 || src.length > MAX_LENGTH) return null;

  // ① 字符白名单
  if (!ALLOWED_CHARS.test(src)) return null;

  // ② 关键字黑名单
  const lower = src.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) return null;
  }

  // ③ Math 成员白名单
  if (!mathMembersAllowed(src)) return null;

  try {
    const toks = tokenize(src);
    if (toks.length === 0 || toks.length > MAX_TOKENS) return null;
    const value = new Parser(toks, vars ?? {}).parse();
    // 非有限数（NaN / ±Infinity）/ 溢出 → null
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export { MATH_MEMBER_NAMES, MATH_FN, MATH_CONST, MATH_ARITY, BANNED_WORDS, ALLOWED_CHARS };
