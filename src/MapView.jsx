import { useEffect, useState, useRef, useMemo, useCallback } from "react";

const PREF_CODES = {
  "茨城県": "08",
  "栃木県": "09",
  "群馬県": "10",
  "埼玉県": "11",
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

function getBounds(geojsonList) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const { geojson } of geojsonList) {
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
  return { minLon, maxLon, minLat, maxLat };
}

const SVG_W = 900;
const SVG_H = 640;
const PAD = 24;

export default function MapView({ postedMunicipalityIds, municipalitiesData }) {
  const [geoData, setGeoData] = useState([]);
  const [loadingMsg, setLoadingMsg] = useState("地図を読み込み中...");
  const [error, setError] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const prefectures = Object.keys(PREF_CODES);
        const results = await Promise.all(
          prefectures.map(async (pref) => {
            const code = PREF_CODES[pref];
            const url = `https://raw.githubusercontent.com/niiyz/JapanCityGeoJson/master/geojson/prefectures/${code}.json`;
            try {
              const res = await fetch(url);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const geojson = await res.json();
              return { pref, geojson };
            } catch (e) {
              console.warn(`${pref} GeoJSON fetch failed:`, e);
              return { pref, geojson: null };
            }
          })
        );
        if (!cancelled) {
          setGeoData(results);
          setLoadingMsg(null);
        }
      } catch (e) {
        if (!cancelled) setError("地図の読み込みに失敗しました。");
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // GeoJSONからSVGパスを計算（重い処理・geoDataが変わったときのみ）
  const { rawFeatures } = useMemo(() => {
    if (geoData.length === 0) return { rawFeatures: [] };

    const bounds = getBounds(geoData);
    const { minLon, maxLon, minLat, maxLat } = bounds;
    const lonRange = maxLon - minLon;
    const latRange = maxLat - minLat;
    const drawW = SVG_W - PAD * 2;
    const drawH = SVG_H - PAD * 2;
    const scale = Math.min(drawW / lonRange, drawH / latRange);
    const offsetX = PAD + (drawW - lonRange * scale) / 2;
    const offsetY = PAD + (drawH - latRange * scale) / 2;

    function project(lon, lat) {
      return [
        offsetX + (lon - minLon) * scale,
        offsetY + (maxLat - lat) * scale,
      ];
    }

    const rawFeatures = [];
    for (const { pref, geojson } of geoData) {
      if (!geojson) continue;
      for (const feature of geojson.features || []) {
        const props = feature.properties || {};
        // N03_004: 市区町村名（政令指定都市の場合は区名）
        // N03_003: 郡・政令市名（政令指定都市の場合は市名）
        const normN03_004 = normalizeName(props.N03_004 || "");
        const normN03_003 = normalizeName(props.N03_003 || "");
        const normPropName = normalizeName(props.name || "");

        // まず N03_004 で検索、なければ N03_003（政令指定都市対応）、最後に name で検索
        let muniMatch = normN03_004
          ? municipalitiesData.find((m) => m.prefecture === pref && normalizeName(m.name) === normN03_004)
          : null;
        if (!muniMatch && normN03_003) {
          muniMatch = municipalitiesData.find((m) => m.prefecture === pref && normalizeName(m.name) === normN03_003);
        }
        if (!muniMatch && normPropName) {
          muniMatch = municipalitiesData.find((m) => m.prefecture === pref && normalizeName(m.name) === normPropName);
        }

        const geoName = muniMatch?.name || normN03_004 || normN03_003 || normPropName;
        const d = geometryToPath(feature.geometry, project);
        if (d) rawFeatures.push({ pref, geoName, muniMatch, d });
      }
    }
    return { rawFeatures };
  }, [geoData, municipalitiesData]);

  // isPosted状態を付与（postedMunicipalityIdsが変わったときのみ）
  const features = useMemo(() =>
    rawFeatures.map((f) => ({
      ...f,
      isPosted: !!(f.muniMatch && postedMunicipalityIds.has(f.muniMatch.id)),
    })),
    [rawFeatures, postedMunicipalityIds]
  );

  const stats = useMemo(() => ({
    total: features.filter((f) => f.muniMatch).length,
    posted: features.filter((f) => f.isPosted).length,
  }), [features]);

  const handleMouseMove = useCallback((e, f, idx) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;
    setTooltip({ x, y, pref: f.pref, name: f.muniMatch?.name || f.geoName, households: f.muniMatch?.households, isPosted: f.isPosted });
    setHoveredIdx(idx);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    setHoveredIdx(null);
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

  if (loadingMsg) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗾</div>
        <div style={{ fontSize: 14 }}>{loadingMsg}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* 凡例＋統計 */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {Object.entries(PREF_COLORS_MAP).map(([pref, color]) => (
          <div key={pref} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b" }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: color, opacity: 0.7, border: `2px solid ${PREF_BORDER_MAP[pref]}` }} />
            {pref}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b" }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: "#e2e8f0", border: "2px solid #94a3b8" }} />
          投函済み
        </div>
        {stats.total > 0 && (
          <div style={{ marginLeft: "auto", fontSize: 13, color: "#475569" }}>
            投函済み <span style={{ color: "#f59e0b", fontWeight: 700 }}>{stats.posted}</span> / {stats.total} 市区町村
          </div>
        )}
      </div>

      {/* SVG地図 */}
      <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid #cbd5e1", background: "#ffffff" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          {/* 背景 */}
          <rect width={SVG_W} height={SVG_H} fill="#eef2f7" />

          {/* 市区町村パス */}
          {features.map((f, i) => {
            const color = PREF_COLORS_MAP[f.pref];
            const borderColor = PREF_BORDER_MAP[f.pref];
            const isHovered = hoveredIdx === i;
            if (f.isPosted) {
              return (
                <path
                  key={i}
                  d={f.d}
                  fill={isHovered ? "#cbd5e1" : "#e2e8f0"}
                  stroke="#94a3b8"
                  strokeWidth={isHovered ? 1.5 : 0.6}
                  style={{ cursor: "pointer" }}
                  onMouseMove={(e) => handleMouseMove(e, f, i)}
                  onMouseLeave={handleMouseLeave}
                />
              );
            }
            return (
              <path
                key={i}
                d={f.d}
                fill={color}
                fillOpacity={isHovered ? 0.85 : 0.55}
                stroke={borderColor}
                strokeWidth={isHovered ? 1.5 : 0.6}
                style={{ cursor: "pointer" }}
                onMouseMove={(e) => handleMouseMove(e, f, i)}
                onMouseLeave={handleMouseLeave}
              />
            );
          })}
        </svg>

        {/* ツールチップ */}
        {tooltip && (
          <div
            style={{
              position: "absolute",
              left: Math.min(tooltip.x + 14, SVG_W - 180),
              top: Math.max(tooltip.y - 60, 4),
              background: "white",
              border: `1px solid ${PREF_BORDER_MAP[tooltip.pref]}`,
              borderLeft: `4px solid ${PREF_COLORS_MAP[tooltip.pref]}`,
              borderRadius: 6,
              padding: "7px 12px",
              fontSize: 13,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              zIndex: 10,
            }}
          >
            <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>
              {tooltip.name}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>{tooltip.pref}</div>
            {tooltip.households && (
              <div style={{ fontSize: 11, color: "#475569" }}>{tooltip.households.toLocaleString()} 世帯</div>
            )}
            <div style={{ fontSize: 11, fontWeight: 600, color: tooltip.isPosted ? "#10b981" : "#ef4444", marginTop: 2 }}>
              {tooltip.isPosted ? "✅ 投函済み" : "⬜ 未投函"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
