import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(rootDir, 'src/data');
const docsDir = resolve(rootDir, 'docs');

const areaLabels = {
  library: '星辉图书馆',
  atrium: '中庭',
  grand_hall: '大厅',
  dining_hall: '食堂',
  lawn: '草坪',
  lake: '镜湖',
  greenhouse: '水晶温室',
  training_ground: '符文训练场',
  moonstone_grotto: '月石洞窟',
};

const npcSeeds = [
  {
    id: 'lyra',
    name: 'Lyra',
    title: '星辉图书馆管理员',
    area: 'library',
    worldX: 5.35,
    worldZ: -1.35,
    rotationY: -0.57,
    color: '0x7c4dff',
    role: '古籍管理员',
    arc: '星图共鸣',
    motive: '想证明父亲留下的星图笔记不是伪书',
    clue: '失准星钟的第一组坐标藏在《黄昏星图》的空白页',
    dilemma: '她害怕公开笔记会让父亲再次被学院审判',
    keepsake: '银蓝书签',
    secret: '她能听见禁书页里残留的星声',
  },
  {
    id: 'mira_voss',
    name: 'Mira Voss',
    title: '镜像占星课代表',
    area: 'atrium',
    worldX: -3.7,
    worldZ: -2.1,
    rotationY: 0.9,
    color: '0x59b8ff',
    role: '占星学生',
    arc: '镜面预兆',
    motive: '想阻止自己预见的学院火灾',
    clue: '镜面星盘显示钟塔影子每天提前七秒落下',
    dilemma: '她的预言越准确，越会被同学当成灾厄源头',
    keepsake: '裂纹星镜',
    secret: '她曾在镜中看见玩家站在封印中心',
  },
  {
    id: 'arden_quill',
    name: 'Arden Quill',
    title: '羽笔社编辑',
    area: 'atrium',
    worldX: 1.6,
    worldZ: 3.35,
    rotationY: 3.2,
    color: '0xf2b35f',
    role: '校报编辑',
    arc: '被删去的报道',
    motive: '想刊出被教授压下的钟塔事故调查',
    clue: '事故名单里有一个从未入学却每天被点名的人',
    dilemma: '他必须在真相和保护消息源之间选择',
    keepsake: '会自己改稿的羽笔',
    secret: '他掌握着院长办公室的旧口令',
  },
  {
    id: 'selene_moon',
    name: 'Selene Moon',
    title: '月相礼仪助教',
    area: 'grand_hall',
    worldX: -6.8,
    worldZ: -12.9,
    rotationY: 0.2,
    color: '0xd8d2ff',
    role: '礼仪助教',
    arc: '缺席的月宴',
    motive: '想找回姐姐在月宴失踪前留下的祝词',
    clue: '月宴座次图把钟塔守门人安排在不存在的第十三席',
    dilemma: '她必须违背礼仪才能进入封存礼堂',
    keepsake: '月白手套',
    secret: '她姐姐并未死亡，而是被困在钟声回廊',
  },
  {
    id: 'orin_bell',
    name: 'Orin Bell',
    title: '钟塔维修学徒',
    area: 'grand_hall',
    worldX: 2.9,
    worldZ: -15.8,
    rotationY: -0.4,
    color: '0xc98f45',
    role: '机械学徒',
    arc: '第十三枚齿轮',
    motive: '想修好被老师称为禁物的星钟副轴',
    clue: '副轴缺少的齿轮不是零件，而是一段被封住的时间',
    dilemma: '他越接近真相，手上的钟纹就越深',
    keepsake: '黄铜扳手',
    secret: '他家族世代替学院隐藏钟塔故障',
  },
  {
    id: 'talia_moss',
    name: 'Talia Moss',
    title: '温室药草师',
    area: 'greenhouse',
    worldX: -21.2,
    worldZ: 3.8,
    rotationY: 1.1,
    color: '0x74d680',
    role: '药草师',
    arc: '会说谎的藤蔓',
    motive: '想救活一株只在真相附近开花的星藤',
    clue: '星藤根须指向钟塔地基下的旧水道',
    dilemma: '她隐瞒了温室土壤来自禁区',
    keepsake: '玻璃浇水壶',
    secret: '她能用植物复述昨夜听到的话',
  },
  {
    id: 'ren_shio',
    name: 'Ren Shio',
    title: '东境交换生',
    area: 'training_ground',
    worldX: 14.4,
    worldZ: 27.3,
    rotationY: -2.7,
    color: '0x4f8bd8',
    role: '剑咒学生',
    arc: '断刃誓约',
    motive: '想证明剑咒并非野蛮魔法',
    clue: '他的断刃能切开钟声留下的影线',
    dilemma: '他被要求在决斗中故意输给贵族学生',
    keepsake: '半截训练刃',
    secret: '他收到过钟塔影社的邀请',
  },
  {
    id: 'elio_cinder',
    name: 'Elio Cinder',
    title: '食堂火候管理员',
    area: 'dining_hall',
    worldX: 15.9,
    worldZ: -1.6,
    rotationY: -1.6,
    color: '0xff7a4f',
    role: '火焰厨师',
    arc: '不熄的炉心',
    motive: '想让被禁的家传火焰重新得到认可',
    clue: '炉心火焰在钟声失准时会变成蓝色',
    dilemma: '他若公开线索，食堂可能被封',
    keepsake: '黑铁汤勺',
    secret: '他的炉火可以烧掉伪造记忆',
  },
  {
    id: 'nara_veil',
    name: 'Nara Veil',
    title: '帷幕戏法社社长',
    area: 'grand_hall',
    worldX: 7.4,
    worldZ: -10.5,
    rotationY: -0.8,
    color: '0xd85fb5',
    role: '幻术演员',
    arc: '舞台后的真影',
    motive: '想找回被观众遗忘的一整场演出',
    clue: '失踪演出的幕布背面画着钟塔地下入口',
    dilemma: '她的幻术越完美，真实记忆越容易消失',
    keepsake: '紫绒面具',
    secret: '她能让玩家看见被删除的现场',
  },
  {
    id: 'cassia_rune',
    name: 'Cassia Rune',
    title: '符文学优等生',
    area: 'training_ground',
    worldX: 21.2,
    worldZ: 30.8,
    rotationY: 2.7,
    color: '0x9e7dff',
    role: '符文研究者',
    arc: '反写符文',
    motive: '想破解只在失败作业上出现的反写符号',
    clue: '反写符号组合后正是封印星钟的钥文',
    dilemma: '她必须承认自己最优秀的论文来自禁书启发',
    keepsake: '紫晶刻刀',
    secret: '她能读懂钟塔影社的暗号',
  },
  {
    id: 'finn_rook',
    name: 'Finn Rook',
    title: '屋顶送信员',
    area: 'lawn',
    worldX: -1.2,
    worldZ: 14.8,
    rotationY: 2.4,
    color: '0x6a8f3a',
    role: '送信员',
    arc: '没送达的信',
    motive: '想把一封迟到十年的信送到收件人手里',
    clue: '信封邮戳来自明天的钟塔',
    dilemma: '他害怕拆开信后会改变某人的命运',
    keepsake: '旧邮包',
    secret: '他能听见信件想去的方向',
  },
  {
    id: 'yuna_spark',
    name: 'Yuna Spark',
    title: '闪电实验室新生',
    area: 'training_ground',
    worldX: 10.8,
    worldZ: 35.7,
    rotationY: -2.4,
    color: '0xffdf4f',
    role: '雷咒新生',
    arc: '失控电弧',
    motive: '想证明自己的失控不是天赋缺陷',
    clue: '电弧会自动避开钟塔影社成员的影子',
    dilemma: '她越想控制雷光，越容易伤到朋友',
    keepsake: '绝缘发带',
    secret: '她的雷光能照出被伪装的人',
  },
  {
    id: 'maes_dew',
    name: 'Maes Dew',
    title: '镜湖水文学徒',
    area: 'lake',
    worldX: -13.6,
    worldZ: 23.4,
    rotationY: 0.7,
    color: '0x58c7d8',
    role: '水文学徒',
    arc: '湖底回声',
    motive: '想解释镜湖夜里倒流的水纹',
    clue: '湖底回声重复着被封印前最后三次钟声',
    dilemma: '他不敢告诉老师自己潜入过湖底',
    keepsake: '水纹罗盘',
    secret: '他在湖底见过玩家的倒影先行一步',
  },
  {
    id: 'corin_ash',
    name: 'Corin Ash',
    title: '灰烬炼金生',
    area: 'dining_hall',
    worldX: 21.4,
    worldZ: 3.2,
    rotationY: -2.1,
    color: '0x8e8e92',
    role: '炼金学生',
    arc: '不会冷却的灰',
    motive: '想复原爆炸事故前的炼金配方',
    clue: '灰烬里混有钟塔墙砖的银砂',
    dilemma: '他的实验曾让朋友受伤',
    keepsake: '密封灰瓶',
    secret: '他知道谁偷走了事故样本',
  },
  {
    id: 'ilya_glass',
    name: 'Ilya Glass',
    title: '玻璃乐器修复师',
    area: 'atrium',
    worldX: 6.1,
    worldZ: 4.6,
    rotationY: -2.9,
    color: '0x8bdcff',
    role: '乐器修复师',
    arc: '裂音协奏',
    motive: '想修好会唱出失踪者名字的玻璃琴',
    clue: '玻璃琴缺失的音阶对应七枚校徽',
    dilemma: '她每修好一个音，都会忘记一段童年',
    keepsake: '透明调音槌',
    secret: '她的耳朵能分辨真实和伪造的钟声',
  },
  {
    id: 'theo_wake',
    name: 'Theo Wake',
    title: '梦境治疗志愿者',
    area: 'moonstone_grotto',
    worldX: -33.5,
    worldZ: 19.6,
    rotationY: 1.4,
    color: '0x5d73d8',
    role: '梦疗志愿者',
    arc: '醒不来的梦',
    motive: '想唤醒被同一个钟声困住的三名学生',
    clue: '梦境里的钟塔没有门，只有玩家的名字',
    dilemma: '他每进入一次梦，现实中的一天就会变模糊',
    keepsake: '月棉枕符',
    secret: '他已经在同一天醒来过六次',
  },
  {
    id: 'sera_lumen',
    name: 'Sera Lumen',
    title: '光棱巡夜员',
    area: 'lawn',
    worldX: 8.8,
    worldZ: 18.2,
    rotationY: -2.6,
    color: '0xfff0a6',
    role: '巡夜员',
    arc: '灯下缺口',
    motive: '想找出巡夜灯为何照不亮钟塔背面',
    clue: '光棱记录到一个没有脚步声的人影',
    dilemma: '她必须承认自己的巡夜记录被人改过',
    keepsake: '光棱灯',
    secret: '她能用灯光逼出影社暗门',
  },
  {
    id: 'bram_iron',
    name: 'Bram Iron',
    title: '护符锻造师',
    area: 'training_ground',
    worldX: 24.5,
    worldZ: 25.8,
    rotationY: 2.9,
    color: '0xb56f3d',
    role: '锻造师',
    arc: '碎盾契约',
    motive: '想修复被院规禁止使用的守护盾',
    clue: '碎盾的裂痕和钟塔封印裂缝完全一致',
    dilemma: '他担心守护别人只是逃避自己的恐惧',
    keepsake: '裂纹护腕',
    secret: '他的盾能挡住一次时间回卷',
  },
  {
    id: 'evelyn_crow',
    name: 'Evelyn Crow',
    title: '乌羽纪律委员',
    area: 'grand_hall',
    worldX: -1.4,
    worldZ: -20.1,
    rotationY: 0,
    color: '0x2f3446',
    role: '纪律委员',
    arc: '黑名单空格',
    motive: '想查清为什么自己的巡查名单会多出空白项',
    clue: '空白项每天都在钟塔门口签到',
    dilemma: '她必须违反纪律才能保护真正的证人',
    keepsake: '乌羽徽章',
    secret: '她早就怀疑院长在伪造校规',
  },
  {
    id: 'kael_thorn',
    name: 'Kael Thorn',
    title: '禁林边界看守',
    area: 'lawn',
    worldX: -12.3,
    worldZ: 10.2,
    rotationY: 1.8,
    color: '0x3d8f5f',
    role: '边界看守',
    arc: '刺篱密语',
    motive: '想让禁林承认自己不是入侵者',
    clue: '刺篱只在钟塔影子经过时主动让路',
    dilemma: '他与禁林订过不能说谎的契约',
    keepsake: '荆棘戒指',
    secret: '他知道通向钟塔下层的活门在哪里',
  },
  {
    id: 'noel_pike',
    name: 'Noel Pike',
    title: '湖畔决斗裁判',
    area: 'lake',
    worldX: -22.4,
    worldZ: 14.7,
    rotationY: 0.5,
    color: '0x4c78d8',
    role: '决斗裁判',
    arc: '未宣判的胜负',
    motive: '想查清一场被所有人判定平局的决斗',
    clue: '决斗双方其实相隔了整整一分钟',
    dilemma: '他若推翻判决，会毁掉自己的公正名声',
    keepsake: '裁判银哨',
    secret: '他能用哨声暂停一秒钟的魔法判定',
  },
  {
    id: 'iris_vale',
    name: 'Iris Vale',
    title: '花径记忆师',
    area: 'greenhouse',
    worldX: -13.8,
    worldZ: 6.4,
    rotationY: -2.5,
    color: '0xff8fc7',
    role: '记忆园丁',
    arc: '花粉里的旧日',
    motive: '想让记忆花开出被删除的入学典礼',
    clue: '花粉重现的典礼里没有院长讲话',
    dilemma: '她担心恢复记忆会让朋友重新痛苦',
    keepsake: '粉晶剪刀',
    secret: '她能把短暂记忆种进花里',
  },
  {
    id: 'rowan_mint',
    name: 'Rowan Mint',
    title: '薄荷糖魔药摊主',
    area: 'dining_hall',
    worldX: 12.5,
    worldZ: 5.4,
    rotationY: -1.1,
    color: '0x7de0b2',
    role: '魔药摊主',
    arc: '甜味证词',
    motive: '想证明自己的糖药不是导致幻觉的原因',
    clue: '糖药只会让被篡改的记忆出现苦味',
    dilemma: '他一直在替真正的配方主人背锅',
    keepsake: '薄荷糖罐',
    secret: '他能调出让人说真话的余味',
  },
  {
    id: 'lina_clock',
    name: 'Lina Clock',
    title: '时间表管理员',
    area: 'atrium',
    worldX: -7.3,
    worldZ: 4.2,
    rotationY: 1.3,
    color: '0xb8a36a',
    role: '课程管理员',
    arc: '错位课表',
    motive: '想修正一张每天自动改写的课程表',
    clue: '改写后的课程都指向钟塔顶层的空教室',
    dilemma: '她害怕承认自己也被课表安排过不存在的课程',
    keepsake: '黄铜怀表',
    secret: '她能察觉时间表里少掉的人',
  },
  {
    id: 'silas_ink',
    name: 'Silas Ink',
    title: '墨灵契约生',
    area: 'library',
    worldX: 7.35,
    worldZ: -4.2,
    rotationY: -1.9,
    color: '0x3f3b70',
    role: '契约学生',
    arc: '逃走的墨灵',
    motive: '想追回偷走自己名字的墨灵',
    clue: '墨灵写出的假名正是钟塔影社的成员表',
    dilemma: '他若夺回名字，墨灵会重新变成普通墨水',
    keepsake: '空白名签',
    secret: '他的真名可以打开一本封印账册',
  },
  {
    id: 'aria_frost',
    name: 'Aria Frost',
    title: '冰音合唱首席',
    area: 'grand_hall',
    worldX: 10.1,
    worldZ: -18.6,
    rotationY: -0.4,
    color: '0x9fdcff',
    role: '合唱首席',
    arc: '冻结的高音',
    motive: '想唱完整首被禁止的钟塔安魂曲',
    clue: '安魂曲最后一节会冻住虚假的时间',
    dilemma: '她的声音一旦失控会伤害听众',
    keepsake: '冰蓝发针',
    secret: '她记得上一轮时间里玩家的请求',
  },
  {
    id: 'jun_pearl',
    name: 'Jun Pearl',
    title: '珍珠算术导师',
    area: 'lake',
    worldX: -7.9,
    worldZ: 18.9,
    rotationY: -2.2,
    color: '0xf0e0c0',
    role: '算术导师',
    arc: '算不平的债',
    motive: '想算清学院欠学生们的真实时间',
    clue: '每次钟塔失准都会从全校借走三百七十二秒',
    dilemma: '他必须用冷冰冰的数字解释朋友的痛苦',
    keepsake: '珍珠算盘',
    secret: '他算出玩家是唯一没有被借走时间的人',
  },
  {
    id: 'celine_wisp',
    name: 'Celine Wisp',
    title: '幽光路标维护员',
    area: 'moonstone_grotto',
    worldX: -39.2,
    worldZ: 25.7,
    rotationY: 1.0,
    color: '0xa6ffef',
    role: '路标维护员',
    arc: '迷路的光点',
    motive: '想让洞窟里失踪的路标重新回家',
    clue: '幽光只愿意照亮通向钟塔地下的反方向路',
    dilemma: '她自己其实也迷失过一整年',
    keepsake: '幽光灯笼',
    secret: '她认识被学院除名的第一任守钟人',
  },
  {
    id: 'matteo_gate',
    name: 'Matteo Gate',
    title: '旧门钥匙保管员',
    area: 'atrium',
    worldX: 3.9,
    worldZ: -5.1,
    rotationY: 2.8,
    color: '0x8a6a42',
    role: '钥匙保管员',
    arc: '不会开门的钥匙',
    motive: '想找出一把拒绝所有锁的旧钥匙用途',
    clue: '旧钥匙只在钟声倒放时露出齿纹',
    dilemma: '他必须承认自己弄丢过真正的钟塔钥匙',
    keepsake: '无齿旧钥匙',
    secret: '他知道哪扇门曾被从地图上擦掉',
  },
  {
    id: 'owen_grove',
    name: 'Owen Grove',
    title: '草坪星兽饲育员',
    area: 'lawn',
    worldX: 13.6,
    worldZ: 11.7,
    rotationY: -2.9,
    color: '0x8bcf5a',
    role: '星兽饲育员',
    arc: '不肯归巢的星兽',
    motive: '想弄懂星兽为何集体避开钟塔方向',
    clue: '星兽在钟声失准前会排列成七芒星',
    dilemma: '他必须冒险放开最胆小的星兽引路',
    keepsake: '星兽铃铛',
    secret: '星兽能闻到被偷走的时间',
  },
  {
    id: 'vera_night',
    name: 'Vera Night',
    title: '夜课档案员',
    area: 'library',
    worldX: 4.0,
    worldZ: -4.9,
    rotationY: 0.3,
    color: '0x6d5bd8',
    role: '档案员',
    arc: '午夜借阅簿',
    motive: '想查明谁每晚借走同一本不存在的书',
    clue: '借阅簿的墨迹来自未来三天后的午夜',
    dilemma: '她担心自己才是那位不存在的借阅者',
    keepsake: '午夜印章',
    secret: '她能把玩家送进一次短暂的夜课回忆',
  },
];

