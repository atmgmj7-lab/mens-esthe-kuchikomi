"use client";

export function PartnerPopActions() {
  return (
    <div className="hl-partner-pop__actions">
      <button type="button" className="hl-partner-home__primary-action" onClick={() => window.print()}>
        印刷する・PDFで保存する
      </button>
      <a className="hl-partner-home__text-link" href="/partner/growth/pop/preview.svg/" download="eskomi-review-pop-preview.svg">
        確認画像（SVG）をダウンロード
      </a>
    </div>
  );
}
