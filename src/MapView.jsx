import { useEffect, useState, useRef, useMemo, useCallback } from "react";

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

const SVG_W = 600;
const SVG_H = 460;
const PAD = 20;

// 都道府県単体の地図コンポーネント
function PrefMap({ pref, geojson, postedMunicipalityIds, municipalitiesData }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const color = PREF_COLORS_MAP[pref];
  const borderColor = PREF_BORDER_MAP[pref];

  const rawFeatures = useMemo(() => {
    if (!geojson) return [];

    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const feature of geojson.features || []) {
      for (const [lon, lat] of getAllCoords(feature.geometry)) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }

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

    const result = [];
    for (const feature of geojson.features || []) {
      const props = feature.properties || {};
      // N03_004: 市区町村名（政令指定都市の場合は区名）
      // N03_003: 郡・政令市名（政令指定都市の場合は市名）
      const normN03_004 = normalizeName(props.N03_004 || "");
      const normN03_003 = normalizeName(props.N03_003 || "");
      const normPropName = normalizeName(props.name || "");

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
      if (d) result.push({ pref, geoName, muniMatch, d });
    }
    return result;
  }, [geojson, municipalitiesData, pref]);

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
    setTooltip({
      x,
      y,
      name: f.muniMatch?.name || f.geoName,
      households: f.muniMatch?.households,
      isPosted: f.isPosted,
    });
    setHoveredIdx(idx);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    setHoveredIdx(null);
  }, []);

  const pct = stats.total > 0 ? Math.round((stats.posted / stats.total) * 100) : 0;

  return (
    <div style={{
      background: "#1e293b",
      borderRadius: 10,
      border: `1px solid ${borderColor}`,
      overflow: "hidden",
    }}>
      {/* ヘッダー */}
      <div style={{
        padding: "10px 14px",
        background: "#0f172a",
        borderBottom: `2px solid ${borderColor}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, color }}>
          {pref}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          投函済み{" "}
          <span style={{ color, fontWeight: 700 }}>{stats.posted}</span>
          {" "}/ {stats.total} 市区町村
          {stats.total > 0 && (
            <span style={{ marginLeft: 6, color: "#64748b" }}>({pct}%)</span>
          )}
        </div>
      </div>

      {/* プログレスバー */}
      <div style={{ height: 4, background: "#334155" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          transition: "width 0.4s ease",
        }} />
      </div>

      {/* SVG地図 */}
      <div style={{ position: "relative", background: "#f0f4f8" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <rect width={SVG_W} height={SVG_H} fill="#e8eef5" />

          {/* 未投函を先に描画（下レイヤー） */}
          {features.map((f, i) => {
            if (f.isPosted) return null;
            const isHovered = hoveredIdx === i;
            return (
              <path
                key={i}
                d={f.d}
                fill={isHovered ? "#c8d3e0" : "#d4dde8"}
                stroke="#9aacbf"
                strokeWidth={isHovered ? 1.2 : 0.5}
                style={{ cursor: "pointer" }}
                onMouseMove={(e) => handleMouseMove(e, f, i)}
                onMouseLeave={handleMouseLeave}
              />
            );
          })}

          {/* 投函済みを上に描画（都道府県カラー） */}
          {features.map((f, i) => {
            if (!f.isPosted) return null;
            const isHovered = hoveredIdx === i;
            return (
              <path
                key={i}
                d={f.d}
                fill={color}
                fillOpacity={isHovered ? 1.0 : 0.85}
                stroke={borderColor}
                strokeWidth={isHovered ? 2.0 : 0.9}
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
              left: Math.min(tooltip.x + 14, SVG_W - 170),
              top: Math.max(tooltip.y - 60, 4),
              background: "white",
              border: `1px solid ${borderColor}`,
              borderLeft: `4px solid ${color}`,
              borderRadius: 6,
              padding: "7px 12px",
              fontSize: 13,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              zIndex: 10,
            }}
          >
            <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>
              {tooltip.name}
            </div>
            {tooltip.households && (
              <div style={{ fontSize: 11, color: "#475569" }}>
                {tooltip.households.toLocaleString()} 世帯
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

export default function MapView({ postedMunicipalityIds, municipalitiesData }) {
  const [geoData, setGeoData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const prefectures = Object.keys(PREF_GEOJSON_URLS);
        const results = await Promise.all(
          prefectures.map(async (pref) => {
            const url = PREF_GEOJSON_URLS[pref];
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 凡例 */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: "#64748b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: "#f59e0b", border: "2px solid #d97706" }} />
          投函済み（都道府県カラー）
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: "#d4dde8", border: "2px solid #9aacbf" }} />
          未投函
        </div>
      </div>

      {/* 都道府県ごとの地図（2列グリッド） */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {Object.keys(PREF_GEOJSON_URLS).map((pref) => (
          <PrefMap
            key={pref}
            pref={pref}
            geojson={geoData[pref]}
            postedMunicipalityIds={postedMunicipalityIds}
            municipalitiesData={municipalitiesData}
          />
        ))}
      </div>
    </div>
  );
}
