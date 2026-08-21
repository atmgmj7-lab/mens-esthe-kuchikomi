export type AreaHubShopLinks = {
  listLink: string;
  compareLink: string;
  priceLink: string;
  stationLink: string;
};

export type AreaHubLocalGuideItem = {
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
};

export type AreaHubLocalGuideConfig = {
  title: string;
  lead: string;
  items: AreaHubLocalGuideItem[];
};

export type AreaHubDecisionGuideConfig = {
  selectionTitle: string;
  intro: string;
};

export type AreaHubFaqItem = {
  question: string;
  answer: string;
};

export type AreaHubNearbyArea = {
  slug: string;
  label: string;
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
  decisionGuide?: AreaHubDecisionGuideConfig;
  localGuide?: AreaHubLocalGuideConfig;
  faqItems?: AreaHubFaqItem[];
  nearbyAreas?: AreaHubNearbyArea[];
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

const SAKAISUJI_HONMACHI_RELATION: AreaHubRelationConfig = {
  corePattern: /堺筋本町|本町|船場|北浜|長堀橋|中央区/,
  relatedPattern: /日本橋|近鉄日本橋|なんば|難波|梅田|新大阪|西中島|堺東|堺/,
  nearbyPattern: /心斎橋|淀屋橋|谷町四丁目|谷町六丁目|南船場|松屋町/,
  dispatchLabel: "出張型（堺筋本町エリアへの派遣対応）",
  stationNearPattern: /堺筋本町|本町|北浜|長堀橋|徒歩|駅周辺|駅前/,
  labelRules: [
    { pattern: /堺筋本町/, label: "堺筋本町駅周辺（中央区ビジネス街）" },
    { pattern: /本町/, label: "本町駅周辺（堺筋本町からアクセス可）" },
    { pattern: /北浜/, label: "北浜駅周辺（堺筋本町近隣）" },
    { pattern: /長堀橋|南船場/, label: "長堀橋・南船場周辺" },
    { pattern: /船場|中央区/, label: "船場・中央区周辺" }
  ],
  nearbyLabelRules: [
    { pattern: /心斎橋/, label: "近隣エリア（心斎橋・堺筋本町から検討可）" },
    { pattern: /淀屋橋|谷町四丁目|谷町六丁目|松屋町/, label: "近隣エリア（中央区周辺）" }
  ],
  relatedLabelRules: [
    { pattern: /日本橋|近鉄日本橋|なんば|難波/, label: "関連エリア（日本橋・なんば方面）" },
    { pattern: /梅田/, label: "関連エリア（梅田方面）" },
    { pattern: /新大阪|西中島/, label: "関連エリア（新大阪・西中島方面）" },
    { pattern: /堺東|堺/, label: "関連エリア（堺方面）" }
  ],
  fallbackRelatedLabel: "堺筋本町周辺の関連店舗",
  primaryGroupTitle: "堺筋本町・本町徒歩圏",
  secondaryGroupTitle: "中央区近隣・関連エリア"
};

const SHINOSAKA_RELATION: AreaHubRelationConfig = {
  corePattern: /新大阪|東三国|西中島南方|西中島|南方|淀川区/,
  relatedPattern: /梅田|大阪駅|日本橋|近鉄日本橋|なんば|難波|京橋|堺/,
  nearbyPattern: /十三|江坂|淡路|中津|天神橋筋六丁目/,
  dispatchLabel: "出張型（新大阪エリアへの派遣対応）",
  stationNearPattern: /新大阪|東三国|西中島南方|西中島|南方|徒歩|駅周辺|駅前/,
  labelRules: [
    { pattern: /新大阪/, label: "新大阪駅周辺（出張前後に検討しやすい）" },
    { pattern: /東三国/, label: "東三国駅周辺（新大阪近隣）" },
    { pattern: /西中島南方|西中島|南方/, label: "西中島南方周辺（新大阪徒歩圏）" },
    { pattern: /淀川区/, label: "淀川区周辺" }
  ],
  nearbyLabelRules: [
    { pattern: /十三|中津|淡路/, label: "近隣エリア（新大阪からアクセス可）" },
    { pattern: /江坂|天神橋筋六丁目/, label: "近隣エリア（北大阪方面）" }
  ],
  relatedLabelRules: [
    { pattern: /梅田|大阪駅/, label: "関連エリア（梅田・大阪駅方面）" },
    { pattern: /日本橋|近鉄日本橋|なんば|難波/, label: "関連エリア（日本橋・なんば方面）" },
    { pattern: /京橋/, label: "関連エリア（京橋方面）" },
    { pattern: /堺/, label: "関連エリア（堺方面）" }
  ],
  fallbackRelatedLabel: "新大阪周辺の関連店舗",
  primaryGroupTitle: "新大阪・西中島徒歩圏",
  secondaryGroupTitle: "北大阪近隣・関連エリア"
};

const SAKAI_RELATION: AreaHubRelationConfig = {
  corePattern: /堺東|堺駅|堺市|三国ヶ丘|大小路|宿院|中百舌鳥|なかもず/,
  relatedPattern: /梅田|大阪駅|新大阪|日本橋|近鉄日本橋|なんば|難波|天王寺/,
  nearbyPattern: /鳳|泉北|住之江|岸和田|松原|北花田/,
  dispatchLabel: "出張型（堺・堺東エリアへの派遣対応）",
  stationNearPattern: /堺東|堺駅|三国ヶ丘|大小路|中百舌鳥|なかもず|徒歩|駅周辺|駅前/,
  labelRules: [
    { pattern: /堺東/, label: "堺東駅周辺（堺エリア中心）" },
    { pattern: /堺駅/, label: "堺駅周辺" },
    { pattern: /三国ヶ丘/, label: "三国ヶ丘駅周辺" },
    { pattern: /大小路|宿院/, label: "堺中心部周辺" },
    { pattern: /中百舌鳥|なかもず/, label: "中百舌鳥周辺" },
    { pattern: /堺市/, label: "堺市内" }
  ],
  nearbyLabelRules: [
    { pattern: /鳳|泉北|北花田/, label: "近隣エリア（堺市内周辺）" },
    { pattern: /住之江|岸和田|松原/, label: "近隣エリア（堺から検討可）" }
  ],
  relatedLabelRules: [
    { pattern: /天王寺/, label: "関連エリア（天王寺方面）" },
    { pattern: /日本橋|近鉄日本橋|なんば|難波/, label: "関連エリア（日本橋・なんば方面）" },
    { pattern: /梅田|大阪駅/, label: "関連エリア（梅田方面）" },
    { pattern: /新大阪/, label: "関連エリア（新大阪方面）" }
  ],
  fallbackRelatedLabel: "堺・堺東周辺の関連店舗",
  primaryGroupTitle: "堺東・堺駅周辺",
  secondaryGroupTitle: "堺市内近隣・関連エリア"
};

/** 共通ハブテンプレート設定（エリア差分はここに集約） */
export const HUB_TEMPLATE_AREAS: Record<string, AreaHubTemplateConfig> = {
  sakaisujihonmachi: {
    seo: {
      displayName: "堺筋本町",
      breadcrumbLabel: "堺筋本町メンズエステ",
      hubTitle: "堺筋本町のメンズエステおすすめ一覧｜料金・深夜・口コミ比較",
      hubDescription:
        "堺筋本町エリアに掲載されているメンズエステを、本町・北浜など周辺の案内とあわせて比較できます。承認済み口コミ、掲載料金、営業時間、店舗詳細への導線から、現在確認できる情報だけを掲載します。",
      coverageLabel: "堺筋本町・本町・北浜・長堀橋・船場周辺",
      shopListH2: "堺筋本町メンズエステ店舗一覧",
      shopListIntro:
        "堺筋本町エリアに掲載されているメンズエステを、料金・営業時間・公式サイトなど確認できた情報とともに一覧で比較できます。",
      pageTitlePage2Plus:
        "堺筋本町メンズエステ店舗一覧 {page}ページ目｜口コミ・料金・営業時間で比較",
      pageDescriptionPage2Plus:
        "堺筋本町・本町・北浜周辺のメンズエステ店舗一覧（{page}ページ目）。料金・営業時間・掲載情報コメントで比較しながら探せます。",
      rankingTitle: "堺筋本町メンズエステおすすめランキング",
      priceTableTitle: "堺筋本町メンズエステ料金比較表",
      stationIntro:
        "堺筋本町・本町・北浜・長堀橋徒歩圏と確認できる店舗を整理しています。徒歩分数は掲載情報に基づかないため表示していません。",
      faqAreaRef: "堺筋本町",
      faqFirstAnswer:
        "堺筋本町エリアの掲載店舗を一覧で比較し、住所や駅案内、料金、営業時間は各店舗ページと公式情報で確認してください。",
      relationCardLabel: "堺筋本町との関係",
      shopLinks: {
        listLink: "堺筋本町メンズエステの店舗一覧へ",
        compareLink: "堺筋本町メンズエステ店舗一覧（口コミ・料金比較）",
        priceLink: "堺筋本町メンズエステ料金比較表へ",
        stationLink: "駅近の堺筋本町メンズエステ一覧へ"
      },
      decisionGuide: {
        selectionTitle: "掲載情報と利用条件から絞る",
        intro:
          "掲載料金、営業時間、承認済み口コミ、店舗詳細の公式導線など、確認できる項目から比較します。"
      },
      localGuide: {
        title: "堺筋本町・本町・北浜の使い分け",
        lead:
          "堺筋本町を中心に探す場合と、本町・北浜も候補に広げる場合を分け、店舗詳細の住所・駅案内・料金・営業時間を確認してください。",
        items: [
          {
            title: "堺筋本町を中心に探す",
            body:
              "堺筋本町エリアに掲載されている公開店舗を、ページの店舗一覧で比較できます。",
            href: "#shop-list",
            linkLabel: "堺筋本町の掲載店舗を見る"
          },
          {
            title: "本町・北浜も候補にする",
            body:
              "本町・北浜からも探す場合は、各店舗の住所や駅案内を店舗詳細で確認し、利用予定の場所に合うか比較してください。"
          },
          {
            title: "料金・営業時間は掲載状況を確認",
            body:
              "未確認値を相場として補わず、ページ内で確認できる掲載情報と店舗詳細の公式導線を使って比較します。"
          }
        ]
      },
      faqItems: [
        {
          question: "堺筋本町と本町・北浜の店舗は同じ一覧ですか？",
          answer: "このページでは堺筋本町エリアに掲載されている店舗をまとめて案内しています。利用場所は店舗詳細の住所や駅案内で確認してください。"
        },
        {
          question: "堺筋本町エリアの料金はどう比べますか？",
          answer: "掲載料金を確認できる店舗だけを条件表示します。料金が確認できない場合は数値を補わず、店舗詳細や公式情報で確認してください。"
        },
        {
          question: "堺筋本町の口コミはどの情報を掲載していますか？",
          answer: "公開店舗に紐づく承認済みユーザー口コミだけを表示し、編集部コメント、店舗提供情報、PRは口コミへ含めません。"
        }
      ],
      nearbyAreas: [
        { slug: "nihonbashi", label: "大阪・日本橋のメンズエステを見る" },
        { slug: "umeda", label: "梅田のメンズエステを見る" }
      ]
    },
    relation: SAKAISUJI_HONMACHI_RELATION
  },
  shinosaka: {
    seo: {
      displayName: "新大阪",
      breadcrumbLabel: "新大阪メンズエステ",
      hubTitle: "新大阪のメンズエステおすすめ一覧｜西中島・東三国の料金比較",
      hubDescription:
        "新大阪エリアに掲載されているメンズエステを、西中島・東三国など周辺の案内とあわせて比較できます。承認済み口コミ、掲載料金、営業時間、店舗詳細の公開情報から、確認できる条件だけを掲載します。",
      coverageLabel: "新大阪・東三国・西中島南方・南方・淀川区周辺",
      shopListH2: "新大阪メンズエステ店舗一覧",
      shopListIntro:
        "新大阪エリアに掲載されているメンズエステを、料金・営業時間・公式サイトなど確認できた情報とともに一覧で比較できます。",
      pageTitlePage2Plus:
        "新大阪メンズエステ店舗一覧 {page}ページ目｜口コミ・料金・営業時間で比較",
      pageDescriptionPage2Plus:
        "新大阪・東三国・西中島南方周辺のメンズエステ店舗一覧（{page}ページ目）。料金・営業時間・掲載情報コメントで比較しながら探せます。",
      rankingTitle: "新大阪メンズエステおすすめランキング",
      priceTableTitle: "新大阪メンズエステ料金比較表",
      stationIntro:
        "新大阪・東三国・西中島南方徒歩圏と確認できる店舗を整理しています。徒歩分数は掲載情報に基づかないため表示していません。",
      faqAreaRef: "新大阪",
      faqFirstAnswer:
        "新大阪エリアの掲載店舗を一覧で比較し、住所や駅案内、営業形態は各店舗ページと公式情報で確認してください。",
      relationCardLabel: "新大阪との関係",
      shopLinks: {
        listLink: "新大阪メンズエステの店舗一覧へ",
        compareLink: "新大阪メンズエステ店舗一覧（口コミ・料金比較）",
        priceLink: "新大阪メンズエステ料金比較表へ",
        stationLink: "駅近の新大阪メンズエステ一覧へ"
      },
      decisionGuide: {
        selectionTitle: "新大阪の掲載店舗から絞る",
        intro:
          "掲載料金、営業時間、承認済み口コミ、店舗詳細の公開情報から、新大阪の候補を比較します。"
      },
      localGuide: {
        title: "新大阪・西中島・東三国の見分け方",
        lead: "新大阪駅周辺を中心に探す場合と、西中島・東三国まで候補を広げる場合を分け、店舗詳細の住所・駅案内・営業形態を確認してください。",
        items: [
          {
            title: "新大阪駅周辺を中心に探す",
            body: "新大阪エリアに掲載されている公開店舗を、ページの店舗一覧で比較できます。",
            href: "#shop-list",
            linkLabel: "新大阪の掲載店舗を見る"
          },
          {
            title: "西中島・東三国も候補にする",
            body: "西中島・東三国からも探す場合は、各店舗の住所・駅案内・対応場所を店舗詳細で確認してください。"
          },
          {
            title: "出張型・ホテル利用の確認",
            body: "営業形態や対応場所を地域名だけで推測せず、店舗詳細と公式案内に記載された情報を確認してください。"
          }
        ]
      },
      faqItems: [
        {
          question: "新大阪・西中島・東三国は同じエリアとして掲載されますか？",
          answer: "このページでは新大阪エリアに掲載されている店舗をまとめて案内しています。利用場所は店舗詳細の住所や駅案内で確認してください。"
        },
        {
          question: "新大阪エリアの店舗型・出張型はどう確認しますか？",
          answer: "地域名だけでは判定せず、各店舗詳細や公式案内に掲載された営業形態と対応場所を確認してください。"
        },
        {
          question: "新大阪の口コミはどの情報を表示していますか？",
          answer: "公開店舗に紐づく承認済みユーザー口コミだけを表示し、編集部コメントや店舗提供情報は別の情報として扱います。"
        }
      ],
      nearbyAreas: [
        { slug: "umeda", label: "梅田のメンズエステを見る" }
      ]
    },
    relation: SHINOSAKA_RELATION
  },
  nihonbashi: {
    seo: {
      displayName: "大阪日本橋",
      breadcrumbLabel: "大阪日本橋メンズエステ",
      hubTitle: "大阪・日本橋のメンズエステおすすめ一覧｜難波・近鉄日本橋で比較",
      hubDescription:
        "大阪日本橋エリアに掲載されているメンズエステを、近鉄日本橋・なんばなど周辺の案内とあわせて比較できます。承認済み口コミ、掲載料金、営業時間、店舗詳細の公開情報から確認できる内容だけを掲載します。",
      coverageLabel: "日本橋・近鉄日本橋・なんば・谷町九丁目・黒門市場周辺",
      shopListH2: "日本橋メンズエステ店舗一覧",
      shopListIntro:
        "大阪日本橋エリアに掲載されているメンズエステを、料金・営業時間・公式サイトなど確認できた情報とともに一覧で比較できます。",
      pageTitlePage2Plus:
        "大阪日本橋メンズエステ店舗一覧 {page}ページ目｜口コミ・料金・営業時間で比較",
      pageDescriptionPage2Plus:
        "大阪日本橋・近鉄日本橋・なんば周辺のメンズエステ店舗一覧（{page}ページ目）。料金・営業時間・掲載情報コメントで比較しながら探せます。",
      rankingTitle: "大阪日本橋メンズエステおすすめランキング",
      priceTableTitle: "日本橋メンズエステ料金比較表",
      stationIntro:
        "日本橋・近鉄日本橋・なんば・谷町九丁目徒歩圏と確認できる店舗を整理しています。徒歩分数は掲載情報に基づかないため表示していません。",
      faqAreaRef: "大阪日本橋",
      faqFirstAnswer:
        "大阪日本橋エリアの掲載店舗を一覧で比較し、住所や駅案内、料金、営業時間は各店舗ページと公式情報で確認してください。",
      relationCardLabel: "日本橋との関係",
      shopLinks: {
        listLink: "大阪日本橋メンズエステの店舗一覧へ",
        compareLink: "日本橋メンズエステ店舗一覧（口コミ・料金比較）",
        priceLink: "日本橋メンズエステ料金比較表へ",
        stationLink: "駅近の日本橋メンズエステ一覧へ"
      },
      decisionGuide: {
        selectionTitle: "大阪日本橋の掲載店舗から絞る",
        intro:
          "東京の日本橋と混同せず、確認できる料金、営業時間、口コミ、店舗詳細から大阪日本橋の候補を比較します。"
      },
      localGuide: {
        title: "大阪日本橋・近鉄日本橋・なんばの見分け方",
        lead: "このページは大阪の日本橋を対象にしています。近鉄日本橋・なんばも候補にする場合は、店舗詳細の住所・駅案内を確認してください。",
        items: [
          {
            title: "大阪の日本橋を対象にする",
            body: "東京の日本橋とは分け、大阪日本橋エリアに掲載されている公開店舗を一覧で案内します。",
            href: "#shop-list",
            linkLabel: "大阪日本橋の掲載店舗を見る"
          },
          {
            title: "近鉄日本橋・なんばも確認する",
            body: "近鉄日本橋・なんばから探す場合は、各店舗の住所や駅案内を確認し、利用予定の場所に合うか比較してください。"
          },
          {
            title: "口コミと店舗情報を分けて確認",
            body: "承認済みユーザー口コミ、店舗の公開情報、編集部コメント、PRを同じ評価として混ぜずに確認できます。"
          }
        ]
      },
      faqItems: [
        {
          question: "この日本橋ページは東京と大阪のどちらですか？",
          answer: "大阪・日本橋、近鉄日本橋周辺を探すための地域ページです。東京日本橋の店舗情報としては扱いません。"
        },
        {
          question: "大阪日本橋とななんばの店舗は同じ一覧ですか？",
          answer: "このページでは大阪日本橋エリアに掲載されている店舗をまとめて案内しています。利用場所は店舗詳細の住所や駅案内で確認してください。"
        },
        {
          question: "大阪日本橋の口コミはどの情報を掲載していますか？",
          answer: "公開店舗に紐づく承認済みユーザー口コミだけを表示し、編集部コメント、店舗提供情報、PRは口コミへ含めません。"
        }
      ],
      nearbyAreas: [
        { slug: "sakaisujihonmachi", label: "堺筋本町のメンズエステを見る" }
      ],
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
        "大阪難波・なんば周辺のメンズエステ店舗一覧（{page}ページ目）。料金・営業時間・掲載情報コメントで比較しながら探せます。",
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
      hubTitle: "梅田のメンズエステおすすめ一覧｜大阪駅・北新地の料金・深夜比較",
      hubDescription:
        "梅田エリアに掲載されているメンズエステを、大阪駅・北新地など周辺の案内とあわせて比較できます。承認済み口コミ、掲載料金、営業時間、店舗詳細の公開情報から、現在確認できる条件だけを掲載します。",
      coverageLabel: "梅田・大阪駅・東梅田・西梅田・北新地周辺",
      shopListH2: "梅田メンズエステ店舗一覧",
      shopListIntro:
        "梅田エリアに掲載されているメンズエステを、料金・営業時間・公式サイトなど確認できた情報とともに一覧で比較できます。",
      pageTitlePage2Plus:
        "大阪梅田メンズエステ店舗一覧 {page}ページ目｜口コミ・料金・営業時間で比較",
      pageDescriptionPage2Plus:
        "大阪梅田・大阪駅周辺のメンズエステ店舗一覧（{page}ページ目）。料金・営業時間・掲載情報コメントで比較しながら探せます。",
      rankingTitle: "大阪梅田メンズエステおすすめランキング",
      priceTableTitle: "梅田メンズエステ料金比較表",
      stationIntro:
        "梅田・大阪駅・東梅田・西梅田・北新地徒歩圏と確認できる店舗を整理しています。徒歩分数は掲載情報に基づかないため表示していません。",
      faqAreaRef: "大阪梅田",
      faqFirstAnswer:
        "梅田エリアの掲載店舗を一覧で比較し、住所や駅案内、料金、営業時間は各店舗ページと公式情報で確認してください。",
      relationCardLabel: "梅田との関係",
      shopLinks: {
        listLink: "大阪梅田メンズエステの店舗一覧へ",
        compareLink: "梅田メンズエステ店舗一覧（口コミ・料金比較）",
        priceLink: "梅田メンズエステ料金比較表へ",
        stationLink: "駅近の梅田メンズエステ一覧へ"
      },
      decisionGuide: {
        selectionTitle: "梅田の掲載店舗から条件を絞る",
        intro:
          "確認できる掲載料金、営業時間、承認済み口コミ、店舗詳細から梅田の候補を比較します。"
      },
      localGuide: {
        title: "梅田・大阪駅・北新地の見分け方",
        lead: "梅田を中心に探す場合と、大阪駅・北新地も候補にする場合を分け、店舗詳細の住所・駅案内・料金・営業時間を確認してください。",
        items: [
          {
            title: "梅田を中心に探す",
            body: "梅田エリアに掲載されている公開店舗を、ページの店舗一覧で比較できます。",
            href: "#shop-list",
            linkLabel: "梅田の掲載店舗を見る"
          },
          {
            title: "大阪駅・北新地も候補にする",
            body: "大阪駅・北新地からも探す場合は、各店舗の住所や駅案内を店舗詳細で確認してください。"
          },
          {
            title: "料金・深夜利用の確認",
            body: "確認できる掲載料金と営業時間だけを条件表示し、未確認の受付時刻や料金はページ側で補いません。"
          }
        ]
      },
      faqItems: [
        {
          question: "梅田・大阪駅・北新地は同じエリアとして掲載されますか？",
          answer: "このページでは梅田エリアに掲載されている店舗をまとめて案内しています。利用場所は店舗詳細の住所や駅案内で確認してください。"
        },
        {
          question: "梅田で深夜に利用できる店舗はどう確認しますか？",
          answer: "営業時間を確認できる店舗だけを条件表示します。最新の受付状況は店舗詳細や公式情報で確認してください。"
        },
        {
          question: "梅田の口コミはどの情報を表示していますか？",
          answer: "公開店舗に紐づく承認済みユーザー口コミだけを表示し、編集部コメントやPRは口コミ件数へ含めません。"
        }
      ],
      nearbyAreas: [
        { slug: "shinosaka", label: "新大阪のメンズエステを見る" },
        { slug: "sakaisujihonmachi", label: "堺筋本町のメンズエステを見る" }
      ]
    },
    relation: UMEDA_RELATION
  },
  sakai: {
    seo: {
      displayName: "堺・堺東",
      breadcrumbLabel: "堺・堺東メンズエステ",
      hubTitle: "堺東のメンズエステおすすめ一覧｜堺市の料金・深夜・口コミ比較",
      hubDescription:
        "堺東エリアに掲載されているメンズエステを、堺市内周辺の案内とあわせて比較できます。承認済み口コミ、掲載料金、営業時間、店舗詳細の公開情報から、確認できる条件だけを掲載し、未確認値は補いません。",
      coverageLabel: "堺東・堺駅・三国ヶ丘・中百舌鳥・堺市内周辺",
      shopListH2: "堺・堺東メンズエステ店舗一覧",
      shopListIntro:
        "堺東エリアに掲載されているメンズエステを、料金・営業時間・公式サイトなど確認できた情報とともに一覧で比較できます。",
      pageTitlePage2Plus:
        "堺・堺東メンズエステ店舗一覧 {page}ページ目｜口コミ・料金・営業時間で比較",
      pageDescriptionPage2Plus:
        "堺・堺東・三国ヶ丘周辺のメンズエステ店舗一覧（{page}ページ目）。料金・営業時間・掲載情報コメントで比較しながら探せます。",
      rankingTitle: "堺・堺東メンズエステおすすめランキング",
      priceTableTitle: "堺・堺東メンズエステ料金比較表",
      stationIntro:
        "堺東・堺駅・三国ヶ丘・中百舌鳥徒歩圏と確認できる店舗を整理しています。徒歩分数は掲載情報に基づかないため表示していません。",
      faqAreaRef: "堺・堺東",
      faqFirstAnswer:
        "現在のURLを維持した堺東の地域ページとして、堺東エリアに掲載されている店舗を一覧で案内します。",
      relationCardLabel: "堺・堺東との関係",
      shopLinks: {
        listLink: "堺・堺東メンズエステの店舗一覧へ",
        compareLink: "堺・堺東メンズエステ店舗一覧（口コミ・料金比較）",
        priceLink: "堺・堺東メンズエステ料金比較表へ",
        stationLink: "駅近の堺・堺東メンズエステ一覧へ"
      },
      decisionGuide: {
        selectionTitle: "堺東の掲載店舗から条件を絞る",
        intro:
          "URLは変えず堺東をページの主語とし、確認できる料金、営業時間、口コミ、店舗詳細から候補を比較します。"
      },
      localGuide: {
        title: "堺東と堺市内の関連エリアの見分け方",
        lead: "このページは堺東を中心に探すための地域ページです。堺市内の別地域も候補にする場合は、店舗詳細の住所・駅案内を確認してください。",
        items: [
          {
            title: "堺東を中心に探す",
            body: "堺東エリアに掲載されている公開店舗を、ページの店舗一覧で比較できます。",
            href: "#shop-list",
            linkLabel: "堺東の掲載店舗を見る"
          },
          {
            title: "堺市内の関連地域も確認する",
            body: "堺駅・三国ヶ丘・中百舌鳥などからも探す場合は、各店舗の住所や駅案内を店舗詳細で確認してください。"
          },
          {
            title: "料金・営業時間・口コミの確認",
            body: "掲載を確認できた値と承認済み口コミだけを使い、未確認の料金や受付時間を固定値で補いません。"
          }
        ]
      },
      faqItems: [
        {
          question: "現在の堺ページは堺東を探すページですか？",
          answer: "はい。現在のページURLを維持したまま、表示上は堺東を中心に店舗を探せる地域ページとして案内しています。"
        },
        {
          question: "堺東以外の堺市内店舗は主一覧へ入りますか？",
          answer: "このページでは堺東エリアに掲載されている店舗をまとめて案内しています。利用場所は店舗詳細の住所や駅案内で確認してください。"
        },
        {
          question: "堺東の口コミはどの情報を掲載していますか？",
          answer: "公開店舗に紐づく承認済みユーザー口コミだけを表示し、編集部コメント、店舗提供情報、PRは口コミへ含めません。"
        }
      ],
      nearbyAreas: [
        { slug: "nihonbashi", label: "大阪・日本橋のメンズエステを見る" }
      ]
    },
    relation: SAKAI_RELATION
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
