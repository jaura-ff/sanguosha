// 三国杀网页版游戏引擎 v2（纯函数，React 通过 dispatch 驱动）
// 4 人局（主公/忠臣/反贼×2），含装备、攻击距离、判定、延时锦囊（乐不思蜀）。

export type Suit = '♠' | '♥' | '♣' | '♦'
export type CardName =
  | '杀' | '闪' | '桃'
  | '无中生有' | '决斗' | '南蛮入侵' | '万箭齐发' | '过河拆桥' | '顺手牵羊' | '桃园结义' | '乐不思蜀'
  | '诸葛连弩' | '青釭剑' | '青龙偃月刀' | '八卦阵' | '的卢' | '赤兔'

export type CardKind = 'basic' | 'trick' | 'equip'
export type EquipSlot = 'weapon' | 'armor' | 'plus' | 'minus'

export interface Card {
  id: number
  name: CardName
  suit: Suit
  color: 'red' | 'black'
  kind: CardKind
  slot?: EquipSlot
  range?: number // 武器攻击范围
}

export type Identity = '主公' | '忠臣' | '反贼'

export interface General {
  name: string
  skill: string
  skillDesc: string
  maxHp: number
}

export interface Player {
  id: number
  general: General
  identity: Identity
  hp: number
  hand: Card[]
  equip: Partial<Record<EquipSlot, Card>>
  judge: Card[] // 判定区（延时锦囊）
  alive: boolean
  isHuman: boolean
  identityRevealed: boolean
}

export type Pending =
  | { kind: 'shan'; source: number; target: number }
  | { kind: 'juedou'; source: number; target: number }
  | { kind: 'aoe'; card: Card; source: number; queue: number[] }
  | { kind: 'dying'; target: number; queue: number[] }

export type Phase = 'play' | 'discard' | 'gameover'

export interface GameState {
  players: Player[]
  deck: Card[]
  discardPile: Card[]
  current: number
  phase: Phase
  pending: Pending | null
  log: string[]
  shaUsed: number
  skillUsed: boolean
  winner: string | null
  lastPlayed: { pid: number; card: Card; target?: number } | null
}

// ---------- 数据 ----------

export const GENERALS: General[] = [
  { name: '关羽', skill: '武圣', skillDesc: '可将任意红色手牌当【杀】使用', maxHp: 4 },
  { name: '赵云', skill: '龙胆', skillDesc: '可将【杀】当【闪】、【闪】当【杀】使用', maxHp: 4 },
  { name: '张飞', skill: '咆哮', skillDesc: '出牌阶段使用【杀】无次数限制', maxHp: 4 },
  { name: '黄月英', skill: '集智', skillDesc: '每使用一张锦囊牌，摸一张牌', maxHp: 3 },
  { name: '曹操', skill: '奸雄', skillDesc: '每受到 1 点伤害，摸一张牌', maxHp: 4 },
  { name: '孙权', skill: '制衡', skillDesc: '出牌阶段限一次，弃任意张手牌并摸等量牌', maxHp: 4 },
]

let cardSeq = 1
function mk(name: CardName, suit: Suit, kind: CardKind, slot?: EquipSlot, range?: number): Card {
  const color: 'red' | 'black' = suit === '♥' || suit === '♦' ? 'red' : 'black'
  return { id: cardSeq++, name, suit, color, kind, slot, range }
}

