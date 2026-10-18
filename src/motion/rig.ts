/**
 * 2D 인체 리그. 좌표계: 지면 y=0, 위쪽이 +y, 앞쪽(얼굴 방향)이 +x.
 * 각도는 "위쪽 수직에서 시계 방향(+x 쪽)으로" 잰 값(도).
 */
export type Vec = [number, number]

export const LEN = {
  torso: 52,
  thigh: 44,
  shin: 42,
  upperArm: 30,
  foreArm: 28,
  neck: 7,
  head: 9,
  foot: 13,
  shoulderHalf: 13, // 정면 뷰에서 어깨 반폭
  hipHalf: 8, // 정면 뷰에서 골반 반폭
}

/** IK: 끝점(target)을 향해 관절을 굽힘. bend 1 = 반시계, -1 = 시계 방향으로 꺾임 */
export type IKLimb = { target: Vec; bend: 1 | -1; foot?: number }
/** FK: 위팔/허벅지(a1), 아래팔/정강이(a2)의 절대 각도 */
export type FKLimb = { a1: number; a2: number; foot?: number }
export type Limb = IKLimb | FKLimb

export type Pose = {
  hip: Vec
  torso: number
  head?: number
  /** 등이 둥글게 말린 정도 (잘못된 자세 표시용) */
  spine?: number
  armN: Limb
  armF: Limb
  legN: Limb
  legF: Limb
}

export type Skeleton = {
  hipN: Vec
  hipF: Vec
  shoulderN: Vec
  shoulderF: Vec
  neck: Vec
  head: Vec
  elbowN: Vec
  wristN: Vec
  elbowF: Vec
  wristF: Vec
  kneeN: Vec
  ankleN: Vec
  toeN: Vec
  kneeF: Vec
  ankleF: Vec
  toeF: Vec
}

const rad = (d: number) => (d * Math.PI) / 180
export const dir = (deg: number): Vec => [Math.sin(rad(deg)), Math.cos(rad(deg))]
const add = (a: Vec, b: Vec, s = 1): Vec => [a[0] + b[0] * s, a[1] + b[1] * s]

function ik(root: Vec, target: Vec, l1: number, l2: number, bend: 1 | -1): [Vec, Vec] {
  const dx = target[0] - root[0]
  const dy = target[1] - root[1]
  const dist = Math.hypot(dx, dy) || 1e-6
  const d = Math.min(Math.max(dist, Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3)
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
  const a = Math.acos(Math.max(-1, Math.min(1, cosA))) * bend
  const ux = dx / dist
  const uy = dy / dist
  // (ux,uy)를 a만큼 반시계 회전
  const joint: Vec = [root[0] + l1 * (ux * Math.cos(a) - uy * Math.sin(a)), root[1] + l1 * (ux * Math.sin(a) + uy * Math.cos(a))]
  const jx = target[0] - joint[0]
  const jy = target[1] - joint[1]
  const jl = Math.hypot(jx, jy) || 1e-6
  return [joint, [joint[0] + (jx / jl) * l2, joint[1] + (jy / jl) * l2]]
}

function limb(root: Vec, l: Limb, l1: number, l2: number): [Vec, Vec] {
  if ('target' in l) return ik(root, l.target, l1, l2, l.bend)
  const mid = add(root, dir(l.a1), l1)
  return [mid, add(mid, dir(l.a2), l2)]
}

export function solve(p: Pose, view: 'side' | 'front'): Skeleton {
  const up = dir(p.torso)
  const shoulderC = add(p.hip, up, LEN.torso)
  // 정면 뷰: 좌우로 벌림. N = 화면 오른쪽(+x)
  const side: Vec = [up[1], -up[0]]
  const sw = view === 'front' ? LEN.shoulderHalf : 0
  const hw = view === 'front' ? LEN.hipHalf : 0
  const shoulderN = add(shoulderC, side, sw)
  const shoulderF = add(shoulderC, side, -sw)
  const hipN = add(p.hip, side, hw)
  const hipF = add(p.hip, side, -hw)
  const neck = add(shoulderC, up, LEN.neck)
  const head = add(neck, dir(p.torso + (p.head ?? 0)), LEN.head)
  const [elbowN, wristN] = limb(shoulderN, p.armN, LEN.upperArm, LEN.foreArm)
  const [elbowF, wristF] = limb(shoulderF, p.armF, LEN.upperArm, LEN.foreArm)
  const [kneeN, ankleN] = limb(hipN, p.legN, LEN.thigh, LEN.shin)
  const [kneeF, ankleF] = limb(hipF, p.legF, LEN.thigh, LEN.shin)
  const defFoot = view === 'front' ? [150, 210] : [100, 100]
  const toeN = add(ankleN, dir(p.legN.foot ?? defFoot[0]), view === 'front' ? 7 : LEN.foot)
  const toeF = add(ankleF, dir(p.legF.foot ?? defFoot[1]), view === 'front' ? 7 : LEN.foot)
  return { hipN, hipF, shoulderN, shoulderF, neck, head, elbowN, wristN, elbowF, wristF, kneeN, ankleN, toeN, kneeF, ankleF, toeF }
}

/** 숫자로 이루어진 같은 모양의 객체/배열을 보간 */
export function lerpDeep<T>(a: T, b: T, t: number): T {
  if (typeof a === 'number' && typeof b === 'number') return (a + (b - a) * t) as T
  if (Array.isArray(a)) return a.map((v, i) => lerpDeep(v, (b as unknown[])[i], t)) as T
  if (a && typeof a === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(a)) {
      const av = (a as Record<string, unknown>)[k]
      const bv = (b as Record<string, unknown>)[k]
      out[k] = bv === undefined ? av : lerpDeep(av, bv, t)
    }
    return out as T
  }
  return a
}

/** b를 꼭짓점으로 하는 각도 */
export function jointAngle(a: Vec, b: Vec, c: Vec): number {
  const v1 = [a[0] - b[0], a[1] - b[1]]
  const v2 = [c[0] - b[0], c[1] - b[1]]
  const m = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]) || 1
  return (Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / m))) * 180) / Math.PI
}
