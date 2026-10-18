import { useEffect, useRef, useState } from 'react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import MotionDemo from '../components/MotionDemo'
import { EXERCISES, exerciseById } from '../data/exercises'
import { createAnalyzer, type FrameResult } from '../pose/analyzers'
import { useNav } from '../nav'
import { addCoachSet } from '../store'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm'
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

let landmarkerPromise: Promise<{ lm: PoseLandmarker; connections: { start: number; end: number }[] }> | null = null

/** 모델은 한 번만 로드해서 재사용 */
function loadLandmarker() {
  landmarkerPromise ??= (async () => {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
    const vision = await FilesetResolver.forVisionTasks(WASM)
    const create = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
      })
    const lm = await create('GPU').catch(() => create('CPU'))
    return { lm, connections: PoseLandmarker.POSE_CONNECTIONS }
  })().catch((e) => {
    landmarkerPromise = null
    throw e
  })
  return landmarkerPromise
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ko-KR'
  u.rate = 1.1
  speechSynthesis.speak(u)
}

const COACHABLE = EXERCISES.filter((e) => e.coach)

export default function Coach({ exerciseId }: { exerciseId?: string }) {
  const nav = useNav()
  const ex = exerciseId ? exerciseById(exerciseId) : undefined

  if (!ex?.coach) {
    return (
      <>
        <h1>AI 자세 코치</h1>
        <div className="card">
          <p style={{ marginTop: 0 }}>
            카메라로 관절 각도를 실시간 분석해 <b>반복 횟수를 세고 자세를 교정</b>해드려요.
          </p>
          <ul className="dots small muted">
            <li>영상은 기기 안에서만 분석되고 어디에도 전송·저장되지 않아요</li>
            <li>폰을 세워두고 운동별 안내된 방향에서 전신이 보이게 찍어주세요</li>
            <li>밝은 곳에서, 몸에 붙는 옷을 입으면 더 정확해요</li>
          </ul>
        </div>
        <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
          {COACHABLE.map((e) => (
            <button key={e.id} className="list-item" onClick={() => nav({ tab: 'coach', id: e.id })}>
              <div className="avatar">📷</div>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{e.name}</div>
                <div className="small muted">{e.cameraHint}</div>
              </div>
            </button>
          ))}
        </div>
      </>
    )
  }

  return <Session key={ex.id} exerciseId={ex.id} />
}

