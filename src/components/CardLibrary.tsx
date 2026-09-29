// 图库：卡牌与武将玩法速查（可从主菜单或游戏内打开）
import { useState } from 'react'
import { CARD_INFO, KIND_LABEL, SLOT_LABEL } from '@/game/cardLibrary'
import { GENERALS } from '@/game/engine'

type Tab = 'basic' | 'trick' | 'equip' | 'general'

const TABS: { id: Tab; label: string }[] = [
  { id: 'basic', label: '基本牌' },
  { id: 'trick', label: '锦囊牌' },
  { id: 'equip', label: '装备牌' },
  { id: 'general', label: '武将' },
]

interface Item {
  key: string
  title: string
  badge: string
  summary: string
  rows: { label: string; text: string }[]
}

export function CardLibrary({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('basic')
  const [selected, setSelected] = useState<string | null>(null)

  const items: Item[] = tab === 'general'
    ? GENERALS.map((g) => ({
        key: g.name,
        title: g.name,
        badge: `体力 ${g.maxHp}`,
        summary: `【${g.skill}】${g.skillDesc}`,
        rows: [
          { label: '技能', text: `【${g.skill}】${g.skillDesc}` },
          { label: '体力上限', text: `${g.maxHp} 点` },
        ],
      }))
    : CARD_INFO.filter((c) => c.kind === tab).map((c) => ({
        key: c.name,
        title: c.name,
        badge: c.kind === 'equip' && c.slot ? SLOT_LABEL[c.slot] : KIND_LABEL[c.kind],
        summary: c.summary,
        rows: [
          { label: '效果', text: c.effect },
          { label: '使用时机', text: c.usage },
          { label: '牌堆数量', text: `${c.count} 张` },
          ...(c.range ? [{ label: '攻击范围', text: `${c.range}` }] : []),
          { label: '玩法技巧', text: c.tips },
        ],
      }))

  const detail = items.find((i) => i.key === selected) ?? null

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2 sm:px-4 sm:py-3">
          <h2 className="text-sm font-bold tracking-widest text-amber-400 sm:text-base">图库</h2>
          <span className="hidden text-[11px] text-zinc-500 sm:inline">卡牌与武将玩法速查</span>
          <button
            type="button"
            onClick={onClose}
            title="关闭图库"
            className="ml-auto flex h-7 w-7 items-center justify-center rounded text-zinc-400 transition hover:bg-rose-600/80 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-zinc-800 px-2 py-1.5 sm:px-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setSelected(null) }}
              className={[
                'shrink-0 rounded-lg px-2.5 py-1 text-xs transition sm:px-3 sm:text-sm',
                tab === t.id
                  ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => setSelected(it.key)}
                  className={[
                    'rounded-xl border p-2 text-left transition-all',
                    selected === it.key
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-zinc-700 bg-zinc-800/60 hover:border-zinc-500 hover:bg-zinc-800',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-sm font-bold text-amber-100">{it.title}</span>
                    <span className="shrink-0 rounded bg-zinc-900/80 px-1 py-0.5 text-[9px] text-zinc-400">
                      {it.badge}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] leading-snug text-zinc-400">{it.summary}</div>
                </button>
              ))}
            </div>
          </div>

          <div
            className={[
              'max-h-56 shrink-0 overflow-y-auto border-t border-zinc-800 p-3',
              'md:max-h-none md:w-80 md:border-l md:border-t-0',
              detail ? 'block' : 'hidden',
              'md:block',
            ].join(' ')}
          >
            {detail ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-base font-bold text-amber-300">{detail.title}</span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{detail.badge}</span>
                </div>
                <div className="mt-3 space-y-2.5">
                  {detail.rows.map((r) => (
                    <div key={r.label}>
                      <div className="text-[10px] tracking-widest text-zinc-500">{r.label}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-zinc-200">{r.text}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-xs text-zinc-500">点击左侧任意一张牌，查看完整玩法说明。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
