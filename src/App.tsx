import { useEffect, useMemo, useRef, useState } from 'react'
import {
  apply, attackRange, canBeSha, canBeShan, distance, inRange, newGame, pname,
} from './game/engine'
import type { Action, Card, GameState, Player } from './game/engine'
import { aiAction } from './game/ai'
import type { Difficulty } from './game/ai'
import { Button } from '@/components/ui/button'

const IDENTITY_COLOR: Record<string, string> = {
  主公: 'bg-amber-500',
  忠臣: 'bg-sky-600',
  反贼: 'bg-rose-600',
}

function CardView({
  card, selected, disabled, onClick, small,
}: { card: Card; selected?: boolean; disabled?: boolean; onClick?: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={card.name}
      className={[
        'relative rounded-md border shadow-sm font-bold transition-all select-none',
        small ? 'w-12 h-16 text-xs' : 'w-16 h-24 text-sm',
        card.color === 'red' ? 'text-rose-600' : 'text-zinc-900',
        card.kind === 'equip'
          ? 'bg-gradient-to-b from-emerald-50 to-emerald-100 border-emerald-400'
          : 'bg-gradient-to-b from-amber-50 to-amber-100 border-amber-300',
        selected ? '-translate-y-3 ring-2 ring-amber-500' : disabled ? '' : 'hover:-translate-y-1',
        disabled ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <div className="absolute top-1 left-1 leading-none">{card.suit}</div>
      <div className="flex h-full items-center justify-center px-0.5 leading-tight">{card.name}</div>
    </button>
  )
}

function EquipRow({ p }: { p: Player }) {
  const items = [p.equip.weapon, p.equip.armor, p.equip.plus, p.equip.minus].filter(Boolean) as Card[]
  if (!items.length && !p.judge.length) return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {items.map((cd) => (
        <span key={cd.id} className="text-[10px] px-1 rounded bg-emerald-900/70 text-emerald-200 border border-emerald-700">
          {cd.name}
        </span>
      ))}
      {p.judge.map((cd) => (
        <span key={cd.id} className="text-[10px] px-1 rounded bg-purple-900/70 text-purple-200 border border-purple-700">
          ⏳{cd.name}
        </span>
      ))}
    </div>
  )
}

function PlayerPanel({
  s, p, targetable, dimmed, onClick, onHover, onLeave,
}: {
  s: GameState; p: Player; targetable?: boolean; dimmed?: boolean
  onClick?: () => void
  onHover?: (e: React.MouseEvent, p: Player) => void
  onLeave?: () => void
}) {
  const identityShown = p.identityRevealed || p.isHuman || s.phase === 'gameover'
  const me = s.players[0]
  const dist = p.id !== 0 && p.alive && me.alive ? distance(s, 0, p.id) : null
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      onMouseMove={onHover ? (e) => onHover(e, p) : undefined}
      onMouseLeave={onLeave}
      className={[
        'w-44 rounded-xl border p-3 text-left transition-all',
        p.alive ? 'bg-zinc-800/90 border-zinc-600' : 'bg-zinc-900/60 border-zinc-800 opacity-50',
        targetable ? 'ring-2 ring-rose-500 scale-105 cursor-pointer' : '',
        dimmed ? 'opacity-40' : '',
        s.current === p.id && p.alive ? 'border-amber-400' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-amber-100">{p.general.name}</span>
        {identityShown && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded text-white ${IDENTITY_COLOR[p.identity]}`}>
            {p.identity}
          </span>
        )}
      </div>
      <div className="text-[10px] text-zinc-400 mt-0.5" title={p.general.skillDesc}>【{p.general.skill}】</div>
      <div className="mt-1 text-rose-400 text-sm tracking-tight">
        {'♥'.repeat(Math.max(p.hp, 0))}
        <span className="text-zinc-600">{'♥'.repeat(Math.max(p.general.maxHp - p.hp, 0))}</span>
      </div>
      <div className="mt-1 text-xs text-zinc-300 flex justify-between">
        <span>手牌 {p.hand.length}</span>
        {dist !== null && <span className="text-sky-300">距离 {dist}</span>}
        {!p.alive && <span className="text-zinc-500">已阵亡</span>}
        {s.current === p.id && p.alive && <span className="text-amber-400">行动中</span>}
      </div>
      <EquipRow p={p} />
    </button>
  )
}

const IDENTITY_DESC: Record<string, string> = {
  主公: '获胜条件：消灭所有反贼。注意：主公阵亡，反贼立即获胜！',
  忠臣: '获胜条件：保护主公，与主公一同消灭所有反贼。',
  反贼: '获胜条件：杀死主公。反贼同伴被击杀时，击杀者摸 3 张牌。',
}

const DIFFICULTIES: Array<{
  value: Difficulty
  name: string
  label: string
  description: string
}> = [
  { value: 'easy', name: '简单', label: '初识战场', description: 'AI 偶尔失误，适合熟悉卡牌与流程。' },
  { value: 'normal', name: '普通', label: '势均力敌', description: 'AI 稳定行动，保留原有对局体验。' },
  { value: 'hard', name: '困难', label: '谋定天下', description: 'AI 更善于集火、留牌与把握进攻时机。' },
]

const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
}

function StartScreen({
  difficulty,
  onDifficultyChange,
  onStart,
}: {
  difficulty: Difficulty
  onDifficultyChange: (difficulty: Difficulty) => void
  onStart: () => void
}) {
  const rules = [
    '每名角色回合开始摸 2 张牌，出牌阶段可使用装备、锦囊与【杀】。',
    '每回合限出 1 张【杀】（张飞、诸葛连弩不受此限）。',
    '攻击范围默认 1，装备武器或 −1 马可扩大；【顺手牵羊】需距离 1。',
    '体力降到 0 时进入濒死，需自己或他人出【桃】相救。',
  ]
  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-2xl border border-zinc-700/70 bg-zinc-900/60 shadow-2xl p-8 sm:p-10">
          <div className="text-center">
            <div className="text-4xl sm:text-5xl font-black tracking-[0.3em] text-amber-400 drop-shadow-[0_0_18px_rgba(251,191,36,0.25)]">
              三国杀
            </div>
            <div className="mt-3 text-xs sm:text-sm tracking-[0.4em] text-zinc-400">网 页 版 · 4 人 局</div>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              你将随机获得<span className="font-bold text-amber-300">主公 / 忠臣 / 反贼</span>
              身份，其他玩家的身份隐藏在牌堆之后——观察行动、找出敌人、完成你的阵营目标。
            </p>
          </div>

          <div className="mt-8 grid gap-2 sm:grid-cols-3">
            {Object.entries(IDENTITY_DESC).map(([name, desc]) => (
              <div key={name} className="rounded-lg border border-zinc-700/70 bg-zinc-800/50 p-3">
                <div className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold text-white ${IDENTITY_COLOR[name]}`}>
                  {name}
                </div>
                <div className="mt-2 text-[11px] leading-relaxed text-zinc-400">{desc}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="mb-2 text-xs font-bold tracking-widest text-zinc-400">玩 法 要 点</div>
            <ul className="space-y-1.5 text-xs leading-relaxed text-zinc-400">
              {rules.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="text-amber-500/80">·</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <fieldset className="mt-6">
            <legend className="mb-3 text-xs font-bold tracking-widest text-zinc-400">选 择 难 度</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {DIFFICULTIES.map((item) => {
                const active = difficulty === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onDifficultyChange(item.value)}
                    className={[
                      'rounded-lg border p-3 text-left transition-all duration-200 active:scale-[0.98]',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400',
                      active
                        ? 'border-amber-400 bg-amber-400/10 ring-1 ring-amber-400/30'
                        : 'border-zinc-700 bg-zinc-800/40 hover:border-zinc-500 hover:bg-zinc-800/70',
                    ].join(' ')}
                  >
                    <div className={active ? 'text-sm font-bold text-amber-300' : 'text-sm font-bold text-zinc-200'}>
                      {item.name}
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-zinc-400">{item.label}</div>
                    <div className="mt-2 text-[11px] leading-relaxed text-zinc-500">{item.description}</div>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="mt-6 flex flex-col items-center gap-3">
            <Button
              size="lg"
              className="w-full sm:w-64 text-base font-bold tracking-widest"
              onClick={onStart}
            >
              开 始 游 戏
            </Button>
            <div className="text-[11px] text-zinc-500">开局后由你先行动，对手由 AI 自动出牌</div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface HoverTip { x: number; y: number; title: string; lines: string[] }

export default function App() {
  const [started, setStarted] = useState(false)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [state, setState] = useState<GameState>(() => newGame())
  const [hoverTip, setHoverTip] = useState<HoverTip | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [awaitingTarget, setAwaitingTarget] = useState<number | null>(null)
  const [hint, setHint] = useState('')
  const [wusheng, setWusheng] = useState(false) // 关羽：红牌当杀模式
  const logRef = useRef<HTMLDivElement>(null)

  const dispatch = (a: Action) => {
    setState((prev) => apply(prev, a))
    setSelected([])
    setAwaitingTarget(null)
    setHint('')
    setWusheng(false)
  }

  useEffect(() => {
    if (!started) return
    const act = aiAction(state, difficulty)
    if (!act) return
    const t = setTimeout(() => dispatch(act), 900)
    return () => clearTimeout(t)
  }, [state, started, difficulty])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [state.log.length])

  const me = state.players[0]
  const myTurn = state.current === 0 && state.phase === 'play' && !state.pending && !state.winner
  const discarding = state.current === 0 && state.phase === 'discard' && !state.winner
  const needDiscard = Math.max(me.hand.length - me.hp, 0)

  const myPending = useMemo(() => {
    const pd = state.pending
    if (!pd || state.winner) return null
    if ((pd.kind === 'shan' || pd.kind === 'juedou') && pd.target === 0) return pd
    if ((pd.kind === 'aoe' || pd.kind === 'dying') && pd.queue[0] === 0) return pd
    return null
  }, [state])

  const resetUi = () => {
    setSelected([])
    setAwaitingTarget(null)
    setHint('')
    setWusheng(false)
    setHoverTip(null)
  }

  const startGame = () => {
    setState(newGame())
    resetUi()
    setStarted(true)
  }

  const backToMenu = () => {
    setState(newGame())
    resetUi()
    setStarted(false)
  }

  if (!started) {
    return (
      <StartScreen
        difficulty={difficulty}
        onDifficultyChange={setDifficulty}
        onStart={startGame}
      />
    )
  }

  const usableForPending = (card: Card): boolean => {
    if (!myPending) return false
    if (myPending.kind === 'shan') return canBeShan(me, card)
    if (myPending.kind === 'juedou') return canBeSha(me, card)
    if (myPending.kind === 'aoe')
      return myPending.card.name === '南蛮入侵' ? canBeSha(me, card) : canBeShan(me, card)
    if (myPending.kind === 'dying') return card.name === '桃'
    return false
  }

  // 该牌点击后是否按【杀】处理（与引擎 asSha 规则一致）
  const isShaLike = (card: Card): boolean =>
    card.name === '杀' ||
    ((me.general.name === '赵云' || me.general.name === '关羽') && card.name === '闪') ||
    (wusheng && me.general.name === '关羽' && card.color === 'red' && card.kind !== 'equip')

  // 出牌阶段：返回 null 表示可出，否则为不可出原因
  const playBlockReason = (card: Card): string | null => {
    if (card.kind === 'equip') return null
    if (isShaLike(card)) {
      const unlimited = me.general.name === '张飞' || me.equip.weapon?.name === '诸葛连弩'
      if (!unlimited && state.shaUsed >= 1) return '每回合限一张【杀】（张飞/诸葛连弩可无限制）'
      const hasTarget = state.players.some((p) => p.alive && p.id !== 0 && inRange(state, 0, p.id))
      if (!hasTarget) return `攻击范围 ${attackRange(me)} 内没有目标（装备武器或−1马扩大范围）`
      return null
    }
    switch (card.name) {
      case '闪': return '【闪】不能主动打出，用于响应【杀】'
      case '桃': return me.hp >= me.general.maxHp ? '体力已满，【桃】留到受伤或救人时用' : null
      case '顺手牵羊': {
        const ok = state.players.some((p) => p.alive && p.id !== 0 && distance(state, 0, p.id) === 1)
        return ok ? null : '【顺手牵羊】只能对距离 1 的角色使用'
      }
      default: return null
    }
  }

  const pendingText = () => {
    if (!myPending) return ''
    switch (myPending.kind) {
      case 'shan': return `${pname(state, myPending.source)} 对你使用【杀】，请出【闪】`
      case 'juedou': return `决斗中！请打出【杀】，否则受到 1 点伤害`
      case 'aoe': return `${pname(state, myPending.source)} 使用【${myPending.card.name}】，请打出【${myPending.card.name === '南蛮入侵' ? '杀' : '闪'}】`
      case 'dying': return `${pname(state, myPending.target)} 濒死，是否使用【桃】？`
    }
  }

  const needsTarget = (card: Card): boolean =>
    isShaLike(card) || ['决斗', '过河拆桥', '顺手牵羊', '乐不思蜀'].includes(card.name)

  const targetable = (p: Player): boolean => {
    if (awaitingTarget === null || !myTurn || p.id === 0 || !p.alive) return false
    const card = me.hand.find((c) => c.id === awaitingTarget)
    if (!card) return false
    if (isShaLike(card)) return inRange(state, 0, p.id)
    if (card.name === '顺手牵羊') return distance(state, 0, p.id) === 1
    return true
  }

  const onHandClick = (card: Card) => {
    if (myPending) {
      if (usableForPending(card)) dispatch({ type: 'respond', pid: 0, cardId: card.id })
      else setHint('这张牌不能用于当前响应')
      return
    }
    if (discarding) {
      setSelected((prev) =>
        prev.includes(card.id) ? prev.filter((x) => x !== card.id) : [...prev, card.id],
      )
      return
    }
    if (!myTurn) { setHint('还没到你的回合'); return }
    if (selected.length > 0 && me.general.name === '孙权' && !state.skillUsed) {
      setSelected((prev) =>
        prev.includes(card.id) ? prev.filter((x) => x !== card.id) : [...prev, card.id],
      )
      return
    }
    const blocked = playBlockReason(card)
    if (blocked) { setHint(blocked); return }
    if (needsTarget(card)) {
      setAwaitingTarget(card.id)
      setHint(isShaLike(card) ? '请点击一名攻击范围内的对手' : '请点击一名目标玩家')
      return
    }
    dispatch({ type: 'play', pid: 0, cardId: card.id })
  }

  const onTargetClick = (pid: number) => {
    if (targetable(state.players[pid])) {
      const card = me.hand.find((c) => c.id === awaitingTarget)
      const asSha =
        card && card.name !== '杀' && card.name !== '闪' &&
        me.general.name === '关羽' && card.color === 'red' && card.kind !== 'equip'
      dispatch({ type: 'play', pid: 0, cardId: awaitingTarget!, targetId: pid, asSha: asSha || undefined })
    }
  }

  const awaitingCard = awaitingTarget !== null ? me.hand.find((c) => c.id === awaitingTarget) : null
  const canBagua = myPending?.kind === 'shan' && me.equip.armor?.name === '八卦阵'

  const onPanelHover = (e: React.MouseEvent, p: Player) => {
    const identityShown = p.identityRevealed || p.isHuman || state.phase === 'gameover'
    const lines = [
      `技能【${p.general.skill}】：${p.general.skillDesc}`,
      `体力上限：${p.general.maxHp}`,
    ]
    if (identityShown) lines.push(`身份【${p.identity}】：${IDENTITY_DESC[p.identity]}`)
    else lines.push('身份：未知（阵亡后揭晓）')
    const x = Math.min(e.clientX + 14, window.innerWidth - 280)
    const y = Math.min(e.clientY + 14, window.innerHeight - 140)
    setHoverTip({ x, y, title: p.general.name, lines })
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800">
        <h1 className="text-xl font-bold text-amber-400 tracking-widest">三国杀 · 网页版</h1>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span>牌堆 {state.deck.length}</span>
          <span>弃牌堆 {state.discardPile.length}</span>
          <span>攻击范围 {attackRange(me)}</span>
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-300">
            {DIFFICULTY_NAMES[difficulty]}
          </span>
          {!state.winner && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (window.confirm('确定要结束本局游戏吗？将揭晓所有身份。')) {
                  dispatch({ type: 'quit' })
                }
              }}
            >
              结束游戏
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={startGame}>
            重新开始
          </Button>
          <Button size="sm" variant="ghost" onClick={backToMenu}>
            返回主菜单
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <main className="flex-1 flex flex-col items-center justify-between p-4 gap-3 overflow-hidden min-h-0">
          <div className="flex gap-4 shrink-0">
            {state.players.slice(1).map((p) => (
              <PlayerPanel
                key={p.id}
                s={state}
                p={p}
                targetable={targetable(p)}
                dimmed={awaitingTarget !== null && !targetable(p) && p.alive}
                onClick={() => onTargetClick(p.id)}
                onHover={onPanelHover}
                onLeave={() => setHoverTip(null)}
              />
            ))}
          </div>

          <div className="w-full max-w-2xl min-h-24 rounded-xl border border-zinc-700 bg-zinc-900/70 flex flex-col items-center justify-center p-4 text-center gap-2">
            {state.winner ? (
              <>
                <div className="text-2xl font-bold text-amber-400">
                  {state.winner === '主公方' ? '🏆 主公方获胜！' : state.winner === '反贼' ? '🗡️ 反贼获胜！' : '🏁 本局已结束'}
                </div>
                <div className="text-sm text-zinc-400">
                  {state.players.map((p) => `${p.general.name}·${p.identity}`).join('　')}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={startGame}>
                    再来一局
                  </Button>
                  <Button size="sm" variant="outline" onClick={backToMenu}>
                    返回主菜单
                  </Button>
                </div>
              </>
            ) : myPending ? (
              <>
                <div className="text-lg text-rose-300">{pendingText()}</div>
                <div className="flex gap-2">
                  {canBagua && (
                    <Button size="sm" variant="outline" onClick={() => dispatch({ type: 'bagua', pid: 0 })}>
                      发动八卦阵判定
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => dispatch({ type: 'respond', pid: 0, cardId: null })}>
                    不出 / 放弃
                  </Button>
                </div>
              </>
            ) : awaitingCard ? (
              <>
                <div className="text-lg text-amber-200">使用【{awaitingCard.name}】，请选择目标</div>
                <Button variant="secondary" size="sm" onClick={() => { setAwaitingTarget(null); setHint('') }}>取消</Button>
              </>
            ) : discarding ? (
              <div className="text-lg text-amber-200">
                弃牌阶段：请选择 {needDiscard} 张牌弃置（已选 {selected.length}）
              </div>
            ) : myTurn ? (
              <div className="text-zinc-300">你的回合：点击手牌出牌，或结束出牌</div>
            ) : (
              <div className="text-zinc-500 animate-pulse">{pname(state, state.current)} 行动中…</div>
            )}
            {hint && <div className="text-sm text-sky-300">💡 {hint}</div>}
            {state.lastPlayed && (
              <div className="text-xs text-zinc-500">
                上一步：{pname(state, state.lastPlayed.pid)} 使用了【{state.lastPlayed.card.name}】
              </div>
            )}
          </div>

          <div className="w-full max-w-3xl shrink-0">
            <div className="flex items-end gap-4">
              <PlayerPanel s={state} p={me} onHover={onPanelHover} onLeave={() => setHoverTip(null)} />
              <div className="flex-1">
                <div className="flex flex-wrap gap-1.5 justify-center min-h-24 max-h-40 overflow-y-auto py-1">
                  {me.hand.map((card) => {
                    const blocked = myTurn && !myPending ? playBlockReason(card) !== null : false
                    const pendingDisabled = myPending ? !usableForPending(card) : false
                    return (
                      <CardView
                        key={card.id}
                        card={card}
                        selected={selected.includes(card.id) || awaitingTarget === card.id}
                        disabled={blocked || pendingDisabled}
                        onClick={() => onHandClick(card)}
                      />
                    )
                  })}
                </div>
                <div className="flex justify-center gap-2 mt-2">
                  {myTurn && (
                    <>
                      <Button size="sm" onClick={() => dispatch({ type: 'endPlay', pid: 0 })}>结束出牌</Button>
                      {me.general.name === '关羽' && (
                        <Button
                          size="sm"
                          variant={wusheng ? 'default' : 'secondary'}
                          onClick={() => { setWusheng(!wusheng); setAwaitingTarget(null); setHint(wusheng ? '' : '武圣模式：点击任意红色手牌当【杀】使用') }}
                        >
                          武圣·红牌当杀{wusheng ? '·开' : ''}
                        </Button>
                      )}
                      {me.general.name === '孙权' && !state.skillUsed && selected.length > 0 && (
                        <Button size="sm" variant="secondary" onClick={() => dispatch({ type: 'zhiheng', pid: 0, cardIds: selected })}>
                          制衡（换 {selected.length} 张）
                        </Button>
                      )}
                    </>
                  )}
                  {discarding && (
                    <Button
                      size="sm"
                      disabled={selected.length !== needDiscard}
                      onClick={() => dispatch({ type: 'discard', pid: 0, cardIds: selected })}
                    >
                      确认弃牌（{selected.length}/{needDiscard}）
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside className="w-72 border-l border-zinc-800 flex flex-col">
          <div className="px-3 py-2 text-sm font-bold text-zinc-300 border-b border-zinc-800">战报</div>
          <div ref={logRef} className="flex-1 overflow-y-auto p-3 space-y-1 text-xs text-zinc-400">
            {state.log.map((line, i) => (
              <div key={i} className={i === state.log.length - 1 ? 'text-amber-200' : ''}>{line}</div>
            ))}
          </div>
        </aside>
      </div>

      {/* 角色悬浮说明弹框 */}
      {hoverTip && (
        <div
          className="fixed z-50 w-64 rounded-lg border border-amber-600/50 bg-zinc-900/95 shadow-xl p-3 pointer-events-none"
          style={{ left: hoverTip.x, top: hoverTip.y }}
        >
          <div className="font-bold text-amber-300 text-sm mb-1">{hoverTip.title}</div>
          {hoverTip.lines.map((line, i) => (
            <div key={i} className="text-xs text-zinc-300 leading-relaxed">{line}</div>
          ))}
        </div>
      )}
    </div>
  )
}
