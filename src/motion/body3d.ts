import * as THREE from 'three'
import type { Muscle } from '../data/exercises'
import type { Motion, Prop } from './motions'
import type { Skeleton, Vec } from './rig'

/**
 * 2D 리그(옆/정면 평면)를 3D로 들어 올려 근육 형태의 인체를 그린다.
 * 좌표 단위는 리그와 동일(대략 cm). 옆 뷰에서 N(가까운 쪽)은 +z, F는 -z.
 */

type Name = keyof Skeleton
type V = THREE.Vector3

// 옆 뷰에서 좌우(깊이) 간격
const SIDE_Z: Partial<Record<string, number>> = {
  shoulder: 16,
  elbow: 18,
  wrist: 16,
  hip: 9,
  knee: 9.5,
  ankle: 9,
  toe: 10,
}

export function lift(s: Skeleton, view: Motion['view']): Record<Name, V> {
  const out = {} as Record<Name, V>
  for (const k of Object.keys(s) as Name[]) {
    const [x, y] = s[k]
    let z = 0
    if (view === 'side') {
      const side = k.endsWith('N') ? 1 : k.endsWith('F') ? -1 : 0
      z = side * (SIDE_Z[k.slice(0, -1)] ?? 0)
    }
    out[k] = new THREE.Vector3(x, y, z)
  }
  if (view === 'front') {
    // 정면에서는 발끝이 카메라 쪽을 향함
    for (const n of ['N', 'F'] as const) {
      const a = out[`ankle${n}`]
      out[`toe${n}`] = new THREE.Vector3(a.x + (s[`toe${n}`][0] - s[`ankle${n}`][0]) * 0.3, Math.max(a.y - 3, 1), 11)
    }
  }
  return out
}

// ── 근육/몸 형태 정의 ───────────────────────────────
/** t: 뼈 길이 비율 위치, f: 앞(+)/뒤(-) 오프셋, s: 바깥(+)/안(-) 오프셋, r*: 반지름 */
type Blob = { t: number; f: number; s: number; rs: number; ru: number; rf: number; muscle?: Muscle; pair?: boolean }

const TORSO: Blob[] = [
  { t: 0.02, f: -0.5, s: 0, rs: 12.5, ru: 9, rf: 8.5 },
  { t: 0.3, f: 0, s: 0, rs: 11, ru: 13, rf: 8 },
  { t: 0.64, f: -0.5, s: 0, rs: 14, ru: 15, rf: 10 },
  { t: 0.9, f: -1, s: 0, rs: 16.5, ru: 7, rf: 8.5 },
  { t: 0.75, f: 7, s: 6.6, rs: 7.2, ru: 5.8, rf: 3.8, muscle: '가슴', pair: true },
  { t: 0.2, f: 7, s: 2.9, rs: 2.7, ru: 4, rf: 2.2, muscle: '복근', pair: true },
  { t: 0.34, f: 7.2, s: 2.9, rs: 2.7, ru: 4, rf: 2.2, muscle: '복근', pair: true },
  { t: 0.48, f: 7.4, s: 2.9, rs: 2.7, ru: 4, rf: 2.2, muscle: '복근', pair: true },
  { t: 0.32, f: 3, s: 9.4, rs: 2.8, ru: 9, rf: 5, muscle: '코어', pair: true },
  { t: 0.6, f: -5.5, s: 9.5, rs: 5.5, ru: 13, rf: 4.6, muscle: '등', pair: true },
  { t: 0.93, f: -4.5, s: 4.5, rs: 6, ru: 7, rf: 4.2, muscle: '등', pair: true },
  { t: 0.3, f: -7, s: 3, rs: 2.6, ru: 12, rf: 2.5, muscle: '등', pair: true },
  { t: 0.0, f: -6.5, s: 6, rs: 7, ru: 8, rf: 6.2, muscle: '둔근', pair: true },
]
const UPPER_ARM: Blob[] = [
  { t: 0.07, f: 0, s: 1.4, rs: 4.6, ru: 6.6, rf: 5.3, muscle: '어깨' },
  { t: 0.55, f: 2.3, s: 0, rs: 3, ru: 9, rf: 3.3, muscle: '이두' },
  { t: 0.42, f: -2.4, s: 0, rs: 3.3, ru: 10, rf: 3.5, muscle: '삼두' },
]
const FOREARM: Blob[] = [
  { t: 0.25, f: 0.8, s: 0.8, rs: 3.2, ru: 8, rf: 3.2 },
  { t: 1.1, f: 0, s: 0, rs: 2.2, ru: 3.8, rf: 3 },
]
const THIGH: Blob[] = [
  { t: 0.48, f: 3, s: 0, rs: 5.8, ru: 16, rf: 5, muscle: '대퇴사두' },
  { t: 0.5, f: 0.5, s: 3.5, rs: 3.8, ru: 14, rf: 4, muscle: '대퇴사두' },
  { t: 0.82, f: 2.6, s: -2.6, rs: 3.4, ru: 5, rf: 3.2, muscle: '대퇴사두' },
  { t: 0.5, f: -3.3, s: 0, rs: 5.2, ru: 15, rf: 4.4, muscle: '햄스트링' },
]
const SHIN: Blob[] = [
  { t: 0.28, f: -2.4, s: 0, rs: 4.1, ru: 9, rf: 4, muscle: '종아리' },
  { t: 0.35, f: 1.8, s: 0.8, rs: 2.2, ru: 10, rf: 2 },
]

