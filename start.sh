#!/bin/bash
# mens-esthe-kuchikomi 開発サーバー一括起動
# 起動後: http://localhost:3333 でAgent Foundation + Dashboardが使えます

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Agent Foundation + Dashboard 起動 ==="
echo ""

# Next.js dev サーバー（バックグラウンド）
echo "[1/2] ダッシュボード起動中 (localhost:3000)..."
cd "$ROOT/dashboard" && npm run dev > /tmp/dashboard.log 2>&1 &
DASHBOARD_PID=$!

# Flask サーバー（フォアグラウンド）
echo "[2/2] Agent Foundation 起動中 (localhost:3333)..."
echo ""
echo "  ブラウザで開く: http://localhost:3333"
echo "  終了: Ctrl+C"
echo ""

cleanup() {
  echo ""
  echo "終了中..."
  kill $DASHBOARD_PID 2>/dev/null
  exit 0
}
trap cleanup INT TERM

cd "$ROOT/agent-foundation" && python3 server.py
