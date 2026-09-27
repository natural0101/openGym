const { test } = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { createRendererFlush } = require('../renderer-flush.cjs')
function setup(timeout = 100) {
 const ipc = new EventEmitter(), sent = []
 const wc = { mainFrame: {}, isDestroyed: () => false, send: (channel, id) => sent.push({channel,id}) }
 const win = { webContents: wc, isDestroyed: () => false }
 return { ipc, wc, sent, flush: createRendererFlush(ipc, () => win, timeout), reply(error) { ipc.emit('desktop:flush-result', { sender: wc, senderFrame: wc.mainFrame }, sent.at(-1).id, error) } }
}
test('flush waits for authenticated main renderer acknowledgement', async () => {
 const h=setup();let done=false
 const waiting=h.flush().then(()=>{done=true})
 h.ipc.emit('desktop:flush-result',{sender:{},senderFrame:{}},h.sent[0].id,null)
 await Promise.resolve();assert.equal(done,false)
 h.reply(null);await waiting;assert.equal(done,true)
})
test('renderer persistence error prevents successful flush', async () => {
 const h=setup();const waiting=h.flush();h.reply('Disk failed')
 await assert.rejects(waiting,/Disk failed/)
})
test('missing acknowledgement times out instead of allowing close', async () => {
 const h=setup(10);await assert.rejects(h.flush(),/не подтвердило сохранение/)
})
