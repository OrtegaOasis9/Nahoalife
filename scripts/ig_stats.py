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
    posts, url, params = {}, f"{API}/me/media", dict(fields="id,permalink,like_count,comments_count", limit=100, access_token=token)
    while url:
        page = get(url, **params) if params else json.load(urllib.request.urlopen(url, timeout=30))
        for m in page.get("data", []):
            code = re.search(r"/(?:reel|p)/([A-Za-z0-9_-]+)", m.get("permalink", ""))
            if not code or code.group(1) not in wanted:
                continue
            stats = {"likes": m.get("like_count"), "comments": m.get("comments_count")}
            try:
                ins = get(f"{API}/{m['id']}/insights", metric="views,likes,comments,shares", access_token=token)
                for row in ins.get("data", []):
                    vals = row.get("values") or [{}]
                    stats[row["name"]] = vals[0].get("value", row.get("total_value", {}).get("value"))
            except Exception as e:  # insights can be missing for very new posts
                print(f"insights failed for {code.group(1)}: {e}")
            posts[code.group(1)] = stats
        url, params = page.get("paging", {}).get("next"), None

    data = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "followers": me.get("followers_count"),
        "posts": posts,
    }
    with open(OUT, "w") as f:
        json.dump(data, f, indent=1)
    print(f"{len(posts)}/{len(wanted)} reels matched; followers {data['followers']}")
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
