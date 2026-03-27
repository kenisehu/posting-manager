// ============================================================
// 日次バックアップ API
// Vercel Cron Job から毎日 3:00 AM JST (18:00 UTC) に呼ばれる
// Supabase の posting_records を JSON で Storage に保存
// ============================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://obihljkqkfikzibvnvqp.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  // Vercel Cron からの正規リクエストか確認
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers["authorization"];
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: "SUPABASE_SERVICE_KEY が設定されていません" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // バックアップ用バケットが存在しない場合は作成（初回のみ）
  await supabase.storage.createBucket("backups", { public: false });

  // 全レコードを取得
  const { data, error } = await supabase
    .from("posting_records")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[backup] DB取得エラー:", error.message);
    return res.status(500).json({ error: error.message });
  }

  // 日本時間の日付でファイル名を生成
  const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dateStr = jstNow.toISOString().split("T")[0]; // YYYY-MM-DD
  const fileName = `backup_${dateStr}.json`;

  const content = JSON.stringify(
    {
      backup_date: dateStr,
      created_at_jst: jstNow.toISOString(),
      record_count: data.length,
      records: data,
    },
    null,
    2
  );

  // Supabase Storage の backups バケットに保存（同日は上書き）
  const { error: uploadError } = await supabase.storage
    .from("backups")
    .upload(fileName, content, {
      contentType: "application/json",
      upsert: true,
    });

  if (uploadError) {
    console.error("[backup] Storage保存エラー:", uploadError.message);
    return res.status(500).json({ error: uploadError.message });
  }

  console.log(`[backup] 完了: ${fileName} (${data.length}件)`);
  return res.status(200).json({
    success: true,
    date: dateStr,
    record_count: data.length,
    file: fileName,
  });
}
