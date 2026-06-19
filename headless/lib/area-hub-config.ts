export type AreaHubShopLinks = {
  listLink: string;
  compareLink: string;
  priceLink: string;
  stationLink: string;
};

export type AreaHubRelationLabelRule = {
  pattern: RegExp;
  label: string;
};

export type AreaHubRelationConfig = {
  corePattern: RegExp;
  relatedPattern?: RegExp;
  nearbyPattern?: RegExp;
  dispatchLabel: string;
  stationNearPattern: RegExp;
  labelRules: AreaHubRelationLabelRule[];
  nearbyLabelRules?: AreaHubRelationLabelRule[];
  relatedLabelRules?: AreaHubRelationLabelRule[];
  fallbackRelatedLabel: string;
  primaryGroupTitle: string;
  secondaryGroupTitle: string;
};

export type AreaHubSeoConfig = {
  displayName: string;
  breadcrumbLabel: string;
  hubTitle: string;
  hubDescription: string;
  coverageLabel: string;
  shopListH2: string;
  shopListIntro: string;
  pageTitlePage2Plus: string;
  pageDescriptionPage2Plus: string;
  rankingTitle: string;
  priceTableTitle: string;
  stationIntro: string;
  faqAreaRef: string;
  faqFirstAnswer: string;
  relationCardLabel: string;
  shopLinks: AreaHubShopLinks;
  guidePath?: string;
  guideTitle?: string;
  guideCtaLabel?: string;
};

export type AreaHubTemplateConfig = {
  seo: AreaHubSeoConfig;
  relation?: AreaHubRelationConfig;
};

const NIHONBASHI_RELATION: AreaHubRelationConfig = {
  corePattern:
    /近鉄日本橋|なんば|難波|谷町九丁目|黒門市場|黒門|千日前|日本橋[1-5１-５](?:[-‐−－]?\d)?丁目|日本橋駅|日本橋(?:駅)?(?:より|から)?徒歩(?:圏)?|日本橋徒歩圏|(?<![都道府県市区町村])日本橋(?![駅])/,
  relatedPattern: /梅田|西中島|新大阪|京橋/,
  nearbyPattern: /堺筋本町|本町|心斎橋|道頓堀|天王寺/,
  dispatchLabel: "出張型（日本橋エリアへの派遣対応）",
  stationNearPattern:
    /近鉄日本橋|なんば|難波|谷町九丁目|黒門|千日前|日本橋駅(?:より|から)?徒歩|日本橋(?:駅)?(?:より|から)?徒歩(?:圏)?|日本橋徒歩圏/,
  labelRules: [
    { pattern: /近鉄日本橋/, label: "近鉄日本橋駅徒歩圏（日本橋ど真ん中）" },
    { pattern: /なんば|難波/, label: "なんば周辺（日本橋エリア徒歩圏）" },
    { pattern: /谷町九丁目/, label: "谷町九丁目駅周辺（日本橋エリア徒歩圏）" },
    { pattern: /黒門/, label: "黒門市場周辺（日本橋エリア徒歩圏）" },
    { pattern: /千日前/, label: "千日前駅周辺（日本橋エリア徒歩圏）" },
    {
      pattern:
        /日本橋駅(?:より|から)?徒歩|日本橋(?:駅)?(?:より|から)?徒歩(?:圏)?|日本橋徒歩圏/,
      label: "日本橋駅徒歩圏"
    },
    { pattern: /日本橋/, label: "日本橋ど真ん中（徒歩圏）" }
  ],
  nearbyLabelRules: [
    { pattern: /堺筋本町/, label: "近隣エリア（堺筋本町・日本橋からアクセス可）" },
    { pattern: /本町/, label: "近隣エリア（本町・日本橋からアクセス可）" }
  ],
  relatedLabelRules: [
    { pattern: /梅田/, label: "関連エリア（梅田・大阪駅方面）" },
    { pattern: /西中島|新大阪/, label: "関連エリア（西中島・新大阪方面）" },
    { pattern: /京橋/, label: "関連エリア（京橋方面）" }
  ],
  fallbackRelatedLabel: "日本橋周辺の関連店舗",
  primaryGroupTitle: "日本橋ど真ん中・徒歩圏",
  secondaryGroupTitle: "近隣・関連エリア"
};

