/**
 * 从 knowledge-prompts.json 生成全平台知识卡
 *
 * 队友的 140 条提示词里已经写清了每个知识点的：实验目标、搭建方案、
 * 可调变量、观测量、模型边界、理论公式。把这些整理成学生能读的卡片，
 * 再补上「打个比方」和「为什么」两个字段。
 *
 * 用法：node scripts/gen-knowledge-cards.mjs
 * 产出：shared/knowledge-data/knowledge-cards.json
 */
import { readFile, writeFile } from 'node:fs/promises';

const PROMPTS = JSON.parse(
  await readFile(new URL('../shared/knowledge-data/knowledge-prompts.json', import.meta.url), 'utf8'),
);
const MAP = JSON.parse(
  await readFile(new URL('../shared/knowledge-data/PLATFORM-MAP.json', import.meta.url), 'utf8'),
);

/* 手写的卡面文字：四个领域各一个文件 */
const DOMAIN_TEXT = {};
for (const dom of ['mechanics', 'electromagnetism', 'thermodynamics', 'modern', 'optics-university']) {
  try {
    const raw = await readFile(
      new URL(`../shared/knowledge-data/card-text/${dom}.json`, import.meta.url),
      'utf8',
    );
    Object.assign(DOMAIN_TEXT, JSON.parse(raw));
  } catch {
    console.warn(`  ⚠ 没找到 card-text/${dom}.json，这一领域用生成兜底`);
  }
}

/* 手写的生活类比：先覆盖光学（正在用的），其余按领域给通用句式 */
const ANALOGY = {
  'K-O1-01': '手电筒照墙，光是直着射过去的。你用手一挡，后面就黑了。',
  'K-O1-02': '树荫下那些圆形小光斑，其实是太阳的像，不是树叶的影子。',
  'K-O1-03': '往墙上扔球会弹回来，光的反射也是这个意思，只不过弹得规规矩矩。',
  'K-O1-04': '推着购物车斜着从地板冲进泥地，一边轮子先慢下来，车头就歪了。',
  'K-O1-05': '拿放大镜看手指，凑近了是正着的大手指，抬远一点忽然就倒过来了。',
  'K-O2-03': '正午把放大镜对准太阳，最亮的那个点就是焦点，它到镜片的距离就是焦距。',
  'K-O2-09': '拿放大镜看字，字变大，但你没法把它「投」到纸上去。',
  'K-O2-10': '实像像投影仪打在墙上的画，虚像像镜子里的你——伸手过去，那边什么也没有。',
  'K-O2-11': '像和物像翘翘板的两头：你把它那头压近焦点，这头就翘得又高又远。',
};

const DOMAIN_ANALOGY = {
  mechanics: '就像推一辆购物车：你用多大力、它有多重，决定了它跑多快。',
  electromagnetism: '就像水在管子里流：电压是水压，电流是流量，电阻是管子有多细。',
  optics: '就像把阳光聚在一张纸上，位置差一点就点不着。',
  thermodynamics: '就像一杯热水放在桌上，热量自己会往冷的那边走，回不来。',
  modern: '就像台阶：能量不够就迈不上去，够了就能一步跨过去。',
};

const DOMAIN_WHY = {
  mechanics: '牛顿第二定律 F = ma 说的就是这个：力一定时，质量越大加速度越小。',
  electromagnetism: '电荷在电场里受力，电流在磁场里受力，方向由右手定则决定。',
  optics: '光在不同介质里速度不同，进入新介质时方向会改变，这就是折射。',
  thermodynamics: '能量守恒，但可以用的部分会越来越少，这就是熵增。',
  modern: '微观世界的能量是一份一份的，不是连续的，所以有「门槛」这回事。',
};

const cards = [];
const promptById = new Map(PROMPTS.map((p) => [p.id, p]));

for (const disc of MAP.disciplines) {
  for (const band of disc.stages) {
    for (const item of band.items) {
      const p = promptById.get(item.id);
      // 没有手写类比时，用「可调变量」造一个具体的生活场景，避免和结论重复
      const fallbackAnalogy = p?.variables?.length
        ? `换一个「${p.variables[0]}」，结果就不一样——就像${p.variables.length > 1 ? `同时改变${p.variables.slice(0, 2).join('和')}` : '只调一个条件'}去试同一件事，感觉完全不同。`
        : DOMAIN_ANALOGY[disc.key];
      const hand = DOMAIN_TEXT[item.id];
      const analogy = hand?.analogy ?? ANALOGY[item.id] ?? fallbackAnalogy;

      const why = hand?.why ?? (p
        ? [
            p.construction ? `怎么研究：${p.construction}` : '',
            p.support === 'conceptual'
              ? '这一条目前只能做示意图，平台里还没有对应的数值求解器——所以它讲的是趋势和关系，不是精确数字。'
              : p.support === 'approximation'
                ? '这一条是近似/类比模型，结论在边界内成立，越过边界就不准了。'
                : '这一条有真实的数值求解器支撑，可以拖动参数直接看结果。',
            p.limitations ? `边界：${p.limitations}` : '',
          ]
            .filter(Boolean)
            .join('\n')
        : DOMAIN_WHY[disc.key]);

      cards.push({
        id: item.id,
        stage: band.stage,
        domain: disc.key,
        domainLabel: disc.label,
        title: item.title,
        oneLine: p?.objective ?? item.title,
        analogy,
        formula: p?.formula ?? '',
        why,
        variables: p?.variables ?? [],
        observations: p?.observations ?? [],
        support: p?.support ?? 'conceptual',
        misconceptions: [],
        prerequisites: [],
        difficulty: p?.support === 'conceptual' ? 'advanced' : 'beginner',
      });
    }
  }
}

/* 凸透镜那 26 张，用我们手写的高质量版本覆盖生成版 */
try {
  const optics = JSON.parse(
    await readFile(new URL('../shared/knowledge-data/optics-lens/knowledge.json', import.meta.url), 'utf8'),
  );
  const byId = new Map(cards.map((c) => [c.id, c]));
  for (const hand of optics.cards) {
    const base = byId.get(hand.id) ?? {};
    byId.set(hand.id, {
      ...base,
      ...hand,
      domain: 'optics',
      domainLabel: '光学',
      support: 'direct',
      variables: base.variables ?? [],
      observations: base.observations ?? [],
    });
  }
  cards.length = 0;
  cards.push(...byId.values());
} catch {
  /* 没有手写版就全用生成的 */
}

cards.sort((a, b) => a.id.localeCompare(b.id));

await writeFile(
  new URL('../shared/knowledge-data/knowledge-cards.json', import.meta.url),
  JSON.stringify({ version: 1, count: cards.length, cards }, null, 2) + '\n',
);

console.log(`生成 ${cards.length} 张知识卡 → shared/knowledge-data/knowledge-cards.json`);
