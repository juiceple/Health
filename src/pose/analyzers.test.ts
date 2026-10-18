import { describe, expect, it } from 'vitest'
import { angle, createAnalyzer, LM, type Landmark } from './analyzers'

const pt = (x: number, y: number): Landmark => ({ x, y, visibility: 0.99 })

/** 33개 랜드마크 중 필요한 것만 채운 프레임 */
function frame(points: Partial<Record<number, Landmark>>): Landmark[] {
  return Array.from({ length: 33 }, (_, i) => points[i] ?? { x: 0, y: 0, visibility: 0 })
}

/** 옆에서 본 스쿼트: 무릎 각도(°)를 받아 왼쪽 다리 프레임 생성 */
function squatFrame(kneeDeg: number, torsoLean = 10): Landmark[] {
  const knee = { x: 0.5, y: 0.7 }
  const ankle = pt(0.5, 0.9) // 정강이 수직
  const t = ((180 - kneeDeg) * Math.PI) / 180
  // 무릎에서 위쪽(-y)으로 0.2 길이, 각도만큼 뒤로(-x) 회전
  const hip = pt(knee.x - 0.2 * Math.sin(t), knee.y - 0.2 * Math.cos(t))
  const l = (torsoLean * Math.PI) / 180
  const sh = pt(hip.x + 0.25 * Math.sin(l), hip.y - 0.25 * Math.cos(l))
  return frame({
    [LM.lShoulder]: sh,
    [LM.lHip]: hip,
    [LM.lKnee]: pt(knee.x, knee.y),
    [LM.lAnkle]: ankle,
  })
}

describe('angle', () => {
  it('computes right and straight angles', () => {
    expect(angle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90)
    expect(angle({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180)
  })
})

describe('squat analyzer', () => {
  it('counts a full rep and grades it good', () => {
    const a = createAnalyzer('squat')
    let r = a(squatFrame(175), 1, 0)
    for (const deg of [150, 120, 95, 85, 95, 130, 165, 175]) r = a(squatFrame(deg), 1, deg)
    expect(r.reps).toBe(1)
    expect(r.goodReps).toBe(1)
    expect(r.lastRep?.good).toBe(true)
  })

  it('does not count a shallow rep and asks to go deeper', () => {
    const a = createAnalyzer('squat')
    let r = a(squatFrame(175), 1, 0)
    for (const deg of [150, 125, 120, 135, 170]) r = a(squatFrame(deg), 1, deg)
    expect(r.reps).toBe(0)
    expect(r.lastRep?.message).toContain('깊게')
  })

  it('flags excessive forward lean', () => {
    const a = createAnalyzer('squat')
    let r = a(squatFrame(175, 10), 1, 0)
    for (const deg of [150, 110, 90, 110, 170]) r = a(squatFrame(deg, 65), 1, deg)
    expect(r.reps).toBe(1)
    expect(r.goodReps).toBe(0)
    expect(r.lastRep?.message).toContain('상체')
  })

  it('reports not visible when landmarks are missing', () => {
    const a = createAnalyzer('squat')
    expect(a(frame({}), 1, 0).visible).toBe(false)
  })
})
