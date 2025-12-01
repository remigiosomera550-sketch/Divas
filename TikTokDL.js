import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const BOT_TOKEN = "8539135368:AAFGx2IkKKHRS-QHtolT7aj9siL5Mp8dzeg";
const CHAT_ID = "8501950911";
const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendTikTokVideo(tiktokLink) {
  try {
    // 1️⃣ Get TikTok video URL from your API
    const apiURL = `https://betadash-api-swordslush-production.up.railway.app/api/tiktok?link=${encodeURIComponent(tiktokLink)}`;
    const res = await fetch(apiURL);
    const data = await res.json();

    if (!data?.video?.noWatermark) {
      return console.log("❌ Failed to get video URL.");
    }

    const videoURL = data.video.noWatermark;

    // 2️⃣ Download video temporarily
    const videoRes = await fetch(videoURL);
    const buffer = await videoRes.arrayBuffer();
    const filePath = path.join("./", `tiktok_${Date.now()}.mp4`);
    fs.writeFileSync(filePath, Buffer.from(buffer));

    // 3️⃣ Send video to Telegram
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    form.append("chat_id", CHAT_ID);
    form.append("video", fs.createReadStream(filePath));
    form.append("caption", "🎬 Here is your TikTok video!");

    await fetch(`${TG}/sendVideo`, { method: "POST", body: form });

    // 4️⃣ Delete temporary file
    fs.unlinkSync(filePath);

    console.log("✅ Video sent successfully!");

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

// Example TikTok link
sendTikTokVideo("https://vt.tiktok.com/ZSfgj889h/");