type Bone = { a: Name | 'hipC' | 'shC'; b: Name | 'hipC' | 'shC'; side: 1 | -1 | 0; r0: number; r1: number; blobs: Blob[]; leg?: boolean }

const BONES: Bone[] = [
  { a: 'hipC', b: 'shC', side: 0, r0: 0, r1: 0, blobs: TORSO },
  ...([1, -1] as const).flatMap((k): Bone[] => {
    const n = k === 1 ? 'N' : 'F'
    return [
      { a: `shoulder${n}`, b: `elbow${n}`, side: k, r0: 4.2, r1: 3.3, blobs: UPPER_ARM },
      { a: `elbow${n}`, b: `wrist${n}`, side: k, r0: 3.3, r1: 2.3, blobs: FOREARM },
      { a: `hip${n}`, b: `knee${n}`, side: k, r0: 7.2, r1: 4.6, blobs: THIGH, leg: true },
      { a: `knee${n}`, b: `ankle${n}`, side: k, r0: 4.2, r1: 2.6, blobs: SHIN, leg: true },
    ]
  }),
]

const JOINTS: { at: Name; r: number; leg?: boolean }[] = [
  { at: 'hipN', r: 7, leg: true },
  { at: 'hipF', r: 7, leg: true },
  { at: 'kneeN', r: 4.8, leg: true },
  { at: 'kneeF', r: 4.8, leg: true },
  { at: 'ankleN', r: 2.9, leg: true },
  { at: 'ankleF', r: 2.9, leg: true },
  { at: 'elbowN', r: 3.5 },
  { at: 'elbowF', r: 3.5 },
  { at: 'wristN', r: 2.4 },
  { at: 'wristF', r: 2.4 },
]

// ── 재질 ────────────────────────────────────────────
const SKIN = 0xd3d8df
const PRIMARY = 0x1fd3b0
const SECONDARY = 0x8fe3d2
const BAD = 0xff5a5a

const tmpM = new THREE.Matrix4()

function place(mesh: THREE.Mesh, c: V, s: V, u: V, f: V, sx: number, sy: number, sz: number) {
  tmpM.makeBasis(s, u, f).scale(new THREE.Vector3(sx, sy, sz)).setPosition(c)
  mesh.matrix.copy(tmpM)
}

export type BodyOptions = { primary: Muscle[]; secondary: Muscle[] }