export function buildDeck(): Card[] {
  const cards: Card[] = []
  const suits: Suit[] = ['♠', '♥', '♣', '♦']
  for (let i = 0; i < 24; i++) cards.push(mk('杀', suits[i % 4], 'basic'))
  for (let i = 0; i < 12; i++) cards.push(mk('闪', i % 2 ? '♥' : '♦', 'basic'))
  for (let i = 0; i < 6; i++) cards.push(mk('桃', i % 2 ? '♥' : '♦', 'basic'))
  for (let i = 0; i < 4; i++) cards.push(mk('无中生有', suits[i % 4], 'trick'))
  for (let i = 0; i < 3; i++) cards.push(mk('决斗', suits[i % 4], 'trick'))
  for (let i = 0; i < 2; i++) cards.push(mk('南蛮入侵', '♠', 'trick'))
  cards.push(mk('万箭齐发', '♥', 'trick'))
  for (let i = 0; i < 4; i++) cards.push(mk('过河拆桥', suits[i % 4], 'trick'))
  for (let i = 0; i < 3; i++) cards.push(mk('顺手牵羊', suits[i % 4], 'trick'))
  cards.push(mk('桃园结义', '♥', 'trick'))
  for (let i = 0; i < 2; i++) cards.push(mk('乐不思蜀', '♥', 'trick'))
  // 装备
  cards.push(mk('诸葛连弩', '♣', 'equip', 'weapon', 1))
  cards.push(mk('青釭剑', '♠', 'equip', 'weapon', 2))
  cards.push(mk('青龙偃月刀', '♠', 'equip', 'weapon', 3))
  cards.push(mk('八卦阵', '♠', 'equip', 'armor'))
  cards.push(mk('八卦阵', '♣', 'equip', 'armor'))
  cards.push(mk('的卢', '♥', 'equip', 'plus'))
  cards.push(mk('赤兔', '♠', 'equip', 'minus'))
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

// ---------- 工具 ----------

const clone = (s: GameState): GameState => ({
  ...s,
  players: s.players.map((p) => ({
    ...p,
    hand: [...p.hand],
    judge: [...p.judge],
    equip: { ...p.equip },
  })),
  deck: [...s.deck],
  discardPile: [...s.discardPile],
  log: [...s.log],
  pending: s.pending ? { ...s.pending } : null,
  lastPlayed: s.lastPlayed ? { ...s.lastPlayed } : null,
})

export function say(s: GameState, msg: string) {
  s.log.push(msg)
  if (s.log.length > 300) s.log.splice(0, s.log.length - 300)
}

export function pname(s: GameState, pid: number): string {
  const p = s.players[pid]
  return `${p.general.name}(${p.isHuman ? '你' : 'AI' + (pid + 1)})`
}

export function canBeSha(p: Player, card: Card): boolean {
  if (card.name === '杀') return true
  if (p.general.name === '关羽' && card.color === 'red') return true
  if (p.general.name === '赵云' && card.name === '闪') return true
  return false
}

export function canBeShan(p: Player, card: Card): boolean {
  if (card.name === '闪') return true
  if (p.general.name === '赵云' && card.name === '杀') return true
  return false
}

function drawCards(s: GameState, pid: number, n: number) {
  const p = s.players[pid]
  for (let i = 0; i < n; i++) {
    if (s.deck.length === 0) {
      if (s.discardPile.length === 0) return
      s.deck = s.discardPile
      s.discardPile = []
      for (let k = s.deck.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1))
        ;[s.deck[k], s.deck[j]] = [s.deck[j], s.deck[k]]
      }
      say(s, '弃牌堆洗入牌堆')
    }
    p.hand.push(s.deck.pop()!)
  }
}

function removeCard(p: Player, cardId: number): Card | null {
  const i = p.hand.findIndex((cd) => cd.id === cardId)
  if (i < 0) return null
  return p.hand.splice(i, 1)[0]
}

function others(s: GameState, pid: number): number[] {
  return s.players.filter((p) => p.alive && p.id !== pid).map((p) => p.id)
}

function nextAlive(s: GameState, from: number): number {
  let i = (from + 1) % s.players.length
  while (!s.players[i].alive) i = (i + 1) % s.players.length
  return i
}

// ---------- 距离与范围 ----------

