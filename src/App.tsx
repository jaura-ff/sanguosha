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
        small ? 'w-10 h-14 text-[10px]' : 'w-12 h-[4.5rem] text-[11px] sm:w-16 sm:h-24 sm:text-sm',
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
  s, p, targetable, dimmed, onClick, onHover, onTap, onLeave, className,
}: {
  s: GameState; p: Player; targetable?: boolean; dimmed?: boolean
  onClick?: () => void
  onHover?: (e: React.MouseEvent, p: Player) => void
  onTap?: (e: React.PointerEvent, p: Player) => void
  onLeave?: () => void
  className?: string
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
      onPointerDown={onTap ? (e) => onTap(e, p) : undefined}
      className={[
        className || 'w-24 shrink-0',
        'rounded-lg border p-2 text-left transition-all',
        'sm:w-44 sm:rounded-xl sm:p-3',
        p.alive ? 'bg-zinc-800/90 border-zinc-600' : 'bg-zinc-900/60 border-zinc-800 opacity-50',
        targetable ? 'ring-2 ring-rose-500 scale-105 cursor-pointer' : '',
        dimmed ? 'opacity-40' : '',
        s.current === p.id && p.alive ? 'border-amber-400' : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-sm font-bold text-amber-100 sm:text-base">{p.general.name}</span>
        {identityShown && (
          <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] text-white sm:px-1.5 sm:text-[10px] ${IDENTITY_COLOR[p.identity]}`}>
            {p.identity}
          </span>
        )}
      </div>
      <div className="mt-0.5 truncate text-[10px] text-zinc-400" title={p.general.skillDesc}>【{p.general.skill}】</div>
      <div className="mt-1 text-xs tracking-tight text-rose-400 sm:text-sm">
        {'♥'.repeat(Math.max(p.hp, 0))}
        <span className="text-zinc-600">{'♥'.repeat(Math.max(p.general.maxHp - p.hp, 0))}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-[10px] text-zinc-300 sm:text-xs">
        <span>手牌 {p.hand.length}</span>
        {dist !== null && <span className="hidden text-sky-300 sm:inline">距离 {dist}</span>}
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

// 全局浮动显示模式切换：固定在右上角，主菜单与游戏内都能点，仅桌面端显示
function DisplayToggle({ compact, onToggle }: { compact: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={compact ? '切换为全屏显示' : '切换为小窗显示（窗口可拖动）'}
      className="fixed right-3 top-3 z-[60] hidden items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900/90 px-2.5 py-1.5 text-xs text-zinc-300 shadow-lg backdrop-blur transition hover:border-amber-500/60 hover:text-amber-300 md:flex"
    >
      <span className="text-[11px] leading-none">{compact ? '■' : '□'}</span>
      {compact ? '全屏' : '小窗'}
    </button>
  )
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
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-700/70 bg-zinc-900/60 shadow-2xl p-6 sm:p-8 md:p-10">
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
  // 桌面端「小窗 / 全屏」显示模式，仅 md 以上生效，选择会被记住
  const [compact, setCompact] = useState(() => {
    try { return localStorage.getItem('sgs:compact') === '1' } catch { return false }
  })
  const toggleCompact = () => {
    setCompact((v) => {
      const next = !v
      try { localStorage.setItem('sgs:compact', next ? '1' : '0') } catch { /* 隐私模式下忽略 */ }
      return next
    })
  }
  // 小窗被拖动后的位置（null = 居中显示）
  const [winSize, setWinSize] = useState(() => {
    try {
      const raw = localStorage.getItem('sgs:winsize')
      if (raw) {
        const v = JSON.parse(raw) as { w: number; h: number }
        if (v.w >= 520 && v.h >= 400) return v
      }
    } catch { /* ignore */ }
    return { w: 960, h: 680 }
  })
  const [winPos, setWinPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = localStorage.getItem('sgs:winpos')
      if (raw) {
        const v = JSON.parse(raw) as { x: number; y: number }
        if (typeof v.x === 'number' && typeof v.y === 'number') return v
      }
    } catch { /* ignore */ }
    return null
  })
  const [minimized, setMinimized] = useState(false)
  const [resizing, setResizing] = useState(false)
  const winRef = useRef<HTMLDivElement>(null)

  const clampWith = (p: { x: number; y: number }, size: { w: number; h: number }) => ({
    x: Math.max(0, Math.min(p.x, Math.max(0, window.innerWidth - size.w - 8))),
    y: Math.max(0, Math.min(p.y, Math.max(0, window.innerHeight - size.h - 8))),
  })
  const persist = (key: string, value: unknown) => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* 隐私模式下忽略 */ }
  }

  // 首次进入小窗时按当前尺寸居中显示
  useEffect(() => {
    if (!compact || winPos) return
    setWinPos(clampWith({ x: (window.innerWidth - winSize.w) / 2, y: Math.max(8, (window.innerHeight - winSize.h) / 2) }, winSize))
  }, [compact, winPos, winSize])

  // 拖动标题栏移动窗口
  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const el = winRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const offX = e.clientX - r.left
    const offY = e.clientY - r.top
    let last = { x: r.left, y: r.top }
    setWinPos(last)
    const move = (ev: PointerEvent) => {
      last = clampWith({ x: ev.clientX - offX, y: ev.clientY - offY }, winSize)
      setWinPos(last)
    }
    const up = () => {
      persist('sgs:winpos', last)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // 拖右下角把手改变窗口大小（按住鼠标左键拖动）
  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return
    const el = winRef.current
    if (!el) return
    const target = e.currentTarget as HTMLElement
    try { target.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'nwse-resize'
    setResizing(true)
    const r = el.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    let size = { w: r.width, h: r.height }
    const move = (ev: PointerEvent) => {
      size = {
        w: Math.round(Math.max(520, Math.min(r.width + ev.clientX - startX, window.innerWidth - r.left - 8))),
        h: Math.round(Math.max(400, Math.min(r.height + ev.clientY - startY, window.innerHeight - r.top - 8))),
      }
      setWinSize(size)
    }
    const up = () => {
      persist('sgs:winsize', size)
      setWinPos((p) => (p ? clampWith(p, size) : p))
      setResizing(false)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      try { target.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // 浏览器窗口变小时，把小窗重新拉回可视范围内
  useEffect(() => {
    const clamp = () => setWinPos((p) => (p ? clampWith(p, winSize) : p))
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [winSize])
  const logRef = useRef<HTMLDivElement>(null)
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (tipTimer.current) clearTimeout(tipTimer.current) }, [])

  const dispatch = (a: Action) => {
    setState((prev) => apply(prev, a))
    setSelected([])
    setAwaitingTarget(null)
    setHint('')
    setWusheng(false)
    if (tipTimer.current) clearTimeout(tipTimer.current)
    setHoverTip(null)
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

  // 主菜单与游戏界面共用同一个外层容器，保证「小窗 / 全屏」切换在两个界面都即时生效
  const startScreen = (
    <StartScreen
      difficulty={difficulty}
      onDifficultyChange={setDifficulty}
      onStart={startGame}
    />
  )

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

  const showTip = (cx: number, cy: number, p: Player, autoHide: boolean) => {
    const identityShown = p.identityRevealed || p.isHuman || state.phase === 'gameover'
    const lines = [
      `技能【${p.general.skill}】：${p.general.skillDesc}`,
      `体力上限：${p.general.maxHp}`,
    ]
    if (identityShown) lines.push(`身份【${p.identity}】：${IDENTITY_DESC[p.identity]}`)
    else lines.push('身份：未知（阵亡后揭晓）')
    // 弹框宽度随视口收敛，保证窄屏不会溢出屏幕右侧
    const tipW = Math.min(256, window.innerWidth * 0.72)
    const x = Math.max(8, Math.min(cx + 12, window.innerWidth - tipW - 8))
    const y = Math.max(8, Math.min(cy + 12, window.innerHeight - 130))
    if (tipTimer.current) clearTimeout(tipTimer.current)
    setHoverTip({ x, y, title: p.general.name, lines })
    if (autoHide) tipTimer.current = setTimeout(() => setHoverTip(null), 2600)
  }

  const onPanelHover = (e: React.MouseEvent, p: Player) => showTip(e.clientX, e.clientY, p, false)

  // 触屏没有 hover，改为轻点角色弹出说明，2.6 秒后自动收起
  const onPanelTap = (e: React.PointerEvent, p: Player) => {
    if (e.pointerType === 'mouse') return
    showTip(e.clientX, e.clientY, p, true)
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      <DisplayToggle compact={compact} onToggle={toggleCompact} />
      {compact && minimized && (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="fixed bottom-4 right-4 z-[60] hidden items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-200 shadow-xl hover:border-amber-500/60 md:flex"
        >
          <span className="font-bold text-amber-400">三国杀 · 网页版</span>
          <span className="text-zinc-400">已最小化，点击恢复</span>
        </button>
      )}
      <div
        ref={winRef}
        style={{
          '--win-w': `${winSize.w}px`,
          '--win-h': `${winSize.h}px`,
          '--win-x': `${winPos?.x ?? 0}px`,
          '--win-y': `${winPos?.y ?? 0}px`,
        } as React.CSSProperties}
        className={[
          'relative flex touch-manipulation flex-col overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 pb-[env(safe-area-inset-bottom)] text-zinc-100',
          'h-[100dvh] w-full',
          compact
            ? 'md:absolute md:left-[var(--win-x)] md:top-[var(--win-y)] md:h-[var(--win-h)] md:w-[var(--win-w)] md:rounded-xl md:border md:border-zinc-600/70 md:shadow-[0_24px_70px_rgba(0,0,0,0.75)]'
            : '',
          compact && minimized ? 'md:hidden' : '',
          resizing ? 'md:ring-2 md:ring-amber-500/40' : '',
        ].join(' ')}
      >
        {/* 小窗标题栏：可拖动，右侧最小化 / 关闭 */}
        {compact && (
          <div
            onPointerDown={startDrag}
            className="hidden h-9 shrink-0 cursor-move select-none items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 md:flex"
          >
            <span className="text-xs text-zinc-600">≡</span>
            <span className="text-[11px] font-medium text-zinc-300">三国杀 · 网页版</span>
            <span className="ml-2 hidden text-[10px] text-zinc-600 lg:inline">拖动此处移动 · 拖右下角改大小</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                title="最小化"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setMinimized(true)}
                className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100"
              >
                ─
              </button>
              <button
                type="button"
                title="关闭小窗，恢复全屏"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={toggleCompact}
                className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition hover:bg-rose-600/80 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {!started ? startScreen : (<>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-zinc-800 px-3 py-2 sm:px-6 sm:py-3 md:pr-24">
        <h1 className="text-base font-bold tracking-widest text-amber-400 sm:text-xl">
          三国杀<span className="hidden sm:inline"> · 网页版</span>
        </h1>
        <div className="flex items-center gap-2 text-xs text-zinc-400 sm:gap-4 sm:text-sm">
          <span>牌堆 {state.deck.length}</span>
          <span>弃牌堆 {state.discardPile.length}</span>
          <span className="hidden sm:inline">攻击范围 {attackRange(me)}</span>
          <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-300 sm:px-2 sm:text-sm">
            {DIFFICULTY_NAMES[difficulty]}
          </span>
          {!state.winner && (
            <Button
              size="sm"
              variant="destructive"
              className="px-2 text-xs sm:px-3 sm:text-sm"
              onClick={() => {
                if (window.confirm('确定要结束本局游戏吗？将揭晓所有身份。')) {
                  dispatch({ type: 'quit' })
                }
              }}
            >
              结束
              <span className="hidden sm:inline">游戏</span>
            </Button>
          )}
          <Button size="sm" variant="outline" className="px-2 text-xs sm:px-3 sm:text-sm" onClick={startGame}>
            重开
            <span className="hidden sm:inline">开始</span>
          </Button>
          <Button size="sm" variant="ghost" className="hidden px-3 text-sm sm:inline-flex" onClick={backToMenu}>
            返回主菜单
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden min-h-0 md:flex-row">
        <main className={`flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto p-2 sm:gap-3 sm:p-4 ${compact ? '' : 'md:overflow-hidden'}`}>
          <div className="flex w-full shrink-0 justify-center gap-2 sm:gap-4">
            {state.players.slice(1).map((p) => (
              <PlayerPanel
                key={p.id}
                s={state}
                p={p}
                targetable={targetable(p)}
                dimmed={awaitingTarget !== null && !targetable(p) && p.alive}
                onClick={() => onTargetClick(p.id)}
                onHover={onPanelHover}
                onTap={onPanelTap}
                onLeave={() => setHoverTip(null)}
              />
            ))}
          </div>

          <div className="flex w-full max-w-2xl min-h-20 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/70 p-3 text-center sm:min-h-24 sm:p-4">
            {state.winner ? (
              <>
                <div className="text-xl font-bold text-amber-400 sm:text-2xl">
                  {state.winner === '主公方' ? '🏆 主公方获胜！' : state.winner === '反贼' ? '🗡️ 反贼获胜！' : '🏁 本局已结束'}
                </div>
                <div className="text-xs text-zinc-400 sm:text-sm">
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
                <div className="text-base text-rose-300 sm:text-lg">{pendingText()}</div>
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
                <div className="text-base text-amber-200 sm:text-lg">使用【{awaitingCard.name}】，请选择目标</div>
                <Button variant="secondary" size="sm" onClick={() => { setAwaitingTarget(null); setHint('') }}>取消</Button>
              </>
            ) : discarding ? (
              <div className="text-base text-amber-200 sm:text-lg">
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
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end sm:gap-4">
              <PlayerPanel
                s={state}
                p={me}
                className="w-full shrink-0 sm:w-44"
                onHover={onPanelHover}
                onTap={onPanelTap}
                onLeave={() => setHoverTip(null)}
              />
              <div className="flex-1">
                <div className="flex flex-wrap justify-center gap-1 py-1 min-h-20 max-h-28 overflow-y-auto sm:gap-1.5 sm:min-h-24 sm:max-h-40">
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
                <div className="flex flex-wrap justify-center gap-1.5 mt-2 sm:gap-2">
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

        <aside className="flex h-24 shrink-0 flex-col border-t border-zinc-800 sm:h-28 md:h-auto md:w-72 md:shrink md:border-l md:border-t-0">
          <div className="border-b border-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-300 sm:text-sm">战报</div>
          <div ref={logRef} className="flex-1 space-y-1 overflow-y-auto p-2 text-[11px] text-zinc-400 sm:p-3 sm:text-xs">
            {state.log.map((line, i) => (
              <div key={i} className={i === state.log.length - 1 ? 'text-amber-200' : ''}>{line}</div>
            ))}
          </div>
        </aside>
        </div>
        </>)}
        {/* 右下角把手：按住鼠标左键拖动改变窗口大小 */}
        {compact && !minimized && (
          <div
            onPointerDown={startResize}
            onDoubleClick={() => {
              const d = { w: 960, h: 680 }
              setWinSize(d)
              persist('sgs:winsize', d)
              setWinPos((p) => (p ? clampWith(p, d) : p))
            }}
            title="按住鼠标左键拖动改变大小（双击恢复默认 960×680）"
            className={`absolute bottom-0 right-0 z-20 hidden h-7 w-7 cursor-nwse-resize items-end justify-end rounded-tl-lg p-1 md:flex ${resizing ? 'bg-amber-500/25' : 'hover:bg-zinc-700/70'}`}
          >
            <svg viewBox="0 0 12 12" className={`h-3.5 w-3.5 ${resizing ? 'text-amber-300' : 'text-zinc-400'}`}>
              <path d="M11 3 L3 11 M11 7.5 L7.5 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>

      {/* 角色悬浮说明弹框 */}
      {hoverTip && (
        <div
          className="pointer-events-none fixed z-50 w-56 max-w-[72vw] rounded-lg border border-amber-600/50 bg-zinc-900/95 p-2.5 shadow-xl sm:w-64 sm:p-3"
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