const chineseProfiles = {
  lyra: { name: '莉娅', gender: '女', personality: '安静聪慧、谨慎内敛，重视证据，也害怕父亲的旧案再次伤人。' },
  mira_voss: { name: '米拉', gender: '女', personality: '敏感警觉、同理心强，即使被误解成灾厄源头，也坚持提前预警。' },
  arden_quill: { name: '阿登', gender: '男', personality: '好奇犀利、正义感强，写报道时敢追真相，但会优先保护消息源。' },
  selene_moon: { name: '塞琳娜', gender: '女', personality: '优雅克制、责任感强，平时遵守礼仪，必要时会为亲人打破规矩。' },
  orin_bell: { name: '奥林', gender: '男', personality: '固执专注、手艺人气质浓，嘴上冷静，心里背着家族秘密。' },
  talia_moss: { name: '塔莉娅', gender: '女', personality: '温柔耐心、对植物极敏锐，隐瞒过错但愿意承担补救。' },
  ren_shio: { name: '莲汐', gender: '男', personality: '自律冷静、重视荣誉，不愿被学院偏见定义为野蛮剑士。' },
  elio_cinder: { name: '艾里奥', gender: '男', personality: '热情直率、护短，愿意为朋友和家传火焰承担风险。' },
  nara_veil: { name: '娜拉', gender: '女', personality: '戏剧化、机敏且善于观察，害怕自己的幻术吞掉真实记忆。' },
  cassia_rune: { name: '卡西娅', gender: '女', personality: '高傲理性、完美主义，愿意承认天才背后也有禁忌启发。' },
  finn_rook: { name: '芬恩', gender: '男', personality: '轻快善良、守信，常用玩笑掩饰对命运改写的焦虑。' },
  yuna_spark: { name: '优奈', gender: '女', personality: '活泼冲动、怕伤到别人，强烈渴望真正掌控自己的雷光。' },
  maes_dew: { name: '梅斯', gender: '男', personality: '沉静诚实、学者气，面对湖底秘密时执着到近乎固执。' },
  corin_ash: { name: '科林', gender: '男', personality: '内疚谨慎、实验欲强，愿意用真相弥补过去实验造成的伤害。' },
  ilya_glass: { name: '伊莉娅', gender: '女', personality: '细腻敏感、审美强，为修复真实声音甘愿承受遗忘代价。' },
  theo_wake: { name: '西奥', gender: '男', personality: '温和疲惫、共情强，哪怕现实变模糊也会进入梦里救人。' },
  sera_lumen: { name: '赛拉', gender: '女', personality: '明亮可靠、责任感强，发现巡夜记录被改后敢主动承认漏洞。' },
  bram_iron: { name: '布拉姆', gender: '男', personality: '可靠沉稳、防御型人格，擅长保护别人却害怕面对自己的恐惧。' },
  evelyn_crow: { name: '伊芙琳', gender: '女', personality: '严厉公正、纪律感强，外表守规，内心早已怀疑学院秩序。' },
  kael_thorn: { name: '凯尔', gender: '男', personality: '寡言诚实、自然亲和，受不能说谎的禁林契约约束。' },
  noel_pike: { name: '诺艾尔', gender: '男', personality: '公正克制、重名誉，但愿意为事实推翻自己过去的判决。' },
  iris_vale: { name: '艾瑞丝', gender: '女', personality: '温柔怀旧、害怕伤害朋友，擅长照料花朵和被封存的记忆。' },
  rowan_mint: { name: '若文', gender: '男', personality: '机灵圆滑、擅长安抚人心，愿意替配方真相重新翻案。' },
  lina_clock: { name: '莉娜', gender: '女', personality: '严谨焦虑、时间观念强，对不存在课程的记录异常敏感。' },
  silas_ink: { name: '希拉斯', gender: '男', personality: '阴郁机智、依赖墨灵，嘴硬但极珍惜自己的真名。' },
  aria_frost: { name: '艾莉娅', gender: '女', personality: '冷静优雅、情感压抑，记得时间回卷里别人忘掉的请求。' },
  jun_pearl: { name: '君珀', gender: '男', personality: '冷静精算、嘴硬心软，习惯用数字解释并保护他人的痛苦。' },
  celine_wisp: { name: '塞琳', gender: '女', personality: '迷糊温柔、方向感异常，能和旧路标、旧守钟人建立联系。' },
  matteo_gate: { name: '马特奥', gender: '男', personality: '慢热守规、执着钥匙，始终对自己弄丢真钥匙怀有愧疚。' },
  owen_grove: { name: '欧文', gender: '男', personality: '开朗耐心、爱护星兽，愿意冒险放手让最胆小的星兽带路。' },
  vera_night: { name: '薇拉', gender: '女', personality: '安静敏锐、夜间行动派，怀疑自己也可能是不该存在的借阅者。' },
};

