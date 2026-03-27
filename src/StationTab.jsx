import { useState, useMemo, useEffect, useRef, useCallback } from "react";

const TRANSIT_CACHE_KEY = "transit_time_cache_v2";


// Vercel serverless 経由で乗換時間（分）を取得（座標指定）
async function getTransitMinutes(originLat, originLon, destLat, destLon) {
  try {
    const res = await fetch(
      `/api/transit?origin_lat=${originLat}&origin_lon=${originLon}&dest_lat=${destLat}&dest_lon=${destLon}`
    );
    const data = await res.json();
    if (data.status === "OK" && data.routes?.[0]) {
      return { mins: data.routes[0].legs[0].duration.value / 60, status: "OK" };
    }
    const detail = JSON.stringify(data._debug || data.error_message || "");
    return { mins: null, status: data.status || "ERROR", detail };
  } catch (e) {
    return { mins: null, status: "FETCH_ERROR", detail: e.message };
  }
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

// ============================================================
// 路線・市区町村データ構築（named export：App.jsx からも呼べる）
// ============================================================
export async function buildLineMuniData(municipalities) {
  const [stationsAll, linesAll, ...geos] = await Promise.all([
    fetch("https://raw.githubusercontent.com/piuccio/open-data-jp-railway-stations/master/stations.json").then(r => r.json()),
    fetch("https://raw.githubusercontent.com/piuccio/open-data-jp-railway-lines/master/lines.json").then(r => r.json()),
    ...Object.values(PREF_GEOJSON_URLS).map(url => fetch(url).then(r => r.json())),
  ]);

  // 近接県含む駅リスト（最寄り駅検索用）
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

  // 路線ID → 路線名
  const lineMap = {};
  for (const l of linesAll) lineMap[String(l.ekidata_id)] = l.name_kanji;

  // 市区町村ポリゴン（バウンディングボックス付き）
  const muniGeoms = {};
  for (const geo of geos) {
    for (const f of geo.features) {
      const name = muniName(f.properties);
      if (!name) continue;
      if (!muniGeoms[name]) {
        muniGeoms[name] = { rings: [], minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
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
      if (geom.type === "Polygon") addRing(geom.coordinates[0]);
      else if (geom.type === "MultiPolygon") geom.coordinates.forEach(p => addRing(p[0]));
    }
  }

  const nameToId = {};
  for (const m of municipalities) nameToId[m.name] = m.id;

  // 駅→市区町村マッチング
  const rawResult = [];
  const muniEntries = Object.entries(muniGeoms);
  for (const group of stationsAll) {
    if (!TARGET_PREFS.has(Number(group.prefecture))) continue;
    for (const s of group.stations) {
      if (!TARGET_PREFS.has(Number(s.prefecture))) continue;
      const lineName = lineMap[String(s.ekidata_line_id)];
      if (!lineName) continue;
      const lon = s.lon, lat = s.lat;
      if (!lon || !lat) continue;
      let muni = null;
      for (const [name, g] of muniEntries) {
        if (lon < g.minLon || lon > g.maxLon || lat < g.minLat || lat > g.maxLat) continue;
        for (const ring of g.rings) {
          if (pip(lon, lat, ring)) { muni = name; break; }
        }
        if (muni) break;
      }
      if (!muni) continue;
      const id = nameToId[muni];
      if (id == null) continue;
      rawResult.push({
        station: s.name_kanji || group.name_kanji,
        line: lineName,
        lineId: String(s.ekidata_line_id),
        municipality: muni,
        lat: parseFloat(s.lat),
        lon: parseFloat(s.lon),
      });
    }
  }

  // 路線→市区町村マップ & 市区町村→駅リスト
  const lineMuniMap = {};
  const muniStationsMap = {};
  const seen = {};
  for (const s of rawResult) {
    if (!lineMuniMap[s.line]) lineMuniMap[s.line] = new Set();
    lineMuniMap[s.line].add(s.municipality);
    if (!muniStationsMap[s.municipality]) { muniStationsMap[s.municipality] = []; seen[s.municipality] = new Set(); }
    const key = `${s.line}|${s.station}`;
    if (!seen[s.municipality].has(key)) {
      muniStationsMap[s.municipality].push({ station: s.station, line: s.line });
      seen[s.municipality].add(key);
    }
  }

  return { lineMuniMap, muniStationsMap, allStations: Object.values(stationByName), rawResult };
}

// ============================================================
// StationTab コンポーネント
// ============================================================
export default function StationTab({ stats, municipalities, onDataLoaded, initialLine, onInitialLineApplied }) {
  const [loadState, setLoadState] = useState("idle"); // idle | loading | ready | error
  const [enriched, setEnriched] = useState(null);
  const [allStations, setAllStations] = useState([]); // 近接駅リスト {name, lat, lon}
  const [transitResults, setTransitResults] = useState([]);
  const [transitLoading, setTransitLoading] = useState(false);
  const [debugStatus, setDebugStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedLine, setSelectedLine] = useState(null);
  const [lineSearch, setLineSearch] = useState("");
  const [showPosted, setShowPosted] = useState(false);
  const [viewMode, setViewMode] = useState("line"); // "line" | "nearest"
  const [nearestInput, setNearestInput] = useState("");
  const [nearestStation, setNearestStation] = useState(null);
  const [showNearestSuggest, setShowNearestSuggest] = useState(false);
  const pendingLineRef = useRef(null);

  // マウント時に自動ロード開始
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 外部から路線を指定された時の処理
  useEffect(() => {
    if (!initialLine) return;
    pendingLineRef.current = initialLine;
    onInitialLineApplied?.();
    if (loadState === "ready") {
      setSelectedLine(initialLine);
      pendingLineRef.current = null;
    }
  }, [initialLine]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── データ読み込み ──────────────────────────────────────────
  const load = () => {
    if (loadState !== "idle") return;
    setLoadState("loading");

    buildLineMuniData(municipalities).then(({ lineMuniMap, muniStationsMap, allStations: stations, rawResult }) => {
      setAllStations(stations);

      // posted フラグを付与（stats は UI 表示用のみ）
      const postedIds = new Set(Object.keys(stats.muniMap).map(Number));
      const nameToId = {};
      for (const m of municipalities) nameToId[m.name] = m.id;
      const result = rawResult.map(s => ({
        ...s,
        posted: postedIds.has(nameToId[s.municipality]),
      }));

      if (onDataLoaded) onDataLoaded({ lineMuniMap, muniStationsMap });
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

  // 最寄り駅が変わったら Vercel API 経由で乗換時間を取得
  useEffect(() => {
    if (!nearestStation || !enriched) return;
    let cancelled = false;
    setTransitLoading(true);
    setTransitResults([]);
    setDebugStatus(null);

    (async () => {
      const cache = (() => { try { return JSON.parse(localStorage.getItem(TRANSIT_CACHE_KEY) || "{}"); } catch { return {}; } })();

      // 市区町村ごとに直線距離が最短の駅を代表として選ぶ
      const muniMap = {};
      for (const s of enriched) {
        if (s.posted || !s.lat || !s.lon) continue;
        const km = haversine(nearestStation.lat, nearestStation.lon, s.lat, s.lon);
        if (!muniMap[s.municipality] || km < muniMap[s.municipality].km) {
          muniMap[s.municipality] = { station: s.station, line: s.line, lat: s.lat, lon: s.lon, km };
        }
      }

      // 直線距離上位 20 件に絞る
      const targets = Object.entries(muniMap)
        .map(([muni, v]) => ({ muni, ...v }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 20);

      // 5 件ずつ並列で API を叩く（キャッシュ優先）
      const results = [];
      for (let i = 0; i < targets.length; i += 5) {
        if (cancelled) break;
        const batch = targets.slice(i, i + 5);
        const batchRes = await Promise.all(batch.map(async (t) => {
          const cKey = `${nearestStation.name}→${t.station}`;
          let cached = cache[cKey];
          if (cached === undefined) {
            const { mins, status, detail } = await getTransitMinutes(nearestStation.lat, nearestStation.lon, t.lat, t.lon);
            if (mins !== null) { cache[cKey] = mins; cached = mins; }
            else { setDebugStatus(s => s || (status + (detail ? ": " + detail : ""))); }
          }
          return cached != null ? { ...t, mins: Math.round(cached) } : null;
        }));
        results.push(...batchRes.filter(Boolean));
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
  }, [nearestStation, enriched]);

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

  if (loadState === "idle" || loadState === "loading") {
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
            出発駅を入力すると、車での所要時間をもとに近い順に未配布エリアを表示します（上位20件）。電車ルートは「ルートを見る」ボタンで確認できます。
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
                  <div key={stn.name}
                    onPointerDown={() => { setNearestStation(stn); setNearestInput(stn.name); setShowNearestSuggest(false); }}
                    style={{ padding: "11px 14px", cursor: "pointer", fontSize: 14, color: "#e2e8f0", borderBottom: "1px solid #0f172a" }}
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
              <div>所要時間を検索中...</div>
              <div style={{ fontSize: 11, marginTop: 6 }}>Google Maps で経路を確認しています</div>
            </div>
          )}
          {nearestStation && !transitLoading && transitResults.length === 0 && (
            <div style={{ textAlign: "center", color: "#64748b", padding: "32px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🚫</div>
              <div>乗換ルートが見つかりませんでした</div>
              {debugStatus && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#f87171", background: "#1e293b", borderRadius: 6, padding: "6px 12px", display: "inline-block" }}>
                  エラー: {debugStatus}
                </div>
              )}
              <div style={{ fontSize: 11, marginTop: 8, color: "#475569" }}>別の駅で試してみてください</div>
            </div>
          )}
          {transitResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                <span>🚉 {nearestStation.name}駅から近い順（車）・未配布エリア {transitResults.length}件（上位20件）</span>
                {transitLoading && <span style={{ color: "#f59e0b", fontSize: 11 }}>検索中...</span>}
              </div>
              {transitResults.map((r, i) => {
                const color = r.mins <= 20 ? "#4ade80" : r.mins <= 40 ? "#f59e0b" : "#94a3b8";
                return (
                  <div key={r.muni} style={{
                    background: "#1e293b", border: "1px solid #334155",
                    borderRadius: 10, padding: "12px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                          🚗 車で約{r.mins}分
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>
                          📏 約{r.km.toFixed(1)}km
                        </div>
                      </div>
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${nearestStation.lat},${nearestStation.lon}&destination=${r.lat},${r.lon}&travelmode=transit`}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        display: "block", marginTop: 10,
                        textAlign: "center", fontSize: 12, fontWeight: 600,
                        color: "#38bdf8", background: "#0f172a",
                        borderRadius: 6, padding: "7px 0", textDecoration: "none",
                      }}
                    >
                      🗺️ Google Maps でルートを見る
                    </a>
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

          {/* フリーきっぷリンク */}
          {(() => {
            const l = selectedLine;
            const FREE_PASSES = [
              {
                name: "のんびりホリデーSuicaパス",
                url: "https://www.jreast.co.jp/tokyo/tickets_otoku/",
                match: s => ["高崎線","宇都宮線","東北本線","埼京線","川越線","武蔵野線","八高線",
                  "常磐線","湘南新宿","京浜東北","山手線","中央線","総武線","横浜線",
                  "南武線","根岸線","横須賀線","成田線","外房線","内房線","鶴見線",
                ].some(k => s.includes(k)),
              },
              {
                name: "ぐんまワンデーローカルパス",
                url: "https://media.jreast.co.jp/articles/1996",
                match: s => ["吾妻線","上越線","わたらせ","上毛電","両毛線","東武佐野","東武小泉",
                  "東武桐生","東武伊勢崎","高崎線","信越本線","上信",
                ].some(k => s.includes(k)),
              },
              {
                name: "東武のフリーきっぷ",
                url: "https://www.tobu.co.jp/odekake/ticket/",
                match: s => s.includes("東武"),
              },
              {
                name: "西武のフリーきっぷ",
                url: "https://www.seiburailway.jp/railway/ticket/specialticket/doraemon_kaitei-kiganjou/",
                match: s => s.includes("西武") && !["西武秩父線","多摩川線"].some(k => s.includes(k)),
              },
              {
                name: "西武秩父線のフリーきっぷ",
                url: "https://www.seiburailway.jp/railway/ticket/specialticket/chichibu-free-kippu-digital/",
                match: s => s.includes("西武秩父線"),
              },
              {
                name: "秩父鉄道のフリーきっぷ",
                url: "https://www.chichibu-railway.co.jp/information/couponpass.html",
                match: s => s.includes("秩父鉄道"),
              },
              {
                name: "関東鉄道のフリーきっぷ",
                url: "https://www.kantetsu.co.jp/train/special-ticket",
                match: s => ["常総線","真岡鐵道","竜ヶ崎線","関東鉄道"].some(k => s.includes(k)),
              },
              {
                name: "宇都宮ライトレールのフリーきっぷ",
                url: "https://www.miyarail.co.jp/cms/wp-content/uploads/2024/01/sample%EF%BC%88%E3%83%81%E3%83%A9%E3%82%B7%EF%BC%89.pdf",
                match: s => s.includes("ライトレール") || s.includes("宇都宮芳賀"),
              },
              {
                name: "つくばエクスプレスのフリーきっぷ",
                url: "https://www.mir.co.jp/service/otoku/",
                match: s => s.includes("つくばエクスプレス") || s.includes("TX"),
              },
            ];

            const matched = FREE_PASSES.filter(p => p.match(l));
            const links = matched.length > 0 ? matched : [{
              name: `${l} のフリーきっぷを検索`,
              url: `https://www.google.com/search?q=${encodeURIComponent(l + " フリーきっぷ")}`,
            }];

            const btnStyle = {
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px",
              background: "#1e293b", border: "1px solid #334155",
              borderRadius: 10, textDecoration: "none", color: "#38bdf8", fontSize: 13, fontWeight: 600,
            };
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {links.map(p => (
                  <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" style={btnStyle}>
                    🎫 {p.name}
                    <span style={{ marginLeft: "auto", fontSize: 16, color: "#475569" }}>›</span>
                  </a>
                ))}
              </div>
            );
          })()}

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
