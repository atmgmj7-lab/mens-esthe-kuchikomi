import random
from datetime import datetime, timedelta


def generate_mock_daily(days: int) -> list:
    data = []
    base_pv = 420
    base_sessions = 260
    today = datetime.now()
    for i in range(days - 1, -1, -1):
        date = today - timedelta(days=i)
        weekday_boost = 1.2 if date.weekday() < 5 else 0.72
        noise = random.uniform(0.78, 1.25)
        pv = int(base_pv * weekday_boost * noise)
        sessions = int(base_sessions * weekday_boost * noise * 0.63)
        data.append({
            "date": date.strftime("%Y-%m-%d"),
            "pageviews": pv,
            "sessions": sessions,
        })
    return data


def get_mock_analytics(days: int = 30) -> dict:
    daily = generate_mock_daily(days)
    total_pv = sum(d["pageviews"] for d in daily)
    total_sessions = sum(d["sessions"] for d in daily)
    pages = [
        {"path": "/", "title": "トップページ", "pageviews": int(total_pv * 0.18)},
        {"path": "/shop/genie%ef%bc%88%e3%82%b8%e3%83%bc%e3%83%8b%e3%83%bc%ef%bc%89/", "title": "Genie（ジーニー）", "pageviews": int(total_pv * 0.09)},
        {"path": "/area/tokyo/", "title": "東京のメンズエステ", "pageviews": int(total_pv * 0.07)},
        {"path": "/area/osaka/", "title": "大阪のメンズエステ", "pageviews": int(total_pv * 0.05)},
        {"path": "/ranking/", "title": "人気店舗ランキング", "pageviews": int(total_pv * 0.05)},
        {"path": "/area/nagoya/", "title": "名古屋のメンズエステ", "pageviews": int(total_pv * 0.04)},
        {"path": "/column/", "title": "コラム一覧", "pageviews": int(total_pv * 0.04)},
        {"path": "/area/fukuoka/", "title": "福岡のメンズエステ", "pageviews": int(total_pv * 0.03)},
        {"path": "/review/", "title": "口コミ一覧", "pageviews": int(total_pv * 0.03)},
        {"path": "/area/sapporo/", "title": "札幌のメンズエステ", "pageviews": int(total_pv * 0.02)},
    ]
    return {
        "mock": True,
        "days": days,
        "daily": daily,
        "totals": {
            "pageviews": total_pv,
            "sessions": total_sessions,
            "bounce_rate": round(random.uniform(58.0, 72.0), 1),
            "avg_duration": random.randint(130, 210),
        },
        "pages": pages,
    }