for (const seed of npcSeeds) {
  const profile = chineseProfiles[seed.id];
  if (!profile) throw new Error(`Missing Chinese profile for ${seed.id}`);
  Object.assign(seed, profile);
}

function makeChoice(id, text, affectionChange, response) {
  return { id, text, affectionChange, response };
}

function chapterEventId(npc, chapterNumber) {
  return `${npc.id}_chapter_${String(chapterNumber).padStart(3, '0')}_complete`;
}

function makeIntroPages(npc, areaLabel) {
  if (npc.id === 'lyra') {
    return [
      { speaker: npc.name, text: '...嗯？你是新来的学生吧。这片图书馆的区域不常有人来。' },
      { speaker: npc.name, text: '这本《黄昏星图》昨晚自己翻到空白页，页边写着你的名字。刚才钟塔多敲了一下，你也记得，对吗？' },
      {
        speaker: npc.name,
        text: '如果你愿意查下去，先别急着相信任何记录。星钟失准时，纸上的字有时比人更会说谎。',
        choices: [
          makeChoice(`${npc.id}_intro_listen`, '我也听见了那下钟声。', 1, '莉娅把银蓝书签夹进星图：那我们从这页开始，先找能互相印证的人。'),
          makeChoice(`${npc.id}_intro_careful`, '先不要惊动其他人。', 1, '莉娅点头：谨慎是对的。被改写的记录最怕旁证，不怕质问。'),
          makeChoice(`${npc.id}_intro_doubt`, '也可能只是钟塔故障。', 0, '莉娅没有反驳：那就把它当成故障查，直到故障开始说出人名。'),
        ],
      },
    ];
  }

  return [
    { speaker: npc.name, text: `${areaLabel}刚刚像被按停了一瞬。${npc.name}注意到你没有忘记那声失准的钟响。` },
    { speaker: npc.name, text: `“我是${npc.name}，${npc.title}。我的${npc.keepsake}从钟响后就没有恢复正常，这通常不是巧合。”` },
    {
      speaker: npc.name,
      text: `${npc.name}暂时没有交出全部证词，只先指向“${npc.arc}”。这条线索可能和莉娅的星图有关。`,
      choices: [
        makeChoice(`${npc.id}_intro_follow`, '我会继续查这条线。', 1, `${npc.name}放松了一点：那先记住我的位置。等你需要旁证时，再来找我。`),
        makeChoice(`${npc.id}_intro_risk`, '先告诉我风险。', 1, `${npc.name}低声说：风险不是知道真相，是明天醒来后忘了自己知道过。`),
        makeChoice(`${npc.id}_intro_later`, '我需要先找其他证据。', 0, `${npc.name}点头：可以。星钟已经等了很久，不差这一小会儿。`),
      ],
    },
  ];
}

