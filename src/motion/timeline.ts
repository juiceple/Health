import type { Motion } from './motions'
import { lerpDeep, solve, type Pose, type Vec } from './rig'

const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2

export type Frame = { pose: Pose; index: number; bad: boolean }

/** 시간(ms) → 현재 보간된 자세와 캡션 인덱스 */
export function sample(m: Motion, t: number): Frame {
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

/** 한 사이클 동안 몸과 기구가 차지하는 2D 영역 (SVG viewBox / 3D 카메라 프레이밍용) */
export function bounds(m: Motion) {
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
  return { x: cx - w / 2, y: -(minY - pad + h), w, h, minX, maxX, minY, maxY }
}
