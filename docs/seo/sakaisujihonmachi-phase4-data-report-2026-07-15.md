# 堺筋本町 Phase 4 実データ調査レポート

確認日: 2026-07-15

## 結論

- WordPress既定順で固定した30店舗を調査し、一次情報72件を項目単位で記録した。
- 料金確認済みは21/30、営業時間確認済みは23/30、駅情報確認済みは20/30。
- Supabase非公開draft候補を持つ店舗は26/30。料金89行、営業時間23行、公式URL単位の出典71行（調査記録72件）、項目別出典189行を読み取り専用previewへ変換した。
- WordPressは現行公開値との比較にだけ使用し、更新先にはしていない。公開データ元はWordPressのまま。
- 未確認値、推測値、利用者投稿の代替文章は追加していない。

## 確認済み件数

| 項目 | 確認済み |
|---|---:|
| 公式名 | 26/30 |
| 住所 | 11/30 |
| 駅・出口・徒歩 | 20/30 |
| 営業時間 | 23/30 |
| 料金 | 21/30 |
| 電話 | 25/30 |
| 予約方法 | 26/30 |
| 初回向け公式案内 | 5/30 |

## 料金集計

- 代表料金確認済み: 21/30
- 最小: 8,000円
- 中央値: 12,500円
- 最大: 18,000円

| 代表料金帯 | 店舗数 |
|---|---:|
| 10,000円未満 | 1 |
| 10,000〜11,999円 | 6 |
| 12,000〜14,999円 | 9 |
| 15,000〜19,999円 | 5 |
| 20,000円以上 | 0 |

## 営業時間と深夜対応

- 営業時間確認済み: 23/30
- 閉店時刻が翌日と明記された深夜対応: 20/23
- LAST表記で具体的な閉店時刻が未掲載: 2/23
- LAST表記は深夜対応件数へ含めていない。

## 駅・出口

| 確認済みの駅・出口 | 店舗内の掲載数 |
|---|---:|
| 堺筋本町駅（出口未掲載） | 10 |
| 堺筋本町駅 3番出口 | 5 |
| 堺筋本町駅 10番出口 | 1 |
| 堺筋本町駅 6番出口 | 1 |
| 長堀橋駅 2-B番出口 | 1 |
| 長堀橋駅 3番出口 | 1 |
| 長堀橋駅（出口未掲載） | 1 |
| 日本橋駅 7番出口 | 1 |
| 淀屋橋駅 11番出口 | 1 |
| 淀屋橋駅（出口未掲載） | 1 |

## 予約方法

| 種類 | 確認済み件数 |
|---|---:|
| phone | 25 |
| web | 7 |
| line | 10 |
| dm | 0 |
| other | 0 |

## 初回向け公式案内

- LUXY（ラグジー）（WP 820）: 初回は指名なしのフリーオーダーを推奨し、案内可能なセラピストからおすすめを案内すると説明している。
- Un Secret（アンスクレ）（WP 826）: 初回は指名なしのフリーオーダーを推奨し、案内可能なセラピストからおすすめを案内すると説明している。
- VISCONTI（ヴィスコンティ）（WP 828）: 明示金額以外の追加料金、指名料、オプション設定がなく、初めてでも料金を把握しやすいと説明している。
- アヌSPA（WP 779）: 初回は指名なしのフリーオーダーを推奨し、おすすめのセラピストで案内すると説明している。
- VIO:V（ヴィオーヴ）（WP 719）: 初回だけ安く見せる広告や高額ローン勧誘は行わないと説明している。

## 30店舗の確認結果

