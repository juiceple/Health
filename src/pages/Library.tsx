import { useState } from 'react'
import { ExerciseRow, useExerciseFilter } from '../components/ExercisePicker'
import MotionDemo from '../components/MotionDemo'
import { exerciseById } from '../data/exercises'
import { VIDEOS } from '../data/videos'
import { useNav } from '../nav'
import { setVideo, useData, youtubeId } from '../store'

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
        <h2>동작 시범</h2>
        <MotionDemo exerciseId={ex.id} primary={ex.primary} secondary={ex.secondary} />
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

      <VideoCard exerciseId={ex.id} name={ex.name} videoId={data.videos?.[ex.id]} />

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

function VideoCard({ exerciseId, name, videoId }: { exerciseId: string; name: string; videoId?: string }) {
  const [url, setUrl] = useState('')
  const [editing, setEditing] = useState(false)
  const preset = VIDEOS[exerciseId]
  // 사용자가 등록한 영상이 있으면 우선, 없으면 추천 영상
  const current = videoId ?? preset?.id
  const isPreset = !videoId && !!preset
  const search = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} 자세`)}`
  const save = () => {
    const id = youtubeId(url)
    if (!id) return alert('유튜브 링크를 확인해주세요')
    setVideo(exerciseId, id)
    setUrl('')
    setEditing(false)
  }

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>▶ 영상으로 보기</h2>
        {current && !editing && (
          <button className="btn sm" onClick={() => setEditing(true)}>
            다른 영상
          </button>
        )}
      </div>
      {current && !editing ? (
        <>
          <div className="video">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${current}?rel=0&playsinline=1`}
              title={`${name} 자세 영상`}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            {isPreset ? (
              <>
                추천 영상 · <b style={{ color: 'var(--text)' }}>{preset.title}</b> — {preset.channel}
              </>
            ) : (
              '내가 등록한 영상'
            )}
          </p>
        </>
      ) : (
        <>
          <a className="btn primary block" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }} href={search} target="_blank" rel="noreferrer">
            유튜브에서 "{name} 자세" 영상 찾기
          </a>
          <p className="small muted">마음에 드는 영상 링크를 붙여넣으면 여기서 바로 볼 수 있어요.</p>
          <div className="row">
            <input
              className="input"
              placeholder="https://youtu.be/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
            <button className="btn sm" onClick={save} disabled={!url}>
              등록
            </button>
          </div>
          {current && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm" onClick={() => setEditing(false)}>
                취소
              </button>
              {videoId && (
                <button
                  className="btn sm"
                  onClick={() => {
                    setVideo(exerciseId, undefined)
                    setEditing(false)
                  }}
                >
                  {preset ? '추천 영상으로 되돌리기' : '영상 삭제'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
