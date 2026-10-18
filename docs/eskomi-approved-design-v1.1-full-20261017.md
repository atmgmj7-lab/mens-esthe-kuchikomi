# Eskomi 総合実装設計・最終承認案
v1.1　2026年10月17日　設計のみ／最終承認前
## オーナー確認用まとめ
目指すのは、関西のメンズエステについて実体験と正確な店舗情報から比較し、公式LINE等へ進める口コミ媒体です。収益は有料掲載と独立した広告枠。評価や口コミの真実性を販売せず、成果報酬やサイト内予約は初期に追加しません。
利用者は登録・追加認証なしで、店舗と任意のセラピストを1回で評価。店舗は担当のリンク入りお礼文をコピーし、普段のLINE・メールで案内します。投稿前に公開範囲を知らせ、低評価も同じ基準で審査し、特典も評価の高低で変えません。
無料掲載に口コミ依頼リンク・案内文コピー・QR/POP・自店HPのwidget・アクセス報告を含める方針です。人物登録・返信・クーポン管理は初期無料枠へ加える提案で、永久無料や現在提供中を確約しません。特典の原資は店舗が負担します。セラピストは公開名と写真を中心に軽く登録します。店舗情報の変更は申請、運営管理画面からは追加・変更・掲載停止・復元可能削除を直接行います。
最終基盤はSupabase＋Vercel。WordPressの店舗ID・添付IDを実行時に必要としません。既存URL・画像・口コミを確認して移行し、旧WP IDは任意の照合情報だけにします。既存を一括で捨てて作り直す計画ではありません。
## この一式で最終確認する案
入力→確認の2画面、アイボリー/ネイビーの画面、B01〜B10バナーと設置先、情報交換欄、初期の情報充実順、保管期限・コード再表示方式を一括で確認します。細かい追加質問を途中で重ねず、実装担当が選べない事項を下記の提案値として示します。
推奨：人物登録は店舗による権利確認と安全検査、口コミ・返信・情報交換は公開前に運営確認。IP照合7日・ブラウザ照合14日は暫定設計値。特典は店舗が条件を設定し運営確認後に有効化、初期無効。金額・割引率・期限を全店舗一律で作りません。コード再表示は第7章の短期暗号化方式Cを採用案とし、鍵管理の安全確認前は本番発行しません。
## 進め方と未確認事項
今は設計・画像・配置の承認資料を作成する段階です。実用性を優先した改訂バナーと本版の提案範囲を最終確認し、承認後は実装と試験→プレビュー確認→対象差分を示した本番承認の順で進めます。既に判断できる項目を細かく再質問せず、本版の初期提案値を一括で示します。実schema等は技術確認し、実店舗の特典条件など未確定の機能は無効状態で作成できます。設計承認だけで本番DB移行・認証変更・公開まで進めません。
10月末の「新大阪 メンズエステ」「堺東 メンズエステ」1〜5位を目標にしますが、順位や無欠陥は保証できません。最新GSC/GA4、本番DB全体、受入試験完走は未確認です。スパワールド／メンズリゼの復元可能削除は未実行です。設計優先の最新指示で実行を停止し、完了扱いにしません。
---PAGE---
# 1 承認と実装開始条件
## G0 要件確定
画面・バナー・データ・導線を含む本版を一括で最終確認します。現在は設計のみです。承認後に実装とプレビューへ進み、本番反映は別途承認を得ます。
## G1 デザイン承認
2026年10月17日の追加指定により、A案の柔らかいアイボリーとB案の分かりやすい手順を組み合わせる方針へ更新しました。純粋なA案選択より本指定を優先します。背景は#F7F5EF、情報カードは白、主要ボタンは#17283B。白を画面全体に広げず、手順の帯は淡い色で区別します。見出しを小さく、改行しない指定も維持します。画面タイトル18px、セクション見出し16px、カード見出し14px、本文14〜15px、補足12px、ボタン文字14px・高さ46px以上を基準とします。
320px幅では左右22pxの余白を引いた276px、390px幅では346pxに見出しが1行で収まるよう、長い文言を自然に短縮します。「担当を確認」「投稿を受け付けました」「特典を適用しますか？」「使用済みのコードです」「口コミで分かるお店」などを使用。nowrapによるはみ出し、省略記号、読みにくい縮小で隠しません。本文や説明は適切に折り返します。
2026年10月17日の最新指定で、入口の3択と独立した投稿先確認画面を廃止します。リンクを開くと「1 / 2 入力」から始まり、店舗名と担当人物の写真・公開名をフォーム上部に表示します。人物専用リンクは担当を事前選択しますが、評価は事前選択しません。変更や「セラピストの評価を外す」は小さな補助操作にし、進むための必須分岐を作りません。店舗の一般リンクでは、フォーム内に「担当セラピスト 任意」を表示し、未選択でも送信できます。
「2 / 2 確認」で公開される内容と対象を確認して送信し、完了画面に受付状態と適用条件を満たす特典を表示します。「公開口コミとしてEskomiや店舗HPに掲載される場合があります」と投稿前に明示し、非公開アンケートと思わせません。人物評価を省略しても、同じ対象条件であれば特典を減らしません。
最新指定は業務導線の変更を含みます。お礼文の作成D08、自店HP用widget D09も確認対象です。色合いはアイボリーと白いカード、短い見出し、ゴシック系の読みやすい本文・数字を維持します。本版の画面を確認してから実装へ進みます。
## G2 技術事前確認
本番migration履歴、実テーブル、権限、公開API exposure、read source設定、店舗対応関係を読み取りで照合します。値や秘密を文書に貼らず結果だけを記録します。
## G3 公開条件確定
特典の提供主体、負担、内容、期限、利用店、取消条件、表示、プライバシー・保存期間を承認します。未決の特典は無効状態で実装できても、本番発行しません。
## G4 検証合格
既存機能回帰、権限、競合、移行、画面、SEOを検証します。必須試験に未確認・失敗があれば昇格しません。
## G5 本番承認
対象SHA、migration一覧、設定差分、試験結果、切戻し手順を固定し、対象を明示して公開します。G1だけでG3やG5まで承認されたとは扱いません。

---PAGE---
# 2 現行の確定事実と不足
## コードと直接HTTPで確認したこと
現行main SHAは78d7e06046953b493ec690231fede121cba0211a。投稿、審査、再送防止、管理店舗CRUD、QR・POP・案内文・widgetはコードにあります。人物対象・別集計、特典・私的控えの分離、情報交換は追加範囲です。
10月17日17:06〜17:08 JST、4地域URLのHTTP 200・自己canonical・noindexなしを確認。SSR先頭10カードの代替画像は新大阪3、堺東2、梅田9、大阪10。hubの初期7件では2、2、7で、8〜10件目は折りたたみ内。全店欠損率やブラウザ画像通信失敗率ではありません。
梅田の掲載順は現行コードの意図した分岐です。厳格なinformationOrderは新大阪・堺のみ。大阪は24件を取得後、ページ内の既存比較と順位番号を使います。誤デプロイとは扱いません。
## 現況と最終構成を分ける
現況はSupabase書込みとWP併用read、WP ID依存のPartner入口が混在。最終構成はSupabase＋Vercelのみで、公開店舗・口コミ・資産・認可は正規IDで解決し、WPの店舗/添付IDを要求しません。旧WPデータは権利・状態・URLを照合して移し、確認前に消しません。
画像fallbackはfeatured/ACF欠如、数値media未解決、不適切URL等を個別確認。通常imgのためNext Imageのhost設定を代用せず、取得/表示URLと権利の検証を設けます。対象外業態候補は公式根拠と正規IDで確認し、名称だけの一括削除はしません。2件はprivate.managed_shopsに存在せず、現行archive APIが必要とするmanaged ID/revisionに未対応でした。クラウド環境には認証済み管理画面接続もなく、削除未実行、DB/API/WP書込み・アプリ変更・移行・公開変更なしです。
本番DB/RLS、全レコード、最新GSC/GA4は未確認。初回3検査スクリプトは依存不足で未実施でした。その後のクラウド確認でmanaged source・native review repository・Partner widgetの読取契約検査は通過しましたが、全E2E完了ではありません。監査v2の根拠と第22〜26章の受入条件を実装環境で再検証します。

# 3 データ共通規約
E01〜E32は論理データと責務の辞書であり、新規物理表32個を必須としません。既存レビュー・冪等性・監査・資産を優先再利用し、G2で物理対応を確定します。enumはCHECKまたはenum型をmigration内で一貫使用します。
新規IDはサーバー発行UUID。時間はtimestamptz UTC、画面と営業日集計はAsia/Tokyo。金額はJPY整数円、率は0〜1、評価は整数1〜5です。未知・対象外はnullと理由で保持し、0と混同しません。
FKは物理削除をRESTRICTする案です。状態変更と履歴で運用し、履歴を消すCASCADEは採用しません。全更新にrevision整数とupdated_atを付け、expected_revision不一致は409とします。
以下の名前は追加候補です。既存表との最終対応はG2で確定します。private表はブラウザ直接参照不可。公開projectionもサーバーの限定readを通し、未承認・非公開情報を返しません。

---PAGE---
# 4 正規店舗と人物の構造
## E01 正規店舗（既存app.shopsを再利用）
既存app.shops.idを永続的な正規IDに固定し、別の正規店舗UUIDを増設しません。以下は論理契約で、列名・状態列の実在をすべて確認済みという意味ではありません。G2で既存列との対応を確定し、不足分だけ追加します。
id uuid PK／status enum(active,unlisted,archived)／canonical_path text unique／revision bigint >=1／created_at,updated_at timestamptz。
## E02 旧IDと管理投影の対応（既存列を優先）
private.managed_shops.app_shop_id UUID nullable UNIQUE FK app.shops(id)を追加する最小案。wp_post_id、既存slug、canonical_pathは任意の旧参照です。generic mapping表を必須にせず、既存列で一意性を確保します。既存店は旧ID・slug・canonicalの確認済み対応だけbackfillし、一つでも不一致なら隔離。新店はWPキーなしでapp.shopsとmanaged投影を同transactionで作ります。店名類似では統合せず、既存canonical変更は別承認。directory_idを認可の正本にしません。
## E03 partner_workspace_shop_links
workspace_id uuid PK/FK existing partner_workspaces／identity_id uuid unique FK E01／state(active,suspended)／verified_at。
private.partner_workspacesへnullable shop_id FK app.shopsを追加し、既存workspaceを再作成せず移行します。E03の別表新設は必須にしません。現行1人1workspace制約を勝手に多店舗対応へ拡張しません。
## E04 therapists
id uuid PK／status(active,inactive)／created_by_workspace_id uuid／created_at。実名、電話、勤務時刻を持たず、自動名寄せしません。
## E05 therapist_assignments
id uuid PK／therapist_id uuid FK E04／shop_identity_id uuid FK E01／display_name varchar(40)／photo_asset_id uuid FK既存資産または適応表／state(draft,active,ended,hidden)／valid_from,valid_to timestamptz／revision bigint／permission_confirmed_by uuid／permission_confirmed_at timestamptz／permission_policy_version text。
同一人物・同一店舗の有効期間重複は禁止します。別店舗で同じ名前でも別人として扱います。今回の店舗操作は自店内登録・終了まで。他店との統合、移籍時の評価引継ぎは運営手続きに留め、自動処理しません。
写真と公開名を投稿前に確認します。最終承認案は店舗による掲載同意・使用権の確認と安全検査で登録し、人物プロフィールだけの一律運営事前承認は追加しない方式です。レビューと店舗返信の初期承認とは別判断です。新写真は安全な資産処理を通し、同意撤回時は公開写真を停止。過去版の監査情報は非公開で扱い、歴史的写真を無条件に公開し続けません。
## E06 review_entry_links
id uuid PK／public_handle uuid unique nullable／visit_token_hash bytea nullable unique／shop_identity_id FK／assignment_id nullable FK E05／kind enum(permanent,visit)／channel(pop,line,email,website,general)／state(active,revoked)／expires_at nullable／consumed_experience_id nullable unique／created_by_workspace_id／created_at。
常設の店舗/人物案内には再利用可能なpermanentを使います。お礼文も再利用可能な常設リンクを使います。最新指定により、初期の不正対策は第21章の補助的な確認フラグとし、一回招待は後続の選択肢に戻します。permanentではpublic_handleを必須、visit_token_hashはnullとします。公開handleはランダムな案内IDで、閲覧と審査付き投稿の入口だけを与えます。編集、顧客情報閲覧、クーポン利用、来店確認の権限は与えません。既存campaignの公開UUIDと同様に保存し、自店管理画面で繰り返しコピーできます。私的な認証秘密ではないため、この常設リンク再表示だけのために暗号鍵や秘密回復機構を増やしません。
同じworkspace・店舗・所属・channelの有効permanentは一つとし、一般店舗用のassignment=nullも部分一意制約で重複させません。既存campaignはresolverでE01へ照合し、URLとtokenを維持します。新しい人物リンクのパスは既存ルートとの衝突をG2で確認したうえで /r/{public_handle}/ に統合する案です。
visit採用時はpublic_handleをnull、visit_token_hashを必須にし、期限付き一回利用を別ルールにします。GET・プレビューで消費しません。承認済み設定で有効化するまでvisit発行を拒否します。名称visitは内部型であり、来店を検証したという表示に使いません。
人物リンクは写真・公開名をフォーム内へ事前表示するだけです。同じ店舗内の変更、人物評価の省略を許します。リンクを知っていることを来店証明にせず、URLに来店者名・連絡先・来店日時を入れません。退店した人物を勝手に別人へ置き換えず、店舗だけの投稿へ進めるかをその場で案内します。

