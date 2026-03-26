export default async function handler(req, res) {
  const { origin, destination } = req.query;
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });
  if (!origin || !destination) return res.status(400).json({ error: "origin and destination required" });

  const url =
    "https://maps.googleapis.com/maps/api/directions/json?" +
    new URLSearchParams({
      origin: origin + "駅",
      destination: destination + "駅",
      mode: "transit",
      language: "ja",
      key: apiKey,
    });

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