| 順 | WP ID | WordPress名 | 公式名 | 代表料金 | 営業時間 | 駅・出口 | 予約 | 未確認項目 |
|---:|---:|---|---|---|---|---|---|---|
| 1 | 1237 | 殿様気分 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | official_name、official_url、address、access_points、business_hours、prices、contact.phone、contact.booking_methods、beginner_guidance |
| 2 | 1221 | Riru cheri（リルシェ） | Riru chéri(リルシェ) | 90分 17,000円 | 11:00〜29:00（受付10:00〜27:00） | 堺筋本町駅 徒歩5分 | 電話予約 / ネット予約 / LINE登録 | address、beginner_guidance |
| 3 | 1210 | Elin（エリン） | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | official_name、official_url、address、access_points、business_hours、prices、contact.phone、contact.booking_methods、beginner_guidance |
| 4 | 1203 | Feliz（フェリス） | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | official_name、official_url、address、access_points、business_hours、prices、contact.phone、contact.booking_methods、beginner_guidance |
| 5 | 880 | Drnu（ドクターヌ） | Drnu・ドクターヌ | 70分 11,000円 | 未確認 | 淀屋橋駅 徒歩3分 / 淀屋橋駅 11番出口 徒歩3分 | 予約専用電話 / LINE予約 | address、business_hours、beginner_guidance |
| 6 | 883 | FROG SPA（フロッグスパ） | FROG SPA(フロッグスパ) | 60分 13,000円 | 12:00〜27:00（受付10:00〜25:30） | 堺筋本町駅 6番出口 徒歩4分 | 電話予約 | beginner_guidance |
| 7 | 885 | 祇園 the.Mrs 天満橋店（ぎおんザミセス） | 祇園the.Mrs | 75分 12,000円 | 11:00〜翌5:00（受付10:00〜翌3:00） | 堺筋本町駅 徒歩5分 | 電話予約 | address、beginner_guidance |
| 8 | 838 | ChouChou（シュシュ） | ChouChou～シュシュ～北新地 | 60分 10,000円 | 10:00〜翌4:00 | 堺筋本町駅 徒歩5分 | 電話予約 | address、beginner_guidance |
| 9 | 853 | Mrs.FlowerSPA（ミセスフラワースパ） | Mrs.FlowerSpa | 90分 15,000円 | 11:00〜翌5:00（受付10:00〜翌3:00） | 堺筋本町駅 徒歩5分 | 電話予約 | address、beginner_guidance |
| 10 | 799 | Firstclass（ファーストクラス） | ファーストクラス | 60分 10,000円 | 10:00〜26:00（受付9:00〜25:00） | 堺筋本町駅 徒歩5分 | 電話予約 | beginner_guidance |
| 11 | 805 | Karisome（かりそめ） | かりそめ別館 大阪泡洗体マッサージ | 90分 13,000円 | 10:00〜翌5:30（受付9:00〜翌3:30） | 未確認 | 電話予約 | address、access_points、beginner_guidance |
| 12 | 807 | 君色ドレスSPA | 君色ドレスSPA | 60分 10,000円 | 10:00〜翌6:00 | 堺筋本町駅 徒歩3分 | 電話予約 / WEB予約 | address_detail、exit、beginner_guidance |
| 13 | 812 | milk tea（ミルクティー） | ミルクティー -milktea- | 未確認 | 10:00〜翌5:00 | 未確認 | 電話予約 / 公式LINE | address、access_points、prices、beginner_guidance |
| 14 | 815 | Mrs.HOLIC（ミセス ホリック） | Mrs.HOLIC(ミセスホリック) | 90分 14,000円 | 10:00〜翌5:00 | 未確認 | 電話予約 | access_points、beginner_guidance |
| 15 | 817 | なにわ女子 | なにわ女子 | 60分 11,000円 | 14:00〜翌5:00（最終受付3:30） | 堺筋本町駅 徒歩3分 | 電話予約 / ネット予約 / 公式LINE | address、exit、beginner_guidance |
| 16 | 820 | LUXY（ラグジー） | LUXY（ラグジー） | 90分 16,500円 | 10:00〜翌4:00（受付終了 翌2:30） | 堺筋本町駅 | 電話予約 | address、exit、walk_minutes |
| 17 | 826 | Un Secret（アンスクレ） | Un Secret（アンスクレ） | 90分 18,000円 | 10:00〜翌4:00（受付9:00〜翌2:30） | 堺筋本町駅 | 電話予約 | address、exit、walk_minutes |
| 18 | 828 | VISCONTI（ヴィスコンティ） | VISCONTI（ヴィスコンティ） | 未確認 | 未確認 | 堺筋本町駅 3番出口 徒歩2分 | 電話予約 / LINE予約 | business_hours、prices |
| 19 | 794 | CLUB LEGGENDA（クラブレジェンダ） | CLUB LEGGENDA（クラブレジェンダ） | 65分 12,000円 | 16:00〜翌5:00 | 未確認 | 電話予約 | address、access_points、beginner_guidance |
| 20 | 795 | C.r.e.a.m（クリーム） | C.r.e.a.m | 90分 14,000円 | 10:00〜翌5:00（受付 翌3:30まで） | 堺筋本町駅 3番出口 徒歩2分 | 電話予約 | address_detail、beginner_guidance |
| 21 | 747 | Sanando（サナンド） | Sanando サナンド | 75分 12,500円 | 10:00〜26:00（受付9:00〜25:00、事前予約9:00〜24:00） | 日本橋駅 7番出口 徒歩5分 | 電話予約 | sakaisujihonmachi_access、beginner_guidance |
| 22 | 763 | こころのゆりかご | こころのゆりかご | 未確認 | 未確認 | 未確認 | WEB予約 | address、access_points、business_hours、prices、phone、beginner_guidance |
| 23 | 775 | ゆだねて | ゆだねて | 60分 11,000円 | 堺筋本町ルーム 10:00〜3:00（共通受付8:00〜2:00） | 長堀橋駅 2-B番出口 徒歩3分 / 堺筋本町駅 10番出口 徒歩6分 | 電話予約 / WEB予約 / LINE予約 | address_detail、beginner_guidance |
| 24 | 779 | アヌSPA | アヌSPA-アヌスパ- | 未確認 | 11:00〜LAST（受付10:00〜LAST） | 未確認 | 電話予約 | address_detail、sakaisujihonmachi_access、prices、closing_time |
| 25 | 715 | The.gloss（ザ・グロス） | The Gloss | 90分 16,000円 | 10:00〜翌5:00 | 堺筋本町駅 3番出口 徒歩5分 | 電話予約 / 予約フォーム / LINE予約 | beginner_guidance |
| 26 | 716 | 桃源郷（とうげんきょう） | 桃源郷 | 90分 12,000円 | 10:00〜翌5:00 | 堺筋本町駅 3番出口 | 電話予約 / 公式LINE | walk_minutes、beginner_guidance |
| 27 | 700 | プレミアム離宮 | 未確認 | 未確認 | 未確認 | 未確認 | 未確認 | official_name、official_url、address、access_points、business_hours、prices、phone、booking_methods、beginner_guidance |
| 28 | 717 | UNION＋（ユニオンプラス） | UNION＋ - ユニオン プラス - | 90分 14,000円 | 10:00〜25:00（受付9:00〜24:00） | 堺筋本町駅 徒歩3分 | 電話予約 / LINE予約 / WEB予約 | exit、beginner_guidance |
| 29 | 701 | Queen Spumante 長堀橋店（クイーンスプマンテ） | Queen Spumante（クイーンスプマンテ） | 60分 8,000円 | 10:00〜LAST（電話受付9:30〜3:30） | 堺筋本町駅 3番出口 徒歩5分 / 長堀橋駅 3番出口 徒歩5分 | 電話予約 | closing_time、beginner_guidance |
| 30 | 719 | VIO:V（ヴィオーヴ） | VIO:V（ヴィオーヴ） | 未確認 | 10:00〜22:00（予約受付9:00〜21:00） | 長堀橋駅 徒歩1分 | 電話予約 / LINE予約 | address_detail、exit、prices |

