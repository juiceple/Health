export type RoutineItem = {
  exerciseId: string
  sets: number
  /** 목표 횟수 (unit이 'sec'이면 초) */
  reps: number
  unit?: 'reps' | 'sec'
  /** 세트 사이 휴식(초) */
  rest: number
  note?: string
}

export type RoutineDay = { name: string; items: RoutineItem[] }

export type Goal = '체지방 감량' | '복근' | '팔' | '어깨' | '하체·힙업' | '근력·전신'

export type Routine = {
  id: string
  title: string
  goal: Goal
  emoji: string
  level: '초급' | '중급' | '상급'
  place: '헬스장' | '집'
  minutes: number
  perWeek: string
  desc: string
  tips: string[]
  days: RoutineDay[]
  /** 사용자가 만든 루틴 */
  custom?: boolean
}

export const GOALS: Goal[] = ['체지방 감량', '복근', '팔', '어깨', '하체·힙업', '근력·전신']

const r = (exerciseId: string, sets: number, reps: number, rest: number, extra: Partial<RoutineItem> = {}): RoutineItem => ({
  exerciseId,
  sets,
  reps,
  rest,
  ...extra,
})
const sec = (exerciseId: string, sets: number, seconds: number, rest: number, extra: Partial<RoutineItem> = {}) =>
  r(exerciseId, sets, seconds, rest, { unit: 'sec', ...extra })

