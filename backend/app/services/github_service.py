"""GitHub integration service.

Supports two modes:
  - "real": calls the actual GitHub REST API using a Personal Access Token
    (never exposed to the frontend - lives only on the backend, via env var
    or a per-project GitHubConnection record).
  - "demo": returns clearly-labeled seeded/demo data so the product can be
    explored end-to-end without a real GitHub account.

Only the backend ever talks to GitHub. The frontend only ever calls our
own /api/github/* endpoints.
"""
from datetime import datetime, timedelta, timezone

import httpx

from app.core.config import settings

GITHUB_API = "https://api.github.com"


class GitHubService:
    def __init__(self, token: str | None = None, repo_owner: str | None = None, repo_name: str | None = None, mode: str | None = None):
        self.mode = (mode or settings.github_mode or "demo").lower()
        self.token = token or settings.github_token
        self.repo_owner = repo_owner or settings.github_repo_owner or "medrelease-demo"
        self.repo_name = repo_name or settings.github_repo_name or "hospital-management-system"

        if self.mode == "real" and not self.token:
            # Fall back gracefully to demo mode rather than failing hard.
            self.mode = "demo"

    # ---------------- internal helpers ----------------
    def _headers(self):
        headers = {"Accept": "application/vnd.github+json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _get(self, path: str, params: dict | None = None):
        url = f"{GITHUB_API}/repos/{self.repo_owner}/{self.repo_name}{path}"
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, headers=self._headers(), params=params or {})
            resp.raise_for_status()
            return resp.json()

    # ---------------- public API ----------------
    def get_repository(self):
        if self.mode == "real":
            data = self._get("")
            return {
                "mode": "real",
                "name": data.get("name"),
                "full_name": data.get("full_name"),
                "description": data.get("description"),
                "default_branch": data.get("default_branch"),
                "html_url": data.get("html_url"),
                "stargazers_count": data.get("stargazers_count"),
                "open_issues_count": data.get("open_issues_count"),
            }
        return {
            "mode": "demo",
            "name": self.repo_name,
            "full_name": f"{self.repo_owner}/{self.repo_name}",
            "description": "DEMO repository data (no real GitHub token configured)",
            "default_branch": "main",
            "html_url": f"https://github.com/{self.repo_owner}/{self.repo_name}",
            "stargazers_count": 12,
            "open_issues_count": 3,
        }

    def get_branches(self):
        if self.mode == "real":
            data = self._get("/branches")
            return [{"name": b["name"], "mode": "real"} for b in data]
        return [
            {"name": "main", "mode": "demo"},
            {"name": "develop", "mode": "demo"},
            {"name": "feature/lab-report-fix", "mode": "demo"},
        ]

    def get_commits(self, branch: str = "main", limit: int = 10):
        if self.mode == "real":
            data = self._get("/commits", params={"sha": branch, "per_page": limit})
            return [
                {
                    "sha": c["sha"][:7],
                    "message": c["commit"]["message"].split("\n")[0],
                    "author": c["commit"]["author"]["name"],
                    "date": c["commit"]["author"]["date"],
                    "url": c["html_url"],
                    "mode": "real",
                }
                for c in data
            ]
        base = datetime.now(timezone.utc)
        demo = [
            ("a1b2c3d", "Fix laboratory report download timeout", "dev.medicare"),
            ("e4f5g6h", "Update appointment validation rules", "dev.medicare"),
            ("i7j8k9l", "Add new lab test types", "dev.medicare"),
            ("m1n2o3p", "Merge pull request #42 from feature/lab-report-fix", "manager.medicare"),
        ]
        return [
            {
                "sha": sha,
                "message": msg,
                "author": author,
                "date": (base - timedelta(days=i)).isoformat(),
                "url": f"https://github.com/{self.repo_owner}/{self.repo_name}/commit/{sha}",
                "mode": "demo",
            }
            for i, (sha, msg, author) in enumerate(demo)
        ]

    def get_pull_requests(self, state: str = "open"):
        if self.mode == "real":
            data = self._get("/pulls", params={"state": state})
            return [
                {
                    "number": p["number"],
                    "title": p["title"],
                    "state": "merged" if p.get("merged_at") else p["state"],
                    "url": p["html_url"],
                    "author": p["user"]["login"],
                    "created_at": p["created_at"],
                    "mode": "real",
                }
                for p in data
            ]
        demo = [
            {"number": 42, "title": "Fix Laboratory Report Download", "state": "merged", "author": "dev.medicare"},
            {"number": 45, "title": "Update Appointment Validation", "state": "open", "author": "dev.medicare"},
            {"number": 47, "title": "Add New Lab Tests", "state": "open", "author": "dev.medicare"},
        ]
        return [
            {
                **pr,
                "url": f"https://github.com/{self.repo_owner}/{self.repo_name}/pull/{pr['number']}",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "mode": "demo",
            }
            for pr in demo
            if state == "all" or pr["state"] == state or (state == "open" and pr["state"] == "open")
        ]

    def get_issues(self):
        if self.mode == "real":
            data = self._get("/issues", params={"state": "open"})
            return [
                {"number": i["number"], "title": i["title"], "state": i["state"], "url": i["html_url"], "mode": "real"}
                for i in data
                if "pull_request" not in i
            ]
        return [
            {"number": 12, "title": "Lab report PDF sometimes fails to render", "state": "open", "mode": "demo"},
            {"number": 15, "title": "Appointment double-booking edge case", "state": "open", "mode": "demo"},
        ]

    def get_releases(self):
        if self.mode == "real":
            data = self._get("/releases")
            return [
                {
                    "tag_name": r["tag_name"],
                    "name": r["name"] or r["tag_name"],
                    "url": r["html_url"],
                    "published_at": r["published_at"],
                    "mode": "real",
                }
                for r in data
            ]
        return [
            {
                "tag_name": "v2.3.1",
                "name": "Hotfix for lab reports",
                "url": f"https://github.com/{self.repo_owner}/{self.repo_name}/releases/tag/v2.3.1",
                "published_at": (datetime.now(timezone.utc) - timedelta(days=30)).isoformat(),
                "mode": "demo",
            }
        ]

    def get_pr_by_number(self, pr_number: int):
        if self.mode == "real":
            return self._get(f"/pulls/{pr_number}")
        for pr in self.get_pull_requests(state="all"):
            if pr["number"] == pr_number:
                return pr
        return None

    def get_release_by_tag(self, tag: str):
        if self.mode == "real":
            return self._get(f"/releases/tags/{tag}")
        for rel in self.get_releases():
            if rel["tag_name"] == tag:
                return rel
        return None

    def validate_pr_exists(self, pr_number: int) -> bool:
        return self.get_pr_by_number(pr_number) is not None

    def validate_release_exists(self, tag: str) -> bool:
        return self.get_release_by_tag(tag) is not None
