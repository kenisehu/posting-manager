import { useEffect, useState, useRef, useMemo, useCallback } from "react";

const PREF_ID = {
  "茨城県": "ibaraki",
  "栃木県": "tochigi",
  "群馬県": "gunma",
  "埼玉県": "saitama",
};

const PREF_GEOJSON_URLS = {
  "茨城県": "https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/geojson/s0010/N03-21_08_210101.json",
  "栃木県": "https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/geojson/s0010/N03-21_09_210101.json",
  "群馬県": "https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/geojson/s0010/N03-21_10_210101.json",
  "埼玉県": "https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/geojson/s0010/N03-21_11_210101.json",
};

const PREF_COLORS_MAP = {
  "埼玉県": "#f59e0b",
  "栃木県": "#10b981",
  "茨城県": "#3b82f6",
  "群馬県": "#ec4899",
};

const PREF_BORDER_MAP = {
  "埼玉県": "#d97706",
  "栃木県": "#059669",
  "茨城県": "#2563eb",
  "群馬県": "#db2777",
};

// カバレッジ率（配布枚数/世帯数）でティアを返す（0=未投函, 1〜5）
function getCoverageTier(muniName, muniFlyers, households) {
  const flyers = muniFlyers?.[muniName];
  if (!flyers || !households) return 0;
  const pct = (flyers / households) * 100;
  if (pct < 0.5)  return 1;
  if (pct < 1.0)  return 2;
  if (pct < 1.5)  return 3;
  if (pct < 2.0)  return 4;
  return 5;
}

const COVERAGE_OPACITIES = [0, 0.18, 0.38, 0.60, 0.80, 1.0];
const COVERAGE_LABELS    = ["未投函", "〜0.5%", "0.5〜1%", "1〜1.5%", "1.5〜2%", "2%以上"];

function normalizeName(name) {
  if (!name) return "";
  return name.replace(/\s/g, "").replace("ヶ", "ケ").replace("ヵ", "カ").replace("龍", "竜");
}

function getAllCoords(geometry) {
  if (!geometry) return [];
  const coords = [];
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) coords.push(...ring);
  } else if (geometry.type === "MultiPolygon") {
    for (const poly of geometry.coordinates)
      for (const ring of poly) coords.push(...ring);
  }
  return coords;
}

function ringToPath(ring, project) {
  const pts = ring.map(([lon, lat]) => {
    const [x, y] = project(lon, lat);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return `M${pts.join("L")}Z`;
}

function geometryToPath(geometry, project) {
  if (!geometry) return "";
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map((ring) => ringToPath(ring, project)).join(" ");
  } else if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .map((poly) => poly.map((ring) => ringToPath(ring, project)).join(" "))
      .join(" ");
  }
  return "";
}

