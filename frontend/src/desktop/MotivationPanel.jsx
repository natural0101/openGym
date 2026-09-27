import { useStore } from '../store/useStore.js'
import { exOr } from '../lib/exercises.js'
import { exerciseLabel } from './exercise-labels.js'
import { motivation } from './motivation.js'

export default function MotivationPanel() {
 const S=useStore(s=>s.S), m=motivation(S), unit=S.unit==='lb'?'фунт.':'кг'
 return <section className="motivation-panel" aria-label="Мой прогресс">
   <div className="motivation-week"><div><span className="neo-kicker">Эта неделя</span><h2>{m.weekDone} <span>из {m.weekGoal} тренировочных дней</span></h2></div><div className="motivation-dots" aria-label={`Завершено ${m.weekDone} из ${m.weekGoal}`}>{Array.from({length:m.weekGoal},(_,i)=><i key={i} className={i<m.weekDone?'done':''}/>)}</div></div>
   <p className="motivation-headline">{m.headline}</p>
   <p className="motivation-caption">{m.todaySets ? `Сегодня: ${m.todayExercises} упр. · ${m.todaySets} подходов. ${S.active?.d===m.today?'Заверши занятие, чтобы день засчитался в цель.':''}`:'Дни отдыха не сбрасывают прогресс. Цель можно изменить в настройках.'}</p>
   <div className="motivation-growth"><h3>Твой рост</h3>{m.growth.length ? <ul>{m.growth.map(g=><li key={g.exerciseId}><b>{exerciseLabel(S,exOr(g.exerciseId))}</b><span>{g.kind==='reps'?`+${g.delta} повт. при ${g.weight} ${unit} · было ${g.previous}, сейчас ${g.current}`:`+${Number(g.delta.toFixed(2))} ${unit} · было ${g.previous}, сейчас ${g.current} при ${g.reps} повт.`}</span><small>Сравнение с {new Date(g.date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long'})}</small></li>)}</ul>:<p>{!m.hasHistory?'Первые записи — твоя точка отсчёта. После следующей похожей тренировки появится сравнение.':!m.todaySets?'Запиши следующий подход — сравним его с прошлой тренировкой.':'Нового прироста в сопоставимых подходах пока нет. Стабильность тоже важна.'}</p>}
   {m.hasApproximate && <small>Примерные повторы сохраняем, но не считаем точным рекордом.</small>}
   <p className="motivation-caption">Больше веса — по самочувствию и с сохранением техники. Каждый день прибавлять не нужно.</p></div>
 </section>
}