---PAGE---
# 5 体験と評価の構造
## E07 review_experiences
id uuid PK内部／shop_identity_id FK E01／assignment_id nullable FK E05／subject_snapshot jsonb(schema_version,shop_name,assignment_public_name,assignment_revision)／entry_link_id nullable FK E06／origin enum(general,store_link,therapist_link)／submitted_at／form_version text／consent_version text／benefit_disclosure_version nullable text／state(active,withdrawn,quarantined)。
snapshotはサーバー生成し、クライアント入力の店舗・人物名を正本にしません。実名、電話、メール、会員IDは新規項目にしません。既存任意email等を移行時に無断消去・公開しません。
## E08 review_revisions
id uuid PK／experience_id FK E07／revision bigint／nickname varchar(30) nullable／experience_comment varchar(400) NOT NULL DEFAULT 空文字／moderation_state(pending,changes_requested,approved,rejected,spam)／submitted_at／reviewed_at nullable／unique(experience_id,revision)。
全変更を新しい版にします。承認した版を本文上書きで変更しません。共通の任意コメントを1欄だけ設け、E08へ保存します。対象ごとに本文を重複入力させません。既存のlegacy本文は失わず移行対応を記録します。
## E09 review_assessments
id uuid PK／review_revision_id FK E08／subject_kind(shop,therapist)／assignment_id nullable／overall_score smallint nullable／overall_unrated_reason nullable／unique(review_revision_id,subject_kind)。
shopではassignment_id=null、therapistではE07と同じ所属IDを必須にします。人物の評価は任意で、未選択・省略は0点扱いにしません。共通コメントは店舗の体験口コミとして表示し、人物ページには人物の構造化評価と「この店舗での体験コメントを見る」リンクを示します。店舗への批判を人物の感想本文へ自動転用・分割しません。確認画面で店舗の本文と人物の評価の公開先を分けて示します。
## E10 review_answers
assessment_id FK E09／question_id text／score smallint nullable／option_code text nullable／unrated_reason enum(not_used,not_known) nullable／PK(assessment_id,question_id)。
rating5はscoreまたはunrated_reason、agreement3はoption_codeまたはunrated_reasonの適切な1種類だけを保存するCHECK。scoreは1〜5、option_codeは定義済み値のみ。項目はform_versionごとにサーバー検証し、未知項目を拒否します。店舗のみを許可します。人物付きは2セクションを保持し、店舗が全項目判断不能でも人物に有効回答があれば送信可とする提案です。総合点が未回答でも、定義済みの具体的なカテゴリ回答があれば体験回答として扱います。全セクション判断不能なら受付せず、体験項目を選び直します。店舗評価を人物0点に変換しません。
## E11 review_publications
public_review_id uuid PK内部IDと別生成／experience_id FK E07／active_revision_id FK E08／publication_state(unpublished,published,hidden)／published_at nullable／hidden_at nullable／public_version bigint／unique(experience_id)。
1体験に公開ID1つ。対象別APIは安全なprojectionだけを返し、公開IDから非公開版や編集秘密を取得できません。
## E12 review_edit_receipts
id uuid PK／experience_id FK E07／secret_hash bytea unique／created_at／expires_at／revoked_at nullable／scope固定(edit_own,withdraw_own,appeal_own)。
公開IDとは別の秘密です。店舗のクーポン照合APIでは返しません。期限・紛失対応は第7章とC05の承認で確定します。
## E13 moderation_events
id uuid PK／entity_kind(review,reply,profile,benefit)／entity_id uuid／revision bigint／action enum／reason_code text／operator_actor text／request_id uuid／created_at／details jsonb最小。append-only。
共有Basic Authでは個別操作者を識別できない限界を明示し、初期単独運営者として記録します。複数運営者への展開時は個別認証を別途承認します。
## E14 review_reply_revisions
id uuid PK／public_review_id FK E11／workspace_id FK／revision bigint／body varchar(500)／state(draft,pending,approved,rejected)／created_at／unique(public_review_id,workspace_id,revision)。
公開返信は別projectionで承認版のみ。店舗は口コミ本文や評価を編集せず、返信と違反報告だけ可能です。初期は人物本人のログイン・返信を作りません。

---PAGE---
# 6 クーポンと再送の構造
## E15 benefit_programs
id uuid PK／shop_identity_id FK／assignment_id nullable FK／state(draft,active,paused,ended)／current_version integer／created_by_workspace_id FK／revision bigint。
初期は店舗単位の1種類とし、人物評価の有無で特典を変えません。人物への適用は後続で条件を決めるため、初期active化ではassignment_id=nullを必須にします。提供主体・負担者は別項目で確定します。
## E16 benefit_program_versions
program_id FK E15／version integer／PK(program_id,version)／title varchar(60)／benefit_kind(amount_off,percent_off,other)／amount_yen integer nullable／rate decimal nullable／cap_yen integer nullable／minimum_spend_yen integer nullable／terms_text text／issuer_label text／funding_party_label text／valid_from,valid_until timestamptz／redeem_valid_days integer／redeem_deadline timestamptz nullable／combinable boolean／eligibility_version text／approved_at nullable／approved_by nullable。
valid_from/valid_untilは発行開始・終了です。利用期限とは分けます。expires_at=min(issued_at+redeem_valid_days, redeem_deadlineがあればその日時)で発行時に固定します。
割引率は0より大きく1以下、金額・上限・最低利用額は0以上。対象と条件をサーバー検証し、未承認・矛盾した条件はactiveにできません。変更は新しい版とし、既発行コードは発行時の版を参照。法的条件の確認はG3で行います。
## E17 benefit_codes
id uuid PK／program_id,program_version 複合FK E16／source_experience_id uuid unique FK E07／shop_identity_id FK E01／assignment_id nullable／code_hash bytea unique／state(issued,redeemed,revoked)／issued_at／expires_at／redeemed_at nullable／revoked_at nullable／revoke_reason nullable。
期限切れはexpires_atと現在時刻から算出し、バッチが走らなくても使用不能です。1体験1コードのuniqueで改版時の二重発行を防ぎます。複数特典の選択・併用は初期に追加しません。
## E18 benefit_redemptions
id uuid PK／benefit_code_id uuid unique FK E17／workspace_id FK／actor_auth_user_id uuid／idempotency_hash bytea／request_fingerprint bytea／redeemed_at／unique(workspace_id,idempotency_hash)。
使用確定は加盟店舗のサインインセッションから認可します。口コミ本文・星・投稿名を照合レスポンスに含めません。
## E19 operation_idempotency
id uuid unique／operation text／actor_scope_hash bytea／key_hash bytea／request_fingerprint bytea／result_entity_id uuid／state(committed)／created_at／PK(operation,actor_scope_hash,key_hash)。
本人情報を表すものではありません。同じキーで別payloadは409。guest operation sessionまたは店舗セッションに束縛し、キーを知るだけで他人の結果を取得できないようにします。
## E20 publication_outbox
id uuid PK／event_kind text／entity_id uuid／version bigint／state(pending,processing,done,failed)／attempts integer／next_attempt_at／last_error_code／unique(event_kind,entity_id,version)。
公開projection・集計・cache再検証の再実行に使います。公開承認と公開反映成功を混同しません。

---PAGE---
# 7 秘密の管理と紛失時の設計判断
公開口コミID、非公開編集控え、特典利用コードは独立した値と権限にします。常設入口は公開の案内IDであり、非公開編集や特典利用の認証秘密とは区別します。コードは128bit以上の暗号学的乱数を推奨し、QRとコピーを主導線にします。短い数字への置換は推測耐性を落とすため行いません。手入力が必要なら紛らわしい文字を除いてグループ表示します。
編集控え・特典利用コードの照合にはサーバー側hashを使います。ただし原文を捨てるだけでは同じコードを再表示できないため、次の方式を比較します。
## 方式A ハッシュのみ
単純ですが、成功応答が失われると元コードを再表示できません。同じ送信に同じ控えを返す要件を満たせないため単独採用しません。
## 方式B サーバー鍵で決定的に導出
同一発行IDから再生成できます。鍵漏えいの影響が大きく、鍵版・ローテーション・失効設計が必要です。既存の安全な鍵管理を確認できれば比較対象にします。
## 方式C 短期の暗号化再送キャッシュ
初期推奨案です。hashを照合用に保持し、成功レスポンスの秘密部分だけ暗号化して短期保存。同じguest operation sessionと送信キーにだけ元レスポンスを返し、期間終了後は原文を復元しません。鍵保管・運用・保持期間の承認を採用条件にします。
通常はSecure・HttpOnly・SameSite cookieで用途・期限を限定します。Cookie無効時は同一originのcontext応答で返す高エントロピーな一時credentialをページメモリに保持し、専用headerで送ります。サーバーはE24のhash・scope・期限、Origin/CSRFを照合します。fingerprintを代替認証にせず、idempotency keyだけでは結果へアクセスできません。同じページでの通信再試行は同じcredentialを使いますが、タブ閉鎖・再読込で失うため24時間以内でも復元を保証しません。受付後の編集控え・特典コードは別の権限として利用者に保存を案内します。AES-GCM相当の認証付き暗号を使い、鍵はDBやブラウザに置かず、復号は限定サーバー処理だけに許可します。鍵の追加設定は別の承認対象で、本版では実行しません。
## 方式D 保存した控えから再発行
編集用秘密から旧未使用コードを失効し、新コードを発行する方式です。編集権限が特典再発行へ拡大し、店舗混乱と競合が増えるため初期は採用しません。
## 利用者への案内
完了画面でクーポンと編集控えを別に保存するよう案内します。LINEやメールは本人が共有ボタンで自分へ保存する範囲を基本とし、送信先を自動取得しません。すべて失い本人を確認できない場合は自動復旧しません。
同一人物を識別しないため一人一回を保証しません。保証対象は1体験1発行・1コード1使用です。

