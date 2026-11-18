/**
 * 凸透镜实验台 · 参考实现（给 B 当起点）
 *
 * 契约见 PLAN.md §6.2：只做渲染，不碰物理、不发请求。
 *
 * ★ 两个必须注意的点（B 一定要看）：
 *
 *  1. y 轴是反的。
 *     物理里 y 向上为正，SVG 里 y 向下为正，两者相反。
 *     引擎（traceRays / solve）给出来的都是**物理坐标**，
 *     渲染前必须统一过一遍 `Y()` 取反，否则像会画到轴上边去。
 *
 *  2. 缩放和平移是「视图状态」，不是「业务状态」。
 *     它只影响你怎么看这张图，不影响任何物理数值，所以允许放在本组件内部。
 *     但 params / metrics 仍然只读，绝不在这里改。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LabStageProps } from '../../core/contracts';
import { traceRays } from './engine';

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function fitView(p: LabStageProps['params'], m: LabStageProps['metrics']) {
  const left = -p.u - p.f * 0.28 - 2;
  const right =
    Math.max(p.screenX, p.f * 2.3, m.real && Number.isFinite(m.v) ? Math.min(m.v, p.f * 3.2) : 0) +
    p.f * 0.28 +
    2;
  const spanX = Math.max(right - left, 18);

  const imgH = Number.isFinite(m.imageHeight) ? Math.min(m.imageHeight, p.h * 3.5) : 0;
  const lensH = clamp(p.lensDiameter, 3.5, 9);
  const halfH = Math.max(p.h * 1.5, imgH * 1.35, lensH * 1.2, 3.2) + 1.4;

  return { xMin: left, spanX, halfH };
}

export default function LabStage({
  params,
  stage,
  metrics,
  showRays,
  showVirtualExtensions,
  highlightIds = [],
  narration = null,
  demoMode = false,
  onParamChange,
}: LabStageProps) {
  const base = useMemo(() => fitView(params, metrics), [params, metrics]);
  const rays = useMemo(() => (showRays ? traceRays(params) : []), [params, showRays]);

  /* ---------- 视图：缩放 / 平移 / 全屏 ---------- */
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ startX: number; startPan: number } | null>(null);

  const panLimit = base.spanX * 0.45;

  const resetView = useCallback(() => {
    setZoom(1);
    setPan(0);
  }, []);

  const zoomBy = useCallback((k: number) => {
    setZoom((z) => clamp(z * k, 0.6, 4));
  }, []);

  /* 全屏 —— 用 fixed 覆盖层，不用原生 Fullscreen API。
     原因：① 在 iframe 里原生全屏经常被浏览器拒绝
           ② 覆盖层更好控样式，也更容易退出 */
  const toggleFull = useCallback(() => {
    setIsFull((v) => {
      const next = !v;
      if (next) {
        // 进全屏：让「物 → 光屏」这一整段刚好铺满屏幕。
        //   目标跨度 = 物到屏的距离 + 15% 边距
        //   视图中心 = 物和屏的中点（不是透镜，透镜偏左）
        const contentSpan = (params.u + params.screenX) * 1.15 + 6;
        const Z = clamp(base.spanX / contentSpan, 1, 2.6);
        setZoom(Z);

        const contentCenter = (-params.u + params.screenX) / 2;
        const baseCenter = base.xMin + base.spanX / 2;
        setPan(clamp(contentCenter - baseCenter, -panLimit, panLimit));
      } else {
        setZoom(1);
        setPan(0);
      }
      return next;
    });
  }, [base, params.u, params.screenX]);

  useEffect(() => {
    if (!isFull) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFull(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('lab-fullscreen');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      document.documentElement.classList.remove('lab-fullscreen');
    };
  }, [isFull]);

  /* 拖动平移 */
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    drag.current = { startX: e.clientX, startPan: pan };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const curSpanX = base.spanX / zoom;
    const unitsPerPx = curSpanX / rect.width;
    const dx = (e.clientX - drag.current.startX) * unitsPerPx;
    setPan(clamp(drag.current.startPan - dx, -panLimit, panLimit));
  };

  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    drag.current = null;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
  };

  /* ---------- 实际取景 ---------- */
  const curSpanX = base.spanX / zoom;
  const curHalfH = base.halfH / zoom;
  const centeredXMin = base.xMin + (base.spanX - curSpanX) / 2;
  const xMin = centeredXMin + pan;

  const hl = (id: string) => highlightIds.includes(id);

  /** 物理坐标 y（向上为正）→ SVG y（向下为正） */
  const Y = (y: number) => -y;

  const objH = params.h;
  const lensH = clamp(params.lensDiameter, 3.5, 9);
  const screenH = Math.max(params.h * 2.2, 5);

  const imgXVisible = Number.isFinite(metrics.imageX) && Math.abs(metrics.imageX) < 1e4;
  const imgY = Number.isFinite(metrics.imageY) ? metrics.imageY : 0;

  const isPanned = Math.abs(pan) > 0.01;
  const isZoomed = Math.abs(zoom - 1) > 0.001;

  const body = (
    <div
      className={`lab-stage ${isFull ? 'is-full' : ''}`}
      data-stage={stage}
      data-demo={demoMode ? '1' : '0'}
      ref={wrapRef}
    >
      {/* ===== 视图工具条 ===== */}
      <div className="lab-tools">
        <button onClick={() => zoomBy(1 / 1.4)} title="缩小" aria-label="缩小">
          −
        </button>
        <span className="zoom-val">{Math.round(zoom * 100)}%</span>
        <button onClick={() => zoomBy(1.4)} title="放大" aria-label="放大">
          +
        </button>
        <span className="tool-sep" />
        <button
          onClick={resetView}
          title="复位"
          aria-label="复位"
          disabled={!isZoomed && !isPanned}
        >
          ⟲
        </button>
        <button onClick={toggleFull} title={isFull ? '退出全屏' : '全屏'} aria-label="全屏">
          {isFull ? '⤡' : '⤢'}
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`${xMin} ${-curHalfH} ${curSpanX} ${curHalfH * 2}`}
        preserveAspectRatio="xMidYMid meet"
        className={`lab-svg ${drag.current ? 'dragging' : ''}`}
        style={{ aspectRatio: `${curSpanX} / ${curHalfH * 2}` }}
        role="img"
        aria-label={`凸透镜成像：${metrics.description}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={resetView}
      >
        <defs>
          <filter id="blurSpot" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation={Math.max(metrics.blurDiameter / 2.6, 0.05)} />
          </filter>
          <linearGradient id="lensGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="lens-grad-a" stopOpacity="0.85" />
            <stop offset="50%" className="lens-grad-b" stopOpacity="0.5" />
            <stop offset="100%" className="lens-grad-a" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* ===== 主光轴 ===== */}
        <line x1={xMin} y1={0} x2={xMin + curSpanX} y2={0} className={`axis ${hl('axis') ? 'hl' : ''}`} />

        {/* ===== 焦点 / 二倍焦距 ===== */}
        {[
          { x: -2 * params.f, t: '2F' },
          { x: -params.f, t: 'F' },
          { x: params.f, t: 'F′' },
          { x: 2 * params.f, t: '2F′' },
        ].map(({ x, t }) => (
          <g key={t}>
            <line x1={x} y1={-curHalfH * 0.035} x2={x} y2={curHalfH * 0.035} className="tick" />
            <text x={x} y={curHalfH * 0.125} className="tick-label" textAnchor="middle">
              {t}
            </text>
          </g>
        ))}

        {/* ===== 三条特殊光线 ===== */}
        {rays.map((ray, i) => {
          if (ray.dashed && !showVirtualExtensions) return null;
          const d = ray.points
            .map((pt, j) => `${j === 0 ? 'M' : 'L'} ${pt.x.toFixed(3)} ${Y(pt.y).toFixed(3)}`)
            .join(' ');
          return (
            <path
              key={`ray-${i}`}
              d={d}
              className={`ray ray-${ray.kind} ${ray.dashed ? 'dashed' : ''} ${
                hl(`ray${ray.kind}`) ? 'hl' : ''
              }`}
            />
          );
        })}

        {/* ===== 透镜 ===== */}
        <g className={hl('lens') ? 'hl-group' : ''}>
          <path
            d={`M 0 ${-lensH} Q ${lensH * 0.42} 0 0 ${lensH} Q ${-lensH * 0.42} 0 0 ${-lensH} Z`}
            fill="url(#lensGrad)"
            className="lens"
          />
          {params.maskTop && (
            <path d={`M 0 ${-lensH} Q ${lensH * 0.42} 0 0 0 L 0 ${-lensH} Z`} className="lens-mask" />
          )}
          <line x1={0} y1={-lensH} x2={0} y2={lensH} className="lens-center" />
        </g>

        {/* ===== 物体 ===== */}
        <g className={hl('candle') ? 'hl-group' : ''}>
          {params.objectShape === 'candle' ? (
            <>
              <rect
                x={-params.u - 0.5}
                y={0}
                width={1}
                height={Math.max(objH * 0.18, 0.45)}
                className="candle-body"
                rx="0.1"
              />
              <path
                d={`M ${-params.u} ${Y(objH)} q ${-objH * 0.26} ${-objH * 0.3} 0 ${-objH * 0.34} q ${
                  objH * 0.26
                } ${objH * 0.06} 0 ${objH * 0.34}`}
                className="candle-flame"
              />
            </>
          ) : params.objectShape === 'F' ? (
            <path
              d={`M ${-params.u} 0 L ${-params.u} ${Y(objH)} L ${-params.u + objH * 0.45} ${Y(
                objH,
              )} M ${-params.u} ${Y(objH * 0.52)} L ${-params.u + objH * 0.3} ${Y(objH * 0.52)}`}
              className="obj-stroke"
            />
          ) : (
            <>
              <line x1={-params.u} y1={0} x2={-params.u} y2={Y(objH)} className="obj-stroke" />
              <path
                d={`M ${-params.u - 0.32} ${Y(objH) + 0.42} L ${-params.u} ${Y(objH)} L ${
                  -params.u + 0.32
                } ${Y(objH) + 0.42}`}
                className="obj-stroke"
              />
            </>
          )}
        </g>

        {/* ===== 光屏 ===== */}
        <g className={hl('screen') ? 'hl-group' : ''}>
          <rect
            x={params.screenX - 0.17}
            y={-screenH / 2}
            width={0.34}
            height={screenH}
            className="screen"
            rx="0.07"
          />
        </g>

        {/* ===== 屏上落到的像 / 光斑 ===== */}
        {metrics.real && imgXVisible && Number.isFinite(metrics.imageHeight) && (
          <g opacity={clamp(metrics.relativeIlluminance * 1.8 + 0.22, 0.15, 1)}>
            <ellipse
              cx={params.screenX}
              cy={Y(imgY / 2)}
              rx={Math.max(metrics.imageHeight / 2, 0.22)}
              ry={Math.max(Math.abs(imgY) / 2 + metrics.blurDiameter / 2, 0.22)}
              className="screen-spot"
              filter={metrics.blurDiameter > 0.06 ? 'url(#blurSpot)' : undefined}
            />
          </g>
        )}

        {/* ===== 像 ===== */}
        {imgXVisible && (
          <g className={hl('image') ? 'hl-group' : ''}>
            <line
              x1={metrics.imageX}
              y1={0}
              x2={metrics.imageX}
              y2={Y(imgY)}
              className={`img-stroke ${metrics.real ? '' : 'virtual'}`}
            />
            <path
              d={`M ${metrics.imageX - 0.3} ${Y(imgY) + (imgY < 0 ? 0.42 : -0.42)} L ${
                metrics.imageX
              } ${Y(imgY)} L ${metrics.imageX + 0.3} ${Y(imgY) + (imgY < 0 ? 0.42 : -0.42)}`}
              className={`img-stroke ${metrics.real ? '' : 'virtual'}`}
            />
          </g>
        )}

        {/* ===== 器材标签 ===== */}
        {[
          { x: -params.u, t: '物' },
          { x: 0, t: '透镜' },
          { x: params.screenX, t: '光屏' },
        ].map(({ x, t }) => (
          <text key={t} x={x} y={-curHalfH * 0.84} className="rig-label" textAnchor="middle">
            {t}
          </text>
        ))}

        {imgXVisible && (
          <text
            x={metrics.imageX}
            y={imgY < 0 ? curHalfH * 0.42 : -curHalfH * 0.42}
            className="img-label"
            textAnchor="middle"
          >
            {metrics.real ? '实像' : '虚像'}
          </text>
        )}

        {/* ===== 刻度尺 ===== */}
        <g>
          <line
            x1={xMin}
            y1={curHalfH * 0.9}
            x2={xMin + curSpanX}
            y2={curHalfH * 0.9}
            className="ruler-line"
          />
          {Array.from(
            { length: Math.floor(curSpanX / 10) + 2 },
            (_, i) => Math.floor(xMin / 10) * 10 + i * 10,
          )
            .filter((cm) => cm >= xMin && cm <= xMin + curSpanX)
            .map((cm) => (
              <g key={cm}>
                <line x1={cm} y1={curHalfH * 0.9} x2={cm} y2={curHalfH * 0.96} className="ruler-line" />
                <text x={cm} y={curHalfH * 1.1} className="ruler-text" textAnchor="middle">
                  {cm}
                </text>
              </g>
            ))}
        </g>
      </svg>

      {/* 提示：只在缩放/平移时出现 */}
      {!isFull && (isZoomed || isPanned) && (
        <div className="lab-hint">
          拖动可以平移 · 双击复位
        </div>
      )}

      {narration && (
        <div className="lab-bubble" role="status">
          {narration}
        </div>
      )}

      {isFull && (
        <div className="lab-full-ctrl">
          <label>物距 u</label>
          <input
            type="range"
            min={1}
            max={80}
            step={0.5}
            value={params.u}
            onChange={(e) => onParamChange?.({ u: Number(e.target.value) })}
          />
          <b>{params.u.toFixed(1)} cm</b>
          <span className="spacer" />
          <button onClick={resetView}>复位视图</button>
          <button onClick={toggleFull}>退出全屏 (Esc)</button>
        </div>
      )}

      <div className="lab-readout">
        <span className="ro">
          物距 u <b>{params.u.toFixed(1)} cm</b>
        </span>
        <span className="ro">
          焦距 f <b>{params.f.toFixed(1)} cm</b>
        </span>
        <span className="ro">
          像距 v <b>{Number.isFinite(metrics.v) ? Math.abs(metrics.v).toFixed(1) : '∞'}</b>
          {metrics.real ? ' cm（实）' : ' cm（虚）'}
        </span>
        <span className={`ro ${metrics.screenHasImage ? 'good' : 'warn'}`}>
          光屏{' '}
          <b>
            {metrics.isParallel
              ? '平行光，无像'
              : metrics.screenHasImage
                ? '清晰'
                : `${metrics.blurDiameter.toFixed(1)} cm 光斑`}
          </b>
        </span>
      </div>
    </div>
  );

  /* 全屏必须挂到 document.body：
     父容器有 sticky / transform 时会成为新的定位参照，
     直接写 position:fixed 会被裁在父容器里，出不来真正的全屏。 */
  return isFull ? createPortal(body, document.body) : body;
}
