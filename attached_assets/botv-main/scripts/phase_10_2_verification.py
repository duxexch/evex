import asyncio
import os
import json
import httpx

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
TOKEN = os.getenv("API_TOKEN", "")


async def call(client: httpx.AsyncClient, path: str, params=None):
    headers = {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}
    resp = await client.get(f"{BASE_URL}{path}", params=params or {}, headers=headers)
    resp.raise_for_status()
    return resp.json()


async def main():
    async with httpx.AsyncClient(timeout=15.0) as client:
        stats = await call(client, "/api/v1/model-monitoring/feature-stats", {"feature": "bet_amount", "period_days": 7})
        drift = await call(client, "/api/v1/model-monitoring/drift", {"feature": "bet_amount", "baseline_mean": 50, "baseline_std": 10, "period_days": 7})
        segments = await call(client, "/api/v1/model-monitoring/segment-performance", {"period_days": 30})
    print(json.dumps({"stats": stats, "drift": drift, "segments": segments}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