---PAGE---
# 8 投稿と審査の状態契約
## 受付の成立
ブラウザdraftは受付前です。JSON、CSRF、対象、中立的必須回答、重複・頻度制限をサーバー検証し、DBへ永続化が成立した時点を受付とします。ページ閲覧や下書きでは特典を発行しません。
valid submissionの同一DB transactionでE07〜10、E19、必要ならE17を保存し、来店別E06を同時消費します。常設リンクは消費せず、採用した一回招待は受付成功時だけ消費します。外部AIやメール送信をtransaction内に置きません。初回201、同一操作の再送200で同じ受付結果を返します。
commit済みの冪等性記録は最新contextの失効判定より先に確認します。同じsession・キー・payloadの既commit結果は再送期間内に返し、失効したcontextから新しい投稿へ変換しません。
受付送信時に発行期間・条件版・対象の変更を再確認。古い特典条件なら409 CONTEXT_CHANGEDと再確認画面に戻します。店舗名・写真の変更は対象を再確認し、対象自体の変更・失効なら新規書込みを行いません。

## 審査と公開
revision単位でpendingからapproved、changes_requested、rejected、spamへ進みます。再提出はrevision+1のpending。公開中の通常訂正では旧公開版を残し、新版承認後にactive_revision_idを原子的に切り替えます。個人情報露出など危険がある場合は、運営が理由を記録して即hiddenにする別操作を設けます。
approvedは公開許可です。公開projectionとoutboxを同transactionで記録し、cache反映状態は別に表示します。古いrevisionの承認は409。未承認版を一覧・widget・構造化データ・集計へ出しません。
取り下げは有効な編集控えまたは運営の正規手続きでhiddenへ。店舗に低評価の削除操作は与えません。審査理由はprivacy、target_mismatch、spam、duplicate、unsupported_claim、prohibited_content等と自由記載を持ち、low_ratingを理由にしません。異議申立ては別eventとして記録します。

## 特典と掲載停止
特典は有効受付時点で発行し、星や公開承認を待たせません。低評価、批判、取り下げ自体を取消理由にしません。不正・重複等の取消には事前表示した中立条件、理由、権限、監査を必須とし、審査結果で使用済みコードを自動復活させません。
掲載停止・archivedでは新規投稿と発行を止めますが、既発行特典は自動取消しません。既存特典の照合・使用・救済は契約と利用条件に従う別statusで管理し、E01 statusやE15発行stateだけで消込可否を決めません。履行不能なら運営が理由と告知方針を確認して救済します。

---PAGE---
# 9 クーポン使用の状態契約
店舗担当者は、次回予約のLINE・メール等で受け取ったコードをコピーし、管理画面で内容・対象店・期限・未使用を確認します。対面受付やQR読取は必須にしません。照会だけでは使用せず、実際に特典を適用する時点で「使用を確定する」からPOSTします。予約問い合わせの段階では消込せず、取り置き・予約連動機能は初期に追加しません。
サーバーは店舗権限、対象店・人物条件、state=issued、DB現在時刻<expires_atを同じtransactionで検証し、E17更新とE18挿入を確定します。2台同時では成功1件だけ。別キーによる再使用は409 COUPON_ALREADY_USED、同じidempotency keyなら元の成功結果を返します。expires_atちょうどは期限切れ。異なる店舗には詳細を漏らさず404にします。
送信後の通信断は「使用が完了したか確認できません。通信が戻ってから利用状況を再確認してください」と表示し、同じキーで結果を確認します。結果不明のまま新しい使用要求を作らず、特典を重ねて適用しません。
確実に送信前のオフラインなら「通信できないため確定できません」と表示します。店員が口頭で割引したことをシステム上の消込成功に見せません。取消・返金で自動再有効化せず、誤消込の救済は運営の監査付き手続きに限定する案を承認します。

# 10 権限と責任
## 一般閲覧者と投稿者
一般閲覧者は公開版と公開プロフィールだけを読めます。投稿者は有効contextへの送信、自分の編集控えによる新しい版・取り下げ・異議申立てが可能です。
## 店舗
owner/managerはactive membership→workspace→E03→E01で解決した自店だけを操作します。店舗掲載情報の変更申請、人物登録、案内発行、返信申請、コード照会・使用、集約レポートを提供します。人物個人アカウントは初期なし。
人物登録は店舗自己登録＋掲載同意・使用権確認＋安全検査を最終承認案とします。店舗掲載情報の申請、口コミ・返信の手動承認とは区別します。
## 運営
店舗新規追加・直接変更・掲載停止・復元可能削除・復元、投稿・返信審査、違反対応を担当します。従来の「管理者は申請不要、店舗側変更のみ承認」を維持。プロフィールの事前審査は選択された公開方式に合わせます。
## サーバーとDB
限定RPCだけを実行します。service roleをNEXT_PUBLIC、JS bundle、URL、ログに出しません。private表のRLSを有効にし、PUBLIC/anon/authenticatedの直接権限はrevokeする方針です。SECURITY DEFINERは固定search_path、許可対象関数のみとし、PUBLIC EXECUTEをrevokeします。
実権限はG2で確認し、変更は承認済migrationでのみ適用します。DB mutation内でもmembership activeを再確認。画面で自店を表示するだけでは認可とせず、bodyの店舗IDやworkspace IDでセッションscopeを上書きできません。

---PAGE---
# 11 API契約
既存 /api/reviews/submit の互換を維持し、v2は新ルート /api/reviews/v2/submit に分離する提案に統一します。既存クライアントを黙ってv2に変えません。以下は追加候補で、実装前にroute collisionを確認します。
## 投稿context
POST /api/review-context：入口tokenをbodyで受け、公開contextと短期guest sessionを返します。contextは店舗・人物・form_version・benefit_version・expires_atだけ。既存GET /r/tokenは互換resolverとし、秘密を第三者analyticsへ送りません。
## 投稿受付
POST /api/reviews/v2/submit：context_id、form_version、確認したsubject、answers、experience_comment(任意、0〜400)、任意nickname、consent_version。Idempotency-Key必須。201でreceipt_id、moderation=pending、任意coupon、編集控えを返します。対象・回答型・必須・条件版をサーバー検証します。
## 編集用session
POST /api/reviews/v2/edit-session：編集控えをbodyで照合し、短期限cookieへ交換。Cookie無効時は用途を編集だけに限定した一時credentialをメモリ/headerで使い、Origin/CSRFを検証。秘密をURL queryに載せません。
## 訂正と取り下げ
PATCH /api/reviews/v2/receipt：expected_revisionと新answers/experience_comment。新pending版を返し、公開版を直接変更しません。
POST /api/reviews/v2/withdraw：expected_revisionとCSRF。成功202、公開反映状態は別表示。
## 特典照合と使用
POST /api/partner/benefits/inspect：codeをbodyで受け、自店で有効な特典の内容・期限・状態だけ返します。Cache-Control:no-store。本文・点数・投稿者名・編集秘密は返しません。
POST /api/partner/benefits/redeem：codeまたは短期inspection_nonce、Idempotency-Key。原子的に使用確定。nonceがあってもstateと権限を再確認します。
## 返信と審査
POST /api/partner/review-replies：public_review_id、body、expected_revision。自店確認後pending返信を返します。
POST /api/dashboard/reviews/v2/decisions：revision_id、expected_revision、decision、reason。operator+CSRF必須。pendingと公開版を混同しません。
## 公開read
GET /api/public/reviews/v2：subject_type、公開subject ID、cursor、limit(1〜20)。承認済projection、aggregate、source_version、data_as_of、next_cursorを返します。公開IDのみ使用します。
## 共通エラー
400形式不正／401未認証／403認証済権限外／404対象外・秘密不一致／409競合・条件変更／410自分の期限切れcontext／413過大／422項目不正／429頻度超過＋Retry-After／503依存障害。
errorはcode、利用者向けmessage、request_id、任意field_errorsを持ち、内部SQLやtokenを含めません。401/403/404の細分化が対象存在を漏らす場合は404に統一します。

---PAGE---
# 12 集計と公開の契約
## E21 review_aggregates
subject_kind、subject_id、source_version、scope_versionを複合PK。experience_count、overall_count、overall_sum、overall_average nullable、question_stats jsonb、data_as_of、projection_versionを保持します。
公開版の有効回答から全再計算できる構造にします。event再送でcountを足しません。店舗overallは店舗回答だけ、人物overallは人物回答だけ。体験件数はdistinct experience_id、rating項目の母数は当該score not null件数です。
0件はaverage=nullで「口コミはまだありません」。総合点は本人が明示回答した1〜5だけを平均し、未回答の総合点を項目平均から生成しません。カテゴリ回答は割合と件数で示し、星平均へ数値変換しません。
## E22 review_question_definitions
form_version、question_idをPK。subject_kind、label、order、required、answer_type(rating5,agreement3)、allowed_options、allowed_unrated_reasons、activeを保持します。
利用中のform_versionは不変とし、改定は新しい版にします。同じquestion_idを別の意味に再利用しません。
## E23 publication_projections
E11承認版から作る店舗・人物・widget用の安全な読取モデル。内部experience_id、receipt hash、code、本文非承認版、任意email等は返しません。public_versionとdata_as_ofを付けます。
## E24 guest_operation_sessions
id uuid PK／session_secret_hash bytea unique／created_at／submit_context_expires_at／replay_expires_at／revoked_at nullable／context_snapshot jsonb(店舗正規ID,所属IDとrevision,form_version,benefit_version,consent_version)／context_fingerprint bytea。snapshotはサーバー生成。人物変更は新しいcontextを取得し、bodyだけで差し替えません。入力contextと再送権限の期限を分けます。
## E25 operation_secret_replays
id uuid PK／operation_record_id uuid FK E19.id unique／ciphertext bytea／nonce bytea／key_version text／expires_at。
hashは照合、ciphertextは短期再送専用です。方式C採用時だけ有効化します。期限超過後は秘密原文を復元しません。
## E26 legacy_review_aliases
source(wp,native)、source_id textを複合PK／experience_id uuid FK E07／verified_at／migration_batch_id。旧口コミの対応と二重import防止に使います。
## E27 public_reply_projection
public_reply_id uuid PK／public_review_id FK E11／approved_reply_revision_id FK E14／publication_state／published_at／version。承認済返信版だけを公開します。
## 公開ラベル
常設QR・人物リンクは「店舗の案内リンクからの投稿」など確認できる事実だけを表示し、「来店確認済み」「本人確認済み」とは表示しません。登録・台帳がなくても本文や来店時期から人物が推測され得るため、絶対匿名とは説明しません。特典表示は一覧・詳細・widgetで継続し、店舗照合には本文・点数・投稿名を返しません。

## 公開反映と一覧順
公開、訂正承認、非公開、掲載停止で同じentity/versionにつきoutbox 1event。店舗・人物・地域一覧・widget・集計・構造化データ・sitemapのcache tagを再検証します。失敗は指数的再試行、永久失敗は監視へ。再試行で同じ版を二重公開しません。
通常一覧順は現在の契約を維持。評価だけの新しい推薦順位、未承認の最低件数や重み式は公開しません。導入時は母数・期間・算式・同点順・特典付き口コミの扱いを別承認し、PR枠と分離します。店舗順位を上げる約束とSEO目標を混同しません。

