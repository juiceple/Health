import { useState } from 'react'
import { CATEGORIES, EXERCISES, type Category, type Exercise } from '../data/exercises'

export function useExerciseFilter() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | '전체'>('전체')
  const list = EXERCISES.filter(
    (e) => (cat === '전체' || e.category === cat) && (q === '' || e.name.includes(q) || e.primary.some((m) => m.includes(q))),
  )
  const controls = (
    <>
      <input className="input" placeholder="운동 이름 또는 부위 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" style={{ marginTop: 10 }}>
        {(['전체', ...CATEGORIES] as const).map((c) => (
          <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
    </>
  )
  return { list, controls }
}

export function ExerciseRow({ e, onClick }: { e: Exercise; onClick: () => void }) {
  return (
    <button className="list-item" onClick={onClick}>
      <div className="avatar">{EMOJI[e.category]}</div>
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{e.name}</div>
        <div className="small muted">
          {e.primary.join('·')} · {e.equipment}
        </div>
      </div>
      {e.coach && <span className="tag ai">AI 코칭</span>}
    </button>
  )
}

export const EMOJI: Record<Category, string> = {
  가슴: '🫁',
  등: '🔙',
  하체: '🦵',
  어깨: '🤷',
  팔: '💪',
  복근: '🧱',
  맨몸: '🤸',
}

export default function ExercisePicker({ onPick, onClose }: { onPick: (e: Exercise) => void; onClose: () => void }) {
  const { list, controls } = useExerciseFilter()
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>운동 추가</h2>
          <button className="btn sm" onClick={onClose}>
            닫기
          </button>
        </div>
        {controls}
        {list.map((e) => (
          <ExerciseRow key={e.id} e={e} onClick={() => onPick(e)} />
        ))}
      </div>
    </div>
  )
}
