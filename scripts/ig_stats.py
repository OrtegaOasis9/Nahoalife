"""Pull Instagram stats for the reels on the feature page and write feature/stats.json.

Runs weekly from .github/workflows/ig-stats.yml. Needs IG_TOKEN (an Instagram User
access token from the Meta app, with instagram_business_basic and
instagram_business_manage_insights). Prints a refreshed token to $GITHUB_OUTPUT
so the workflow can store it back as the IG_TOKEN secret.
"""
import json, os, re, sys, urllib.parse, urllib.request
from datetime import datetime, timezone

API = "https://graph.instagram.com/v23.0"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "feature", "index.html")
OUT = os.path.join(ROOT, "feature", "stats.json")


def get(url, **params):
    q = urllib.parse.urlencode(params)
    with urllib.request.urlopen(f"{url}?{q}", timeout=30) as r:
        return json.load(r)


def main():
    token = os.environ.get("IG_TOKEN")
    if not token:
        sys.exit("IG_TOKEN is not set")

    wanted = set(re.findall(r"id: '([A-Za-z0-9_-]{6,})'", open(PAGE).read()))
    wanted |= set(re.findall(r'data-id="([A-Za-z0-9_-]{6,})"', open(PAGE).read()))

    me = get(f"{API}/me", fields="followers_count,media_count,username", access_token=token)

    # Every post on the account
    media, url, params = [], f"{API}/me/media", dict(fields="id,permalink,like_count,comments_count", limit=100, access_token=token)
    while url:
        page = get(url, **params) if params else json.load(urllib.request.urlopen(url, timeout=30))
        media += page.get("data", [])
        url, params = page.get("paging", {}).get("next"), None

    def insights(mid, metrics):
        out = {}
        ins = get(f"{API}/{mid}/insights", metric=metrics, access_token=token)
        for row in ins.get("data", []):
            vals = row.get("values") or [{}]
            out[row["name"]] = vals[0].get("value", row.get("total_value", {}).get("value"))
        return out

    # Channel-wide views: cached per post, refreshed oldest-first within an API budget
    cache_path = os.path.join(ROOT, "feature", "channel_views.json")
    try:
        cache = json.load(open(cache_path))
    except Exception:
        cache = {}
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    budget = int(os.environ.get("IG_CALL_BUDGET", "150"))

    posts = {}
    for m in media:
        code = re.search(r"/(?:reel|p|tv)/([A-Za-z0-9_-]+)", m.get("permalink", ""))
        if code and code.group(1) in wanted:
            stats = {"likes": m.get("like_count"), "comments": m.get("comments_count")}
            try:
                stats.update(insights(m["id"], "views,likes,comments,shares"))
                budget -= 1
                if stats.get("views") is not None:
                    cache[m["id"]] = {"views": stats["views"], "updated": today}
            except Exception as e:  # insights can be missing for very new posts
                print(f"insights failed for {code.group(1)}: {e}")
            posts[code.group(1)] = stats

    others = [m["id"] for m in media if cache.get(m["id"], {}).get("updated") != today]
    others.sort(key=lambda i: cache.get(i, {}).get("updated", ""))
    for mid in others[:max(budget, 0)]:
        try:
            v = insights(mid, "views").get("views")
            cache[mid] = {"views": v or 0, "updated": today}
        except Exception as e:
            cache.setdefault(mid, {"views": 0, "updated": today, "note": "no insights"})
            print(f"views unavailable for media {mid}: {e}")
    ids = {m["id"] for m in media}
    cache = {k: v for k, v in cache.items() if k in ids}
    with open(cache_path, "w") as f:
        json.dump(cache, f, indent=0)
    covered = len(cache)
    channel_views = sum((v.get("views") or 0) for v in cache.values())

    data = {
        "updated": today,
        "followers": me.get("followers_count"),
        "media_count": me.get("media_count"),
        "channel_views": channel_views,
        "channel_views_complete": covered >= len(media),
        "posts": posts,
    }
    with open(OUT, "w") as f:
        json.dump(data, f, indent=1)
    print(f"{len(posts)}/{len(wanted)} reels matched; followers {data['followers']}; "
          f"channel views {channel_views} from {covered}/{len(media)} posts")
    missing = wanted - set(posts)
    if missing:
        print("not found on the account:", ", ".join(sorted(missing)))

    # Refresh the long-lived token (valid 60 days from refresh)
    try:
        new = get("https://graph.instagram.com/refresh_access_token", grant_type="ig_refresh_token", access_token=token)
        if new.get("access_token") and os.environ.get("GITHUB_OUTPUT"):
            print(f"::add-mask::{new['access_token']}")
            with open(os.environ["GITHUB_OUTPUT"], "a") as f:
                f.write(f"new_token={new['access_token']}\n")
    except Exception as e:
        print(f"token refresh failed: {e}")


if __name__ == "__main__":
    main()