---PAGE---
# 13 初期値と設定の判断表
以下は実装用の提案値で、利用者が承認した確定値ではありません。設定を一か所に集約し、画面とAPIの不一致を防ぎます。
## C01 文字数
投稿本文0〜400文字、公開名0〜30文字、店舗返信1〜500文字。Unicode文字数の数え方を共通化し、サーバーも同じ規則を使います。公開名未入力は「利用者」とし、架空氏名を生成しません。
## C02 質問と回答形式
最小構成の承認案は、店舗総合、料金説明、案内と実際の一致、選択時だけのセラピスト総合、共通の体験コメント任意1欄です。店舗総合は1〜5と「判断できない」、人物総合は任意で外せる形とし、評価を事前選択しません。
情報の正確さを確かめる2問は回答を必須とする案です。「料金の説明は分かりやすかったですか」はclear/partly_unclear/unclear/not_used/not_known（説明を受けていないと判断できないを区別）、「案内と実際の内容は合っていましたか」はmatched/partly_mismatched/mismatched/not_knownを使用します。説明を受けていない・判断できないも正規の回答で、肯定的な回答を必須にはしません。
清潔さ、スタッフの応対、一般的な施術への満足等は「詳しく回答する 任意」へ畳みます。カテゴリ回答を星へ変換せず、本人未回答の総合点を質問平均から生成しません。人物評価を省略しても特典条件は変えません。
具体的な体験に基づく有効な評価またはカテゴリ回答が一つ以上あれば受付できる案とし、総合点未回答だけを理由に拒否しません。全項目が判断できない場合は体験対象を確認してもらい、架空の有効回答を促しません。「説明を受けていない」は説明の有無についての具体的な回答として有効であり、一般的な未利用・判断不能と混同して受付を拒否しません。この最小必須項目と文言は画面承認で確定し、承認前に本番規則を固定しないことを公開条件にします。

## C03 入力サイズ
JSON本文最大16KiB、公開read limit最大20。過大入力は処理前に413。口コミ画像添付は初期対象外です。
## C04 写真
既存資産機構を再利用。未設定時の提案上限はJPEG/PNG/WebP、5MiB、最大辺4096px、最大1600万画素です。実デコード・再エンコード・EXIF除去を行い、SVG/HTML/実行形式は不可。既存制約との一致はG2で確認し、権利を外部から自動推定しません。
## C05 入力と再送の期限
方式C採用時の案：入力context30分、再送専用guest session24時間、同一送信の暗号化再送キャッシュ24時間、編集控え30日。30分後は新規投稿不可ですが、24時間内の同一session・キー・payloadの既commit結果は返せます。commit済確認を最新context失効判定より前に行います。
24時間後はコード原文を再表示しません。編集期限は本人へ表示し、期限切れ後は通常問合せへ。本人確認できなければ復旧を保証しません。安全な鍵管理と方式Cの採用が未確定なら、この期限設定も未確定です。
## C06 頻度制限
匿名投稿はHMAC(IP+店舗)で1時間5受付、店舗単位1時間100受付で監視。店舗照合は認証user+workspaceで1分30回、使用確定1分10回を提案します。共有回線の正規客を拒否し得るためパイロットで調整。429と再試行時刻を表示し、無期限fingerprintは作りません。上限によって評価・審査基準を変えません。
## C07 保存期間
短期不正対策HMACは7日、暗号化再送24時間、操作監査365日を提案。公開口コミは公開中保持。非公開版、人物権利記録、特典利用履歴、バックアップは用途別にG3で期間を決めます。未承認の自動削除jobは動かさず、既存記録をこの案で削除しません。
## C08 審査目標
2営業日は運営指標の提案で、投稿者への保証ではありません。遅延時は審査待ちを正しく表示し、自動承認へ切り替えません。
## C09 公開cache
公開readの目標は最大5分。非公開化と訂正は即時invalidate。敏感情報の公開停止は安全なread filterを先に効かせ、cache再検証だけに依存しません。観測で期限を超えたら公開を止めて修正します。
特典金額・内容・最低利用額・負担・併用・期限は、仮の金額で本番設定しません。画面案は「特典内容は店舗設定」等の無効な見本を使います。

---PAGE---
# 14 既存データを守る移行計画
## M01 読取事前確認
remote migration ledger、schema、RLS/grants、Data API exposure、source flag、店舗ID対応、不整合件数を記録します。共有秘密を出力せず、公開画面0件から既存口コミの不在を推測しません。
## M02 追加migration
既存表のrename/dropや上書きをせず、必要なidentity・所属・revision・publication・coupon等を追加・拡張します。RPCと権限を同時管理し、未認証アクセス試験を先に通します。IDを一意採番し、checksumと対象commitを記録します。
## M03 店舗対応のbackfill
WP ID、managed ID、app.shops UUIDの確認済み関係を同じE01へ結びます。店名類似では統合しません。入力件数、対応済み、重複、未対応を保存し、2回目は差分0にします。canonical/slug衝突は人の確認待ち。管理対象になっていない既存legacy店は、既存app.shopsとmanaged管理投影を対応させ全件の管理coverageを作ります。削除目的の取込みではimport-and-publish→停止の既存経路を流用しません。対象ID・expected_revisionを検証し、取込みとarchived状態・監査・public tombstoneを同transactionで確定し、一瞬でも公開する中間状態を作らない専用経路を設計します。表示ソースと管理対象のずれを残さず、旧URLから同じ正規IDへ解決します。公開状態の変更は正規店舗に記録し、legacy readを併用する期間も停止・削除tombstoneを優先します。旧IDは任意の移行aliasとして残せますが、新店舗や通常運用でWP IDを必須にしません。写真は既存app.shop_images、private.managed_shop_assetsと承認済みpublicationsを再利用し、WP添付IDを必須にしません。公開proxyから許可済み画像だけ返し、Storage object keyや私的asset情報を公開しません。
## M04 legacy口コミ対応
source種別＋source review IDを一意キーとしてledgerを作成。WP・nativeに同じ口コミがあれば正本判定まで二重importしません。本文・公開状態・日時を変えず、再審査が必要なケースを別一覧にします。過去の来店確認や特典有無は、不明なら不明と保持します。
## M05 shadow read
既存readを利用者へ返しながら限定データでv2 projectionの対象・件数・公開状態を比較します。本文を外部解析へ送りません。不一致ゼロで切替候補へ。新規口コミ0件を理由にWPへ自動fallbackしません。移行中は比較対象を明示し、最終公開readはSupabaseの正規projectionへ統一します。
## M06 pilot
MrsRankUPの自店権限とテストfixtureで投稿・審査・公開・返信・widget・消込を検証します。実店舗の公開内容に架空投稿を混ぜません。WPなしの新規managed店も独立fixtureで通します。
## M07 段階公開
投稿入口、人物表示、couponを別feature flagにします。旧campaignのresolver互換を維持し、新規店workspaceも正規IDへ解決。全店一斉source切替を初手にしません。
## M08 切戻し
移行中は新規入口とv2 readを止め、検証済み直前版へ戻します。WP依存除去後はSupabase上の前版projection/アプリへ戻し、WPを再び必須にしません。受付・消込済みデータと履歴を保持し、DB down migrationで消しません。発行済み特典の有効性を確認できる救済画面を維持し、使用済みコードを復活させません。最新の審査・取り下げ・掲載停止と消込状態を正本として保持します。legacy/v2共通のdeny/tombstone overlayをreadに適用し、旧readへ戻しても非公開・取り下げ・却下口コミや掲載停止店舗を復活させません。
各Mに実行者、開始・終了、対象SHA、入力・出力件数、差分、失敗、復旧手順を残します。バックアップ取得・復元試験は保存先と権限を確認後に実施します。

---PAGE---
# 15 受入試験一覧
本書作成時点では試験未実施です。設計レビュー、模擬試験、本番確認を別列で記録します。
## 店舗と入力
T01 既存店：WP ID付き既存店QRから正しい店だけに投稿し、承認後公開。
T02 新規店：WP IDなしmanaged店でPartner認可、QR、widget、公開ページが成立。
T03 対象確認：写真・公開名、同名、写真失敗、退店、移籍、店舗のみを確認し誤結合0。
T04 改ざん：他店ID、別人物ID、期限切れtoken、失効membershipを拒否し書込み0。
T05 入力：高・低・混合・判断不能で妥当な受付。同じ対象条件なら特典同一。
T06 下書き：未回答や具体的行為を創作せず、編集文を再生成で上書きしない。
## 再送と審査
T07 冪等性：同一キー・payloadで10並列して体験1件、コード1件。別payloadは409。
T08 来店別招待：採用時は別キー2並列で1受付。GET・プレビュー消費0。常設は複数利用可。
T09 通信断：commit前・直後・response中断で再試行。同じsessionとキーから結果を回復し、二重発行0。期限切れ再送で秘密を新規生成しない。
T10 審査版：古い版承認409、未承認新版の公開0、承認切替は1版。
T11 取り下げ：公開一覧、店舗、人物、widget、aggregate、JSON-LDの残存を確認。
## クーポンと秘密
T12 同時消込：異なる店員2〜10並列で成功1件、redemption1件。
T13 境界：expires_at直前・同時・直後、取消、使用済み、別店舗で正しい結果。
T14 再送：同キー消込は元の成功。別キー再使用409。
T15 秘密：DB平文、ログ、GA、URL query、HTML source、cacheから編集控え・利用コード漏えい0。短期暗号化cacheの無認可復号0。
T16 返信：自店だけ提出、他店返信0、審査前公開0、編集は再審査。
T17 集計：体験の店舗・人物を分離しnull除外。異なるsource混算0、再計算同値、event再送で増分0。
## 権限と回帰
T18 権限：匿名・店舗A・店舗B・失効者・運営matrix。直接RPC・表アクセスも拒否確認。
T19 移行：backfill2回目差分0、旧URL変化0、孤立FK0。ID衝突未処理なら停止。
T20 障害：DB503、cache失敗、outbox再試行、storage失敗で成功偽装0。
T21 UI：320/390/768/1440px、200%拡大、キーボード、長文日本語、数値桁揃え、文字背景コントラスト、横はみ出し0。
T22 SEO：新大阪・堺のHTTP、canonical、robots、sitemap、ItemList、広告表示、review schema母数を公開レスポンスで確認。
T23 回帰：店舗CRUD、掲載停止・復元、管理者直接公開、店舗申請、既存POP/QR/widget。
T24 切戻し：v2入口停止後も既存閲覧正常、発行済み特典・消込履歴を保持。legacy/v2の両readで非公開・取り下げ・却下口コミと掲載停止店舗が再表示されず、最新の審査・消込状態が維持されることを確認。
T25 本番smoke：公開GET、認証、非破壊操作。実投稿・実特典使用は許可された試験のみ。
## 最終整合の確認
T26 context変更：表示後に対象・特典版・発行期間が変わると未確認条件で受付せず409。
T27 掲載停止：新規発行0、既発行コードの勝手な失効0、異店権限拒否。
T28 再送期限：入力context30分後も同じcommitted再送は24時間内なら同結果。24時間後の秘密再発行0。
T29 回答型：カテゴリを星へ変換せず、本人未回答の総合点生成0。
T30 人物公開：登録方式と画面が承認案に一致し、未決の承認工程を勝手に追加しない。
T31 公開ラベル：来店確認済み等の過剰表示0。特典表示を一覧・詳細・widgetで維持。店舗照合に点数・本文・投稿名・編集秘密を返さない。
## お礼文と店舗HPの確認
T32 入口省略：人物リンクも一般リンクも3択gatewayなしで入力へ。店舗だけの投稿、人物変更・省略ができ、人物省略で特典を減らさない。共通コメント1欄で人物への本文自動転用0、確認画面の公開先と実表示が一致。
T33 文面生成：LINE/メール、人物あり/なし、today/recent、特典有効/未設定/停止/期限切れの全組合せを確認。未展開placeholder、誤店舗URL、未承認の特典約束0。offer参照の他店舗・未承認版への改ざんを拒否。
T34 認可：店舗Aのsessionで店舗Bの人物・template・widgetを作成/変更/管理できない。public widgetのshop_id差替えで対象変更0。
T35 コピー：コピー成功/拒否/手動コピーを確認。コピーを送信・送達として記録せず、顧客連絡先・宛先・送信本文の保存0。
T36 常設再利用：同じ人物・channelのリンクを再コピーして同じURL。既存URL失効0、非公開控え/クーポン権限の獲得0。プレビューや再アクセスで招待消費0。
T37 状態変更：文面作成後に退店/掲載停止/特典変更となった場合、投稿先で最新状態と条件を説明。別人物へ自動変更0、低評価だけ特典取消0。
T38 widget母数：3件表示でも総件数・総合回答数は全公開対象から算出。人物点数混算0、同体験重複0、高低どちらも表示。
T39 widgetページ送り：0/1/3/4/7件、同日時、途中取り下げ、他店舗cursorを検証し、重複・他店漏れ・非公開復活0。
T40 widget障害：DB/API/cache失敗で0件へ丸めない。停止店舗を別店舗へ置換しない。復旧時に新しいsource/versionを確認。
T41 配信面一致：公開/訂正/取り下げ/非公開/切戻しで、Eskomi一覧・詳細・店舗widget・平均・件数・JSON-LDの公開対象が一致。特典表示を維持。
T42 embed安全性：第三者cookie無効でも公開readが成立。HTML入力を実行しない。公開レスポンスとHTMLに私的情報なし。正規店舗詳細・投稿リンクが動く。
T43 実務確認：対面受付なしの店舗担当が、人物を選び文面をコピーし、既存連絡アプリへ手動貼付けできる。自店HP管理者が設置コードを貼って自店の公開口コミだけを確認できる。テスト先や投稿は許可された範囲を使う。

