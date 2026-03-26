export default async function handler(req, res) {
  const { origin_lat, origin_lon, dest_lat, dest_lon } = req.query;
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });
  if (!origin_lat || !dest_lat) return res.status(400).json({ error: "coordinates required" });

  const originStr = `${origin_lat},${origin_lon}`;
  const destStr = `${dest_lat},${dest_lon}`;

  const url =
    `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${originStr}` +
    `&destination=${destStr}` +
    `&mode=driving` +
    `&region=jp` +
    `&language=ja` +
    `&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    // _debug フィールドで座標・ステータスをフロントに返す
    data._debug = { originStr, destStr, status: data.status };
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message, _debug: { originStr, destStr } });
  }
}
