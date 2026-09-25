const $ = id => document.getElementById(id)
let current = null, previous = null
const run = action => window.gymWidget.action(action).catch(() => { $('error').textContent = 'Не удалось выполнить действие. Открой openGym.' })
function render(value) {
 current = value
 document.querySelector('.widget').dataset.desktop = String(value.onDesktop)
 $('mascot').src = '../mascots/' + (value.buddy === 'cake' ? 'cake' : 'burger') + '.png'
 $('mascot').alt = value.buddy === 'cake' ? 'Тортик' : 'Бургер'
 document.querySelector('.widget').style.background = value.buddy === 'cake' ? '#ffafd1' : '#c6b2ff'
 if (previous != null && value.done > previous) { $('mascot').classList.remove('cheer'); void $('mascot').offsetWidth; $('mascot').classList.add('cheer') }
 previous = value.done
 const game = value.burger || { remaining: 100, scale: .9, won: false }
 $('mascot').style.setProperty('--burger-scale', value.buddy === 'cake' ? 1 : game.scale)
 $('victory').hidden = !game.won || value.buddy === 'cake'
 $('goal-label').textContent = game.won ? 'Бургер исчез. Цель достигнута!' : 'Бургер ' + game.remaining + '% · цель 0%'
 const percent = Math.min(100, game.remaining / 150 * 100)
 $('progress').style.width = percent + '%'
 document.querySelector('.progress').setAttribute('aria-valuenow', String(game.remaining))
 $('open').textContent = value.active ? 'Вернуться к тренировке ↗' : 'Открыть openGym ↗'
 tick()
}
function tick() {
 if (!current) return
 const timer = current.timer, left = timer ? Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000)) : 0
 $('heading').textContent = left ? timer.kind === 'rest' ? 'Выдохни немного' : timer.label.startsWith('Разминка') ? 'Разогреваемся' : 'Работаем' : current.burger?.won ? 'Бургер побеждён!' : current.active ? 'Подход за подходом' : 'Убери Бургер'
 $('value').textContent = left ? Math.floor(left/60) + ':' + String(left%60).padStart(2,'0') : current.active ? current.done + ' / ' + current.total : current.burger?.won ? 'Победа!' : (current.burger?.remaining ?? 100) + '%'
 $('detail').textContent = left ? timer.label : current.active ? current.name : current.burger?.won ? 'Твоя регулярность победила' : 'Заверши занятие — Бургер уменьшится'
 $('secondary').textContent = left ? timer.kind === 'rest' ? 'Пропустить отдых' : 'Идёт разминка…' : 'Разминка · 2 минуты'
 $('secondary').disabled = left > 0 && timer.kind !== 'rest'
}
$('close').onclick = () => run('hide')
$('buddy').onclick = () => run('toggle-buddy')
$('open').onclick = () => run('open')
$('secondary').onclick = () => run(current?.timer?.kind === 'rest' ? 'skip-rest' : 'warmup')
window.gymWidget.subscribe(render)
window.gymWidget.get().then(render).catch(() => { $('error').textContent = 'Открой основное окно openGym.' })
setInterval(tick, 250)
