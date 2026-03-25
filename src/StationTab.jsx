import { useState, useMemo } from "react";

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

// ============================================================
// StationTab コンポーネント
// ============================================================
export default function StationTab({ stats, municipalities, onDataLoaded }) {
  const [loadState, setLoadState] = useState("idle"); // idle | loading | ready | error
  const [enriched, setEnriched] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedLine, setSelectedLine] = useState(null);
  const [lineSearch, setLineSearch] = useState("");
  const [showPosted, setShowPosted] = useState(false);

  // ── データ読み込み ──────────────────────────────────────────
  const load = () => {
    if (loadState !== "idle") return;
    setLoadState("loading");

    Promise.all([
      fetch("https://raw.githubusercontent.com/piuccio/open-data-jp-railway-stations/master/stations.json").then(r => r.json()),
      fetch("https://raw.githubusercontent.com/piuccio/open-data-jp-railway-lines/master/lines.json").then(r => r.json()),
      ...Object.values(PREF_GEOJSON_URLS).map(url => fetch(url).then(r => r.json())),
    ]).then(([stationsAll, linesAll, ...geos]) => {

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
          });
        }
      }

      // 路線 → 市区町村マップを親に通知（路線制覇バッジ用）
      if (onDataLoaded) {
        const lineMuniMap = {};
        for (const s of result) {
          if (!lineMuniMap[s.line]) lineMuniMap[s.line] = new Set();
          lineMuniMap[s.line].add(s.municipality);
        }
        onDataLoaded(lineMuniMap);
      }

      setEnriched(result);
      setLoadState("ready");
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
      .sort((a, b) => b.unposted - a.unposted);
  }, [enriched]);

  const filteredLineList = useMemo(() => {
    const q = lineSearch.trim();
    return q ? lineList.filter(l => l.name.includes(q)) : lineList;
  }, [lineList, lineSearch]);

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
      {selectedLine ? (
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
      )}
    </div>
  );
}