T44 ブラウザ識別：同じブラウザの再投稿は確認材料になり、Cookieなし・削除・別ブラウザでも投稿可能。一時credentialで同ページ再試行、再読込でcredential喪失、控えから編集session再取得、他scope拒否を確認。物理端末や本人の証明と表示しない。
T45 重複再送：同じidempotency keyの再送は同じ受付、別の実体験は別投稿として審査可能。GETやリンクプレビューに投稿・特典発行等の副作用0。
T46 公平性：共有IP、再来店、Cookie無効、短時間の高低両評価を比較し、IP一致・低評価だけによる拒否/特典失効0。フラグ理由と運営判断を記録。
T47 情報保護：Cookie値、IPタグ、生IP、私的控えを公開API、widget、GA4、店舗担当向けレスポンスへ漏らさない。信頼しないforwarded headerの偽装を検証。
T48 確認フラグ：一般投稿を含め受付後に中立審査。確認だけで自動不正確定0、追加SMS/SNS画面0、店舗によるフラグ解除0。保存期限と鍵更新の境界を試験。

合格証跡は試験ID、環境、対象SHA、fixture、入力、期待値、実測、日時、担当、添付をセットにします。

---PAGE---
# 16 10月末SEOの具体計画
目標は「新大阪 メンズエステ」「堺東 メンズエステ」で1〜5位。既存 /area/shinosaka/ と /area/sakai/ を対象にします。堺URLを維持しつつ、堺東、堺駅、三国ヶ丘等を正確に区別。URLを変えれば上がるとは仮定しません。

## 計測契約
GSC Search type=web、country=JPN、exact query×exact canonical page、mobile/desktop別。基準・比較期間は同じ日数とフィルター。確定データ最終日を記録し、未確定日や欠測は除外理由を表示します。低頻度の匿名クエリは総数から欠け得ます。最新基準値は未取得であり、空欄を0にしません。
平均掲載順位を主指標として推移を記録しますが、特定地点の検索画面で必ず5番目とは言いません。地点固定観測を使うなら、地点・端末・時刻・ログイン状態を別記録。流入・CTR・LINEクリックは別指標とし、LINEクリックを予約数に換算しません。

## SEO01 10月17日から19日
2URLの本番HTTP、canonical、noindex、sitemap、Google選択canonical、indexを確認し、証拠URLと確認日を残します。技術的失敗を先に修正します。
## SEO02 同期間
料金掲載数と公式確認済み数、更新日の意味、堺ページの制作側説明文を確認。定義を分かりやすくし、GSC基準値と主要流入ページの重複を取得します。未確認の不具合を事実と断定しません。
## SEO03 10月20日から23日
各地域5〜10店から公式料金、コース時間、必須追加費用、駅・徒歩、予約方法、受付条件を一次情報で補充します。未確認は不明とし、出典・確認日を保持。虚偽の最新日を付けません。
## SEO04 同期間
title、H1、導入文を検索意図と実データに合わせます。新大阪と堺東を単語差替えだけの薄いページにしません。ホーム→地域→比較→店舗→公式LINEの主要リンクと、新規managed店舗のsitemap取込みを本番確認します。
## SEO05 10月24日から27日
MrsRankUPで公平な依頼から口コミを収集します。口コミ0件でも料金等の比較を成立させます。モバイルで2店舗比較、対象確認、投稿、LINE遷移の成功率と迷いを記録。架空口コミや肯定回答の指定はしません。
## SEO06 10月28日から31日
同条件のGSC表示回数・クリック・CTR・平均順位を比較。新情報のindexと内部リンクを再確認し、必要URLだけ再クロール申請。審査遅延やindex未反映を記録します。順位未達を実装試験の失敗とせず、次の仮説を根拠付きで作ります。
PRリンクは広告表示と適切なrelを設定。口コミUGCリンクも用途に応じて扱います。相互バナーやwidget大量設置による順位上昇を保証・計画根拠にしません。特典付き口コミは一覧・詳細・widgetで提供者と特典の存在を継続表示します。

---PAGE---
# 17 計測と継続改善
GA4は閲覧→比較→店舗→LINE、GSCは検索語・表示・クリック・indexを確認します。口コミ・クーポン実数の正本はサービスDBの確定イベントです。異なる母集団を足し合わせません。
推奨イベントはreview_context_view、review_subject_confirm、review_form_start、review_submit_success、coupon_issue_success、coupon_redeem_success、shop_compare_add、shop_line_click。成功イベントはサーバー確定後のみ。既存イベントを照合して二重送信を防ぎます。
本文、点数の個人単位履歴、控え、クーポン、名前、IPはGA4に送りません。特典イベントのGA送信は必要性、同意、方針を確認し、初期はDB集計だけでも成立させます。
店舗レポートは自店の閲覧、LINEクリック、受付、公開、特典発行・利用を期間、データ時点、欠測状態付きで表示。小標本で人物を特定できる細分化を避けます。運営は2地域の検索と導線、審査時間、依頼から投稿、改善メモを確認します。
口コミから見つかった案内不一致や清潔さ等を店舗が1件改善し、実施日と内容を記録。後の同じ項目で確認しますが、小標本の変動を因果と断定しません。投稿や審査の操作で星を上げず、改善による正当な評価上昇を目指します。
分析取得は既存サーバー集計を優先し、ChatGPTのMCP接続修復を全機能の前提にしません。定期分析の曜日・時刻・保存先・共有先は別承認で、現在未設定です。認証鍵の新規発行・保存・権限拡大は別の承認対象です。

# 18 実装担当への引渡しと残る承認
本書、別冊D01〜D09、B01〜B10素材カタログと配置案、現行read-only監査、論理データ辞書、API・状態・権限契約、第22〜26章の導線・掲載順・運用項目、M01〜M08、T01〜T56、SEO01〜SEO06を引き渡します。各変更を要件・画面・試験IDへ対応付けてPRに記録し、未承認仕様を自動追加しません。
デザインはAの色合いとBの明確な手順を合わせる指定に更新済み。修正画面を確認します。必須質問、人物登録、コード再表示、保持期間、情報交換、掲載順、バナー配置は本版の提案を一括で最終承認します。特典条件、保持期間、審査目標は本番発行前に確定します。最新GSCとremote DB情報は事前確認で補い、コード差分が確定するまで工数・日程を確約しません。
E01〜E32は論理データと責務の辞書であり、32個の新規物理表を必須にしません。G2後に物理対応表を作り、既存nativeレビュー、冪等性・頻度制限、審査監査、managed revisions、資産機構を再利用します。既存制約が異なる場合は無理な兼用も避けます。
物理化の候補として、E09/E10はE08の検証済みJSONB、E22はversion管理コード、E21/E23はview・RPC・再計算cache、E27は承認版pointerにまとめられます。E19/E20は既存制約を調べ再利用・拡張を判断します。これは決定ではなく不要な表増設を避ける基準です。
実装順は正規ID・認可→ゲスト投稿と公開read→人物確認・別評価→お礼文作成・常設リンク→返信・POP・自店widget→特典→店舗レポート。SEO01〜04は特典完了を待たず並行可能です。段階ごとに承認と試験の停止点を置きます。
二重消込、他店情報漏えい、未承認口コミ公開、既存URL破壊、データ消失は公開停止条件です。旧機能を残した切戻しを試験します。本版は設計承認版であり、本番read source・最新GSCは未確認、受入試験は未実施です。実schema対応、残る仕様承認、migrationと試験実装が完了する前に「本番実行準備完了」とは扱いません。

