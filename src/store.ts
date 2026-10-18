import type { Routine } from './data/routines'
import { useEffect, useState } from 'react'

export type SetEntry = { weight: number; reps: number; done: boolean }
/** 루틴에서 시작한 운동의 목표 (unit 'sec' 이면 reps는 초) */
export type Target = { sets: number; reps: number; unit?: 'reps' | 'sec'; rest: number; note?: string }
export type ExerciseLog = { exerciseId: string; sets: SetEntry[]; target?: Target }
export type Workout = {
  id: string
  date: string // YYYY-MM-DD
  startedAt: number
  endedAt?: number
  /** 루틴으로 시작한 경우 루틴 정보 (day: 여러 날짜로 나뉜 루틴의 몇 번째 날) */
  routine?: { id: string; name: string; day: number }
  exercises: ExerciseLog[]
  note?: string
}
export type WeightEntry = { date: string; kg: number; bodyFat?: number }
export type Profile = { heightCm?: number; goalKg?: number; name?: string }

export type AppData = {
  workouts: Workout[]
  weights: WeightEntry[]
  profile: Profile
  activeWorkoutId?: string
  /** 운동별로 사용자가 등록한 유튜브 영상 ID */
  videos?: Record<string, string>
  /** 사용자가 만든 루틴 */
  routines?: Routine[]
}

const KEY = 'fitlog:v1'
const empty: AppData = { workouts: [], weights: [], profile: {} }

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...empty, ...JSON.parse(raw) } : empty
  } catch {
    return empty
  }
}

// 탭 간 공유를 위한 단일 인메모리 스토어
let state: AppData = load()
const listeners = new Set<() => void>()

export const getData = () => state

export function setData(update: (d: AppData) => AppData) {
  state = update(state)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // 저장 공간 부족/비공개 모드: 메모리 상태는 유지
  }
  listeners.forEach((l) => l())
}

export function useData(): AppData {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return state
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export function today(d = new Date()): string {
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 10)
}

export function workoutVolume(w: Workout): number {
  return w.exercises.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.done).reduce((a, s) => a + s.weight * s.reps, 0),
    0,
  )
}

export function upsertWeight(entry: WeightEntry) {
  setData((d) => ({
    ...d,
    weights: [...d.weights.filter((w) => w.date !== entry.date), entry].sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
  }))
}

/** 진행 중인 운동이 없으면 새로 만들고 id를 반환 */
export function ensureActiveWorkout(): string {
  if (state.activeWorkoutId && state.workouts.some((w) => w.id === state.activeWorkoutId)) {
    return state.activeWorkoutId
  }
  const w: Workout = { id: uid(), date: today(), startedAt: Date.now(), exercises: [] }
  setData((d) => ({ ...d, workouts: [w, ...d.workouts], activeWorkoutId: w.id }))
  return w.id
}

export function updateWorkout(id: string, fn: (w: Workout) => Workout) {
  setData((d) => ({ ...d, workouts: d.workouts.map((w) => (w.id === id ? fn(w) : w)) }))
}

/** AI 코치에서 센 반복 수를 진행 중인 운동에 한 세트로 추가 */
export function addCoachSet(exerciseId: string, reps: number, weight = 0) {
  const id = ensureActiveWorkout()
  updateWorkout(id, (w) => {
    const existing = w.exercises.find((e) => e.exerciseId === exerciseId)
    const set: SetEntry = { weight, reps, done: true }
    return existing
      ? {
          ...w,
          exercises: w.exercises.map((e) =>
            e === existing ? { ...e, sets: [...e.sets, set] } : e,
          ),
        }
      : { ...w, exercises: [...w.exercises, { exerciseId, sets: [set] }] }
  })
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/** 유튜브 링크(watch, youtu.be, shorts, embed)에서 영상 ID 추출 */
export function youtubeId(url: string): string | undefined {
  const m = url.trim().match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/)
  return m?.[1] ?? (/^[\w-]{11}$/.test(url.trim()) ? url.trim() : undefined)
}

export function setVideo(exerciseId: string, id: string | undefined) {
  setData((d) => {
    const videos = { ...d.videos }
    if (id) videos[exerciseId] = id
    else delete videos[exerciseId]
    return { ...d, videos }
  })
}

/** 이 운동의 가장 최근 완료 세트 무게 (루틴 시작 시 기본값) */
function lastWeight(exerciseId: string): number {
  for (const w of state.workouts) {
    if (!w.endedAt) continue
    const e = w.exercises.find((x) => x.exerciseId === exerciseId)
    const done = e?.sets.filter((s) => s.done)
    if (done?.length) return done[done.length - 1].weight
  }
  return 0
}

/** 루틴으로 새 운동 시작. 진행 중인 운동이 있으면 시작하지 않고 false */
export function startRoutine(routine: Routine, day = 0): boolean {
  const active = state.workouts.find((w) => w.id === state.activeWorkoutId)
  if (active && active.exercises.length) return false
  const d = routine.days[day]
  const w: Workout = {
    id: uid(),
    date: today(),
    startedAt: Date.now(),
    routine: { id: routine.id, name: routine.days.length > 1 ? `${routine.title} · ${d.name}` : routine.title, day },
    exercises: d.items.map((it) => {
      const weight = it.unit === 'sec' ? 0 : lastWeight(it.exerciseId)
      return {
        exerciseId: it.exerciseId,
        target: { sets: it.sets, reps: it.reps, unit: it.unit, rest: it.rest, note: it.note },
        sets: Array.from({ length: it.sets }, () => ({ weight, reps: it.reps, done: false })),
      }
    }),
  }
  setData((s) => ({
    ...s,
    workouts: [w, ...s.workouts.filter((x) => x.id !== active?.id)],
    activeWorkoutId: w.id,
  }))
  return true
}

/** 여러 날짜로 나뉜 루틴에서 다음에 할 날 (마지막으로 완료한 날의 다음) */
export function nextRoutineDay(routine: Routine, workouts: Workout[]): number {
  const last = workouts.find((w) => w.endedAt && w.routine?.id === routine.id)
  return last ? (last.routine!.day + 1) % routine.days.length : 0
}

export function saveRoutine(routine: Routine) {
  setData((d) => {
    const list = d.routines ?? []
    const exists = list.some((r) => r.id === routine.id)
    return { ...d, routines: exists ? list.map((r) => (r.id === routine.id ? routine : r)) : [...list, routine] }
  })
}

export function deleteRoutine(id: string) {
  setData((d) => ({ ...d, routines: (d.routines ?? []).filter((r) => r.id !== id) }))
}
