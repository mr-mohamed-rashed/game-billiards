import { DEFAULT_TABLE_GEOMETRY, TableGeometry, buildTableGeometryFromWalls } from "@/types/billiards";
import tablesConfig from "./tablesConfig.json";

export interface CueStats {
  force: number;  // 1 to 10
  aim: number;    // 1 to 10
  spin: number;   // 1 to 10
  time: number;   // seconds
}

export interface CueItem {
  id: string;
  nameAr: string;
  nameEn: string;
  category: 'classic' | 'legendary';
  image: string;
  price: number;
  currency: 'coins' | 'gems';
  stats: CueStats;
  glowColor: string;
  tipColor: string;
  descriptionAr: string;
  specialPerkAr: string;
}

export type TableTier = 'starter' | 'intermediate' | 'pro';

export interface TableItem {
  id: string;
  tier: TableTier;
  tierLabelAr: string;
  nameAr: string;
  nameEn: string;
  image?: string;
  sideImage?: string;
  price: number;
  currency: 'coins' | 'gems';
  cushionGlow: string;
  feltColor: string;
  cushionRestitution: number;
  clothFriction: number;
  rollingResistance: number;
  spinGrip: number;
  // Legacy compatibility fields mapped from JSON physics properties
  friction: number;
  bounceRestitution: number;
  descriptionAr: string;
  ambientEffect: 'none' | 'forest' | 'frost' | 'cyber' | 'industrial' | 'royal' | 'lightning' | 'magma' | 'cosmic';
  geometry: TableGeometry;
}