---PAGE---
# 19 お礼文作成と自然な口コミ依頼
## 店舗の実務を起点にする
受付がない店舗でも、利用後の既存LINE・メールでお礼と口コミ依頼を送れる形を主導線にします。新しい送信先一覧、会員情報、顧客台帳、メール/LINEの接続設定を作りません。初期操作は「担当を選ぶ」「文面をコピーする」を同じ画面にまとめ、LINE/メールの選択と文面確認は同じ画面内で行います。担当の初期値を前回利用者から勝手に引き継がず、店舗全体用を安全な既定値とします。
D08では自店名と担当の写真・公開名を表示します。担当が分からなければ「指定しない」のままで店舗リンクを使えます。担当を選ぶと当該所属が投稿先として設定され、お客様は名前を打ち込まずに回答できます。人物案内handleとお礼文のリンクは再利用します。顧客ごとの招待作成や「次のお客様用」操作は初期に要求しません。送信先・メールアドレス・電話番号の入力欄はありません。
## 作成とコピー
LINEは本文、メールは件名と本文を別々にコピーできます。プレビューで店舗、担当、公開口コミの依頼であること、リンク、現在適用可能な特典条件を確認します。「文面をコピー」はコピー成功だけを示し、送信済みとは表示しません。最後の貼付け・宛先確認・送信は店舗が普段のアプリで行います。最初の実装でAPI送信、定期送信、顧客リスト取込み、メール開封追跡を追加しません。
テンプレートは店舗側で作れる機能としますが、初期は自由な差込言語を作らず、LINE/メールの標準文と、任意の挨拶・締め文各300文字を保存できる構成にします。公開範囲、評価の中立性、特典条件の説明はサーバーが付ける共通部とし、消せない形にします。顧客名や来店日時の差込みはなく、個別の情報は既存の連絡アプリで必要な範囲だけ追記します。
## 特典付きと特典なし
下記の特典付き文面は、店舗が負担・提供主体・金額等を承認し、条件版が有効な場合だけ利用可能です。未設定・停止・期限切れなら特典段落を出さず、特典なしの標準文になります。『次回割引』を設定なしに約束しません。人物への回答を省いても、低評価でも同じ条件です。体験回答が永続保存され条件を満たした時点で発行し、口コミの公開審査とは別に扱います。
メールやLINEのコピー済み文面は後から回収できないため、特典付きリンクには公開のprogram IDと条件版を持つoffer参照を付ける案とします。顧客や来店日時の情報は付けません。常設handle自体を維持します。サーバーはofferの店舗一致・承認・期間・条件を検証し、別店や未承認の特典へ書き換えた要求を拒否します。コピー時には条件版と利用期限・適用上の主要制約を短く表示します。既に案内した条件を停止する場合は、投稿先にも変更理由と代替案を表示し、条件を黙って不利に変えません。来店ごとの宛先管理は行わないため、誰に旧文面を送ったかはEskomiでは分かりません。この限界を店舗向けヘルプに記載します。
## LINE向け標準文
本日はご利用ありがとうございました。
よろしければ、お店と担当セラピストのご感想をお聞かせください。会員登録は不要です。セラピストの評価は省略できます。
こちらは公開口コミの投稿ページです。内容は確認後、Eskomiや当店ホームページに掲載される場合があります。
{{review_url}}
{{benefit_block}}
率直なご感想を、今後のご案内やサービスの改善に活かします。
## メール向け標準文
件名：ご利用ありがとうございました｜{{shop_name}}
本文：
本日は{{shop_name}}をご利用いただき、ありがとうございました。
よろしければ、お店と担当セラピストについてのご感想をお聞かせください。会員登録は不要で、セラピストの評価は省略できます。
口コミはこちら：{{review_url}}
ご投稿は公開口コミとして受け付け、内容の確認後、Eskomiや当店ホームページに掲載される場合があります。
{{benefit_block}}
評価の良し悪しにかかわらず、率直なご感想をお待ちしております。
{{shop_name}}
## 特典段落の生成例
『対象条件を満たすご投稿で、次回ご利用時の{{benefit_title}}をお受け取りいただけます。評価の内容やセラピスト評価の有無で特典は変わりません。主な条件：{{benefit_conditions_summary}}。詳しくは投稿ページをご確認ください。』
{{benefit_title}}と{{benefit_conditions_summary}}は承認済み条件から生成します。条件要約は発行受付期間・利用期限の決め方・最低利用額や対象コース等の主要制約を省かず、未確定なら特典付き文面を作成しません。期限や適用対象を隠して『必ず割引』とは書きません。特典なしの場合は段落ごと省略します。人に渡す完成文に未展開の{{...}}を残さず、render検証に失敗したらコピーを無効にします。
『本日は』は標準文の初期値です。後日送る際には同画面で『先日は』へ切り替え可能とし、来店日そのものは保存しません。通常のやり取りに合わせた丁寧な例文であり、既存の店舗文面の言い回しまで確認済みという意味ではありません。
## 間違いと失敗への対処
担当を間違えたらフォーム内で変更・省略できます。人物が退店していれば、別人物へ自動差替えせず、店舗の口コミのみ書ける案内を出します。店舗自体が掲載停止なら受付を停止します。コピー前に対象店舗・担当を常時表示し、過去の担当を勝手に初期選択しません。
コピーAPIが使えない端末では、読み取り専用テキスト欄から手動コピーできます。自動メール作成やアプリ起動を無理に行いません。既存アプリの誤った宛先まではEskomiで検知できないため、『貼り付け先のお客様と担当をご確認ください』を短く表示します。送信確認、送達、開封は取得しません。
## E28 message_template_preferences
論理設定としてworkspace_id、channel(line,email)、greeting_variant(today,recent)、intro_text(0〜300)、closing_text(0〜300)、template_version、revision、updated_atを持ちます。PKはworkspace_id+channel。顧客名、送信先、来店履歴、送信済み本文は保持しません。既存workspace設定に格納できれば物理表を増やしません。コピーした文面全体をアクセスログに残さず、template_version・channel・成功/失敗だけで診断します。
render時に自店と有効所属をサーバーで照合し、保存済み挨拶と共通文を結合します。URLはサーバーが正規ホストから生成し、自由入力のリンクを差込値にしません。HTMLやコードの実行、評価指定や特典条件の改変につながるテンプレート構文を許しません。

---PAGE---
# 20 店舗ホームページの無料口コミウィジェット
## 役割と範囲
店舗は自店のホームページに、Eskomiで承認・公開された自店の口コミを表示できます。Eskomiの地域・全体ページでは各店舗の公開口コミを扱います。店舗のwidgetに他店の口コミを混ぜず、管理画面で任意の他店舗IDへ変更する機能を出しません。無料提供の初期機能とします。
D09で自店のプレビューと設置コードを表示し、『設置コードをコピー』を主操作にします。自店HPへの貼付けは店舗またはHP管理者が行います。初回は既存のiframe方式を優先し、WordPress専用プラグインや外部送信サービスの契約を要求しません。既存widgetの有効URLを互換維持し、WP IDなしのmanaged店も正規店舗IDで照合します。
## 表示内容
店舗名、店舗全体の総合評価と回答数、最新の公開口コミ、Eskomiの店舗口コミページへのリンク、口コミを書くリンクを表示します。総合点は本人が回答した店舗総合だけから算出し、人物の点数を足しません。総合未回答があれば『口コミ○件、総合評価○件』の母数を区別します。
初期は最新3件を表示し、次の3件へページ送りできる案とします。並びは初回公開日時の降順と公開IDの安定順で固定し、好評価順だけを選ぶ機能、店舗が都合の悪い投稿だけ隠す機能は作りません。サーバー上の審査・非公開状態は全配信面で一致させます。店舗が人物評価欄を省略しても店舗口コミ自体は同じ基準で表示します。
投稿が特典対象だった場合は、本文付近に『投稿特典の対象となった口コミ』と提供者を分かりやすく表示します。本文を短くする場合でもこの表示を省略しません。詳細を開くとEskomiの同じ公開口コミへ進めます。出典ロゴは控えめにし、読める文字と余白を優先します。
## 正常ゼロ件と障害
公開口コミがない場合は『まだ口コミはありません』と投稿リンクを表示し、架空の星や点数を出しません。通信障害時は『口コミを読み込めませんでした』と再読み込み・Eskomiへのリンクを表示します。障害を0件と表示しません。以前のデータを表示する場合は時点を示し、非公開化を取りこぼした古い内容は返しません。
店舗の掲載停止は公開widgetを停止表示にし、他店舗へ置換しません。人物の非公開・投稿取り下げ・審査取消は、本文、件数、平均値、ページ送りの対象から除外します。legacyへ切り戻してもdeny/tombstone overlayを維持し、取り下げた口コミを復活させません。
## 認可と公開API
設置用公開handleはworkspaceの正規店舗にサーバー側で束縛します。public embed URLは公開情報のreadだけを許し、店舗sessionや顧客認証を持たせません。URLのshop_id、subject_id等で対象店を上書きできません。公開handleを第三者が転載する可能性はあり、他ドメインへの転載防止を完全保証しません。初期はprivate情報を一切返さない設計で守り、許可ドメイン制限は必要性を確認して後続判断とします。
embedはnoindexとし、公開店舗・口コミURLへ適切にリンクします。非公開版、編集控え、クーポンコード、来店者の連絡先、管理用IDをレスポンスやHTMLへ含めません。第三者cookieを必須にせず、iframe内で管理者ログインを要求しません。
既存iframeのsandbox・CSP・外部リンクの動作を確認し、必要以上の権限を付けません。任意HTMLを受け取らず、本文をテキストとして安全に描画します。外部リンクはHTTPSの正規Eskomi URLから生成します。hostページでの高さ調整は固定・レスポンシブを初期案とし、新規postMessage連携を増やす場合はorigin/送信元/メッセージ型を検証します。
## E29 review_widget_settings
論理設定としてworkspace_id、shop_identity_id、public_handle、state(active,paused)、page_size=3、theme=eskomi_light、revision、updated_atを持ちます。既存のwebsite campaignと設定を再利用し、新規表やsecret回復機構を必須にしません。店舗に公開範囲の篩い分けや評価下限を設定させません。
readレスポンスはshop、items、review_count、overall_rating_count、overall_average nullable、next_cursor、source_version、data_as_of、statusを持ちます。cursorは対象handle・並び・ページ境界に束縛し、他店舗のcursorを拒否します。対象が途中で非公開になった場合は最新の公開条件を再適用し、旧ページの口コミを復活させません。
## SEOとの関係
店舗HPで実際の口コミを確認し、Eskomiの店舗ページへ移れることが主な価値です。widget設置による順位上昇や星付き検索表示は保証しません。店舗自身のページへ埋め込むwidgetを使って自己評価のリッチリザルトを得られると案内せず、構造化データは掲載面とGoogleの条件を別途検証します。相互リンク量を増やすための強制設置を条件にしません。

---PAGE---
# 21 追加認証を求めない重複確認
## 最新の方向性
2026年10月17日の最新指定を優先し、会員登録、SMS/SNS認証、一回招待の発行操作を初期必須にしません。店舗は同じ店舗・人物専用リンクを既存LINEやメールで案内し、お客様はそのまま回答します。裏側で重複傾向を確認し、運営が確認するための印を付けます。以下の保存期間と閾値は実装提案であり、未承認の自動削除や新規認証を実行しません。
## 何が分かり、何が分からないか
host-only、Secure、HttpOnly、SameSite=Laxの署名付きランダム一次Cookie（認証権限なし）で、同じブラウザからの再投稿らしさを確認します。物理端末IDではなく、Cookie削除、別ブラウザ、別端末で変わります。サーバーで取得するIPはVPN、共有Wi-Fi、携帯網で共有・変化します。粗いブラウザ区分も本人確認にはなりません。これらだけで同じ人、来店済み、店舗による偽装とは断定しません。
端末fingerprint、Canvas/音声/フォント一覧の採取、連絡先の収集、永続的な横断行動追跡は初期に追加しません。Cookieが無効でも投稿を受け付け、識別不能を不正扱いしません。
## 最小の保持情報
署名付きランダムなfirst-party Cookie、IPの鍵付き短期照合タグ、粗いブラウザfamilyとmobile/desktop区分、受付日時、対象の正規店舗、運営確認の理由コードを使う案です。論理fieldはbrowser_tag、ip_tag、ip_key_generation、browser_family、device_class、risk_reason_codes、risk_checked_at、expires_atを提案し、既存の非公開受付・監査情報へ集約します。IPはHMACで処理し、単純hashにしません。IPタグ7日、ブラウザ照合14日を候補としますが、保持期間は未承認です。既存記録を自動削除する指示ではありません。CDNや配信基盤の生IPログは別途保持設定を確認します。生IPを口コミDBやGA4へ保存せず、任意のX-Forwarded-Forではなく信頼できる配信基盤からの値だけを採用します。照合タグは匿名性を保証するものではないため、アクセス権と保持期間を制限します。店舗の画面・widget・公開APIにはこれらを返しません。
## 確認フラグと中立審査
同じブラウザでの短時間の繰返し、同じIPタグでの急増、類似文の集中等を運営の確認材料とします。同じIP一件だけ、低評価だけ、人物評価の省略だけで拒否しません。再来店、同居人、共有端末も正常例として試験します。高評価と低評価に同じ基準を適用します。
通常の受付は保存し、公開前の運営審査でフラグを確認します。フラグ自体は不正確定・自動非公開・特典失効を意味しません。明確な連打への技術的な通信制限は独立した保護とし、同じ送信の再試行は既存idempotencyで同じ受付に戻します。
## 店舗による大量作成への限界
店舗も別ブラウザや別回線を使えるため、追加認証なしで偽装を完全に防ぐことはできません。投稿の偏りや類似文を人が確認し、違反申告・異議申立てと合わせて判断します。店舗管理セッションと同じブラウザであっても、不正を断定せず運営限定の確認材料にとどめます。店舗本人が自分の確認フラグを解除したり他者の端末情報を見たりする権限は与えません。
一般投稿も初期には勝手に廃止せず、招待経由との表示・審査方針は承認時に確定します。表示は必要なら「店舗からの案内リンク経由」とし、「来店確認済み」「本人確認済み」は使いません。実際の誤検知と確認負担を測り、後続の強化策を判断します。一回招待は店舗側の任意運用として引き続き検討可能ですが、採用は未承認であり、今回の基本フローに追加しません。

