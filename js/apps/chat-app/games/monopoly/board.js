/**
 * 大富翁 / 棋盘
 *
 * ★ 原型这个「大富翁」其实不是大富翁 —— 它是一张 20 格环形棋盘上的
 *   飞行棋 / 真心话大冒险：没有钱、没有地产、没有租金、没有破产，
 *   连「终点」那一格都是空实现（`case '终点': break;`），也就是说
 *   **这局游戏永远不会结束**。用户说的「不太完整」就是这个意思。
 *
 *   补法是把它做成真的大富翁，但**棋盘形状和渲染方式原样保留**：
 *   6×6 网格、外圈 20 格、四角、顺时针走 —— 这个形状在手机竖屏上比
 *   标准 40 格好用太多，是原型里对的那一半。
 *
 * 格子索引和 6×6 网格的对应（跟原型一致）：
 *
 *     上边  y=0        0  1  2  3  4  5
 *     右边  x=5        6  7  8  9
 *     下边  y=5 右→左  10 11 12 13 14 15
 *     左边  x=0 下→上  16 17 18 19
 *
 *   于是四个角正好是 0 / 5 / 10 / 15，跟标准大富翁的
 *   起点 / 监狱 / 免费停车 / 入狱 一一对上。
 */

export const TILE_TYPES = Object.freeze({
    GO: 'go',
    PROPERTY: 'property',
    UTILITY: 'utility',
    CHANCE: 'chance',
    FATE: 'fate',
    TAX: 'tax',
    JAIL: 'jail',
    PARKING: 'parking',
    GOTO_JAIL: 'goto_jail',
});

/** 地产分组。集齐一组租金翻倍 —— 这是大富翁的核心博弈。 */
export const GROUPS = Object.freeze({
    A: { key: 'A', name: '老城区' },
    B: { key: 'B', name: '河畔区' },
    C: { key: 'C', name: '林荫区' },
    D: { key: 'D', name: '新港区' },
});

export const BOARD = Object.freeze([
    { i: 0, type: TILE_TYPES.GO, name: '起点', desc: '经过或停留领 2000' },
    { i: 1, type: TILE_TYPES.PROPERTY, name: '幸运街', group: 'A', price: 300 },
    { i: 2, type: TILE_TYPES.CHANCE, name: '机会', desc: '抽一张机会卡' },
    { i: 3, type: TILE_TYPES.PROPERTY, name: '枫叶巷', group: 'A', price: 320 },
    { i: 4, type: TILE_TYPES.TAX, name: '所得税', amount: 400, desc: '缴 400' },
    { i: 5, type: TILE_TYPES.JAIL, name: '监狱', desc: '路过只是探监' },
    { i: 6, type: TILE_TYPES.PROPERTY, name: '海棠路', group: 'B', price: 480 },
    { i: 7, type: TILE_TYPES.FATE, name: '命运', desc: '抽一张命运卡' },
    { i: 8, type: TILE_TYPES.PROPERTY, name: '丁香街', group: 'B', price: 500 },
    { i: 9, type: TILE_TYPES.UTILITY, name: '电力公司', price: 600, desc: '租金 = 点数 ×100' },
    { i: 10, type: TILE_TYPES.PARKING, name: '免费停车', desc: '什么都不会发生' },
    { i: 11, type: TILE_TYPES.PROPERTY, name: '银杏道', group: 'C', price: 680 },
    { i: 12, type: TILE_TYPES.CHANCE, name: '机会', desc: '抽一张机会卡' },
    { i: 13, type: TILE_TYPES.PROPERTY, name: '樱花大道', group: 'C', price: 720 },
    { i: 14, type: TILE_TYPES.UTILITY, name: '自来水厂', price: 600, desc: '租金 = 点数 ×100' },
    { i: 15, type: TILE_TYPES.GOTO_JAIL, name: '入狱', desc: '直接进监狱' },
    { i: 16, type: TILE_TYPES.PROPERTY, name: '云顶广场', group: 'D', price: 900 },
    { i: 17, type: TILE_TYPES.FATE, name: '命运', desc: '抽一张命运卡' },
    { i: 18, type: TILE_TYPES.PROPERTY, name: '星辰湾', group: 'D', price: 980 },
    { i: 19, type: TILE_TYPES.TAX, name: '奢侈税', amount: 600, desc: '缴 600' },
]);

