// AI 决策 v2：适配装备、距离、新卡牌
import { canBeSha, canBeShan, distance, inRange } from './engine'
import type { Action, GameState, Player } from './engine'

export type Difficulty = 'easy' | 'normal' | 'hard'

function enemiesOf(s: GameState, p: Player): Player[] {
  const rebels = s.players.filter((x) => x.alive && x.identity === '反贼')
  if (p.identity === '反贼') {
    const lord = s.players.find((x) => x.alive && x.identity === '主公')
    return lord ? [lord] : []
  }
  return rebels
}

function pickTarget(s: GameState, p: Player, mustInRange: boolean, difficulty: Difficulty): number | undefined {
  let foes = enemiesOf(s, p)
  if (mustInRange) foes = foes.filter((f) => inRange(s, p.id, f.id))
  if (!foes.length) return undefined
  if (difficulty === 'easy') return foes[Math.floor(Math.random() * foes.length)].id
  foes.sort((a, b) => a.hp - b.hp || a.hand.length - b.hand.length)
  return foes[0].id
}

function hasCards(p: Player): boolean {
  return p.hand.length > 0 || Object.keys(p.equip).length > 0 || p.judge.length > 0
}

export function aiAction(s: GameState, difficulty: Difficulty = 'normal'): Action | null {
  if (s.winner) return null

  // 1. 响应阶段
  const pd = s.pending
  if (pd) {
    let pid: number | null = null
    if (pd.kind === 'shan' || pd.kind === 'juedou') pid = pd.target
    else if (pd.kind === 'aoe' || pd.kind === 'dying') pid = pd.queue[0] ?? null
    if (pid === null) return null
    const p = s.players[pid]
    if (p.isHuman) return null

    // 简单难度下 AI 偶尔会错过响应，让新手有更宽松的进攻空间。
    if (difficulty === 'easy' && Math.random() < 0.3) {
      return { type: 'respond', pid, cardId: null }
    }

    if (pd.kind === 'shan') {
      const shan = p.hand.find((cd) => canBeShan(p, cd))
      if (shan) return { type: 'respond', pid, cardId: shan.id }
      if (p.equip.armor?.name === '八卦阵') return { type: 'bagua', pid }
      return { type: 'respond', pid, cardId: null }
    }
    if (pd.kind === 'juedou') {
      const sha = p.hand.find((cd) => canBeSha(p, cd))
      return { type: 'respond', pid, cardId: sha ? sha.id : null }
    }
    if (pd.kind === 'aoe') {
      const needSha = pd.card.name === '南蛮入侵'
      const cd = p.hand.find((x) => (needSha ? canBeSha(p, x) : canBeShan(p, x)))
      return { type: 'respond', pid, cardId: cd ? cd.id : null }
    }
    if (pd.kind === 'dying') {
      const target = s.players[pd.target]
      const tao = p.hand.find((x) => x.name === '桃')
      if (!tao) return { type: 'respond', pid, cardId: null }
      const shouldSave =
        pd.target === pid ||
        (p.identity !== '反贼' && target.identity === '主公') ||
        (p.identity === '反贼' && target.identity === '反贼')
      return { type: 'respond', pid, cardId: shouldSave ? tao.id : null }
    }
    return null
  }

  // 2. 自己的回合
  const p = s.players[s.current]
  if (!p || p.isHuman || !p.alive) return null

  if (s.phase === 'discard') {
    const need = p.hand.length - p.hp
    if (need <= 0) return { type: 'discard', pid: p.id, cardIds: [] }
    const sorted = [...p.hand].sort((a, b) => discardRank(a) - discardRank(b))
    return { type: 'discard', pid: p.id, cardIds: sorted.slice(0, need).map((x) => x.id) }
  }

  if (s.phase !== 'play') return null

  // 简单难度下 AI 偶尔会提前收手，但仍会正常完成回合。
  if (difficulty === 'easy' && Math.random() < 0.22) {
    return { type: 'endPlay', pid: p.id }
  }

  // 2.1 装备（优先武器，其次防具、马）
  const equipOrder = ['weapon', 'armor', 'minus', 'plus'] as const
  for (const slot of equipOrder) {
    const eq = p.hand.find((x) => x.kind === 'equip' && x.slot === slot)
    if (eq && !p.equip[slot]) return { type: 'play', pid: p.id, cardId: eq.id }
  }

  // 2.2 桃
  if (p.hp < p.general.maxHp) {
    const tao = p.hand.find((x) => x.name === '桃')
    if (tao) return { type: 'play', pid: p.id, cardId: tao.id }
  }
  // 2.3 无中生有
  const wz = p.hand.find((x) => x.name === '无中生有')
  if (wz) return { type: 'play', pid: p.id, cardId: wz.id }
  // 2.4 孙权制衡
  if (p.general.name === '孙权' && !s.skillUsed) {
    const junk = p.hand.filter((x) => !canBeShan(p, x) && x.name !== '桃' && !canBeSha(p, x) && x.kind !== 'equip')
    if (junk.length >= 2) return { type: 'zhiheng', pid: p.id, cardIds: junk.map((x) => x.id) }
  }

  const rangeTarget = pickTarget(s, p, true, difficulty)
  const anyTarget = pickTarget(s, p, false, difficulty)

  // 2.5 杀（优先真杀，其次闪转化，关羽最后才用武圣转化其他红牌）
  if (rangeTarget !== undefined) {
    const canSha = p.general.name === '张飞' || p.equip.weapon?.name === '诸葛连弩' || s.shaUsed < 1
    if (canSha) {
      const real = p.hand.find((x) => x.name === '杀')
      if (real) return { type: 'play', pid: p.id, cardId: real.id, targetId: rangeTarget }
      const shan = (p.general.name === '赵云' || p.general.name === '关羽') && p.hand.find((x) => x.name === '闪')
      if (shan) return { type: 'play', pid: p.id, cardId: shan.id, targetId: rangeTarget }
      if (p.general.name === '关羽') {
        const red = p.hand.find((x) => x.color === 'red' && x.kind !== 'equip')
        if (red) return { type: 'play', pid: p.id, cardId: red.id, targetId: rangeTarget, asSha: true }
      }
    }
  }
  if (anyTarget !== undefined) {
    const t = s.players[anyTarget]
    // 2.6 决斗
    const juedou = p.hand.find((x) => x.name === '决斗')
    const shaCount = p.hand.filter((x) => canBeSha(p, x)).length
    if (juedou && (difficulty === 'hard' ? shaCount > 0 && t.hand.length <= shaCount + 1 : t.hand.length <= shaCount)) {
      return { type: 'play', pid: p.id, cardId: juedou.id, targetId: anyTarget }
    }
    // 2.7 AOE
    const foes = enemiesOf(s, p).length
    const aoe = p.hand.find((x) => x.name === '南蛮入侵' || x.name === '万箭齐发')
    if (aoe && foes >= (difficulty === 'hard' ? 1 : 2)) return { type: 'play', pid: p.id, cardId: aoe.id }
    // 2.8 乐不思蜀（对核心敌人）
    const le = p.hand.find((x) => x.name === '乐不思蜀')
    if (le && !t.judge.some((x) => x.name === '乐不思蜀')) {
      return { type: 'play', pid: p.id, cardId: le.id, targetId: anyTarget }
    }
    // 2.9 顺手牵羊（距离 1）
    const shun = p.hand.find((x) => x.name === '顺手牵羊')
    if (shun && distance(s, p.id, anyTarget) === 1 && hasCards(t)) {
      return { type: 'play', pid: p.id, cardId: shun.id, targetId: anyTarget }
    }
    // 2.10 过河拆桥
    const chai = p.hand.find((x) => x.name === '过河拆桥')
    if (chai && hasCards(t)) return { type: 'play', pid: p.id, cardId: chai.id, targetId: anyTarget }
    // 2.11 桃园结义（自己或主公残血时）
    const tao2 = p.hand.find((x) => x.name === '桃园结义')
    const lord = s.players.find((x) => x.alive && x.identity === '主公')
    const allyHurt = p.hp < p.general.maxHp || (p.identity !== '反贼' && lord && lord.hp < lord.general.maxHp)
    if (tao2 && allyHurt) return { type: 'play', pid: p.id, cardId: tao2.id }
  }
  return { type: 'endPlay', pid: p.id }
}

function discardRank(card: { name: string; kind: string }): number {
  if (card.kind === 'equip') return 90
  switch (card.name) {
    case '桃': return 100
    case '闪': return 80
    case '无中生有': return 60
    case '杀': return 40
    default: return 20
  }
}
