import assert from 'node:assert/strict'
import { test } from 'node:test'
import { registerHooks } from 'node:module'

// Run the production TypeScript directly on Node 22.18+ without a test dependency.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === './engine' && context.parentURL?.endsWith('/game/ai.ts')) return nextResolve('./engine.ts', context)
  return nextResolve(specifier, context)
} })
const { apply, newGame, GENERALS, handLimit } = await import('../src/game/engine.ts')
const { aiAction } = await import('../src/game/ai.ts')
let seq = 10000
const card = (name, suit = '♣', kind = 'basic', slot) => ({ id: seq++, name, suit, color: ['♥', '♦'].includes(suit) ? 'red' : 'black', kind, slot })
const general = name => GENERALS.find(g => g.name === name)
function setup(names = ['张飞', '关羽', '赵云', '马超']) {
  const s = newGame()
  Object.assign(s, { current: 0, phase: 'play', pending: null, winner: null, log: [], shaUsed: 0, jiuUsed: false, luoyi: false, skillUsed: false })
  s.players.forEach((p, i) => Object.assign(p, { general: general(names[i]), hp: general(names[i]).maxHp, hand: [], equip: {}, judge: [], alive: true, isHuman: i === 0, identity: ['主公', '反贼', '反贼', '忠臣'][i] }))
  s.deck = Array.from({ length: 30 }, () => card('桃', '♥'))
  s.discardPile = []
  return s
}
function declineRescue(s) {
  for (let i = 0; s.pending?.kind === 'dying' && i < 20; i++) s = apply(s, { type: 'respond', pid: s.pending.queue[0], cardId: null })
  return s
}
function attack(s, from, to, damage = 1) {
  s.pending = { kind: 'shan', source: from, target: to, damage }
  return apply(s, { type: 'respond', pid: to, cardId: null })
}

