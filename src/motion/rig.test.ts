import { describe, expect, it } from 'vitest'
import { MOTIONS } from './motions'
import { jointAngle, LEN, solve } from './rig'

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1])

describe('rig', () => {
  it('IK keeps bone lengths and reaches a reachable target', () => {
    const s = solve(
      { hip: [-24, 47], torso: 38, armN: { a1: 180, a2: 180 }, armF: { a1: 180, a2: 180 }, legN: { target: [0, 4], bend: 1 }, legF: { target: [0, 4], bend: 1 } },
      'side',
    )
    expect(dist(s.hipN, s.kneeN)).toBeCloseTo(LEN.thigh)
    expect(dist(s.kneeN, s.ankleN)).toBeCloseTo(LEN.shin)
    expect(dist(s.ankleN, [0, 4])).toBeLessThan(0.01)
    // 스쿼트에서 무릎은 앞(+x)으로
    expect(s.kneeN[0]).toBeGreaterThan(s.hipN[0])
    expect(jointAngle(s.hipN, s.kneeN, s.ankleN)).toBeLessThan(90)
  })

  it('every motion keyframe solves to finite coordinates', () => {
    for (const [id, m] of Object.entries(MOTIONS)) {
      for (const f of m.frames) {
        const s = solve(f.pose, m.view)
        for (const [k, v] of Object.entries(s)) {
          expect(Number.isFinite(v[0]) && Number.isFinite(v[1]), `${id}.${k}`).toBe(true)
        }
      }
    }
  })

  it('never pushes the body through the floor', () => {
    for (const [id, m] of Object.entries(MOTIONS)) {
      m.frames.forEach((f, i) => {
        const s = solve(f.pose, m.view)
        expect(s.head[1] - LEN.head, `${id} frame ${i} head`).toBeGreaterThan(-1)
      })
    }
  })
})
