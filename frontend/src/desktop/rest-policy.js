// Adjustable starting durations, not an assessment of recovery or a medical prescription.
export const REST_POLICY = {
  lowerCompound: 150, upperCompound: 120, isolation: 75, core: 60, fallback: 90,
  note: 'Стартовые интервалы по упражнению. Можно попросить больше или меньше; вес сам по себе не определяет тяжесть.'
}

export function exerciseRest(ex, set = {}, overrides = {}, transition = false) {
  if (set.mode === 'cardio' || ex.bp === 'cardio' || ex.tg === 'cardiovascular system') return null
  const name = String(ex.n || ex.name || '').toLowerCase()
  let seconds = REST_POLICY.fallback
  let reason = 'Базовый отдых для этого упражнения'
  if (/squat|lunge|deadlift|good morning|step[- ]?up|hip thrust|glute bridge|leg press|присед|выпад|станов|румын|зашаг|ягодичный мост|жим ног/.test(name)) {
    seconds = REST_POLICY.lowerCompound; reason = 'Многосуставное упражнение на ноги или таз'
  } else if (/press|push[- ]?up|pull[- ]?up|chin[- ]?up|row|pulldown|dip|жим|отжим|подтяг|тяга/.test(name)) {
    seconds = REST_POLICY.upperCompound; reason = 'Многосуставное упражнение на верх тела'
  } else if (/curl|extension|raise|fly|kickback|сгибан|разгибан|мах|развод/.test(name) || ['biceps', 'triceps', 'calves', 'forearms'].includes(ex.tg)) {
    seconds = REST_POLICY.isolation; reason = 'Изолирующее упражнение'
  } else if (ex.bp === 'waist' || ex.tg === 'abs') {
    seconds = REST_POLICY.core; reason = 'Упражнение на мышцы корпуса'
  }
  if (set.effort === 'hard') { seconds += 30; reason += '; ты сообщил, что подход тяжёлый' }
  if (set.r > 0 && set.r <= 5) { seconds += 30; reason += '; короткий подход до пяти повторов' }
  if (transition) { seconds = Math.max(120, seconds + 30); reason = `Переход к другому упражнению. ${reason}` }
  const override = overrides[ex.id]
  if (Number.isInteger(override) && override >= 5 && override <= 3600) {
    seconds = transition ? Math.max(120, override + 30) : override
    reason = transition ? 'Переход к другому упражнению с учётом твоего интервала' : 'Твой интервал для этого упражнения'
  }
  return { effect: 'rest', seconds, reason, exerciseId: ex.id, transition }
}