for (const name of ['杀', '火杀', '闪', '无中生有', '方天画戟']) test(`华佗将红色${name}当桃`, () => {
  let s = setup(['华佗', '关羽', '赵云', '马超'])
  s.players[0].hp = 2
  const c = card(name, '♦', name === '方天画戟' ? 'equip' : name === '无中生有' ? 'trick' : 'basic', name === '方天画戟' ? 'weapon' : undefined)
  s.players[0].hand = [c]
  s = apply(s, { type: 'play', pid: 0, cardId: c.id, asTao: true })
  assert.equal(s.players[0].hp, 3)
  assert.equal(s.players[0].hand.length, 0)
  assert.equal(s.pending, null)
  assert.equal(s.shaUsed, 0)
  assert.deepEqual(s.players[0].equip, {})
})
test('华佗红装备手牌可濒死救援；黑牌及满血不能主动转桃', () => {
  let s = setup(['华佗', '关羽', '赵云', '马超'])
  const c = card('方天画戟', '♦', 'equip', 'weapon')
  s.players[0].hand = [c]; s.players[1].hp = 0
  s.pending = { kind: 'dying', target: 1, queue: [0, 1, 2, 3] }
  s = apply(s, { type: 'respond', pid: 0, cardId: c.id })
  assert.equal(s.players[1].hp, 1); assert.equal(s.pending, null)
  for (const suit of ['♣', '♥']) {
    s = setup(['华佗', '关羽', '赵云', '马超'])
    const c2 = card('杀', suit); s.players[0].hand = [c2]
    const next = apply(s, { type: 'play', pid: 0, cardId: c2.id, asTao: true })
    assert.equal(next.players[0].hand.length, 1); assert.equal(next.shaUsed, 0)
  }
})
for (const name of ['杀', '火杀', '无中生有', '八卦阵']) test(`甘宁将黑色${name}当拆，不受杀次数和距离限制`, () => {
  let s = setup(['甘宁', '关羽', '赵云', '马超'])
  const c = card(name, '♣', name === '八卦阵' ? 'equip' : name === '无中生有' ? 'trick' : 'basic', name === '八卦阵' ? 'armor' : undefined)
  s.players[0].hand = [c]; s.players[2].hand = [card('桃', '♥')]; s.shaUsed = 1
  s = apply(s, { type: 'play', pid: 0, cardId: c.id, targetId: 2, asChai: true })
  assert.equal(s.players[2].hand.length, 0); assert.equal(s.players[0].hand.length, 0)
  assert.equal(s.pending, null); assert.equal(s.shaUsed, 1); assert.deepEqual(s.players[0].equip, {})
})
test('甘宁红牌或空目标不会消耗素材', () => {
  for (const suit of ['♥', '♣']) {
    let s = setup(['甘宁', '关羽', '赵云', '马超']); const c = card('杀', suit); s.players[0].hand = [c]
    s = apply(s, { type: 'play', pid: 0, cardId: c.id, targetId: 1, asChai: true })
    assert.equal(s.players[0].hand.length, 1); assert.equal(s.pending, null)
  }
})
test('周瑜 UI 与引擎采用相同弃牌上限，正常进入下一回合', () => {
  let s = setup(['周瑜', '关羽', '赵云', '马超']); s.players[0].hand = Array.from({ length: 5 }, () => card('闪'))
  s = apply(s, { type: 'endPlay', pid: 0 })
  const need = s.players[0].hand.length - handLimit(s.players[0]); assert.equal(need, 1)
  s = apply(s, { type: 'discard', pid: 0, cardIds: s.players[0].hand.slice(0, need).map(c => c.id) })
  assert.equal(s.current, 1); assert.equal(s.players[0].hand.length, 4)
})
test('大乔转化后保留乐不思蜀效果与牌 ID，重复放置被拒绝', () => {
  let s = setup(['大乔', '关羽', '赵云', '马超']); const c = card('桃', '♦'); const c2 = card('闪', '♦'); s.players[0].hand = [c, c2]
  s = apply(s, { type: 'play', pid: 0, cardId: c.id, targetId: 1, asLe: true })
  assert.equal(s.players[1].judge[0].name, '乐不思蜀')
  s = apply(s, { type: 'play', pid: 0, cardId: c2.id, targetId: 1, asLe: true })
  assert.equal(s.players[1].judge.length, 1); assert.equal(s.players[0].hand.length, 1)
  s.deck[s.deck.length - 1] = card('杀', '♠')
  s = apply(s, { type: 'endPlay', pid: 0 })
  assert.notEqual(s.current, 1)
  assert.ok(s.discardPile.some(cd => cd.id === c.id && cd.name === '乐不思蜀'))
})
test('国色转化牌被牵走或洗回牌堆后恢复原牌', () => {
  let s = setup(['大乔', '关羽', '赵云', '马超']); const c = card('桃', '♦'); s.players[0].hand = [c]
  s = apply(s, { type: 'play', pid: 0, cardId: c.id, targetId: 1, asLe: true })
  const shun = card('顺手牵羊', '♣', 'trick'); s.current = 2; s.players[2].hand = [shun]
  s = apply(s, { type: 'play', pid: 2, cardId: shun.id, targetId: 1 })
  assert.equal(s.players[2].hand[0].name, '桃'); assert.equal(s.players[2].hand[0].id, c.id)
  const physical = card('闪', '♦')
  s.deck = [{ ...physical, name: '乐不思蜀', kind: 'trick', physicalCard: physical }]
  const wz = card('无中生有', '♥', 'trick'); s.players[2].hand = [wz]
  s = apply(s, { type: 'play', pid: 2, cardId: wz.id })
  assert.equal(s.players[2].hand[0].name, '闪')
})
test('吕布攻击：AI 正确连续使用两张闪', () => {
  let s = setup(['吕布', '关羽', '赵云', '马超']); s.pending = { kind: 'shan', source: 0, target: 1 }; s.players[1].hand = [card('闪'), card('闪')]
  s = apply(s, aiAction(s)); assert.equal(s.pending.dodged, true)
  const next = aiAction(s); assert.notEqual(next.cardId, null); s = apply(s, next)
  assert.equal(s.pending, null); assert.equal(s.players[1].hp, 4); assert.equal(s.players[1].hand.length, 0)
})
test('八卦阵对无双只算一闪；失败不能无限判定，可继续出闪', () => {
  let s = setup(['吕布', '关羽', '赵云', '马超']); s.pending = { kind: 'shan', source: 0, target: 1 }; s.players[1].equip.armor = card('八卦阵', '♠', 'equip', 'armor')
  s = apply(s, { type: 'bagua', pid: 1 }); assert.equal(s.pending.dodged, true)
  s = apply(s, { type: 'bagua', pid: 1 }); assert.equal(s.pending, null)
  s.pending = { kind: 'shan', source: 0, target: 1 }; s.deck[s.deck.length - 1] = card('杀', '♠')
  s = apply(s, { type: 'bagua', pid: 1 }); const count = s.deck.length
  s = apply(s, { type: 'bagua', pid: 1 }); assert.equal(s.deck.length, count)
  s.players[1].hand = [card('闪'), card('闪')]
  s = apply(s, aiAction(s)); s = apply(s, aiAction(s)); assert.equal(s.pending, null)
})
test('青釭剑禁止八卦阵判定', () => {
  let s = setup(); s.pending = { kind: 'shan', source: 0, target: 1, ignoreArmor: true }; s.players[1].equip.armor = card('八卦阵', '♠', 'equip', 'armor')
  const count = s.deck.length; s = apply(s, { type: 'bagua', pid: 1 }); assert.equal(s.deck.length, count); assert.equal(s.pending.kind, 'shan')
})
test('小乔在扣血前转移全部伤害，致命伤也能转移', () => {
  let s = setup(['张飞', '小乔', '赵云', '马超']); s.players[1].hp = 1; s.players[1].hand = [card('闪', '♥')]
  s = attack(s, 0, 1, 2)
  assert.equal(s.players[1].hp, 1); assert.equal(s.players[0].hp, 2); assert.equal(s.pending, null)
})
for (const saved of [false, true]) test(`AOE 在濒死${saved ? '救活' : '阵亡'}后继续其余目标`, () => {
  let s = setup(); const c = card('南蛮入侵', '♠', 'trick'); s.players[0].hand = [c]; s.players[1].hp = 1
  s = apply(s, { type: 'play', pid: 0, cardId: c.id }); s = apply(s, { type: 'respond', pid: 1, cardId: null })
  assert.equal(s.pending.kind, 'dying')
  if (saved) { const tao = card('桃', '♥'); s.players[0].hand.push(tao); s = apply(s, { type: 'respond', pid: 0, cardId: tao.id }) }
  else s = declineRescue(s)
  assert.equal(s.pending.kind, 'aoe'); assert.deepEqual(s.pending.queue, [2, 3])
  s = apply(s, { type: 'respond', pid: 2, cardId: null }); s = apply(s, { type: 'respond', pid: 3, cardId: null })
  assert.equal(s.players[2].hp, 3); assert.equal(s.players[3].hp, 3); assert.equal(s.pending, null)
})
test('当前 AI 被天香杀死后，回合移交下一位存活角色', () => {
  let s = setup(['小乔', '关羽', '赵云', '马超']); s.current = 1; s.players[1].hp = 1; s.players[0].hand = [card('桃', '♥')]
  s = declineRescue(attack(s, 1, 0))
  assert.equal(s.players[1].alive, false); assert.equal(s.current, 2); assert.ok(aiAction(s))
})
test('神关羽死亡造成多人濒死时逐个救援，并恢复群体锦囊', () => {
  let s = setup(['张飞', '神关羽', '赵云', '马超']); const c = card('南蛮入侵', '♠', 'trick'); s.players[0].hand = [c]
  s.players[1].hp = 1; s.players[2].hp = 1; s.players[3].hp = 1
  s = apply(s, { type: 'play', pid: 0, cardId: c.id }); s = apply(s, { type: 'respond', pid: 1, cardId: null })
  s = declineRescue(s)
  assert.equal(s.players[1].alive, false); assert.equal(s.players[2].alive, false); assert.equal(s.players[3].alive, false)
  assert.equal(s.players[0].hp, 3); assert.equal(s.winner, '主公方'); assert.equal(s.pending, null)
})
test('闪电濒死救活后继续摸牌，死亡后转交回合', () => {
  for (const saved of [false, true]) {
    let s = setup(); s.players[1].hp = 1; s.players[1].judge = [card('闪电', '♠', 'trick')]; s.deck[s.deck.length - 1] = card('杀', '♠')
    s = apply(s, { type: 'endPlay', pid: 0 }); assert.equal(s.pending.kind, 'dying')
    if (saved) {
      const t1 = card('桃', '♥'), t2 = card('桃', '♥'); s.players[1].hand = [t1, t2]
      s = apply(s, { type: 'respond', pid: 1, cardId: t1.id }); s = apply(s, { type: 'respond', pid: 1, cardId: t2.id })
      assert.equal(s.players[1].hand.length, 2); assert.equal(s.current, 1); assert.equal(s.pending, null)
    } else { s = declineRescue(s); assert.equal(s.current, 2); assert.equal(s.players[1].alive, false) }
  }
})