function makeCluePages(npc, areaLabel) {
  return [
    { speaker: npc.name, text: `${npc.name}确认周围没有旁听者后，把你带到${areaLabel}里最不稳定的位置。` },
    { speaker: npc.name, text: `真正的线索是：${npc.clue}。这不是传闻，是${npc.name}亲眼或亲手记录下来的异常。` },
    {
      speaker: npc.name,
      text: `${npc.name}建议你把这条线索和其他 NPC 的证词拼在一起；单独看它像怪事，连起来才像路径。`,
      choices: [
        makeChoice(`${npc.id}_clue_record`, '把线索记录进星图。', 1, `${npc.name}看着星图边缘发亮：很好，它开始承认这条证词了。`),
        makeChoice(`${npc.id}_clue_connect`, '它应该和谁的证词相连？', 1, `${npc.name}想了想：先找能证明时间错位的人，镜湖、课表或巡夜记录都值得查。`),
        makeChoice(`${npc.id}_clue_hide`, '暂时别公开。', 0, `${npc.name}收起${npc.keepsake}：我同意。现在公开，只会让记录有时间重写自己。`),
      ],
    },
  ];
}

function makeDilemmaPages(npc) {
  return [
    { speaker: npc.name, text: `${npc.name}承认自己不是单纯帮忙：${npc.motive}。这份私心让证词更沉，也更真实。` },
    { speaker: npc.name, text: `真正卡住${npc.name}的是这件事：${npc.dilemma}。如果继续推进，代价不会只落在玩家身上。` },
    {
      speaker: npc.name,
      text: `${npc.name}把${npc.keepsake}握得很紧，等你决定这条证词要不要继续向前。`,
      choices: [
        makeChoice(`${npc.id}_dilemma_support`, '我不会逼你独自承担。', 2, `${npc.name}终于抬头：那我继续说。真相至少应该由愿意承担的人保管。`),
        makeChoice(`${npc.id}_dilemma_truth`, '真相需要有人站出来。', 1, `${npc.name}沉默片刻：你说得对，但站出来之前，我们要先保证证据不会被抹掉。`),
        makeChoice(`${npc.id}_dilemma_pause`, '先暂停，别冒险。', -1, `${npc.name}把情绪压回去：我明白。只是星钟不会因为我们害怕就停下。`),
      ],
    },
  ];
}

