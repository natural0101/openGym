// Interactive child of Explorer's desktop (sibling of the icon view), not a
// floating top-level window. Explorer owns the z-order below ordinary apps.
const koffi = require('koffi')
let api
function windows() {
  if (api) return api
  const user32 = koffi.load('user32.dll')
  const point = koffi.struct('GymDesktopPoint', { x: 'long', y: 'long' })
  const rect = koffi.struct('GymDesktopRect', { left: 'long', top: 'long', right: 'long', bottom: 'long' })
  const callback = koffi.proto('bool __stdcall GymDesktopEnum(void*, intptr_t)')
  api = {
    callback,
    enumerate: user32.func('bool __stdcall EnumWindows(GymDesktopEnum*, intptr_t)'),
    find: user32.func('void* __stdcall FindWindowExW(void*, void*, str16, str16)'),
    parent: user32.func('void* __stdcall GetParent(void*)'),
    isWindow: user32.func('bool __stdcall IsWindow(void*)'),
    setParent: user32.func('void* __stdcall SetParent(void*, void*)'),
    style: user32.func('intptr_t __stdcall GetWindowLongPtrW(void*, int)'),
    setStyle: user32.func('intptr_t __stdcall SetWindowLongPtrW(void*, int, intptr_t)'),
    position: user32.func('bool __stdcall SetWindowPos(void*, void*, int, int, int, int, uint32_t)'),
    rect: user32.func('GetWindowRect', 'bool', ['void*', koffi.out(koffi.pointer(rect))]),
    toClient: user32.func('ScreenToClient', 'bool', ['void*', koffi.inout(koffi.pointer(point))]),
  }
  return api
}
const hwndOf = win => win.getNativeWindowHandle().readBigUInt64LE()
function desktopHost() {
  const w = windows()
  let host = null
  const callback = koffi.register(hwnd => {
    if (w.find(hwnd, null, 'SHELLDLL_DefView', null)) { host = hwnd; return false }
    return true
  }, koffi.pointer(w.callback))
  try { w.enumerate(callback, 0) } finally { koffi.unregister(callback) }
  return host
}
function attachToDesktop(win) {
  if (process.platform !== 'win32') throw new Error('Виджет рабочего стола доступен в Windows.')
  const w = windows(), host = desktopHost(), hwnd = hwndOf(win)
  if (!host) throw new Error('Рабочий стол Windows пока недоступен. Повтори открытие виджета.')
  // Native SWP_SHOWWINDOW alone leaves Chromium hidden: hit tests pass but only
  // wallpaper is painted. Activate Electron visibility before reparenting.
  win.showInactive()
  const bounds = {}; w.rect(hwnd, bounds)
  const position = { x: bounds.left, y: bounds.top }; w.toClient(host, position)
  win.setAlwaysOnTop(false)
  const style = Number(w.style(hwnd, -16))
  w.setStyle(hwnd, -16, ((style & ~0x80000000) | 0x40000000) >>> 0) // WS_POPUP -> WS_CHILD
  w.setStyle(hwnd, -20, ((Number(w.style(hwnd, -20)) & ~0x8) | 0x80 | 0x08000000) >>> 0)
  w.setParent(hwnd, host)
  if (w.parent(hwnd) !== host) throw new Error('Не удалось разместить виджет на рабочем столе.')
  w.position(hwnd, null, position.x, position.y, 0, 0, 0x1 | 0x10 | 0x20 | 0x40)
  return host
}
function isOnDesktop(win) {
  if (!win || win.isDestroyed()) return false
  const w = windows(), parent = w.parent(hwndOf(win))
  return !!parent && w.isWindow(parent) && !!w.find(parent, null, 'SHELLDLL_DefView', null)
}
module.exports = { attachToDesktop, isOnDesktop }