export function distance(s: GameState, from: number, to: number): number {
  const alive = s.players.filter((p) => p.alive).map((p) => p.id).sort((a, b) => a - b)
  const i = alive.indexOf(from)
  const j = alive.indexOf(to)
  if (i < 0 || j < 0 || i === j) return 0
  const n = alive.length
  let d = Math.min(Math.abs(i - j), n - Math.abs(i - j))
  if (s.players[from].equip.minus) d -= 1
  if (s.players[to].equip.plus) d += 1
  return Math.max(d, 1)
}

export function attackRange(p: Player): number {
  return p.equip.weapon?.range ?? 1
}

export function inRange(s: GameState, from: number, to: number): boolean {
  return distance(s, from, to) <= attackRange(s.players[from])
}

function unlimitedSha(p: Player): boolean {
  return p.general.name === '张飞' || p.equip.weapon?.name === '诸葛连弩'
}

// ---------- 伤害 / 濒死 / 胜负 ----------

function checkWin(s: GameState) {
  const lord = s.players.find((p) => p.identity === '主公')!
  if (!lord.alive) {
    s.winner = '反贼'
    s.phase = 'gameover'
    say(s, '主公阵亡，反贼获胜！')
    return
  }
  if (s.players.every((p) => p.identity !== '反贼' || !p.alive)) {
    s.winner = '主公方'
    s.phase = 'gameover'
    say(s, '所有反贼被消灭，主公方获胜！')
  }
}

function damage(s: GameState, target: number, n: number, source: number | null) {
  const t = s.players[target]
  t.hp -= n
  say(s, `${pname(s, target)} 受到 ${n} 点伤害，体力 ${Math.max(t.hp, 0)}/${t.general.maxHp}`)
  if (t.hp <= 0) {
    const queue: number[] = []
    let i = s.current
    for (let k = 0; k < s.players.length; k++) {
      if (s.players[i].alive) queue.push(i)
      i = (i + 1) % s.players.length
    }
    s.pending = { kind: 'dying', target, queue }
    say(s, `${pname(s, target)} 进入濒死状态，等待【桃】救援`)
  } else if (t.general.name === '曹操') {
    drawCards(s, target, n)
    say(s, `${pname(s, target)} 发动【奸雄】摸 ${n} 张牌`)
  }
  void source
}

function die(s: GameState, target: number) {
  const t = s.players[target]
  t.alive = false
  t.identityRevealed = true
  s.discardPile.push(...t.hand, ...t.judge)
  for (const slot of ['weapon', 'armor', 'plus', 'minus'] as EquipSlot[]) {
    if (t.equip[slot]) s.discardPile.push(t.equip[slot]!)
  }
  t.hand = []
  t.judge = []
  t.equip = {}
  say(s, `${pname(s, target)} 阵亡，身份是【${t.identity}】`)
  checkWin(s)
}

// ---------- 新游戏 ----------

export function newGame(): GameState {
  const generals = [...GENERALS]
  for (let i = generals.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[generals[i], generals[j]] = [generals[j], generals[i]]
  }
  const identities: Identity[] = ['主公', '忠臣', '反贼', '反贼']
  for (let i = identities.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[identities[i], identities[j]] = [identities[j], identities[i]]
  }
  const deck = buildDeck()
  const players: Player[] = [0, 1, 2, 3].map((id) => ({
    id,
    general: generals[id],
    identity: identities[id],
    hp: generals[id].maxHp,
    hand: deck.splice(0, 4),
    equip: {},
    judge: [],
    alive: true,
    isHuman: id === 0,
    identityRevealed: identities[id] === '主公',
  }))
  const lordId = players.find((p) => p.identity === '主公')!.id
  const s: GameState = {
    players,
    deck,
    discardPile: [],
    current: lordId,
    phase: 'play',
    pending: null,
    log: [],
    shaUsed: 0,
    skillUsed: false,
    winner: null,
    lastPlayed: null,
  }
  say(s, `游戏开始！你的身份是【${players[0].identity}】，武将是【${players[0].general.name}】`)
  say(s, `主公是 ${pname(s, lordId)}`)
  startTurn(s, lordId)
  return s
}