function makeProjection(geoDataMap, W, H, PAD) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const geojson of Object.values(geoDataMap)) {
    if (!geojson) continue;
    for (const feature of geojson.features || []) {
      for (const [lon, lat] of getAllCoords(feature.geometry)) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  const lonRange = maxLon - minLon;
  const latRange = maxLat - minLat;
  const drawW = W - PAD * 2;
  const drawH = H - PAD * 2;
  const scale = Math.min(drawW / lonRange, drawH / latRange);
  const offsetX = PAD + (drawW - lonRange * scale) / 2;
  const offsetY = PAD + (drawH - latRange * scale) / 2;
  return (lon, lat) => [
    offsetX + (lon - minLon) * scale,
    offsetY + (maxLat - lat) * scale,
  ];
}

function buildFeatures(geoDataMap, municipalitiesData, postedMunicipalityIds, project) {
  const result = [];
  for (const [pref, geojson] of Object.entries(geoDataMap)) {
    if (!geojson) continue;
    for (const feature of geojson.features || []) {
      const props = feature.properties || {};
      const normN03_004 = normalizeName(props.N03_004 || "");
      const normN03_003 = normalizeName(props.N03_003 || "");
      const normPropName = normalizeName(props.name || "");

      let muniMatch = normN03_004
        ? municipalitiesData.find((m) => m.prefecture === pref && normalizeName(m.name) === normN03_004)
        : null;
      if (!muniMatch && normN03_003)
        muniMatch = municipalitiesData.find((m) => m.prefecture === pref && normalizeName(m.name) === normN03_003);
      if (!muniMatch && normPropName)
        muniMatch = municipalitiesData.find((m) => m.prefecture === pref && normalizeName(m.name) === normPropName);

      const geoName = muniMatch?.name || normN03_004 || normN03_003 || normPropName;
      const isPosted = !!(muniMatch && postedMunicipalityIds.has(muniMatch.id));
      const d = geometryToPath(feature.geometry, project);
      if (d) result.push({ pref, geoName, muniMatch, isPosted, d });
    }
  }
  return result;
}

// ============================================================
// 合体地図（4県を1枚のSVGで表示）
// ============================================================
const COMB_W = 900, COMB_H = 620, COMB_PAD = 28;

function CombinedMap({ geoData, postedMunicipalityIds, municipalitiesData, onClickPref, onMuniClick, muniFlyers }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [hoveredPref, setHoveredPref] = useState(null);

  const features = useMemo(() => {
    if (Object.keys(geoData).length === 0) return [];
    const project = makeProjection(geoData, COMB_W, COMB_H, COMB_PAD);
    return buildFeatures(geoData, municipalitiesData, postedMunicipalityIds, project);
  }, [geoData, municipalitiesData, postedMunicipalityIds]);

  const handleMouseMove = useCallback((e, f) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const muniName = f.muniMatch?.name || f.geoName;
    const flyers = muniFlyers?.[muniName] || 0;
    const households = f.muniMatch?.households || 0;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pref: f.pref,
      name: muniName,
      households,
      isPosted: f.isPosted,
      flyers,
      coveragePct: households ? (flyers / households * 100) : null,
    });
    setHoveredPref(f.pref);
  }, [muniFlyers]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    setHoveredPref(null);
  }, []);

  const prefGroups = useMemo(() => {
    const map = {};
    for (const f of features) {
      if (!map[f.pref]) map[f.pref] = [];
      map[f.pref].push(f);
    }
    return map;
  }, [features]);

  return (
    <div style={{ position: "relative", background: "#e8eef5", borderRadius: 10, overflow: "hidden", border: "1px solid #cbd5e1" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${COMB_W} ${COMB_H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <defs>
          {Object.entries(PREF_ID).map(([pref, id]) => (
            <filter key={id} id={`pref-border-${id}`} x="-4%" y="-4%" width="108%" height="108%">
              <feMorphology in="SourceAlpha" operator="dilate" radius="5" result="dilated"/>
              <feComposite in="dilated" in2="SourceAlpha" operator="out" result="ring"/>
              <feFlood floodColor={PREF_BORDER_MAP[pref]} result="color"/>
              <feComposite in="color" in2="ring" operator="in"/>
            </filter>
          ))}
        </defs>

        <rect width={COMB_W} height={COMB_H} fill="#e8eef5" />

        {/* 市区町村の塗り（カバレッジ濃淡） */}
        {features.map((f, i) => {
          const color = PREF_COLORS_MAP[f.pref];
          const isHov = hoveredPref === f.pref;
          const muniName = f.muniMatch?.name || f.geoName;
          const tier = getCoverageTier(muniName, muniFlyers, f.muniMatch?.households);
          const fill = tier === 0 ? (isHov ? "#c0cedd" : "#d4dde8") : color;
          const fillOp = tier === 0 ? 1 : (isHov ? Math.min(1, COVERAGE_OPACITIES[tier] + 0.15) : COVERAGE_OPACITIES[tier]);
          return (
            <path
              key={i}
              d={f.d}
              fill={fill}
              fillOpacity={fillOp}
              stroke="#9aacbf"
              strokeWidth={0.4}
              style={{ cursor: "pointer" }}
              onClick={() => onClickPref(f.pref)}
              onMouseMove={(e) => handleMouseMove(e, f)}
              onMouseLeave={handleMouseLeave}
            />
          );
        })}

        {/* 県境の太線（feMorphologyで各県シルエット外周を描く） */}
        {Object.keys(PREF_GEOJSON_URLS).map((pref) => {
          const grp = prefGroups[pref];
          if (!grp) return null;
          const id = PREF_ID[pref];
          return (
            <g key={pref} filter={`url(#pref-border-${id})`} style={{ pointerEvents: "none" }}>
              {grp.map((f, i) => (
                <path key={i} d={f.d} fill="black" />
              ))}
            </g>
          );
        })}
      </svg>

      {/* カバレッジ凡例（左下） */}
      <div style={{
        position: "absolute", bottom: 10, left: 10,
        background: "rgba(255,255,255,0.88)", borderRadius: 6,
        padding: "6px 10px", fontSize: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}>
        <div style={{ fontWeight: 700, color: "#334155", marginBottom: 4, fontSize: 10 }}>カバレッジ率</div>
        {COVERAGE_LABELS.map((label, tier) => (
          <div key={tier} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <div style={{
              width: 14, height: 10, borderRadius: 2,
              background: tier === 0 ? "#d4dde8" : "#f59e0b",
              opacity: tier === 0 ? 1 : COVERAGE_OPACITIES[tier],
              border: "1px solid #b0b8c8",
            }} />
            <span style={{ color: "#475569" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* 都道府県ラベル（凡例） */}
      <div style={{
        position: "absolute", bottom: 10, right: 12,
        display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end",
      }}>
        {Object.entries(PREF_COLORS_MAP).map(([pref, color]) => (
          <div
            key={pref}
            onClick={() => onClickPref(pref)}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "rgba(255,255,255,0.85)", borderRadius: 4,
              padding: "3px 7px", fontSize: 11, fontWeight: 600,
              color: PREF_BORDER_MAP[pref], cursor: "pointer",
              border: `1px solid ${color}`,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            {pref}
          </div>
        ))}
      </div>

      {tooltip && (
        <div style={{
          position: "absolute",
          left: Math.min(tooltip.x + 14, COMB_W - 200),
          top: Math.max(tooltip.y - 80, 4),
          background: "white",
          border: `1px solid ${PREF_BORDER_MAP[tooltip.pref]}`,
          borderLeft: `4px solid ${PREF_COLORS_MAP[tooltip.pref]}`,
          borderRadius: 6, padding: "7px 12px", fontSize: 13,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10,
        }}>
          <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>{tooltip.name}</div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>{tooltip.pref}</div>
          {tooltip.households > 0 && (
            <div style={{ fontSize: 11, color: "#475569" }}>{tooltip.households.toLocaleString()} 世帯</div>
          )}
          {tooltip.flyers > 0 && (
            <div style={{ fontSize: 11, color: "#10b981", marginTop: 2 }}>
              📮 {tooltip.flyers.toLocaleString()}枚
              {tooltip.coveragePct != null && (
                <span style={{ color: "#64748b", marginLeft: 4 }}>({tooltip.coveragePct.toFixed(2)}%)</span>
              )}
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 600, color: tooltip.isPosted ? "#10b981" : "#64748b", marginTop: 2 }}>
            {tooltip.isPosted ? "✅ 投函済み" : "⬜ 未投函"}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 拡大表示（都道府県単体）
// ============================================================
const PREF_W = 700, PREF_H = 520, PREF_PAD = 24;

function PrefMap({ pref, geojson, postedMunicipalityIds, municipalitiesData, onMuniClick, muniFlyers }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const color = PREF_COLORS_MAP[pref];
  const borderColor = PREF_BORDER_MAP[pref];

  const features = useMemo(() => {
    if (!geojson) return [];
    const project = makeProjection({ [pref]: geojson }, PREF_W, PREF_H, PREF_PAD);
    return buildFeatures({ [pref]: geojson }, municipalitiesData, postedMunicipalityIds, project);
  }, [geojson, municipalitiesData, postedMunicipalityIds, pref]);

  const stats = useMemo(() => ({
    total: features.filter((f) => f.muniMatch).length,
    posted: features.filter((f) => f.isPosted).length,
  }), [features]);

  const handleMouseMove = useCallback((e, f, idx) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const muniName = f.muniMatch?.name || f.geoName;
    const flyers = muniFlyers?.[muniName] || 0;
    const households = f.muniMatch?.households || 0;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      name: muniName,
      households,
      isPosted: f.isPosted,
      flyers,
      coveragePct: households ? (flyers / households * 100) : null,
    });
    setHoveredIdx(idx);
  }, [muniFlyers]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    setHoveredIdx(null);
  }, []);

  const pct = stats.total > 0 ? Math.round((stats.posted / stats.total) * 100) : 0;

  return (
    <div style={{ background: "#1e293b", overflow: "hidden" }}>
      {/* ヘッダー */}
      <div style={{
        padding: "12px 16px", background: "#0f172a",
        borderBottom: `2px solid ${borderColor}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontWeight: 700, fontSize: 18, color }}>{pref}</div>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>
          投函済み <span style={{ color, fontWeight: 700 }}>{stats.posted}</span>
          {" "}/ {stats.total} 市区町村
          {stats.total > 0 && <span style={{ marginLeft: 6, color: "#64748b" }}>({pct}%)</span>}
        </div>
      </div>

      {/* プログレスバー */}
      <div style={{ height: 4, background: "#334155" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.4s ease" }} />
      </div>

      {/* SVG地図 */}
      <div style={{ position: "relative", background: "#f0f4f8" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${PREF_W} ${PREF_H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <rect width={PREF_W} height={PREF_H} fill="#e8eef5" />
          {features.map((f, i) => {
            const isHov = hoveredIdx === i;
            const muniName = f.muniMatch?.name || f.geoName;
            const tier = getCoverageTier(muniName, muniFlyers, f.muniMatch?.households);
            const fill = tier === 0 ? (isHov ? "#c8d3e0" : "#d4dde8") : color;
            const fillOp = tier === 0 ? 1 : (isHov ? Math.min(1, COVERAGE_OPACITIES[tier] + 0.15) : COVERAGE_OPACITIES[tier]);
            const strokeColor = tier === 0 ? "#9aacbf" : borderColor;
            const strokeW = tier === 0 ? (isHov ? 1.2 : 0.5) : (isHov ? 2.0 : 0.9);
            return (
              <path key={i} d={f.d}
                fill={fill} fillOpacity={fillOp}
                stroke={strokeColor} strokeWidth={strokeW}
                style={{ cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); onMuniClick?.(e, f); }}
                onMouseMove={(e) => handleMouseMove(e, f, i)}
                onMouseLeave={handleMouseLeave}
              />
            );
          })}
        </svg>

        {tooltip && (
          <div style={{
            position: "absolute",
            left: Math.min(tooltip.x + 14, PREF_W - 170),
            top: Math.max(tooltip.y - 60, 4),
            background: "white",
            border: `1px solid ${borderColor}`, borderLeft: `4px solid ${color}`,
            borderRadius: 6, padding: "7px 12px", fontSize: 13,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            pointerEvents: "none", whiteSpace: "nowrap", zIndex: 10,
          }}>
            <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>{tooltip.name}</div>
            {tooltip.households > 0 && (
              <div style={{ fontSize: 11, color: "#475569" }}>{tooltip.households.toLocaleString()} 世帯</div>
            )}
            {tooltip.flyers > 0 && (
              <div style={{ fontSize: 11, color: "#10b981", marginTop: 2 }}>
                📮 {tooltip.flyers.toLocaleString()}枚
                {tooltip.coveragePct != null && (
                  <span style={{ color: "#64748b", marginLeft: 4 }}>({tooltip.coveragePct.toFixed(2)}%)</span>
                )}
              </div>
            )}
            <div style={{ fontSize: 11, fontWeight: 600, color: tooltip.isPosted ? "#10b981" : "#64748b", marginTop: 2 }}>
              {tooltip.isPosted ? "✅ 投函済み" : "⬜ 未投函"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MapView メイン
// ============================================================
export default function MapView({ postedMunicipalityIds, municipalitiesData, expandedPref, setExpandedPref, muniStations, muniDanchi, muniFlyers }) {
  const [geoData, setGeoData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [muniPopup, setMuniPopup] = useState(null);

  const handleMuniClick = useCallback((e, f) => {
    setMuniPopup({
      name: f.muniMatch?.name || f.geoName,
      pref: f.pref,
      isPosted: f.isPosted,
      households: f.muniMatch?.households,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const results = await Promise.all(
          Object.entries(PREF_GEOJSON_URLS).map(async ([pref, url]) => {
            try {
              const res = await fetch(url);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const geojson = await res.json();
              return [pref, geojson];
            } catch (e) {
              console.warn(`${pref} GeoJSON fetch failed:`, e);
              return [pref, null];
            }
          })
        );
        if (!cancelled) {
          setGeoData(Object.fromEntries(results));
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) setError("地図の読み込みに失敗しました。");
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#ef4444" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
        <div>{error}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>インターネット接続を確認してください</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗾</div>
        <div style={{ fontSize: 14 }}>地図を読み込み中...</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* 操作ヒント */}
      <div style={{ fontSize: 12, color: "#64748b" }}>
        地図をタップ → 都道府県を拡大 → 市区町村をタップ → 利用できる駅を確認
      </div>

      {/* 合体地図 */}
      <CombinedMap
        geoData={geoData}
        postedMunicipalityIds={postedMunicipalityIds}
        municipalitiesData={municipalitiesData}
        onClickPref={setExpandedPref}
        onMuniClick={handleMuniClick}
        muniFlyers={muniFlyers}
      />

      {/* 拡大モーダル */}
      {expandedPref && (
        <div
          onClick={() => setExpandedPref(null)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.78)",
            zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 760,
              maxHeight: "92vh",
              display: "flex", flexDirection: "column",
              borderRadius: 12, overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* モーダルヘッダー（閉じる＋他県ナビ） */}
            <div style={{
              background: "#0f172a", padding: "8px 12px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              {Object.keys(PREF_GEOJSON_URLS).map((pref) => (
                <button
                  key={pref}
                  onClick={() => setExpandedPref(pref)}
                  style={{
                    background: expandedPref === pref ? PREF_COLORS_MAP[pref] : "transparent",
                    border: `1px solid ${PREF_COLORS_MAP[pref]}`,
                    color: expandedPref === pref ? "#0f172a" : PREF_COLORS_MAP[pref],
                    borderRadius: 5, padding: "4px 10px", fontSize: 12,
                    fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {pref}
                </button>
              ))}
              <button
                onClick={() => setExpandedPref(null)}
                style={{
                  marginLeft: "auto", background: "transparent",
                  border: "1px solid #475569", color: "#94a3b8",
                  borderRadius: 5, padding: "4px 12px", fontSize: 12, cursor: "pointer",
                }}
              >
                ✕ 閉じる
              </button>
            </div>

            <div style={{ overflowY: "auto" }}>
              <PrefMap
                pref={expandedPref}
                geojson={geoData[expandedPref]}
                postedMunicipalityIds={postedMunicipalityIds}
                municipalitiesData={municipalitiesData}
                onMuniClick={handleMuniClick}
                muniFlyers={muniFlyers}
              />
            </div>
          </div>
        </div>
      )}

      {/* 市区町村クリックポップアップ（fixed位置） */}
      {muniPopup && (() => {
        const borderColor = PREF_BORDER_MAP[muniPopup.pref] || "#334155";
        const prefColor = PREF_COLORS_MAP[muniPopup.pref] || "#94a3b8";
        const stations = muniStations?.[muniPopup.name] || [];
        const byLine = stations.reduce((acc, s) => {
          if (!acc[s.line]) acc[s.line] = [];
          acc[s.line].push(s.station);
          return acc;
        }, {});
        const popX = Math.min(muniPopup.clientX + 12, window.innerWidth - 270);
        const popY = Math.min(muniPopup.clientY - 10, window.innerHeight - 320);
        return (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "fixed", left: popX, top: popY,
              background: "#1e293b", border: `1.5px solid ${borderColor}`,
              borderTop: `3px solid ${prefColor}`,
              borderRadius: 10, padding: "12px 14px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              zIndex: 3000, minWidth: 220, maxWidth: 260,
              maxHeight: 320, overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 14 }}>{muniPopup.name}</div>
                <div style={{ fontSize: 10, color: "#64748b" }}>{muniPopup.pref}</div>
              </div>
              <button onClick={() => setMuniPopup(null)} style={{
                background: "none", border: "none", color: "#64748b",
                cursor: "pointer", fontSize: 18, padding: "0 0 0 8px", lineHeight: 1,
              }}>✕</button>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: muniPopup.isPosted ? "#4ade80" : "#f59e0b", marginBottom: 6 }}>
              {muniPopup.isPosted ? "✅ 投函済み" : "⬜ 未投函"}
              {muniPopup.households && <span style={{ color: "#64748b", fontWeight: 400, marginLeft: 6 }}>{muniPopup.households.toLocaleString()}世帯</span>}
            </div>
            {muniFlyers?.[muniPopup.name] && (
              <div style={{ fontSize: 11, color: "#4ade80", marginBottom: 10 }}>
                📮 配布済み：<strong>{muniFlyers[muniPopup.name].toLocaleString()}</strong>枚
                {muniPopup.households > 0 && (
                  <span style={{ color: "#64748b", marginLeft: 4 }}>
                    （カバレッジ率 {(muniFlyers[muniPopup.name] / muniPopup.households * 100).toFixed(2)}%）
                  </span>
                )}
              </div>
            )}
            {(() => {
              const danchiList = muniDanchi?.[muniPopup.name] || [];
              if (danchiList.length === 0) return null;
              return (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600, marginBottom: 5 }}>🏢 マンモス団地</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {danchiList.map(name => (
                      <a
                        key={name}
                        href={`https://www.google.com/maps/search/${encodeURIComponent(name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          background: "#0f172a", border: "1px solid #f59e0b44",
                          borderRadius: 6, padding: "5px 10px",
                          fontSize: 11, color: "#fbbf24", textDecoration: "none", fontWeight: 600,
                        }}
                      >
                        🏢 {name}
                        <span style={{ fontSize: 10, color: "#475569", marginLeft: 6 }}>地図 ›</span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
            {!muniStations ? (
              <div style={{ fontSize: 11, color: "#64748b" }}>🚉 路線タブを開くと駅情報が表示されます</div>
            ) : stations.length === 0 ? (
              <div style={{ fontSize: 11, color: "#64748b" }}>この市区町村に駅はありません</div>
            ) : (
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>🚃 利用できる駅</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(byLine).map(([line, stns]) => (
                    <div key={line}>
                      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>{line}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {stns.map(stn => (
                          <span key={stn} style={{
                            background: "#0f172a", border: "1px solid #334155",
                            borderRadius: 4, padding: "3px 8px", fontSize: 11, color: "#e2e8f0",
                          }}>🚉 {stn}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