---PAGE---
# 22 サイト全体のページ・導線
既存は読取監査で確認した経路、予定は本設計で追加する経路です。予定URL・anchorは実在するリンクとして告知せず、実装時に重複と権限を確認してから確定します。
## 利用者向け
/（既存）：地域選択・店舗検索・口コミ比較。主役は検索と比較。大きな営業バナーを先頭に置きません。
/area/shinosaka/、/area/sakai/（既存）：重点比較。堺URLを維持し、内容は堺東の対象と堺駅等を区別。その他 /area/{slug}/ と /area/osaka/ は同じ比較項目・欠損表示・順序説明を共有し、都道府県カードのレイアウトは維持。
/shops/{slug}/（既存）：公式情報と確認日、店舗口コミ、人物一覧、公式LINE等。#reviews、#therapists、#owner は予定anchor。単なるリンククリックを予約成立と数えません。
/reviews/submit/（既存）：一般入口は店舗選択。/r/{public_handle}/（既存互換）は店舗・任意人物を事前選択して入力へ直行。評価は初期未選択。確認→受付控え。編集と特典は私的な別権限。
/therapists/{id}/（予定）：公開名・使用許諾済み写真・所属・本人対象の評価。共通の利用体験本文は店舗ページへリンクし、店舗への不満を人物の言動へ誤帰属させない。
/review-policy/（予定）：投稿・審査・特典表示・広告と通常順位の違い・訂正/異議窓口。
店舗詳細 #correction と地域/店舗 #community（予定）：非公開訂正、情報交換を別フォームで開く。口コミの3択入口を復活させず、ページ上の目的別リンクから進む。
## 店舗・運営向け
/storelisting/（既存）：掲載/情報変更申請、店舗画像・バナー・説明入力、誰でも取得できる相互バナー。#benefits、#banners、#apply は予定anchor。
/partner/guide/（既存）：導入の案内。#requests、#coupons、#widget、#replies、#therapists は予定anchor。利用可能状態を表示。
/partner/growth/（既存）：お礼文コピー、口コミURL、POP、widget。セラピストと特典設定の追加部分は予定。ログイン後は自店だけ。
管理ダッシュボード（既存・実配備pathをG2で確認）：全店舗の追加/直接編集/公開/停止/復元可能削除、店舗からの変更申請、人物・口コミ・返信・訂正・通報の処理。公開URLを推測して案内しません。
/advertise/（予定）：広告募集。条件未確定なら問い合わせ案内のみで、金額や順位効果を約束しません。
## 主導線の完了条件
店舗：担当選択→お礼文をコピー→既存LINE/メールで手動送付。顧客の宛先台帳なし。利用者：リンク→入力→確認→受付。一般投稿も同じ審査。運営：受付→確認→公開→店舗の改善と公開情報更新へ。提供中と告知する各機能は、実配備URLと認可・保存・公開まで通ったものだけ。

---PAGE---
# 23 情報交換と訂正の契約
## 3種類の内容
体験口コミは既存E07〜E14へ。一般入口と店舗案内をprovenanceで区別し、来店確認の証明とは扱いません。本文任意・人物任意・評価中立を維持。
非公開訂正は既存申請へ追加可能か確認。情報交換は別データで、星、口コミ数、特典、通常順位へ加算しません。「正確さを確認していない利用者同士の情報交換」と表示しますが、違法・有害内容を放置する免責文にはしません。
## E30 store_correction_requests（論理）
id UUID／shop_identity_id FK／field_key enum(name,category,price,hours,access,official_url,image,other)／proposed_value 1〜1000字／source_url nullable HTTPS 2048字／state(received,reviewing,applied,closed)／operator_reason 0〜1000字／revision／created_at,resolved_at。連絡先は必須にしません。任意URLは安全検査し、サーバーが任意URLへ自動アクセスする実装を避けます。反映は管理者だけ。申請そのものを公開しません。
## E31 community_posts（論理）
id UUID／scope_kind(shop,area)／shop_identity_id nullable／area_id nullable／body 1〜400字／revision／moderation(pending,approved,rejected)／publication(draft,published,withdrawn)／created_at,published_at／private_receipt_ref／reason_code。対象FKは一方だけ必須。削除済み対象は投稿不可。本文はplain text、初期は画像添付・多段返信・外部リンク自動リンク化なし。公開前運営審査を推奨し、公開済み承認版だけ表示。
## E32 community_reactions（論理）
post_id FK／browser_tag／value(like,dislike)／updated_at／unique(post_id,browser_tag)。一投稿へ一反応、変更・解除可能。Cookie無効時は閲覧と投稿を妨げず、反応のみ重複制御不能を説明して無効化する案。ブラウザ識別は人数の証明でなく、再設定で重複し得ます。14日後のタグ失効で過去投票を本人に結び直せないため、初期案は反応集計も直近14日分と明示。永続の累積人数とは表示しません。
## API・権限・公開
予定POST /api/corrections、POST /api/community/posts はCSRF・idempotency・制限付き受付。POST /api/community/posts/{id}/reaction はvalueまたはnullとexpected_revisionで変更・解除。期限内の同ブラウザ状態を返し、認証済み本人とは呼びません。公開GETは承認済み本文・公開ID・表示用日時・直近反応合計だけ。店舗は通報できても削除・反応編集不可。運営だけ審査、判断理由を監査。私的控えで自己取り下げ、紛失回復の限界は口コミと同じ。
投稿は新着順。通報・異議申立てを用意し、個人特定、脅迫、差別、根拠のない重大な断定、露骨な性的内容、違法行為の勧誘、スパムを制限。低評価だけを削除理由にしません。初期は地域/店舗内の補助欄とnoindexの試験用一覧で検証し、投稿個別indexや空ページ量産は行いません。

---PAGE---
# 24 掲載順・画像・地域品質の最終提案
## 現行と変更案
現行の新大阪・堺は厳格な情報順、梅田は掲載順、大阪は24件取得後の既存比較。初期改修は実順に合う説明と順位番号の意味を整えます。以下は新しい全体比較式の承認案であり、未適用です。
R1 候補：公開中かつ対象業態が確認済みで対象地域に属する店舗。対象業態不明は確認待ち一覧で扱い、名称だけで除外しません。PRは独立枠。店舗と人物を混ぜません。
R2 地域関係：その地域内の店舗を先、隣接地域は別セクション。推測の住所・駅は使いません。
R3 情報点：料金・時間単位/追加費用、営業時間、アクセス、公式連絡/予約先の4項目を各0/1点。正式な出典と現在値の一致、180日以内の確認を満たす時だけ加点。最大4点。180日は提案値で、公開前に基準を一括承認します。画像、紹介文の長さ、広告契約は加点しません。
R4 同点：4項目のうち有効な確認日で最も古い日が新しい店→店名の正規化順→正規店舗IDで安定化。欠測日を今日に置換しません。比較は候補全体へ適用してからページングし、ページ内だけの順位を全体順位のように見せません。旧手動順位は通常順から外し、編集部おすすめが必要なら別枠・根拠表示とします。
表示名は「確認済み情報の充実順」。情報点と確認日、未確認項目を説明できる形にします。現在の新大阪・堺の式も変更候補に含むため、承認なしで置換しません。
## 口コミが増えた後
通常順を投稿数や平均点へ自動切替しません。全店に公開口コミ件数と総合回答数を分け、0件なら平均なし。レビュー順の追加は、対象地域で総合点付き承認口コミ5件以上の店舗が3店以上、かつ地域合計30件以上になった時に提案できる、という検討開始条件を置きます。これは信頼性の証明ではありません。採用する場合も別の選択式並び順とし、少数店を平均点だけで勝たせない補正・特典表示・不正確認の仕様を別承認します。初期の通常順へ星・量・いいねを加点しません。
## 写真と業態の品質
SSR代替画像、元データなし、URL不正、読込失敗、権利未確認を別分類。画像は店舗提供・使用許諾・出典を確認しSupabase資産へ保存。生成した雰囲気画像を実店舗写真として使いません。対象外候補は公式根拠とIDを確認して個別判断。スパワールド／メンズリゼは削除未実行。設計確定後、正規管理対応と権限を確認して復元可能な状態変更を行います。
地域比較項目・見出し・本文サイズ・欠損状態を共通化し、都道府県カードのレイアウトを保持。4地域の表示、検索・詳細・sitemap・JSON-LD・widgetの公開対象を一致させます。目標は画像が豊富に見えることより、正しい店を迷わず比較できることです。