function makeCommitmentPages(npc) {
  return [
    { speaker: npc.name, text: `${npc.name}把目前能确认的事整理成一句话：星钟不是坏了，是有人不准它说出真正的午夜。` },
    { speaker: npc.name, text: `${npc.keepsake}成为这段证词的凭证。等你集齐更多线索，${npc.name}会用“${npc.arc}”这部分帮助你进入钟塔调查。` },
    {
      speaker: npc.name,
      text: `${npc.name}不再要求你立刻给出答案，只确认一件事：下一次钟声失准时，你们不能各自沉默。`,
      choices: [
        makeChoice(`${npc.id}_commit_ready`, '到钟塔入口见。', 2, `${npc.name}认真点头：我会站在约定的位置，不会迟到。`),
        makeChoice(`${npc.id}_commit_guard`, '你先守住这里的证据。', 1, `${npc.name}收好${npc.keepsake}：交给我。只要证据还在，星钟就不能把今天彻底吞掉。`),
        makeChoice(`${npc.id}_commit_fail`, '如果我失败了呢？', 1, `${npc.name}轻声回答：那至少还有人记得你试过。记得，本身就是反抗。`),
      ],
    },
  ];
}

const storyChapters = [
  { key: 'chapter_001', trigger: 'proximity', buildPages: makeIntroPages },
  { key: 'chapter_002', trigger: 'event', buildPages: makeCluePages },
  { key: 'chapter_003', trigger: 'event', buildPages: makeDilemmaPages },
  { key: 'chapter_004', trigger: 'event', buildPages: makeCommitmentPages },
];