export class BodyScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private mats: Record<'skin' | 'primary' | 'secondary' | 'bad' | 'metal' | 'pad' | 'plate' | 'cable', THREE.MeshStandardMaterial>
  private sphere = new THREE.SphereGeometry(1, 28, 18)
  private body = new THREE.Group()
  private blobMeshes: { mesh: THREE.Mesh; muscle?: Muscle }[] = []
  private boneMeshes: THREE.Mesh[] = []
  private jointMeshes: THREE.Mesh[] = []
  private extra: { neck: THREE.Mesh; head: THREE.Mesh; feet: THREE.Mesh[] }
  private props: PropView[] = []
  private disposables: { dispose(): void }[] = []
  private opts: BodyOptions = { primary: [], secondary: [] }

  constructor(
    canvas: HTMLCanvasElement,
    private motion: Motion,
    frame: { minX: number; maxX: number; minY: number; maxY: number },
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    const std = (color: number, roughness = 0.6, metalness = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness })
    this.mats = {
      skin: std(SKIN, 0.58),
      primary: std(PRIMARY, 0.45),
      secondary: std(SECONDARY, 0.5),
      bad: std(BAD, 0.45),
      metal: std(0xa3a9b2, 0.3, 0.75),
      pad: std(0x2b3039, 0.85),
      plate: std(0x3b414b, 0.5, 0.35),
      cable: std(0x6b717b, 0.4, 0.5),
    }
    this.mats.primary.emissive = new THREE.Color(0x0a5a4b)
    this.mats.bad.emissive = new THREE.Color(0x5a0a0a)
    this.disposables.push(this.sphere, ...Object.values(this.mats))

    // 조명
    this.scene.add(new THREE.HemisphereLight(0xeef3ff, 0x1d2129, 1.1))
    const key = new THREE.DirectionalLight(0xffffff, 2.3)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.bias = -0.0005
    const rim = new THREE.DirectionalLight(0x9fd8ff, 1.1)
    this.scene.add(key, key.target, rim)

    // 카메라: 옆 뷰는 앞쪽으로 35° 돌려 입체감, 정면 뷰는 20°
    const cx = (frame.minX + frame.maxX) / 2
    const cy = (Math.max(frame.minY, 0) + frame.maxY) / 2
    const w = frame.maxX - frame.minX + 30
    const h = frame.maxY - Math.max(frame.minY, 0) + 30
    const target = new THREE.Vector3(cx, cy, 0)
    const az = ((motion.view === 'side' ? 35 : 20) * Math.PI) / 180
    // 누워서 하는 운동처럼 납작한 장면은 위에서 내려다봄
    const elev = h < w * 0.75 ? 0.6 : 0.2
    const dir = new THREE.Vector3(Math.sin(az), elev, Math.cos(az)).normalize()
    this.camera = new THREE.PerspectiveCamera(28, 1, 1, 5000)
    this.camera.userData = { target, dir, w, h }
    this.camera.position.copy(target).addScaledVector(dir, 400)
    this.camera.lookAt(target)

    key.position.copy(target).add(new THREE.Vector3(140, 260, 220))
    key.target.position.copy(target)
    const sc = key.shadow.camera
    sc.left = sc.bottom = -Math.max(w, h)
    sc.right = sc.top = Math.max(w, h)
    sc.near = 10
    sc.far = 900
    rim.position.copy(target).add(new THREE.Vector3(-200, 120, -180))

    // 바닥 그림자
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.ShadowMaterial({ opacity: 0.35 }))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(w, 80) * 0.6, 64),
      new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 1, transparent: true, opacity: 0.85 }),
    )
    disc.rotation.x = -Math.PI / 2
    disc.position.set(cx, -0.2, 0)
    disc.receiveShadow = true
    this.scene.add(ground, disc)
    this.disposables.push(ground.geometry, ground.material as THREE.Material, disc.geometry, disc.material as THREE.Material)

    // 몸 메시 생성
    const mk = (geo: THREE.BufferGeometry, mat = this.mats.skin) => {
      const m = new THREE.Mesh(geo, mat)
      m.matrixAutoUpdate = false
      m.castShadow = true
      m.receiveShadow = true
      this.body.add(m)
      return m
    }
    for (const bone of BONES) {
      if (bone.r0 > 0) {
        const g = new THREE.CylinderGeometry(bone.r1, bone.r0, 1, 20, 1, true)
        this.disposables.push(g)
        this.boneMeshes.push(mk(g))
      } else this.boneMeshes.push(null as never)
      for (const blob of bone.blobs) {
        const reps = bone.side === 0 && blob.pair ? 2 : 1
        for (let i = 0; i < reps; i++) this.blobMeshes.push({ mesh: mk(this.sphere), muscle: blob.muscle })
      }
    }
    for (let i = 0; i < JOINTS.length; i++) this.jointMeshes.push(mk(this.sphere))
    const neckGeo = new THREE.CylinderGeometry(3.9, 4.4, 1, 16, 1, true)
    this.disposables.push(neckGeo)
    this.extra = { neck: mk(neckGeo), head: mk(this.sphere), feet: [mk(this.sphere), mk(this.sphere)] }
    this.scene.add(this.body)
  }

  setMuscles(o: BodyOptions) {
    this.opts = o
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false)
    const cam = this.camera
    cam.aspect = width / height
    const { target, dir, w, h } = cam.userData as { target: V; dir: V; w: number; h: number }
    const tan = Math.tan((cam.fov * Math.PI) / 360)
    const dist = Math.max(h / 2 / tan, w / 2 / (tan * cam.aspect)) * 1.0
    cam.position.copy(target).addScaledVector(dir, dist)
    cam.lookAt(target)
    cam.updateProjectionMatrix()
  }

  /** 자세를 반영하고 렌더. metricAt이 주어지면 화면 좌표(px)를 반환 */
  update(s: Skeleton, bad: boolean, spine = 0, metricAt?: Name): { x: number; y: number } | null {
    const view = this.motion.view
    const J = lift(s, view)
    const hipC = J.hipN.clone().add(J.hipF).multiplyScalar(0.5)
    const shC = J.shoulderN.clone().add(J.shoulderF).multiplyScalar(0.5)
    const get = (n: Bone['a']) => (n === 'hipC' ? hipC : n === 'shC' ? shC : J[n])

    // 몸통 기준 축: u(위), F(앞), L(N쪽 바깥)
    const u = shC.clone().sub(hipC).normalize()
    const F =
      view === 'side'
        ? new THREE.Vector3(u.y, -u.x, 0).multiplyScalar(this.motion.supine ? -1 : 1)
        : new THREE.Vector3(0, 0, 1)
    F.addScaledVector(u, -F.dot(u)).normalize()
    const L = view === 'side' ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
    const sT = new THREE.Vector3().crossVectors(u, F)

    const frameOf = (a: V, b: V) => {
      const len = a.distanceTo(b) || 1e-3
      const ub = b.clone().sub(a).divideScalar(len)
      let fb = F.clone().addScaledVector(ub, -F.dot(ub))
      if (fb.lengthSq() < 0.04) fb = new THREE.Vector3().crossVectors(sT, ub)
      fb.normalize()
      const sb = new THREE.Vector3().crossVectors(ub, fb)
      const sign = Math.sign(sb.dot(L)) || 1
      return { len, ub, fb, sb, sign }
    }

    const mat = (m?: Muscle) => {
      if (!m) return this.mats.skin
      if (this.opts.primary.includes(m)) return bad ? this.mats.bad : this.mats.primary
      if (this.opts.secondary.includes(m)) return this.mats.secondary
      return this.mats.skin
    }

    let bi = 0
    BONES.forEach((bone, idx) => {
      const a = get(bone.a)
      const b = get(bone.b)
      const { len, ub, fb, sb, sign } = frameOf(a, b)
      const hidden = bone.leg && this.motion.hideLegs
      const cyl = this.boneMeshes[idx]
      if (cyl) {
        cyl.visible = !hidden
        place(cyl, a.clone().addScaledVector(ub, len / 2), sb, ub, fb, 1, len, 1)
      }
      for (const blob of bone.blobs) {
        const reps = bone.side === 0 && blob.pair ? [1, -1] : [bone.side || 1]
        for (const k of reps) {
          const { mesh } = this.blobMeshes[bi]
          // 등이 굽은 자세: 몸통 가운데를 등 쪽으로 밀어냄
          const hump = bone.side === 0 ? -spine * Math.sin(Math.PI * Math.min(Math.max(blob.t, 0), 1)) * 2 : 0
          const c = a
            .clone()
            .addScaledVector(ub, blob.t * len)
            .addScaledVector(fb, blob.f + hump)
            .addScaledVector(sb, blob.s * k * sign)
          place(mesh, c, sb, ub, fb, blob.rs, blob.ru, blob.rf)
          mesh.material = mat(blob.muscle)
          mesh.visible = !hidden
          bi++
        }
      }
    })
    JOINTS.forEach((j, i) => {
      const m = this.jointMeshes[i]
      m.visible = !(j.leg && this.motion.hideLegs)
      place(m, J[j.at], sT, u, F, j.r, j.r, j.r)
    })
    // 목·머리
    const neckBase = shC.clone().addScaledVector(u, -3)
    const hf = frameOf(neckBase, J.neck)
    place(this.extra.neck, neckBase.clone().addScaledVector(hf.ub, hf.len / 2), hf.sb, hf.ub, hf.fb, 1, hf.len + 2, 1)
    const head = frameOf(J.neck, J.head)
    place(this.extra.head, J.head.clone().addScaledVector(head.fb, 0.8), head.sb, head.ub, head.fb, 7.3, 9.3, 8.3)
    // 발
    ;(['N', 'F'] as const).forEach((n, i) => {
      const ft = frameOf(J[`ankle${n}`], J[`toe${n}`])
      const foot = this.extra.feet[i]
      foot.visible = !this.motion.hideLegs
      place(foot, J[`ankle${n}`].clone().addScaledVector(ft.ub, ft.len * 0.45), ft.sb, ft.ub, ft.fb, 3.1, ft.len * 0.62 + 1.5, 2.3)
    })

    // 기구
    const props = this.motion.props?.(s) ?? []
    if (this.props.length !== props.length) {
      this.props.forEach((p) => p.dispose())
      this.props = props.map((p) => new PropView(p, view, this.mats, this.scene))
    }
    props.forEach((p, i) => this.props[i].update(p))

    this.renderer.render(this.scene, this.camera)

    if (!metricAt) return null
    const v = J[metricAt].clone().project(this.camera)
    const el = this.renderer.domElement
    return { x: ((v.x + 1) / 2) * el.clientWidth, y: ((1 - v.y) / 2) * el.clientHeight }
  }

  dispose() {
    this.props.forEach((p) => p.dispose())
    this.disposables.forEach((d) => d.dispose())
    this.renderer.dispose()
  }
}