---PAGE---
# 25 バナー10種類・改訂コピーと配置
旧v1バナー画像・コピーは承認対象から外し、本章のv2制作案へ置き換えます。画像枚数やページ上の設置数を増やす変更ではありません。抽象的な「口コミ活用」ではなく、機能と使う理由を示します。店舗向け、利用者向け、広告募集の3対象を維持します。
## B01〜B10の対応（リンクは設置案）
B01「お店を無料掲載しませんか」：口コミ依頼リンク／口コミQR・POP／自店HPに口コミ表示の3特典。CTA「無料掲載の特典を見る」。既存/storelisting/予定#benefitsへ。3機能の無料範囲・資格・実動作を確認。人物・返信・クーポンを提供済み無料特典へ混ぜません。
B02「お礼の一通で口コミをお願い」：専用リンク入り文面をコピーし、普段のLINE・メールで店舗が送る。CTA「案内文の作り方を見る」。/partner/guide/予定#requests、認証後既存/partner/growth/。自動送信・顧客台帳ではありません。
B03「次回予約で使える特典コード」：口コミ受付後にコード発行、LINE・メールで確認し、実際に特典を適用した時に使用確定。CTA「クーポンの仕組みを見る」。guide予定#coupons。未提供・初期無料枠への追加案。特典内容・原資は店舗が用意し、星で条件を変えません。予約問合せだけで消込しません。
B04「お店のホームページに口コミを表示」：公開された自店口コミを手で書き写さず掲載。CTA「ホームページでの表示を見る」。guide予定#widget。自店の承認公開分のみ、取り下げと更新の反映まで検証。無料方針あり。
B05「口コミにお店から返信」：お礼や回答を元の口コミと一緒に伝える。CTA「返信の表示を見る」。guide予定#replies。未提供・初期無料枠への提案。運営確認後公開で、即時公開や低評価削除をうたいません。
B06「担当セラピストの感想も、一度に」：お礼メールの専用リンクから店舗と担当の口コミをまとめて受付。CTA「担当別の口コミの集め方を見る」。guide予定#therapists。未提供・初期無料枠への提案。登録名・写真はフォームの担当確認に使い、人物の広告枠や出勤表ではありません。人物評価は任意、店舗と別集計。
B07「閲覧とLINEクリックを確認」：店舗ページが見られた数と公式LINEへのクリックを確認。CTA「アクセス報告の内容を見る」。guide予定#reports。無料方針あり、実動作未確認。期間・時点・欠測・自店権限を確認し、予約/来店数とは呼びません。旧B07掲載方針は通常のテキストリンクへ移します。
B08「料金と口コミを比べて選ぶ」：関西の地域から店の情報を比較し公式連絡先へ。CTA「エリアからお店を探す」。既存地域選択欄または地域限定の既存/area/shinosaka/等へ。架空の料金・星・順位・サイト内予約完了を描きません。
B09「感想や情報の訂正を送る」：利用した感想は口コミ、掲載情報の違いは運営への非公開訂正。CTA「口コミ・情報訂正の入口へ」。店舗詳細予定#contributeから既存投稿と訂正フォームへ。一般投稿の必須3択を追加せず、情報交換は別の小さなリンクにします。
B10「関西でお店を探す人に、広告でご案内」：地域ページ等の広告場所・サイズを相談。CTA「広告掲載について相談」。予定/advertise/へ。無料特典とは別、料金・枠・相談先の確認後に掲示。通常順位や口コミ評価を売る表現は使いません。
## 制作・公開条件
実寸・ファイル名・承認状態はv2画像カタログへ対応付けます。素材は承認用デザイン案であり公開済みの機能ではありません。4:1は表示目標とし、実画像の比率と切抜き検証を別記録。既存ロゴ原本がなければ生成で代用しません。SPは独立構図または読みやすいHTML見出し・CTAを組み合わせます。
1ページに主案内1本＋控えめな案内1本を目安とし、10本を全ページへ並べません。入力・確認中は営業表示なし。通常一覧とPRを混ぜず、検索/比較を邪魔しない下部、店舗詳細の運営者案内、フッターを使います。提供状態・対象権限・遷移先の実在・内容一致を確認し、未提供機能の「使える」コピーを公開しません。QRは資料の見本であり、実装時は検証済みURLを用います。
正本コピーは「エスコミ バナー10本 改訂コピー案」。無料掲載特典を見せた後に申込へ進む導線とし、機能の説明なしに申込だけを求めません。コピー案と画像案の制作は承認資料の範囲で、アプリ実装・本番公開は別段階です。

---PAGE---
# 26 運営項目・承認単位と最終検証
## 店舗情報の入力辞書（追加・変更で共通）
name 1〜100字、description 0〜2000字、area_id/アクセス0〜500字、hours0〜300字、price_summary0〜500字、official_url/booking_url HTTPS各2048字、phone0〜30字、banner_asset_id/image_asset_idは正規資産ID。事実のsource_url、verified_at、verified_by、verification_stateを運営側に保持。sourceと権利の未確認を任意のtrueで店側が上書きできません。
店舗は自店の表示項目と素材を変更申請。運営は全店へ直接反映可能で、revisionと監査を必須にします。公開/停止/復元可能削除/復元を別状態とし、削除理由と日時を保持。所有権・地域ID・広告区分・確認済み根拠・通常順位の変更は運営のみ。新規申請だけでworkspaceを所有させません。
写真はasset_id、保存先、mime/bytes/width/height、rights_basis、提供元、同意版、処理状態を保持。画像検査・メタ情報除去・安全な再エンコードを通し、WP添付IDなしで成立。外部URLを取り込むなら認可したhost・サイズ・redirect・private networkの境界を検査し、無断スクレイピングをしません。
## 特典の設定
店舗がtitle、提供内容、利用条件、発行期間、利用期限、対象店、負担者、併用条件を入力し運営確認。amount_yen/rateは選択した型でのみ必須。API・DBのrateは0より大きく1以下で統一し、UIの%はrate×100として表示・入力変換。100をrateとして送る誤単位は拒否。amount_yenとrateの混在や負数を拒否。既定disabled。公表した条件版を発行コードに固定し、後から既発行分を黙って不利に変更しません。値未設定のまま『次回割引がもらえる』を告知しません。
## 一括承認に含める提案と公開時の停止点
本版承認対象：画面とB01〜B10配置、質問2項目、人物登録の軽い権利確認、運営事前審査、初期比較式、反応直近14日、IP7日/ブラウザ14日、方式C、特典既定無効。実装担当が勝手に選ばず、最終確認でまとめて採否を記録します。
公開時に別途必要：実際の特典条件、プライバシー/必要な同意、保存と削除の運用、鍵の安全な設定、移行件数/差分、権限と全試験、公開SHAと切戻し、本番承認。必要な認証設定を設計承認で代替しません。
## T49〜T56 追加受入
T49 非公開訂正の受付/運営反映/他店権限なし。T50 情報交換の審査・通報・自己取り下げ・未承認漏れ0。T51 反応変更/解除/14日期限/同時更新/タグ漏れ0、星と口コミ件数へ混入0。
T52 画像と対象業態の候補表・権利・正規ID照合、名称だけの一括削除0。T53 R1〜R4の全体比較後ページング・同点安定・PR分離・画像/広告/反応で加点0。T54 全10バナーの役割/提供状態/リンク/PC-SP/頻度、入力画面の営業表示0。
T55 WP接続・WP ID・添付IDなしで新店作成、写真、投稿、審査、公開、widget、停止/復帰が完走。既存URL・画像・口コミの移行差分を確認。T56 管理者直接CRUDと店舗申請・版競合・復元可能削除、未承認本番変更0。
本版の証跡は設計と読み取り確認であり、T01〜T56の試験完了ではありません。承認後に実装・プレビューで検証し、失敗・未確認を残したまま完成と報告しません。

---PAGE---
# 付録 A 追加管理API
## AP11 人物登録
POST /api/partner/therapists：display_name(1〜40)、photo_asset_id、permission_policy_version、permission_confirmed=true。所属店はsessionから生成。201でtherapist_id、assignment_id、state、revision。承認済み公開policyに従い、未確定なら有効化しません。
## AP12 人物更新と終了
PATCH /api/partner/therapists/{assignmentId}：expected_revision、display_name/photo_asset_id/rights変更。他店差替え不可。終了はPOST /end。過去レビューsnapshotを変更しません。
## AP13 案内リンク
POST /api/partner/review-links：kind=permanent、channel、任意assignment_id。workspaceと店舗はsessionから解決。同じ店舗・人物・channelの有効な公開handleを返します。無意味な再発行・旧リンクの失効を行いません。公開handleは案内と審査付き投稿だけの識別子で、private編集や特典消込に使えません。自店以外のリンク管理を拒否し、visitは承認済み設定が有効になるまで422とします。
## AP14 特典条件
POST /api/partner/benefit-programs とPATCH /{programId}：対象、条件、金額・率、発行期間、利用期限、併用、負担・提供主体、expected_revision。初期draft、変更は新version、active化はG3確認済版だけ。create/activateにIdempotency-Key必須。
## AP15 特典承認
POST /api/dashboard/benefit-programs/{id}/approve：program_version、expected_revision、確認理由。operatorのみ。承認と発行期間の両方を満たして開始し、支払いを実行しません。
## AP16 異議申立て
POST /api/reviews/v2/appeals：receipt session、review revision、reason(1〜400)。自分の対象だけ。同じ未処理異議の二重登録を抑止し、受付状態を返します。自動再公開しません。
## AP17 店舗レポート
GET /api/partner/reports：period=7|28。DB日付範囲、GA4/GSC各データ時点、指標、statusを返します。workspaceはsession由来で他店指定拒否。外部顧客情報は含めず、期間末は確定済み日まで。
## AP18 消込結果回復
GET /api/partner/benefits/operations/{requestId}：自workspaceの既知操作だけを照会。通信断後の結果回復用で再消込しません。
## AP19 お礼文の作成と設定
GET /api/partner/review-request/templates：自店設定と標準template_versionを返す。PUT同パス：channel、greeting_variant、intro_text、closing_text、expected_revisionを保存。workspaceはsession由来で固定し、連絡先等のfieldは受け付けません。
POST /api/partner/review-request/preview：channel、任意assignment_id、greeting_variant、希望するbenefit_version任意。対象・条件をserver照合し、subject、body、review_url、template_version、benefit_status、warningsを返すだけです。外部メール/LINE送信は行いません。標準部とURLはserver生成し、不正な差込みや対象不一致は422/404、版変更は409。完成文のログ保存を禁止します。
preview成功後、完成した常設リンク付き文面をコピーできます。コピーのたびに招待や顧客レコードを作りません。クライアントのコピーイベントは送信記録ではありません。

## AP20 widget設定と公開read
GET /api/partner/review-widget：自workspaceへ束縛されたpreviewとembed_codeを返す。PATCH：stateと許可された表示設定、expected_revisionのみ。shop_id差替え、評価下限や好評価のみ設定は受け付けません。
GET /api/public/review-widget/{public_handle}?cursor=...：handleから店舗をserver解決し、第20章の公開read契約で返す。public handleは管理更新権限を持ちません。既存 /partner/widget/{token}/ は互換resolverとして同じ公開条件を通します。

## AP21 重複確認情報
POST /api/reviews/v2/submitの受付時にサーバーが補助シグナルを評価します。クライアントがIPタグや不正確定値を指定するfieldは受け付けません。一般の受付レスポンスに理由や照合IDを返しません。運営の既存審査readへrisk_reason_codesと確認状態を追加し、店舗権限では取得不可とします。運営判断は既存審査操作と監査履歴へ記録し、独立した顧客台帳APIを作りません。

公開案内handle、編集控え、特典利用コードのscopeを共用しません。公開handleから非公開情報は取得できず、private編集sessionでクーポン再発行もできません。

# 付録 B 参照資料
技術根拠：現行監査commit 78d7e06046953b493ec690231fede121cba0211a、v0.4確認文書。
消費者庁 ステルスマーケティングQ&A
https://www.caa.go.jp/policies/policy/representation/fair_labeling/faq/stealth_marketing
消費者庁 景品Q&A
https://www.caa.go.jp/policies/policy/representation/fair_labeling/faq/premium/other
Google Maps 投稿ポリシー
https://support.google.com/contributionpolicy/answer/7400114
Google Search レビュー構造化データ
https://developers.google.com/search/docs/appearance/structured-data/review-snippet
Search Console 指標
https://support.google.com/webmasters/answer/7576553?hl=en
Google 再クロール
https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
本書は技術設計であり、個別条件の法的適合や検索順位を認定するものではありません。特典条件の確認はG3、公開レスポンスの検証はT22で行います。



最新監査：2026-10-17-area-page-cold-start-and-review-flow-readonly-audit.md 第2版。Cookie属性はMDN HTTP Cookies、個人関連情報は個人情報保護委員会FAQを参照。識別子の法的位置づけ、必要な表示・同意は実装前に確認します。

正規店舗の追加根拠：2026-10-17-wp-independent-canonical-shop-design.md 第1版。既存app.shops UUID、managed app_shop_id、workspace shop_id、資産proxy、対象2件のmanaged記録不在とarchive未実行を照合。本総合設計を最終要件の正本とし、技術メモのsubject単一化・一律事前承認・バナー10枠案はそのまま採用しません。
