export default async function handler(req, res) {
  const { origin_lat, origin_lon, dest_lat, dest_lon } = req.query;
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });
  if (!origin_lat || !dest_lat) return res.status(400).json({ error: "coordinates required" });

  const departureTime = Math.floor(Date.now() / 1000) + 300;

  // Distance Matrix API で transit 所要時間を取得
  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${origin_lat},${origin_lon}` +
    `&destinations=${dest_lat},${dest_lon}` +
    `&mode=transit` +
    `&departure_time=${departureTime}` +
    `&region=jp` +
    `&language=ja` +
    `&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    // Distance Matrix のレスポンスを Directions API 互換の形に変換
    const element = data.rows?.[0]?.elements?.[0];
    if (element?.status === "OK") {
      return res.json({
        status: "OK",
        routes: [{ legs: [{ duration: { value: element.duration.value } }] }],
      });
    }

    res.json({ status: element?.status || data.status || "ERROR", _debug: { element, topStatus: data.status } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
