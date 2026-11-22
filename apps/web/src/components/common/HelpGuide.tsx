import { ALL_CARDS, AUTO_CHALLENGES, CHALLENGES } from '../../data/content';
import { BANK } from '../../data/question-bank';

const STATS = {
  cards: ALL_CARDS.length,
  challenges: CHALLENGES.length + AUTO_CHALLENGES.length,
  questions: BANK.length,
};

interface Props {
  onClose: () => void;
  /** 从某些地方打开始终显示「先看一遍」的分寸 —— 目前只是文案差异 */
  firstTime?: boolean;
}

/**
 * 帮助 / 教程
 *
 * 目标：一个人第一次打开这个平台，看完这一页就知道「这玩意儿能干什么、
 * 我要按什么顺序用它」。所以顺序是：
 *   这是什么 → 有哪几个地方 → 一次完整学习长什么样 → 要不要配 Key → 常见问题
 *
 * 原则：**不拦路**。任何时候都能关掉，任何时候都能回来看。
 * 刻意不做「五步引导遮罩层」——学生还没摸到滑块就被一页页说明劝退了。
 */
export default function HelpGuide({ onClose }: Props) {
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal help-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(860px,100%)' }}
      >
        <div className="help-head">
          <div>
            <span className="eyebrow">Tutorial · 教程</span>
            <h3>这个平台怎么用</h3>
          </div>
          <button className="btn-ghost" onClick={onClose} aria-label="关闭帮助">
            关闭
          </button>
        </div>

        <div className="help-scroll">
          {/* ============ 一、这是什么 ============ */}
          <div className="help-lead">
            这是一个<b>把物理学成一条路</b>的地方。
            <br />
            它不给你标准答案，而是让你<b>先猜一句</b>，再<b>自己动手把实验调出来</b>，
            看看猜对没猜对——猜错的那一下，才是真正记住的时候。
            <br />
            全平台 <b>{STATS.cards} 个知识点</b>、<b>{STATS.challenges} 个挑战</b>、<b>{STATS.questions} 道题</b>，
            从小学的「光走直线」一直排到大学的「麦克斯韦方程组」。
          </div>

          {/* ============ 二、五个地方 ============ */}
          <div className="help-section-title">
            <h4>平台有五个地方</h4>
            <span>顶栏从左到右，就是一次学习该走的顺序</span>
          </div>

          <div className="help-places">
            <div className="help-place">
              <span className="hp-no">01</span>
              <div className="hp-body">
                <b>知识地图</b>
                <p>
                  入口。两种看法：<b>按模块</b>——四张模块卡（凸透镜成像 / 力与运动 /
                  电路与电流 / 声与波），选一张进去做挑战；<b>按知识点</b>——176
                  张双面卡片，按小学到大学排好。
                </p>
                <p className="hp-when">
                  什么时候用：不知道从哪开始时；想单独搞懂某一条时；想搜「折射」时。
                </p>
              </div>
            </div>

            <div className="help-place">
              <span className="hp-no">02</span>
              <div className="hp-body">
                <b>挑战导览</b>
                <p>
                  选了模块之后进来的地方。一个模块拆成若干小挑战，每个挑战只问一件事，
                  比如「让像和蜡烛一样大」。点任意一张进实验台。
                </p>
                <p className="hp-when">什么时候用：想做完整的实验流程时。</p>
              </div>
            </div>

            <div className="help-place">
              <span className="hp-no">03</span>
              <div className="hp-body">
                <b>实验台</b>
                <p>
                  真正动手的地方。全屏工作台，46 种器具随便摆：拖透镜、接电路、加声源，
                  拖参数会<b>真的算</b>——不是动画，是物理引擎在算。
                </p>
                <p className="hp-when">
                  什么时候用：任何时候。不用先选挑战也能进，进去就是一张空白台。
                </p>
              </div>
            </div>

            <div className="help-place">
              <span className="hp-no">04</span>
              <div className="hp-body">
                <b>题库</b>
                <p>
                  {STATS.questions} 道题，覆盖全部 {STATS.cards} 个知识点。每个知识点 5–10 道，从简单到困难，
                  <b>每道题都有逐项解析</b>——不光告诉你对的是哪个，还告诉你每个错项错在哪。
                  <b>你自己挑要做哪些知识点</b>，不用从头刷到尾。
                </p>
                <p className="hp-when">什么时候用：做完实验、想出报告之前。</p>
              </div>
            </div>

            <div className="help-place">
              <span className="hp-no">05</span>
              <div className="hp-body">
                <b>我的报告</b>
                <p>
                  把这一轮做过的事整理成一份学习报告：调过哪些参数、猜过什么、
                  哪些误区踩到了、涉及哪些知识点。可以导出成 .md 带走。
                </p>
                <p className="hp-when">
                  什么时候用：一轮学习结束时。报告要先做完题、再写一句自己的反思。
                </p>
              </div>
            </div>
          </div>

          {/* ============ 三、一次完整的学习 ============ */}
          <div className="help-section-title">
            <h4>一次完整的学习长什么样</h4>
            <span>从进入到出报告，九步。前四步是「先猜再做」，中间三步是「检验」，最后两步是「交代」</span>
          </div>

          <div className="help-flow">
            <div className="hf-group">
              <span className="hf-tag">先猜再做</span>
              <ol>
                <li>
                  <b>进知识地图</b>，挑一个模块。比如「凸透镜成像」。
                </li>
                <li>
                  <b>选一个挑战</b>。「让像和蜡烛一样大」——只问这一件事。
                </li>
                <li>
                  <b>先猜一个答案</b>。这时候还没有实验台，只有一句话和一个输入框。
                  猜完<b>立刻锁死</b>，后面改不了。
                </li>
                <li>
                  <b>进实验台调参数</b>。拖滑块、拖光屏、换透镜，看着光路图实时变。
                  调到你觉得对了，点右上角<b>「我满意了」</b>。
                </li>
              </ol>
            </div>

            <div className="hf-group">
              <span className="hf-tag">检验</span>
              <ol start={5}>
                <li>
                  <b>锁定时打星 + 写一句为什么</b>。不是打分，是让你说清「我凭什么觉得这样对」。
                </li>
                <li>
                  <b>去题库做题</b>。自己挑知识点——可以只做刚才那个挑战涉及的，
                  也可以自己勾。每个知识点从简单做到困难。
                </li>
                <li>
                  <b>看错题解析</b>。答错会立刻告诉你为什么错、错在哪个误区上。
                </li>
              </ol>
            </div>

            <div className="hf-group">
              <span className="hf-tag">交代</span>
              <ol start={8}>
                <li>
                  <b>写一句自己的反思</b>。至少 10 个字。
                  这一栏系统<b>不带 AI 按钮</b>——反思必须你自己写，这是红线。
                </li>
                <li>
                  <b>生成报告</b>。看看你猜的和实际差多少、踩了哪些坑、涉及哪些知识点。
                  能导出成 .md，也能直接复制。
                </li>
              </ol>
            </div>
          </div>

          <div className="help-note">
            <b>可以随时打断。</b>没有哪一步是必须按顺序走的——你可以直接进实验台空手搭，
            也可以只翻知识点不做题。上面这条线是「完整走一遍」的样子，不是规定。
          </div>

          {/* ============ 四、进实验台的三种方式 ============ */}
          <div className="help-section-title">
            <h4>实验台的三种进法</h4>
            <span>同一张台子，进去的状态不一样</span>
          </div>

          <div className="help-compare">
            <div>
              <span className="hc-label">从挑战进</span>
              <b>带着任务</b>
              <p>
                器具自动摆好，右上角有「实验目标」，顶栏有「先猜一下 / 我满意了」。
                适合第一次做某条规律。
              </p>
            </div>
            <div>
              <span className="hc-label">从顶栏进</span>
              <b>一张空白台</b>
              <p>
                什么器具都没有，也没有先猜和满意度。适合已经会了、想自己玩的时候。
              </p>
            </div>
            <div>
              <span className="hc-label">从知识卡进</span>
              <b>AI 帮你搭</b>
              <p>
                知识点卡片背面有个「去搭建 →」，点一下把这条的搭建方案交给 AI，
                进台子时它已经动手摆了。
              </p>
            </div>
          </div>

          {/* ============ 五、要不要配 Key ============ */}
          <div className="help-section-title">
            <h4>要不要配 API Key？</h4>
            <span>不是必须的</span>
          </div>

          <div className="help-compare two">
            <div>
              <span className="hc-label">不配</span>
              <b>照样能完整学一遍</b>
              <p>
                所有物理计算、实验台、题库、报告都在你自己的电脑上跑，
                <b>断网也能用</b>。这是这个平台的默认状态。
              </p>
            </div>
            <div>
              <span className="hc-label">配了</span>
              <b>多一个 AI 助教</b>
              <p>
                可以在实验台里跟 AI 说「帮我把斜面角度调到 30 度」，它就会去调。
                也能让它解释某条规律。点右上角 <b>⚙</b> 填，<b>只存在你自己的浏览器里</b>，
                不会上传到任何服务器。
              </p>
            </div>
          </div>

          <div className="help-note warn">
            <b>关于 AI 的边界：</b>AI 在这个平台里只能<b>下参数</b>，不能替你算物理。
            所有数字都来自本地引擎。它也<b>不会替你写反思</b>——那一栏是留给你自己的。
          </div>

          {/* ============ 六、常见问题 ============ */}
          <div className="help-faq">
            <h4>几个常见问题</h4>

            <details>
              <summary>为什么有些知识点没有实验？</summary>
              <p>
                因为只有一部分知识点有真实的物理求解器。每张卡片标着三种级别：
                <b>可计算</b>（拖参数真算）、<b>近似</b>（能做演示但数值不准）、
                <b>仅示意</b>（只有示意图）。
                <b>我们不会把「仅示意」说成「可以算」。</b>
              </p>
            </details>

            <details>
              <summary>我的学习记录存在哪？</summary>
              <p>
                存在你这台电脑的浏览器里，不上传任何服务器。
                换电脑或清浏览器数据会丢。右上角 <b>⟲</b> 可以清空，
                里面分两档：只清学习进度（保留主题和 Key），或者全部清空。
              </p>
            </details>

            <details>
              <summary>报告为什么打不开，一直让我去做题？</summary>
              <p>
                报告有两道闸门：<b>① 题库必须做完一遍</b>，<b>② 反思至少写 10 个字</b>。
                这是故意的——报告是学习的收尾，不是点一下就能生成的装饰品。
                闸门页面上会写清缺哪一项，点按钮直接去补。
              </p>
            </details>

            <details>
              <summary>实验台打不开 / 一直转圈？</summary>
              <p>
                实验台是另一个服务（跑在 4317 端口），需要先把服务起起来。
                在项目根目录双击 <b>start.command</b>，或者跑
                <code>node scripts/run-platform.mjs</code>。
                在线版（GitHub Pages）只有直连模式，用不了实验台。
              </p>
            </details>

            <details>
              <summary>可以让 AI 帮我搭一整套实验吗？</summary>
              <p>
                可以。在实验台右侧的 AI 对话里直接说，它会用器具库里的东西搭。
                每一次修改都能<b>撤销</b>，搭坏了没关系。
                另外每个知识点的卡片背面都写好了「这条怎么做成实验」，直接点「去搭建」也行。
              </p>
            </details>

            <details>
              <summary>手机能用吗？</summary>
              <p>
                目前不支持。这个平台的实验台需要宽屏，最小 1280px。
                手机打开会看到提示，用电脑访问体验最好。
              </p>
            </details>

            <details>
              <summary>顶栏那几个小图标是什么？</summary>
              <p>
                <b>?</b> 就是这个页面；
                <b>⚙</b> 是 AI 设置（填 Key 的地方）；
                <b>⟲</b> 是重置（清学习进度）；
                最右边三个是主题：<b>☀ 日间 / ☾ 夜间 / ◐ 跟随系统</b>。
              </p>
            </details>
          </div>
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
