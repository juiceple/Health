import { useState } from 'react'
import ExercisePicker, { EMOJI } from '../components/ExercisePicker'
import { exerciseDbGif } from '../data/exercisedb'
import { exerciseById } from '../data/exercises'
import { GOALS, PRESET_ROUTINES, targetLabel, type Goal, type Routine, type RoutineItem } from '../data/routines'
import { useNav } from '../nav'
import { deleteRoutine, nextRoutineDay, saveRoutine, startRoutine, uid, useData } from '../store'

export function useAllRoutines(): Routine[] {
  const data = useData()
  return [...(data.routines ?? []), ...PRESET_ROUTINES]
}

export const routineById = (all: Routine[], id: string) => all.find((r) => r.id === id)

/** 루틴 시작 공통 처리: 진행 중인 운동이 있으면 안내 */
export function useStartRoutine() {
  const nav = useNav()
  return (routine: Routine, day: number) => {
    if (!startRoutine(routine, day)) {
      alert('진행 중인 운동이 있어요. 먼저 완료하거나 취소한 뒤 루틴을 시작해주세요.')
    }
    nav({ tab: 'workout' })
  }
}

export default function Routines({ id }: { id?: string }) {
  const all = useAllRoutines()
  if (id === 'new') return <Editor />
  if (id?.startsWith('edit-')) {
    const r = routineById(all, id.slice(5))
    return <Editor base={r} />
  }
  if (id?.startsWith('copy-')) {
    const r = routineById(all, id.slice(5))
    return r ? <Editor base={{ ...r, id: uid(), title: `${r.title} (내 버전)`, custom: true }} isNew /> : <Editor />
  }
  const r = id ? routineById(all, id) : undefined
  if (r) return <Detail routine={r} />
  return <List />
}

function List() {
  const nav = useNav()
  const data = useData()
  const [goal, setGoal] = useState<Goal | '전체'>('전체')
  const mine = data.routines ?? []
  const presets = PRESET_ROUTINES.filter((r) => goal === '전체' || r.goal === goal)

  return (
    <>
      <h1>루틴</h1>
      <div className="card">
        <div className="row between" style={{ marginBottom: mine.length ? 4 : 0 }}>
          <h2 style={{ margin: 0 }}>내 루틴</h2>
          <button className="btn sm" onClick={() => nav({ tab: 'routines', id: 'new' })}>
            + 새 루틴
          </button>
        </div>
        {mine.length === 0 && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            직접 만들거나, 추천 루틴을 복사하거나, 끝낸 운동을 루틴으로 저장할 수 있어요.
          </p>
        )}
        {mine.map((r) => (
          <RoutineRow key={r.id} r={r} />
        ))}
      </div>

      <h2 style={{ margin: '18px 0 10px' }}>목표별 추천 루틴</h2>
      <div className="chips">
        {(['전체', ...GOALS] as const).map((g) => (
          <button key={g} className={`chip ${goal === g ? 'on' : ''}`} onClick={() => setGoal(g)}>
            {g}
          </button>
        ))}
      </div>
      <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {presets.map((r) => (
          <RoutineRow key={r.id} r={r} />
        ))}
      </div>
    </>
  )
}

function RoutineRow({ r }: { r: Routine }) {
  const nav = useNav()
  const count = r.days.reduce((n, d) => n + d.items.length, 0)
  return (
    <button className="list-item" onClick={() => nav({ tab: 'routines', id: r.id })}>
      <div className="avatar">{r.emoji}</div>
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{r.title}</div>
        <div className="small muted">
          {[r.goal, r.place, r.level, r.minutes ? `${r.minutes}분` : '', `${count}종목`].filter(Boolean).join(' · ')}
        </div>
      </div>
      <span className="muted">›</span>
    </button>
  )
}

function Thumb({ exerciseId }: { exerciseId: string }) {
  const ex = exerciseById(exerciseId)
  const gif = exerciseDbGif(exerciseId)
  return gif ? (
    <img className="thumb" src={gif} alt="" loading="lazy" />
  ) : (
    <div className="avatar">{ex ? EMOJI[ex.category] : '🏋️'}</div>
  )
}