const NANBA_RELATION: AreaHubRelationConfig = {
  corePattern: /なんば|難波|南海難波|大阪難波|JR難波/,
  relatedPattern: /梅田|西中島|新大阪|京橋/,
  nearbyPattern: /日本橋|近鉄日本橋|心斎橋|道頓堀|千日前|桜川|谷町九丁目|堺筋本町/,
  dispatchLabel: "出張型（難波エリアへの派遣対応）",
  stationNearPattern: /なんば|難波|南海難波|大阪難波|JR難波/,
  labelRules: [
    { pattern: /なんば駅|なんば/, label: "なんば駅周辺（難波エリア徒歩圏）" },
    { pattern: /南海難波|難波駅/, label: "南海難波駅周辺（難波エリア徒歩圏）" },
    { pattern: /大阪難波/, label: "大阪難波駅周辺（難波エリア徒歩圏）" },
    { pattern: /JR難波/, label: "JR難波駅周辺（難波エリア徒歩圏）" },
    { pattern: /難波/, label: "難波ど真ん中（徒歩圏）" }
  ],
  nearbyLabelRules: [
    { pattern: /日本橋|近鉄日本橋/, label: "近隣エリア（日本橋・難波からアクセス可）" },
    { pattern: /心斎橋|道頓堀/, label: "近隣エリア（心斎橋・難波からアクセス可）" },
    { pattern: /千日前|桜川/, label: "近隣エリア（千日前・桜川・難波からアクセス可）" }
  ],
  relatedLabelRules: [
    { pattern: /梅田/, label: "関連エリア（梅田・大阪駅方面）" },
    { pattern: /西中島|新大阪/, label: "関連エリア（西中島・新大阪方面）" },
    { pattern: /京橋/, label: "関連エリア（京橋方面）" }
  ],
  fallbackRelatedLabel: "難波周辺の関連店舗",
  primaryGroupTitle: "難波ど真ん中・徒歩圏",
  secondaryGroupTitle: "近隣・関連エリア"
};

const UMEDA_RELATION: AreaHubRelationConfig = {
  corePattern: /梅田|大阪駅|大阪梅田|東梅田|西梅田|北新地|茶屋町|堂山|中崎町|お初天神|曽根崎/,
  relatedPattern: /日本橋|近鉄日本橋|西中島|新大阪|京橋|天王寺/,
  nearbyPattern: /心斎橋|本町|堺筋本町|福島|淀屋橋|北浜|南森町|天満/,
  dispatchLabel: "出張型（梅田エリアへの派遣対応）",
  stationNearPattern: /梅田|大阪駅|大阪梅田|東梅田|西梅田|北新地|茶屋町|堂山|中崎町|お初天神|曽根崎/,
  labelRules: [
    { pattern: /大阪駅/, label: "大阪駅周辺（梅田エリア徒歩圏）" },
    { pattern: /大阪梅田|梅田駅|梅田/, label: "梅田駅周辺（梅田エリア中心）" },
    { pattern: /東梅田/, label: "東梅田駅周辺（梅田エリア徒歩圏）" },
    { pattern: /西梅田/, label: "西梅田駅周辺（梅田エリア徒歩圏）" },
    { pattern: /北新地/, label: "北新地駅周辺（梅田エリア徒歩圏）" },
    { pattern: /茶屋町|堂山|中崎町|お初天神|曽根崎/, label: "梅田周辺（徒歩圏）" }
  ],
  nearbyLabelRules: [
    { pattern: /福島/, label: "近隣エリア（福島・梅田からアクセス可）" },
    { pattern: /淀屋橋|北浜|南森町|天満/, label: "近隣エリア（梅田周辺から検討しやすい）" },
    { pattern: /心斎橋|本町|堺筋本町/, label: "近隣エリア（大阪市中心部の候補）" }
  ],
  relatedLabelRules: [
    { pattern: /日本橋|近鉄日本橋/, label: "関連エリア（日本橋方面）" },
    { pattern: /西中島|新大阪/, label: "関連エリア（西中島・新大阪方面）" },
    { pattern: /京橋/, label: "関連エリア（京橋方面）" }
  ],
  fallbackRelatedLabel: "梅田周辺の関連店舗",
  primaryGroupTitle: "梅田ど真ん中・徒歩圏",
  secondaryGroupTitle: "近隣・関連エリア"
};

