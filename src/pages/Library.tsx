import { ExerciseRow, useExerciseFilter } from '../components/ExercisePicker'
import { exerciseById } from '../data/exercises'
import { useNav } from '../nav'
import { useData } from '../store'

export default function Library({ exerciseId }: { exerciseId?: string }) {
  const nav = useNav()
  const { list, controls } = useExerciseFilter()
  const ex = exerciseId ? exerciseById(exerciseId) : undefined

  if (ex) return <Detail id={ex.id} />

  return (
    <>
      <h1>운동법</h1>
      {controls}
      <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {list.map((e) => (
          <ExerciseRow key={e.id} e={e} onClick={() => nav({ tab: 'library', id: e.id })} />
        ))}
        {list.length === 0 && <div className="empty small">검색 결과가 없어요</div>}
      </div>
    </>
  )
}

function Detail({ id }: { id: string }) {
  const nav = useNav()
  const data = useData()
  const ex = exerciseById(id)!

  // 이 운동의 최고 기록 (무게 기준)
  let best: { weight: number; reps: number; date: string } | undefined
  for (const w of data.workouts) {
    for (const e of w.exercises) {
      if (e.exerciseId !== id) continue
      for (const s of e.sets) {
        if (s.done && (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)))
          best = { weight: s.weight, reps: s.reps, date: w.date }
      }
    }
  }

  return (
    <>
      <button className="btn sm" onClick={() => history.back()}>
        ← 뒤로
      </button>
      <h1 style={{ marginBottom: 6 }}>{ex.name}</h1>
      <div style={{ marginBottom: 14 }}>
        <span className="tag">{ex.category}</span>
        <span className="tag">{ex.equipment}</span>
        {ex.coach && <span className="tag ai">AI 코칭 지원</span>}
      </div>

      <div className="card">
        <h2>타겟 근육</h2>
        <div className="row wrap">
          {ex.primary.map((m) => (
            <span key={m} className="chip on">
              {m}
            </span>
          ))}
          {ex.secondary.map((m) => (
            <span key={m} className="chip">
              {m}
            </span>
          ))}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          초록색 = 주동근, 테두리 = 보조근
        </p>
      </div>

      {ex.coach && (
        <button className="btn primary block" style={{ marginBottom: 12 }} onClick={() => nav({ tab: 'coach', id: ex.id })}>
          📷 AI 코치로 자세 체크하기
        </button>
      )}

      <div className="card">
        <h2>운동 방법</h2>
        <ol className="steps">
          {ex.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>

      <div className="card">
        <h2 style={{ color: 'var(--bad)' }}>⚠️ 흔한 실수</h2>
        <ul className="dots">
          {ex.mistakes.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 className="accent">💡 팁</h2>
        <ul className="dots">
          {ex.tips.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
          {ex.cameraHint && <li>AI 코칭 시 카메라 위치: {ex.cameraHint}</li>}
        </ul>
      </div>

      {best && (
        <div className="card">
          <h2>내 최고 기록</h2>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {best.weight}kg × {best.reps}회
          </div>
          <div className="small muted">{best.date}</div>
        </div>
      )}
    </>
  )
}
