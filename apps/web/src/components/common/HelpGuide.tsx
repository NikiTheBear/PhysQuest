interface Props {
  onClose: () => void;
}

/**
 * 帮助 / 首次使用引导
 *
 * 从顶栏「帮助」进入，也可以第一次打开时自动提示。
 * 原则：**不拦路**。任何时候都能关掉，任何时候都能回来看。
 *
 * 我们刻意不做那种「五步引导遮罩层」——光伏那个原型就是栽在这，
 * 学生还没摸到滑块就被一页页说明劝退了。
 */
export default function HelpGuide({ onClose }: Props) {
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal help-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(760px,100%)' }}
      >
        <div className="help-head">
          <div>
            <span className="eyebrow">How to use · 怎么用</span>
            <h3>五分钟就能上手</h3>
          </div>
          <button className="btn-ghost" onClick={onClose} aria-label="关闭帮助">
            关闭
          </button>
        </div>

        {/* ============ 一句话说明 ============ */}
        <div className="help-lead">
          这个平台有<strong>两种玩法</strong>：
          <b>「有引导」</b>是先猜一个答案再动手验证；
          <b>「自由搭建」</b>是自己摆器具、连线路，从空白开始做实验。
          <br />
          两种不是二选一，是同一门课的两个阶段。
        </div>

        {/* ============ 三步走 ============ */}
        <div className="help-steps">
          <div className="help-step">
            <span className="hs-no">1</span>
            <div>
              <h4>在知识地图挑一个模块</h4>
              <p>
                打开就是知识地图。上面有几张模块卡：
                <b>凸透镜成像</b>、<b>力与运动</b>、<b>电路与电流</b>、<b>声与波</b>，
                还有一张<b>自由搭建实验台</b>。
              </p>
              <p className="hs-note">往下滚能看到全平台 166 个知识点，点任意一张能看卡片。</p>
            </div>
          </div>

          <div className="help-step">
            <span className="hs-no">2</span>
            <div>
              <h4>选一个挑战，先猜再动手</h4>
              <p>
                点「有引导」的模块，会看到一串小挑战。每个挑战第一步不是实验台，
                而是一句问题——<b>先猜一个答案</b>，猜完就锁死。
              </p>
              <p className="hs-note">
                猜错了不要紧。猜错的那一下才是真正记住的时候——这是这个平台的设计核心。
              </p>
            </div>
          </div>

          <div className="help-step">
            <span className="hs-no">3</span>
            <div>
              <h4>调到满意，再决定要不要「搭出来」</h4>
              <p>
                拖滑块、拖光屏、换透镜。调到你满意，点右上角<b>「我满意了」</b>锁定这组参数。
              </p>
              <p className="hs-note">
                锁定之后会出现一条「<b>搬到自由搭建 →</b>」，点一下就能带着这组参数
                进工作台，用 46 种器具把它做成真正的装置。
              </p>
            </div>
          </div>
        </div>

        {/* ============ 两种模式对比 ============ */}
        <div className="help-compare">
          <div>
            <span className="hc-label">有引导</span>
            <b>先学规律</b>
            <p>挑战 → 先猜（锁死）→ 调参 → 锁定 → 对比 → 测验 → 报告</p>
          </div>
          <div>
            <span className="hc-label">自由搭建</span>
            <b>再做出来</b>
            <p>自己摆器具、连线路、跑仿真。可以让 AI 一起搭，每一次修改都能撤销。</p>
          </div>
        </div>

        {/* ============ 常见问题 ============ */}
        <div className="help-faq">
          <h4>几个常见问题</h4>

          <details>
            <summary>要不要配 API Key？</summary>
            <p>
              <b>不是必须的。</b>所有物理计算、实验台、测验、报告都在本地跑，断网也能用。
              配了 Key 才能用 AI 助教（答疑、出题）和自由搭建里的 AI 协作。
              点右上角 <b>⚙</b> 填，只存在你自己的浏览器里。
            </p>
          </details>

          <details>
            <summary>我的学习记录存在哪？</summary>
            <p>
              存在你这台电脑的浏览器里，不上传任何服务器。
              换电脑或清浏览器数据会丢——右上角 <b>⟲</b> 可以清空，但目前还不能导出。
            </p>
          </details>

          <details>
            <summary>为什么有些知识点点开只有卡，没有实验？</summary>
            <p>
              因为只有一部分知识点有真实的物理求解器。卡片上标着：
              <b>可计算</b>（能拖参数真算）、<b>近似</b>（能做演示但数值不准）、
              <b>仅示意</b>（只有示意图）。<b>我们不会把「仅示意」说成「可以算」。</b>
            </p>
          </details>

          <details>
            <summary>自由搭建打不开 / 一直转圈？</summary>
            <p>
              自由搭建是另一个服务（跑在 4317 端口），需要先把服务起起来。
              在项目根目录双击 <b>start.command</b>，或者跑
              <code>node scripts/run-platform.mjs</code>。
            </p>
          </details>

          <details>
            <summary>实验台的数据能带走吗？</summary>
            <p>
              能。点「我满意了」→「搬到自由搭建 →」，这组参数会原样带进工作台，
              还能继续在那边加器具、存成实验文件导出。
            </p>
          </details>
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={onClose}>
            知道了，开始 →
          </button>
        </div>
      </div>
    </div>
  );
}
