import { lazy, Suspense } from 'react'
import { Panels } from './ui/Panels'
import { useLoading } from './loading'

// three.js va 3D sahna alohida paketda: panel va yuklanish ekrani darhol chiqadi
const Scene = lazy(() => import('./scene/Scene'))

function Loader() {
  const { progress, done } = useLoading()
  return (
    <div className={`loader${done ? ' loader--done' : ''}`} aria-hidden={done}>
      <img src="/images/logo.png" alt="" />
      <div className="bar">
        <i style={{ width: `${progress}%` }} />
      </div>
      <span>Ko‘chatxona yuklanmoqda… {Math.round(progress)}%</span>
    </div>
  )
}

export default function App() {
  return (
    <>
      <div className="stage">
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </div>
      <Panels />
      <Loader />
    </>
  )
}
