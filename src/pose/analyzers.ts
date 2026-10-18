import type { CoachKind } from '../data/exercises'

/** MediaPipe NormalizedLandmark 와 같은 형태 (x,y는 0~1 정규화 좌표) */
export type Landmark = { x: number; y: number; z?: number; visibility?: number }

// MediaPipe Pose 랜드마크 인덱스
export const LM = {
  nose: 0,
  lShoulder: 11,
  rShoulder: 12,
  lElbow: 13,
  rElbow: 14,
  lWrist: 15,
  rWrist: 16,
  lHip: 23,
  rHip: 24,
  lKnee: 25,
  rKnee: 26,
  lAnkle: 27,
  rAnkle: 28,
} as const

type Pt = { x: number; y: number }

/** b를 꼭짓점으로 하는 a-b-c 각도 (0~180°) */
export function angle(a: Pt, b: Pt, c: Pt): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y }
  const v2 = { x: c.x - b.x, y: c.y - b.y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)
  if (mag === 0) return 0
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI
}

/** a→b 선분이 수직선에서 기울어진 각도 (0 = 수직) */
export function tiltFromVertical(a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI
}

export type FrameResult = {
  /** 필요한 관절이 다 보이는지 */
  visible: boolean
  reps: number
  goodReps: number
  /** 메인 관절 각도 (화면 표시용) */
  angle: number
  /** 'down' = 반복 동작 진행 중, 'up' = 시작 자세 */
  phase: 'up' | 'down'
  /** 현재 프레임의 자세 경고 */
  live: string[]
  /** 직전 반복에 대한 평가 (반복이 끝날 때 갱신) */
  lastRep?: { good: boolean; message: string; at: number }
}

/**
 * 공통 반복 카운터.
 * 각도가 top 이상(시작 자세) → bottom 이하(최저점) → 다시 top 이상이면 1회.
 * partial 이하로는 내려갔지만 bottom에 못 미치고 돌아오면 "가동범위 부족".
 */
class RepMachine {
  phase: 'up' | 'down' = 'up'
  reps = 0
  goodReps = 0
  private minAngle = 180
  private started = false
  private hitBottom = false
  private issues = new Set<string>()
  lastRep?: FrameResult['lastRep']

  constructor(
    private top: number,
    private bottom: number,
    private partial: number,
    private shallowMsg: string,
  ) {}

  update(a: number, issuesNow: string[], now: number) {
    if (this.phase === 'up') {
      if (a < this.partial) {
        this.phase = 'down'
        this.started = true
        this.hitBottom = false
        this.minAngle = a
        this.issues.clear()
      }
    }
    if (this.phase === 'down') {
      this.minAngle = Math.min(this.minAngle, a)
      if (a <= this.bottom) this.hitBottom = true
      issuesNow.forEach((i) => this.issues.add(i))
      if (a >= this.top && this.started) {
        this.phase = 'up'
        this.started = false
        if (this.hitBottom) {
          this.reps++
          const good = this.issues.size === 0
          if (good) this.goodReps++
          this.lastRep = {
            good,
            message: good ? '좋아요! 완벽한 자세' : [...this.issues][0],
            at: now,
          }
        } else {
          this.lastRep = { good: false, message: this.shallowMsg, at: now }
        }
      }
    }
  }
}

type Analyzer = (lm: Landmark[], aspect: number, now: number) => FrameResult

const VIS = 0.5

function pickSide(lm: Landmark[], left: number[], right: number[]): number[] | null {
  const score = (ids: number[]) => Math.min(...ids.map((i) => lm[i]?.visibility ?? 0))
  const l = score(left)
  const r = score(right)
  if (Math.max(l, r) < VIS) return null
  return l >= r ? left : right
}

function makeAnalyzer(
  sides: { left: number[]; right: number[] },
  machine: RepMachine,
  measure: (p: Pt[], all: (i: number) => Pt) => { angle: number; issues: string[] },
): Analyzer {
  return (lm, aspect, now) => {
    // x에 화면 비율을 곱해 실제 비율로 각도 계산
    const P = (i: number): Pt => ({ x: lm[i].x * aspect, y: lm[i].y })
    const side = pickSide(lm, sides.left, sides.right)
    if (!side) {
      return {
        visible: false,
        reps: machine.reps,
        goodReps: machine.goodReps,
        angle: 0,
        phase: machine.phase,
        live: [],
        lastRep: machine.lastRep,
      }
    }
    const { angle: a, issues } = measure(side.map(P), P)
    machine.update(a, issues, now)
    return {
      visible: true,
      reps: machine.reps,
      goodReps: machine.goodReps,
      angle: Math.round(a),
      phase: machine.phase,
      live: machine.phase === 'down' ? issues : [],
      lastRep: machine.lastRep,
    }
  }
}

function squat(): Analyzer {
  return makeAnalyzer(
    {
      left: [LM.lShoulder, LM.lHip, LM.lKnee, LM.lAnkle],
      right: [LM.rShoulder, LM.rHip, LM.rKnee, LM.rAnkle],
    },
    new RepMachine(160, 100, 140, '더 깊게 앉아주세요 (허벅지가 바닥과 평행하게)'),
    ([sh, hip, knee, ankle]) => {
      const knee_ = angle(hip, knee, ankle)
      const issues: string[] = []
      if (knee_ < 120 && tiltFromVertical(hip, sh) > 50) issues.push('상체가 너무 숙여졌어요. 가슴을 펴세요')
      if (knee_ < 120 && tiltFromVertical(ankle, knee) > 40) issues.push('무릎이 너무 앞으로 나가요. 엉덩이를 뒤로 빼세요')
      return { angle: knee_, issues }
    },
  )
}