function startTurn(s: GameState, pid: number) {
  s.current = pid
  s.phase = 'play'
  s.shaUsed = 0
  s.skillUsed = false
  const p = s.players[pid]

  // 判定阶段：后放置的延时锦囊先判定
  let skipPlay = false
  while (p.judge.length > 0) {
    const jc = p.judge.pop()!
    const flip = s.deck.pop()
    if (flip) s.discardPile.push(flip)
    if (jc.name === '乐不思蜀') {
      s.discardPile.push(jc)
      if (flip && flip.suit === '♥') {
        say(s, `${pname(s, pid)} 的【乐不思蜀】判定为 ${flip.suit}，生效通过`)
      } else {
        say(s, `${pname(s, pid)} 的【乐不思蜀】判定为 ${flip ? flip.suit : '?'}，跳过出牌阶段！`)
        skipPlay = true
      }
    }
  }

  drawCards(s, pid, 2)
  say(s, `—— ${pname(s, pid)} 的回合，摸 2 张牌 ——`)

  if (skipPlay) {
    if (p.hand.length > p.hp) {
      s.phase = 'discard'
      say(s, `${pname(s, pid)} 需弃置 ${p.hand.length - p.hp} 张牌`)
    } else {
      endTurn(s, pid)
    }
  }
}

// ---------- Action ----------

export type Action =
  | { type: 'play'; pid: number; cardId: number; targetId?: number; asSha?: boolean }
  | { type: 'endPlay'; pid: number }
  | { type: 'discard'; pid: number; cardIds: number[] }
  | { type: 'respond'; pid: number; cardId: number | null }
  | { type: 'quit' }
  | { type: 'zhiheng'; pid: number; cardIds: number[] }
  | { type: 'bagua'; pid: number }

export function apply(prev: GameState, a: Action): GameState {
  const s = clone(prev)
  switch (a.type) {
    case 'play': return doPlay(s, a.pid, a.cardId, a.targetId, a.asSha)
    case 'endPlay': return doEndPlay(s, a.pid)
    case 'discard': return doDiscard(s, a.pid, a.cardIds)
    case 'respond': return doRespond(s, a.pid, a.cardId)
    case 'zhiheng': return doZhiheng(s, a.pid, a.cardIds)
    case 'bagua': return doBagua(s, a.pid)
    case 'quit': {
      s.pending = null
      s.winner = 'ended'
      s.phase = 'gameover'
      for (const p of s.players) p.identityRevealed = true
      say(s, '本局游戏已手动结束，身份全部揭晓')
      return s
    }
  }
}

