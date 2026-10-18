type Point = { label: string; value: number }

/** 의존성 없는 간단한 SVG 라인 차트 (목표선 옵션) */
export default function LineChart({
  data,
  goal,
  unit = '',
  height = 180,
}: {
  data: Point[]
  goal?: number
  unit?: string
  height?: number
}) {
  if (data.length === 0) return <div className="empty small">기록이 쌓이면 그래프가 표시돼요</div>

  const W = 340
  const H = height
  const pad = { l: 36, r: 12, t: 12, b: 24 }
  const values = data.map((d) => d.value).concat(goal !== undefined ? [goal] : [])
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max - min < 2) {
    min -= 1
    max += 1
  }
  const span = max - min
  min -= span * 0.1
  max += span * 0.1

  const x = (i: number) =>
    data.length === 1 ? (pad.l + W - pad.r) / 2 : pad.l + (i / (data.length - 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = `${path} L${x(data.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`
  const ticks = [min + (max - min) * 0.15, (min + max) / 2, max - (max - min) * 0.15]
  const labelIdx = data.length <= 2 ? data.map((_, i) => i) : [0, Math.floor((data.length - 1) / 2), data.length - 1]

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="추이 그래프">
      <defs>
        <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
          <text x={pad.l - 6} y={y(t) + 4} fill="var(--muted)" fontSize="10" textAnchor="end">
            {t.toFixed(1)}
          </text>
        </g>
      ))}
      {goal !== undefined && (
        <g>
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={y(goal)}
            y2={y(goal)}
            stroke="var(--warn)"
            strokeDasharray="4 4"
            strokeWidth="1.5"
          />
          <text x={W - pad.r} y={y(goal) - 4} fill="var(--warn)" fontSize="10" textAnchor="end">
            목표 {goal}
            {unit}
          </text>
        </g>
      )}
      {data.length > 1 && <path d={area} fill="url(#fill)" />}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r={data.length > 30 ? 0 : 3} fill="var(--accent)" />
      ))}
      {labelIdx.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 6}
          fill="var(--muted)"
          fontSize="10"
          textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
        >
          {data[i].label}
        </text>
      ))}
    </svg>
  )
}
