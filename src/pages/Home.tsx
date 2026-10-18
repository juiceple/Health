import { useRef } from 'react'
import { exerciseById } from '../data/exercises'
import { useNav } from '../nav'
import { ensureActiveWorkout, setData, today, useData, workoutVolume, type AppData } from '../store'

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return today(d)
}

/** 오늘(또는 어제)부터 거꾸로 연속 운동한 날 수 */
function streak(dates: Set<string>) {
  let n = 0
  let i = dates.has(today()) ? 0 : 1
  while (dates.has(daysAgo(i))) {
    n++
    i++
  }
  return n
}

export default function Home() {
  const data = useData()
  const nav = useNav()
  const fileRef = useRef<HTMLInputElement>(null)

  const finished = data.workouts.filter((w) => w.endedAt)
  const dates = new Set(finished.map((w) => w.date))
  const weekStart = daysAgo(6)
  const thisWeek = finished.filter((w) => w.date >= weekStart)
  const weekVolume = thisWeek.reduce((s, w) => s + workoutVolume(w), 0)

  const latest = data.weights.at(-1)
  const prev = data.weights.at(-2)
  const diff = latest && prev ? latest.kg - prev.kg : undefined

  const last7 = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i))
  const dow = ['일', '월', '화', '수', '목', '금', '토']

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fitlog-backup-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = async (f: File) => {
    try {
      const parsed = JSON.parse(await f.text()) as AppData
      if (!Array.isArray(parsed.workouts) || !Array.isArray(parsed.weights)) throw new Error()
      if (confirm('현재 데이터를 백업 파일로 덮어쓸까요?')) setData(() => ({ ...parsed, profile: parsed.profile ?? {} }))
    } catch {
      alert('올바른 백업 파일이 아니에요')
    }
  }

  return (
    <>
      <h1>
        안녕하세요{data.profile.name ? `, ${data.profile.name}님` : ''} 👋
      </h1>

      <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>이번 주</h2>
          <span className="accent small">🔥 {streak(dates)}일 연속</span>
        </div>
        <div className="row between" style={{ marginBottom: 14 }}>
          {last7.map((d) => (
            <div key={d} style={{ textAlign: 'center', flex: 1 }}>
              <div className="small muted">{dow[new Date(d + 'T00:00').getDay()]}</div>
              <div
                style={{
                  width: 30,
                  height: 30,
                  margin: '4px auto 0',
                  borderRadius: 10,
                  display: 'grid',
                  placeItems: 'center',
                  background: dates.has(d) ? 'var(--accent)' : 'var(--surface-2)',
                  color: dates.has(d) ? 'var(--accent-ink)' : 'var(--muted)',
                  fontSize: 13,
                  fontWeight: 600,
                  outline: d === today() ? '2px solid var(--accent)' : 'none',
                  outlineOffset: 2,
                }}
              >
                {Number(d.slice(8))}
              </div>
            </div>
          ))}
        </div>
        <div className="grid3">
          <div className="stat">
            <span className="small muted">운동</span>
            <b>{thisWeek.length}회</b>
          </div>
          <div className="stat">
            <span className="small muted">볼륨</span>
            <b>{weekVolume >= 1000 ? (weekVolume / 1000).toFixed(1) + 't' : weekVolume + 'kg'}</b>
          </div>
          <div className="stat" onClick={() => nav({ tab: 'weight' })} style={{ cursor: 'pointer' }}>
            <span className="small muted">체중</span>
            <b>{latest ? `${latest.kg}kg` : '—'}</b>
            {diff !== undefined && (
              <span className="small" style={{ color: diff <= 0 ? 'var(--accent)' : 'var(--warn)' }}>
                {diff > 0 ? '▲' : diff < 0 ? '▼' : ''} {Math.abs(diff).toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        className="btn primary block"
        style={{ padding: 16, fontSize: 16, marginBottom: 12 }}
        onClick={() => {
          ensureActiveWorkout()
          nav({ tab: 'workout' })
        }}
      >
        {data.activeWorkoutId ? '진행 중인 운동 이어하기 →' : '오늘의 운동 시작하기'}
      </button>

      <button
        className="card btn block"
        style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}
        onClick={() => nav({ tab: 'routines' })}
      >
        <div style={{ fontSize: 26 }}>📋</div>
        <div className="grow">
          <div>목표별 운동 루틴</div>
          <div className="small muted" style={{ fontWeight: 400 }}>
            살 빼기 · 복근 · 팔뚝 · 어깨 · 힙업 · 전신
          </div>
        </div>
        <span className="muted">›</span>
      </button>

      <div className="grid2" style={{ marginBottom: 12 }}>
        <button className="card btn" style={{ margin: 0, textAlign: 'left' }} onClick={() => nav({ tab: 'coach' })}>
          <div style={{ fontSize: 22 }}>📷</div>
          <div>AI 자세 코치</div>
          <div className="small muted" style={{ fontWeight: 400 }}>
            카메라로 자세 교정·횟수 측정
          </div>
        </button>
        <button className="card btn" style={{ margin: 0, textAlign: 'left' }} onClick={() => nav({ tab: 'weight' })}>
          <div style={{ fontSize: 22 }}>⚖️</div>
          <div>체중 기록</div>
          <div className="small muted" style={{ fontWeight: 400 }}>
            {data.weights.some((w) => w.date === today()) ? '오늘 기록 완료 ✓' : '오늘 아직 기록 안 함'}
          </div>
        </button>
      </div>

      <div className="card">
        <h2>최근 운동</h2>
        {finished.length === 0 && <div className="empty small">아직 완료한 운동이 없어요</div>}
        {finished.slice(0, 5).map((w) => (
          <button key={w.id} className="list-item" onClick={() => nav({ tab: 'workout', id: w.id })}>
            <div className="avatar">💪</div>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>
                {w.exercises.map((e) => exerciseById(e.exerciseId)?.name).filter(Boolean).slice(0, 3).join(', ') ||
                  '운동'}
              </div>
              <div className="small muted">
                {w.date} · {w.exercises.length}종목 · {workoutVolume(w).toLocaleString()}kg
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="card">
        <h2>데이터</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          기록은 이 기기의 브라우저에 저장돼요. 기기를 바꾸기 전에 백업하세요.
        </p>
        <div className="row">
          <button className="btn sm" onClick={exportData}>
            백업 내보내기
          </button>
          <button className="btn sm" onClick={() => fileRef.current?.click()}>
            백업 불러오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
          />
        </div>
      </div>
    </>
  )
}
