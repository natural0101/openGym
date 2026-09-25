export const DESKTOP = import.meta.env.VITE_DESKTOP === '1'
export const desktop = () => window.openGymDesktop
export const DESKTOP_DEFAULTS = {
  lang: 'ru', theme: 'light', accent: 'lime', checkIn: false, weighIn: false,
  workoutView: 'cards', gifSize: 'full', restSec: 75, autoBackup: true,
  equipProfiles: [{ id: 'home-equipment', name: 'Дома', equipment: ['dumbbell', 'body weight'] }],
  activeEquipId: 'home-equipment', equipFilterOn: true,
}
