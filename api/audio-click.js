const { kv } = require("@vercel/kv");

module.exports = async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).json({ error: "Missing audio id" });
    return;
  }

  const countKey = `audio_click_${id}`;
  const pingKey = `audio_nextPing_${id}`;
  const lastPlayedKey = `audio_lastPlayed_${id}`;

  let count = (await kv.get(countKey)) || 0;
  let nextPing = await kv.get(pingKey);
  let lastPlayed = await kv.get(lastPlayedKey);

  if (req.method === "POST") {
    count++;

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const next = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    nextPing = next.toISOString().split("T")[0];

    lastPlayed = today;

    await kv.set(countKey, count);
    await kv.set(pingKey, nextPing);
    await kv.set(lastPlayedKey, lastPlayed);
  }

  res.status(200).json({
    id: Number(id),
    count,
    nextPing,
    lastPlayed
  });
};