function Detail({ routine }: { routine: Routine }) {
  const nav = useNav()
  const data = useData()
  const start = useStartRoutine()
  const suggested = nextRoutineDay(routine, data.workouts)
  const [day, setDay] = useState(suggested)
  const d = routine.days[Math.min(day, routine.days.length - 1)]
  const doneCount = data.workouts.filter((w) => w.endedAt && w.routine?.id === routine.id).length

  return (
    <>
      <button className="btn sm" onClick={() => nav({ tab: 'routines' })}>
        ← 루틴 목록
      </button>
      <h1 style={{ marginBottom: 6 }}>
        {routine.emoji} {routine.title}
      </h1>
      <div style={{ marginBottom: 12 }}>
        <span className="tag ai">{routine.goal}</span>
        <span className="tag">{routine.place}</span>
        <span className="tag">{routine.level}</span>
        {routine.minutes > 0 && <span className="tag">약 {routine.minutes}분</span>}
        {routine.perWeek && <span className="tag">{routine.perWeek}</span>}
      </div>
      {routine.desc && <p style={{ marginTop: 0 }}>{routine.desc}</p>}
      {doneCount > 0 && <p className="small accent">이 루틴으로 {doneCount}번 운동했어요</p>}

      {routine.days.length > 1 && (
        <div className="chips">
          {routine.days.map((x, i) => (
            <button key={i} className={`chip ${day === i ? 'on' : ''}`} onClick={() => setDay(i)}>
              {x.name}
              {i === suggested && ' · 오늘 차례'}
            </button>
          ))}
        </div>
      )}

      <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {d.items.map((it, i) => {
          const ex = exerciseById(it.exerciseId)
          return (
            <button key={i} className="list-item" onClick={() => nav({ tab: 'library', id: it.exerciseId })}>
              <Thumb exerciseId={it.exerciseId} />
              <div className="grow">
                <div style={{ fontWeight: 600 }}>
                  {i + 1}. {ex?.name ?? '알 수 없는 운동'}
                </div>
                <div className="small muted">{targetLabel(it)}</div>
                {it.note && <div className="small accent">{it.note}</div>}
              </div>
            </button>
          )
        })}
      </div>

      <button className="btn primary block" style={{ padding: 16, fontSize: 16, marginBottom: 12 }} onClick={() => start(routine, day)}>
        {routine.days.length > 1 ? `${d.name} 시작하기` : '이 루틴으로 운동 시작'}
      </button>

      {routine.tips.length > 0 && (
        <div className="card">
          <h2 className="accent">💡 루틴 팁</h2>
          <ul className="dots">
            {routine.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="row">
        {routine.custom ? (
          <>
            <button className="btn sm grow" onClick={() => nav({ tab: 'routines', id: `edit-${routine.id}` })}>
              수정
            </button>
            <button
              className="btn sm danger"
              onClick={() => {
                if (!confirm(`"${routine.title}" 루틴을 삭제할까요?`)) return
                deleteRoutine(routine.id)
                nav({ tab: 'routines' })
              }}
            >
              삭제
            </button>
          </>
        ) : (
          <button className="btn sm grow" onClick={() => nav({ tab: 'routines', id: `copy-${routine.id}` })}>
            내 루틴으로 복사해서 수정하기
          </button>
        )}
      </div>
    </>
  )
}

const blank = (): Routine => ({
  id: uid(),
  title: '',
  goal: '근력·전신',
  emoji: '⭐',
  level: '초급',
  place: '헬스장',
  minutes: 0,
  perWeek: '',
  desc: '',
  tips: [],
  days: [{ name: '루틴', items: [] }],
  custom: true,
})

function Editor({ base, isNew }: { base?: Routine; isNew?: boolean }) {
  const nav = useNav()
  const [r, setR] = useState<Routine>(() => structuredClone(base ?? blank()))
  const [day, setDay] = useState(0)
  const [picking, setPicking] = useState(false)
  const items = r.days[day].items

  const setItems = (fn: (xs: RoutineItem[]) => RoutineItem[]) =>
    setR((x) => ({ ...x, days: x.days.map((d, i) => (i === day ? { ...d, items: fn(d.items) } : d)) }))
  const setItem = (i: number, patch: Partial<RoutineItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const move = (i: number, dir: -1 | 1) =>
    setItems((xs) => {
      const j = i + dir
      if (j < 0 || j >= xs.length) return xs
      const copy = [...xs]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })

  const save = () => {
    if (!r.title.trim()) return alert('루틴 이름을 입력해주세요')
    if (r.days.some((d) => d.items.length === 0)) return alert('각 날짜에 운동을 1개 이상 추가해주세요')
    saveRoutine({ ...r, title: r.title.trim(), custom: true })
    nav({ tab: 'routines', id: r.id })
  }

  return (
    <>
      <button className="btn sm" onClick={() => history.back()}>
        ← 취소
      </button>
      <h1>{base && !isNew ? '루틴 수정' : '새 루틴'}</h1>

      <div className="card">
        <label className="small muted">루틴 이름</label>
        <input className="input" value={r.title} placeholder="예: 월요일 상체" onChange={(e) => setR({ ...r, title: e.target.value })} />
        <label className="small muted" style={{ display: 'block', marginTop: 10 }}>
          목표
        </label>
        <div className="chips" style={{ marginBottom: 0 }}>
          {GOALS.map((g) => (
            <button key={g} className={`chip ${r.goal === g ? 'on' : ''}`} onClick={() => setR({ ...r, goal: g })}>
              {g}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 6 }}>
          {(['헬스장', '집'] as const).map((p) => (
            <button key={p} className={`chip ${r.place === p ? 'on' : ''}`} onClick={() => setR({ ...r, place: p })}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {r.days.length > 1 && (
        <div className="chips">
          {r.days.map((d, i) => (
            <button key={i} className={`chip ${day === i ? 'on' : ''}`} onClick={() => setDay(i)}>
              {d.name}
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <h2>운동 ({items.length})</h2>
        {items.length === 0 && <div className="empty small">아래 버튼으로 운동을 추가하세요</div>}
        {items.map((it, i) => (
          <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
            <div className="row between">
              <div className="row grow" style={{ minWidth: 0 }}>
                <Thumb exerciseId={it.exerciseId} />
                <b className="grow" style={{ minWidth: 0 }}>
                  {exerciseById(it.exerciseId)?.name}
                </b>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn sm" onClick={() => move(i, -1)} aria-label="위로">
                  ↑
                </button>
                <button className="btn sm" onClick={() => move(i, 1)} aria-label="아래로">
                  ↓
                </button>
                <button className="btn sm danger" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} aria-label="삭제">
                  ✕
                </button>
              </div>
            </div>
            <div className="grid3" style={{ marginTop: 8, gridTemplateColumns: '1fr 1fr 1fr 64px' }}>
              <Num label="세트" value={it.sets} onChange={(v) => setItem(i, { sets: Math.max(1, v) })} />
              <Num label={it.unit === 'sec' ? '초' : '회'} value={it.reps} onChange={(v) => setItem(i, { reps: Math.max(1, v) })} />
              <Num label="휴식(초)" value={it.rest} onChange={(v) => setItem(i, { rest: Math.max(0, v) })} />
              <button
                className="btn sm"
                style={{ alignSelf: 'end' }}
                onClick={() => setItem(i, { unit: it.unit === 'sec' ? 'reps' : 'sec' })}
              >
                {it.unit === 'sec' ? '초 → 회' : '회 → 초'}
              </button>
            </div>
          </div>
        ))}
        <button className="btn block" style={{ marginTop: 12 }} onClick={() => setPicking(true)}>
          + 운동 추가
        </button>
      </div>

      <button className="btn primary block" onClick={save}>
        루틴 저장
      </button>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            setItems((xs) => [...xs, { exerciseId: ex.id, sets: 3, reps: 12, rest: 60 }])
            setPicking(false)
          }}
        />
      )}
    </>
  )
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="small muted">{label}</label>
      <input
        className="input num"
        type="number"
        inputMode="numeric"
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  )
}
