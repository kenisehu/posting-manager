export default async function handler(req, res) {
  const { origin_lat, origin_lon, dest_lat, dest_lon } = req.query;
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });
  if (!origin_lat || !dest_lat) return res.status(400).json({ error: "coordinates required" });

  // URLSearchParams はカンマを %2C にエンコードするので文字列で直接組み立てる
  const url =
    `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${origin_lat},${origin_lon}` +
    `&destination=${dest_lat},${dest_lon}` +
    `&mode=transit` +
    `&departure_time=now` +
    `&region=jp` +
    `&language=ja` +
    `&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
