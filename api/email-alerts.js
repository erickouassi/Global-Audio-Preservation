const { kv } = require("@vercel/kv");
const fs = require("fs");
const path = require("path");

module.exports = async function handler(req, res) {
  const filePath = path.join(process.cwd(), "audio.json");
  const file = fs.readFileSync(filePath, "utf8");
  const audios = JSON.parse(file);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const warnings = [];
  const critical = [];
  const errors = [];

  for (const audio of audios) {
    const id = audio.id;
    const pingKey = `audio_nextPing_${id}`;
    const lastPlayedKey = `audio_lastPlayed_${id}`;

    const nextPing = await kv.get(pingKey);
    const lastPlayed = await kv.get(lastPlayedKey);

    if (!nextPing) {
      critical.push({ audio, reason: "Missing nextPing" });
      continue;
    }

    const diff = Math.floor(
      (new Date(nextPing) - today) / (1000 * 60 * 60 * 24)
    );

    if (diff < 0) {
      critical.push({ audio, nextPing, lastPlayed });
    } else if (diff <= 7) {
      warnings.push({ audio, nextPing, lastPlayed });
    }
  }

  // If nothing to report, exit quietly
  if (warnings.length === 0 && critical.length === 0 && errors.length === 0) {
    return res.status(200).json({ message: "No alerts needed today." });
  }

  // Build email body
  let body = `Audio Preservation Alerts (${todayStr})\n\n`;

  if (critical.length > 0) {
    body += "CRITICAL (needs immediate ping):\n";
    critical.forEach(item => {
      body += `- ${item.audio.title} (nextPing: ${item.nextPing})\n`;
    });
    body += "\n";
  }

  if (warnings.length > 0) {
    body += "WARNING (less than 7 days left):\n";
    warnings.forEach(item => {
      body += `- ${item.audio.title} (nextPing: ${item.nextPing})\n`;
    });
    body += "\n";
  }

  // Send email via Resend
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.ALERT_EMAIL_FROM,
      to: process.env.ALERT_EMAIL_TO,
      subject: "Audio Preservation Alerts",
      text: body
    })
  });

  res.status(200).json({ message: "Alert email sent.", body });
};
