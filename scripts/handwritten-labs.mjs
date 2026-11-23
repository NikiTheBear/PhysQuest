/**
 * 手写实验（第 2 件任务的 b 小步）
 *
 * 为什么单独一个文件：`scripts/gen-challenges.mjs` 会把
 * `shared/knowledge-data/labs/*-challenges.json` 整份重写。
 * 手写内容放在这里，生成脚本每次都会连同自动生成的一起写出去，
 * 不会被下一次生成覆盖掉。
 *
 * 每一条都分成两类，判断标准是「求解器有没有真实读数会随变量变化」：
 *   tier: 'real'     真实验——改一个参数，读数是求解器算出来的
 *   tier: 'concept'  概念示意——器具位置只是布局，读数不参与结论
 * 这个概念区分会写进卡片和实验的 learning.limitations，不能含糊。
 */
export const HANDWRITTEN_LABS = [
  /* ============================================================
   * 力学
   * ========================================================== */
  {
    id: 'CH-K-M1-07',
    knowledgeId: 'K-M1-07',
    labId: 'mechanics',
    tier: 'real',
    difficulty: 'beginner',
    title: '同样推 2 N，滑块不动，滚轮滚走了',
    brief: '同一块地面上，给滑块和滚轮同样的水平推力，看谁动得起来。',
    hint: '滑动摩擦要「压着地硬拖」，滚动只是「滚过去」，阻力小得多。',
    prediction: {
      prompt: '同样 2 N 的水平推力，一块 1 kg 的滑块和一个 1 kg 的滚轮，谁会动起来？',
      options: ['滑块不动，滚轮会滚起来', '两个都动，一样快', '两个都不动'],
      answerIndex: 0,
    },
    observation:
      '两个推力都先设成 2 N：看左边的滑块有没有动，再看右边的滚轮——滚轮已经滚走了。把推力慢慢加大，一直到 12 N 左右，滑块才开始滑动。',
    learning: {
      variables: ['水平推力', '地面摩擦系数', '滚轮半径'],
      steps: ['滑块位移是否为零', '滚轮位移与角速度', '滚轮是否满足 v ≈ ωr'],
      limitations:
        '这是刚体滚动与库仑滑动摩擦的对比，没有轮轴轴承、滚动阻力和车架；不能据此给出真实车辆的省力比例。',
    },
    env: { gravity: 9.8, damping: 0, speed: 1, collisions: true },
    components: [
      { id: 'floor', kind: 'floor_slab', name: '地面 μ=0.6', pos: [0, -0.08, 0], params: { length: 20, width: 6, friction: 0.6, restitution: 0.1 } },
      { id: 'slider', kind: 'box', name: '滑块（1 kg）', pos: [-3, 0.25, 0], params: { mass: 1, width: 0.5, height: 0.5, depth: 0.5, friction: 0.6, restitution: 0.1 } },
      { id: 'wheel', kind: 'cylinder', name: '滚轮（1 kg，r=0.35 m）', pos: [0.5, 0.35, 0], params: { mass: 1, radius: 0.35, height: 0.6, friction: 0.8, restitution: 0.1 } },
      { id: 'push-slider', kind: 'force', name: '推力 2 N（作用在滑块）', pos: [-3, 0.25, 0], params: { fx: 2 }, refs: { target: 'slider' } },
      { id: 'push-wheel', kind: 'force', name: '推力 2 N（作用在滚轮）', pos: [0.5, 0.35, 0], params: { fx: 2 }, refs: { target: 'wheel' } },
      { id: 'sensor-slider', kind: 'motion_sensor', name: '运动传感器（滑块）', pos: [-3, 1.2, 0], refs: { target: 'slider' } },
      { id: 'sensor-wheel', kind: 'motion_sensor', name: '运动传感器（滚轮）', pos: [0.5, 1.2, 0], refs: { target: 'wheel' } },
    ],
    connections: [],
  },
  {
    id: 'CH-K-M2-03',
    knowledgeId: 'K-M2-03',
    labId: 'mechanics',
    tier: 'real',
    difficulty: 'beginner',
    title: '同一个力，推质心和推边上的区别',
    brief: '零重力下给同一个箱子施力：改大小、改方向、改作用点（等效力矩），看平动和转动怎么分开。',
    hint: '力有三件事要交代：多大、朝哪、按在哪。按偏了，物体就会转。',
    prediction: {
      prompt: '同样 2 N 的力，一次正对质心推，一次偏在边角上推，箱子会有什么不同？',
      options: ['正对质心只平动，偏心会同时转起来', '两次都只平动，转不起来', '两次都会转，转速一样'],
      answerIndex: 0,
    },
    observation:
      '先把 fx 设成 2、tz 设成 0：箱子只往 +X 平动。再把 fx 归零、只把 tz 调成 2：箱子原地转起来。最后改 fy：运动方向跟着转 90°。',
    learning: {
      variables: ['力的大小 fx、fy', '等效力矩 tz', '箱子质量'],
      steps: ['质心位移与速度', '角速度是否为零', '换方向后运动方向是否跟着变'],
      limitations:
        '力源没有真实的表面作用点，偏心施力是用「质心的力 + 等效力矩 τ = r×F」近似的，图上看不到手指按在哪。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'crate', kind: 'box', name: '箱子（2 kg）', pos: [0, 2, 0], params: { mass: 2, width: 0.8, height: 0.4, depth: 0.4 } },
      { id: 'push', kind: 'force', name: '施力（大小 / 方向 / 作用点）', pos: [0, 2, 0], params: { fx: 2, fy: 0, tz: 0 }, refs: { target: 'crate' } },
      { id: 'sensor', kind: 'motion_sensor', name: '运动传感器', pos: [1.5, 3.2, 0], refs: { target: 'crate' } },
    ],
    connections: [],
  },
  {
    id: 'CH-K-M2-05',
    knowledgeId: 'K-M2-05',
    labId: 'mechanics',
    tier: 'real',
    difficulty: 'beginner',
    title: '挂在测力计上的，才读得出「多重」',
    brief: '左边箱子放在地上「有东西托着」，右边小球挂在测力计上——读一读测力计，再对比。',
    hint: '静止不动并不等于不受力：地面托着箱子的力，和测力计拉着小球的力，是一回事。',
    prediction: {
      prompt: '1 kg 的小球挂在测力计下静止不动，测力计读数大约是多少？',
      options: ['约 9.8 N', '约 1 N', '0 N，因为球没动'],
      answerIndex: 0,
    },
    observation:
      '先看左边的箱子：放在地面上，位置一直不变（有支持力托着）。再看右边的小球：晃几下停住后读测力计，约等于 mg。把质量改成 2 kg，读数翻倍。',
    learning: {
      variables: ['小球质量', '重力加速度', '悬挂刚度与阻尼'],
      steps: ['箱子是否保持静止', '测力计稳定后的读数', '读数是否约等于 mg'],
      limitations:
        '平台不直接输出地面给箱子的支持力，只能看它静止不动；测力计读的是弹簧轴向拉力，不是接触支持力。',
    },
    env: { gravity: 9.8, damping: 0, speed: 1, collisions: true },
    components: [
      { id: 'floor', kind: 'floor_slab', name: '地面', pos: [0, -0.08, 0], params: { length: 14, width: 6, friction: 0.6, restitution: 0.1 } },
      { id: 'crate', kind: 'box', name: '箱子（2 kg，被地面托着）', pos: [-2.8, 0.25, 0], params: { mass: 2, width: 0.5, height: 0.5, depth: 0.5, friction: 0.6 } },
      { id: 'hook', kind: 'anchor', name: '固定支点', pos: [2, 5, 0], fixed: true },
      { id: 'ball', kind: 'body', name: '小球（1 kg）', pos: [2.0, 3.3, 0], params: { mass: 1, radius: 0.2 } },
      { id: 'scale', kind: 'dynamometer', name: '测力计 k=20 N/m', pos: [2, 4.1, 0], params: { stiffness: 20, restLength: 1.5, damping: 5 }, refs: { a: 'hook', b: 'ball' } },
      { id: 'sensor', kind: 'motion_sensor', name: '运动传感器（箱子）', pos: [-2.8, 1.2, 0], refs: { target: 'crate' } },
    ],
    connections: [],
  },
  {
    id: 'CH-K-M2-14',
    knowledgeId: 'K-M2-14',
    labId: 'mechanics',
    tier: 'concept',
    difficulty: 'intermediate',
    title: '抬上去的功，和花掉的功（概念示意）',
    brief: '斜面把重物抬高的「有用功」是固定的，但摩擦会吃掉一部分「总功」。',
    hint: '有用功看抬多高，总功看实际推了多远、使了多大力。',
    prediction: {
      prompt: '用斜面把同一个箱子抬到同样高度，斜面越粗糙，机械效率会怎样？',
      options: ['变低，因为摩擦吃掉更多功', '变高，因为更费劲', '不变，效率只由高度决定'],
      answerIndex: 0,
    },
    observation:
      '这一关是概念示意：器具只标出「抬升高度 h」和「沿坡距离 s」两个几何量。有用功 W有 = mg·h 与摩擦无关，总功 W总 = mg·h + 摩擦损失，效率 η = W有 / W总。请按标注的几何量自己算，不要期待画面里的读数。',
    learning: {
      variables: ['斜面倾角', '摩擦系数', '提升高度'],
      steps: ['几何高度 h 与坡长 s 的比值', '摩擦损失随 μ 的变化', '自行计算 η = W有 / W总'],
      limitations:
        '平台没有独立的机械效率表，也没有「手推斜面」的完整测量链路，这一条只做几何与公式示意，不运行仿真读数。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'ramp', kind: 'ramp', name: '斜面（标注 s 与 h）', pos: [0, 0, 0], params: { length: 5, width: 2, angle: 25, friction: 0.3 }, fixed: true },
      { id: 'load', kind: 'box', name: '重物（1 kg）', pos: [1.6, 1.2, 0], params: { mass: 1, width: 0.5, height: 0.4, depth: 0.5 }, fixed: true },
      { id: 'ruler', kind: 'distance_sensor', name: '测距仪（坡长 s）', pos: [0, 0.4, 0], refs: { a: 'ramp', b: 'load' } },
    ],
    connections: [],
  },
  /* ============================================================
   * 电磁
   * ========================================================== */
  {
    id: 'CH-K-E1-02',
    knowledgeId: 'K-E1-02',
    labId: 'circuits',
    tier: 'real',
    difficulty: 'beginner',
    title: '换成绝缘体，电流就没了',
    brief: '同一个电源，只换「待测材料」的电阻：小电阻像导体，大电阻像绝缘体。',
    hint: '电流 = 电压 ÷ 电阻。电阻大到离谱，电流就小到看不见。',
    prediction: {
      prompt: '同一个 6 V 电源，把待测材料从 2 Ω 换成 10⁷ Ω，电流会怎样？',
      options: ['掉到微安级，几乎为零', '减半', '不变，因为电压没变'],
      answerIndex: 0,
    },
    observation:
      '待测电阻先设 2 Ω（像导体），读电流表约 2.4 A；再把电阻调到 10⁷ Ω（像绝缘体），电流掉到微安级。',
    learning: {
      variables: ['待测材料电阻', '电源电压'],
      steps: ['支路电流', '待测元件两端电压', '电流随电阻变化的倍数'],
      limitations:
        '只有集中电阻模型，没有材料微观导电机制、温度变化和绝缘击穿；不能据此判断真实材料是导体还是绝缘体。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'cell', kind: 'battery', name: '低压电源 6 V', pos: [0, 0, 0], params: { voltage: 6, resistance: 0.5 } },
      { id: 'material', kind: 'resistor', name: '待测材料 R = 2 Ω（可调到 10⁷）', pos: [2.4, 0, 0], params: { resistance: 2 } },
      { id: 'meter', kind: 'ammeter', name: '电流表', pos: [4.8, 0, 0], params: {} },
      { id: 'ground', kind: 'ground', name: '参考地', pos: [0, 0, 2], params: {} },
    ],
    connections: [
      { id: 'w1', kind: 'wire', source: 'cell', sourcePort: 'a', target: 'material', targetPort: 'a' },
      { id: 'w2', kind: 'wire', source: 'material', sourcePort: 'b', target: 'meter', targetPort: 'a' },
      { id: 'w3', kind: 'wire', source: 'meter', sourcePort: 'b', target: 'cell', targetPort: 'b' },
      { id: 'w4', kind: 'wire', source: 'cell', sourcePort: 'b', target: 'ground', targetPort: 'a' },
    ],
  },
  {
    id: 'CH-K-E2-08',
    knowledgeId: 'K-E2-08',
    labId: 'circuits',
    tier: 'real',
    difficulty: 'beginner',
    title: '电压翻一倍，发热变成四倍',
    brief: '电阻不变，只调电源电压：电流翻倍，功率变成 4 倍。',
    hint: 'P = I²R。电流是平方项，翻一倍就是四倍。',
    prediction: {
      prompt: '电阻固定，把电源电压从 6 V 提高到 12 V，电阻的发热功率会变成原来的几倍？',
      options: ['4 倍', '2 倍', '不变'],
      answerIndex: 0,
    },
    observation:
      '电源先设 6 V：读电流 I 和电阻功率 P。再把电压调到 12 V：电流翻倍，功率变成四倍。Q = I²Rt 就是把这个功率乘上时间。',
    learning: {
      variables: ['电源电压', '电阻阻值'],
      steps: ['支路电流是否翻倍', '电阻功率是否变成四倍', '按相同时长估算 Q = Pt'],
      limitations:
        '没有热容、散热、温度或相变求解；只能由电功率估算转化出的能量，给不出升温曲线，也不能据此判断会不会烧坏。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'cell', kind: 'battery', name: '电源 6 V（可调到 12 V）', pos: [0, 0, 0], params: { voltage: 6, resistance: 0.1 } },
      { id: 'load', kind: 'resistor', name: '电阻 R = 100 Ω', pos: [2.4, 0, 0], params: { resistance: 100 } },
      { id: 'amp', kind: 'ammeter', name: '电流表', pos: [4.8, 0, 0], params: {} },
      { id: 'volt', kind: 'voltmeter', name: '电压表', pos: [2.4, 0, 1.8], params: {} },
      { id: 'ground', kind: 'ground', name: '参考地', pos: [0, 0, 2], params: {} },
    ],
    connections: [
      { id: 'w1', kind: 'wire', source: 'cell', sourcePort: 'a', target: 'load', targetPort: 'a' },
      { id: 'w2', kind: 'wire', source: 'load', sourcePort: 'b', target: 'amp', targetPort: 'a' },
      { id: 'w3', kind: 'wire', source: 'amp', sourcePort: 'b', target: 'cell', targetPort: 'b' },
      { id: 'w4', kind: 'wire', source: 'load', sourcePort: 'a', target: 'volt', targetPort: 'a' },
      { id: 'w5', kind: 'wire', source: 'load', sourcePort: 'b', target: 'volt', targetPort: 'b' },
      { id: 'w6', kind: 'wire', source: 'cell', sourcePort: 'b', target: 'ground', targetPort: 'a' },
    ],
  },
  {
    id: 'CH-K-E2-09',
    knowledgeId: 'K-E2-09',
    labId: 'circuits',
    tier: 'real',
    difficulty: 'beginner',
    title: '两盏灯，各管各的开关',
    brief: '两条并联支路，各带一个开关。关掉一路，另一路照常亮。',
    hint: '并联各支路电压相同、电流各自独立；串联才会互相牵连。',
    prediction: {
      prompt: '两条并联的灯，把其中一路的开关断开，另一路的电流会怎样？',
      options: ['不变，各支路互不影响', '变成原来的一半', '完全熄灭'],
      answerIndex: 0,
    },
    observation:
      '两路都闭合：读总电流。只断开 B 路开关：灯 A 的电流不变，总电流差不多掉一半。再只闭合 B 路：换成灯 B 单独亮。',
    learning: {
      variables: ['两个开关状态', '两盏灯的电阻'],
      steps: ['各支路电流是否独立', '总电流随支路增减的变化', '两灯亮度（功率）对比'],
      limitations:
        '低压直流类比，不是市电接线；没有火线零线、保护地、漏电保护和断路器，也不能用来做真实家庭布线参考。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'cell', kind: 'battery', name: '低压电源 6 V', pos: [0, 0, 0], params: { voltage: 6, resistance: 0.5 } },
      { id: 'sw-a', kind: 'switch', name: '开关 A', pos: [1.6, 0, -1.2], params: { closed: 1 } },
      { id: 'lamp-a', kind: 'lamp', name: '灯 A（60 Ω）', pos: [3.6, 0, -1.2], params: { resistance: 60, ratedPower: 2.4 } },
      { id: 'sw-b', kind: 'switch', name: '开关 B', pos: [1.6, 0, 1.2], params: { closed: 1 } },
      { id: 'lamp-b', kind: 'lamp', name: '灯 B（60 Ω）', pos: [3.6, 0, 1.2], params: { resistance: 60, ratedPower: 2.4 } },
      { id: 'ground', kind: 'ground', name: '参考地', pos: [0, 0, 3], params: {} },
    ],
    connections: [
      { id: 'wa1', kind: 'wire', source: 'cell', sourcePort: 'a', target: 'sw-a', targetPort: 'a' },
      { id: 'wa2', kind: 'wire', source: 'sw-a', sourcePort: 'b', target: 'lamp-a', targetPort: 'a' },
      { id: 'wa3', kind: 'wire', source: 'lamp-a', sourcePort: 'b', target: 'cell', targetPort: 'b' },
      { id: 'wb1', kind: 'wire', source: 'cell', sourcePort: 'a', target: 'sw-b', targetPort: 'a' },
      { id: 'wb2', kind: 'wire', source: 'sw-b', sourcePort: 'b', target: 'lamp-b', targetPort: 'a' },
      { id: 'wb3', kind: 'wire', source: 'lamp-b', sourcePort: 'b', target: 'cell', targetPort: 'b' },
      { id: 'wg', kind: 'wire', source: 'cell', sourcePort: 'b', target: 'ground', targetPort: 'a' },
    ],
  },
  {
    id: 'CH-K-E3-02',
    knowledgeId: 'K-E3-02',
    labId: 'circuits',
    tier: 'real',
    difficulty: 'intermediate',
    title: '电场里，走多远差多少伏',
    brief: '匀强电场里量出两点间距，自己算出电势差。',
    hint: '匀强电场里 U = E·d。走的方向和电场同向，电势才降低。',
    prediction: {
      prompt: '匀强电场 E = 1000 V/m，沿电场方向相距 1 m 的两点，电势差是多少？',
      options: ['1000 V', '1 V', '1000 J'],
      answerIndex: 0,
    },
    observation:
      '探针读到的是场强 E（这是求解器算的）；A、B 两点相距 d 由测距仪给出。电势差 U = E·d 要自己算：E=1000 V/m、d=1 m 就是 1000 V。把场强改成 2000，U 跟着翻倍。',
    learning: {
      variables: ['电场场强与方向', 'A、B 两点的轴向间距'],
      steps: ['探针读到的场强', '测距仪给出的距离', '自行计算 U = E·d'],
      limitations:
        '求解器只给场强，不给电势或等势面；电压表不能跨接空间两点。U 是由公式算出来的，不是读数。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'field', kind: 'electric_field', name: '匀强电场 E = 1000 V/m（+X）', pos: [0, 0, 0], params: { strength: 1000, radius: 3, axis: 0 } },
      { id: 'point-a', kind: 'anchor', name: 'A 点', pos: [-0.5, 0, 0], fixed: true },
      { id: 'point-b', kind: 'anchor', name: 'B 点', pos: [0.5, 0, 0], fixed: true },
      { id: 'probe', kind: 'probe', name: '场强探针', pos: [0, 0.6, 0], fixed: true },
      { id: 'ruler', kind: 'distance_sensor', name: '测距仪（A–B）', pos: [0, -0.8, 0], refs: { a: 'point-a', b: 'point-b' } },
    ],
    connections: [],
  },
  {
    id: 'CH-K-E3-08',
    knowledgeId: 'K-E3-08',
    labId: 'circuits',
    tier: 'real',
    difficulty: 'intermediate',
    title: '电流在磁场里被推开',
    brief: '线圈通电放在磁场里，会被安培力推开；换电流方向或磁场方向，位移跟着反过来。',
    hint: 'F = BIL。电流、磁场、受力三者互相垂直，方向用左手定则。',
    prediction: {
      prompt: '通电线圈在磁场里被推开后，把电源正负极对调，线圈会怎样？',
      options: ['往反方向偏，位移大小差不多', '不动了', '偏得更远'],
      answerIndex: 0,
    },
    observation:
      '线圈位移会停在一个平衡位置。把电源电压改成负值（电流反向），位移换到另一边；把磁场强度改成负值（B 反向），位移也换到另一边。把导线长度从 2 m 加到 4 m，位移翻倍。',
    learning: {
      variables: ['电流大小与方向', '磁感应强度 Bz', '有效导线长度', '悬挂刚度'],
      steps: ['线圈平衡位移', '位移对应的弹力 kx', '改变方向后位移是否反向'],
      limitations:
        '有效导线固定沿 Y、运动限 X，只取 Bz 分量；没有任意方向导线、旋转线圈和反电动势回馈。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'cell', kind: 'battery', name: '电源 6 V', pos: [-3, 0, 0], params: { voltage: 6, resistance: 0.5 } },
      { id: 'limit', kind: 'resistor', name: '限流电阻 5 Ω', pos: [-1, 0, 0], params: { resistance: 5 } },
      { id: 'coil', kind: 'coil', name: '线圈（导线长 2 m）', pos: [1.5, 1, 0], params: { mass: 0.2, stiffness: 20, damping: 1, length: 2, displacement: 0 }, fixed: true },
      { id: 'b-field', kind: 'field', name: '磁场 B = 2 T（+Z）', pos: [1.5, 0, 0], params: { strength: 2, radius: 8, axis: 2 } },
      { id: 'ground', kind: 'ground', name: '参考地', pos: [-3, 0, 2], params: {} },
    ],
    connections: [
      { id: 'w1', kind: 'wire', source: 'cell', sourcePort: 'a', target: 'limit', targetPort: 'a' },
      { id: 'w2', kind: 'wire', source: 'limit', sourcePort: 'b', target: 'cell', targetPort: 'b' },
      { id: 'w3', kind: 'wire', source: 'cell', sourcePort: 'b', target: 'ground', targetPort: 'a' },
      { id: 'drive', kind: 'electrical', source: 'limit', target: 'coil', gain: 1 },
    ],
  },
  /* ============================================================
   * 光学
   * ========================================================== */
  {
    id: 'CH-K-O1-02',
    knowledgeId: 'K-O1-02',
    labId: 'optics-lens',
    tier: 'real',
    difficulty: 'beginner',
    title: '孔越小，像越清楚；孔越大，像越亮',
    brief: '一个物点穿过小孔投到屏上是一个斑。改孔径和孔屏距，看像高、模糊斑和亮度怎么换着来。',
    hint: '像高按相似三角形算，模糊斑只由孔径和两段距离决定——它们不是一回事。',
    prediction: {
      prompt: '把针孔从很小改大一点，屏上的像会怎样？',
      options: ['变亮，也变模糊', '变大，并且更清楚', '完全不变，孔只影响亮度'],
      answerIndex: 0,
    },
    observation:
      '装置里物高 0.2 m、物距 0.6 m、孔屏距 0.4 m。先把孔径设成 2 mm：读像高 0.133 m、模糊斑 3.3 mm、清晰度 0.975。把孔径改成 20 mm：像高一点没变，但模糊斑涨到 33 mm、清晰度掉到 0.75、亮度涨 100 倍。再把物距从 0.6 m 调到 1.2 m：像高缩到 0.067 m（正好一半）。',
    learning: {
      variables: ['孔径', '物距', '孔到屏的距离'],
      steps: ['像高（倒像，按相似三角形）', '模糊斑直径与清晰度', '相对亮度'],
      limitations:
        '每个物点只投一个斑，所以不会真的看到「倒立的图像」——平台算的是尺寸与清晰度的定量关系，不是成像画面。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'pin', kind: 'pinhole_screen', name: '针孔成像装置（孔 2 mm）', pos: [0, 1, 0], params: { objectHeight: 0.2, objectDistance: 0.6, holeDistance: 0.4, holeDiameter: 0.002 } },
    ],
    connections: [],
  },
  {
    id: 'CH-K-O1-04',
    knowledgeId: 'K-O1-04',
    labId: 'optics-lens',
    tier: 'real',
    difficulty: 'beginner',
    title: '偏着走的光，被透镜掰到轴上',
    brief: '一束离轴 0.3 m 的平行光，本来打不到轴上那个小探测器。放上凸透镜就收拢过去了。',
    hint: '透镜让光拐弯（折射），凹透镜则让它散开——这两句要靠探测器读数分出来。',
    prediction: {
      prompt: '一束平行于光轴、但离轴 0.3 m 的光，经过焦距 1.5 m 的凸透镜后会在哪里会聚？',
      options: ['会聚到焦点，也就是光轴上', '还是平行走，一直在 0.3 m 处', '越走越远，更打不到轴'],
      answerIndex: 0,
    },
    observation:
      '探测器放在凸透镜的焦点 (1.5 m, 0)。不放透镜时探测器读 0：光沿离轴 0.3 m 直线走，根本碰不到它。装上 f = 1.5 m 的凸透镜，探测器读到 1.0 mW——光被收拢到轴上。换成凹透镜（f = −1.5 m），又回到 0。把焦距改成 0.8 m，光在 x = 0.8 就过焦点然后散开，到 1.5 m 处也打不到，读 0。',
    learning: {
      variables: ['有没有透镜', '透镜类型（凸 / 凹）', '焦距'],
      steps: ['焦点处探测器功率', '光被收拢还是发散', '焦距变了会聚点往哪移'],
      limitations:
        '平台用薄透镜偏折公式代表折射，没有真实的水–空气界面与折射率参数；折射定律本身要靠「折射界面」那条去验。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'beam', kind: 'laser', name: '平行光（离轴 0.3 m）', pos: [-4, 0.3, 0], params: { angle: 0, power: 1, wavelength: 532, width: 0.05 } },
      { id: 'lens', kind: 'lens', name: '凸透镜 f = 1.5 m', pos: [0, 0, 0], params: { focal: 1.5, radius: 0.7, angle: 0 } },
      { id: 'spot', kind: 'detector', name: '小探测器（放在焦点）', pos: [1.5, 0, 0], params: { radius: 0.12, angle: 0 } },
    ],
    connections: [],
  },
  {
    id: 'CH-K-O2-01',
    knowledgeId: 'K-O2-01',
    labId: 'optics-lens',
    tier: 'real',
    difficulty: 'intermediate',
    title: '斜着进水，光就拐弯了',
    brief: '一束 30° 斜射的光穿过空气–玻璃界面，出射方向变了。改折射率，看它拐得多狠。',
    hint: 'n₁sinθ₁ = n₂sinθ₂。n₂ 越大，光越往法线靠，出射光线就越「压」下去。',
    prediction: {
      prompt: '光从空气斜射进玻璃（折射率比空气大），出射光线会往哪边偏？',
      options: ['向法线靠拢，折射角小于入射角', '远离法线，折射角更大', '不偏，方向不变'],
      answerIndex: 0,
    },
    observation:
      '光源以 30° 斜射，界面法线水平，探测器放在「n₂ = 1.5 时的出射路径」上（x = 1.5 m, y = 1.69 m）。n₂ = 1.5（玻璃）时探测器读 1.0 mW；把 n₂ 改成 1（相当于没有界面），光不拐弯、直接越过探测器，读 0；把 n₂ 提到 2（更密），光拐得更狠，出射偏低，探测器只截到一部分，读约 0.6 mW。',
    learning: {
      variables: ['折射侧折射率 n₂', '入射角'],
      steps: ['探测器功率（看出射方向偏到哪）', 'n₂ 变大时偏折是否变大'],
      limitations:
        '探测器只能间接反映偏折方向，平台没有直接显示角度的读数；全反射只在光密到光疏时才可能出现。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'beam', kind: 'laser', name: '激光（与法线成 30°）', pos: [-2, 0, 0], params: { angle: 30, power: 1, wavelength: 532, width: 0.02 } },
      { id: 'glass', kind: 'refract_plane', name: '空气→玻璃界面 n₂ = 1.5', pos: [0, 0, 0], params: { angle: 0, radius: 1.5, n1: 1, n2: 1.5 } },
      { id: 'spot', kind: 'detector', name: '探测器（x=1.5, y=1.69）', pos: [1.5, 1.685, 0], params: { radius: 0.15, angle: 0 } },
    ],
    connections: [],
  },
  {
    id: 'CH-K-O2-12',
    knowledgeId: 'K-O2-12',
    labId: 'optics-lens',
    tier: 'real',
    difficulty: 'beginner',
    title: '遮住透镜一半，像不动，只是变暗',
    brief: '像的位置和大小由物距、焦距决定，跟透镜通光面积无关——遮一半只改亮度。',
    hint: '如果像会被挡板「挡住一半」，说明你以为像在透镜表面；其实它在光屏那一侧。',
    prediction: {
      prompt: '遮住凸透镜的上半部分，光屏上像的位置和大小会怎样？',
      options: ['位置和大小都不变，只是变暗', '整个像往上移', '只剩上半部分'],
      answerIndex: 0,
    },
    observation:
      '光具座 u = 30 cm、f = 10 cm、光屏 15 cm，像距 v = 15 cm、放大率 −0.5。打开「遮住上半部」：像距仍是 15 cm、放大率仍是 −0.5，只有相对照度从 1.0 掉到 0.5。这说明像的位置只由几何决定——真实实验里三心不同高时，像才会整体偏出光屏。',
    learning: {
      variables: ['是否遮挡', '光屏位置', '物距'],
      steps: ['像距 v 是否变化', '放大率是否变化', '相对照度是否下降'],
      limitations:
        '光具座默认三心同高，没有偏心参数，做不出「像整体偏出光屏」；这一关是用遮挡间接说明位置由几何决定。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'bench', kind: 'lens_bench', name: '凸透镜光具座（三心同高）', pos: [0, 1, 0], params: { u: 30, f: 10, h: 2.5, screenX: 15, lensDiameter: 6, maskTop: 0, objectShape: 0 }, fixed: true },
    ],
    connections: [],
  },
  {
    id: 'CH-K-O2-14',
    knowledgeId: 'K-O2-14',
    labId: 'optics-lens',
    tier: 'real',
    difficulty: 'intermediate',
    title: '眼轴太长就是近视，配副眼镜试试',
    brief: '眼球模型把晶状体和视网膜都摆好了，直接读「焦点偏差」和「看没看清」，再改眼镜度数。',
    hint: '近视是像会聚在视网膜前面（眼轴太长），凹透镜先让光散一点，把焦点推后。',
    prediction: {
      prompt: '一个眼轴偏长的人看远处，视网膜上的像是怎样的？',
      options: ['会聚在视网膜前面，落上去是模糊斑', '落在视网膜后面', '正好落在视网膜上'],
      answerIndex: 0,
    },
    observation:
      '正常眼（等效焦距 20 mm、眼轴 20.83 mm）读：焦点偏差 0.00 mm、看清 = 1。把眼轴改成 24 mm（近视）：焦点偏差 −3.17 mm（会聚在视网膜前）、看清 = 0、视网膜模糊斑 0.23 mm。把眼镜度数设成 −6.33 D：看清 = 1、模糊斑归零。再看看远视：眼轴 18 mm 时焦点偏差 +2.83 mm、看清 = 0，配 +7.55 D 才看得清。',
    learning: {
      variables: ['眼轴长度（等效）', '晶状体焦距', '眼镜度数', '物距'],
      steps: ['焦点偏差（正 = 落在视网膜后）', '是否看得清', '视网膜模糊斑大小'],
      limitations:
        '这是等效薄透镜 + 固定视网膜的模型，没有晶状体调节、房水和像差；度数换算按等效焦距算，不等于临床验光。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'eye', kind: 'eye_model', name: '眼球（焦距 20 mm，眼轴 20.83 mm）', pos: [0, 1, 0], params: { focal: 0.02, axialLength: 0.02083, objectDistance: 0.5, correction: 0 } },
    ],
    connections: [],
  },
  /* ============================================================
   * 概念示意（器具只做标注布局，读数不参与结论）
   * ========================================================== */
  {
    id: 'CH-K-M1-04',
    knowledgeId: 'K-M1-04',
    labId: 'mechanics',
    tier: 'concept',
    difficulty: 'beginner',
    title: '沉和浮（概念示意）',
    brief: '没有浮力求解器，这一条只标出三个球相对液面的位置和它们的密度关系。',
    hint: '比液体密就沉，比液体稀就浮，一样就悬在中间。',
    prediction: {
      prompt: '一个物体放进水里会浮起来，说明它的密度和水相比怎样？',
      options: ['比水小', '比水大', '一定和水一样'],
      answerIndex: 0,
    },
    observation:
      '这是概念示意：没有水、没有浸没体积、也没有浮力计算。图上三个球分别标着「下沉 / 悬浮 / 上浮」，液面由那根横条表示。请按标注的密度关系判断，不要期待读数变化。',
    learning: {
      variables: ['（示意）物体密度', '（示意）液体密度'],
      steps: ['三个球相对液面的位置', '密度大小与沉浮的对应关系'],
      limitations:
        '平台没有液体、浸没体积或浮力求解；器具位置只是概念布局，不是沉浮计算结果。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'surface', kind: 'box', name: '液面（示意）', pos: [0, 0, 0], params: { mass: 1, width: 5, height: 0.1, depth: 2 }, fixed: true },
      { id: 'sink', kind: 'body', name: '球 A：密度大 → 下沉', pos: [-2, -0.9, 0], params: { mass: 2, radius: 0.35 }, fixed: true },
      { id: 'float', kind: 'body', name: '球 B：密度小 → 上浮', pos: [0, 0.9, 0], params: { mass: 0.3, radius: 0.35 }, fixed: true },
      { id: 'hover', kind: 'body', name: '球 C：密度相等 → 悬浮', pos: [2, 0, 0], params: { mass: 1, radius: 0.35 }, fixed: true },
    ],
    connections: [],
  },
  {
    id: 'CH-K-M1-05',
    knowledgeId: 'K-M1-05',
    labId: 'mechanics',
    tier: 'concept',
    difficulty: 'beginner',
    title: '杠杆：支点、动力臂、阻力臂（概念示意）',
    brief: '标出支点和两侧施力点，用测距仪量出两段力臂。',
    hint: '力臂是从支点到力的作用线的垂直距离，不是到施力点的距离。',
    prediction: {
      prompt: '同一根杠杆，把施力点从靠近支点挪到远离支点，同样的力能撬起的东西会怎样？',
      options: ['变重，因为力臂变长了', '变轻', '不变'],
      answerIndex: 0,
    },
    observation:
      '这是概念示意：杆和支点都是固定的，不会真的翘起来。两支测距仪给出的是「支点到作用点」的直线距离，是真实测量值；注意它只有在力垂直于杆时正好等于力臂。「能不能平衡」要用 F₁l₁ = F₂l₂ 自己算。',
    learning: {
      variables: ['（示意）支点与施力点位置', '（示意）两侧力的大小'],
      steps: ['左右力臂的实际长度', '按 F₁l₁ = F₂l₂ 推算另一侧需要的力'],
      limitations:
        '平台没有偏置铰链和端点受力模型；测距仪给的是两点间距离，只有力垂直于杆时才等于力臂。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'bar', kind: 'box', name: '杠杆（示意，固定）', pos: [0, 1, 0], params: { mass: 1, width: 5, height: 0.15, depth: 0.4 }, fixed: true },
      { id: 'fulcrum', kind: 'anchor', name: '支点', pos: [0, 0.7, 0], fixed: true },
      { id: 'left', kind: 'body', name: '阻力作用点', pos: [-2, 1.2, 0], params: { mass: 1, radius: 0.16 }, fixed: true },
      { id: 'right', kind: 'body', name: '动力作用点', pos: [1, 1.2, 0], params: { mass: 1, radius: 0.16 }, fixed: true },
      { id: 'arm-l', kind: 'distance_sensor', name: '测距仪（支点到阻力作用点）', pos: [0, 1.9, 0], refs: { a: 'fulcrum', b: 'left' } },
      { id: 'arm-r', kind: 'distance_sensor', name: '测距仪（支点到动力作用点）', pos: [0, 1.6, 0], refs: { a: 'fulcrum', b: 'right' } },
    ],
    connections: [],
  },
  {
    id: 'CH-K-M2-02',
    knowledgeId: 'K-M2-02',
    labId: 'mechanics',
    tier: 'concept',
    difficulty: 'beginner',
    title: '质量和密度不是一回事（概念示意）',
    brief: '同样大小、不同质量；同样质量、不同大小——密度要算，不是看。',
    hint: '密度 = 质量 ÷ 体积。质量是「有多少东西」，密度是「东西挤得多紧」。',
    prediction: {
      prompt: '两个体积相同的小球，一个 1 kg、一个 3 kg，哪个密度大？',
      options: ['3 kg 的那个', '1 kg 的那个', '一样，因为体积相同'],
      answerIndex: 0,
    },
    observation:
      '这是概念示意：平台没有天平、没有排水法测体积。两个长方体标着质量和尺寸，密度 = m ÷ (宽×高×深) 要自己算。同体积比质量、同质量比体积，就能说清「密度」和「质量」的区别。',
    learning: {
      variables: ['（标注）质量', '（标注）宽高深'],
      steps: ['按尺寸算出体积', '按 m/V 算出密度', '比较两组哪个密度更大'],
      limitations:
        '质量和尺寸是独立输入，没有材料、天平或排水测量模型；密度来自公式计算，不是求解器读数。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'a', kind: 'box', name: 'A：1 kg，0.5×0.5×0.5 m', pos: [-1.5, 1, 0], params: { mass: 1, width: 0.5, height: 0.5, depth: 0.5 }, fixed: true },
      { id: 'b', kind: 'box', name: 'B：3 kg，同体积', pos: [0, 1, 0], params: { mass: 3, width: 0.5, height: 0.5, depth: 0.5 }, fixed: true },
      { id: 'c', kind: 'box', name: 'C：1 kg，0.25×0.25×0.25 m', pos: [1.6, 1, 0], params: { mass: 1, width: 0.25, height: 0.25, depth: 0.25 }, fixed: true },
    ],
    connections: [],
  },
  {
    id: 'CH-K-M2-06',
    knowledgeId: 'K-M2-06',
    labId: 'mechanics',
    tier: 'concept',
    difficulty: 'beginner',
    title: '同样的重量，底面积小就压得狠（概念示意）',
    brief: '同样质量、不同底面积，平均压强 p = F/S 要自己算。',
    hint: '压力一样时，接触面积越小，压强越大。',
    prediction: {
      prompt: '同样的重量，把接触面积减少到原来的一半，压强会怎样？',
      options: ['变成两倍', '变成一半', '不变'],
      answerIndex: 0,
    },
    observation:
      '这是概念示意：平台没有接触应力分布求解，读数不代表压强。两块砖标着相同的质量和不同的底面积，p = mg ÷ (宽×深) 要自己算，然后比较哪个压得狠。',
    learning: {
      variables: ['（标注）质量', '（标注）底面宽与深'],
      steps: ['按 mg 算压力', '按底面积算平均压强', '比较两组压强倍数'],
      limitations:
        '没有接触应力或压强分布求解；结果是均匀受压假设下的公式计算，不是仿真读数。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'wide', kind: 'box', name: 'A：1 kg，底面 1.0×1.0 m', pos: [-1.6, 1, 0], params: { mass: 1, width: 1, height: 0.4, depth: 1 }, fixed: true },
      { id: 'narrow', kind: 'box', name: 'B：1 kg，底面 0.5×0.5 m', pos: [1.6, 1, 0], params: { mass: 1, width: 0.5, height: 0.4, depth: 0.5 }, fixed: true },
    ],
    connections: [],
  },
  {
    id: 'CH-K-M2-13',
    knowledgeId: 'K-M2-13',
    labId: 'mechanics',
    tier: 'concept',
    difficulty: 'intermediate',
    title: '杠杆平衡条件（概念示意）',
    brief: '两段力臂实测出来，另一侧要配多重，用 F₁l₁ = F₂l₂ 自己算。',
    hint: '平衡不是「两边一样重」，是「力矩一样大」。',
    prediction: {
      prompt: '左边挂在离支点 2 m 处、重 10 N；右边挂在离支点 1 m 处，要平衡需挂多重？',
      options: ['20 N', '5 N', '10 N'],
      answerIndex: 0,
    },
    observation:
      '这是概念示意：杆固定不动，不会真的平衡。两支测距仪给出支点到两侧作用点的直线距离（真实的测量值，力垂直于杆时才等于力臂）。把已知一侧的力乘上它的力臂、再除以另一侧力臂，就是另一边需要的力。',
    learning: {
      variables: ['（示意）左右力臂', '（已知）一侧的力'],
      steps: ['读出两段力臂', '算左侧力矩', '反推右侧需要的力'],
      limitations:
        '没有偏置铰链和端点施力模型，不运行假杠杆平衡；杆自身重量未忽略时还要另计重力矩。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'bar', kind: 'box', name: '杠杆（示意，固定）', pos: [0, 1, 0], params: { mass: 1, width: 5, height: 0.15, depth: 0.4 }, fixed: true },
      { id: 'fulcrum', kind: 'anchor', name: '支点', pos: [0, 0.7, 0], fixed: true },
      { id: 'load', kind: 'body', name: '左：10 N（距支点 2.5 m）', pos: [-2.5, 1.2, 0], params: { mass: 1, radius: 0.16 }, fixed: true },
      { id: 'effort', kind: 'body', name: '右：待配重（距支点 1.25 m）', pos: [1.25, 1.2, 0], params: { mass: 1, radius: 0.16 }, fixed: true },
      { id: 'arm-l', kind: 'distance_sensor', name: '测距仪（支点到左侧作用点）', pos: [0, 2, 0], refs: { a: 'fulcrum', b: 'load' } },
      { id: 'arm-r', kind: 'distance_sensor', name: '测距仪（支点到右侧作用点）', pos: [0, 1.7, 0], refs: { a: 'fulcrum', b: 'effort' } },
    ],
    connections: [],
  },
  {
    id: 'CH-K-M3-09',
    knowledgeId: 'K-M3-09',
    labId: 'mechanics',
    tier: 'concept',
    difficulty: 'intermediate',
    title: '卫星速度（概念示意）',
    brief: '平台没有万有引力，这一条只标出轨道半径，两种速度要用公式算。',
    hint: '圆轨道速度 v = √(GM/r)，逃逸速度是它的 √2 倍。',
    prediction: {
      prompt: '轨道半径越大，绕地球做圆轨道需要的速度会怎样？',
      options: ['越小', '越大', '不变'],
      answerIndex: 0,
    },
    observation:
      '这是概念示意：所有球都是固定的，不会真的绕转。中心球代表地球，两个小球标出不同轨道半径，测距仪给出实际距离。把 GM 和这个半径代进 v = √(GM/r) 自己算——注意逃逸速度总是圆轨道速度的 √2 倍。',
    learning: {
      variables: ['（理论）GM', '（实测）轨道半径'],
      steps: ['测距仪给出的半径', '自行计算 v = √(GM/r)', '比较两个半径对应的速度'],
      limitations:
        '没有中心引力、轨道积分或天体尺度单位；所有球都是固定示意，不宣称模拟卫星运动。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'earth', kind: 'body', name: '中心天体（示意）', pos: [0, 0, 0], params: { mass: 10, radius: 0.9 }, fixed: true },
      { id: 'low', kind: 'body', name: '低轨道卫星（示意）', pos: [2.5, 0, 0], params: { mass: 0.2, radius: 0.2 }, fixed: true },
      { id: 'high', kind: 'body', name: '高轨道卫星（示意）', pos: [4.5, 0, 0], params: { mass: 0.2, radius: 0.2 }, fixed: true },
      { id: 'r1', kind: 'distance_sensor', name: '测距仪（低轨道半径）', pos: [0, 1.4, 0], refs: { a: 'earth', b: 'low' } },
      { id: 'r2', kind: 'distance_sensor', name: '测距仪（高轨道半径）', pos: [0, -1.4, 0], refs: { a: 'earth', b: 'high' } },
    ],
    connections: [],
  },
  {
    id: 'CH-K-E2-10',
    knowledgeId: 'K-E2-10',
    labId: 'circuits',
    tier: 'concept',
    difficulty: 'beginner',
    title: '安全用电：断开点在哪（概念示意）',
    brief: '真实电路，加一个标着「保护装置」的位置——它其实没有实现。',
    hint: '修电路先断电，保护装置要装在能切断电源的位置。',
    prediction: {
      prompt: '要检修一个用电器，正确做法是先做什么？',
      options: ['先断开电源开关，再动手', '先拆线，再断电', '带电操作更快'],
      answerIndex: 0,
    },
    observation:
      '电源、开关、灯是真的连成回路的：断开开关，灯就没电流了，这一步是真读数。但那个标着「保护装置」的方块只是概念标记，平台没有漏电保护和断路器。',
    learning: {
      variables: ['开关状态', '（示意）断开点位置'],
      steps: ['断开后灯的电流是否为零', '保护装置在回路中的概念位置'],
      limitations:
        '没有人体阻抗、漏电保护和触电生理模型；不提供安全电压结论，也不能作为家庭带电操作的参考。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'cell', kind: 'battery', name: '低压电源 6 V', pos: [0, 0, 0], params: { voltage: 6, resistance: 0.5 } },
      { id: 'breaker', kind: 'switch', name: '断开点（总开关）', pos: [2, 0, 0], params: { closed: 1 } },
      { id: 'lamp', kind: 'lamp', name: '用电器（60 Ω）', pos: [4, 0, 0], params: { resistance: 60, ratedPower: 2.4 } },
      { id: 'protect', kind: 'box', name: '保护装置（未实现，仅标记）', pos: [2, 1.4, 0], params: { mass: 1, width: 0.8, height: 0.5, depth: 0.4 }, fixed: true },
      { id: 'ground', kind: 'ground', name: '参考地', pos: [0, 0, 2], params: {} },
    ],
    connections: [
      { id: 'w1', kind: 'wire', source: 'cell', sourcePort: 'a', target: 'breaker', targetPort: 'a' },
      { id: 'w2', kind: 'wire', source: 'breaker', sourcePort: 'b', target: 'lamp', targetPort: 'a' },
      { id: 'w3', kind: 'wire', source: 'lamp', sourcePort: 'b', target: 'cell', targetPort: 'b' },
      { id: 'w4', kind: 'wire', source: 'cell', sourcePort: 'b', target: 'ground', targetPort: 'a' },
    ],
  },
  {
    id: 'CH-K-E2-12',
    knowledgeId: 'K-E2-12',
    labId: 'circuits',
    tier: 'concept',
    difficulty: 'intermediate',
    title: '电流的磁效应（概念示意）',
    brief: '电路电流是真的，但导线不会生成磁场——环绕磁场只能用理论公式算。',
    hint: '通电直导线周围的磁感线是一圈一圈套着导线的。B = μ₀I / (2πr)。',
    prediction: {
      prompt: '通电直导线周围的磁场，磁感线是什么形状？',
      options: ['一圈圈套着导线的同心圆', '从导线一端出发的直线', '和导线平行的直线'],
      answerIndex: 0,
    },
    observation:
      '电源、电阻是真的连成回路，电流表读到的支路电流是真的。但平台里「电路导线」不产生空间磁场，所以那根圆柱只是标出导线位置，环绕方向要按右手螺旋定则自己判断。B 用 B = μ₀I / (2πr) 算，不是探针读数。',
    learning: {
      variables: ['（真实）电路电流', '（理论）到导线的距离'],
      steps: ['支路电流读数', '按长直导线公式算理论 B', '右手定则判断环绕方向'],
      limitations:
        '电路导线不生成空间磁场，未实现毕奥–萨伐尔积分；场强公式属于外部理论说明，不能冒充探针读数。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'cell', kind: 'battery', name: '电源 6 V', pos: [-1, 0, 0], params: { voltage: 6, resistance: 0.5 } },
      { id: 'load', kind: 'resistor', name: '电阻 10 Ω', pos: [0.6, 0, 0], params: { resistance: 10 } },
      { id: 'amp', kind: 'ammeter', name: '电流表', pos: [2.2, 0, 0], params: {} },
      { id: 'wire-view', kind: 'cylinder', name: '直导线（仅标记位置）', pos: [0, 1.6, 0], params: { mass: 1, radius: 0.05, height: 3 }, fixed: true },
      { id: 'loop', kind: 'box', name: '磁感线环绕方向参考', pos: [0.9, 1.6, 0], params: { mass: 1, width: 0.5, height: 0.1, depth: 0.5 }, fixed: true },
      { id: 'ground', kind: 'ground', name: '参考地', pos: [-1, 0, 2], params: {} },
    ],
    connections: [
      { id: 'w1', kind: 'wire', source: 'cell', sourcePort: 'a', target: 'load', targetPort: 'a' },
      { id: 'w2', kind: 'wire', source: 'load', sourcePort: 'b', target: 'amp', targetPort: 'a' },
      { id: 'w3', kind: 'wire', source: 'amp', sourcePort: 'b', target: 'cell', targetPort: 'b' },
      { id: 'w4', kind: 'wire', source: 'cell', sourcePort: 'b', target: 'ground', targetPort: 'a' },
    ],
  },
  {
    id: 'CH-K-E3-11',
    knowledgeId: 'K-E3-11',
    labId: 'circuits',
    tier: 'concept',
    difficulty: 'advanced',
    title: '法拉第电磁感应（概念示意）',
    brief: '磁铁、绕组、电表都是标记，平台不会真的产生感应电动势。',
    hint: '关键是「变」：磁通量变了才有电动势，静止不动就没有。',
    prediction: {
      prompt: '磁铁静止插在绕组里不懂，绕组里有感应电动势吗？',
      options: ['没有，因为磁通量没变', '有，只要磁铁在附近就有', '有，而且比移动时更大'],
      answerIndex: 0,
    },
    observation:
      '这是概念示意：平台没有磁通积分和运动感应电动势，电表方块不会动，绕组也不会自己发电。请按「磁通量有没有变」来分类：移动、转动、改变面积才会变。',
    learning: {
      variables: ['（示意）磁铁位置', '（理论）绕组面积、匝数、转角'],
      steps: ['哪些情况磁通量会变', '按 ε = −N·dΦ/dt 判断电动势方向'],
      limitations:
        '没有磁通积分或运动感应电动势求解；不能把手设电源电压或音圈输出当成自动感应结果。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'magnet', kind: 'bar_magnet', name: '条形磁铁（示意）', pos: [-1.6, 1, 0], params: { moment: 1000, core: 0.2, axis: 0 }, fixed: true },
      { id: 'coil', kind: 'cylinder', name: '绕组（示意）', pos: [0.4, 1, 0], params: { mass: 1, radius: 0.6, height: 0.5 }, fixed: true },
      { id: 'meter', kind: 'box', name: '电表（示意，未接线）', pos: [2.6, 1, 0], params: { mass: 1, width: 0.7, height: 0.5, depth: 0.3 }, fixed: true },
    ],
    connections: [],
  },
  {
    id: 'CH-K-E3-15',
    knowledgeId: 'K-E3-15',
    labId: 'circuits',
    tier: 'concept',
    difficulty: 'advanced',
    title: '变压器（概念示意）',
    brief: '两个绕组加一个铁芯只是结构标记：平台没有互感，二次侧不会自动出电压。',
    hint: '理想变压器：U₁/U₂ = n₁/n₂，电流比反过来。',
    prediction: {
      prompt: '理想变压器，一次侧 100 匝接 220 V，二次侧 10 匝，二次电压是多少？',
      options: ['22 V', '2200 V', '220 V'],
      answerIndex: 0,
    },
    observation:
      '这是概念示意：圆柱只是标出两个绕组的位置，方块标出共同铁芯。平台没有互感、没有铁芯磁通，二次侧不会自动产生电压。请把匝数比代进 U₁/U₂ = n₁/n₂ 自己算。',
    learning: {
      variables: ['（理论）匝数比', '（理论）输入电压', '（说明）负载'],
      steps: ['识别一、二次绕组位置', '按匝数比算二次电压', '按功率守恒算电流比'],
      limitations:
        '平台没有互感、铁芯磁通或变压器模型，不能产生自动二次输出；两个独立电感并不构成变压器。',
    },
    env: { gravity: 0, damping: 0, speed: 1, collisions: false },
    components: [
      { id: 'primary', kind: 'cylinder', name: '一次绕组 n₁=1000（示意）', pos: [-1, 1, 0], params: { mass: 1, radius: 0.5, height: 0.4 }, fixed: true },
      { id: 'secondary', kind: 'cylinder', name: '二次绕组 n₂=100（示意）', pos: [1, 1, 0], params: { mass: 1, radius: 0.5, height: 0.4 }, fixed: true },
      { id: 'core', kind: 'box', name: '共同铁芯（示意）', pos: [0, 1, 0], params: { mass: 1, width: 1.6, height: 0.9, depth: 0.2 }, fixed: true },
      { id: 'src', kind: 'ac_source', name: '输入侧标识（不构成互感）', pos: [-2.6, 1, 0], params: { amplitude: 5, frequency: 50, phase: 0, offset: 0, resistance: 0.1 }, fixed: true },
    ],
    connections: [],
  },
];
