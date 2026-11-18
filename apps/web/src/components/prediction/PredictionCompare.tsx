import type { Challenge, LensMetrics, PredictionRecord } from '../../core/contracts';

interface Props {
  challenge: Challenge;
  prediction: PredictionRecord;
  metrics: LensMetrics;
  onNext: () => void;
}

/** 预测 vs 实际：这是学生在整个实验里记住的那一下 */
export default function PredictionCompare({ challenge, prediction, metrics, onNext }: Props) {
  const q = challenge.prediction;
  const chosen = q.options[prediction.chosenIndex];
  const hit = prediction.chosenIndex === q.answerIndex;

  const actual = metrics.description;

  return (
    <div className="overlay">
      <div className="modal">
        <h3>{hit ? '猜对了' : '跟你想的不一样'}</h3>
        <p className="sub">
          你刚才选的是「{chosen}」。这是锁定前的判断，已经记进你的学习记录了。
        </p>

        <div className="compare">
          <div className="box">
            <div className="k">你的猜测</div>
            <div className="v">{chosen}</div>
          </div>
          <div className={`box ${hit ? 'hit' : 'miss'}`}>
            <div className="k">物理引擎算出的结果</div>
            <div className="v">{actual}</div>
          </div>
        </div>

        {!hit && (
          <div className="gate" style={{ borderColor: 'rgba(248,113,113,0.4)', color: '#fecaca' }}>
            实际答案是「{q.options[q.answerIndex]}」。这个反差就是这次实验最值钱的地方 ——
            你看一眼右边的光路图，找找是哪里和你的想法不同。
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-primary" onClick={onNext}>
            继续
          </button>
        </div>
      </div>
    </div>
  );
}
