import { useEffect, useState } from 'react'
import ExercisePicker from '../components/ExercisePicker'
import { exerciseById } from '../data/exercises'
import { useNav } from '../nav'
import {
  ensureActiveWorkout,
  setData,
  updateWorkout,
  useData,
  useNow,
  workoutVolume,
  type ExerciseLog,
  type SetEntry,
  type Workout,
} from '../store'

const REST_SEC = 90

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 이 운동의 가장 최근 완료 기록 (지난번 무게/횟수 참고용) */
function lastSetsFor(workouts: Workout[], exerciseId: string, excludeId: string): SetEntry[] | undefined {
  for (const w of workouts) {
    if (w.id === excludeId || !w.endedAt) continue
    const e = w.exercises.find((x) => x.exerciseId === exerciseId)
    if (e) return e.sets.filter((s) => s.done)
  }
}

export default function WorkoutPage({ workoutId }: { workoutId?: string }) {
  const data = useData()
  const nav = useNav()
  const active = data.workouts.find((w) => w.id === data.activeWorkoutId)
  const viewing = workoutId ? data.workouts.find((w) => w.id === workoutId) : undefined

  if (viewing && viewing.id !== active?.id) return <WorkoutDetail w={viewing} />
  if (active) return <ActiveWorkout w={active} workouts={data.workouts} />

  const history = data.workouts.filter((w) => w.endedAt)
  return (
    <>
      <h1>운동</h1>
      <button
        className="btn primary block"
        style={{ padding: 16, fontSize: 16, marginBottom: 12 }}
        onClick={() => ensureActiveWorkout()}
      >
        새 운동 시작
      </button>
      <div className="card">
        <h2>운동 기록</h2>
        {history.length === 0 && <div className="empty small">완료한 운동이 여기에 쌓여요</div>}
        {history.map((w) => (
          <button key={w.id} className="list-item" onClick={() => nav({ tab: 'workout', id: w.id })}>
            <div className="avatar">📅</div>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{w.date}</div>
              <div className="small muted">
                {w.exercises.map((e) => exerciseById(e.exerciseId)?.name).join(', ')}
              </div>
            </div>
            <div className="small muted" style={{ textAlign: 'right' }}>
              {workoutVolume(w).toLocaleString()}kg
              <br />
              {w.endedAt ? Math.round((w.endedAt - w.startedAt) / 60000) + '분' : ''}
            </div>
          </button>
        ))}
      </div>
    </>
  )
}

function WorkoutDetail({ w }: { w: Workout }) {
  const nav = useNav()
  return (
    <>
      <button className="btn sm" onClick={() => nav({ tab: 'workout' })}>
        ← 목록
      </button>
      <h1>{w.date} 운동</h1>
      <div className="grid3" style={{ marginBottom: 12 }}>
        <div className="stat">
          <span className="small muted">시간</span>
          <b>{w.endedAt ? Math.round((w.endedAt - w.startedAt) / 60000) : 0}분</b>
        </div>
        <div className="stat">
          <span className="small muted">종목</span>
          <b>{w.exercises.length}</b>
        </div>
        <div className="stat">
          <span className="small muted">볼륨</span>
          <b>{workoutVolume(w).toLocaleString()}</b>
        </div>
      </div>
      {w.exercises.map((e, i) => (
        <div className="card" key={i}>
          <h3>{exerciseById(e.exerciseId)?.name}</h3>
          {e.sets
            .filter((s) => s.done)
            .map((s, j) => (
              <div key={j} className="small row between" style={{ padding: '4px 0' }}>
                <span className="muted">{j + 1}세트</span>
                <span>
                  {s.weight}kg × {s.reps}회
                </span>
              </div>
            ))}
        </div>
      ))}
      <button
        className="btn danger block"
        onClick={() => {
          if (!confirm('이 운동 기록을 삭제할까요?')) return
          setData((d) => ({ ...d, workouts: d.workouts.filter((x) => x.id !== w.id) }))
          nav({ tab: 'workout' })
        }}
      >
        기록 삭제
      </button>
    </>
  )
}