/** 共通ハブテンプレート設定（エリア差分はここに集約） */
export const HUB_TEMPLATE_AREAS: Record<string, AreaHubTemplateConfig> = {
  nihonbashi: {
    seo: {
      displayName: "大阪日本橋",
      breadcrumbLabel: "大阪日本橋メンズエステ",
      hubTitle: "大阪日本橋メンズエステおすすめ一覧｜口コミ・料金・営業時間で比較",
      hubDescription:
        "大阪日本橋・近鉄日本橋・なんば周辺のメンズエステを店舗一覧、口コミ、料金、営業時間、アクセスで比較。深夜営業、駅近、初心者向け、料金目安、編集部コメントをもとに日本橋エリアの候補店舗を探せます。",
      coverageLabel: "日本橋・近鉄日本橋・なんば・谷町九丁目・黒門市場周辺",
      shopListH2: "日本橋メンズエステ店舗一覧",
      shopListIntro:
        "大阪日本橋・近鉄日本橋・なんば周辺のメンズエステを、口コミ・料金目安・営業時間・アクセス・編集部コメントで比較できます。日本橋ど真ん中の店舗を優先表示し、近隣エリアの関連店舗もあわせて掲載しています。",
      pageTitlePage2Plus:
        "大阪日本橋メンズエステ店舗一覧 {page}ページ目｜口コミ・料金・営業時間で比較",
      pageDescriptionPage2Plus:
        "大阪日本橋・近鉄日本橋・なんば周辺のメンズエステ店舗一覧（{page}ページ目）。料金・営業時間・口コミ・編集部コメントで比較しながら探せます。",
      rankingTitle: "大阪日本橋メンズエステおすすめランキング",
      priceTableTitle: "日本橋メンズエステ料金比較表",
      stationIntro:
        "日本橋・近鉄日本橋・なんば・谷町九丁目徒歩圏と確認できる店舗を整理しています。徒歩分数は掲載情報に基づかないため表示していません。",
      faqAreaRef: "大阪日本橋",
      faqFirstAnswer:
        "日本橋・近鉄日本橋・なんば周辺の店舗を比較する場合は、日本橋エリアの店舗一覧ページのランキングと料金比較表から条件に合う店舗を絞り込むのがおすすめです。選び方のポイントは別ページのガイドも参考にしてください。",
      relationCardLabel: "日本橋との関係",
      shopLinks: {
        listLink: "大阪日本橋メンズエステの店舗一覧へ",
        compareLink: "日本橋メンズエステ店舗一覧（口コミ・料金比較）",
        priceLink: "日本橋メンズエステ料金比較表へ",
        stationLink: "駅近の日本橋メンズエステ一覧へ"
      },
      guidePath: "/osaka-nihonbashi/",
      guideTitle: "日本橋で失敗しない選び方を詳しく読む",
      guideCtaLabel: "選び方ガイドを見る"
    },
    relation: NIHONBASHI_RELATION
  },
  nanba: {
    seo: {
      displayName: "大阪難波",
      breadcrumbLabel: "大阪難波メンズエステ",
      hubTitle: "大阪難波メンズエステおすすめ一覧｜口コミ・料金・営業時間で比較",
      hubDescription:
        "大阪難波・なんば・南海難波・大阪難波周辺のメンズエステを店舗一覧、口コミ、料金、営業時間、アクセスで比較。深夜営業、駅近、初心者向け、料金目安、編集部コメントをもとに難波エリアの候補店舗を探せます。",
      coverageLabel: "難波・なんば・南海難波・大阪難波周辺",
      shopListH2: "難波メンズエステ店舗一覧",
      shopListIntro:
        "大阪難波・なんば周辺のメンズエステを、口コミ・料金目安・営業時間・アクセス・編集部コメントで比較できます。難波ど真ん中の店舗を優先表示し、近隣エリアの関連店舗もあわせて掲載しています。",
      pageTitlePage2Plus:
        "大阪難波メンズエステ店舗一覧 {page}ページ目｜口コミ・料金・営業時間で比較",
      pageDescriptionPage2Plus:
        "大阪難波・なんば周辺のメンズエステ店舗一覧（{page}ページ目）。料金・営業時間・口コミ・編集部コメントで比較しながら探せます。",
      rankingTitle: "大阪難波メンズエステおすすめランキング",
      priceTableTitle: "難波メンズエステ料金比較表",
      stationIntro:
        "なんば・難波・南海難波・大阪難波徒歩圏と確認できる店舗を整理しています。徒歩分数は掲載情報に基づかないため表示していません。",
      faqAreaRef: "大阪難波",
      faqFirstAnswer:
        "難波・なんば周辺の店舗を比較する場合は、難波エリアの店舗一覧ページのランキングと料金比較表から条件に合う店舗を絞り込むのがおすすめです。",
      relationCardLabel: "難波との関係",
      shopLinks: {
        listLink: "大阪難波メンズエステの店舗一覧へ",
        compareLink: "難波メンズエステ店舗一覧（口コミ・料金比較）",
        priceLink: "難波メンズエステ料金比較表へ",
        stationLink: "駅近の難波メンズエステ一覧へ"
      }
    },
    relation: NANBA_RELATION
  },
  umeda: {
    seo: {
      displayName: "大阪梅田",
      breadcrumbLabel: "大阪梅田メンズエステ",
      hubTitle: "大阪梅田メンズエステおすすめ一覧｜口コミ・料金・営業時間で比較",
      hubDescription:
        "大阪梅田・大阪駅・東梅田・西梅田・北新地周辺のメンズエステを店舗一覧、口コミ、料金、営業時間、アクセスで比較。深夜営業、駅近、初心者向け、料金目安、編集部コメントをもとに梅田エリアの候補店舗を探せます。",
      coverageLabel: "梅田・大阪駅・東梅田・西梅田・北新地周辺",
      shopListH2: "梅田メンズエステ店舗一覧",
      shopListIntro:
        "大阪梅田・大阪駅周辺のメンズエステを、口コミ・料金目安・営業時間・アクセス・編集部コメントで比較できます。梅田中心部の店舗を優先表示し、近隣エリアの関連店舗もあわせて掲載しています。",
      pageTitlePage2Plus:
        "大阪梅田メンズエステ店舗一覧 {page}ページ目｜口コミ・料金・営業時間で比較",
      pageDescriptionPage2Plus:
        "大阪梅田・大阪駅周辺のメンズエステ店舗一覧（{page}ページ目）。料金・営業時間・口コミ・編集部コメントで比較しながら探せます。",
      rankingTitle: "大阪梅田メンズエステおすすめランキング",
      priceTableTitle: "梅田メンズエステ料金比較表",
      stationIntro:
        "梅田・大阪駅・東梅田・西梅田・北新地徒歩圏と確認できる店舗を整理しています。徒歩分数は掲載情報に基づかないため表示していません。",
      faqAreaRef: "大阪梅田",
      faqFirstAnswer:
        "梅田・大阪駅周辺の店舗を比較する場合は、梅田エリアの店舗一覧ページのランキングと料金比較表から条件に合う店舗を絞り込むのがおすすめです。",
      relationCardLabel: "梅田との関係",
      shopLinks: {
        listLink: "大阪梅田メンズエステの店舗一覧へ",
        compareLink: "梅田メンズエステ店舗一覧（口コミ・料金比較）",
        priceLink: "梅田メンズエステ料金比較表へ",
        stationLink: "駅近の梅田メンズエステ一覧へ"
      }
    },
    relation: UMEDA_RELATION
  }
};

export const NIHONBASHI_HUB_TITLE = HUB_TEMPLATE_AREAS.nihonbashi.seo.hubTitle;
export const NIHONBASHI_HUB_DESCRIPTION = HUB_TEMPLATE_AREAS.nihonbashi.seo.hubDescription;
export const NIHONBASHI_GUIDE_TITLE =
  "日本橋メンズエステで失敗しない選び方｜料金相場・口コミの見方を解説";
export const NIHONBASHI_GUIDE_DESCRIPTION =
  "大阪日本橋・近鉄日本橋周辺でメンズエステを選ぶときのポイントを解説。料金相場、口コミの見方、営業時間、深夜営業、初心者が注意すべき点を整理し、店舗一覧・ランキングページへの導線も掲載しています。";

export function isHubTemplateArea(slug: string): boolean {
  return slug in HUB_TEMPLATE_AREAS;
}

export function getHubTemplateConfig(slug: string): AreaHubTemplateConfig | null {
  return HUB_TEMPLATE_AREAS[slug] ?? null;
}

export function fillHubPageToken(template: string, page: number): string {
  return template.replace(/\{page\}/g, String(page));
}