function doPlay(s: GameState, pid: number, cardId: number, targetId?: number, asShaFlag?: boolean): GameState {
  if (s.pending || s.phase !== 'play' || s.current !== pid) return s
  const p = s.players[pid]
  const card = p.hand.find((cd) => cd.id === cardId)
  if (!card) return s

  const validTarget = (tid: number | undefined, needRange: boolean, maxDist?: number): tid is number => {
    if (tid === undefined || tid === pid) return false
    const t = s.players[tid]
    if (!t?.alive) return false
    if (maxDist !== undefined) return distance(s, pid, tid) <= maxDist
    if (needRange) return inRange(s, pid, tid)
    return true
  }

  const use = (c2: Card, target?: number) => {
    removeCard(p, c2.id)
    s.discardPile.push(c2)
    s.lastPlayed = { pid, card: c2, target }
  }

  // 装备牌
  if (card.kind === 'equip' && card.slot) {
    removeCard(p, card.id)
    const old = p.equip[card.slot]
    if (old) s.discardPile.push(old)
    p.equip[card.slot] = card
    s.lastPlayed = { pid, card }
    say(s, `${pname(s, pid)} 装备了【${card.name}】`)
    return s
  }

  // 是否按【杀】处理：杀本体；赵云的闪；关羽的闪；或关羽显式用武圣转化红牌。
  // 其他红牌（桃/锦囊）默认按牌面功能使用，避免被武圣劫持。
  const asSha =
    card.name === '杀' ||
    ((p.general.name === '赵云' || p.general.name === '关羽') && card.name === '闪') ||
    (p.general.name === '关羽' && card.color === 'red' && !!asShaFlag)

  if (asSha) {
    if (!validTarget(targetId, true)) { say(s, '目标不在攻击范围内'); return s }
    if (!unlimitedSha(p) && s.shaUsed >= 1) { say(s, '每回合只能使用一张【杀】'); return s }
    s.shaUsed++
    use(card, targetId)
    say(s, `${pname(s, pid)} 对 ${pname(s, targetId!)} 使用【杀】`)
    s.pending = { kind: 'shan', source: pid, target: targetId! }
    return s
  }

  switch (card.name) {
    case '桃': {
      if (p.hp >= p.general.maxHp) { say(s, '体力已满，无法使用【桃】'); return s }
      use(card, pid)
      p.hp++
      say(s, `${pname(s, pid)} 使用【桃】回复 1 点体力`)
      return s
    }
    case '无中生有': {
      use(card)
      say(s, `${pname(s, pid)} 使用【无中生有】摸 2 张牌`)
      drawCards(s, pid, 2)
      jizhi(s, pid)
      return s
    }
    case '桃园结义': {
      use(card)
      say(s, `${pname(s, pid)} 使用【桃园结义】，全员回复 1 点体力`)
      for (const pl of s.players) {
        if (pl.alive && pl.hp < pl.general.maxHp) pl.hp++
      }
      jizhi(s, pid)
      return s
    }
    case '决斗': {
      if (!validTarget(targetId, false)) return s
      use(card, targetId)
      say(s, `${pname(s, pid)} 对 ${pname(s, targetId!)} 使用【决斗】`)
      s.pending = { kind: 'juedou', source: pid, target: targetId! }
      jizhi(s, pid)
      return s
    }
    case '南蛮入侵':
    case '万箭齐发': {
      use(card)
      say(s, `${pname(s, pid)} 使用【${card.name}】`)
      s.pending = { kind: 'aoe', card, source: pid, queue: others(s, pid) }
      jizhi(s, pid)
      return s
    }
    case '过河拆桥': {
      if (!validTarget(targetId, false)) return s
      const t = s.players[targetId!]
      const pool = targetCards(t)
      if (pool.length === 0) { say(s, '对方没有可拆的牌'); return s }
      use(card, targetId)
      const got = stealRandom(s, t, pool)
      s.discardPile.push(got)
      say(s, `${pname(s, pid)} 对 ${pname(s, targetId!)} 使用【过河拆桥】，拆掉【${got.name}】`)
      jizhi(s, pid)
      return s
    }
    case '顺手牵羊': {
      if (!validTarget(targetId, false, 1)) { say(s, '【顺手牵羊】只能对距离 1 的角色使用'); return s }
      const t = s.players[targetId!]
      const pool = targetCards(t)
      if (pool.length === 0) { say(s, '对方没有可牵的牌'); return s }
      use(card, targetId)
      const got = stealRandom(s, t, pool)
      p.hand.push(got)
      say(s, `${pname(s, pid)} 对 ${pname(s, targetId!)} 使用【顺手牵羊】，获得【${got.name}】`)
      jizhi(s, pid)
      return s
    }
    case '乐不思蜀': {
      if (!validTarget(targetId, false)) return s
      removeCard(p, card.id)
      s.players[targetId!].judge.push(card)
      s.lastPlayed = { pid, card, target: targetId }
      say(s, `${pname(s, pid)} 对 ${pname(s, targetId!)} 使用【乐不思蜀】`)
      jizhi(s, pid)
      return s
    }
    default:
      return s
  }
}

