export const GROUPS = [
  { id: 'chest', name: 'Грудь', detail: 'Жимы и разведения' },
  { id: 'back', name: 'Спина', detail: 'Тяги и подтягивания' },
  { id: 'shoulders', name: 'Плечи', detail: 'Жимы, махи и подъёмы' },
  { id: 'arms', name: 'Руки', detail: 'Бицепс, трицепс, предплечья' },
  { id: 'legs', name: 'Ноги', detail: 'Бёдра и икры' },
  { id: 'glutes', name: 'Ягодицы', detail: 'Мосты, отведения и тяги' },
  { id: 'core', name: 'Пресс и корпус', detail: 'Планки и скручивания' },
  { id: 'cardio', name: 'Кардио', detail: 'Дорожка и выносливость' },
  { id: 'full-body', name: 'Всё тело', detail: 'Комплексные движения' },
  { id: 'neck', name: 'Шея', detail: 'Упражнения для шеи' },
  { id: 'other', name: 'Другое', detail: 'Свои упражнения' },
]
export const MUSCLES_RU = {
  rhomboids:'Ромбовидные мышцы','ankle stabilizers':'Стабилизаторы голеностопа',trapezius:'Трапеции',ankles:'Голеностоп',feet:'Стопы',deltoids:'Дельтовидные мышцы',brachialis:'Плечевая мышца',groin:'Паховая область',wrists:'Запястья','rotator cuff':'Вращательная манжета плеча','upper chest':'Верх груди','latissimus dorsi':'Широчайшие мышцы','wrist flexors':'Сгибатели запястья','wrist extensors':'Разгибатели запястья',abdominals:'Пресс','grip muscles':'Мышцы хвата','lower abs':'Нижняя часть пресса','inner thighs':'Внутренняя поверхность бедра',soleus:'Камбаловидная мышца',sternocleidomastoid:'Грудино-ключично-сосцевидная мышца',hands:'Кисти',shins:'Мышцы голени',
  abs:'Пресс',quads:'Квадрицепсы',lats:'Широчайшие мышцы',calves:'Икры',pectorals:'Грудные мышцы',glutes:'Ягодицы',hamstrings:'Задняя поверхность бедра',adductors:'Приводящие мышцы бедра',triceps:'Трицепс','cardiovascular system':'Выносливость',spine:'Разгибатели спины','upper back':'Верх спины',biceps:'Бицепс',delts:'Дельтовидные мышцы',forearms:'Предплечья',traps:'Трапеции','serratus anterior':'Передняя зубчатая мышца',abductors:'Отводящие мышцы бедра','levator scapulae':'Мышца, поднимающая лопатку',
  shoulders:'Плечи',chest:'Грудь',back:'Спина',core:'Корпус',quadriceps:'Квадрицепсы','lower back':'Поясница','rear deltoids':'Задние дельты','hip flexors':'Сгибатели бедра',obliques:'Косые мышцы живота','upper arms':'Плечевая часть рук','lower arms':'Предплечья','upper legs':'Бёдра','lower legs':'Голени',waist:'Пресс и корпус',neck:'Шея',cardio:'Кардио',
}
export const EQUIPMENT_RU = {
  'body weight':'Свой вес',cable:'Блочный тренажёр','leverage machine':'Рычажный тренажёр',assisted:'С поддержкой','medicine ball':'Медбол','stability ball':'Фитбол',band:'Эспандер',barbell:'Штанга',rope:'Канат',dumbbell:'Гантели','ez barbell':'Изогнутый гриф','sled machine':'Тренажёр для жима ногами','upper body ergometer':'Ручной велоэргометр',kettlebell:'Гиря','olympic barbell':'Олимпийская штанга',weighted:'Дополнительное отягощение','bosu ball':'Полусфера Босу','resistance band':'Резиновая лента',roller:'Массажный ролик','skierg machine':'Лыжный тренажёр',hammer:'Кувалда','smith machine':'Тренажёр Смита','wheel roller':'Ролик для пресса','stationary bike':'Велотренажёр',tire:'Покрышка','trap bar':'Трэп-гриф','elliptical machine':'Эллиптический тренажёр','stepmill machine':'Лестничный тренажёр',
}
export function exerciseGroup(ex) {
  if(ex.bp==='cardio'||ex.tg==='cardiovascular system')return 'cardio'
  if(ex.bp==='full body')return 'full-body'
  if(ex.tg==='glutes')return 'glutes'
  return ({chest:'chest',back:'back',shoulders:'shoulders','upper arms':'arms','lower arms':'arms','upper legs':'legs','lower legs':'legs',waist:'core',neck:'neck'})[ex.bp] || 'other'
}
export const isHomeExercise = ex => ['dumbbell','body weight'].includes(ex.eq) || ex.id==='3666'
export const muscleLabel = value => MUSCLES_RU[value] || 'Дополнительная группа'
export const equipmentLabel = value => EQUIPMENT_RU[value] || 'Другой инвентарь'

// These upstream titles and instructions disagree; do not present steps as verified technique.
export const SOURCE_CONFLICTS = new Set(['0050','0075','0100','0204','1431','0316','0458'])
