import { useState } from 'react'
import LineChart from '../components/LineChart'
import { setData, today, upsertWeight, useData } from '../store'

type Range = 30 | 90 | 365

function bmiLabel(bmi: number) {
  if (bmi < 18.5) return '저체중'
  if (bmi < 23) return '정상'
  if (bmi < 25) return '과체중'
  return '비만'
}

export default function WeightPage() {
  const data = useData()
  const { weights, profile } = data
  const todays = weights.find((w) => w.date === today())
  const latest = weights.at(-1)

  const [date, setDate] = useState(today())
  const [kg, setKg] = useState(todays ? String(todays.kg) : latest ? String(latest.kg) : '')
  const [fat, setFat] = useState(todays?.bodyFat ? String(todays.bodyFat) : '')
  const [range, setRange] = useState<Range>(30)
  const [editProfile, setEditProfile] = useState(!profile.heightCm)
  const [showAll, setShowAll] = useState(false)

  const from = new Date()
  from.setDate(from.getDate() - range)
  const inRange = weights.filter((w) => w.date >= today(from))

  const changeSince = (days: number) => {
    if (!latest) return undefined
    const d = new Date()
    d.setDate(d.getDate() - days)
    const base = weights.find((w) => w.date >= today(d))
    return base && base !== latest ? latest.kg - base.kg : undefined
  }

  const bmi = latest && profile.heightCm ? latest.kg / (profile.heightCm / 100) ** 2 : undefined
  const toGoal = latest && profile.goalKg ? latest.kg - profile.goalKg : undefined

  // 날짜를 바꾸면 그 날의 기록을 불러와 다른 날 값으로 덮어쓰지 않게 함
  const selectDate = (d: string) => {
    setDate(d)
    const entry = weights.find((w) => w.date === d)
    if (entry) {
      setKg(String(entry.kg))
      setFat(entry.bodyFat ? String(entry.bodyFat) : '')
    } else {
      setFat('')
    }
  }

  const save = () => {
    const v = Number(kg)
    if (!v || v < 20 || v > 400) return alert('체중을 올바르게 입력해주세요')
    upsertWeight({ date, kg: Math.round(v * 10) / 10, bodyFat: fat ? Number(fat) : undefined })
  }

  const Change = ({ v, label }: { v?: number; label: string }) => (
    <div className="stat">
      <span className="small muted">{label}</span>
      <b style={{ color: v === undefined ? undefined : v <= 0 ? 'var(--accent)' : 'var(--warn)' }}>
        {v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}kg`}
      </b>
    </div>
  )

  return (
    <>
      <h1>체중 관리</h1>

      <div className="card">
        <h2>체중 기록</h2>
        <div className="row" style={{ marginBottom: 8 }}>
          <input className="input" type="date" value={date} max={today()} onChange={(e) => selectDate(e.target.value)} />
        </div>
        <div className="row">
          <div className="grow">
            <label className="small muted">체중 (kg)</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              placeholder="70.0"
            />
          </div>
          <div className="grow">
            <label className="small muted">체지방률 (%) · 선택</label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={fat}
              onChange={(e) => setFat(e.target.value)}
              placeholder="—"
            />
          </div>
        </div>
        <button className="btn primary block" style={{ marginTop: 12 }} onClick={save}>
          {weights.some((w) => w.date === date) ? '기록 수정' : '기록 저장'}
        </button>
      </div>

      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>추이</h2>
          <div className="row">
            {([30, 90, 365] as Range[]).map((r) => (
              <button key={r} className={`chip ${range === r ? 'on' : ''}`} onClick={() => setRange(r)}>
                {r === 365 ? '1년' : `${r}일`}
              </button>
            ))}
          </div>
        </div>
        <LineChart
          data={inRange.map((w) => ({ label: w.date.slice(5).replace('-', '/'), value: w.kg }))}
          goal={profile.goalKg}
          unit="kg"
        />
        <div className="grid3" style={{ marginTop: 12 }}>
          <Change label="7일 변화" v={changeSince(7)} />
          <Change label="30일 변화" v={changeSince(30)} />
          <div className="stat">
            <span className="small muted">목표까지</span>
            <b>{toGoal === undefined ? '—' : toGoal <= 0 ? '달성 🎉' : `${toGoal.toFixed(1)}kg`}</b>
          </div>
        </div>
        {bmi && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            BMI <b style={{ color: 'var(--text)' }}>{bmi.toFixed(1)}</b> ({bmiLabel(bmi)}, 아시아·태평양 기준)
          </p>
        )}
      </div>

      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>내 정보</h2>
          <button className="btn sm" onClick={() => setEditProfile((v) => !v)}>
            {editProfile ? '완료' : '수정'}
          </button>
        </div>
        {editProfile ? (
          <div className="grid2" style={{ marginTop: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="small muted">이름 (선택)</label>
              <input
                className="input"
                value={profile.name ?? ''}
                onChange={(e) => setData((d) => ({ ...d, profile: { ...d.profile, name: e.target.value || undefined } }))}
              />
            </div>
            <div>
              <label className="small muted">키 (cm)</label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={profile.heightCm ?? ''}
                onChange={(e) =>
                  setData((d) => ({ ...d, profile: { ...d.profile, heightCm: Number(e.target.value) || undefined } }))
                }
              />
            </div>
            <div>
              <label className="small muted">목표 체중 (kg)</label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={profile.goalKg ?? ''}
                onChange={(e) =>
                  setData((d) => ({ ...d, profile: { ...d.profile, goalKg: Number(e.target.value) || undefined } }))
                }
              />
            </div>
          </div>
        ) : (
          <p className="small muted" style={{ marginBottom: 0 }}>
            키 {profile.heightCm ?? '—'}cm · 목표 {profile.goalKg ?? '—'}kg
          </p>
        )}
      </div>

      <div className="card">
        <h2>기록 목록</h2>
        {weights.length === 0 && <div className="empty small">아직 기록이 없어요</div>}
        {[...weights].reverse().slice(0, showAll ? undefined : 14).map((w, i) => {
          const prev = weights[weights.length - 2 - i]
          const d = prev ? w.kg - prev.kg : 0
          return (
            <div key={w.date} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span className="muted small">{w.date}</span>
              <span className="grow" style={{ textAlign: 'right', fontWeight: 600 }}>
                {w.kg}kg{w.bodyFat ? <span className="muted small"> · {w.bodyFat}%</span> : null}
              </span>
              <span className="small" style={{ width: 52, textAlign: 'right', color: d <= 0 ? 'var(--accent)' : 'var(--warn)' }}>
                {prev ? `${d > 0 ? '+' : ''}${d.toFixed(1)}` : ''}
              </span>
              <button
                className="btn sm danger"
                onClick={() => setData((x) => ({ ...x, weights: x.weights.filter((y) => y.date !== w.date) }))}
              >
                ✕
              </button>
            </div>
          )
        })}
        {!showAll && weights.length > 14 && (
          <button className="btn sm block" style={{ marginTop: 10 }} onClick={() => setShowAll(true)}>
            전체 보기 ({weights.length}개)
          </button>
        )}
      </div>
    </>
  )
}