export const BOARD_SIZE = BOARD.length;
export const JAIL_INDEX = 5;

/** 6×6 网格里第 n 格在哪。渲染用。 */
export function gridPosition(i) {
    if (i <= 5) return { x: i, y: 0 };
    if (i <= 9) return { x: 5, y: i - 5 };
    if (i <= 15) return { x: 5 - (i - 10), y: 5 };
    return { x: 0, y: 5 - (i - 15) };
}

export function tileAt(i) {
    return BOARD[((i % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE];
}

/** 这一组一共几块地（判断有没有集齐）。 */
export function groupSize(groupKey) {
    return BOARD.filter((t) => t.group === groupKey).length;
}

export function tilesOfGroup(groupKey) {
    return BOARD.filter((t) => t.group === groupKey);
}

// ---------------------------------------------------------------------------
// 卡牌
// ---------------------------------------------------------------------------

/**
 * 机会 / 命运。
 *
 * `effect` 是纯数据，由引擎解释执行 —— 不写成回调，因为卡牌要能跟着
 * 对局存进 localStorage（函数序列化不了）。
 */
export const CHANCE_CARDS = Object.freeze([
    { id: 'c1', text: '路边捡到钱包，失主重谢你 500', effect: { kind: 'money', amount: 500 } },
    { id: 'c2', text: '股票大涨，收益 1200', effect: { kind: 'money', amount: 1200 } },
    { id: 'c3', text: '违章停车，罚款 300', effect: { kind: 'money', amount: -300 } },
    { id: 'c4', text: '前进到起点，领 2000', effect: { kind: 'moveTo', index: 0 } },
    { id: 'c5', text: '被请去喝茶，直接进监狱', effect: { kind: 'jail' } },
    { id: 'c6', text: '顺风车，前进 3 格', effect: { kind: 'move', steps: 3 } },
    { id: 'c7', text: '走错路，后退 2 格', effect: { kind: 'move', steps: -2 } },
    { id: 'c8', text: '所有人给你 200 当红包', effect: { kind: 'collect', amount: 200 } },
    { id: 'c9', text: '请客吃饭，给每人 200', effect: { kind: 'pay', amount: 200 } },
    { id: 'c10', text: '拿到一张免罪金牌，下次入狱可直接出来', effect: { kind: 'pardon' } },
]);

export const FATE_CARDS = Object.freeze([
    { id: 'f1', text: '房产升值，收 800', effect: { kind: 'money', amount: 800 } },
    { id: 'f2', text: '装修超支，付 700', effect: { kind: 'money', amount: -700 } },
    { id: 'f3', text: '亲戚借钱不还，损失 400', effect: { kind: 'money', amount: -400 } },
    { id: 'f4', text: '中了个小奖，得 600', effect: { kind: 'money', amount: 600 } },
    { id: 'f5', text: '直接去免费停车场', effect: { kind: 'moveTo', index: 10 } },
    { id: 'f6', text: '所有房产维修，每栋房付 200', effect: { kind: 'repair', perHouse: 200 } },
    { id: 'f7', text: '被限高，直接进监狱', effect: { kind: 'jail' } },
    { id: 'f8', text: '继承遗产 1500', effect: { kind: 'money', amount: 1500 } },
    { id: 'f9', text: '前进 5 格', effect: { kind: 'move', steps: 5 } },
    { id: 'f10', text: '身体不适，休息一回合', effect: { kind: 'skip' } },
]);

export function drawCard(type) {
    const deck = type === TILE_TYPES.CHANCE ? CHANCE_CARDS : FATE_CARDS;
    return deck[Math.floor(Math.random() * deck.length)];
}
