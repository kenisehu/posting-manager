import { useState, useMemo, useEffect, useRef, useCallback } from "react";

// Google Maps API キー（.env.local で管理）
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const TRANSIT_CACHE_KEY = "transit_time_cache_v2";

// Google Maps JS API を動的ロード
function loadMapsAPI(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.DirectionsService) { resolve(); return; }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Google Maps API の読み込みに失敗しました"));
    document.head.appendChild(s);
  });
}

// Directions API で乗換時間（分）を取得
function getTransitMinutes(ds, oLat, oLon, dLat, dLon) {
  return new Promise((resolve) => {
    ds.route({
      origin: { lat: oLat, lng: oLon },
      destination: { lat: dLat, lng: dLon },
      travelMode: window.google.maps.TravelMode.TRANSIT,
      transitOptions: { departureTime: new Date() },
    }, (result, status) => {
      if (status === "OK" && result?.routes?.[0]) {
        resolve(result.routes[0].legs[0].duration.value / 60);
      } else {
        resolve(null);
      }
    });
  });
}

// ============================================================
// GeoJSON データ URL（4県）
// ============================================================
const PREF_GEOJSON_URLS = {
  "茨城県": "https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/geojson/s0010/N03-21_08_210101.json",
  "栃木県": "https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/geojson/s0010/N03-21_09_210101.json",
  "群馬県": "https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/geojson/s0010/N03-21_10_210101.json",
  "埼玉県": "https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/geojson/s0010/N03-21_11_210101.json",
};

// 対象都道府県コード（整数）
const TARGET_PREFS = new Set([8, 9, 10, 11]);

// ============================================================
// ユーティリティ
// ============================================================

