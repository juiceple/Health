import { useEffect, useRef } from 'react'
import type { Muscle } from '../data/exercises'
import { BodyScene } from '../motion/body3d'
import type { Motion } from '../motion/motions'
import type { Skeleton } from '../motion/rig'
import type { bounds } from '../motion/timeline'

type Props = {
  motion: Motion
  box: ReturnType<typeof bounds>
  skeleton: Skeleton
  bad: boolean
  spine: number
  primary: Muscle[]
  secondary: Muscle[]
  metric?: { joint: keyof Skeleton; deg: number }
  onError: () => void
}

/** three.js로 근육 인체를 그리는 동작 시범 (MotionDemo에서 lazy 로드) */
export default function Motion3D({ motion, box, skeleton, bad, spine, primary, secondary, metric, onError }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<BodyScene | null>(null)
  const latest = useRef({ skeleton, bad, spine, metric, primary, secondary })
  latest.current = { skeleton, bad, spine, metric, primary, secondary }

  const draw = () => {
    const scene = sceneRef.current
    if (!scene) return
    const { skeleton, bad, spine, metric, primary, secondary } = latest.current
    scene.setMuscles({ primary, secondary })
    const at = scene.update(skeleton, bad, spine, metric?.joint)
    const label = labelRef.current
    if (label) {
      label.style.display = at && metric ? 'block' : 'none'
      if (at && metric) {
        label.style.transform = `translate(${at.x + 10}px, ${at.y - 26}px)`
        label.textContent = `${Math.round(metric.deg)}°`
      }
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current!
    let scene: BodyScene
    try {
      scene = new BodyScene(canvas, motion, box)
    } catch {
      onError()
      return
    }
    sceneRef.current = scene
    const fit = () => {
      const w = canvas.parentElement!.clientWidth
      const h = Math.round(Math.min(w * 0.85, 340))
      canvas.style.height = `${h}px`
      scene.resize(w, h)
      draw()
    }
    const ro = new ResizeObserver(fit)
    ro.observe(canvas.parentElement!)
    fit()
    return () => {
      ro.disconnect()
      scene.dispose()
      sceneRef.current = null
    }
    // 모션이 바뀔 때만 장면을 새로 만듦
  }, [motion])

  useEffect(draw)

  return (
    <div className="motion-3d">
      <canvas ref={canvasRef} role="img" aria-label="운동 동작 3D 시범" />
      <div ref={labelRef} className="motion-angle" />
    </div>
  )
}
