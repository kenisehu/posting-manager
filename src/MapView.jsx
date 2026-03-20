import { useEffect, useState, useRef } from "react";

// 都道府県コード
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

// GeoJSONのproperties内の市区町村名を正規化して一致判定
function normalizeName(name) {
  if (!name) return "";
  return name
    .replace(/\s/g, "")
    .replace("ヶ", "ケ")
    .replace("ヵ", "カ")
    .replace("龍", "竜")
    .replace("塙", "塙");
}

export default function MapView({ postedMunicipalityIds, municipalitiesData }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({});
  const [loadingMsg, setLoadingMsg] = useState("地図を読み込み中...");
  const [error, setError] = useState(null);
  const [filterPref, setFilterPref] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all"); // all / posted / unposted
  const [stats, setStats] = useState({ total: 0, posted: 0 });

  useEffect(() => {
    // Leafletをdynamic importで読み込む
    let L;
    let isMounted = true;

    async function initMap() {
      try {
        L = (await import("leaflet")).default;

        // マップ初期化（既存インスタンスがあれば削除）
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        if (!mapRef.current || !isMounted) return;

        const map = L.map(mapRef.current, {
          center: [36.3, 139.5],
          zoom: 8,
          zoomControl: true,
        });
        mapInstanceRef.current = map;

        // 国土地理院 淡色地図（市区町村境界が見やすい）
        L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
          attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
          maxZoom: 18,
        }).addTo(map);

        // 4県のGeoJSONを並行取得
        setLoadingMsg("市区町村データを取得中...");
        const prefectures = Object.keys(PREF_CODES);
        const results = await Promise.all(
          prefectures.map(async (pref) => {
            const code = PREF_CODES[pref];
            // 国土交通省 国土数値情報 行政区域データ (GitHub mirror)
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

        if (!isMounted) return;

        let totalCount = 0;
        let postedCount = 0;

        for (const { pref, geojson } of results) {
          if (!geojson) continue;
          const color = PREF_COLORS_MAP[pref];

          const layer = L.geoJSON(geojson, {
            style: (feature) => {
              const geoName = normalizeName(
                feature.properties?.N03_004 ||
                feature.properties?.name ||
                feature.properties?.N03_003 || ""
              );
              // municipalitiesDataから一致するIDを探す
              const muniMatch = municipalitiesData.find(
                (m) => m.prefecture === pref && normalizeName(m.name) === geoName
              );
              const isPosted = muniMatch && postedMunicipalityIds.has(muniMatch.id);
              totalCount++;
              if (isPosted) postedCount++;

              return {
                fillColor: isPosted ? "#1e293b" : color,
                fillOpacity: isPosted ? 0.3 : 0.65,
                color: isPosted ? "#334155" : color,
                weight: 1.2,
                opacity: 0.8,
              };
            },
            onEachFeature: (feature, layer) => {
              const geoName = normalizeName(
                feature.properties?.N03_004 ||
                feature.properties?.name ||
                feature.properties?.N03_003 || ""
              );
              const muniMatch = municipalitiesData.find(
                (m) => m.prefecture === pref && normalizeName(m.name) === geoName
              );
              const isPosted = muniMatch && postedMunicipalityIds.has(muniMatch.id);
              const displayName = muniMatch?.name || geoName;

              layer.bindTooltip(
                `<div style="font-family:sans-serif;font-size:13px;font-weight:bold;color:${isPosted ? color : "#94a3b8"}">
                  ${isPosted ? "✅" : "⬜"} ${pref} ${displayName}
                  ${muniMatch ? `<br/><span style="font-size:11px;color:#64748b">${muniMatch.households.toLocaleString()}世帯</span>` : ""}
                  <br/><span style="font-size:11px;color:${isPosted ? "#10b981" : "#ef4444"}">${isPosted ? "投函済み" : "未投函"}</span>
                </div>`,
                { sticky: true, opacity: 0.95 }
              );

              layer.on("mouseover", function () {
                this.setStyle({ weight: 2.5, fillOpacity: isPosted ? 0.5 : 0.85 });
              });
              layer.on("mouseout", function () {
                this.setStyle({ weight: 1.2, fillOpacity: isPosted ? 0.3 : 0.65 });
              });
            },
          }).addTo(map);

          layersRef.current[pref] = layer;
        }

        if (isMounted) {
          setStats({ total: totalCount, posted: postedCount });
          setLoadingMsg(null);
        }
      } catch (e) {
        console.error("Map init error:", e);
        if (isMounted) setError("地図の読み込みに失敗しました。インターネット接続を確認してください。");
      }
    }

    initMap();

    return () => {
      isMounted = false;
    };
  }, []); // 初回のみ

  // postedMunicipalityIdsが変わったらスタイルを更新
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    Object.entries(layersRef.current).forEach(([pref, layer]) => {
      const color = PREF_COLORS_MAP[pref];
      layer.eachLayer((l) => {
        const feature = l.feature;
        const geoName = normalizeName(
          feature?.properties?.N03_004 ||
          feature?.properties?.name ||
          feature?.properties?.N03_003 || ""
        );
        const muniMatch = municipalitiesData.find(
          (m) => m.prefecture === pref && normalizeName(m.name) === geoName
        );
        const isPosted = muniMatch && postedMunicipalityIds.has(muniMatch.id);
        l.setStyle({
          fillColor: isPosted ? "#1e293b" : color,
          fillOpacity: isPosted ? 0.3 : 0.65,
          color: isPosted ? "#334155" : color,
          weight: 1.2,
        });
      });
    });
  }, [postedMunicipalityIds]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* フィルターバー */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {/* 凡例 */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginRight: 8 }}>
          {Object.entries(PREF_COLORS_MAP).map(([pref, color]) => (
            <div key={pref} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#94a3b8" }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: color }} />
              {pref}（未投函）
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#94a3b8" }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: "#1e293b", border: "1px solid #334155" }} />
            投函済み
          </div>
        </div>
        {stats.total > 0 && (
          <div style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>
            投函済み <span style={{ color: "#f59e0b", fontWeight: 700 }}>{stats.posted}</span> / {stats.total} 市区町村
          </div>
        )}
      </div>

      {/* 地図 */}
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid #334155", background: "#0f172a" }}>
        {loadingMsg && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 1000, background: "#0f172a",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <div style={{ fontSize: 32 }}>🗾</div>
            <div style={{ color: "#64748b", fontSize: 14 }}>{loadingMsg}</div>
          </div>
        )}
        {error && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 1000, background: "#0f172a",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <div style={{ color: "#ef4444", fontSize: 14 }}>{error}</div>
            <div style={{ color: "#475569", fontSize: 12 }}>GeoJSONデータの取得にはインターネット接続が必要です</div>
          </div>
        )}
        <div ref={mapRef} style={{ height: "65vh", minHeight: 400, width: "100%" }} />
      </div>
    </div>
  );
}