// 20 CUES FROM USER ASSETS
export const ALL_CUES: CueItem[] = [
  // CLASSIC & PRO CUES (10 items)
  {
    id: 'cue_maple_standard',
    nameAr: 'عصا المابل الكلاسيكية',
    nameEn: 'Standard Maple',
    category: 'classic',
    image: '/cues/cue_maple_standard.png',
    price: 0,
    currency: 'coins',
    stats: { force: 4, aim: 4, spin: 3, time: 30 },
    glowColor: '#d97706',
    tipColor: '#ffffff',
    descriptionAr: 'عصا خشب المابل الطبيعي المعتمدة للمبتدئين في صالات البلياردو العالمية.',
    specialPerkAr: 'عصا مجانية أساسية متوازنة'
  },
  {
    id: 'cue_rosewood_master',
    nameAr: 'عصا خشب الورد المطعمة',
    nameEn: 'Rosewood Master',
    category: 'classic',
    image: '/cues/cue_rosewood_master.png',
    price: 1500,
    currency: 'coins',
    stats: { force: 5.5, aim: 5, spin: 4.5, time: 32 },
    glowColor: '#b45309',
    tipColor: '#fef08a',
    descriptionAr: 'مصنوعة من خشب الورد الفاخر مع تطعيمات دقيقة تمنح تحكماً أعلى في ضربات التمركز.',
    specialPerkAr: '+10% دقة في الخطوط المستقيمة'
  },
  {
    id: 'cue_royal_inlay',
    nameAr: 'عصا الذهب والأبنوس الملكي',
    nameEn: 'Royal Gold Inlay',
    category: 'classic',
    image: '/cues/cue_royal_inlay.png',
    price: 3500,
    currency: 'coins',
    stats: { force: 6.5, aim: 6, spin: 5.5, time: 34 },
    glowColor: '#fbbf24',
    tipColor: '#fde047',
    descriptionAr: 'تطعيم ذهبي إمبراطوري مع أبنوس أفريقي يمنحك ثباتاً مذهلاً ولمسة فنية راقية.',
    specialPerkAr: 'ثبات فائق على الكرات البعيدة'
  },
  {
    id: 'cue_crimson_velvet',
    nameAr: 'عصا المخمل القرمزي',
    nameEn: 'Crimson Velvet',
    category: 'classic',
    image: '/cues/cue_crimson_velvet.png',
    price: 6000,
    currency: 'coins',
    stats: { force: 7, aim: 6.5, spin: 6.5, time: 35 },
    glowColor: '#e11d48',
    tipColor: '#fda4af',
    descriptionAr: 'تصميم قرمزي ملكي جذاب مع ملمس ناعم يمنح ضربات الاسكروه انسيابية فائقة.',
    specialPerkAr: '+15% قوة دوران خلفي (Screw)'
  },
  {
    id: 'cue_sapphire_diamond',
    nameAr: 'عصا ماسة الياقوت الأزرق',
    nameEn: 'Sapphire Diamond',
    category: 'classic',
    image: '/cues/cue_sapphire_diamond.png',
    price: 9000,
    currency: 'coins',
    stats: { force: 7.5, aim: 7, spin: 7, time: 36 },
    glowColor: '#2563eb',
    tipColor: '#93c5fd',
    descriptionAr: 'مزينة بنقوش ماسية زرقاء تمنح اللاعب رؤية حادة لمسارات الزوايا الضيقة.',
    specialPerkAr: 'خط توجيه حاد للزوايا المنفرجة'
  },
  {
    id: 'cue_midnight_stealth',
    nameAr: 'عصا أبنوس الشبح الأسود',
    nameEn: 'Midnight Stealth',
    category: 'classic',
    image: '/cues/cue_midnight_stealth.png',
    price: 13000,
    currency: 'coins',
    stats: { force: 8, aim: 7.5, spin: 7.5, time: 37 },
    glowColor: '#475569',
    tipColor: '#e2e8f0',
    descriptionAr: 'هيكل ممتص للاهتزاز بلون فحمي مطفي يمنح دقة خرافية في تشتيت مثلث الكرات.',
    specialPerkAr: 'امتصاص كامل للاهتزاز عند الضربات القوية'
  },
  {
    id: 'cue_carbon_red',
    nameAr: 'عصا ألياف الكربون الحمراء',
    nameEn: 'Carbon Fiber Red',
    category: 'classic',
    image: '/cues/cue_carbon_red.png',
    price: 18000,
    currency: 'coins',
    stats: { force: 8.5, aim: 8, spin: 8, time: 38 },
    glowColor: '#ef4444',
    tipColor: '#fca5a5',
    descriptionAr: 'ألياف كربونية رياضية فائقة الخفة والمتانة المستخدمة في بطولات البلياردو العالمية.',
    specialPerkAr: 'انطلاق صاروخي فوري للكرة البيضاء'
  },
  {
    id: 'cue_titan_silver',
    nameAr: 'عصا التيتانيوم الفضية',
    nameEn: 'Titanium Silver Pro',
    category: 'classic',
    image: '/cues/cue_titan_silver.png',
    price: 24000,
    currency: 'coins',
    stats: { force: 8.5, aim: 8.5, spin: 8, time: 38 },
    glowColor: '#94a3b8',
    tipColor: '#f8fafc',
    descriptionAr: 'معدن التيتانيوم المقسى المقاوم للانحناء يمنح صلابة استثنائية ونقل كامل للطاقة.',
    specialPerkAr: 'نقل طاقة نقي 100% بدون فقد فيزيائي'
  },
  {
    id: 'cue_apex_gold',
    nameAr: 'عصا قمة الذهب الأزرق',
    nameEn: 'Apex Gold Rush',
    category: 'classic',
    image: '/cues/cue_apex_gold.png',
    price: 30000,
    currency: 'coins',
    stats: { force: 9, aim: 8.5, spin: 8.5, time: 40 },
    glowColor: '#38bdf8',
    tipColor: '#fde047',
    descriptionAr: 'تحفة هندسية تجمع بين النحاس الذهبي والصلب الأزرق للمحترفين الكبار.',
    specialPerkAr: 'خط توجيه ممتد مضاعف'
  },
  {
    id: 'cue_grand_walnut',
    nameAr: 'عصا الجوز الفاخر للبطولات',
    nameEn: 'Grand Walnut Grandmaster',
    category: 'classic',
    image: '/cues/cue_grand_walnut.png',
    price: 40000,
    currency: 'coins',
    stats: { force: 9, aim: 9, spin: 9, time: 40 },
    glowColor: '#92400e',
    tipColor: '#fef3c7',
    descriptionAr: 'قمة إتقان صناعة عصي البلياردو الكلاسيكية من أخشاب الجوز المعتقة نادرة الوجود.',
    specialPerkAr: 'توازن أسطوري وثبات مطلق'
  },

  // LEGENDARY & MYTHIC ELEMENTAL CUES (10 items)
  {
    id: 'cue_frost_rune',
    nameAr: 'عصا الجليد الأزلي (Glacial Rune)',
    nameEn: 'Glacial Frost Rune',
    category: 'legendary',
    image: '/cues/cue_frost_rune.png',
    price: 55000,
    currency: 'coins',
    stats: { force: 9.5, aim: 9.5, spin: 9, time: 42 },
    glowColor: '#38bdf8',
    tipColor: '#e0f2fe',
    descriptionAr: 'منحوتة من صقيع القطب الشمالي وتطلق ذرات ثلجية مشعة مع خط توجيه بلوري فائق الدقة.',
    specialPerkAr: '❄️ خط تصويب بلوري ثلجي فائق الطول'
  },
  {
    id: 'cue_dragon_flame',
    nameAr: 'عصا لهب التنين (Dragon Flame)',
    nameEn: 'Dragon Flame',
    category: 'legendary',
    image: '/cues/cue_dragon_flame.png',
    price: 65000,
    currency: 'coins',
    stats: { force: 10, aim: 9, spin: 9.5, time: 42 },
    glowColor: '#f97316',
    tipColor: '#ffedd5',
    descriptionAr: 'مطلسمة بأنفاس التنين الحارقة وتطلق شهباً نارية تدمر تكتلات الكرات وتفتح الطاولة.',
    specialPerkAr: '🔥 قوة تشتيت انفجارية غير مسبوقة'
  },
  {
    id: 'cue_royal_ruby',
    nameAr: 'عصا الذهب والياقوت الإمبراطوري',
    nameEn: 'Royal Sovereign Ruby',
    category: 'legendary',
    image: '/cues/cue_royal_ruby.png',
    price: 75000,
    currency: 'coins',
    stats: { force: 9.5, aim: 9.5, spin: 9.5, time: 44 },
    glowColor: '#e11d48',
    tipColor: '#fef08a',
    descriptionAr: 'مرصعة بـ 12 حجر ياقوت أحمر خام وذهب عيار 24 تليق بملوك لعبة البلياردو.',
    specialPerkAr: '👑 +15% مكافأة كوينز إضافية عند الفوز'
  },
  {
    id: 'cue_cosmic_nebula',
    nameAr: 'عصا سديم المجرات الكونية',
    nameEn: 'Cosmic Nebula',
    category: 'legendary',
    image: '/cues/cue_cosmic_nebula.png',
    price: 90000,
    currency: 'coins',
    stats: { force: 9.5, aim: 10, spin: 10, time: 45 },
    glowColor: '#a855f7',
    tipColor: '#f3e8ff',
    descriptionAr: 'تختزن طاقة الثقوب السوداء وسدم الفضاء، وتعرض مسارات الارتداد الكونية كاملة.',
    specialPerkAr: '🌌 مسار ارتداد ثلاثي الحواف مكتمل'
  },
  {
    id: 'cue_nature_druid',
    nameAr: 'عصا روح الطبيعة وأغصان السحر',
    nameEn: 'Ancient Druid Vine',
    category: 'legendary',
    image: '/cues/cue_nature_druid.png',
    price: 110000,
    currency: 'coins',
    stats: { force: 9.5, aim: 9.5, spin: 10, time: 45 },
    glowColor: '#22c55e',
    tipColor: '#dcfce7',
    descriptionAr: 'تلتف حولها أغصان الأشجار الأزلية وتمنح ارتدادات مرنة ناعمة وتوقفاً ساحراً للكرة.',
    specialPerkAr: '🌿 إيقاف فوري للكرة البيضاء (Dead Stop)'
  },
  {
    id: 'cue_cyberpunk_neon',
    nameAr: 'عصا سايبر بانك نيون 2077',
    nameEn: 'Cyberpunk Neon 2077',
    category: 'legendary',
    image: '/cues/cue_cyberpunk_neon.png',
    price: 130000,
    currency: 'coins',
    stats: { force: 10, aim: 10, spin: 9.5, time: 46 },
    glowColor: '#06b6d4',
    tipColor: '#ec4899',
    descriptionAr: 'دوائر إلكترونية رقمية وضوء نيون سيان وأحمر يعرض خط استهداف ليزري عالي الحساب.',
    specialPerkAr: '⚡ شعاع استهداف ليزري لا يخطئ'
  },
  {
    id: 'cue_volcanic_magma',
    nameAr: 'عصا الصهارة وحمم البركان',
    nameEn: 'Volcanic Magma Lava',
    category: 'legendary',
    image: '/cues/cue_volcanic_magma.png',
    price: 150000,
    currency: 'coins',
    stats: { force: 10, aim: 9.5, spin: 10, time: 46 },
    glowColor: '#ea580c',
    tipColor: '#ffedd5',
    descriptionAr: 'تتوهج بالصخور البركانية المتشققة وتترك أثراً حرارياً يمنح الكرة سرعة دوران خارقة.',
    specialPerkAr: '🌋 دوران اسكروه مضاعف 2x خارق للعادة'
  },
  {
    id: 'cue_angelic_seraph',
    nameAr: 'عصا أجنحة الملاك النورانية',
    nameEn: 'Angelic Seraphim',
    category: 'legendary',
    image: '/cues/cue_angelic_seraph.png',
    price: 175000,
    currency: 'coins',
    stats: { force: 10, aim: 10, spin: 10, time: 48 },
    glowColor: '#fef08a',
    tipColor: '#ffffff',
    descriptionAr: 'مكللة بأجنحة ملائكية نقية ورخام سماوي، تجعل أصعب الزوايا تسقط في الجيوب بسلاسة.',
    specialPerkAr: '🪽 توسيع مجالات التقاط الجيوب للكرات'
  },
  {
    id: 'cue_dark_damascus',
    nameAr: 'عصا الأوبسيديان والدمشقي الأسود',
    nameEn: 'Dark Obsidian Damascus',
    category: 'legendary',
    image: '/cues/cue_dark_damascus.png',
    price: 200000,
    currency: 'coins',
    stats: { force: 10, aim: 10, spin: 10, time: 48 },
    glowColor: '#c084fc',
    tipColor: '#e2e8f0',
    descriptionAr: 'فولاذ دمشقي مطوي ألف مرة مع زجاج الأوبسيديان الأسود يعطي هيبة لا تُقهر.',
    specialPerkAr: '⚔️ دقة تماسك فيزيائي مطلقة'
  },
  {
    id: 'cue_void_arcane',
    nameAr: 'عصا برق الفراغ الأرجواني (Void Arcane)',
    nameEn: 'Void Arcane Lightning',
    category: 'legendary',
    image: '/cues/cue_void_arcane.png',
    price: 250000,
    currency: 'coins',
    stats: { force: 10, aim: 10, spin: 10, time: 50 },
    glowColor: '#c026d3',
    tipColor: '#fae8ff',
    descriptionAr: 'سيدة عصي البلياردو الأسطورية في الكون، تجمع قوى جميع العناصر وتسيطر على الطاولة.',
    specialPerkAr: '🔮 أقصى إحصائيات متكاملة + 50 ثانية وقت للتصويب'
  }
];

// THE 9 UNIQUE POOL TABLES (loaded from tablesConfig.json for easy physics tuning)
export const ALL_TABLES: TableItem[] = tablesConfig.map((t) => ({
  id: t.id,
  tier: t.tier as TableTier,
  tierLabelAr: t.tierLabelAr,
  nameAr: t.nameAr,
  nameEn: t.nameEn,
  image: t.image,
  sideImage: t.sideImage,
  price: t.price,
  currency: t.currency as 'coins' | 'gems',
  cushionGlow: t.cushionGlow,
  feltColor: t.feltColor,
  cushionRestitution: t.cushionRestitution,
  clothFriction: t.clothFriction,
  rollingResistance: t.rollingResistance,
  spinGrip: t.spinGrip,
  friction: t.clothFriction,
  bounceRestitution: t.cushionRestitution,
  descriptionAr: t.descriptionAr,
  ambientEffect: t.ambientEffect as TableItem['ambientEffect'],
  geometry: t.walls ? buildTableGeometryFromWalls(t.walls) : DEFAULT_TABLE_GEOMETRY,
}));
