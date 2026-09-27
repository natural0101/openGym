import { uid } from '../lib/format.js'

export { HOME_NAMES } from './home-names.js'

const strength = (id, reps = 10) => ({ id, sets: 2, reps, weight: 0, mode: 'reps', restSec: 75,
  ...(['3211', '0276', '3561', '0659', '0662'].includes(id) ? { bodyweight: true } : {}),
  note: 'Оставляйте 2–3 повтора в запасе. Начните с комфортной нагрузки.' })
const walk = min => ({ id: '3666', sets: 1, mode: 'cardio', min, speed: 4, restSec: 0,
  note: 'Стартовый ориентир: спокойная ходьба без обязательного наклона. Скорость подстройте так, чтобы можно было разговаривать.' })

export const HOME_PLANS = [
  { id: 'dumbbells', title: 'Гантели + дорожка', subtitle: 'Три занятия на всё тело', equipment: 'Гантели · дорожка · свободное место', duration: '30–40 мин',
    description: 'По два подхода на упражнение и спокойная ходьба. Без скамьи, турника и тренажёров. Все упражнения и дни можно изменить.',
    sessions: [
      { name: 'Дома A · базовые движения', emoji: 'dumbbell', ex: [strength('1760'), strength('0293'), strength('3211', 8), strength('0276', 10), walk(10)] },
      { name: 'Дома B · спина и плечи', emoji: 'dumbbell', ex: [strength('1459'), strength('0426', 8), strength('0293'), strength('0417', 12), walk(10)] },
      { name: 'Дома C · всё тело', emoji: 'figureStrength', ex: [strength('1760'), strength('3211', 8), strength('0334', 10), strength('0416', 10), walk(10)] },
    ] },
  { id: 'bodyweight', title: 'Без оборудования', subtitle: 'Мягкий старт дома', equipment: 'Свободное место · коврик по желанию', duration: '15–25 мин',
    description: 'Короткие занятия с собственным весом. Подойдут как запасной вариант, когда гантели недоступны.',
    sessions: [{ name: 'Дома · без оборудования', emoji: 'house', ex: [strength('0659'), strength('3561'), strength('0276')] }] },
]
export function buildHomePlan(id) {
  const template = HOME_PLANS.find(p => p.id === id)
  if (!template) return null
  const routines = template.sessions.map(r => ({ ...r, id: uid(), ex: r.ex.map(e => ({ ...e })) }))
  const cardio = id === 'dumbbells' ? { id: uid(), name: 'Дорожка · спокойная ходьба', emoji: 'figureRun', ex: [walk(20)] } : null
  const schedule = [1, 3, 5].map((day, i) => ({ day, routineId: routines[i % routines.length].id }))
  return { routines: [...routines, ...(cardio ? [cardio] : [])], schedule }
}
