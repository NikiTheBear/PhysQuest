# 知识提示词的模型边界与参考

提示词以当前 `shared/catalog.js`、`shared/physics.js`、`shared/mechanics.js`、`shared/circuit.js` 和工作台“物理模型与计算说明”为实现能力依据。基础关系采用标准物理定义，以下权威教材与原始论文用于核对热学、量子及太阳能电池边界。未移植这些来源的求解器，也未把概念示意冒充该理论数值仿真。

- [OpenStax University Physics Volume 2，第 3 章摘要](https://openstax.org/books/university-physics-volume-2/pages/3-summary)：理想气体、第一定律与热容约定；提示词统一使用 `ΔU=Q−W`，其中 W 是系统对外做功。
- [OpenStax University Physics Volume 2，第 4 章](https://openstax.org/books/university-physics-volume-2/pages/4-introduction)：热机、第二定律与熵。当前平台没有热力学状态变量，RC 仅能提供明示映射的线性数学类比。
- [OpenStax University Physics Volume 3，7.6 量子隧穿](https://openstax.org/books/university-physics-volume-3/pages/7-6-the-quantum-tunneling-of-particles-through-potential-barriers)：透射需要波函数与边界条件，经典刚体穿越不能模拟量子隧穿。
- [OpenStax University Physics Volume 3，第 7 章摘要](https://openstax.org/books/university-physics-volume-3/pages/7-summary)：量子波函数、能级与势垒。现有器具无复振幅、量子测量或能带求解，相关条目设为概念示意。
- [Shockley 与 Queisser，Detailed Balance Limit of Efficiency of p-n Junction Solar Cells，1961 原始论文（大学存档）](https://chem.ch.huji.ac.il/etgar/2.5.13%20characterization%20techniques.pdf)：S–Q 极限依赖吸收/发射详细平衡，不可由简单电阻电路推得。

补充约定：中文教材的“查理定律”常用于等容 `p/T=常数`；英文 Charles's law 通常指等压 `V/T=常数`。对应提示词明确约束条件和温标，避免只凭名称选择公式。
