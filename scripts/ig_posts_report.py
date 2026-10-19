"""Rank every Instagram post by performance and flag "Nice, in the Mean" posts.

Run on demand from .github/workflows/ig-posts-report.yml. Uses the same IG_TOKEN
secret as ig_stats.py. Read-only on Instagram. Writes two CSVs to reports/ and
prints NO stats to the log (this repo is public, so logs are public too). The
CSVs are uploaded as a private workflow artifact, never committed.
"""
import csv, json, os, re, sys, urllib.parse, urllib.request

API = "https://graph.instagram.com/v23.0"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "reports")
SONG_KEY = "niceinthemean"  # caption match, ignoring case, spaces and punctuation
METRICS = ["views", "reach", "likes", "comments", "shares", "saved",
           "follows", "profile_visits", "total_interactions"]


def get(url, **params):
    q = urllib.parse.urlencode(params)
    with urllib.request.urlopen(f"{url}?{q}" if q else url, timeout=30) as r:
        return json.load(r)


def insights(mid, token):
    """Ask for all metrics at once; if the API rejects one, fall back to one at a time."""
    def parse(rows):
        out = {}
        for row in rows.get("data", []):
            vals = row.get("values") or [{}]
            out[row["name"]] = vals[0].get("value", row.get("total_value", {}).get("value"))
        return out
    try:
        return parse(get(f"{API}/{mid}/insights", metric=",".join(METRICS), access_token=token))
    except Exception:
        out = {}
        for m in METRICS:
            try:
                out.update(parse(get(f"{API}/{mid}/insights", metric=m, access_token=token)))
            except Exception:
                pass  # metric not available for this post type
        return out


def main():
    token = os.environ.get("IG_TOKEN")
    if not token:
        sys.exit("IG_TOKEN is not set")

    media, url, params = [], f"{API}/me/media", dict(
        fields="id,caption,media_type,media_product_type,permalink,timestamp",
        limit=100, access_token=token)
    while url:
        page = get(url, **params) if params else get(url)
        media += page.get("data", [])
        url, params = page.get("paging", {}).get("next"), None

    rows = []
    for m in media:
        caption = m.get("caption") or ""
        norm = re.sub(r"[^a-z0-9]", "", caption.lower())
        row = {
            "nice_in_the_mean": "yes" if SONG_KEY in norm else "",
            "date": (m.get("timestamp") or "")[:10],
            "type": m.get("media_product_type") or m.get("media_type"),
            "link": m.get("permalink"),
            "caption": caption.replace("\n", " ")[:150],
        }
        row.update({k: "" for k in METRICS})
        row.update({k: v for k, v in insights(m["id"], token).items() if k in METRICS})
        rows.append(row)

    def num(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0

    # Rank: follows first, then shares + saves, then views
    rows.sort(key=lambda r: (num(r["follows"]), num(r["shares"]) + num(r["saved"]), num(r["views"])), reverse=True)

    os.makedirs(OUT_DIR, exist_ok=True)
    cols = ["nice_in_the_mean", "date", "type", "link"] + METRICS + ["caption"]
    for name, subset in (("all_posts_ranked.csv", rows),
                         ("nice_in_the_mean_ranked.csv", [r for r in rows if r["nice_in_the_mean"]])):
        with open(os.path.join(OUT_DIR, name), "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader()
            w.writerows(subset)

    print(f"Done: {len(rows)} posts written; download the 'ig-posts-report' artifact.")


if __name__ == "__main__":
    main()