// 目标区域里所有可被拆/牵的牌（手牌 + 装备 + 判定区）
function targetCards(t: Player): { zone: 'hand' | 'equip' | 'judge'; card: Card; slot?: EquipSlot }[] {
  const out: { zone: 'hand' | 'equip' | 'judge'; card: Card; slot?: EquipSlot }[] = []
  for (const cd of t.hand) out.push({ zone: 'hand', card: cd })
  for (const slot of ['weapon', 'armor', 'plus', 'minus'] as EquipSlot[]) {
    if (t.equip[slot]) out.push({ zone: 'equip', card: t.equip[slot]!, slot })
  }
  for (const cd of t.judge) out.push({ zone: 'judge', card: cd })
  return out
}

function stealRandom(
  s: GameState,
  t: Player,
  pool: { zone: 'hand' | 'equip' | 'judge'; card: Card; slot?: EquipSlot }[],
): Card {
  const pick = pool[Math.floor(Math.random() * pool.length)]
  if (pick.zone === 'hand') {
    t.hand = t.hand.filter((cd) => cd.id !== pick.card.id)
  } else if (pick.zone === 'equip' && pick.slot) {
    delete t.equip[pick.slot]
  } else {
    t.judge = t.judge.filter((cd) => cd.id !== pick.card.id)
  }
  void s
  return pick.card
}

function jizhi(s: GameState, pid: number) {
  if (s.players[pid].general.name === '黄月英') {
    drawCards(s, pid, 1)
    say(s, `${pname(s, pid)} 发动【集智】摸 1 张牌`)
  }
}

function doEndPlay(s: GameState, pid: number): GameState {
  if (s.pending || s.current !== pid || s.phase !== 'play') return s
  const p = s.players[pid]
  if (p.hand.length > p.hp) {
    s.phase = 'discard'
    say(s, `${pname(s, pid)} 需弃置 ${p.hand.length - p.hp} 张牌`)
    return s
  }
  return endTurn(s, pid)
}

function doDiscard(s: GameState, pid: number, cardIds: number[]): GameState {
  if (s.phase !== 'discard' || s.current !== pid) return s
  const p = s.players[pid]
  const need = p.hand.length - p.hp
  if (cardIds.length !== need) return s
  for (const id of cardIds) {
    const cd = removeCard(p, id)
    if (cd) s.discardPile.push(cd)
  }
  say(s, `${pname(s, pid)} 弃置 ${cardIds.length} 张牌`)
  return endTurn(s, pid)
}

function endTurn(s: GameState, pid: number): GameState {
  const next = nextAlive(s, pid)
  startTurn(s, next)
  return s
}

function doZhiheng(s: GameState, pid: number, cardIds: number[]): GameState {
  if (s.pending || s.phase !== 'play' || s.current !== pid) return s
  const p = s.players[pid]
  if (p.general.name !== '孙权' || s.skillUsed || cardIds.length === 0) return s
  for (const id of cardIds) {
    const cd = removeCard(p, id)
    if (cd) s.discardPile.push(cd)
  }
  s.skillUsed = true
  say(s, `${pname(s, pid)} 发动【制衡】弃 ${cardIds.length} 张摸 ${cardIds.length} 张`)
  drawCards(s, pid, cardIds.length)
  return s
}

// 八卦阵判定
function doBagua(s: GameState, pid: number): GameState {
  const pd = s.pending
  if (!pd || pd.kind !== 'shan' || pd.target !== pid) return s
  const p = s.players[pid]
  if (p.equip.armor?.name !== '八卦阵') return s
  const flip = s.deck.pop()
  if (!flip) return s
  s.discardPile.push(flip)
  say(s, `${pname(s, pid)} 发动【八卦阵】判定：${flip.suit}${flip.color === 'red' ? '，视为打出【闪】！' : '，判定失败'}`)
  if (flip.color === 'red') {
    s.pending = null
  }
  return s
}

