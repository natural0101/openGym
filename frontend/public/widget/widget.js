const $ = id => document.getElementById(id)
let current = null, previous = 0
const run = action => window.gymWidget.action(action).catch(() => { $('error').textContent = 'Не удалось выполнить действие. Открой openGym.' })
function render(value) {
 current = value
 $('pin').setAttribute('aria-pressed', String(value.pinned))
 $('mascot').src = '../mascots/' + (value.buddy === 'cake' ? 'cake' : 'burger') + '.png'
 $('mascot').alt = value.buddy === 'cake' ? 'Тортик' : 'Бургер'
 document.querySelector('.widget').style.background = value.buddy === 'cake' ? '#ffafd1' : '#c6b2ff'
 if (value.done > previous) { $('mascot').classList.remove('cheer'); void $('mascot').offsetWidth; $('mascot').classList.add('cheer') }
 previous = value.done
 const percent = value.total ? Math.min(100, Math.round(value.done / value.total * 100)) : 0
 $('progress').style.width = percent + '%'
 document.querySelector('.progress').setAttribute('aria-valuenow', String(percent))
 $('open').textContent = value.active ? 'Вернуться к тренировке ↗' : 'Открыть openGym ↗'
 tick()
}
function tick() {
 if (!current) return
 const timer = current.timer, left = timer ? Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000)) : 0
 $('heading').textContent = left ? timer.kind === 'rest' ? 'Выдохни немного' : timer.label.startsWith('Разминка') ? 'Разогреваемся' : 'Работаем' : current.active ? 'Подход за подходом' : 'В твоём темпе'
 $('value').textContent = left ? Math.floor(left/60) + ':' + String(left%60).padStart(2,'0') : current.active ? current.done + ' / ' + current.total : 'Погнали?'
 $('detail').textContent = left ? timer.label : current.active ? current.name : 'Выбери тренировку в openGym'
 $('secondary').textContent = left ? timer.kind === 'rest' ? 'Пропустить отдых' : 'Идёт разминка…' : 'Разминка · 2 минуты'
 $('secondary').disabled = left > 0 && timer.kind !== 'rest'
}
$('pin').onclick = () => run('pin')
$('close').onclick = () => run('hide')
$('buddy').onclick = () => run('toggle-buddy')
$('open').onclick = () => run('open')
$('secondary').onclick = () => run(current?.timer?.kind === 'rest' ? 'skip-rest' : 'warmup')
window.gymWidget.subscribe(render)
window.gymWidget.get().then(render).catch(() => { $('error').textContent = 'Открой основное окно openGym.' })
setInterval(tick, 250)
