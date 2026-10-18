/**
 * ExerciseDB 운동 애니메이션(GIF) 매핑. 각 GIF는 직접 내려받아 동작이 맞는지 확인함.
 * 매핑이 없는 종목(레그 익스텐션, 라잉 레그 컬, 힙 쓰러스트, 원암 덤벨 로우, 점핑 잭)은 3D 모델로 보여줌.
 *
 * 기본값은 무료 API(oss.exercisedb.dev)의 미디어로, 개인·비상업용 + 출처 표기 조건이다.
 * 상업용으로 출시할 때는 유료 라이선스를 구매해 파일을 직접 호스팅하고
 * VITE_EXERCISEDB_MEDIA_URL 을 그 주소로 지정하면 된다 (파일명: <ID>.gif).
 */
import catalog from './edb/catalog.json'

export type EdbEntry = { id: string; en: string; ko: string; cat: string; eq: string; p: string[]; s: string[]; nogif?: number }

/** ExerciseDB 전체 카탈로그 1,500종 (scripts/build-exercisedb.py 로 생성, 이름은 한국어로 변환) */
export const EDB_CATALOG = catalog as EdbEntry[]
const NO_GIF = new Set(EDB_CATALOG.filter((e) => e.nogif).map((e) => e.id))

export const EXERCISEDB_IDS: Record<string, string> = {
  squat: '75Bgtjy',
  'barbell-squat': 'qXTaZnJ',
  lunge: 'RRWFUcw',
  deadlift: 'ila4NZS',
  rdl: 'wQ2c4XD',
  'bench-press': 'EIeI8Vf',
  'db-fly': 'yz9nUhF',
  pushup: 'I4hDWkc',
  pullup: 'lBDjFxJ',
  'lat-pulldown': 'RVwzP10',
  'barbell-row': 'eZyBC3j',
  ohp: 'Kyd9Rz5',
  'db-shoulder-press': 'znQUdHY',
  'lateral-raise': 'DsgkuIt',
  'db-curl': 'NbVPDMW',
  'triceps-pushdown': '3ZflifB',
  'leg-press': '10Z2DXU',
  'calf-raise': '6HmFgmx',
  plank: 'VBAWRPG',
  crunch: 'TFqbd8t',
  'incline-bench': '3TZduzM',
  'db-bench-press': 'SpYC0Kp',
  dips: '9WTm7dq',
  'cable-crossover': 'UKWTJWR',
  'seated-cable-row': 'fUBheHs',
  'back-extension': 'zhMwOwE',
  'goblet-squat': 'yn8yg1r',
  'bulgarian-split-squat': 'qx4fgX7',
  'front-raise': '3eGE2JC',
  'face-pull': 'wqNPGCg',
  'hammer-curl': '2NpxjC1',
  'barbell-curl': '25GPyDY',
  'skull-crusher': 'h8LFzo9',
  'overhead-triceps-extension': 'PdmaD0N',
  'leg-raise': 'WhuFnR7',
  'mountain-climber': 'RJgzwny',
}

const MEDIA_URL = (import.meta.env.VITE_EXERCISEDB_MEDIA_URL as string | undefined) ?? 'https://static.exercisedb.dev/media'

export function exerciseDbGif(exerciseId: string): string | undefined {
  const id = exerciseId.startsWith('edb-') ? exerciseId.slice(4) : EXERCISEDB_IDS[exerciseId]
  return id && !NO_GIF.has(id) ? `${MEDIA_URL.replace(/\/$/, '')}/${id}.gif` : undefined
}

/** ExerciseDB 영문 단계별 설명 (용량이 커서 필요할 때만 로드) */
export async function exerciseDbSteps(edbId: string): Promise<string[]> {
  const all = (await import('./edb/instructions.json')).default as Record<string, string[]>
  return all[edbId] ?? []
}
