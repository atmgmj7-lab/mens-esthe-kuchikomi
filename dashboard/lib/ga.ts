export type DailyMetric = {
  date: string;
  pageviews: number;
  sessions: number;
};

export type Totals = {
  pageviews: number;
  sessions: number;
  bounceRate: number;
  avgDuration: number;
  _mock?: boolean;
};

export type PageMetric = {
  path: string;
  title: string;
  pageviews: number;
};

const PROXY_URL =
  "/wp-content/themes/swell_child/dashboard/api/ga-proxy.php";

async function fetchProxy<T>(action: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${PROXY_URL}?action=${action}`, {
      cache: "no-store",
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    return json as T;
  } catch {
    return fallback;
  }
}

// ─── モックデータ ───────────────────────────────
function mockDaily(): DailyMetric[] {
  const data: DailyMetric[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6 ? 200 : 0;
    const noise = Math.sin(i * 0.7) * 150 + Math.cos(i * 1.3) * 80;
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    data.push({
      date: `${y}${m}${day}`,
      pageviews: Math.max(
        200,
        Math.round(900 + noise + weekend + (Math.random() - 0.5) * 100)
      ),
      sessions: Math.max(
        130,
        Math.round(
          620 + noise * 0.7 + weekend * 0.7 + (Math.random() - 0.5) * 60
        )
      ),
    });
  }
  return data;
}

const MOCK_TOTALS: Totals = {
  pageviews: 28450,
  sessions: 19320,
  bounceRate: 42.3,
  avgDuration: 187,
  _mock: true,
};

const MOCK_PAGES: PageMetric[] = [
  { path: "/shop/genie/", title: "ジーニー（渋谷）", pageviews: 3240 },
  { path: "/shop/relax-men/", title: "RELAX MEN（新宿）", pageviews: 2870 },
  { path: "/shop/bliss-tokyo/", title: "BLISS TOKYO", pageviews: 2310 },
  { path: "/area/tokyo/", title: "東京エリアのメンズエステ", pageviews: 2100 },
  { path: "/shop/angel-spa/", title: "エンジェルスパ（池袋）", pageviews: 1890 },
  { path: "/area/osaka/", title: "大阪エリアのメンズエステ", pageviews: 1720 },
  { path: "/shop/serene-touch/", title: "セリーンタッチ（梅田）", pageviews: 1540 },
  { path: "/ranking/", title: "人気ランキング", pageviews: 1380 },
  { path: "/shop/pure-hands/", title: "ピュアハンズ（横浜）", pageviews: 1260 },
  { path: "/", title: "メンズエステ口コミランキング TOP", pageviews: 1140 },
];

// ─── Public API ─────────────────────────────────
export async function fetchGA4Daily(): Promise<DailyMetric[]> {
  return fetchProxy<DailyMetric[]>("daily", mockDaily());
}

export async function fetchGA4Totals(): Promise<Totals> {
  return fetchProxy<Totals>("totals", MOCK_TOTALS);
}

export async function fetchGA4Pages(): Promise<PageMetric[]> {
  return fetchProxy<PageMetric[]>("pages", MOCK_PAGES);
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}分${s}秒`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("ja-JP");
}
