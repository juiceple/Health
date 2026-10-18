import { useEffect, useState } from 'react'
import { NavContext, type Route, type Tab } from './nav'
import Home from './pages/Home'
import WorkoutPage from './pages/Workout'
import Coach from './pages/Coach'
import WeightPage from './pages/Weight'
import Library from './pages/Library'
import Routines from './pages/Routines'

const TABS: { tab: Tab; label: string; ico: string }[] = [
  { tab: 'home', label: '홈', ico: '🏠' },
  { tab: 'workout', label: '운동', ico: '🏋️' },
  { tab: 'coach', label: 'AI 코치', ico: '📷' },
  { tab: 'weight', label: '체중', ico: '⚖️' },
  { tab: 'library', label: '운동법', ico: '📖' },
]

function parseHash(): Route {
  const [tab, id] = location.hash.replace(/^#\/?/, '').split('/')
  const t = tab === 'routines' ? 'routines' : (TABS.find((x) => x.tab === tab)?.tab ?? 'home')
  return { tab: t, id: id ? decodeURIComponent(id) : undefined }
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash)

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = (r: Route) => {
    location.hash = `/${r.tab}${r.id ? '/' + encodeURIComponent(r.id) : ''}`
    window.scrollTo(0, 0)
  }

  return (
    <NavContext.Provider value={navigate}>
      <main className="app">
        {route.tab === 'home' && <Home />}
        {route.tab === 'workout' && <WorkoutPage workoutId={route.id} />}
        {route.tab === 'routines' && <Routines id={route.id} />}
        {route.tab === 'coach' && <Coach exerciseId={route.id} />}
        {route.tab === 'weight' && <WeightPage />}
        {route.tab === 'library' && <Library exerciseId={route.id} />}
      </main>
      <nav className="tabbar">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <button
              key={t.tab}
              // 루틴 화면은 운동 탭 아래에 속함
              className={`tab ${route.tab === t.tab || (route.tab === 'routines' && t.tab === 'workout') ? 'on' : ''}`}
              onClick={() => navigate({ tab: t.tab })}
            >
              <span className="ico">{t.ico}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </NavContext.Provider>
  )
}