function Session({ exerciseId }: { exerciseId: string }) {
  const ex = exerciseById(exerciseId)!
  const nav = useNav()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'running' | 'error'>('idle')
  const [error, setError] = useState('')
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [voice, setVoice] = useState(true)
  const [result, setResult] = useState<FrameResult | null>(null)
  const [weight, setWeight] = useState('')
  const [saved, setSaved] = useState(false)
  const voiceRef = useRef(voice)
  voiceRef.current = voice

  useEffect(() => {
    if (status !== 'loading' && status !== 'running') return
    let stream: MediaStream | null = null
    let raf = 0
    let cancelled = false
    const analyze = createAnalyzer(ex.coach!)
    let lastReps = 0
    let lastLiveSpoken = 0
    let lastVideoTime = -1
    let lastKey = ''

    ;(async () => {
      try {
        const camera = navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 960 } },
          audio: false,
        })
        // 모델 로드가 먼저 실패하거나 화면을 벗어난 뒤 카메라가 열려도 바로 끔
        camera
          .then((s) => {
            stream = s
            if (cancelled) s.getTracks().forEach((t) => t.stop())
          })
          .catch(() => {})
        const [{ lm, connections }, s] = await Promise.all([loadLandmarker(), camera])
        if (cancelled) return
        const video = videoRef.current!
        video.srcObject = s
        await video.play()
        setStatus('running')

        const loop = () => {
          if (cancelled) return
          raf = requestAnimationFrame(loop)
          if (video.readyState < 2 || video.currentTime === lastVideoTime) return
          lastVideoTime = video.currentTime
          const now = performance.now()
          const res = lm.detectForVideo(video, now)
          const canvas = canvasRef.current!
          const w = video.videoWidth
          const h = video.videoHeight
          if (canvas.width !== w) canvas.width = w
          if (canvas.height !== h) canvas.height = h
          const ctx = canvas.getContext('2d')!
          ctx.clearRect(0, 0, w, h)
          const pose = res.landmarks[0]
          if (!pose) {
            setResult((r) => (r && !r.visible ? r : { ...(r ?? emptyResult), visible: false }))
            return
          }
          const out = analyze(pose, w / h, now)
          const bad = out.live.length > 0

          // 스켈레톤 그리기
          ctx.lineWidth = Math.max(3, w / 160)
          ctx.strokeStyle = bad ? '#ff6b6b' : '#7cf29c'
          for (const c of connections) {
            const a = pose[c.start]
            const b = pose[c.end]
            if ((a.visibility ?? 1) < 0.4 || (b.visibility ?? 1) < 0.4 || c.start < 11) continue
            ctx.beginPath()
            ctx.moveTo(a.x * w, a.y * h)
            ctx.lineTo(b.x * w, b.y * h)
            ctx.stroke()
          }
          ctx.fillStyle = '#fff'
          for (let i = 11; i < pose.length; i++) {
            if ((pose[i].visibility ?? 1) < 0.4) continue
            ctx.beginPath()
            ctx.arc(pose[i].x * w, pose[i].y * h, ctx.lineWidth * 1.2, 0, Math.PI * 2)
            ctx.fill()
          }

          // 음성 피드백: 반복 완료 시 횟수/교정, 진행 중 경고는 3초에 한 번
          if (voiceRef.current) {
            if (out.reps > lastReps) {
              speak(out.lastRep?.good ? String(out.reps) : `${out.reps}. ${out.lastRep?.message ?? ''}`)
            } else if (out.lastRep && out.lastRep.at === now && !out.lastRep.good) {
              speak(out.lastRep.message)
            } else if (bad && now - lastLiveSpoken > 3000) {
              speak(out.live[0])
              lastLiveSpoken = now
            }
          }
          lastReps = out.reps

          // 화면에 보이는 값이 바뀔 때만 리렌더
          const key = `${out.visible}|${out.reps}|${out.goodReps}|${out.angle}|${out.live.join()}|${out.lastRep?.at}`
          if (key !== lastKey) {
            lastKey = key
            setResult(out)
          }
        }
        loop()
      } catch (e) {
        if (cancelled) return
        cancelled = true
        ;(stream as MediaStream | null)?.getTracks().forEach((t) => t.stop())
        const err = e as Error
        setError(
          err.name === 'NotAllowedError'
            ? '카메라 권한이 거부됐어요. 브라우저 설정에서 카메라를 허용해주세요.'
            : err.name === 'NotFoundError'
              ? '카메라를 찾을 수 없어요.'
              : `AI 모델을 불러오지 못했어요 (${err.message})`,
        )
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      speechSynthesis?.cancel()
    }
    // status가 loading→running으로 바뀔 때 재시작하지 않도록 실행 여부만 의존
  }, [status === 'idle' || status === 'error', facing, ex.coach])

  const running = status === 'loading' || status === 'running'
  const flash = result?.lastRep && performance.now() - result.lastRep.at < 2500 ? result.lastRep : undefined

  const banner = !running
    ? null
    : status === 'loading'
      ? { cls: '', text: 'AI 모델 불러오는 중…' }
      : !result?.visible
        ? { cls: 'warn', text: `몸 전체가 보이게 서주세요 · ${ex.cameraHint}` }
        : result.live.length
          ? { cls: 'bad', text: result.live[0] }
          : flash
            ? { cls: flash.good ? 'good' : 'bad', text: flash.message }
            : { cls: '', text: result.phase === 'down' ? '좋아요, 계속!' : '준비 자세 — 시작하세요' }

  return (
    <>
      <div className="row between">
        <button className="btn sm" onClick={() => nav({ tab: 'coach' })}>
          ← 운동 선택
        </button>
        <button className="btn sm" onClick={() => nav({ tab: 'library', id: ex.id })}>
          자세 설명 보기
        </button>
      </div>
      <h1 style={{ marginBottom: 4 }}>{ex.name}</h1>
      <p className="small muted" style={{ marginTop: 0 }}>
        📐 {ex.cameraHint}
      </p>

      {!running && (
        <div className="card">
          <h2>정자세 예시</h2>
          <MotionDemo key={ex.id} exerciseId={ex.id} primary={ex.primary} secondary={ex.secondary} compact />
        </div>
      )}

      <div className={`stage ${facing === 'user' ? 'mirror' : ''}`}>
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} />
        {running && (
          <div className="hud">
            <div>
              <div className="count">{result?.reps ?? 0}</div>
              <div className="pill">정자세 {result?.goodReps ?? 0}회</div>
            </div>
            {result?.visible && <div className="pill">관절 각도 {result.angle}°</div>}
          </div>
        )}
        {banner && <div className={`banner ${banner.cls}`}>{banner.text}</div>}
        {!running && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 20 }}>
            <div style={{ textAlign: 'center' }}>
              {status === 'error' && <p style={{ color: 'var(--bad)' }}>{error}</p>}
              <button
                className="btn primary"
                onClick={() => {
                  setSaved(false)
                  setResult(null)
                  setStatus('loading')
                }}
              >
                {result ? '다시 시작' : '카메라 켜고 시작'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="row" style={{ margin: '12px 0' }}>
        <button
          className="btn sm"
          onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
        >
          🔄 {facing === 'user' ? '전면' : '후면'} 카메라
        </button>
        <button className="btn sm" onClick={() => setVoice((v) => !v)}>
          {voice ? '🔊 음성 켬' : '🔇 음성 끔'}
        </button>
        <span className="grow" />
        {running && (
          <button className="btn sm danger" onClick={() => setStatus('idle')}>
            ■ 종료
          </button>
        )}
      </div>

      {!running && result && result.reps > 0 && (
        <div className="card">
          <h2>세트 결과</h2>
          <div className="grid2" style={{ marginBottom: 12 }}>
            <div className="stat">
              <span className="small muted">총 반복</span>
              <b>{result.reps}회</b>
            </div>
            <div className="stat">
              <span className="small muted">정자세 비율</span>
              <b>{Math.round((result.goodReps / result.reps) * 100)}%</b>
            </div>
          </div>
          {saved ? (
            <button className="btn block" onClick={() => nav({ tab: 'workout' })}>
              ✓ 운동 기록에 저장됨 — 기록 보기
            </button>
          ) : (
            <div className="row">
              <input
                className="input"
                style={{ width: 110 }}
                type="number"
                inputMode="decimal"
                placeholder="무게 kg"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
              <button
                className="btn primary grow"
                onClick={() => {
                  addCoachSet(ex.id, result.reps, Number(weight) || 0)
                  setSaved(true)
                }}
              >
                오늘 운동에 세트로 저장
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

const emptyResult: FrameResult = { visible: false, reps: 0, goodReps: 0, angle: 0, phase: 'up', live: [] }
