import { useEffect, useMemo, useRef, useState } from 'react'
import type { Muscle } from '../data/exercises'
import { MOTIONS, type Motion, type Prop } from '../motion/motions'
import { jointAngle, lerpDeep, solve, type Pose, type Vec } from '../motion/rig'

const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2

type Frame = { pose: Pose; index: number; bad: boolean }

/** 시간(ms) → 현재 보간된 자세와 캡션 인덱스 */
function sample(m: Motion, t: number): Frame {
  const fs = m.frames
  const total = fs.reduce((s, f) => s + (f.move ?? 800) + (f.hold ?? 300), 0)
  let rem = t % total
  for (let i = 0; i < fs.length; i++) {
    const move = fs[i].move ?? 800
    const hold = fs[i].hold ?? 300
    const prev = fs[(i - 1 + fs.length) % fs.length]
    if (rem < move) return { pose: lerpDeep(prev.pose, fs[i].pose, ease(rem / move)), index: i, bad: !!fs[i].bad }
    rem -= move
    if (rem < hold) return { pose: fs[i].pose, index: i, bad: !!fs[i].bad }
    rem -= hold
  }
  return { pose: fs[0].pose, index: 0, bad: false }
}

function bounds(m: Motion) {
  let minX = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let minY = 0
  const eat = ([x, y]: Vec, r = 0) => {
    minX = Math.min(minX, x - r)
    maxX = Math.max(maxX, x + r)
    maxY = Math.max(maxY, y + r)
    minY = Math.min(minY, y - r)
  }
  for (let t = 0; t < 12000; t += 120) {
    const s = solve(sample(m, t).pose, m.view)
    Object.values(s).forEach((p) => eat(p, 10))
    m.props?.(s).forEach((p) => {
      if (p.kind === 'circle') eat(p.c, p.r)
      else if (p.kind === 'line') {
        eat(p.a)
        eat([p.b[0], Math.min(p.b[1], maxY + 10)])
      } else {
        eat([p.x, p.y])
        eat([p.x + p.w, p.y + p.h])
      }
    })
  }
  const pad = 16
  // 화면 비율이 너무 납작/길쭉하지 않게
  let w = maxX - minX + pad * 2
  let h = maxY - minY + pad * 2
  const cx = (minX + maxX) / 2
  if (w < h * 0.8) w = h * 0.8
  if (h < w * 0.62) h = w * 0.62
  return { x: cx - w / 2, y: -(minY - pad + h), w, h }
}

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
  compact = false,
}: {
  exerciseId: string
  primary?: Muscle[]
  compact?: boolean
}) {
  const motion = MOTIONS[exerciseId]
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [slow, setSlow] = useState(false)
  const last = useRef<number | null>(null)
  const box = useMemo(() => (motion ? bounds(motion) : null), [motion])

  useEffect(() => {
    if (!playing || !motion) return
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
  }, [playing, slow, motion])

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

  let metric: { at: Vec; deg: number } | null = null
  if (motion.metric) {
    const j = motion.metric.joint
    const deg =
      j === 'knee'
        ? jointAngle(s.hipN, s.kneeN, s.ankleN)
        : j === 'elbow'
          ? jointAngle(s.shoulderN, s.elbowN, s.wristN)
          : jointAngle(s.shoulderN, s.hipN, s.kneeN)
    metric = { at: j === 'knee' ? s.kneeN : j === 'elbow' ? s.elbowN : s.hipN, deg }
  }

  const caption = motion.frames[frame.index].caption

  return (
    <div className="motion" style={{ '--fig': '#cfd6e4' } as React.CSSProperties}>
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
      <div className={`motion-caption ${frame.bad ? 'bad' : ''}`}>
        <span className="step">
          {frame.index + 1}/{motion.frames.length}
        </span>
        {caption}
      </div>
      {!compact && (
        <div className="row between small muted" style={{ marginTop: 8 }}>
          <span>
            {motion.viewLabel ?? (motion.view === 'side' ? '옆에서 본 모습' : '정면')}
            {motion.metric && <> · <span style={{ color: 'var(--warn)' }}>●</span> {motion.metric.label} 각도</>}
            {primary.length > 0 && <> · <span className="accent">■</span> 주동근</>}
          </span>
          <span className="row">
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
