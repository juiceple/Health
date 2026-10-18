import { useMemo, useState } from 'react'
import { CATEGORIES, EXERCISES, type Category, type Exercise } from '../data/exercises'

const PAGE = 50

export function useExerciseFilter() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | '전체'>('전체')
  const [limit, setLimit] = useState(PAGE)
  const all = useMemo(() => {
    // 공백으로 나눈 단어가 한국어 이름·영문 이름·근육·기구 중 어디엔가 모두 들어 있으면 일치
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return EXERCISES.filter((e) => {
      if (cat !== '전체' && e.category !== cat) return false
      if (!terms.length) return true
      const hay = `${e.name} ${e.name.replace(/\s/g, '')} ${e.en ?? ''} ${e.primary.join(' ')} ${e.equipment}`.toLowerCase()
      return terms.every((t) => hay.includes(t))
    })
  }, [q, cat])
  const list = all.slice(0, limit)
  const more =
    all.length > limit ? (
      <button className="btn sm block" style={{ margin: '10px 0' }} onClick={() => setLimit((n) => n + PAGE * 2)}>
        더 보기 ({all.length - limit}개 남음)
      </button>
    ) : null
  const controls = (
    <>
      <input
        className="input"
        placeholder={`운동 ${EXERCISES.length.toLocaleString()}개 검색 (이름·부위·기구, 영문 가능)`}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setLimit(PAGE)
        }}
      />
      <div className="chips" style={{ marginTop: 10 }}>
        {(['전체', ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            className={`chip ${cat === c ? 'on' : ''}`}
            onClick={() => {
              setCat(c)
              setLimit(PAGE)
            }}
          >
            {c}
          </button>
        ))}
      </div>
    </>
  )
  return { list, controls, more, total: all.length }
}

export function ExerciseRow({ e, onClick }: { e: Exercise; onClick: () => void }) {
  return (
    <button className="list-item" onClick={onClick}>
      <div className="avatar">{EMOJI[e.category]}</div>
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{e.name}</div>
        <div className="small muted">
          {e.primary.join('·')} · {e.equipment}
          {e.en && <span style={{ opacity: 0.7 }}> · {e.en}</span>}
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
  유산소: '🏃',
}

export default function ExercisePicker({ onPick, onClose }: { onPick: (e: Exercise) => void; onClose: () => void }) {
  const { list, controls, more } = useExerciseFilter()
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
        {more}
      </div>
    </div>
  )
}