function makeDialogueTrees(npc) {
  return storyChapters.map((chapter, index) => {
    const chapterNumber = index + 1;
    const areaLabel = areaLabels[npc.area] ?? npc.area;
    const tree = {
      id: `${npc.id}_${chapter.key}`,
      trigger: chapter.trigger,
      minAffection: -999,
      maxAffection: 100,
      completesEvent: chapterEventId(npc, chapterNumber),
      pages: chapter.buildPages(npc, areaLabel),
    };

    if (index > 0) {
      tree.requiredEvent = chapterEventId(npc, chapterNumber - 1);
    }

    return tree;
  });
}

function makeRepeatTrees(npc) {
  return [
    {
      id: `${npc.id}_repeat_cold`,
      trigger: 'repeat',
      minAffection: -999,
      maxAffection: -1,
      pages: [
        {
          speaker: npc.name,
          text: `${npc.name}仍愿意和你交谈，但关于${npc.arc}的信任需要重新建立。`,
          choices: [
            {
              id: `${npc.id}_apologize`,
              text: '我会认真对待你的证词。',
              affectionChange: 1,
              response: `${npc.name}点头：那就从不轻视任何一个细节开始。`,
            },
            {
              id: `${npc.id}_dismiss`,
              text: '只是路过。',
              affectionChange: 0,
              response: `${npc.name}收起${npc.keepsake}，没有再追问。`,
            },
          ],
        },
      ],
    },
    {
      id: `${npc.id}_repeat_warm`,
      trigger: 'repeat',
      minAffection: 0,
      maxAffection: 4,
      pages: [
        {
          speaker: npc.name,
          text: `${npc.name}正在复核${npc.clue}。如果你准备继续推进钟塔调查，可以从其他同伴的证词里找下一块拼图。`,
          choices: [
            {
              id: `${npc.id}_review`,
              text: '帮我再梳理一次线索。',
              affectionChange: 1,
              response: `核心仍是${npc.arc}：${npc.clue}。把它和莉娅的星图放在一起看。`,
            },
            {
              id: `${npc.id}_thanks`,
              text: '谢谢，我记住了。',
              affectionChange: 0,
              response: `${npc.name}轻轻点头：别让星钟替你做决定。`,
            },
          ],
        },
      ],
    },
    {
      id: `${npc.id}_repeat_close`,
      trigger: 'repeat',
      minAffection: 5,
      pages: [
        {
          speaker: npc.name,
          text: `${npc.name}已经把${npc.keepsake}准备好。等你集齐更多证词，钟塔入口就不再只是传闻。`,
          choices: [
            {
              id: `${npc.id}_ready`,
              text: '到时候一起行动。',
              affectionChange: 1,
              response: `${npc.name}认真回应：我会站在约定的位置，不会迟到。`,
            },
            {
              id: `${npc.id}_wait`,
              text: '先保存体力。',
              affectionChange: 0,
              response: `${npc.name}笑了笑：谨慎也算勇气的一种。`,
            },
          ],
        },
      ],
    },
  ];
}

