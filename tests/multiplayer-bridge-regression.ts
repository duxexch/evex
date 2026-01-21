import { Client } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required to run this regression check.");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    // Pull multiplayer games and games catalog
    const { rows: multiplayer } = await client.query<{ key: string; name_en: string }>(
      "SELECT key, name_en FROM multiplayer_games"
    );
    const { rows: gameRows } = await client.query<{ name: string }>(
      "SELECT name FROM games"
    );

    const gameNames = new Set(gameRows.map((g) => g.name.toLowerCase()));
    const missing = multiplayer.filter((m) => !gameNames.has(m.name_en.toLowerCase()));

    if (missing.length > 0) {
      console.error(
        "Regression failure: missing bridged games for multiplayer entries",
        missing.map((m) => m.key).join(", ")
      );
      process.exit(1);
    }

    console.log(`✅ Regression check passed: ${multiplayer.length} multiplayer games all have bridged entries in games table.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Regression check failed:", err);
  process.exit(1);
});
