import asyncio
import os
import json
import httpx

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
TOKEN = os.getenv("API_TOKEN", "")


async def call_endpoint(client: httpx.AsyncClient, path: str, params=None):
    headers = {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}
    resp = await client.get(f"{BASE_URL}{path}", params=params, headers=headers)
    resp.raise_for_status()
    return resp.json()


async def main():
    async with httpx.AsyncClient(timeout=15.0) as client:
        ltv = await call_endpoint(client, "/api/v1/predictive/ltv/1", {"horizon_days": 90})
        revenue = await call_endpoint(client, "/api/v1/predictive/revenue-forecast", {"horizon_days": 30})
        player_value = await call_endpoint(client, "/api/v1/predictive/player-value/1")
        engagement = await call_endpoint(client, "/api/v1/predictive/engagement/1", {"horizon_days": 14})
        insights = await call_endpoint(client, "/api/v1/predictive/global-insights", {"horizon_days": 30, "top_n": 10})

    print(json.dumps({
        "ltv": ltv,
        "revenue": revenue,
        "player_value": player_value,
        "engagement": engagement,
        "insights": insights,
    }, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