// ---------- 响应 ----------

function doRespond(s: GameState, pid: number, cardId: number | null): GameState {
  const pd = s.pending
  if (!pd) return s
  const p = s.players[pid]

  if (pd.kind === 'shan') {
    if (pid !== pd.target) return s
    if (cardId !== null) {
      const card = p.hand.find((cd) => cd.id === cardId)
      if (!card || !canBeShan(p, card)) return s
      removeCard(p, cardId)
      s.discardPile.push(card)
      say(s, `${pname(s, pid)} 打出【闪】抵消了【杀】`)
      s.pending = null
      // 青龙偃月刀：杀被闪后可再出一张
      const src = s.players[pd.source]
      if (src.equip.weapon?.name === '青龙偃月刀' && s.shaUsed > 0) {
        s.shaUsed--
        say(s, `${pname(s, pd.source)} 的【青龙偃月刀】生效，可再出【杀】`)
      }
      return s
    }
    say(s, `${pname(s, pid)} 没有出【闪】`)
    s.pending = null
    damage(s, pd.target, 1, pd.source)
    return s
  }

  if (pd.kind === 'juedou') {
    if (pid !== pd.target) return s
    if (cardId !== null) {
      const card = p.hand.find((cd) => cd.id === cardId)
      if (!card || !canBeSha(p, card)) return s
      removeCard(p, cardId)
      s.discardPile.push(card)
      say(s, `${pname(s, pid)} 打出【杀】，决斗转移给对方`)
      s.pending = { kind: 'juedou', source: pd.target, target: pd.source }
      return s
    }
    say(s, `${pname(s, pid)} 决斗失败`)
    s.pending = null
    damage(s, pd.target, 1, pd.source)
    return s
  }

  if (pd.kind === 'aoe') {
    if (pd.queue[0] !== pid) return s
    const needSha = pd.card.name === '南蛮入侵'
    if (cardId !== null) {
      const card = p.hand.find((cd) => cd.id === cardId)
      const ok = card && (needSha ? canBeSha(p, card) : canBeShan(p, card))
      if (!ok) return s
      removeCard(p, cardId)
      s.discardPile.push(card!)
      say(s, `${pname(s, pid)} 打出【${needSha ? '杀' : '闪'}】`)
    } else {
      say(s, `${pname(s, pid)} 未能响应【${pd.card.name}】`)
      const q = pd.queue.slice(1)
      s.pending = q.length ? { ...pd, queue: q } : null
      damage(s, pid, 1, pd.source)
      return s
    }
    const q = pd.queue.slice(1)
    s.pending = q.length ? { ...pd, queue: q } : null
    return s
  }

  if (pd.kind === 'dying') {
    if (pd.queue[0] !== pid) return s
    if (cardId !== null) {
      const card = p.hand.find((cd) => cd.id === cardId)
      if (!card || card.name !== '桃') return s
      removeCard(p, cardId)
      s.discardPile.push(card)
      const t = s.players[pd.target]
      t.hp++
      say(s, `${pname(s, pid)} 使用【桃】，${pname(s, pd.target)} 体力回复至 ${t.hp}`)
      if (t.hp > 0) {
        s.pending = null
        say(s, `${pname(s, pd.target)} 脱离濒死`)
      }
      return s
    }
    const q = pd.queue.slice(1)
    if (q.length === 0) {
      const target = pd.target
      const identity = s.players[target].identity
      s.pending = null
      die(s, target)
      if (identity === '反贼' && s.phase !== 'gameover' && s.players[s.current].alive) {
        drawCards(s, s.current, 3)
        say(s, `${pname(s, s.current)} 杀死反贼，摸 3 张牌`)
      }
      return s
    }
    s.pending = { ...pd, queue: q }
    return s
  }

  return s
}
