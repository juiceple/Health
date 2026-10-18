import { useEffect, useState } from 'react'
import ExercisePicker from '../components/ExercisePicker'
import { exerciseById } from '../data/exercises'
import { PRESET_ROUTINES, type Routine } from '../data/routines'
import { useNav } from '../nav'
import { useStartRoutine } from './Routines'
import {
  ensureActiveWorkout,
  nextRoutineDay,
  saveRoutine,
  setData,
  uid,
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
        빈 운동 시작
      </button>
      <RoutinePicks />
      <div className="card">
        <h2>운동 기록</h2>
        {history.length === 0 && <div className="empty small">완료한 운동이 여기에 쌓여요</div>}
        {history.map((w) => (
          <button key={w.id} className="list-item" onClick={() => nav({ tab: 'workout', id: w.id })}>
            <div className="avatar">📅</div>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>
                {w.date}
                {w.routine && <span className="small accent"> · {w.routine.name}</span>}
              </div>
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
      <h1 style={{ marginBottom: w.routine ? 2 : undefined }}>{w.date} 운동</h1>
      {w.routine && <p className="small accent" style={{ marginTop: 0 }}>{w.routine.name}</p>}
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
      <button className="btn block" style={{ marginBottom: 10 }} onClick={() => saveAsRoutine(w)}>
        ⭐ 이 운동을 내 루틴으로 저장
      </button>
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
  // now는 1초마다 갱신되므로 렌더 시점의 실제 시간으로 계산 (세트 완료 직후 1초 더 보이는 문제 방지)
  const restLeft = restUntil ? Math.ceil((restUntil - Math.max(now, Date.now())) / 1000) : 0

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
        <h1 style={{ marginBottom: 4 }}>{w.routine ? w.routine.name : '운동 중'}</h1>
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
            {e.target && (
              <div className="small accent" style={{ marginTop: 4 }}>
                목표 {e.target.sets}세트 × {e.target.reps}
                {e.target.unit === 'sec' ? '초' : '회'} · 휴식 {e.target.rest}초{e.target.note ? ` · ${e.target.note}` : ''}
              </div>
            )}
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
                  <th>{e.target?.unit === 'sec' ? '초' : '회'}</th>
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
                            setRestUntil(Date.now() + (e.target?.rest ?? REST_SEC) * 1000)
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

      {/* 휴식 타이머가 하단 버튼을 가리지 않도록 여백 확보 */}
      {restUntil && restLeft > 0 && <div style={{ height: 64 }} />}
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

/** 끝낸 운동을 내 루틴으로 저장하고 이름을 고칠 수 있게 수정 화면으로 이동 */
function saveAsRoutine(w: Workout) {
  const routine: Routine = {
    id: uid(),
    title: w.routine ? `${w.routine.name} (내 버전)` : `${w.date} 운동`,
    goal: '근력·전신',
    emoji: '⭐',
    level: '초급',
    place: '헬스장',
    minutes: w.endedAt ? Math.round((w.endedAt - w.startedAt) / 60000) : 0,
    perWeek: '',
    desc: '',
    tips: [],
    custom: true,
    days: [
      {
        name: '루틴',
        items: w.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          sets: e.sets.length || e.target?.sets || 3,
          reps: e.sets.at(-1)?.reps || e.target?.reps || 10,
          unit: e.target?.unit,
          rest: e.target?.rest ?? REST_SEC,
        })),
      },
    ],
  }
  saveRoutine(routine)
  location.hash = `/routines/edit-${routine.id}`
}

/** 운동 탭: 루틴으로 바로 시작 */
function RoutinePicks() {
  const nav = useNav()
  const data = useData()
  const start = useStartRoutine()
  const mine = data.routines ?? []
  const recentIds = data.workouts.filter((w) => w.routine).map((w) => w.routine!.id)
  const all: Routine[] = [...mine, ...PRESET_ROUTINES]
  // 최근에 한 루틴 → 내 루틴 → 추천 순
  const picks = [...new Set([...recentIds, ...mine.map((r) => r.id), ...PRESET_ROUTINES.map((r) => r.id)])]
    .map((id) => all.find((r) => r.id === id))
    .filter((r): r is Routine => !!r)
    .slice(0, 4)

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>루틴으로 시작</h2>
        <button className="btn sm" onClick={() => nav({ tab: 'routines' })}>
          전체 보기
        </button>
      </div>
      {picks.map((r) => {
        const day = nextRoutineDay(r, data.workouts)
        return (
          <div key={r.id} className="list-item" style={{ cursor: 'default' }}>
            <div className="avatar">{r.emoji}</div>
            <button className="grow" style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0 }} onClick={() => nav({ tab: 'routines', id: r.id })}>
              <div style={{ fontWeight: 600 }}>{r.title}</div>
              <div className="small muted">
                {r.days.length > 1 ? `다음: ${r.days[day].name}` : `${r.days[0].items.length}종목`}
                {r.minutes ? ` · ${r.minutes}분` : ''}
              </div>
            </button>
            <button className="btn sm primary" onClick={() => start(r, day)}>
              시작
            </button>
          </div>
        )
      })}
    </div>
  )
}
