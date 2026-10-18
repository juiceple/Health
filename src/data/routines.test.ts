import { describe, expect, it } from 'vitest'
import { getData, nextRoutineDay, setData, startRoutine } from '../store'
import { exerciseById } from './exercises'
import { PRESET_ROUTINES } from './routines'

describe('preset routines', () => {
  it('only reference exercises that exist in the library', () => {
    for (const r of PRESET_ROUTINES)
      for (const d of r.days)
        for (const it of d.items) expect(exerciseById(it.exerciseId), `${r.id}: ${it.exerciseId}`).toBeDefined()
  })

  it('have unique ids and sane targets', () => {
    expect(new Set(PRESET_ROUTINES.map((r) => r.id)).size).toBe(PRESET_ROUTINES.length)
    for (const r of PRESET_ROUTINES)
      for (const d of r.days)
        for (const it of d.items) {
          expect(it.sets).toBeGreaterThan(0)
          expect(it.reps).toBeGreaterThan(0)
          expect(it.rest).toBeGreaterThanOrEqual(0)
        }
  })
})

describe('starting a routine', () => {
  const split = PRESET_ROUTINES.find((r) => r.days.length > 1)!

  it('prefills sets, carries last weight, refuses while a workout is in progress, and rotates days', () => {
    const benchDay = split.days.findIndex((d) => d.items.some((i) => i.exerciseId === 'bench-press'))
    // 지난번 벤치프레스 60kg 기록
    setData(() => ({
      workouts: [
        {
          id: 'old',
          date: '2026-01-01',
          startedAt: 0,
          endedAt: 1,
          routine: { id: split.id, name: split.title, day: benchDay },
          exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 60, reps: 8, done: true }] }],
        },
      ],
      weights: [],
      profile: {},
    }))
    expect(nextRoutineDay(split, getData().workouts)).toBe((benchDay + 1) % split.days.length)

    expect(startRoutine(split, benchDay)).toBe(true)
    const active = getData().workouts.find((w) => w.id === getData().activeWorkoutId)!
    const items = split.days[benchDay].items
    expect(active.exercises.map((e) => e.exerciseId)).toEqual(items.map((i) => i.exerciseId))
    const bench = active.exercises.find((e) => e.exerciseId === 'bench-press')!
    expect(bench.sets).toHaveLength(items.find((i) => i.exerciseId === 'bench-press')!.sets)
    expect(bench.sets[0]).toEqual({ weight: 60, reps: 8, done: false })
    expect(bench.target?.rest).toBeGreaterThan(0)

    // 진행 중인 운동이 있으면 새 루틴을 시작하지 않음
    expect(startRoutine(split, 0)).toBe(false)
  })
})
