import { dir, LEN, type Limb, type Pose, type Skeleton, type Vec } from './rig'

/**
 * 3D 렌더링 시 기구를 어떻게 입체화할지 힌트.
 * - barbell: 바가 좌우(깊이)로 뻗은 바벨, dumbbells: 양손 덤벨, dumbbell: 가까운 손 하나,
 *   dumbbell-center: 몸 중앙에서 양손으로 든 덤벨, bar: 좌우로 뻗은 손잡이 봉, skip: 3D에서 생략
 * 지정이 없으면 모양(두께·크기)으로 추정 (벤치/패드/프레임/케이블)
 */
export type PropRole = 'barbell' | 'dumbbells' | 'dumbbell' | 'dumbbell-center' | 'bar' | 'skip'

export type Prop = (
  | { kind: 'circle'; c: Vec; r: number; fill?: boolean }
  | { kind: 'line'; a: Vec; b: Vec; w?: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
) & { role?: PropRole }

export type Keyframe = {
  pose: Pose
  caption: string
  /** 이 자세로 이동하는 시간(ms) */
  move?: number
  /** 이 자세에서 머무는 시간(ms) */
  hold?: number
  /** 잘못된 자세 예시 */
  bad?: boolean
}

export type Motion = {
  view: 'side' | 'front'
  viewLabel?: string
  frames: Keyframe[]
  props?: (s: Skeleton) => Prop[]
  hideLegs?: boolean
  /** 등을 대고 누운 자세 (몸통 각도만으로는 엎드림과 구분되지 않음) */
  supine?: boolean
  /** 화면에 실시간으로 표시할 관절 각도 */
  metric?: { joint: 'knee' | 'elbow' | 'hip'; label: string }
}

// ── 헬퍼 ──────────────────────────────────────────
const plant = (x: number, y = 4, bend: 1 | -1 = 1, foot?: number): Limb => ({ target: [x, y], bend, foot })
const fk = (a1: number, a2: number = a1): Limb => ({ a1, a2 })
const shoulderOf = (hip: Vec, torso: number): Vec => {
  const d = dir(torso)
  return [hip[0] + d[0] * LEN.torso, hip[1] + d[1] * LEN.torso]
}
/** 어깨 기준 상대 위치를 IK 목표로 */
const fromShoulder = (hip: Vec, torso: number, dx: number, dy: number, bend: 1 | -1 = -1): Limb => {
  const s = shoulderOf(hip, torso)
  return { target: [s[0] + dx, s[1] + dy], bend }
}
const STAND: Vec = [0, 89]
const both = (l: Limb) => ({ armN: l, armF: l })
const legs = (l: Limb) => ({ legN: l, legF: l })

const plate = (at: Vec, r = 15): Prop[] => [
  { kind: 'circle', c: at, r, role: 'barbell' },
  { kind: 'circle', c: at, r: 2.5, fill: true, role: 'skip' },
]
const dumbbell = (at: Vec, role: PropRole = 'dumbbells'): Prop[] => [
  { kind: 'rect', x: at[0] - 7, y: at[1] - 3.5, w: 14, h: 7, role },
]

// ── 운동별 모션 ────────────────────────────────────
function squat(kind: 'bodyweight' | 'barbell' | 'goblet'): Motion {
  const barbell = kind === 'barbell'
  const arms = (hip: Vec, torso: number) =>
    barbell
      ? both(fromShoulder(hip, torso, -6, 4, 1))
      : kind === 'goblet'
        ? both(fromShoulder(hip, torso, 12, -16, -1))
        : both(fromShoulder(hip, torso, 54, -8 + torso * 0.2, -1))
  const top = { hip: STAND, torso: 0 }
  const mid = { hip: [-12, 70] as Vec, torso: 22 }
  const bottom = { hip: [-24, 47] as Vec, torso: 38 }
  const bad = { hip: [-22, 48] as Vec, torso: 62 }
  const P = (h: { hip: Vec; torso: number }): Pose => ({ ...h, ...arms(h.hip, h.torso), ...legs(plant(0)) })
  return {
    view: 'side',
    metric: { joint: 'knee', label: '무릎' },
    props: barbell
      ? (s) => plate([s.shoulderN[0] - 9, s.shoulderN[1] + 2], 12)
      : kind === 'goblet'
        ? (s) => [{ kind: 'rect', x: s.wristN[0] - 4, y: s.wristN[1] - 2, w: 8, h: 16, role: 'dumbbell-center' }]
        : undefined,
    frames: [
      { pose: P(top), caption: '발은 어깨너비, 복압을 잡고 준비', hold: 700, move: 700 },
      { pose: P(mid), caption: '엉덩이를 뒤로 빼며 앉기 시작', move: 900 },
      { pose: P(bottom), caption: '허벅지가 바닥과 평행할 때까지', hold: 500, move: 600 },
      { pose: P(top), caption: '발바닥 전체로 밀며 일어나기', hold: 600, move: 900 },
      { pose: P(bad), caption: '❌ 상체가 과하게 숙여짐 — 가슴을 펴세요', bad: true, hold: 1400, move: 900 },
      { pose: P(top), caption: '다시 시작 자세', hold: 400, move: 900 },
    ],
  }
}

function lunge(bulgarian = false): Motion {
  const P = (hipY: number, torso = 0): Pose => ({
    hip: [0, hipY],
    torso,
    ...both(fk(180, 180)),
    legN: plant(bulgarian ? 30 : 32, 4, 1),
    legF: bulgarian ? { target: [-42, 30], bend: 1, foot: 190 } : { target: [-34, 9], bend: 1, foot: 140 },
  })
  return {
    view: 'side',
    metric: { joint: 'knee', label: '앞 무릎' },
    props: bulgarian ? (s) => [...dumbbell(s.wristN), { kind: 'rect', x: -66, y: 0, w: 30, h: 26 }] : undefined,
    frames: [
      { pose: P(82), caption: '다리를 앞뒤로 크게 벌린 스플릿 자세', hold: 600, move: 700 },
      { pose: P(48), caption: '양 무릎이 90°가 되도록 수직으로 내려가기', hold: 500, move: 1000 },
      { pose: P(82), caption: '앞발 뒤꿈치로 밀며 올라오기', hold: 500, move: 900 },
      { pose: P(50, 28), caption: '❌ 상체가 앞으로 쏠림 — 몸통을 세우세요', bad: true, hold: 1400, move: 1000 },
      { pose: P(82), caption: '다시 시작 자세', hold: 400, move: 900 },
    ],
  }
}

function deadlift(): Motion {
  const bottom: Pose = { hip: [-34, 60], torso: 60, spine: 0, ...both(fk(180)), ...legs(plant(0)) }
  const mid: Pose = { hip: [-24, 76], torso: 38, spine: 0, ...both(fk(180)), ...legs(plant(0)) }
  const top: Pose = { hip: [0, 88], torso: -2, spine: 0, ...both(fk(182, 180)), ...legs(plant(0)) }
  const round: Pose = { hip: [-30, 62], torso: 74, head: 30, spine: 9, ...both(fk(185)), ...legs(plant(0)) }
  return {
    view: 'side',
    metric: { joint: 'hip', label: '고관절' },
    props: (s) => plate(s.wristN, 18),
    frames: [
      { pose: bottom, caption: '바는 발 중앙 위, 등은 곧게, 정강이에 바 붙이기', hold: 700, move: 800 },
      { pose: mid, caption: '바닥을 밀어내며 바를 몸에 붙여 올리기', move: 700 },
      { pose: top, caption: '엉덩이를 앞으로 밀어 마무리 (과신전 X)', hold: 600, move: 700 },
      { pose: bottom, caption: '엉덩이를 먼저 뒤로 빼며 같은 경로로 내리기', hold: 500, move: 1100 },
      { pose: round, caption: '❌ 허리가 둥글게 말림 — 부상 위험!', bad: true, hold: 1500, move: 700 },
      { pose: bottom, caption: '등을 펴고 다시 시작', hold: 400, move: 700 },
    ],
  }
}

function rdl(): Motion {
  const top: Pose = { hip: [0, 87], torso: 0, ...both(fk(180)), ...legs(plant(0)) }
  const bottom: Pose = { hip: [-20, 82], torso: 72, ...both(fk(180)), ...legs(plant(0)) }
  return {
    view: 'side',
    metric: { joint: 'hip', label: '고관절' },
    props: (s) => plate(s.wristN, 16),
    frames: [
      { pose: top, caption: '무릎을 살짝 굽히고 바를 허벅지 앞에', hold: 600, move: 700 },
      { pose: bottom, caption: '엉덩이를 뒤로 밀며 바를 정강이까지 — 햄스트링 스트레칭', hold: 600, move: 1300 },
      { pose: top, caption: '엉덩이를 앞으로 밀며 일어서기', hold: 400, move: 1000 },
    ],
  }
}

function bench(dumbbell_ = false): Motion {
  const hip: Vec = [0, 44]
  const torso = 90
  const top = both(fromShoulder(hip, torso, 0, 56, 1))
  const bottom = both(fromShoulder(hip, torso, -6, 12, 1))
  const lower = { legN: plant(-36, 4, -1), legF: plant(-36, 4, -1) }
  return {
    view: 'side',
    supine: true,
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: (s) => [
      { kind: 'rect', x: -28, y: 30, w: 92, h: 8 },
      { kind: 'line', a: [-20, 30], b: [-20, 0], w: 3 },
      { kind: 'line', a: [56, 30], b: [56, 0], w: 3 },
      ...(dumbbell_ ? dumbbell(s.wristN) : plate(s.wristN, 16)),
    ],
    frames: dumbbell_
      ? [
          { pose: { hip, torso, ...top, ...lower }, caption: '견갑을 모으고 덤벨을 가슴 위로 들기', hold: 600, move: 700 },
          { pose: { hip, torso, ...bottom, ...lower }, caption: '팔꿈치 45~70°로 덤벨을 가슴 옆까지 내리기', hold: 400, move: 1200 },
          { pose: { hip, torso, ...top, ...lower }, caption: '살짝 모이는 궤적으로 밀어 올리기', hold: 400, move: 800 },
        ]
      : [
          { pose: { hip, torso, ...top, ...lower }, caption: '견갑을 모으고 바를 눈 위에서 시작', hold: 600, move: 700 },
          { pose: { hip, torso, ...bottom, ...lower }, caption: '팔꿈치 45~70°로 명치까지 천천히 내리기', hold: 400, move: 1200 },
          { pose: { hip, torso, ...top, ...lower }, caption: '발로 바닥을 밀며 밀어 올리기', hold: 400, move: 800 },
        ],
  }
}

const PLANK_ANKLE: Vec = [-50, 4]
/** 팔굽혀펴기/플랭크 자세: 발목→어깨를 일직선으로 두고 어깨 높이만 바꿈 */
function plankBody(shoulderY: number, sag = 0): Pose {
  const ankle = PLANK_ANKLE
  const wrist: Vec = [80, 2]
  const total = LEN.thigh + LEN.shin + LEN.torso
  const dy = shoulderY - ankle[1]
  const dx = Math.sqrt(total * total - dy * dy)
  const r = (LEN.thigh + LEN.shin) / total
  const hip: Vec = [ankle[0] + dx * r, ankle[1] + dy * r - sag]
  const sh: Vec = [ankle[0] + dx, shoulderY]
  const torso = (Math.atan2(sh[0] - hip[0], sh[1] - hip[1]) * 180) / Math.PI
  return {
    hip,
    torso,
    armN: { target: wrist, bend: -1 },
    armF: { target: wrist, bend: -1 },
    legN: { target: ankle, bend: 1, foot: 160 },
    legF: { target: ankle, bend: 1, foot: 160 },
  }
}

function pushup(): Motion {
  const body = plankBody
  return {
    view: 'side',
    metric: { joint: 'elbow', label: '팔꿈치' },
    frames: [
      { pose: body(59), caption: '머리부터 발끝까지 일직선', hold: 600, move: 700 },
      { pose: body(18), caption: '팔꿈치 45°로 가슴이 바닥 가까이까지', hold: 400, move: 1000 },
      { pose: body(59), caption: '손바닥으로 바닥을 밀어내기', hold: 400, move: 800 },
      { pose: body(59, 22), caption: '❌ 엉덩이가 처짐 — 복근과 엉덩이에 힘!', bad: true, hold: 1500, move: 700 },
      { pose: body(59), caption: '몸통을 고정하고 다시', hold: 400, move: 700 },
    ],
  }
}

function pullup(): Motion {
  const bar = 200
  const P = (shY: number, ankle: Vec): Pose => ({
    hip: [0, shY - LEN.torso],
    torso: 0,
    armN: { target: [2, bar - 2], bend: -1 },
    armF: { target: [2, bar - 2], bend: -1 },
    legN: { target: ankle, bend: 1 },
    legF: { target: ankle, bend: 1 },
  })
  return {
    view: 'side',
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: () => [{ kind: 'line', a: [-30, bar], b: [34, bar], w: 4, role: 'bar' }],
    frames: [
      { pose: P(141, [-8, 58]), caption: '팔을 펴고 매달려 견갑을 아래로', hold: 600, move: 700 },
      { pose: P(178, [-8, 95]), caption: '팔꿈치를 옆구리로 당겨 턱이 바 위로', hold: 500, move: 1000 },
      { pose: P(141, [-8, 58]), caption: '천천히 끝까지 내려오기', hold: 400, move: 1300 },
    ],
  }
}

function latPulldown(): Motion {
  const hip: Vec = [0, 46]
  const torso = -14
  const lower = { legN: plant(40, 4, 1), legF: plant(40, 4, 1) }
  const top = both(fromShoulder(hip, torso, 8, 56, -1))
  const bottom = both(fromShoulder(hip, torso, 14, 4, -1))
  return {
    view: 'side',
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: (s) => [
      { kind: 'rect', x: -14, y: 38, w: 28, h: 6 },
      { kind: 'line', a: [s.wristN[0] - 18, s.wristN[1]], b: [s.wristN[0] + 18, s.wristN[1]], w: 3, role: 'bar' },
      { kind: 'line', a: s.wristN, b: [s.wristN[0], 200], w: 1 },
    ],
    frames: [
      { pose: { hip, torso, ...top, ...lower }, caption: '가슴을 들고 상체를 살짝 뒤로', hold: 600, move: 700 },
      { pose: { hip, torso, ...bottom, ...lower }, caption: '팔꿈치를 아래·뒤로 당겨 쇄골까지', hold: 500, move: 900 },
      { pose: { hip, torso, ...top, ...lower }, caption: '천천히 팔을 펴며 등을 늘리기', hold: 400, move: 1200 },
    ],
  }
}

function row(): Motion {
  const hip: Vec = [-22, 80]
  const torso = 58
  const lower = legs(plant(0))
  const sh = shoulderOf(hip, torso)
  const down = both(fk(180))
  const up = both({ target: [sh[0] - 14, sh[1] - 34], bend: -1 } as Limb)
  return {
    view: 'side',
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: (s) => plate(s.wristN, 15),
    frames: [
      { pose: { hip, torso, ...down, ...lower }, caption: '상체 약 45° 숙이고 등을 곧게', hold: 600, move: 700 },
      { pose: { hip, torso, ...up, ...lower }, caption: '바를 배꼽 쪽으로 당기며 견갑 모으기', hold: 500, move: 800 },
      { pose: { hip, torso, ...down, ...lower }, caption: '천천히 내리기 (몸통 각도 유지)', hold: 400, move: 1100 },
    ],
  }
}

function ohp(): Motion {
  const hip = STAND
  const lower = legs(plant(0))
  const bottom = both(fromShoulder(hip, 0, 8, 6, -1))
  const top = both(fromShoulder(hip, 0, 0, 57, -1))
  const lean: Pose = { hip: [6, 88], torso: -16, ...both(fromShoulder([6, 88], -16, 4, 57, -1)), ...lower }
  return {
    view: 'side',
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: (s) => plate(s.wristN, 12),
    frames: [
      { pose: { hip, torso: 0, ...bottom, ...lower }, caption: '바를 쇄골 위에, 엉덩이·복근 조이기', hold: 600, move: 700 },
      { pose: { hip, torso: 0, ...top, ...lower }, caption: '머리 위로 수직으로 밀어 올리기', hold: 500, move: 900 },
      { pose: { hip, torso: 0, ...bottom, ...lower }, caption: '천천히 쇄골까지 내리기', hold: 400, move: 1000 },
      { pose: lean, caption: '❌ 허리를 과하게 젖힘 — 몸통 고정!', bad: true, hold: 1400, move: 900 },
      { pose: { hip, torso: 0, ...bottom, ...lower }, caption: '다시 시작 자세', hold: 400, move: 800 },
    ],
  }
}

/** 정면 뷰 공통 하체 */
const frontLegs = { legN: plant(10, 4, 1), legF: plant(-10, 4, -1) }

function dbPress(): Motion {
  const P = (n1: number, n2: number): Pose => ({
    hip: STAND,
    torso: 0,
    armN: fk(n1, n2),
    armF: fk(-n1, -n2),
    ...frontLegs,
  })
  return {
    view: 'front',
    viewLabel: '정면',
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: (s) => [...dumbbell(s.wristN), ...dumbbell(s.wristF)],
    frames: [
      { pose: P(95, 2), caption: '덤벨을 귀 높이에, 팔꿈치 90°', hold: 600, move: 700 },
      { pose: P(18, 8), caption: '팔을 완전히 펴며 머리 위로', hold: 500, move: 900 },
      { pose: P(95, 2), caption: '팔꿈치가 어깨 높이까지 천천히', hold: 400, move: 1100 },
    ],
  }
}

function lateralRaise(): Motion {
  const P = (a: number): Pose => ({
    hip: STAND,
    torso: 0,
    armN: fk(a, a - 12),
    armF: fk(-a, -a + 12),
    ...frontLegs,
  })
  return {
    view: 'front',
    viewLabel: '정면',
    props: (s) => [...dumbbell(s.wristN), ...dumbbell(s.wristF)],
    frames: [
      { pose: P(168), caption: '팔꿈치를 살짝 굽혀 덤벨을 몸 옆에', hold: 500, move: 700 },
      { pose: P(92), caption: '팔꿈치가 먼저 올라가는 느낌으로 어깨 높이까지', hold: 500, move: 900 },
      { pose: P(168), caption: '천천히 내리기', hold: 400, move: 1100 },
    ],
  }
}

function fly(): Motion {
  const P = (a: number, bend: number): Pose => ({
    hip: [0, 80],
    torso: 0,
    armN: fk(a, a - bend),
    armF: fk(-a, -a + bend),
    legN: fk(176, 178),
    legF: fk(184, 182),
  })
  return {
    view: 'front',
    viewLabel: '벤치에 누운 상태를 머리 쪽에서 본 팔의 궤적',
    hideLegs: true,
    props: (s) => [...dumbbell(s.wristN), ...dumbbell(s.wristF)],
    frames: [
      { pose: P(12, 4), caption: '가슴 위로 덤벨을 모으고 팔꿈치 살짝 굽히기', hold: 600, move: 700 },
      { pose: P(84, 18), caption: '큰 원을 그리며 양옆으로 — 가슴 스트레칭', hold: 500, move: 1200 },
      { pose: P(12, 4), caption: '끌어안듯 다시 모으기', hold: 400, move: 1000 },
    ],
  }
}

function curl(prop: 'dumbbell' | 'barbell' | 'hammer' = 'dumbbell'): Motion {
  const lower = legs(plant(0))
  const P = (a2: number, a1 = 180): Pose => ({ hip: STAND, torso: 0, ...both(fk(a1, a2)), ...lower })
  const cheat: Pose = { hip: [2, 89], torso: -16, ...both(fk(150, 20)), ...lower }
  return {
    view: 'side',
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: (s) =>
      prop === 'barbell'
        ? plate(s.wristN, 12)
        : prop === 'hammer'
          ? [{ kind: 'rect', x: s.wristN[0] - 3.5, y: s.wristN[1] - 7, w: 7, h: 14, role: 'dumbbells' }]
          : dumbbell(s.wristN),
    frames: [
      { pose: P(178), caption: '팔꿈치를 옆구리에 붙이고 서기', hold: 500, move: 700 },
      { pose: P(28, 176), caption: '팔꿈치 고정한 채 어깨 쪽으로 감아올리기', hold: 400, move: 800 },
      { pose: P(178), caption: '2~3초 버티며 끝까지 펴기', hold: 400, move: 1400 },
      { pose: cheat, caption: '❌ 팔꿈치가 앞으로 + 상체 반동', bad: true, hold: 1400, move: 800 },
      { pose: P(178), caption: '다시 바른 자세로', hold: 400, move: 800 },
    ],
  }
}

function pushdown(): Motion {
  const hip: Vec = [0, 88]
  const torso = 10
  const lower = legs(plant(0))
  const P = (a2: number): Pose => ({ hip, torso, ...both(fk(172, a2)), ...lower })
  return {
    view: 'side',
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: (s) => [
      { kind: 'line', a: s.wristN, b: [44, 200], w: 1 },
      { kind: 'line', a: [s.wristN[0] - 6, s.wristN[1]], b: [s.wristN[0] + 6, s.wristN[1]], w: 3, role: 'bar' },
    ],
    frames: [
      { pose: P(78), caption: '팔꿈치를 옆구리에 고정, 90°에서 시작', hold: 500, move: 700 },
      { pose: P(176), caption: '팔꿈치만 펴서 허벅지 쪽으로', hold: 400, move: 800 },
      { pose: P(78), caption: '천천히 90°까지 돌아오기', hold: 400, move: 1100 },
    ],
  }
}

function legPress(): Motion {
  const hip: Vec = [0, 40]
  const torso = -48
  const arms = both(fk(150, 120))
  const P = (ankle: Vec): Pose => ({ hip, torso, ...arms, legN: { target: ankle, bend: 1, foot: 40 }, legF: { target: ankle, bend: 1, foot: 40 } })
  return {
    view: 'side',
    metric: { joint: 'knee', label: '무릎' },
    props: (s) => [
      { kind: 'line', a: [6, 34], b: [-46, 82], w: 5 },
      { kind: 'line', a: [s.ankleN[0] - 12, s.ankleN[1] + 16], b: [s.ankleN[0] + 18, s.ankleN[1] - 20], w: 5 },
    ],
    frames: [
      { pose: P([66, 58]), caption: '등·엉덩이를 시트에 붙이고 발판에 발', hold: 500, move: 700 },
      { pose: P([36, 44]), caption: '무릎을 가슴 쪽으로 천천히 굽히기', hold: 400, move: 1100 },
      { pose: P([66, 58]), caption: '발 전체로 밀되 무릎은 잠그지 않기', hold: 400, move: 900 },
    ],
  }
}

function calfRaise(): Motion {
  const toe: Vec = [10, 14]
  const P = (footDeg: number): Pose => {
    const f = dir(footDeg)
    const ankle: Vec = [toe[0] - f[0] * LEN.foot, toe[1] - f[1] * LEN.foot]
    return {
      hip: [ankle[0], ankle[1] + 84],
      torso: 0,
      ...both(fk(180)),
      ...legs({ target: ankle, bend: 1, foot: footDeg }),
    }
  }
  return {
    view: 'side',
    props: () => [{ kind: 'rect', x: 4, y: 0, w: 40, h: 12 }],
    frames: [
      { pose: P(72), caption: '앞꿈치만 계단 끝에, 뒤꿈치를 충분히 내리기', hold: 600, move: 700 },
      { pose: P(140), caption: '뒤꿈치를 최대한 들어 1~2초 정지', hold: 900, move: 900 },
      { pose: P(72), caption: '천천히 내려 종아리 스트레칭', hold: 400, move: 1100 },
    ],
  }
}

function plank(): Motion {
  const ankle: Vec = [-75, 4]
  const sh: Vec = [60, 34]
  const P = (hipDrop: number): Pose => {
    const r = (LEN.thigh + LEN.shin) / (LEN.thigh + LEN.shin + LEN.torso)
    const hip: Vec = [ankle[0] + (sh[0] - ankle[0]) * r, ankle[1] + (sh[1] - ankle[1]) * r - hipDrop]
    const torso = (Math.atan2(sh[0] - hip[0], sh[1] - hip[1]) * 180) / Math.PI
    return { hip, torso, ...both({ target: [sh[0] + 26, 3], bend: 1 }), ...legs({ target: ankle, bend: 1, foot: 160 }) }
  }
  return {
    view: 'side',
    metric: { joint: 'hip', label: '몸통 라인' },
    frames: [
      { pose: P(0), caption: '팔꿈치는 어깨 아래, 머리~발끝 일직선 유지', hold: 2200, move: 600 },
      { pose: P(13), caption: '❌ 엉덩이가 처짐 — 허리에 부담', bad: true, hold: 1500, move: 700 },
      { pose: P(0), caption: '복근·엉덩이에 힘을 줘 일직선으로', hold: 1500, move: 700 },
      { pose: P(-16), caption: '❌ 엉덩이를 너무 높이 듦', bad: true, hold: 1500, move: 700 },
    ],
  }
}

function crunch(): Motion {
  const hip: Vec = [0, 10]
  const lower = legs(plant(-38, 4, -1))
  const P = (torso: number, arm: number): Pose => ({ hip, torso, head: 0, ...both(fk(arm, arm)), ...lower })
  return {
    view: 'side',
    supine: true,
    metric: { joint: 'hip', label: '고관절' },
    frames: [
      { pose: P(88, -100), caption: '누워서 무릎 세우기', hold: 500, move: 700 },
      { pose: P(55, -80), caption: '갈비뼈를 골반 쪽으로 말아 올리기 (숨 내쉬며)', hold: 500, move: 800 },
      { pose: P(88, -100), caption: '천천히 내려오기', hold: 400, move: 1000 },
    ],
  }
}

function inclineBench(): Motion {
  const hip: Vec = [0, 44]
  const torso = 58
  const lower = { legN: plant(-38, 4, -1), legF: plant(-38, 4, -1) }
  const top = both(fromShoulder(hip, torso, 0, 56, 1))
  const bottom = both(fromShoulder(hip, torso, -8, 12, 1))
  const back = dir(torso)
  return {
    view: 'side',
    supine: true,
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: (s) => [
      { kind: 'rect', x: -30, y: 30, w: 34, h: 8 },
      { kind: 'line', a: [hip[0] - 4, hip[1] - 10], b: [hip[0] - 4 + back[0] * 62, hip[1] - 10 + back[1] * 62], w: 8 },
      { kind: 'line', a: [-14, 30], b: [-14, 0], w: 3 },
      ...plate(s.wristN, 15),
    ],
    frames: [
      { pose: { hip, torso, ...top, ...lower }, caption: '등받이 30~45°, 견갑을 모으고 시작', hold: 600, move: 700 },
      { pose: { hip, torso, ...bottom, ...lower }, caption: '바를 쇄골 아래 윗가슴까지 내리기', hold: 400, move: 1200 },
      { pose: { hip, torso, ...top, ...lower }, caption: '수직으로 밀어 올리기', hold: 400, move: 800 },
    ],
  }
}

function dips(): Motion {
  const bar = 100
  const P = (sh: Vec, torso: number): Pose => {
    const d = dir(torso)
    const hip: Vec = [sh[0] - d[0] * LEN.torso, sh[1] - d[1] * LEN.torso]
    const knees = { target: [hip[0] - 26, hip[1] - 66] as Vec, bend: 1 as const, foot: 200 }
    return { hip, torso, ...both({ target: [8, bar], bend: 1 }), legN: knees, legF: knees }
  }
  return {
    view: 'side',
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: () => [
      { kind: 'line', a: [-12, bar], b: [34, bar], w: 4 },
      { kind: 'line', a: [30, bar], b: [30, 0], w: 3 },
    ],
    frames: [
      { pose: P([7, 157], 8), caption: '팔을 펴고 어깨를 내린 채 매달리기', hold: 600, move: 700 },
      { pose: P([16, 124], 26), caption: '상체를 살짝 숙이며 위팔이 수평이 될 때까지', hold: 400, move: 1100 },
      { pose: P([7, 157], 8), caption: '손바닥으로 밀며 팔 펴기', hold: 400, move: 800 },
      { pose: P([20, 108], 32), caption: '❌ 너무 깊이 내려감 — 어깨 부상 위험', bad: true, hold: 1400, move: 1100 },
      { pose: P([7, 157], 8), caption: '적당한 깊이로 다시', hold: 400, move: 800 },
    ],
  }
}

function cableCrossover(): Motion {
  const P = (a1: number, a2: number): Pose => ({ hip: STAND, torso: 0, armN: fk(a1, a2), armF: fk(-a1, -a2), ...frontLegs })
  return {
    view: 'front',
    viewLabel: '정면',
    props: (s) => [
      { kind: 'line', a: s.wristN, b: [70, 175], w: 1 },
      { kind: 'line', a: s.wristF, b: [-70, 175], w: 1 },
    ],
    frames: [
      { pose: P(100, 80), caption: '팔꿈치를 살짝 굽혀 양팔을 벌리고 가슴 늘리기', hold: 600, move: 700 },
      { pose: P(196, 212), caption: '끌어안듯 몸 앞 아래로 손을 모으기', hold: 500, move: 900 },
      { pose: P(100, 80), caption: '천천히 벌리며 돌아가기', hold: 400, move: 1100 },
    ],
  }
}

function seatedRow(): Motion {
  const hip: Vec = [0, 22]
  const lower = legs({ target: [80, 20], bend: 1, foot: 20 })
  const P = (torso: number, pulled: boolean): Pose => ({
    hip,
    torso,
    ...lower,
    ...both(pulled ? fromShoulder(hip, torso, 10, -30, -1) : fromShoulder(hip, torso, 56, -6, -1)),
  })
  return {
    view: 'side',
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: (s) => [
      { kind: 'rect', x: -20, y: 12, w: 34, h: 8 },
      { kind: 'line', a: [90, 0], b: [90, 44], w: 4 },
      { kind: 'line', a: s.wristN, b: [90, 26], w: 1 },
    ],
    frames: [
      { pose: P(14, false), caption: '무릎을 살짝 굽히고 가슴을 펴서 앉기', hold: 600, move: 700 },
      { pose: P(-6, true), caption: '팔꿈치를 뒤로 당겨 손잡이를 배꼽 쪽으로', hold: 500, move: 900 },
      { pose: P(14, false), caption: '견갑을 늘리며 천천히 팔 펴기', hold: 400, move: 1100 },
    ],
  }
}

function oneArmRow(): Motion {
  const hip: Vec = [-22, 64]
  const torso = 82
  const sh = shoulderOf(hip, torso)
  const base = {
    hip,
    torso,
    armF: { target: [sh[0] + 2, 40] as Vec, bend: -1 as const },
    legF: { target: [-58, 42] as Vec, bend: 1 as const, foot: 270 },
    legN: plant(-14, 4, 1),
  }
  return {
    view: 'side',
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: (s) => [{ kind: 'rect', x: -70, y: 0, w: 110, h: 38 }, ...dumbbell(s.wristN, 'dumbbell')],
    frames: [
      { pose: { ...base, armN: fk(180) }, caption: '한 손·무릎을 벤치에, 등은 평평하게', hold: 600, move: 700 },
      { pose: { ...base, armN: { target: [sh[0] - 18, sh[1] - 20], bend: -1 } }, caption: '팔꿈치를 골반 쪽으로 당겨 올리기', hold: 500, move: 800 },
      { pose: { ...base, armN: fk(180) }, caption: '천천히 내리며 등 늘리기', hold: 400, move: 1100 },
    ],
  }
}

function backExtension(): Motion {
  // 기구 위에 올라가 있으므로 전체를 바닥에서 띄움 (내려갈 때 머리가 바닥을 뚫지 않게)
  const hip: Vec = [0, 80]
  const P = (torso: number): Pose => ({
    hip,
    torso,
    ...both(fk(torso + 150, torso + 220)),
    ...legs({ target: [-62, 26], bend: 1, foot: 150 }),
  })
  return {
    view: 'side',
    metric: { joint: 'hip', label: '고관절' },
    props: () => [
      { kind: 'circle', c: [6, 72], r: 6, fill: true },
      { kind: 'line', a: [6, 66], b: [-30, 0], w: 3 },
      { kind: 'line', a: [-72, 22], b: [-54, 34], w: 4 },
      { kind: 'line', a: [-63, 28], b: [-63, 0], w: 3 },
    ],
    frames: [
      { pose: P(48), caption: '패드는 골반 아래, 몸을 일직선으로', hold: 600, move: 700 },
      { pose: P(150), caption: '엉덩이를 접으며 상체를 천천히 내리기', hold: 400, move: 1100 },
      { pose: P(48), caption: '엉덩이 힘으로 일직선까지 올라오기', hold: 500, move: 900 },
      { pose: P(15), caption: '❌ 허리를 과하게 젖힘 — 일직선까지만', bad: true, hold: 1400, move: 700 },
      { pose: P(48), caption: '일직선으로 다시', hold: 400, move: 700 },
    ],
  }
}

function hipThrust(): Motion {
  const sh: Vec = [-26, 44]
  const ankle: Vec = [70, 4]
  const P = (hip: Vec): Pose => {
    const torso = (Math.atan2(sh[0] - hip[0], sh[1] - hip[1]) * 180) / Math.PI
    return {
      hip,
      torso,
      head: 20,
      ...both({ target: [hip[0] + 2, hip[1] + 12], bend: 1 }),
      ...legs({ target: ankle, bend: 1 }),
    }
  }
  return {
    view: 'side',
    metric: { joint: 'hip', label: '고관절' },
    props: (s) => [{ kind: 'rect', x: -64, y: 0, w: 40, h: 36 }, ...plate([s.hipN[0], s.hipN[1] + 12], 15)],
    frames: [
      { pose: P([14, 16]), caption: '날개뼈 아래를 벤치에, 바는 골반 위에', hold: 600, move: 700 },
      { pose: P([26, 44]), caption: '엉덩이를 밀어 올려 몸통 수평, 정강이 수직', hold: 700, move: 900 },
      { pose: P([14, 16]), caption: '천천히 내리기', hold: 400, move: 1000 },
    ],
  }
}

function legExtension(): Motion {
  const hip: Vec = [0, 50]
  const P = (a2: number): Pose => ({ hip, torso: -8, ...both(fk(172, 150)), ...legs(fk(90, a2)) })
  return {
    view: 'side',
    metric: { joint: 'knee', label: '무릎' },
    props: (s) => [
      { kind: 'rect', x: -16, y: 38, w: 50, h: 8 },
      { kind: 'line', a: [-14, 46], b: [-22, 104], w: 6 },
      { kind: 'line', a: [0, 38], b: [0, 0], w: 3 },
      { kind: 'circle', c: [s.ankleN[0] + 3, s.ankleN[1] - 3], r: 5, fill: true },
    ],
    frames: [
      { pose: P(178), caption: '무릎을 기구 회전축에 맞춰 앉기', hold: 500, move: 700 },
      { pose: P(96), caption: '무릎을 펴서 들어올리고 1초 조이기', hold: 700, move: 900 },
      { pose: P(178), caption: '천천히 내리기', hold: 400, move: 1100 },
    ],
  }
}

function legCurl(): Motion {
  const hip: Vec = [0, 30]
  const P = (a2: number): Pose => ({ hip, torso: 90, head: 20, ...both(fk(180, 110)), ...legs(fk(-90, a2)) })
  return {
    view: 'side',
    metric: { joint: 'knee', label: '무릎' },
    props: (s) => [
      { kind: 'rect', x: -96, y: 16, w: 160, h: 8 },
      { kind: 'line', a: [-20, 16], b: [-20, 0], w: 3 },
      { kind: 'circle', c: [s.ankleN[0], s.ankleN[1] + 5], r: 5, fill: true },
    ],
    frames: [
      { pose: P(-90), caption: '엎드려 무릎을 회전축에 맞추기', hold: 500, move: 700 },
      { pose: P(-8), caption: '패드를 엉덩이 쪽으로 당기기', hold: 500, move: 800 },
      { pose: P(-90), caption: '2~3초 버티며 천천히 펴기', hold: 400, move: 1300 },
    ],
  }
}

function frontRaise(): Motion {
  const lower = legs(plant(0))
  const P = (a: number): Pose => ({ hip: STAND, torso: 0, ...both(fk(a, a - 8)), ...lower })
  return {
    view: 'side',
    props: (s) => dumbbell(s.wristN),
    frames: [
      { pose: P(172), caption: '덤벨을 허벅지 앞에 들고 서기', hold: 500, move: 700 },
      { pose: P(92), caption: '팔꿈치를 살짝 굽힌 채 어깨 높이까지', hold: 500, move: 900 },
      { pose: P(172), caption: '천천히 내리기', hold: 400, move: 1100 },
      { pose: { hip: [3, 89], torso: -15, ...both(fk(70, 62)), ...lower }, caption: '❌ 상체를 젖히며 반동', bad: true, hold: 1300, move: 800 },
      { pose: P(172), caption: '몸통을 고정하고 다시', hold: 400, move: 800 },
    ],
  }
}

function facePull(): Motion {
  const lower = legs(plant(0))
  const P = (pulled: boolean): Pose => ({
    hip: STAND,
    torso: 0,
    ...lower,
    ...both(pulled ? fromShoulder(STAND, 0, 6, 18, 1) : fromShoulder(STAND, 0, 56, 10, -1)),
  })
  return {
    view: 'side',
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: (s) => [{ kind: 'line', a: s.wristN, b: [120, 160], w: 1 }],
    frames: [
      { pose: P(false), caption: '로프를 얼굴 높이에서 잡고 팔 펴기', hold: 500, move: 700 },
      { pose: P(true), caption: '팔꿈치를 높게, 로프를 얼굴 양옆으로 당기기', hold: 600, move: 800 },
      { pose: P(false), caption: '천천히 팔 펴기', hold: 400, move: 1000 },
    ],
  }
}

function skullCrusher(): Motion {
  const hip: Vec = [0, 44]
  const torso = 90
  const lower = { legN: plant(-36, 4, -1), legF: plant(-36, 4, -1) }
  const P = (a2: number): Pose => ({ hip, torso, ...both(fk(10, a2)), ...lower })
  return {
    view: 'side',
    supine: true,
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: (s) => [
      { kind: 'rect', x: -28, y: 30, w: 92, h: 8 },
      { kind: 'line', a: [-20, 30], b: [-20, 0], w: 3 },
      { kind: 'line', a: [56, 30], b: [56, 0], w: 3 },
      ...plate(s.wristN, 11),
    ],
    frames: [
      { pose: P(8), caption: '바를 가슴 위로 들고 팔 펴기', hold: 500, move: 700 },
      { pose: P(138), caption: '위팔 고정, 팔꿈치만 굽혀 이마 뒤로', hold: 400, move: 1100 },
      { pose: P(8), caption: '팔꿈치를 펴서 들어 올리기', hold: 400, move: 800 },
    ],
  }
}

function overheadExtension(): Motion {
  const lower = legs(plant(0))
  const P = (a2: number): Pose => ({ hip: STAND, torso: 0, ...both(fk(4, a2)), ...lower })
  return {
    view: 'side',
    metric: { joint: 'elbow', label: '팔꿈치' },
    props: (s) => [{ kind: 'rect', x: s.wristN[0] - 4, y: s.wristN[1] - 8, w: 8, h: 16, role: 'dumbbell-center' }],
    frames: [
      { pose: P(4), caption: '덤벨을 양손으로 잡고 머리 위로 팔 펴기', hold: 500, move: 700 },
      { pose: P(-150), caption: '팔꿈치 고정, 덤벨을 머리 뒤로 내리기', hold: 400, move: 1100 },
      { pose: P(4), caption: '팔꿈치를 펴서 들어 올리기', hold: 400, move: 800 },
    ],
  }
}

function legRaise(): Motion {
  const hip: Vec = [0, 9]
  const P = (a: number): Pose => ({ hip, torso: -90, head: 0, ...both(fk(90, 90)), ...legs(fk(a, a)) })
  return {
    view: 'side',
    metric: { joint: 'hip', label: '고관절' },
    frames: [
      { pose: P(84), caption: '허리를 바닥에 붙이고 다리를 살짝 띄우기', hold: 500, move: 700 },
      { pose: P(4), caption: '다리를 편 채 수직까지 들어 올리기', hold: 400, move: 1000 },
      { pose: P(84), caption: '바닥에 닿기 직전까지 천천히 내리기', hold: 400, move: 1400 },
    ],
  }
}

function mountainClimber(): Motion {
  const base = plankBody(60)
  const tuck = (near: boolean): Pose => {
    const p = plankBody(62)
    const knee = { target: [p.hip[0] + 6, 14] as Vec, bend: 1 as const, foot: 160 }
    return near ? { ...p, legN: knee } : { ...p, legF: knee }
  }
  return {
    view: 'side',
    frames: [
      { pose: base, caption: '팔굽혀펴기 시작 자세, 손은 어깨 아래', hold: 500, move: 500 },
      { pose: tuck(true), caption: '한쪽 무릎을 가슴 쪽으로 당기기', hold: 150, move: 350 },
      { pose: base, caption: '다리를 번갈아 빠르게', hold: 50, move: 300 },
      { pose: tuck(false), caption: '다리를 번갈아 빠르게', hold: 150, move: 350 },
      { pose: base, caption: '엉덩이 높이는 일정하게 유지', hold: 50, move: 300 },
      { pose: tuck(true), caption: '엉덩이 높이는 일정하게 유지', hold: 150, move: 350 },
      { pose: base, caption: '복근에 힘을 유지하며 반복', hold: 50, move: 300 },
      { pose: tuck(false), caption: '복근에 힘을 유지하며 반복', hold: 150, move: 350 },
    ],
  }
}

function jumpingJack(): Motion {
  const P = (open: number, air: number, arm: number): Pose => ({
    hip: [0, 88 + air],
    torso: 0,
    armN: fk(arm, arm - 8),
    armF: fk(-arm, -arm + 8),
    legN: plant(8 + open, 4 + air, 1),
    legF: plant(-8 - open, 4 + air, -1),
  })
  return {
    view: 'front',
    viewLabel: '정면',
    frames: [
      { pose: P(0, 0, 172), caption: '발을 모으고 팔은 몸 옆에', hold: 300, move: 400 },
      { pose: P(12, 10, 90), caption: '점프하며 다리를 벌리고', hold: 0, move: 220 },
      { pose: P(24, 0, 12), caption: '팔을 머리 위로 — 앞꿈치로 착지', hold: 150, move: 220 },
      { pose: P(12, 10, 90), caption: '다시 점프해서', hold: 0, move: 220 },
      { pose: P(0, 0, 172), caption: '처음 자세로', hold: 150, move: 220 },
    ],
  }
}

export const MOTIONS: Record<string, Motion> = {
  squat: squat('bodyweight'),
  'barbell-squat': squat('barbell'),
  lunge: lunge(),
  deadlift: deadlift(),
  rdl: rdl(),
  'bench-press': bench(),
  'db-fly': fly(),
  pushup: pushup(),
  pullup: pullup(),
  'lat-pulldown': latPulldown(),
  'barbell-row': row(),
  ohp: ohp(),
  'db-shoulder-press': dbPress(),
  'lateral-raise': lateralRaise(),
  'db-curl': curl(),
  'triceps-pushdown': pushdown(),
  'leg-press': legPress(),
  'calf-raise': calfRaise(),
  plank: plank(),
  crunch: crunch(),
  'incline-bench': inclineBench(),
  'db-bench-press': bench(true),
  dips: dips(),
  'cable-crossover': cableCrossover(),
  'seated-cable-row': seatedRow(),
  'one-arm-db-row': oneArmRow(),
  'back-extension': backExtension(),
  'goblet-squat': squat('goblet'),
  'bulgarian-split-squat': lunge(true),
  'hip-thrust': hipThrust(),
  'leg-extension': legExtension(),
  'leg-curl': legCurl(),
  'front-raise': frontRaise(),
  'face-pull': facePull(),
  'hammer-curl': curl('hammer'),
  'barbell-curl': curl('barbell'),
  'skull-crusher': skullCrusher(),
  'overhead-triceps-extension': overheadExtension(),
  'leg-raise': legRaise(),
  'mountain-climber': mountainClimber(),
  'jumping-jack': jumpingJack(),
}