// ── 기구 ────────────────────────────────────────────
type Mats = Record<'metal' | 'pad' | 'plate' | 'cable', THREE.MeshStandardMaterial>

const Y = new THREE.Vector3(0, 1, 0)

/** a→b 방향 실린더 배치 */
function orientCylinder(mesh: THREE.Object3D, a: V, b: V) {
  const d = b.clone().sub(a)
  const len = d.length() || 1e-3
  mesh.position.copy(a).addScaledVector(d, 0.5)
  mesh.quaternion.setFromUnitVectors(Y, d.divideScalar(len))
  mesh.scale.set(1, len, 1)
}

class PropView {
  private group = new THREE.Group()
  private geos: THREE.BufferGeometry[] = []
  private parts: THREE.Mesh[] = []
  private role: string

  constructor(
    p: Prop,
    private view: Motion['view'],
    mats: Mats,
    private scene: THREE.Scene,
  ) {
    this.role = classify(p)
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.Mesh(geo, mat)
      m.castShadow = true
      m.receiveShadow = true
      this.geos.push(geo)
      this.parts.push(m)
      this.group.add(m)
      return m
    }
    const zAxis = (m: THREE.Mesh) => m.rotation.set(Math.PI / 2, 0, 0)
    switch (this.role) {
      case 'barbell': {
        // 2D 원 반지름은 화면 표현용이라 실제 원판은 조금 작게
        const r = (p.kind === 'circle' ? p.r : 15) * 0.85
        zAxis(add(new THREE.CylinderGeometry(1.3, 1.3, 150, 12), mats.metal))
        for (const z of [-54, 54]) {
          const plate = add(new THREE.CylinderGeometry(r, r, 4.5, 40), mats.plate)
          zAxis(plate)
          plate.position.z = z
          const collar = add(new THREE.CylinderGeometry(2.6, 2.6, 3, 16), mats.metal)
          zAxis(collar)
          collar.position.z = z - Math.sign(z) * 4
        }
        break
      }
      case 'dumbbells':
      case 'dumbbell':
      case 'dumbbell-center': {
        const vertical = p.kind === 'rect' && p.h > p.w
        const zs = this.role === 'dumbbells' && view === 'side' ? [16, -16] : this.role === 'dumbbell' && view === 'side' ? [16] : [0]
        const big = this.role === 'dumbbell-center' ? 1.25 : 1
        for (const z of zs) {
          const g = new THREE.Group()
          const handle = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 11 * big, 10), mats.metal)
          this.geos.push(handle.geometry)
          g.add(handle)
          for (const e of [-1, 1]) {
            const head = new THREE.Mesh(new THREE.CylinderGeometry(4.2 * big, 4.2 * big, 4.5 * big, 6), mats.plate)
            head.position.y = e * 7 * big
            head.castShadow = true
            this.geos.push(head.geometry)
            g.add(head)
          }
          if (!vertical) g.rotation.x = Math.PI / 2
          g.position.z = z
          g.userData.dumbbell = true
          this.group.add(g)
        }
        break
      }
      case 'bar': {
        const m = add(new THREE.CylinderGeometry(1.4, 1.4, 1, 12), mats.metal)
        m.userData.kind = 'bar'
        break
      }
      case 'cable':
        add(new THREE.CylinderGeometry(0.45, 0.45, 1, 6), mats.cable)
        break
      case 'pad':
        add(new THREE.BoxGeometry(1, 1, 1), mats.pad)
        break
      case 'frame':
        for (let i = 0; i < (view === 'side' ? 2 : 1); i++) add(new THREE.CylinderGeometry(1, 1, 1, 10), mats.metal)
        break
      case 'box':
        add(new THREE.BoxGeometry(1, 1, 1), mats.pad)
        break
      case 'roller': {
        const r = p.kind === 'circle' ? p.r : 5
        zAxis(add(new THREE.CylinderGeometry(r, r, 30, 20), mats.pad))
        break
      }
    }
    scene.add(this.group)
  }

  update(p: Prop) {
    const v3 = ([x, y]: Vec, z = 0) => new THREE.Vector3(x, y, z)
    switch (this.role) {
      case 'barbell':
      case 'roller':
        if (p.kind === 'circle') this.group.position.set(p.c[0], p.c[1], 0)
        break
      case 'dumbbells':
      case 'dumbbell':
      case 'dumbbell-center':
        if (p.kind === 'rect') this.group.position.set(p.x + p.w / 2, p.y + p.h / 2, 0)
        break
      case 'bar':
        if (p.kind === 'line') {
          const m = this.parts[0]
          const mid = v3(p.a).add(v3(p.b)).multiplyScalar(0.5)
          const len = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1])
          // 옆 뷰의 손잡이 봉은 좌우(깊이)로 뻗음
          const half = this.view === 'side' ? (len < 20 ? 9 : 40) : len / 2
          const a = this.view === 'side' ? mid.clone().setZ(-half) : v3(p.a)
          const b = this.view === 'side' ? mid.clone().setZ(half) : v3(p.b)
          orientCylinder(m, a, b)
        }
        break
      case 'cable':
        if (p.kind === 'line') orientCylinder(this.parts[0], v3(p.a), v3(p.b))
        break
      case 'frame':
        if (p.kind === 'line') {
          const r = Math.max((p.w ?? 2) * 0.55, 1)
          this.parts.forEach((m, i) => {
            const z = this.view === 'side' ? (i === 0 ? 17 : -17) : -14
            orientCylinder(m, v3(p.a, z), v3(p.b, z))
            m.scale.x = m.scale.z = r
          })
        }
        break
      case 'pad':
        if (p.kind === 'line') {
          const m = this.parts[0]
          const a = v3(p.a)
          const b = v3(p.b)
          const len = a.distanceTo(b)
          m.position.copy(a).add(b).multiplyScalar(0.5)
          m.rotation.set(0, 0, Math.atan2(b.y - a.y, b.x - a.x))
          m.scale.set(len, (p.w ?? 5) * 1.1, 34)
        }
        break
      case 'box':
        if (p.kind === 'rect') {
          const m = this.parts[0]
          m.position.set(p.x + p.w / 2, p.y + p.h / 2, 0)
          m.scale.set(p.w, p.h, 34)
        }
        break
    }
  }

  dispose() {
    this.scene.remove(this.group)
    this.geos.forEach((g) => g.dispose())
  }
}

function classify(p: Prop): string {
  if (p.role) return p.role
  if (p.kind === 'circle') return p.fill && p.r > 3 ? 'roller' : p.fill ? 'skip' : 'barbell'
  if (p.kind === 'rect') return 'box'
  const w = p.w ?? 2
  if (w <= 1) return 'cable'
  if (w >= 5) return 'pad'
  return 'frame'
}
