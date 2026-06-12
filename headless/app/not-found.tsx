import Link from "next/link";

export default function NotFound() {
  return (
    <main className="es-page">
      <div className="empty-state">
        <h1>ページが見つかりません</h1>
        <p>URLを確認するか、トップページから探してください。</p>
        <Link className="btn" href="/">
          トップへ戻る
        </Link>
      </div>
    </main>
  );
}
