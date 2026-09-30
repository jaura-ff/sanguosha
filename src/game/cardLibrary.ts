// 图库数据：每张牌的玩法说明（与 engine.ts 的实际实现保持一致）
import type { CardName, CardKind, EquipSlot } from './engine'

export interface CardInfo {
  name: CardName
  kind: CardKind
  slot?: EquipSlot
  range?: number
  count: number // 牌堆中数量
  summary: string // 一句话简介
  effect: string // 完整效果
  usage: string // 使用时机与目标
  tips: string // 玩法技巧
}

export const CARD_INFO: CardInfo[] = [
  {
    name: '杀', kind: 'basic', count: 24,
    summary: '最主要的输出牌',
    effect: '对目标造成 1 点伤害。目标若不打出【闪】，则受到 1 点伤害。',
    usage: '出牌阶段，对攻击范围内的一名其他角色使用。每回合限 1 张（张飞、装备【诸葛连弩】时不限次数）。',
    tips: '默认攻击范围只有 1，装武器或【赤兔】才能打到远处。先算距离再出杀，别浪费。',
  },
  {
    name: '闪', kind: 'basic', count: 12,
    summary: '抵消【杀】的防御牌',
    effect: '抵消【杀】或【万箭齐发】的伤害。',
    usage: '不能主动使用，只在响应【杀】【万箭齐发】时打出。',
    tips: '手上常留 1 张闪比多留杀更稳。装备【八卦阵】后可用判定代替闪；赵云的【龙胆】能把闪当杀用。',
  },
  {
    name: '桃', kind: 'basic', count: 6,
    summary: '回血与救命',
    effect: '回复 1 点体力。',
    usage: '出牌阶段对自己使用（满血时不可用）；其他角色濒死时，也可对其使用将其救回。',
    tips: '满血时桃不能主动吃，留在手上救队友更有价值。主公阵亡就立刻结束，优先保主公。',
  },
  {
    name: '酒', kind: 'basic', count: 3,
    summary: '强化下一张杀',
    effect: '本回合内，你的下一张【杀】造成伤害 +1。',
    usage: '出牌阶段对自己使用。每回合限 1 次。',
    tips: '先喝酒再出杀，一击 2 血。配合【古锭刀】对空手牌目标可叠到 3 血，是强力的爆发手段。',
  },
  {
    name: '无中生有', kind: 'trick', count: 4,
    summary: '摸两张牌',
    effect: '你摸 2 张牌。',
    usage: '出牌阶段，对自己使用。',
    tips: '开局有就直接用，牌越多选择越多。黄月英用锦囊牌会触发【集智】再摸一张，等于净赚 3 张。',
  },
  {
    name: '决斗', kind: 'trick', count: 3,
    summary: '拼谁的杀多',
    effect: '与目标轮流打出【杀】，先打不出【杀】的一方受到 1 点伤害。',
    usage: '出牌阶段，对一名其他角色使用，不受距离限制。',
    tips: '手上杀多、或对方明显没闪没杀时再用。对残血敌人是稳定的补刀手段。',
  },
  {
    name: '南蛮入侵', kind: 'trick', count: 2,
    summary: '全场拼杀',
    effect: '所有其他角色需打出【杀】，未打出者受到 1 点伤害。',
    usage: '出牌阶段使用，对所有其他角色生效（不分距离）。',
    tips: '对方手牌少时收益高。注意自己队友也会被波及，反贼队友残血时要慎用。',
  },
  {
    name: '万箭齐发', kind: 'trick', count: 1,
    summary: '全场拼闪',
    effect: '所有其他角色需打出【闪】，未打出者受到 1 点伤害。',
    usage: '出牌阶段使用，对所有其他角色生效。',
    tips: '全场只有 1 张，留到能一次打崩多人时用。己方残血队友多时先别放。',
  },
  {
    name: '过河拆桥', kind: 'trick', count: 4,
    summary: '拆掉对方一张牌',
    effect: '弃置目标的一张牌（手牌、装备或判定区的牌）。',
    usage: '出牌阶段，对一名有牌的其他角色使用，不受距离限制。',
    tips: '优先拆武器和防具：拆掉武器能让对方打不到人，拆掉【八卦阵】再出杀更稳。',
  },
  {
    name: '顺手牵羊', kind: 'trick', count: 3,
    summary: '偷对方一张牌',
    effect: '获得目标的一张牌，收归你的手牌。',
    usage: '出牌阶段，对距离为 1 的其他角色使用。',
    tips: '比【过河拆桥】更强（牌归你），但要求距离 1。装【赤兔】可以牵到更远的人。',
  },
  {
    name: '桃园结义', kind: 'trick', count: 1,
    summary: '全体回血',
    effect: '所有存活角色各回复 1 点体力。',
    usage: '出牌阶段使用，对所有存活角色生效。',
    tips: '会同时给敌人回血。己方整体残血时用最划算，敌方满血时等于白送。',
  },
  {
    name: '乐不思蜀', kind: 'trick', count: 2,
    summary: '让对方跳过出牌',
    effect: '横置于目标判定区。其下个回合判定时：翻出红桃 ♥ 则失效；翻出其他花色则跳过其出牌阶段。',
    usage: '出牌阶段，对一名其他角色使用（不能对自己），不受距离限制。',
    tips: '用来压制输出高的敌人（比如张飞）。对已经空手牌的敌人意义不大，早用更好。',
  },
  {
    name: '兵粮寸断', kind: 'trick', count: 2,
    summary: '让对方跳过摸牌',
    effect: '横置于目标判定区。其下个回合判定时：翻出梅花 ♣ 则失效；翻出其他花色则跳过其摸牌阶段。',
    usage: '出牌阶段，对距离为 1 的其他角色使用（不能对自己）。',
    tips: '让对方回合摸不到牌，压制能力强。注意要求距离 1，离得远时先用【赤兔】或先近身。',
  },
  {
    name: '诸葛连弩', kind: 'equip', slot: 'weapon', range: 1, count: 1,
    summary: '武器：无限出杀',
    effect: '攻击范围 1，但出【杀】不再受每回合一次的限制。',
    usage: '出牌阶段装备到武器栏，替换原有武器。',
    tips: '配合"杀多"的手牌能一回合打出爆发伤害，是翻盘神器——但范围只有 1，注意够不够得着。',
  },
  {
    name: '青釭剑', kind: 'equip', slot: 'weapon', range: 2, count: 1,
    summary: '武器：攻击范围 2',
    effect: '攻击范围提升至 2。',
    usage: '出牌阶段装备到武器栏。',
    tips: '最实在的中距离武器，隔一个座位也能出杀。',
  },
  {
    name: '青龙偃月刀', kind: 'equip', slot: 'weapon', range: 3, count: 1,
    summary: '武器：范围 3 且可追击',
    effect: '攻击范围 3；你的【杀】被【闪】抵消后，本回合还可以再出一张【杀】。',
    usage: '出牌阶段装备到武器栏。',
    tips: '全场最远攻击范围，而且逼对方交两张闪才能安心。关羽装备它相当顺手。',
  },
  {
    name: '古锭刀', kind: 'equip', slot: 'weapon', range: 2, count: 1,
    summary: '武器：打空手牌目标更狠',
    effect: '攻击范围 2；你的【杀】对无手牌目标造成的伤害 +1。',
    usage: '出牌阶段装备到武器栏。',
    tips: '配合【过河拆桥】【顺手牵羊】先把对方手牌清空，再出杀一击 2 血，爆发极高。',
  },
  {
    name: '八卦阵', kind: 'equip', slot: 'armor', count: 2,
    summary: '防具：判定当闪',
    effect: '当你需要打出【闪】时，可以判定：翻出红色牌（♥ / ♦）视为打出【闪】，黑色则仍需自己出【闪】。',
    usage: '出牌阶段装备到防具栏。',
    tips: '相当于约一半概率免费挡杀，越早装备越值。对方想打你就得先拆掉它。',
  },
  {
    name: '仁王盾', kind: 'equip', slot: 'armor', count: 1,
    summary: '防具：免疫黑色杀',
    effect: '免疫黑色【杀】（♠ / ♣ 花色）造成的伤害。',
    usage: '出牌阶段装备到防具栏。',
    tips: '黑色杀占牌堆里杀的大头，装备后能挡掉大部分杀。但会被【青釭剑】无视，也怕红杀和锦囊。',
  },
  {
    name: '白银狮子', kind: 'equip', slot: 'armor', count: 1,
    summary: '防具：受伤最多 1 点',
    effect: '每当你受到伤害时，若伤害值大于 1，则将伤害值减至 1。',
    usage: '出牌阶段装备到防具栏。',
    tips: '专门克制【酒】杀和【古锭刀】等爆发，让你无论被打多狠都只掉 1 血。',
  },
  {
    name: '的卢', kind: 'equip', slot: 'plus', count: 1,
    summary: '+1 马：更难被够到',
    effect: '其他角色与你的距离 +1。',
    usage: '出牌阶段装备到坐骑栏。',
    tips: '防守向装备。能挡住【顺手牵羊】和短武器的杀，残血时很救命。',
  },
  {
    name: '赤兔', kind: 'equip', slot: 'minus', count: 1,
    summary: '−1 马：打得更远',
    effect: '你与其他角色的距离 −1。',
    usage: '出牌阶段装备到坐骑栏。',
    tips: '进攻向装备。配合【顺手牵羊】（需距离 1）和短武器都很好用。',
  },
]

export const KIND_LABEL: Record<CardKind, string> = {
  basic: '基本牌',
  trick: '锦囊牌',
  equip: '装备牌',
}

export const SLOT_LABEL: Record<EquipSlot, string> = {
  weapon: '武器',
  armor: '防具',
  plus: '+1 马',
  minus: '−1 马',
}
