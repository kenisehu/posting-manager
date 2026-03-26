export default async function handler(req, res) {
  const { origin_lat, origin_lon, dest_lat, dest_lon } = req.query;
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });
  if (!origin_lat || !dest_lat) return res.status(400).json({ error: "coordinates required" });

  const originStr = `${origin_lat},${origin_lon}`;
  const destStr = `${dest_lat},${dest_lon}`;
  // 5分後の Unix タイムスタンプ（transit には未来時刻が必要な場合がある）
  const departureTime = Math.floor(Date.now() / 1000) + 300;

  const url =
    `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${originStr}` +
    `&destination=${destStr}` +
    `&mode=transit` +
    `&departure_time=${departureTime}` +
    `&region=jp` +
    `&language=ja` +
    `&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    data._debug = { originStr, destStr, status: data.status };
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