function makeNpcData(seed, index) {
  return {
    id: seed.id,
    name: seed.name,
    gender: seed.gender,
    personality: seed.personality,
    title: seed.title,
    x: Math.round((seed.worldX + 43) * 12),
    y: Math.round((seed.worldZ + 24) * 12),
    color: seed.color,
    radius: 16,
    area: seed.area,
    description: `${seed.title}。性别：${seed.gender}。性格：${seed.personality} 主线功能：${seed.clue}。个人矛盾：${seed.dilemma}`,
    worldX: seed.worldX,
    worldZ: seed.worldZ,
    rotationY: seed.rotationY,
    arc: seed.arc,
    role: seed.role,
    order: index,
  };
}

function makeNpcRosterDoc() {
  const lines = [
    '# 魔法学院 NPC 人设表',
    '',
    '本表由 `scripts/generate-story-content.mjs` 生成，姓名、性别、性格会同步进入 `src/data/npcs.json` 和对话数据。',
    '',
    '| 序号 | 中文名 | 性别 | 职位/身份 | 所在区域 | 性格 | 剧情作用 | 个人矛盾 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const [index, npc] of npcSeeds.entries()) {
    const area = areaLabels[npc.area] ?? npc.area;
    lines.push(`| ${index + 1} | ${npc.name} | ${npc.gender} | ${npc.title} | ${area} | ${npc.personality} | ${npc.clue} | ${npc.dilemma} |`);
  }

  lines.push(
    '',
    '## 主线摘要',
    '',
    '所有 NPC 的证词共同指向“失准星钟”：学院的钟塔正在提前、倒放或吞掉时间，导致记忆、名单、课程、事故记录被改写。玩家需要把莉娅的星图、镜湖回声、温室旧水道、训练场反写符文、月石洞窟幽光等线索拼成完整路径，最终进入钟塔底层确认谁在阻止星钟说出真正的午夜。',
    '',
    '## 对话结构',
    '',
    '- 每个 NPC 的主线拆成 4 轮短对话：初遇异常、线索确认、个人冲突、行动承诺。',
    '- 每轮主线对话约 3 页，最后一页提供玩家选择；不再设置固定页数指标。',
    '- 每次互动只推进当前剧情节点，避免长篇重复对白。',
    '- 每个 NPC 有冷淡、普通、亲密 3 类重复对话。',
    '- 好感度按 NPC 独立保存，不再所有人共享同一条关系进度。',
  );

  return `${lines.join('\n')}\n`;
}

