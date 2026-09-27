const $ = id => document.getElementById(id)
let current = null, previous = null
const run = action => window.gymWidget.action(action).catch(() => { $('error').textContent = 'Не удалось выполнить действие. Открой openGym.' })
const simple = value => value.widgetMode !== 'buddy'
function render(value) {
 current = value
 const calm = simple(value), motivation = value.motivation || {}
 const voiceLabels = {off: 'Включить микрофон', connecting: 'Подключение · стоп', listening: 'Слушаю · выключить', thinking: 'Думаю · выключить', speaking: 'Говорю · выключить', error: 'Голос: повторить'}
 $('voice').textContent = voiceLabels[value.voiceStatus] || voiceLabels.off
 $('voice').setAttribute('aria-pressed', String(![undefined,'off','error'].includes(value.voiceStatus)))
 const widget = document.querySelector('.widget')
 widget.dataset.desktop = String(value.onDesktop)
 widget.dataset.mode = calm ? 'simple' : 'buddy'
 $('mascot').src = '../mascots/' + (value.buddy === 'cake' ? 'cake' : 'burger') + '.png'
 $('mascot').alt = value.buddy === 'cake' ? 'Тортик' : 'Бургер'
 widget.style.background = calm ? '#f6f3eb' : value.buddy === 'cake' ? '#ffafd1' : '#c6b2ff'
 if (previous != null && value.done > previous) { $('mascot').classList.remove('cheer'); void $('mascot').offsetWidth; $('mascot').classList.add('cheer') }
 previous = value.done
 const game = value.burger || { remaining: 100, scale: .9, won: false }
 $('mascot').style.setProperty('--burger-scale', value.buddy === 'cake' ? 1 : game.scale)
 $('victory').hidden = !game.won || value.buddy === 'cake'
 const goal = motivation.weekGoal || 3, done = motivation.weekDone || 0
 $('goal-label').textContent = calm ? `За неделю: ${done} из ${goal} дней с тренировкой` : game.won ? 'Бургер исчез. Цель достигнута!' : 'Бургер ' + game.remaining + '% · цель 0%'
 const percent = calm ? Math.min(100,done / goal * 100) : Math.min(100,game.remaining / 150 * 100)
 $('progress').style.width = percent + '%'
 const progress = document.querySelector('.progress')
 progress.setAttribute('aria-label',calm ? 'Дни с тренировкой за неделю' : 'Бургер: осталось')
 progress.setAttribute('aria-valuemax',String(calm ? goal : 150))
 progress.setAttribute('aria-valuenow',String(calm ? Math.min(done,goal) : game.remaining))
 $('growth').textContent = motivation.growth || ''
 $('open').textContent = value.active ? 'Вернуться к тренировке ↗' : 'Открыть openGym ↗'
 tick()
}
function tick() {
 if (!current) return
 const calm = simple(current), motivation = current.motivation || {}
 const timer = current.timer, left = timer ? Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000)) : 0
 $('heading').textContent = left ? timer.kind === 'rest' ? 'Время восстановиться' : 'Работаем' : calm ? motivation.headline || 'Сегодня — в своём темпе' : current.burger?.won ? 'Бургер побеждён!' : current.active ? 'Подход за подходом' : 'Убери Бургер'
 $('value').textContent = left ? Math.floor(left/60) + ':' + String(left%60).padStart(2,'0') : calm ? `${motivation.todaySets || 0} подходов` : current.active ? current.done + ' / ' + current.total : current.burger?.won ? 'Победа!' : (current.burger?.remaining ?? 100) + '%'
 $('detail').textContent = left ? timer.label : current.active ? current.name : calm ? (motivation.todaySets ? 'Записано за сегодня' : 'Пока без записей за сегодня') : current.burger?.won ? 'Твоя регулярность победила' : 'Заверши занятие — Бургер уменьшится'
 $('secondary').textContent = left ? timer.kind === 'rest' ? 'Пропустить отдых' : 'Идёт разминка…' : 'Разминка · 2 минуты'
 $('secondary').disabled = left > 0 && timer.kind !== 'rest'
 $('secondary').hidden = calm && !(left > 0 && timer.kind === 'rest')
}
$('voice').onclick = () => run('voice')
$('close').onclick = () => run('hide')
$('buddy').onclick = () => run('toggle-buddy')
$('open').onclick = () => run('open')
$('secondary').onclick = () => run(current?.timer?.kind === 'rest' ? 'skip-rest' : 'warmup')
window.gymWidget.subscribe(render)
window.gymWidget.get().then(render).catch(() => { $('error').textContent = 'Открой основное окно openGym.' })
setInterval(tick, 250)
