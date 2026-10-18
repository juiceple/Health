import { useEffect, useState } from 'react'

export type SetEntry = { weight: number; reps: number; done: boolean }
export type ExerciseLog = { exerciseId: string; sets: SetEntry[] }
export type Workout = {
  id: string
  date: string // YYYY-MM-DD
  startedAt: number
  endedAt?: number
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