const npcs = npcSeeds.map(makeNpcData);
const dialogues = Object.fromEntries(npcSeeds.map((npc) => [
  npc.id,
  [
    ...makeDialogueTrees(npc),
    ...makeRepeatTrees(npc),
  ],
]));

for (const [npcId, trees] of Object.entries(dialogues)) {
  const storyTrees = trees.filter((tree) => tree.trigger !== 'repeat');
  if (storyTrees.length !== storyChapters.length) {
    throw new Error(`${npcId} has ${storyTrees.length} story chapters`);
  }
  for (const tree of storyTrees) {
    if (tree.pages.length < 2 || tree.pages.length > 4) {
      throw new Error(`${tree.id} should stay short, got ${tree.pages.length} pages`);
    }
  }
}

mkdirSync(dataDir, { recursive: true });
mkdirSync(docsDir, { recursive: true });
writeFileSync(resolve(dataDir, 'npcs.json'), `${JSON.stringify(npcs, null, 2)}\n`);
writeFileSync(resolve(dataDir, 'dialogues.json'), `${JSON.stringify(dialogues, null, 2)}\n`);
writeFileSync(resolve(docsDir, 'npc-character-roster.md'), makeNpcRosterDoc());

console.log(`[story-content] wrote ${npcs.length} NPCs`);
console.log(`[story-content] wrote ${Object.keys(dialogues).length} dialogue sets`);
console.log(`[story-content] each NPC has ${storyChapters.length} short story dialogues`);
console.log('[story-content] wrote docs/npc-character-roster.md');
