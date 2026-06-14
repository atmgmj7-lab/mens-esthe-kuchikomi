# Area Hub — CharacterLayer 画像

ThemeBanner の CharacterLayer 用透過画像を配置するディレクトリです。
背景・装飾・文言は HTML/CSS のため、画像内に文字や背景装飾を焼き込まないでください。

## 参照パス

lib/area-hub-banner-config.ts の characterImageSrc(pose):

  /images/area-hub/characters/{pose-id}.webp

例: characterImageSrc("hero-waist-up-01")
  → /images/area-hub/characters/hero-waist-up-01.webp

## ファイル名とテーマ対応

| ファイル名 | pose ID | 主なテーマ |
|-----------|---------|-----------|
| hero-waist-up-01.webp | hero-waist-up-01 | areaHero（ページトップ） |
| hero-braid-beige-01.webp | hero-braid-beige-01 | beginner |
| hero-uniform-gold-01.webp | hero-uniform-gold-01 | ranking |
| hero-black-dress-01.webp | hero-black-dress-01 | lateNight |
| hero-champagne-blouse-01.webp | hero-champagne-blouse-01 | reviews |
| hero-navy-uniform-01.webp | hero-navy-uniform-01 | price / station |

pose ID の定義: ThemeBannerCharacterPose（lib/area-hub-banner-config.ts）

## 推奨画像仕様

- 形式: 透過 WebP（推奨）。PNG は非推奨（容量・透過品質）
- 縦サイズ: 800〜1200px 程度（超える場合は書き出し前にリサイズ）
- 背景: 完全透過（アルファチャンネル必須）
- 構図: 上半身〜半身。右寄せ配置を想定し、人物はフレーム右側寄り
- 余白: 頭・肘が切れない程度の下余白。左側にテキスト用の空きを意識
- 禁止: 画像内テキスト、ロゴ、背景グラデ、枠線などの装飾

## 透過 WebP でない場合のリスク

- 白またはグレーの矩形が CharacterLayer 背面に見える（チェッカー PNG をそのまま使った場合など）
- ダークテーマ（lateNight）で白背景が浮いて安っぽく見える
- ファイルサイズが大きく LCP / モバイル読み込みが遅くなる
- object-fit: contain でも背景色が透けず、CSS 背景と二重になる

対処: 透過 PNG から WebP を再書き出し（quality 85〜90、alpha 維持）。

## 差し替え手順

1. このディレクトリに {pose-id}.webp を上書き配置
2. ブラウザキャッシュをクリアして /area/{slug}/ を確認
3. エリア別に pose を変える場合は THEME_BANNER_CHARACTER_OVERRIDES（area-hub-banner-config.ts）を編集

## ranking / lateNight / reviews の ThemeBanner 展開

### A. 条件別タブ（lateNight / price / station など）

lib/area-hub-banner-config.ts の LAYERED_BANNER_TABS に themeKey を追加:

  export const LAYERED_BANNER_TABS = new Set([
    "beginner",
    "lateNight",  // ← 追加
  ]);

CompareTabPanel が自動で ThemeBanner + AreaHubSectionHeader 省略に切り替わります。

### B. ページセクション（ranking / reviews など）

LAYERED_BANNER_SECTIONS に themeKey を追加:

  export const LAYERED_BANNER_SECTIONS = new Set([
    "ranking",
    "reviews",
  ]);

AreaHubRankingTop / AreaLatestReviews が banner スロット経由で ThemeBanner を表示します。

### C. 任意のセクション

AreaHubSectionShell の banner prop に AreaHubThemeBanner を渡す:

  <AreaHubSectionShell
    theme="reviews"
    banner={
      <AreaHubThemeBanner
        hubTheme="reviews"
        areaSlug={slug}
        title={<h2>...</h2>}
        description="..."
      />
    }
  />

## ローカル確認チェックリスト

- areaHero: キャラが右側、H1/stats と重ならない
- beginner タブ: セクション高さが過剰にならない
- SP: キャラ高さ 160〜180px 程度に収まる（globals.css .theme-banner__character）
- 画像未配置: CharacterLayer は空でもレイアウト崩れしない

## ソース PNG（参考）

UUID 名の PNG は編集用ソース。本番参照は {pose-id}.webp のみ。