function ActiveWorkout({ w, workouts }: { w: Workout; workouts: Workout[] }) {
  const nav = useNav()
  const now = useNow()
  const [picking, setPicking] = useState(false)
  const [restUntil, setRestUntil] = useState<number | null>(null)
  const restLeft = restUntil ? Math.ceil((restUntil - now) / 1000) : 0

  useEffect(() => {
    if (restUntil && restLeft <= 0) {
      setRestUntil(null)
      navigator.vibrate?.([200, 100, 200])
    }
  }, [restUntil, restLeft])

  const setEx = (idx: number, fn: (e: ExerciseLog) => ExerciseLog) =>
    updateWorkout(w.id, (x) => ({ ...x, exercises: x.exercises.map((e, i) => (i === idx ? fn(e) : e)) }))

  const setSet = (ei: number, si: number, patch: Partial<SetEntry>) =>
    setEx(ei, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === si ? { ...s, ...patch } : s)) }))

  const finish = () => {
    const doneSets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)
    if (doneSets === 0) {
      if (!confirm('완료한 세트가 없어요. 이 운동을 취소할까요?')) return
      setData((d) => ({ ...d, workouts: d.workouts.filter((x) => x.id !== w.id), activeWorkoutId: undefined }))
      return
    }
    setData((d) => ({
      ...d,
      activeWorkoutId: undefined,
      workouts: d.workouts.map((x) =>
        x.id === w.id
          ? { ...x, endedAt: Date.now(), exercises: x.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length) }
          : x,
      ),
    }))
    nav({ tab: 'workout', id: w.id })
  }

  return (
    <>
      <div className="row between">
        <h1 style={{ marginBottom: 4 }}>운동 중</h1>
        <span className="accent" style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          ⏱ {fmt(Math.floor((now - w.startedAt) / 1000))}
        </span>
      </div>
      <p className="small muted" style={{ marginTop: 0 }}>
        볼륨 {workoutVolume(w).toLocaleString()}kg
      </p>

      {w.exercises.length === 0 && (
        <div className="card empty">
          운동을 추가해서 세트를 기록해보세요
        </div>
      )}

      {w.exercises.map((e, ei) => {
        const ex = exerciseById(e.exerciseId)
        const prev = lastSetsFor(workouts, e.exerciseId, w.id)
        return (
          <div className="card" key={ei}>
            <div className="row between">
              <h3 style={{ margin: 0 }}>{ex?.name}</h3>
              <div className="row">
                <button className="btn sm" onClick={() => nav({ tab: 'library', id: e.exerciseId })}>
                  자세
                </button>
                {ex?.coach && (
                  <button className="btn sm" onClick={() => nav({ tab: 'coach', id: e.exerciseId })}>
                    📷 AI
                  </button>
                )}
                <button
                  className="btn sm danger"
                  onClick={() =>
                    confirm(`${ex?.name}을(를) 삭제할까요?`) &&
                    updateWorkout(w.id, (x) => ({ ...x, exercises: x.exercises.filter((_, i) => i !== ei) }))
                  }
                >
                  ✕
                </button>
              </div>
            </div>
            {prev && (
              <div className="small muted" style={{ marginTop: 4 }}>
                지난번: {prev.map((s) => `${s.weight}×${s.reps}`).join(', ')}
              </div>
            )}
            <table className="sets">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>세트</th>
                  <th>kg</th>
                  <th>회</th>
                  <th style={{ width: 44 }}>완료</th>
                </tr>
              </thead>
              <tbody>
                {e.sets.map((s, si) => (
                  <tr key={si} className={s.done ? 'done' : ''}>
                    <td className="muted">{si + 1}</td>
                    <td>
                      <input
                        className="input num"
                        type="number"
                        inputMode="decimal"
                        value={s.weight || ''}
                        placeholder={String(prev?.[si]?.weight ?? 0)}
                        onChange={(ev) => setSet(ei, si, { weight: Number(ev.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        className="input num"
                        type="number"
                        inputMode="numeric"
                        value={s.reps || ''}
                        placeholder={String(prev?.[si]?.reps ?? 0)}
                        onChange={(ev) => setSet(ei, si, { reps: Number(ev.target.value) })}
                      />
                    </td>
                    <td>
                      <button
                        className={`check ${s.done ? 'on' : ''}`}
                        onClick={() => {
                          const patch: Partial<SetEntry> = { done: !s.done }
                          // 비워둔 칸은 지난번 기록 → 바로 위 세트 순으로 채움
                          if (!s.done) {
                            const fallback = prev?.[si] ?? e.sets[si - 1]
                            if (!s.weight && fallback) patch.weight = fallback.weight
                            if (!s.reps && fallback) patch.reps = fallback.reps
                            setRestUntil(Date.now() + REST_SEC * 1000)
                          }
                          setSet(ei, si, patch)
                        }}
                      >
                        ✓
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 8 }}>
              <button
                className="btn sm grow"
                onClick={() =>
                  setEx(ei, (x) => {
                    const last = x.sets.at(-1)
                    return { ...x, sets: [...x.sets, { weight: last?.weight ?? 0, reps: last?.reps ?? 0, done: false }] }
                  })
                }
              >
                + 세트 추가
              </button>
              {e.sets.length > 0 && (
                <button className="btn sm" onClick={() => setEx(ei, (x) => ({ ...x, sets: x.sets.slice(0, -1) }))}>
                  − 세트
                </button>
              )}
            </div>
          </div>
        )
      })}

      <button className="btn block" style={{ marginBottom: 10 }} onClick={() => setPicking(true)}>
        + 운동 추가
      </button>
      <button className="btn primary block" onClick={finish}>
        운동 완료
      </button>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            const prev = lastSetsFor(workouts, ex.id, w.id)
            const sets: SetEntry[] = prev?.length
              ? prev.map((s) => ({ ...s, done: false }))
              : Array.from({ length: 3 }, () => ({ weight: 0, reps: 10, done: false }))
            updateWorkout(w.id, (x) => ({ ...x, exercises: [...x.exercises, { exerciseId: ex.id, sets }] }))
            setPicking(false)
          }}
        />
      )}

      {restUntil && restLeft > 0 && (
        <div className="rest">
          <span>휴식</span>
          <span className="grow" style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(restLeft)}
          </span>
          <button className="btn sm" onClick={() => setRestUntil((t) => (t ?? Date.now()) + 30000)}>
            +30초
          </button>
          <button className="btn sm" onClick={() => setRestUntil(null)}>
            건너뛰기
          </button>
        </div>
      )}
    </>
  )
}