## 一次情報一覧

### 1. 殿様気分（WP 1237）

- 採用できる一次情報なし

- 注記: 公式URL候補 https://spa-tono.com/ は2026-07-15の確認時にHTTP 403および調査ツールのタイムアウトとなったため、WordPress現行値を一次情報へ昇格していない。

### 2. Riru cheri（リルシェ）（WP 1221）

- [Riru chéri 公式サイト](https://riru-cheri.com/) — 確認日 2026-07-15
- [料金システム](https://riru-cheri.com/system.html) — 確認日 2026-07-15
- [アクセス](https://riru-cheri.com/access.html) — 確認日 2026-07-15

- 注記: 公式アクセスページは堺筋本町駅から徒歩約5分と掲載しているが、出口は掲載していない。
- 注記: 公式サイトに期間限定割引の案内があるが、代表料金は通常料金だけから選定した。

### 3. Elin（エリン）（WP 1210）

- 採用できる一次情報なし

- 注記: 公式URL候補 http://www.osakaelin.com/ は第三者サイトへ転送され、HTTPS証明書も対象ホストと一致しなかった。検索キャッシュ値は確認済み値として採用していない。

### 4. Feliz（フェリス）（WP 1203）

- 採用できる一次情報なし

- 注記: WordPress登録URL https://www.osakafeliz.com/ は第三者サイトへ転送されたため、現在の一次情報として採用していない。

### 5. Drnu（ドクターヌ）（WP 880）

- [Drnu・ドクターヌ 公式サイト](https://drnu-osaka.com/) — 確認日 2026-07-15

- 注記: 公式サイト上部は営業時間11時〜27時、アクセス欄は10:00〜翌3:00（最終受付1:00）と不一致のため営業時間は未確認とした。
- 注記: 公式アクセス欄のAルーム・Bルームはいずれも淀屋橋駅で、堺筋本町駅の出口・徒歩分は確認できなかった。

### 6. FROG SPA（フロッグスパ）（WP 883）

- [FROG SPA 公式サイト](https://frog-spa.com/) — 確認日 2026-07-15
- [料金システム](https://frog-spa.com/system/) — 確認日 2026-07-15
- [アクセス](https://frog-spa.com/access/) — 確認日 2026-07-15

- 注記: 詳細住所は予約後案内のため、公開ページで確認できる町名までを保持する。

### 7. 祇園 the.Mrs 天満橋店（ぎおんザミセス）（WP 885）

- [祇園the.Mrs 公式サイト](https://gion-mrs.com/) — 確認日 2026-07-15
- [料金システム](https://gion-mrs.com/system) — 確認日 2026-07-15
- [アクセス](https://gion-mrs.com/access) — 確認日 2026-07-15

- 注記: WordPressの店舗名にある「天満橋店」は、現在の公式ページでは確認できない。公式ページが掲載する堺筋本町駅の情報だけを採用した。

### 8. ChouChou（シュシュ）（WP 838）

- [ChouChou 公式サイト](https://chouchou-kitashinchi.com/) — 確認日 2026-07-15
- [料金システム](https://chouchou-kitashinchi.com/system/) — 確認日 2026-07-15
- [アクセス](https://chouchou-kitashinchi.com/access/) — 確認日 2026-07-15

- 注記: 公式サイトは複数ルームをまとめて案内している。堺筋本町ルームの駅情報だけを採用した。

### 9. Mrs.FlowerSPA（ミセスフラワースパ）（WP 853）

- [Mrs.FlowerSpa 公式サイト](https://mrs-flowerspa.com/) — 確認日 2026-07-15
- [料金システム](https://mrs-flowerspa.com/system) — 確認日 2026-07-15
- [アクセス](https://mrs-flowerspa.com/access) — 確認日 2026-07-15

### 10. Firstclass（ファーストクラス）（WP 799）

- [ファーストクラス 公式サイト](https://firstclass-osaka.net/) — 確認日 2026-07-15
- [料金システム](https://firstclass-osaka.net/system) — 確認日 2026-07-15
- [アクセス・予約](https://firstclass-osaka.net/access) — 確認日 2026-07-15

- 注記: 詳細住所は予約確定後案内のため、公開ページで確認できる町名までを保持する。

### 11. Karisome（かりそめ）（WP 805）

- [かりそめ別館 公式サイト](https://karisome-bekkan.com/) — 確認日 2026-07-15
- [料金システム](https://karisome-bekkan.com/system/) — 確認日 2026-07-15

- 注記: WordPress登録URL karisome.jp は現在の公式サイトへ転送される。現行公式名がWordPress名と異なるため名称差分は要確認とする。

### 12. 君色ドレスSPA（WP 807）

- [君色ドレスSPA 公式サイト](https://kimiiro-dress.men-este.com/) — 確認日 2026-07-15
- [料金システム](https://kimiiro-dress.men-este.com/system.html) — 確認日 2026-07-15
- [アクセス](https://kimiiro-dress.men-este.com/access.html) — 確認日 2026-07-15

- 注記: 堺筋本町ルームの公開住所は大阪府大阪市中央区まで。フッターの番地は日本橋店のため堺筋本町住所に流用しない。

### 13. milk tea（ミルクティー）（WP 812）

- [ミルクティー 公式サイト](https://osakamilktea.com/) — 確認日 2026-07-15

- 注記: 公式ページは日本橋店表記で、堺筋本町の駅・住所情報は確認できなかった。料金ページは画像中心のため今回の取得経路では金額を一次情報として確定していない。

### 14. Mrs.HOLIC（ミセス ホリック）（WP 815）

- [Mrs.HOLIC 公式サイト](https://mrs-holic.com/) — 確認日 2026-07-15
- [料金システム](https://mrs-holic.com/system) — 確認日 2026-07-15
- [アクセス](https://mrs-holic.com/access) — 確認日 2026-07-15

- 注記: 割引実施中のため、代表料金はページ上の矢印左側に掲載された通常料金から選定した。駅・徒歩分は掲載がなく未確認。

### 15. なにわ女子（WP 817）

- [なにわ女子 公式サイト](https://naniwajoshi.com/) — 確認日 2026-07-15
- [料金システム](https://naniwajoshi.com/system/) — 確認日 2026-07-15
- [アクセス](https://naniwajoshi.com/access/) — 確認日 2026-07-15

### 16. LUXY（ラグジー）（WP 820）

- [LUXY 公式サイト](https://luxy-spa.com/top.php) — 確認日 2026-07-15
- [料金システム](https://luxy-spa.com/system.php) — 確認日 2026-07-15
- [アクセス](https://luxy-spa.com/access.php) — 確認日 2026-07-15

- 注記: 料金は税別表示と税込表示が併記されているため、支払額となる税込値を保存した。徒歩すぐは分数へ推測変換しない。

### 17. Un Secret（アンスクレ）（WP 826）

- [Un Secret 公式サイト](https://unsecret-osaka.com/top.php) — 確認日 2026-07-15
- [料金システム](https://unsecret-osaka.com/system.php) — 確認日 2026-07-15
- [アクセス](https://unsecret-osaka.com/access.php) — 確認日 2026-07-15

- 注記: 徒歩すぐは分数へ推測変換しない。

### 18. VISCONTI（ヴィスコンティ）（WP 828）

- [VISCONTI 公式サイト](http://www.menseste.jp/) — 確認日 2026-07-15
- [ご利用料金](http://www.menseste.jp/price.html) — 確認日 2026-07-15
- [サロンのご紹介](http://www.menseste.jp/salon.html) — 確認日 2026-07-15

- 注記: 詳細住所は予約後にSMSまたはLINEで案内すると明記されている。料金の金額部分は画像中心で取得できず、推測せず未確認とした。

### 19. CLUB LEGGENDA（クラブレジェンダ）（WP 794）

- [CLUB LEGGENDA 公式サイト](https://club-leggenda.com/) — 確認日 2026-07-15
- [料金システム](https://club-leggenda.com/system/) — 確認日 2026-07-15

- 注記: ページ上部・下部の現行営業時間16:00〜翌5:00を採用。古いイベント本文の16:00〜翌4:00は採用しない。

### 20. C.r.e.a.m（クリーム）（WP 795）

- [C.r.e.a.m 公式サイト](https://www.cream-osaka.com/) — 確認日 2026-07-15
- [公式トップ掲載の料金案内](https://www.cream-osaka.com/) — 確認日 2026-07-15
- [アクセス](https://www.cream-osaka.com/access.html) — 確認日 2026-07-15

- 注記: 詳細住所は予約時案内。公式トップの割引イベントから、矢印左側に掲載された通常料金を保存した。

### 21. Sanando（サナンド）（WP 747）

- [Sanando 公式サイト](https://sanando.jp/) — 確認日 2026-07-15
- [料金システム](https://sanando.jp/system/) — 確認日 2026-07-15
- [アクセス](https://sanando.jp/access/) — 確認日 2026-07-15

- 注記: 公式アクセスは日本橋店の住所・駅のみ。堺筋本町の駅情報として流用しない。新規割引は代表料金から除外した。

### 22. こころのゆりかご（WP 763）

- [こころのゆりかご 公式サイト](https://kokoronoyurikago-osaka.site/) — 確認日 2026-07-15
- [ご予約](https://kokoronoyurikago-osaka.site/reservation.html) — 確認日 2026-07-15

- 注記: 料金・電話・アクセスは画像中心で、今回の取得経路では文字として確定できなかった。画像から推測せず未確認とした。

### 23. ゆだねて（WP 775）

- [ゆだねて 公式サイト](https://www.yudanete.com/) — 確認日 2026-07-15
- [料金システム](https://www.yudanete.com/system.html) — 確認日 2026-07-15
- [アクセス](https://www.yudanete.com/access.html) — 確認日 2026-07-15
- [予約フォーム](https://www.yudanete.com/reserve.html) — 確認日 2026-07-15

- 注記: 共通ヘッダーは営業時間10:00〜2:00だが、アクセスページの堺筋本町ルームは10:00〜3:00。対象ルームの値を採用し差異を保持した。

### 24. アヌSPA（WP 779）

- [アヌSPA 公式サイト](https://anuspa.club/) — 確認日 2026-07-15
- [料金システム・ご利用方法](https://anuspa.club/system.html) — 確認日 2026-07-15

- 注記: LASTの具体時刻は掲載されていないため空欄。詳細住所は予約成立後のSMSで案内。料金表は画像中心のため金額は未確認。アクセスページは谷町九丁目駅だけで、堺筋本町駅は未確認。

### 25. The.gloss（ザ・グロス）（WP 715）

- [The Gloss 公式サイト](https://gloss-osaka.com/) — 確認日 2026-07-15
- [料金システム](https://gloss-osaka.com/system/) — 確認日 2026-07-15
- [アクセス](https://gloss-osaka.com/access/) — 確認日 2026-07-15

- 注記: WordPressで公式URLが空だったため、店名・電話・営業時間が一致する現行公式サイトを採用した。新規割引額は代表料金に使わない。

### 26. 桃源郷（とうげんきょう）（WP 716）

- [桃源郷 公式サイト](https://tougenkyou-osaka.com/) — 確認日 2026-07-15
- [料金システム](https://tougenkyou-osaka.com/system/) — 確認日 2026-07-15
- [アクセス](https://tougenkyou-osaka.com/access/) — 確認日 2026-07-15

- 注記: 公式アクセスは出口を掲載しているが徒歩分数は掲載していない。

### 27. プレミアム離宮（WP 700）

- 採用できる一次情報なし

- 注記: 一次情報となる現行公式サイトを特定できなかった。WordPress登録値と第三者掲載値は確認済み値へ昇格せず、すべて未確認として保持する。

### 28. UNION＋（ユニオンプラス）（WP 717）

- [UNION＋ 公式サイト](https://union-plus-es.com/) — 確認日 2026-07-15
- [料金システム](https://union-plus-es.com/price) — 確認日 2026-07-15
- [アクセス](https://union-plus-es.com/access) — 確認日 2026-07-15
- [ご予約](https://union-plus-es.com/reserve/) — 確認日 2026-07-15

- 注記: 新規割引・事前予約割引等は代表料金から除外した。

### 29. Queen Spumante 長堀橋店（クイーンスプマンテ）（WP 701）

- [Queen Spumante 公式サイト](https://queenspumante.com/) — 確認日 2026-07-15
- [料金システム](https://queenspumante.com/system/) — 確認日 2026-07-15
- [アクセス](https://queenspumante.com/map/) — 確認日 2026-07-15

- 注記: LASTの具体時刻は掲載されていないため空欄。WordPressで公式URLが空だったため、店名・電話・対象ルームが一致する現行公式サイトを採用した。

### 30. VIO:V（ヴィオーヴ）（WP 719）

- [VIO:V 公式サイト](http://www.viov.jp/) — 確認日 2026-07-15
- [料金表](http://www.viov.jp/price.html) — 確認日 2026-07-15
- [サロン紹介](http://www.viov.jp/salon.html) — 確認日 2026-07-15

- 注記: 詳細住所は予約時にSMSで案内。料金表は画像だけで金額を文字として確認できないため未確認とした。

## 反映前の停止状態

- WordPress更新: 対象外・未実施
- ローカルSupabase非公開draft投入: 2回実行・検証済み
- 本番Supabase非公開draft投入: 未実施
- Supabase公開切替: 未実施
- push: 未実施
- deploy・本番公開: 未実施
- 次の工程: ローカル検証済みSQLを人間確認し、別承認後に本番Supabaseの非公開テーブルへ投入する。公開参照先の切替はさらに別承認とする。