/** 목표별 추천 루틴 */
export const PRESET_ROUTINES: Routine[] = [
  {
    id: 'fatburn-home',
    title: '집에서 지방 태우기 서킷',
    goal: '체지방 감량',
    emoji: '🔥',
    level: '초급',
    place: '집',
    minutes: 25,
    perWeek: '주 3~4회',
    desc: '도구 없이 심박수를 끌어올리는 전신 서킷. 짧은 휴식으로 칼로리 소모를 극대화해요.',
    tips: [
      '순서대로 한 동작씩 하고, 마지막까지 끝나면 1분 쉬고 다시 처음부터 (총 3바퀴)',
      '숨이 차되 대화는 겨우 가능한 강도가 적당해요',
      '체중 감량은 운동보다 식단 비중이 커요 — 하루 300~500kcal 적게 먹기',
    ],
    days: [
      {
        name: '서킷',
        items: [
          sec('jumping-jack', 3, 40, 15, { note: '워밍업 겸 가볍게' }),
          r('squat', 3, 15, 15),
          r('pushup', 3, 10, 15, { note: '어려우면 무릎 대고' }),
          sec('mountain-climber', 3, 30, 15),
          r('lunge', 3, 12, 15, { note: '양쪽 번갈아 12회' }),
          r('edb-dK9394r', 3, 8, 15),
          sec('plank', 3, 30, 60, { note: '끝나면 1분 쉬고 다음 바퀴' }),
        ],
      },
    ],
  },
  {
    id: 'fatloss-gym',
    title: '헬스장 다이어트 (근력 + 유산소)',
    goal: '체지방 감량',
    emoji: '🏃',
    level: '초급',
    place: '헬스장',
    minutes: 50,
    perWeek: '주 3회',
    desc: '큰 근육 위주의 머신·덤벨 운동으로 근육을 지키면서, 마무리 유산소로 지방을 태워요.',
    tips: [
      '근력 운동 후 러닝머신(빠르게 걷기·경사) 또는 사이클 20분',
      '무게는 12회가 힘겹게 되는 정도로',
      '단백질을 체중 1kg당 1.6g 이상 챙겨야 근손실을 막아요',
    ],
    days: [
      {
        name: '전신',
        items: [
          r('goblet-squat', 3, 12, 60),
          r('db-bench-press', 3, 12, 60),
          r('lat-pulldown', 3, 12, 60),
          r('leg-press', 3, 15, 60),
          r('seated-cable-row', 3, 12, 60),
          sec('plank', 3, 40, 30),
          sec('mountain-climber', 3, 30, 30, { note: '이후 유산소 20분' }),
        ],
      },
    ],
  },
  {
    id: 'abs',
    title: '복근 만들기',
    goal: '복근',
    emoji: '🧱',
    level: '초급',
    place: '집',
    minutes: 20,
    perWeek: '주 3~4회',
    desc: '윗배·아랫배·옆구리·코어를 고루 자극하는 20분 복근 루틴.',
    tips: [
      '복근이 "보이려면" 체지방률이 남성 15%·여성 22% 이하로 내려가야 해요',
      '반동 없이 천천히, 내쉬면서 수축',
      '허리가 아프면 레그 레이즈는 무릎을 굽혀서',
    ],
    days: [
      {
        name: '복근',
        items: [
          r('crunch', 3, 15, 30, { note: '윗배' }),
          r('leg-raise', 3, 12, 30, { note: '아랫배' }),
          r('edb-1ZFqTDN', 3, 20, 30, { note: '옆구리 · 양쪽 합쳐 20회' }),
          r('edb-XVDdcoj', 3, 20, 30, { note: '옆구리' }),
          r('edb-nCU1Ekp', 3, 12, 30, { note: '아랫배' }),
          sec('plank', 3, 45, 45, { note: '코어' }),
        ],
      },
    ],
  },
  {
    id: 'arms',
    title: '팔뚝 키우기 (이두 + 삼두)',
    goal: '팔',
    emoji: '💪',
    level: '중급',
    place: '헬스장',
    minutes: 45,
    perWeek: '주 2회',
    desc: '팔 둘레의 2/3는 삼두! 이두와 삼두를 번갈아 자극해서 팔을 굵게 만들어요.',
    tips: [
      '이두·삼두를 번갈아 하면 쉬는 동안 반대 근육을 쓸 수 있어 효율적이에요',
      '팔꿈치를 고정하고 반동 금지 — 무게보다 수축감',
      '마지막 세트는 실패 지점까지',
    ],
    days: [
      {
        name: '팔',
        items: [
          r('barbell-curl', 4, 10, 90),
          r('skull-crusher', 4, 10, 90),
          r('hammer-curl', 3, 12, 60),
          r('triceps-pushdown', 3, 12, 60),
          r('edb-gvsWLQw', 3, 12, 60, { note: '정점에서 1초 쥐어짜기' }),
          r('overhead-triceps-extension', 3, 12, 60),
        ],
      },
    ],
  },
  {
    id: 'arms-home',
    title: '집에서 팔뚝 탄탄하게',
    goal: '팔',
    emoji: '🏠',
    level: '초급',
    place: '집',
    minutes: 25,
    perWeek: '주 2~3회',
    desc: '덤벨 한 쌍과 맨몸으로 하는 팔 루틴. 팔뚝 뒷살(삼두) 정리에도 좋아요.',
    tips: ['물병·생수통으로 대신해도 돼요', '천천히 내리는 구간(2~3초)에 집중'],
    days: [
      {
        name: '팔',
        items: [
          r('db-curl', 3, 12, 45),
          r('edb-soIB2rj', 3, 10, 45, { note: '어려우면 무릎 대고' }),
          r('hammer-curl', 3, 12, 45),
          r('edb-W6PxUkg', 3, 12, 45),
          r('overhead-triceps-extension', 3, 12, 45),
        ],
      },
    ],
  },
  {
    id: 'shoulders',
    title: '넓은 어깨 만들기',
    goal: '어깨',
    emoji: '🤷',
    level: '중급',
    place: '헬스장',
    minutes: 45,
    perWeek: '주 2회',
    desc: '어깨 앞·옆·뒤를 모두 채워 넓고 둥근 어깨 라인을 만들어요.',
    tips: ['옆어깨(레터럴 레이즈)는 가볍게 고반복이 효과적', '페이스 풀은 라운드숄더 교정에도 좋아요'],
    days: [
      {
        name: '어깨',
        items: [
          r('ohp', 4, 8, 120),
          r('lateral-raise', 4, 15, 45),
          r('edb-eOrFCnx', 3, 10, 60),
          r('face-pull', 3, 15, 45),
          r('front-raise', 3, 12, 45),
          r('edb-EAs3xL9', 3, 15, 45, { note: '뒤어깨' }),
        ],
      },
    ],
  },
  {
    id: 'glutes',
    title: '힙업 · 하체 라인',
    goal: '하체·힙업',
    emoji: '🍑',
    level: '중급',
    place: '헬스장',
    minutes: 50,
    perWeek: '주 2~3회',
    desc: '엉덩이와 허벅지 뒤쪽을 집중 공략하는 하체 루틴.',
    tips: ['힙 쓰러스트 정점에서 엉덩이를 1~2초 꽉 조이기', '무릎이 안으로 모이지 않게'],
    days: [
      {
        name: '하체',
        items: [
          r('hip-thrust', 4, 12, 90),
          r('bulgarian-split-squat', 3, 10, 60, { note: '한쪽당 10회' }),
          r('rdl', 3, 12, 90),
          r('goblet-squat', 3, 12, 60),
          r('leg-curl', 3, 15, 45),
          r('edb-u0cNiij', 3, 20, 30, { note: '마무리 펌핑' }),
        ],
      },
    ],
  },
  {
    id: 'home-bodyweight',
    title: '맨몸 홈트 기본',
    goal: '근력·전신',
    emoji: '🤸',
    level: '초급',
    place: '집',
    minutes: 30,
    perWeek: '주 3회',
    desc: '도구 없이 집에서 전신 근력을 기르는 기본 루틴.',
    tips: ['횟수가 쉬워지면 세트를 늘리거나 천천히(3초 내리기)', '매트 위에서 하면 무릎·손목 부담이 줄어요'],
    days: [
      {
        name: '전신',
        items: [
          r('squat', 4, 20, 45),
          r('pushup', 4, 12, 60),
          r('lunge', 3, 12, 45, { note: '양쪽 번갈아' }),
          r('edb-u0cNiij', 3, 15, 45),
          r('crunch', 3, 15, 30),
          sec('plank', 3, 40, 30),
        ],
      },
    ],
  },
  {
    id: 'beginner-fullbody',
    title: '헬스 초보 전신 (바벨 5종)',
    goal: '근력·전신',
    emoji: '🏋️',
    level: '초급',
    place: '헬스장',
    minutes: 60,
    perWeek: '주 3회 (하루씩 쉬기)',
    desc: '스쿼트·벤치·로우·오버헤드 프레스·데드리프트로 기초 근력을 쌓는 정석 루틴.',
    tips: ['처음 2주는 빈 바나 가벼운 무게로 자세부터', '매 운동마다 2.5kg씩 조금씩 늘리기'],
    days: [
      {
        name: '전신',
        items: [
          r('barbell-squat', 3, 10, 120),
          r('bench-press', 3, 10, 120),
          r('barbell-row', 3, 10, 90),
          r('ohp', 3, 8, 90),
          r('rdl', 3, 10, 90),
          sec('plank', 3, 30, 45),
        ],
      },
    ],
  },
  {
    id: 'split3',
    title: '3분할 근비대',
    goal: '근력·전신',
    emoji: '📆',
    level: '중급',
    place: '헬스장',
    minutes: 70,
    perWeek: '주 3~6회 (A→B→C 순환)',
    desc: '가슴·삼두 / 등·이두 / 하체·어깨로 나눠 부위별로 충분한 볼륨을 주는 루틴.',
    tips: ['A→B→C 순서로 돌아가며, 앱이 다음 차례를 알려줘요', '각 부위는 주 1~2회 자극'],
    days: [
      {
        name: 'A 가슴·삼두',
        items: [
          r('bench-press', 4, 8, 120),
          r('incline-bench', 3, 10, 90),
          r('cable-crossover', 3, 12, 60),
          r('dips', 3, 10, 90),
          r('triceps-pushdown', 3, 12, 60),
        ],
      },
      {
        name: 'B 등·이두',
        items: [
          r('deadlift', 4, 6, 150),
          r('pullup', 3, 8, 90),
          r('lat-pulldown', 3, 10, 60),
          r('seated-cable-row', 3, 10, 60),
          r('barbell-curl', 3, 10, 60),
          r('hammer-curl', 3, 12, 60),
        ],
      },
      {
        name: 'C 하체·어깨',
        items: [
          r('barbell-squat', 4, 8, 150),
          r('leg-press', 3, 12, 90),
          r('rdl', 3, 10, 90),
          r('ohp', 3, 8, 90),
          r('lateral-raise', 3, 15, 45),
          r('calf-raise', 3, 15, 45),
        ],
      },
    ],
  },
]

export function targetLabel(it: RoutineItem) {
  return `${it.sets}세트 × ${it.reps}${it.unit === 'sec' ? '초' : '회'} · 휴식 ${it.rest}초`
}