// レイキャスティングによる点の多角形内外判定
function pip(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

// GeoJSONフィーチャから実質的な市区町村名を取得
// 政令市の区（N03_004が"区"で終わる）は親市名(N03_003)を返す
function muniName({ N03_003, N03_004 }) {
  if (N03_003 && N03_004 && N03_004.endsWith("区")) return N03_003;
  return N03_004 || N03_003 || null;
}

// ハーヴァーサイン距離（km）
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 路線の駅順をPCA（主成分分析）で再構築
// 最近傍法より直線的な路線で正確。分岐・環状線には限界あり
function reconstructLineOrder(stations) {
  if (stations.length <= 2) return stations;
  const n = stations.length;
  const mLat = stations.reduce((s, x) => s + x.lat, 0) / n;
  const mLon = stations.reduce((s, x) => s + x.lon, 0) / n;
  let cll = 0, cln = 0, cnn = 0;
  for (const s of stations) {
    const dl = s.lat - mLat, dn = s.lon - mLon;
    cll += dl * dl; cln += dl * dn; cnn += dn * dn;
  }
  // 2x2共分散行列の最大固有値に対応する固有ベクトル
  const tr = cll + cnn;
  const det = cll * cnn - cln * cln;
  const lam = (tr + Math.sqrt(Math.max(0, tr * tr - 4 * det))) / 2;
  const evLat = cln || 1, evLon = lam - cll;
  return [...stations].sort((a, b) => {
    const pa = (a.lat - mLat) * evLat + (a.lon - mLon) * evLon;
    const pb = (b.lat - mLat) * evLat + (b.lon - mLon) * evLon;
    return pa - pb;
  });
}

// 駅グラフ構築：同路線隣接 + 乗換エッジ
// キー形式: "${name}@@${lineId}"
function buildStationGraph(stationsAll, lineMap, nearbyPrefs) {
  const lineStations = {}; // lineId -> [{name, lat, lon, key}]
  const nameToKeys = {};   // stationName -> [key]

  for (const group of stationsAll) {
    if (!nearbyPrefs.has(Number(group.prefecture))) continue;
    for (const s of group.stations) {
      const name = s.name_kanji || group.name_kanji;
      const lineId = String(s.ekidata_line_id);
      if (!name || !s.lat || !s.lon || !lineMap[lineId]) continue;
      const key = `${name}@@${lineId}`;
      if (!lineStations[lineId]) lineStations[lineId] = [];
      if (!lineStations[lineId].find(x => x.key === key)) {
        lineStations[lineId].push({ name, lat: parseFloat(s.lat), lon: parseFloat(s.lon), key });
      }
      if (!nameToKeys[name]) nameToKeys[name] = [];
      if (!nameToKeys[name].includes(key)) nameToKeys[name].push(key);
    }
  }

  const adj = {};
  const addEdge = (k1, k2, w) => {
    if (!adj[k1]) adj[k1] = [];
    if (!adj[k2]) adj[k2] = [];
    adj[k1].push({ key: k2, w });
    adj[k2].push({ key: k1, w });
  };

  // 同路線の隣接駅エッジ（40km/h換算）
  for (const stations of Object.values(lineStations)) {
    const ordered = reconstructLineOrder(stations);
    for (let i = 0; i < ordered.length - 1; i++) {
      const a = ordered[i], b = ordered[i + 1];
      const dist = haversine(a.lat, a.lon, b.lat, b.lon);
      addEdge(a.key, b.key, Math.max((dist / 40) * 60, 1.5));
    }
  }

  // 乗換エッジ（同名駅・異路線：5分）
  for (const keys of Object.values(nameToKeys)) {
    for (let i = 0; i < keys.length; i++)
      for (let j = i + 1; j < keys.length; j++)
        addEdge(keys[i], keys[j], 5);
  }

  return { adj, nameToKeys };
}

// Dijkstra（バイナリサーチ挿入で疑似優先度付きキュー）
function dijkstra(adj, startKeys) {
  const dist = {};
  const queue = []; // [time, key]
  for (const k of startKeys) { dist[k] = 0; queue.push([0, k]); }
  while (queue.length > 0) {
    const [d, key] = queue.shift();
    if (d > (dist[key] ?? Infinity)) continue;
    for (const { key: nk, w } of (adj[key] || [])) {
      const nd = d + w;
      if (nd < (dist[nk] ?? Infinity)) {
        dist[nk] = nd;
        let lo = 0, hi = queue.length;
        while (lo < hi) { const m = (lo + hi) >> 1; if (queue[m][0] <= nd) lo = m + 1; else hi = m; }
        queue.splice(lo, 0, [nd, nk]);
      }
    }
  }
  return dist;
}

// ============================================================
// StationTab コンポーネント
// ============================================================
export default function StationTab({ stats, municipalities, onDataLoaded, initialLine, onInitialLineApplied }) {
  const [loadState, setLoadState] = useState("idle"); // idle | loading | ready | error
  const [enriched, setEnriched] = useState(null);
  const [allStations, setAllStations] = useState([]); // 近接駅リスト {name, lat, lon}
  const [mapsAPIReady, setMapsAPIReady] = useState(false);
  const [transitResults, setTransitResults] = useState([]);
  const [transitLoading, setTransitLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedLine, setSelectedLine] = useState(null);
  const [lineSearch, setLineSearch] = useState("");
  const [showPosted, setShowPosted] = useState(false);
  const [viewMode, setViewMode] = useState("line"); // "line" | "nearest"
  const [nearestInput, setNearestInput] = useState("");
  const [nearestStation, setNearestStation] = useState(null);
  const [showNearestSuggest, setShowNearestSuggest] = useState(false);
  const pendingLineRef = useRef(null);

  // 外部から路線を指定された時の処理
  useEffect(() => {
    if (!initialLine) return;
    pendingLineRef.current = initialLine;
    onInitialLineApplied?.();
    if (loadState === "idle") {
      load();
    } else if (loadState === "ready") {
      setSelectedLine(initialLine);
      pendingLineRef.current = null;
    }
  }, [initialLine]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── データ読み込み ──────────────────────────────────────────
  const load = () => {
    if (loadState !== "idle") return;
    setLoadState("loading");

    Promise.all([
      fetch("https://raw.githubusercontent.com/piuccio/open-data-jp-railway-stations/master/stations.json").then(r => r.json()),
      fetch("https://raw.githubusercontent.com/piuccio/open-data-jp-railway-lines/master/lines.json").then(r => r.json()),
      ...Object.values(PREF_GEOJSON_URLS).map(url => fetch(url).then(r => r.json())),
    ]).then(([stationsAll, linesAll, ...geos]) => {

      // 対象県＋近接県の駅リスト（最寄り駅入力用）
      // 4県(8-11) + 福島(7)・長野(20)・新潟(15)・山梨(19)・千葉(12)・東京(13)・神奈川(14)
      const NEARBY_PREFS = new Set([7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 20]);
      const stationByName = {};
      for (const group of stationsAll) {
        if (!NEARBY_PREFS.has(Number(group.prefecture))) continue;
        for (const s of group.stations) {
          const name = s.name_kanji || group.name_kanji;
          if (name && s.lat && s.lon && !stationByName[name]) {
            stationByName[name] = { name, lat: parseFloat(s.lat), lon: parseFloat(s.lon) };
          }
        }
      }
      setAllStations(Object.values(stationByName));

      // 路線 ID → 路線名
      const lineMap = {};
      for (const l of linesAll) lineMap[String(l.ekidata_id)] = l.name_kanji;

      // 市区町村ごとのポリゴン（バウンディングボックス付き）
      const muniGeoms = {};
      for (const geo of geos) {
        for (const f of geo.features) {
          const name = muniName(f.properties);
          if (!name) continue;
          if (!muniGeoms[name]) {
            muniGeoms[name] = {
              rings: [],
              minLon: Infinity, maxLon: -Infinity,
              minLat: Infinity, maxLat: -Infinity,
            };
          }
          const g = muniGeoms[name];
          const addRing = ring => {
            g.rings.push(ring);
            for (const [lon, lat] of ring) {
              if (lon < g.minLon) g.minLon = lon;
              if (lon > g.maxLon) g.maxLon = lon;
              if (lat < g.minLat) g.minLat = lat;
              if (lat > g.maxLat) g.maxLat = lat;
            }
          };
          const geom = f.geometry;
          if (geom.type === "Polygon") {
            addRing(geom.coordinates[0]);
          } else if (geom.type === "MultiPolygon") {
            geom.coordinates.forEach(p => addRing(p[0]));
          }
        }
      }

      // 配布済み市区町村 ID セット
      const postedIds = new Set(Object.keys(stats.muniMap).map(Number));
      const nameToId = {};
      for (const m of municipalities) nameToId[m.name] = m.id;

      // 駅データを処理して市区町村と紐付け
      const result = [];
      const muniEntries = Object.entries(muniGeoms);

      for (const group of stationsAll) {
        if (!TARGET_PREFS.has(Number(group.prefecture))) continue;
        for (const s of group.stations) {
          if (!TARGET_PREFS.has(Number(s.prefecture))) continue;
          const lineName = lineMap[String(s.ekidata_line_id)];
          if (!lineName) continue;

          const lon = s.lon, lat = s.lat;
          if (!lon || !lat) continue;

          // バウンディングボックスで候補を絞り込んでからポリゴン判定
          let muni = null;
          for (const [name, g] of muniEntries) {
            if (lon < g.minLon || lon > g.maxLon || lat < g.minLat || lat > g.maxLat) continue;
            for (const ring of g.rings) {
              if (pip(lon, lat, ring)) { muni = name; break; }
            }
            if (muni) break;
          }
          if (!muni) continue;

          // マスタデータに存在する市区町村のみ対象
          const id = nameToId[muni];
          if (id == null) continue;

          result.push({
            station: s.name_kanji || group.name_kanji,
            line: lineName,
            lineId: String(s.ekidata_line_id),
            municipality: muni,
            posted: postedIds.has(id),
            lat: parseFloat(s.lat),
            lon: parseFloat(s.lon),
          });
        }
      }

      // 路線 → 市区町村マップ & 市区町村 → 駅リストを親に通知
      if (onDataLoaded) {
        const lineMuniMap = {};
        const muniStationsMap = {};
        const seen = {};
        for (const s of result) {
          // 路線→市区町村
          if (!lineMuniMap[s.line]) lineMuniMap[s.line] = new Set();
          lineMuniMap[s.line].add(s.municipality);
          // 市区町村→駅（重複除去）
          if (!muniStationsMap[s.municipality]) { muniStationsMap[s.municipality] = []; seen[s.municipality] = new Set(); }
          const key = `${s.line}|${s.station}`;
          if (!seen[s.municipality].has(key)) {
            muniStationsMap[s.municipality].push({ station: s.station, line: s.line });
            seen[s.municipality].add(key);
          }
        }
        onDataLoaded({ lineMuniMap, muniStationsMap });
      }

      setEnriched(result);
      setLoadState("ready");
      if (pendingLineRef.current) {
        setSelectedLine(pendingLineRef.current);
        pendingLineRef.current = null;
      }
    }).catch(e => {
      setErrorMsg(String(e));
      setLoadState("error");
    });
  };

  // ── 路線一覧（未配布あり、未配布駅数の多い順） ────────────────
  const lineList = useMemo(() => {
    if (!enriched) return [];
    const map = {};
    for (const s of enriched) {
      if (!map[s.line]) map[s.line] = { total: 0, unposted: 0, munis: new Set() };
      map[s.line].total++;
      if (!s.posted) {
        map[s.line].unposted++;
        map[s.line].munis.add(s.municipality);
      }
    }
    return Object.entries(map)
      .filter(([, v]) => v.unposted > 0)
      .map(([name, v]) => ({ name, total: v.total, unposted: v.unposted, muniCount: v.munis.size }))
      .sort((a, b) => b.muniCount - a.muniCount || b.unposted - a.unposted);
  }, [enriched]);

  const filteredLineList = useMemo(() => {
    const q = lineSearch.trim();
    return q ? lineList.filter(l => l.name.includes(q)) : lineList;
  }, [lineList, lineSearch]);

  // 最寄り駅サジェスト
  const nearestSuggestions = useMemo(() => {
    const q = nearestInput.trim();
    if (!q || nearestStation) return [];
    return allStations.filter(s => s.name.includes(q)).slice(0, 10);
  }, [nearestInput, nearestStation, allStations]);

  // Google Maps JS API を起動時にロード
  useEffect(() => {
    if (!MAPS_API_KEY) return;
    loadMapsAPI(MAPS_API_KEY).then(() => setMapsAPIReady(true)).catch(console.error);
  }, []);

  // 最寄り駅が変わったら Google Directions API で乗換時間を取得
  useEffect(() => {
    if (!nearestStation || !enriched || !mapsAPIReady) return;
    let cancelled = false;
    setTransitLoading(true);
    setTransitResults([]);

    (async () => {
      const cache = (() => { try { return JSON.parse(localStorage.getItem(TRANSIT_CACHE_KEY) || "{}"); } catch { return {}; } })();
      const ds = new window.google.maps.DirectionsService();

      // 市区町村ごとに直線距離が最短の駅を代表として選ぶ
      const muniMap = {};
      for (const s of enriched) {
        if (s.posted || !s.lat || !s.lon) continue;
        const km = haversine(nearestStation.lat, nearestStation.lon, s.lat, s.lon);
        if (!muniMap[s.municipality] || km < muniMap[s.municipality].km) {
          muniMap[s.municipality] = { station: s.station, line: s.line, lat: s.lat, lon: s.lon, km };
        }
      }

      // 直線距離上位 30 件に絞る
      const targets = Object.entries(muniMap)
        .map(([muni, v]) => ({ muni, ...v }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 10);

      // 5 件ずつ並列で API を叩く（キャッシュ優先）
      const results = [];
      for (let i = 0; i < targets.length; i += 5) {
        if (cancelled) break;
        const batch = targets.slice(i, i + 5);
        const batchRes = await Promise.all(batch.map(async (t) => {
          const cKey = `${nearestStation.name}→${t.station}`;
          let mins = cache[cKey];
          if (mins === undefined) {
            mins = await getTransitMinutes(ds, nearestStation.lat, nearestStation.lon, t.lat, t.lon);
            if (mins !== null) cache[cKey] = mins;
          }
          return mins != null ? { ...t, mins: Math.round(mins) } : null;
        }));
        results.push(...batchRes.filter(Boolean));
        // 途中経過を表示
        if (!cancelled) setTransitResults([...results].sort((a, b) => a.mins - b.mins));
      }

      if (!cancelled) {
        try { localStorage.setItem(TRANSIT_CACHE_KEY, JSON.stringify(cache)); } catch {}
        results.sort((a, b) => a.mins - b.mins);
        setTransitResults(results);
        setTransitLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [nearestStation, enriched, mapsAPIReady]);

  // ── 選択路線の市区町村別駅グループ ───────────────────────────
  const stationsByMuni = useMemo(() => {
    if (!enriched || !selectedLine) return {};
    const filtered = enriched.filter(s => s.line === selectedLine && (showPosted || !s.posted));
    // 重複駅を除去しつつ市区町村でグループ化
    const map = {};
    const seen = new Set();
    for (const s of filtered) {
      const key = `${s.line}|${s.station}|${s.municipality}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!map[s.municipality]) map[s.municipality] = { stations: [], posted: s.posted };
      map[s.municipality].stations.push(s.station);
    }
    return map;
  }, [enriched, selectedLine, showPosted]);

  // ── 選択路線の未配布市区町村数 ────────────────────────────────
  const selectedLineSummary = useMemo(() => {
    if (!enriched || !selectedLine) return null;
    const all = enriched.filter(s => s.line === selectedLine);
    const muniSet = new Set(all.map(s => s.municipality));
    const unpostedMunis = new Set(all.filter(s => !s.posted).map(s => s.municipality));
    return { totalMunis: muniSet.size, unpostedMunis: unpostedMunis.size };
  }, [enriched, selectedLine]);

  // ============================================================
  // レンダリング
  // ============================================================

  if (loadState === "idle") {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🚉</div>
        <div style={{ color: "#f1f5f9", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
          路線から探す
        </div>
        <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 10, lineHeight: 1.6 }}>
          未配布エリアに停まる路線と駅を確認し<br />
          効率的な配布ルートを計画できます
        </div>
        <div style={{ color: "#64748b", fontSize: 11, marginBottom: 28 }}>
          ※ 路線・駅データ（全国）を取得するため<br />初回読み込みに10〜20秒かかります
        </div>
        <button onClick={load} style={{
          background: "#f59e0b", color: "#1e293b", border: "none",
          borderRadius: 12, padding: "13px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer",
        }}>
          データを読み込む
        </button>
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>⏳</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>路線データを読み込み中...</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          全国の路線・駅情報＋4県の地図データを処理しています
        </div>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ color: "#f87171", fontWeight: 600, marginBottom: 8 }}>⚠️ 読み込みエラー</div>
        <div style={{ color: "#94a3b8", fontSize: 13 }}>{errorMsg}</div>
        <button onClick={() => setLoadState("idle")} style={{
          marginTop: 16, background: "#334155", color: "#f1f5f9", border: "none",
          borderRadius: 8, padding: "8px 20px", cursor: "pointer",
        }}>
          再試行
        </button>
      </div>
    );
  }

  // ── ready: 路線詳細 or 路線一覧 ──────────────────────────────
  return (
    <div style={{ padding: "16px 12px" }}>

      {/* モード切替タブ */}
      {!selectedLine && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[["line", "🚃 路線から探す"], ["nearest", "📍 最寄り駅から探す"]].map(([mode, label]) => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              flex: 1, padding: "9px 0", fontSize: 13, fontWeight: 700,
              borderRadius: 8, border: "none", cursor: "pointer",
              background: viewMode === mode ? "#f59e0b" : "#1e293b",
              color: viewMode === mode ? "#1e293b" : "#94a3b8",
            }}>{label}</button>
          ))}
        </div>
      )}

      {/* 最寄り駅から探すビュー */}
      {viewMode === "nearest" && !selectedLine && (
        <div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
            出発駅を入力すると、直線距離が近い順に未配布エリアの駅を表示します
          </div>

          {/* 駅名入力 */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <input
              value={nearestInput}
              onChange={e => { setNearestInput(e.target.value); setNearestStation(null); setShowNearestSuggest(true); }}
              onFocus={() => setShowNearestSuggest(true)}
              onBlur={() => setTimeout(() => setShowNearestSuggest(false), 150)}
              placeholder="出発駅を入力（例：大宮、浦和）"
              style={{
                width: "100%", padding: "12px 14px", background: "#1e293b",
                border: nearestStation ? "1.5px solid #f59e0b" : "1px solid #334155",
                borderRadius: 10, color: "#f1f5f9", fontSize: 14,
                boxSizing: "border-box", outline: "none",
              }}
            />
            {nearestStation && (
              <button onClick={() => { setNearestStation(null); setNearestInput(""); }} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18,
              }}>✕</button>
            )}
            {showNearestSuggest && nearestSuggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                background: "#1e293b", border: "1px solid #334155", borderRadius: 10,
                marginTop: 4, maxHeight: 220, overflowY: "auto",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}>
                {nearestSuggestions.map(stn => (
                  <div key={stn.name} onMouseDown={() => { setNearestStation(stn); setNearestInput(stn.name); setShowNearestSuggest(false); }}
                    style={{ padding: "11px 14px", cursor: "pointer", fontSize: 14, color: "#e2e8f0", borderBottom: "1px solid #0f172a" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#334155"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    🚉 {stn.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 結果リスト */}
          {nearestStation && transitLoading && transitResults.length === 0 && (
            <div style={{ textAlign: "center", color: "#64748b", padding: "32px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
              <div>乗換時間を検索中...</div>
              <div style={{ fontSize: 11, marginTop: 6 }}>Google Maps で経路を確認しています</div>
            </div>
          )}
          {nearestStation && !transitLoading && transitResults.length === 0 && !mapsAPIReady && (
            <div style={{ textAlign: "center", color: "#64748b", padding: "32px 0" }}>
              Google Maps API を読み込み中...
            </div>
          )}
          {transitResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🚉 {nearestStation.name}駅から近い順・未配布エリア {transitResults.length}件</span>
                {transitLoading && <span style={{ color: "#f59e0b", fontSize: 11 }}>検索中...</span>}
              </div>
              {transitResults.map((r, i) => {
                const color = r.mins <= 20 ? "#4ade80" : r.mins <= 40 ? "#f59e0b" : "#94a3b8";
                return (
                  <div key={r.muni} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    background: "#1e293b", border: "1px solid #334155",
                    borderRadius: 10, padding: "12px 14px",
                  }}>
                    <div style={{
                      minWidth: 28, fontWeight: 900, fontSize: 15,
                      color: i < 3 ? "#f59e0b" : "#475569",
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#f1f5f9", marginBottom: 3 }}>
                        📍 {r.muni}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>
                        🚃 {r.line}&nbsp;•&nbsp;🚉 {r.station}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 700, color,
                        background: color + "22", borderRadius: 6, padding: "3px 9px",
                        whiteSpace: "nowrap",
                      }}>
                        🚃 約{r.mins}分
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>
                        🚗 約{r.km.toFixed(1)}km
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 路線ビュー */}
      {(viewMode === "line" || selectedLine) && (
      <>{selectedLine ? (
        /* ── 路線詳細ビュー ── */
        <>
          {/* ヘッダー */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <button onClick={() => setSelectedLine(null)} style={{
              background: "none", border: "none", color: "#94a3b8",
              cursor: "pointer", fontSize: 22, padding: "0 4px 0 0", lineHeight: 1,
            }}>‹</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                🚃 {selectedLine}
              </div>
              {selectedLineSummary && (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  未配布エリア&nbsp;
                  <span style={{ color: "#f59e0b", fontWeight: 700 }}>{selectedLineSummary.unpostedMunis}</span>
                  &nbsp;市区町村 /&nbsp;全{selectedLineSummary.totalMunis}市区町村
                </div>
              )}
            </div>
            <label style={{
              display: "flex", alignItems: "center", gap: 5,
              color: "#64748b", fontSize: 12, cursor: "pointer", flexShrink: 0,
            }}>
              <input type="checkbox" checked={showPosted} onChange={e => setShowPosted(e.target.checked)} />
              配布済みも表示
            </label>
          </div>

          <div style={{ borderBottom: "1px solid #1e293b", margin: "10px 0 14px" }} />

          {Object.keys(stationsByMuni).length === 0 ? (
            <div style={{ color: "#64748b", textAlign: "center", padding: "48px 0" }}>
              {showPosted ? "駅が見つかりません" : "この路線の未配布エリアの駅はありません"}
            </div>
          ) : (
            Object.entries(stationsByMuni)
              .sort((a, b) => (a[1].posted === b[1].posted ? 0 : a[1].posted ? 1 : -1))
              .map(([muni, { stations, posted }]) => (
                <div key={muni} style={{
                  marginBottom: 14,
                  background: "#1e293b",
                  borderRadius: 12,
                  border: `1px solid ${posted ? "#166534" : "#92400e"}`,
                  overflow: "hidden",
                }}>
                  {/* 市区町村ヘッダー */}
                  <div style={{
                    padding: "10px 16px",
                    background: posted ? "#14532d22" : "#45140322",
                    borderBottom: `1px solid ${posted ? "#166534" : "#92400e"}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: posted ? "#4ade80" : "#fbbf24" }}>
                      {posted ? "✅" : "📍"} {muni}
                    </div>
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      color: posted ? "#4ade80" : "#f59e0b",
                      background: posted ? "#14532d" : "#451a03",
                      padding: "3px 10px", borderRadius: 20,
                    }}>
                      {posted ? "配布済み" : "未配布 → この駅から配れます！"}
                    </div>
                  </div>

                  {/* 駅リスト */}
                  <div style={{ padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {stations.map(stn => (
                      <span key={stn} style={{
                        background: "#0f172a",
                        border: `1px solid ${posted ? "#334155" : "#451a03"}`,
                        borderRadius: 20, padding: "5px 12px",
                        fontSize: 13, color: "#e2e8f0",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        🚉 {stn}
                      </span>
                    ))}
                  </div>
                </div>
              ))
          )}
        </>
      ) : (
        /* ── 路線一覧ビュー ── */
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <h2 style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 700, margin: 0 }}>
              🚉 路線から探す
            </h2>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {lineList.length}路線
            </div>
          </div>
          <div style={{ color: "#64748b", fontSize: 12, marginBottom: 14 }}>
            未配布エリアに停まる路線の一覧
          </div>

          <input
            value={lineSearch}
            onChange={e => setLineSearch(e.target.value)}
            placeholder="路線名を検索..."
            style={{
              width: "100%", padding: "10px 14px", marginBottom: 14,
              background: "#1e293b", border: "1px solid #334155",
              borderRadius: 10, color: "#f1f5f9", fontSize: 14,
              boxSizing: "border-box", outline: "none",
            }}
          />

          {filteredLineList.length === 0 ? (
            <div style={{ color: "#64748b", textAlign: "center", padding: "40px 0" }}>
              該当する路線がありません
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredLineList.map(line => (
                <button
                  key={line.name}
                  onClick={() => setSelectedLine(line.name)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "13px 16px",
                    background: "#1e293b", border: "1px solid #334155",
                    borderRadius: 10, color: "#f1f5f9", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>
                      🚃 {line.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      未配布エリア&nbsp;
                      <span style={{ color: "#f59e0b", fontWeight: 700 }}>{line.muniCount}</span>
                      &nbsp;市区町村・
                      <span style={{ color: "#f59e0b", fontWeight: 700 }}>{line.unposted}</span>
                      &nbsp;駅&nbsp;
                      <span style={{ color: "#475569" }}>/ 全{line.total}駅</span>
                    </div>
                  </div>
                  <span style={{ color: "#475569", fontSize: 22, marginLeft: 8 }}>›</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}</>
      )}
    </div>
  );
}
