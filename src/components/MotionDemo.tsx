import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { exerciseDbGif } from '../data/exercisedb'
import type { Muscle } from '../data/exercises'
import { MOTIONS, type Prop } from '../motion/motions'
import { jointAngle, solve, type Skeleton, type Vec } from '../motion/rig'
import { bounds, sample } from '../motion/timeline'

const Motion3D = lazy(() => import('./Motion3D'))

const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
})()

const MUSCLE_PART: Record<Muscle, 'torso' | 'thigh' | 'shin' | 'arm' | 'shoulder' | 'glute'> = {
  가슴: 'torso',
  등: 'torso',
  코어: 'torso',
  복근: 'torso',
  대퇴사두: 'thigh',
  햄스트링: 'thigh',
  둔근: 'glute',
  종아리: 'shin',
  이두: 'arm',
  삼두: 'arm',
  어깨: 'shoulder',
}

const P = ([x, y]: Vec) => `${x.toFixed(1)},${(-y).toFixed(1)}`

export default function MotionDemo({
  exerciseId,
  primary = [],
  secondary = [],
  compact = false,
}: {
  exerciseId: string
  primary?: Muscle[]
  secondary?: Muscle[]
  compact?: boolean
}) {
  const motion = MOTIONS[exerciseId]
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [slow, setSlow] = useState(false)
  const [use3D, setUse3D] = useState(hasWebGL)
  const gif = exerciseDbGif(exerciseId)
  // 일러스트(ExerciseDB GIF)가 있으면 기본으로 보여주고, 3D 모델은 단계 설명·관절 각도용
  const [mode, setMode] = useState<'gif' | 'model'>(gif ? 'gif' : 'model')
  const showGif = mode === 'gif' && !!gif
  const last = useRef<number | null>(null)
  const box = useMemo(() => (motion ? bounds(motion) : null), [motion])

  useEffect(() => {
    if (!playing || !motion || showGif) return
    let raf = 0
    const tick = (now: number) => {
      if (last.current !== null) {
        const dt = Math.min(now - last.current, 100)
        setT((x) => x + dt * (slow ? 0.4 : 1))
      }
      last.current = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      last.current = null
    }
  }, [playing, slow, motion, showGif])

  if (showGif) {
    return (
      <div className="motion">
        <div className="motion-gif">
          <img src={gif} alt="운동 동작 애니메이션" onError={() => setMode('model')} />
        </div>
        <div className="row between small muted" style={{ marginTop: 8 }}>
          <span>
            애니메이션:{' '}
            <a href="https://oss.exercisedb.dev" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
              ExerciseDB (AscendAPI)
            </a>
          </span>
          {motion && box && (
            <button className="btn sm" onClick={() => setMode('model')}>
              {compact ? '3D 모델' : '3D 모델·단계 설명'}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!motion || !box) return null

  const frame = sample(motion, t)
  const s = solve(frame.pose, motion.view)
  const hi = new Set(primary.map((m) => MUSCLE_PART[m]))
  const accent = frame.bad ? 'var(--bad)' : 'var(--accent)'
  const base = 'var(--fig)'
  const color = (part: string) => (hi.has(part as never) ? accent : base)
  const W = 7

  const seg = (a: Vec, b: Vec, c: string, w = W, op = 1) => (
    <line x1={a[0]} y1={-a[1]} x2={b[0]} y2={-b[1]} stroke={c} strokeWidth={w} strokeLinecap="round" opacity={op} />
  )
  const far = motion.view === 'side' ? 0.4 : 1
  const limbs = (n: 'N' | 'F', op: number) => (
    <g opacity={op}>
      {!motion.hideLegs && (
        <>
          {seg(s[`hip${n}`], s[`knee${n}`], color('thigh'))}
          {seg(s[`knee${n}`], s[`ankle${n}`], color('shin'))}
          {seg(s[`ankle${n}`], s[`toe${n}`], base, 5)}
        </>
      )}
      {seg(s[`shoulder${n}`], s[`elbow${n}`], color('arm'))}
      {seg(s[`elbow${n}`], s[`wrist${n}`], base, 6)}
      <circle cx={s[`wrist${n}`][0]} cy={-s[`wrist${n}`][1]} r={4} fill={base} />
    </g>
  )

  let metric: { at: Vec; joint: keyof Skeleton; deg: number } | null = null
  if (motion.metric) {
    const j = motion.metric.joint
    const deg =
      j === 'knee'
        ? jointAngle(s.hipN, s.kneeN, s.ankleN)
        : j === 'elbow'
          ? jointAngle(s.shoulderN, s.elbowN, s.wristN)
          : jointAngle(s.shoulderN, s.hipN, s.kneeN)
    const joint = j === 'knee' ? 'kneeN' : j === 'elbow' ? 'elbowN' : 'hipN'
    metric = { at: s[joint], joint, deg }
  }

  const caption = motion.frames[frame.index].caption

  return (
    <div className="motion" style={{ '--fig': '#cfd6e4' } as React.CSSProperties}>
      {use3D ? (
        <Suspense fallback={<div className="motion-3d motion-loading">3D 모델 불러오는 중…</div>}>
          <Motion3D
            motion={motion}
            box={box}
            skeleton={s}
            bad={frame.bad}
            spine={frame.pose.spine ?? 0}
            primary={primary}
            secondary={secondary}
            metric={metric ?? undefined}
            onError={() => setUse3D(false)}
          />
        </Suspense>
      ) : (
      <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="motion-svg" role="img" aria-label="운동 동작 시범">
        <line x1={box.x} x2={box.x + box.w} y1={0} y2={0} stroke="var(--line)" strokeWidth={2} />
        {motion.props?.(s).map((p, i) => <PropShape key={i} p={p} />)}
        {limbs('F', far)}
        {/* 몸통·머리 */}
        {motion.view === 'front' && seg(s.hipN, s.hipF, color('torso'))}
        {motion.view === 'front' && seg(s.shoulderN, s.shoulderF, color('torso'))}
        <Spine
          a={[(s.hipN[0] + s.hipF[0]) / 2, (s.hipN[1] + s.hipF[1]) / 2]}
          b={[(s.shoulderN[0] + s.shoulderF[0]) / 2, (s.shoulderN[1] + s.shoulderF[1]) / 2]}
          bulge={frame.pose.spine ?? 0}
          color={color('torso')}
          width={motion.view === 'front' ? 9 : 10}
        />
        {seg(
          [(s.shoulderN[0] + s.shoulderF[0]) / 2, (s.shoulderN[1] + s.shoulderF[1]) / 2],
          s.neck,
          base,
          5,
        )}
        <circle cx={s.head[0]} cy={-s.head[1]} r={9} fill="var(--surface)" stroke={base} strokeWidth={3} />
        {hi.has('glute') && <circle cx={s.hipN[0]} cy={-s.hipN[1]} r={7} fill={accent} />}
        {hi.has('shoulder') && <circle cx={s.shoulderN[0]} cy={-s.shoulderN[1]} r={6.5} fill={accent} />}
        {limbs('N', 1)}
        {metric && (
          <g>
            <circle cx={metric.at[0]} cy={-metric.at[1]} r={4} fill="var(--warn)" />
            <text
              x={metric.at[0] + 8}
              y={-metric.at[1] - 8}
              fontSize={11}
              fontWeight={700}
              fill="var(--warn)"
              stroke="var(--surface)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {Math.round(metric.deg)}°
            </text>
          </g>
        )}
      </svg>
      )}
      <div className={`motion-caption ${frame.bad ? 'bad' : ''}`}>
        <span className="step">
          {frame.index + 1}/{motion.frames.length}
        </span>
        {caption}
      </div>
      {compact && gif && (
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn sm" onClick={() => setMode('gif')}>
            일러스트로 보기
          </button>
        </div>
      )}
      {!compact && (
        <div className="row between small muted" style={{ marginTop: 8 }}>
          <span>
            {motion.viewLabel ?? (motion.view === 'side' ? '옆에서 본 모습' : '정면')}
            {motion.metric && <> · <span style={{ color: 'var(--warn)' }}>●</span> {motion.metric.label} 각도</>}
            {primary.length > 0 && <> · <span className="accent">■</span> 주동근</>}
            {use3D && secondary.length > 0 && <> · <span style={{ color: '#8fe3d2' }}>■</span> 보조근</>}
          </span>
          <span className="row">
            {gif && (
              <button className="btn sm" onClick={() => setMode('gif')}>
                일러스트
              </button>
            )}
            <button className="btn sm" onClick={() => setSlow((v) => !v)}>
              {slow ? '🐢 0.4x' : '1x'}
            </button>
            <button className="btn sm" onClick={() => setPlaying((v) => !v)}>
              {playing ? '❚❚' : '▶'}
            </button>
          </span>
        </div>
      )}
    </div>
  )
}

/** 몸통: bulge > 0 이면 등 쪽으로 휜 곡선 */
function Spine({ a, b, bulge, color, width }: { a: Vec; b: Vec; bulge: number; color: string; width: number }) {
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
  // 진행 방향(a→b)의 왼쪽 = 얼굴 반대편(등)
  const cx = mx - ((b[1] - a[1]) / len) * bulge * 2
  const cy = my + ((b[0] - a[0]) / len) * bulge * 2
  return (
    <path
      d={`M${P(a)} Q${P([cx, cy])} ${P(b)}`}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
    />
  )
}

function PropShape({ p }: { p: Prop }) {
  const c = 'var(--muted)'
  if (p.kind === 'circle')
    return <circle cx={p.c[0]} cy={-p.c[1]} r={p.r} fill={p.fill ? c : 'none'} stroke={c} strokeWidth={3} />
  if (p.kind === 'line') return <polyline points={`${P(p.a)} ${P(p.b)}`} stroke={c} strokeWidth={p.w ?? 2} />
  return <rect x={p.x} y={-(p.y + p.h)} width={p.w} height={p.h} rx={2} fill="var(--surface-2)" stroke={c} strokeWidth={1.5} />
}