function lunge(): Analyzer {
  // 앞다리 = 무릎 각도가 더 작은 쪽
  const machine = new RepMachine(155, 105, 140, '더 깊게 내려가세요 (양 무릎 90°)')
  return (lm, aspect, now) => {
    const P = (i: number): Pt => ({ x: lm[i].x * aspect, y: lm[i].y })
    const need = [LM.lHip, LM.rHip, LM.lKnee, LM.rKnee, LM.lAnkle, LM.rAnkle, LM.lShoulder, LM.rShoulder]
    if (need.some((i) => (lm[i]?.visibility ?? 0) < VIS)) {
      return { visible: false, reps: machine.reps, goodReps: machine.goodReps, angle: 0, phase: machine.phase, live: [], lastRep: machine.lastRep }
    }
    const l = angle(P(LM.lHip), P(LM.lKnee), P(LM.lAnkle))
    const r = angle(P(LM.rHip), P(LM.rKnee), P(LM.rAnkle))
    const a = Math.min(l, r)
    const mid = (i: number, j: number) => ({ x: (P(i).x + P(j).x) / 2, y: (P(i).y + P(j).y) / 2 })
    const issues: string[] = []
    if (a < 130 && tiltFromVertical(mid(LM.lHip, LM.rHip), mid(LM.lShoulder, LM.rShoulder)) > 25)
      issues.push('상체를 곧게 세우세요')
    machine.update(a, issues, now)
    return {
      visible: true,
      reps: machine.reps,
      goodReps: machine.goodReps,
      angle: Math.round(a),
      phase: machine.phase,
      live: machine.phase === 'down' ? issues : [],
      lastRep: machine.lastRep,
    }
  }
}

function pushup(): Analyzer {
  return makeAnalyzer(
    {
      left: [LM.lShoulder, LM.lElbow, LM.lWrist, LM.lHip, LM.lAnkle],
      right: [LM.rShoulder, LM.rElbow, LM.rWrist, LM.rHip, LM.rAnkle],
    },
    new RepMachine(155, 95, 130, '가슴을 바닥 가까이까지 내려주세요'),
    ([sh, el, wr, hip, ankle]) => {
      const elbow = angle(sh, el, wr)
      const body = angle(sh, hip, ankle)
      const issues: string[] = []
      if (body < 155) {
        // 엉덩이가 어깨-발목 선보다 아래(y가 큼)면 처짐
        const t = (hip.x - sh.x) / (ankle.x - sh.x || 1e-6)
        const lineY = sh.y + t * (ankle.y - sh.y)
        issues.push(hip.y > lineY ? '엉덩이가 처졌어요. 복근에 힘!' : '엉덩이가 너무 높아요. 몸을 일직선으로')
      }
      return { angle: elbow, issues }
    },
  )
}

function curl(): Analyzer {
  return makeAnalyzer(
    {
      left: [LM.lShoulder, LM.lElbow, LM.lWrist, LM.lHip],
      right: [LM.rShoulder, LM.rElbow, LM.rWrist, LM.rHip],
    },
    new RepMachine(145, 55, 110, '끝까지 감아올리세요'),
    ([sh, el, wr, hip]) => {
      const elbow = angle(sh, el, wr)
      const issues: string[] = []
      // 위팔과 몸통 사이 각도: 팔꿈치가 앞으로 나가면 커짐
      if (angle(hip, sh, el) > 35) issues.push('팔꿈치를 옆구리에 고정하세요')
      if (tiltFromVertical(hip, sh) > 15) issues.push('상체 반동을 쓰지 마세요')
      return { angle: elbow, issues }
    },
  )
}

function press(): Analyzer {
  // 정면 촬영, 양팔 평균. 팔을 다 편 상태(높은 각도)가 top.
  // 시작 자세가 팔꿈치를 굽힌 상태이므로 180 - 각도로 뒤집어 RepMachine 재사용
  // (팔꿈치 ≤90° 시작 → ≥155° 완전히 폄 → 다시 ≤90° 이면 1회)
  const machine = new RepMachine(90, 25, 60, '팔을 끝까지 밀어 올리세요')
  return (lm, aspect, now) => {
    const P = (i: number): Pt => ({ x: lm[i].x * aspect, y: lm[i].y })
    const need = [LM.lShoulder, LM.rShoulder, LM.lElbow, LM.rElbow, LM.lWrist, LM.rWrist]
    if (need.some((i) => (lm[i]?.visibility ?? 0) < VIS)) {
      return { visible: false, reps: machine.reps, goodReps: machine.goodReps, angle: 0, phase: machine.phase, live: [], lastRep: machine.lastRep }
    }
    const l = angle(P(LM.lShoulder), P(LM.lElbow), P(LM.lWrist))
    const r = angle(P(LM.rShoulder), P(LM.rElbow), P(LM.rWrist))
    const avg = (l + r) / 2
    const issues: string[] = []
    const shoulderW = Math.abs(P(LM.lShoulder).x - P(LM.rShoulder).x) || 0.1
    if (Math.abs(P(LM.lWrist).y - P(LM.rWrist).y) > shoulderW * 0.35) issues.push('양팔 높이를 맞춰주세요')
    machine.update(180 - avg, issues, now)
    return {
      visible: true,
      reps: machine.reps,
      goodReps: machine.goodReps,
      angle: Math.round(avg),
      phase: machine.phase,
      live: machine.phase === 'down' ? issues : [],
      lastRep: machine.lastRep,
    }
  }
}

export function createAnalyzer(kind: CoachKind): Analyzer {
  switch (kind) {
    case 'squat':
      return squat()
    case 'lunge':
      return lunge()
    case 'pushup':
      return pushup()
    case 'curl':
      return curl()
    case 'press':
      return press()
  }
}
