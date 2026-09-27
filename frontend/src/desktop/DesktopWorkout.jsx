import Workout from '../views/Workout.jsx'
import { useStore } from '../store/useStore.js'
import { exOr } from '../lib/exercises.js'
import { exerciseNameFor } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import TrainingBuddy from './TrainingBuddy.jsx'

export default function DesktopWorkout() {
  const active = useStore(s => s.S.active)
  const view = useStore(s => s.S.workoutView)
  if (!active || view !== 'cards') return <Workout />
  return <div className="desk-workout-layout"><Workout /><div className="desk-workout-side"><aside className="desk-workout-outline" aria-label="Упражнения в тренировке">
    <h2>В этой тренировке · {active.entries.length}</h2>
    {active.entries.map((entry, index) => {
      const done = entry.sets.filter(s => s.done).length
      return <button key={index} aria-current={active.cur === index ? 'step' : undefined} onClick={() => useStore.getState().update(s => { if (s.active) s.active.cur = index })}>
        <span>{String(index + 1).padStart(2, '0')}</span><div>{exerciseNameFor(exOr(entry.id))}<small>{done} / {entry.sets.length} подходов</small></div>{done === entry.sets.length && <Icon name="check" />}
      </button>
    })}
  </aside><TrainingBuddy compact /></div></div>
}
