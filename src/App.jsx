import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
const MapView = lazy(() => import("./MapView.jsx"));
const StationTab = lazy(() => import("./StationTab.jsx"));

// ============================================================
// Supabase 設定
// ============================================================
const SUPABASE_URL = "https://obihljkqkfikzibvnvqp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iaWhsamtxa2Zpa3ppYnZudnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5Mzk0ODQsImV4cCI6MjA4NzUxNTQ4NH0.4BwUWzXxjDNWoup1PXNDLApPUJnW2LLr3FLCELPQIRs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// 市区町村マスタデータ（世帯数付き）
// ============================================================
const MUNICIPALITIES_DATA = [
  // 埼玉県
  { id: 1, prefecture: "埼玉県", name: "さいたま市", households: 584000 },
  { id: 2, prefecture: "埼玉県", name: "川口市", households: 290000 },
  { id: 3, prefecture: "埼玉県", name: "川越市", households: 173000 },
  { id: 4, prefecture: "埼玉県", name: "所沢市", households: 178000 },
  { id: 5, prefecture: "埼玉県", name: "越谷市", households: 165000 },
  { id: 6, prefecture: "埼玉県", name: "草加市", households: 127000 },
  { id: 7, prefecture: "埼玉県", name: "春日部市", households: 118000 },
  { id: 8, prefecture: "埼玉県", name: "上尾市", households: 115000 },
  { id: 9, prefecture: "埼玉県", name: "熊谷市", households: 95000 },
  { id: 10, prefecture: "埼玉県", name: "朝霞市", households: 71000 },
  { id: 11, prefecture: "埼玉県", name: "新座市", households: 72000 },
  { id: 12, prefecture: "埼玉県", name: "狭山市", households: 68000 },
  { id: 13, prefecture: "埼玉県", name: "入間市", households: 65000 },
  { id: 14, prefecture: "埼玉県", name: "久喜市", households: 63000 },
  { id: 15, prefecture: "埼玉県", name: "鴻巣市", households: 53000 },
  { id: 16, prefecture: "埼玉県", name: "深谷市", households: 58000 },
  { id: 17, prefecture: "埼玉県", name: "三郷市", households: 59000 },
  { id: 18, prefecture: "埼玉県", name: "富士見市", households: 52000 },
  { id: 19, prefecture: "埼玉県", name: "ふじみ野市", households: 51000 },
  { id: 20, prefecture: "埼玉県", name: "戸田市", households: 70000 },
  { id: 21, prefecture: "埼玉県", name: "蕨市", households: 38000 },
  { id: 22, prefecture: "埼玉県", name: "和光市", households: 38000 },
  { id: 23, prefecture: "埼玉県", name: "志木市", households: 32000 },
  { id: 24, prefecture: "埼玉県", name: "桶川市", households: 32000 },
  { id: 25, prefecture: "埼玉県", name: "北本市", households: 28000 },
  { id: 26, prefecture: "埼玉県", name: "行田市", households: 36000 },
  { id: 27, prefecture: "埼玉県", name: "加須市", households: 47000 },
  { id: 28, prefecture: "埼玉県", name: "羽生市", households: 22000 },
  { id: 29, prefecture: "埼玉県", name: "鶴ヶ島市", households: 24000 },
  { id: 30, prefecture: "埼玉県", name: "日高市", households: 23000 },
  { id: 31, prefecture: "埼玉県", name: "坂戸市", households: 36000 },
  { id: 32, prefecture: "埼玉県", name: "東松山市", households: 36000 },
  { id: 33, prefecture: "埼玉県", name: "滑川町", households: 7000 },
  { id: 34, prefecture: "埼玉県", name: "嵐山町", households: 7000 },
  { id: 35, prefecture: "埼玉県", name: "小川町", households: 12000 },
  { id: 36, prefecture: "埼玉県", name: "川島町", households: 6000 },
  { id: 37, prefecture: "埼玉県", name: "吉見町", households: 7000 },
  { id: 38, prefecture: "埼玉県", name: "鳩山町", households: 5000 },
  { id: 39, prefecture: "埼玉県", name: "ときがわ町", households: 5000 },
  { id: 40, prefecture: "埼玉県", name: "秩父市", households: 28000 },
  { id: 41, prefecture: "埼玉県", name: "横瀬町", households: 3000 },
  { id: 42, prefecture: "埼玉県", name: "皆野町", households: 5000 },
  { id: 43, prefecture: "埼玉県", name: "長瀞町", households: 3000 },
  { id: 44, prefecture: "埼玉県", name: "小鹿野町", households: 5000 },
  { id: 45, prefecture: "埼玉県", name: "東秩父村", households: 1000 },
  { id: 46, prefecture: "埼玉県", name: "本庄市", households: 38000 },
  { id: 47, prefecture: "埼玉県", name: "美里町", households: 5000 },
  { id: 48, prefecture: "埼玉県", name: "神川町", households: 6000 },
  { id: 49, prefecture: "埼玉県", name: "上里町", households: 12000 },
  { id: 50, prefecture: "埼玉県", name: "寄居町", households: 14000 },
  { id: 51, prefecture: "埼玉県", name: "宮代町", households: 13000 },
  { id: 52, prefecture: "埼玉県", name: "杉戸町", households: 22000 },
  { id: 53, prefecture: "埼玉県", name: "松伏町", households: 11000 },
  { id: 54, prefecture: "埼玉県", name: "白岡市", households: 19000 },
  { id: 55, prefecture: "埼玉県", name: "蓮田市", households: 24000 },
  { id: 56, prefecture: "埼玉県", name: "幸手市", households: 22000 },
  { id: 57, prefecture: "埼玉県", name: "八潮市", households: 34000 },
  { id: 58, prefecture: "埼玉県", name: "吉川市", households: 31000 },
  { id: 59, prefecture: "埼玉県", name: "伊奈町", households: 21000 },
  { id: 160, prefecture: "埼玉県", name: "飯能市", households: 39000 },
  { id: 161, prefecture: "埼玉県", name: "三芳町", households: 13000 },
  { id: 162, prefecture: "埼玉県", name: "毛呂山町", households: 12000 },
  { id: 163, prefecture: "埼玉県", name: "越生町", households: 5000 },
  // 栃木県
  { id: 60, prefecture: "栃木県", name: "宇都宮市", households: 250000 },
  { id: 61, prefecture: "栃木県", name: "小山市", households: 88000 },
  { id: 62, prefecture: "栃木県", name: "栃木市", households: 66000 },
  { id: 63, prefecture: "栃木県", name: "佐野市", households: 55000 },
  { id: 64, prefecture: "栃木県", name: "足利市", households: 65000 },
  { id: 65, prefecture: "栃木県", name: "鹿沼市", households: 41000 },
  { id: 66, prefecture: "栃木県", name: "日光市", households: 35000 },
  { id: 67, prefecture: "栃木県", name: "大田原市", households: 28000 },
  { id: 68, prefecture: "栃木県", name: "矢板市", households: 13000 },
  { id: 69, prefecture: "栃木県", name: "那須塩原市", households: 49000 },
  { id: 70, prefecture: "栃木県", name: "真岡市", households: 30000 },
  { id: 71, prefecture: "栃木県", name: "下野市", households: 26000 },
  { id: 72, prefecture: "栃木県", name: "那須烏山市", households: 10000 },
  { id: 73, prefecture: "栃木県", name: "上三川町", households: 11000 },
  { id: 74, prefecture: "栃木県", name: "益子町", households: 8000 },
  { id: 75, prefecture: "栃木県", name: "茂木町", households: 7000 },
  { id: 76, prefecture: "栃木県", name: "市貝町", households: 6000 },
  { id: 77, prefecture: "栃木県", name: "芳賀町", households: 7000 },
  { id: 78, prefecture: "栃木県", name: "壬生町", households: 18000 },
  { id: 79, prefecture: "栃木県", name: "野木町", households: 12000 },
  { id: 80, prefecture: "栃木県", name: "塩谷町", households: 5000 },
  { id: 81, prefecture: "栃木県", name: "高根沢町", households: 11000 },
  { id: 82, prefecture: "栃木県", name: "那須町", households: 14000 },
  { id: 83, prefecture: "栃木県", name: "那珂川町", households: 7000 },
  { id: 164, prefecture: "栃木県", name: "さくら市", households: 32000 },
  // 茨城県
  { id: 84, prefecture: "茨城県", name: "水戸市", households: 133000 },
  { id: 85, prefecture: "茨城県", name: "つくば市", households: 118000 },
  { id: 86, prefecture: "茨城県", name: "日立市", households: 83000 },
  { id: 87, prefecture: "茨城県", name: "古河市", households: 60000 },
  { id: 88, prefecture: "茨城県", name: "ひたちなか市", households: 78000 },
  { id: 89, prefecture: "茨城県", name: "土浦市", households: 65000 },
  { id: 90, prefecture: "茨城県", name: "取手市", households: 46000 },
  { id: 91, prefecture: "茨城県", name: "龍ケ崎市", households: 33000 },
  { id: 92, prefecture: "茨城県", name: "鹿嶋市", households: 31000 },
  { id: 93, prefecture: "茨城県", name: "神栖市", households: 41000 },
  { id: 94, prefecture: "茨城県", name: "筑西市", households: 39000 },
  { id: 95, prefecture: "茨城県", name: "常総市", households: 28000 },
  { id: 96, prefecture: "茨城県", name: "笠間市", households: 28000 },
  { id: 97, prefecture: "茨城県", name: "坂東市", households: 22000 },
  { id: 98, prefecture: "茨城県", name: "牛久市", households: 36000 },
  { id: 99, prefecture: "茨城県", name: "石岡市", households: 26000 },
  { id: 100, prefecture: "茨城県", name: "那珂市", households: 22000 },
  { id: 101, prefecture: "茨城県", name: "稲敷市", households: 18000 },
  { id: 102, prefecture: "茨城県", name: "鉾田市", households: 20000 },
  { id: 103, prefecture: "茨城県", name: "行方市", households: 17000 },
  { id: 104, prefecture: "茨城県", name: "小美玉市", households: 20000 },
  { id: 105, prefecture: "茨城県", name: "桜川市", households: 19000 },
  { id: 106, prefecture: "茨城県", name: "常陸大宮市", households: 16000 },
  { id: 107, prefecture: "茨城県", name: "常陸太田市", households: 20000 },
  { id: 108, prefecture: "茨城県", name: "つくばみらい市", households: 20000 },
  { id: 109, prefecture: "茨城県", name: "守谷市", households: 30000 },
  { id: 110, prefecture: "茨城県", name: "北茨城市", households: 22000 },
  { id: 111, prefecture: "茨城県", name: "高萩市", households: 12000 },
  { id: 112, prefecture: "茨城県", name: "潮来市", households: 14000 },
  { id: 113, prefecture: "茨城県", name: "茨城町", households: 13000 },
  { id: 114, prefecture: "茨城県", name: "大洗町", households: 9000 },
  { id: 115, prefecture: "茨城県", name: "城里町", households: 8000 },
  { id: 116, prefecture: "茨城県", name: "東海村", households: 17000 },
  { id: 117, prefecture: "茨城県", name: "大子町", households: 9000 },
  { id: 118, prefecture: "茨城県", name: "阿見町", households: 22000 },
  { id: 119, prefecture: "茨城県", name: "美浦村", households: 5000 },
  { id: 120, prefecture: "茨城県", name: "河内町", households: 4000 },
  { id: 121, prefecture: "茨城県", name: "八千代町", households: 7000 },
  { id: 122, prefecture: "茨城県", name: "五霞町", households: 4000 },
  { id: 123, prefecture: "茨城県", name: "境町", households: 12000 },
  { id: 124, prefecture: "茨城県", name: "利根町", households: 7000 },
  { id: 165, prefecture: "茨城県", name: "結城市", households: 26000 },
  { id: 166, prefecture: "茨城県", name: "下妻市", households: 17000 },
  { id: 167, prefecture: "茨城県", name: "かすみがうら市", households: 17000 },
  // 群馬県
  { id: 125, prefecture: "群馬県", name: "前橋市", households: 175000 },
  { id: 126, prefecture: "群馬県", name: "高崎市", households: 214000 },
  { id: 127, prefecture: "群馬県", name: "桐生市", households: 59000 },
  { id: 128, prefecture: "群馬県", name: "伊勢崎市", households: 90000 },
  { id: 129, prefecture: "群馬県", name: "太田市", households: 107000 },
  { id: 130, prefecture: "群馬県", name: "沼田市", households: 19000 },
  { id: 131, prefecture: "群馬県", name: "館林市", households: 34000 },
  { id: 132, prefecture: "群馬県", name: "渋川市", households: 33000 },
  { id: 133, prefecture: "群馬県", name: "藤岡市", households: 28000 },
  { id: 134, prefecture: "群馬県", name: "富岡市", households: 22000 },
  { id: 135, prefecture: "群馬県", name: "安中市", households: 24000 },
  { id: 136, prefecture: "群馬県", name: "みどり市", households: 22000 },
  { id: 137, prefecture: "群馬県", name: "榛東村", households: 5000 },
  { id: 138, prefecture: "群馬県", name: "吉岡町", households: 10000 },
  { id: 139, prefecture: "群馬県", name: "上野村", households: 500 },
  { id: 140, prefecture: "群馬県", name: "神流町", households: 800 },
  { id: 141, prefecture: "群馬県", name: "下仁田町", households: 4000 },
  { id: 142, prefecture: "群馬県", name: "南牧村", households: 900 },
  { id: 143, prefecture: "群馬県", name: "甘楽町", households: 7000 },
  { id: 144, prefecture: "群馬県", name: "中之条町", households: 8000 },
  { id: 145, prefecture: "群馬県", name: "長野原町", households: 3000 },
  { id: 146, prefecture: "群馬県", name: "嬬恋村", households: 5000 },
  { id: 147, prefecture: "群馬県", name: "草津町", households: 3000 },
  { id: 148, prefecture: "群馬県", name: "高山村", households: 1000 },
  { id: 149, prefecture: "群馬県", name: "東吾妻町", households: 6000 },
  { id: 150, prefecture: "群馬県", name: "片品村", households: 2000 },
  { id: 151, prefecture: "群馬県", name: "川場村", households: 1500 },
  { id: 152, prefecture: "群馬県", name: "昭和村", households: 2000 },
  { id: 153, prefecture: "群馬県", name: "みなかみ町", households: 9000 },
  { id: 154, prefecture: "群馬県", name: "玉村町", households: 18000 },
  { id: 155, prefecture: "群馬県", name: "板倉町", households: 7000 },
  { id: 156, prefecture: "群馬県", name: "明和町", households: 7000 },
  { id: 157, prefecture: "群馬県", name: "千代田町", households: 6000 },
  { id: 158, prefecture: "群馬県", name: "大泉町", households: 17000 },
  { id: 159, prefecture: "群馬県", name: "邑楽町", households: 13000 },
];

const PREFECTURES = ["埼玉県", "栃木県", "茨城県", "群馬県"];

// マンモス団地データ（市区町村名 → 団地名リスト）
const MAMMOTH_DANCHI = {
  "取手市":    ["取手井野団地", "戸頭団地"],
  "川口市":    ["芝園団地"],
  "さいたま市": ["田島団地"],
  "所沢市":    ["プラザシティ新所沢"],
  "上尾市":    ["原市団地", "西上尾団地"],
  "草加市":    ["コンフォール松原"],
  "越谷市":    ["せんげん台パークタウン"],
  "春日部市":  ["武里団地"],
  "狭山市":    ["狭山台団地"],
  "志木市":    ["志木ニュータウン"],
  "新座市":    ["新座団地"],
  "久喜市":    ["わし宮団地"],
  "北本市":    ["北本団地"],
  "富士見市":  ["アルビス鶴瀬", "コンフォール鶴瀬"],
  "三郷市":    ["みさと団地"],
  "坂戸市":    ["若葉台団地", "東坂戸団地", "北坂戸団地"],
  "鶴ヶ島市":  ["若葉台団地", "かわつるグリーンタウン"],
  "幸手市":    ["幸手団地"],
  "吉川市":    ["吉川団地"],
  "ふじみ野市": ["コンフォール霞ヶ丘", "コンフォール上野台"],
};

const PREF_COLORS = {
  "埼玉県": { bg: "#fef3c7", accent: "#f59e0b", text: "#92400e" },
  "栃木県": { bg: "#d1fae5", accent: "#10b981", text: "#065f46" },
  "茨城県": { bg: "#dbeafe", accent: "#3b82f6", text: "#1e3a5f" },
  "群馬県": { bg: "#fce7f3", accent: "#ec4899", text: "#831843" },
};

// ============================================================
// 近隣市区町村データ（市区町村名 → 隣接する市区町村名リスト）
// ============================================================
const NEIGHBORS = {
  // 埼玉県
  "さいたま市": ["川口市", "蕨市", "戸田市", "朝霞市", "志木市", "富士見市", "川越市", "桶川市", "上尾市", "伊奈町", "白岡市", "蓮田市"],
  "川口市": ["さいたま市", "蕨市", "草加市", "八潮市", "戸田市"],
  "川越市": ["さいたま市", "富士見市", "ふじみ野市", "所沢市", "狭山市", "入間市", "坂戸市", "鶴ヶ島市", "日高市", "東松山市", "川島町"],
  "所沢市": ["川越市", "入間市", "狭山市", "新座市", "志木市", "富士見市", "ふじみ野市"],
  "越谷市": ["草加市", "八潮市", "三郷市", "吉川市", "春日部市", "さいたま市"],
  "草加市": ["川口市", "八潮市", "越谷市", "さいたま市"],
  "春日部市": ["越谷市", "吉川市", "松伏町", "杉戸町", "宮代町", "白岡市", "久喜市"],
  "上尾市": ["さいたま市", "桶川市", "北本市", "伊奈町", "蓮田市"],
  "熊谷市": ["深谷市", "行田市", "鴻巣市", "東松山市", "寄居町", "美里町"],
  "朝霞市": ["さいたま市", "志木市", "新座市", "和光市"],
  "新座市": ["さいたま市", "朝霞市", "志木市", "富士見市", "所沢市"],
  "狭山市": ["所沢市", "入間市", "川越市", "日高市"],
  "入間市": ["所沢市", "狭山市", "川越市", "日高市", "飯能市"],
  "久喜市": ["春日部市", "幸手市", "白岡市", "蓮田市", "杉戸町", "加須市"],
  "鴻巣市": ["さいたま市", "桶川市", "北本市", "熊谷市", "行田市", "加須市"],
  "深谷市": ["熊谷市", "本庄市", "美里町", "寄居町"],
  "三郷市": ["越谷市", "吉川市", "八潮市", "草加市"],
  "富士見市": ["さいたま市", "所沢市", "新座市", "志木市", "ふじみ野市", "川越市"],
  "ふじみ野市": ["富士見市", "川越市", "所沢市", "三芳町"],
  "戸田市": ["さいたま市", "川口市", "蕨市"],
  "蕨市": ["さいたま市", "川口市", "戸田市"],
  "和光市": ["さいたま市", "朝霞市", "新座市"],
  "志木市": ["さいたま市", "朝霞市", "新座市", "富士見市"],
  "桶川市": ["さいたま市", "上尾市", "北本市", "鴻巣市"],
  "北本市": ["さいたま市", "上尾市", "桶川市", "鴻巣市", "東松山市"],
  "行田市": ["熊谷市", "鴻巣市", "加須市"],
  "加須市": ["行田市", "鴻巣市", "久喜市", "羽生市"],
  "羽生市": ["加須市", "熊谷市"],
  "鶴ヶ島市": ["川越市", "坂戸市", "日高市"],
  "日高市": ["川越市", "狭山市", "入間市", "鶴ヶ島市", "飯能市"],
  "坂戸市": ["川越市", "鶴ヶ島市", "東松山市"],
  "東松山市": ["川越市", "坂戸市", "熊谷市", "北本市", "滑川町", "嵐山町"],
  "本庄市": ["深谷市", "上里町", "神川町"],
  "白岡市": ["さいたま市", "蓮田市", "久喜市", "宮代町", "春日部市"],
  "蓮田市": ["さいたま市", "上尾市", "伊奈町", "白岡市", "久喜市"],
  "幸手市": ["久喜市", "杉戸町", "春日部市"],
  "八潮市": ["川口市", "草加市", "越谷市", "三郷市"],
  "吉川市": ["越谷市", "三郷市", "松伏町", "春日部市"],
  "伊奈町": ["さいたま市", "上尾市", "蓮田市"],
  "杉戸町": ["春日部市", "幸手市", "久喜市", "松伏町"],
  "松伏町": ["春日部市", "吉川市", "杉戸町"],
  "宮代町": ["春日部市", "白岡市", "久喜市"],
  "滑川町": ["東松山市", "嵐山町", "熊谷市"],
  "嵐山町": ["東松山市", "滑川町", "小川町"],
  "小川町": ["嵐山町", "寄居町", "東秩父村"],
  "川島町": ["川越市", "東松山市"],
  "吉見町": ["東松山市", "川島町", "熊谷市"],
  "寄居町": ["熊谷市", "深谷市", "小川町"],
  "上里町": ["本庄市", "神川町", "熊谷市"],
  "神川町": ["本庄市", "上里町"],
  // 栃木県
  "宇都宮市": ["鹿沼市", "日光市", "壬生町", "下野市", "上三川町", "芳賀町", "高根沢町", "塩谷町"],
  "小山市": ["栃木市", "下野市", "野木町", "結城市"],
  "栃木市": ["小山市", "下野市", "壬生町", "佐野市"],
  "佐野市": ["栃木市", "足利市"],
  "足利市": ["佐野市", "桐生市"],
  "鹿沼市": ["宇都宮市", "日光市", "壬生町", "塩谷町"],
  "日光市": ["宇都宮市", "鹿沼市", "塩谷町", "那須塩原市"],
  "那須塩原市": ["日光市", "大田原市", "那須町", "矢板市"],
  "真岡市": ["下野市", "上三川町", "益子町", "芳賀町", "市貝町"],
  "下野市": ["宇都宮市", "小山市", "栃木市", "壬生町", "上三川町", "真岡市"],
  "壬生町": ["宇都宮市", "鹿沼市", "栃木市", "下野市"],
  "上三川町": ["宇都宮市", "下野市", "真岡市"],
  "益子町": ["真岡市", "芳賀町", "茂木町"],
  "芳賀町": ["宇都宮市", "真岡市", "益子町", "市貝町"],
  "高根沢町": ["宇都宮市", "塩谷町", "那須塩原市"],
  "那須町": ["那須塩原市", "大田原市"],
  "大田原市": ["那須塩原市", "那須町", "矢板市", "那珂川町"],
  "矢板市": ["那須塩原市", "大田原市", "塩谷町", "高根沢町"],
  "野木町": ["小山市", "栃木市"],
  // 茨城県
  "水戸市": ["ひたちなか市", "那珂市", "茨城町", "城里町", "笠間市"],
  "つくば市": ["土浦市", "牛久市", "つくばみらい市", "常総市", "筑西市", "桜川市"],
  "日立市": ["高萩市", "北茨城市", "常陸太田市", "那珂市", "ひたちなか市"],
  "ひたちなか市": ["水戸市", "那珂市", "東海村"],
  "土浦市": ["つくば市", "牛久市", "阿見町", "石岡市"],
  "取手市": ["守谷市", "龍ケ崎市", "利根町"],
  "龍ケ崎市": ["取手市", "守谷市", "牛久市", "阿見町", "稲敷市"],
  "神栖市": ["鹿嶋市", "潮来市"],
  "鹿嶋市": ["神栖市", "潮来市", "行方市"],
  "筑西市": ["つくば市", "桜川市", "常総市", "結城市"],
  "常総市": ["つくば市", "筑西市", "坂東市", "守谷市", "つくばみらい市"],
  "笠間市": ["水戸市", "茨城町", "城里町", "桜川市", "石岡市"],
  "牛久市": ["つくば市", "土浦市", "龍ケ崎市", "阿見町"],
  "守谷市": ["取手市", "龍ケ崎市", "常総市", "つくばみらい市"],
  "那珂市": ["水戸市", "ひたちなか市", "東海村", "常陸太田市", "城里町"],
  "つくばみらい市": ["つくば市", "守谷市", "常総市", "龍ケ崎市"],
  "石岡市": ["土浦市", "笠間市", "小美玉市"],
  "阿見町": ["土浦市", "牛久市", "龍ケ崎市"],
  "東海村": ["ひたちなか市", "那珂市"],
  "茨城町": ["水戸市", "笠間市", "小美玉市"],
  // 群馬県
  "前橋市": ["高崎市", "渋川市", "伊勢崎市", "玉村町", "吉岡町", "榛東村"],
  "高崎市": ["前橋市", "伊勢崎市", "藤岡市", "富岡市", "安中市", "玉村町", "吉岡町"],
  "桐生市": ["みどり市", "伊勢崎市", "太田市"],
  "伊勢崎市": ["前橋市", "高崎市", "桐生市", "太田市", "玉村町", "明和町"],
  "太田市": ["伊勢崎市", "桐生市", "みどり市", "館林市", "邑楽町", "大泉町", "千代田町"],
  "館林市": ["太田市", "板倉町", "明和町", "邑楽町"],
  "渋川市": ["前橋市", "高崎市", "吉岡町", "榛東村", "みなかみ町", "中之条町"],
  "藤岡市": ["高崎市", "富岡市", "神流町"],
  "富岡市": ["高崎市", "藤岡市", "甘楽町", "安中市"],
  "安中市": ["高崎市", "富岡市", "甘楽町"],
  "みどり市": ["桐生市", "太田市"],
  "吉岡町": ["前橋市", "高崎市", "渋川市", "榛東村"],
  "榛東村": ["前橋市", "渋川市", "吉岡町"],
  "玉村町": ["前橋市", "高崎市", "伊勢崎市"],
  "板倉町": ["館林市", "明和町", "千代田町"],
  "明和町": ["伊勢崎市", "館林市", "板倉町", "千代田町"],
  "千代田町": ["太田市", "館林市", "板倉町", "明和町"],
  "大泉町": ["太田市", "邑楽町"],
  "邑楽町": ["太田市", "館林市", "大泉町"],
  "甘楽町": ["富岡市", "安中市"],
};

// ============================================================
// バッジ定義
// ============================================================
// ランク色：1=コモン 2=ブロンズ 3=シルバー 4=ゴールド 5=プラチナ 6=レジェンド
const RANK_COLORS = ["", "#94a3b8", "#cd7f32", "#9ca3af", "#f59e0b", "#a855f7", "#ec4899"];
const RANK_LABELS = ["", "RANK 1", "RANK 2", "RANK 3", "RANK 4", "RANK 5", "RANK 6"];

const BADGE_DEFS = [
  // 投函枚数（6段階）
  { id: "flyer_500",   category: "投函枚数", catIcon: "📮", rank: 1, icon: "📬", label: "ポスター見習い",   desc: "累計500枚投函",    color: "#94a3b8", check: s => s.totalFlyers >= 500 },
  { id: "flyer_1000",  category: "投函枚数", catIcon: "📮", rank: 2, icon: "📮", label: "配達人",           desc: "累計1,000枚投函",  color: "#cd7f32", check: s => s.totalFlyers >= 1000 },
  { id: "flyer_3000",  category: "投函枚数", catIcon: "📮", rank: 3, icon: "📦", label: "ポスタリスト",     desc: "累計3,000枚投函",  color: "#9ca3af", check: s => s.totalFlyers >= 3000 },
  { id: "flyer_5000",  category: "投函枚数", catIcon: "📮", rank: 4, icon: "🚀", label: "投函マシーン",     desc: "累計5,000枚投函",  color: "#f59e0b", check: s => s.totalFlyers >= 5000 },
  { id: "flyer_10000", category: "投函枚数", catIcon: "📮", rank: 5, icon: "🌟", label: "レジェンド配達人", desc: "累計10,000枚投函", color: "#a855f7", check: s => s.totalFlyers >= 10000 },
  { id: "flyer_30000", category: "投函枚数", catIcon: "📮", rank: 6, icon: "👑", label: "投函王",           desc: "累計30,000枚投函", color: "#ec4899", check: s => s.totalFlyers >= 30000 },
  // 制覇市区町村数（5段階）
  { id: "conq_1",  category: "市区町村制覇", catIcon: "🏙️", rank: 1, icon: "🏁", label: "第一歩",         desc: "1市区町村制覇",  color: "#94a3b8", check: s => s.conquest >= 1 },
  { id: "conq_5",  category: "市区町村制覇", catIcon: "🏙️", rank: 2, icon: "🗺️", label: "エリア探検家",   desc: "5市区町村制覇",  color: "#cd7f32", check: s => s.conquest >= 5 },
  { id: "conq_10", category: "市区町村制覇", catIcon: "🏙️", rank: 3, icon: "🏙️", label: "タウンマスター", desc: "10市区町村制覇", color: "#9ca3af", check: s => s.conquest >= 10 },
  { id: "conq_20", category: "市区町村制覇", catIcon: "🏙️", rank: 4, icon: "🌆", label: "シティハンター",  desc: "20市区町村制覇", color: "#f59e0b", check: s => s.conquest >= 20 },
  { id: "conq_50", category: "市区町村制覇", catIcon: "🏙️", rank: 5, icon: "🗾", label: "北関東の覇者",    desc: "50市区町村制覇", color: "#ec4899", check: s => s.conquest >= 50 },
  // 開拓者回数（5段階）
  { id: "pioneer_1",  category: "開拓者",  catIcon: "🏴", rank: 1, icon: "🏴", label: "開拓者",       desc: "初めて新地域を開拓", color: "#94a3b8", check: s => s.pioneer >= 1 },
  { id: "pioneer_3",  category: "開拓者",  catIcon: "🏴", rank: 2, icon: "⛺", label: "フロンティア",  desc: "3地域を開拓",       color: "#cd7f32", check: s => s.pioneer >= 3 },
  { id: "pioneer_5",  category: "開拓者",  catIcon: "🏴", rank: 3, icon: "🧭", label: "探検家",        desc: "5地域を開拓",       color: "#9ca3af", check: s => s.pioneer >= 5 },
  { id: "pioneer_10", category: "開拓者",  catIcon: "🏴", rank: 4, icon: "🌍", label: "大航海時代",    desc: "10地域を開拓",      color: "#f59e0b", check: s => s.pioneer >= 10 },
  { id: "pioneer_20", category: "開拓者",  catIcon: "🏴", rank: 5, icon: "🚩", label: "伝説の開拓者",  desc: "20地域を開拓",      color: "#ec4899", check: s => s.pioneer >= 20 },
  // 活動日数（5段階）
  { id: "days_3",  category: "活動日数", catIcon: "📅", rank: 1, icon: "🌱", label: "新人",          desc: "3日間活動",  color: "#94a3b8", check: s => s.activeDays >= 3 },
  { id: "days_7",  category: "活動日数", catIcon: "📅", rank: 2, icon: "🔥", label: "週間戦士",      desc: "7日間活動",  color: "#cd7f32", check: s => s.activeDays >= 7 },
  { id: "days_14", category: "活動日数", catIcon: "📅", rank: 3, icon: "💪", label: "ハードワーカー", desc: "14日間活動", color: "#9ca3af", check: s => s.activeDays >= 14 },
  { id: "days_30", category: "活動日数", catIcon: "📅", rank: 4, icon: "🏅", label: "月間MVP",        desc: "30日間活動", color: "#f59e0b", check: s => s.activeDays >= 30 },
  { id: "days_60", category: "活動日数", catIcon: "📅", rank: 5, icon: "🦁", label: "不屈の闘士",    desc: "60日間活動", color: "#ec4899", check: s => s.activeDays >= 60 },
];

// アカウントの実績からバッジ一覧を返す
function calcBadges(memberStats) {
  return BADGE_DEFS.filter(b => b.check(memberStats));
}

// 路線制覇バッジを動的生成
function calcLineBadges(completedLines) {
  return [...(completedLines || [])].sort().map(lineName => ({
    id: `line_${lineName}`,
    icon: "🚃",
    label: `${lineName}の主`,
    desc: `${lineName}沿線の全市区町村を制覇`,
    color: "#a855f7",
  }));
}

// ============================================================
// Main App
// ============================================================
export default function PostingApp() {
  const [tab, setTab] = useState("home");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapExpandedPref, setMapExpandedPref] = useState(null);
  const [stationLineMunis, setStationLineMunis] = useState(null);
  const [muniStations, setMuniStations] = useState(null);
  const [stationInitialLine, setStationInitialLine] = useState(null);
  const [myBadgesInitialName, setMyBadgesInitialName] = useState(null);

  useEffect(() => {
    fetchRecords();
    // リアルタイム購読：他のメンバーが入力したら即反映
    const channel = supabase
      .channel("posting_records_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "posting_records" }, () => {
        fetchRecords();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchRecords() {
    const { data, error } = await supabase
      .from("posting_records")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setRecords(data.map(r => ({
        id: r.id,
        memberName: r.member_name,
        municipalityId: r.municipality_id,
        postedDate: r.posted_date,
        flyerCount: r.flyer_count,
        notes: r.notes || "",
      })));
    }
    setLoading(false);
  }

  // Derived stats
  const stats = useMemo(() => {
    const totalMuni = MUNICIPALITIES_DATA.length;
    const totalHouseholds = MUNICIPALITIES_DATA.reduce((s, m) => s + m.households, 0);

    // Aggregate by municipality
    const muniMap = {};
    for (const r of records) {
      if (!muniMap[r.municipalityId]) muniMap[r.municipalityId] = { count: 0, members: new Set(), lastDate: "" };
      muniMap[r.municipalityId].count += r.flyerCount;
      muniMap[r.municipalityId].members.add(r.memberName);
      if (r.postedDate > muniMap[r.municipalityId].lastDate) muniMap[r.municipalityId].lastDate = r.postedDate;
    }

    const completedMuni = Object.keys(muniMap).length;
    const totalFlyers = records.reduce((s, r) => s + r.flyerCount, 0);

    // Per prefecture
    const prefStats = {};
    for (const pref of PREFECTURES) {
      const munis = MUNICIPALITIES_DATA.filter(m => m.prefecture === pref);
      const done = munis.filter(m => muniMap[m.id]).length;
      const hh = munis.reduce((s, m) => s + m.households, 0);
      const flyers = records.filter(r => {
        const m = MUNICIPALITIES_DATA.find(x => x.id === r.municipalityId);
        return m && m.prefecture === pref;
      }).reduce((s, r) => s + r.flyerCount, 0);
      prefStats[pref] = { total: munis.length, done, households: hh, flyers };
    }

    // Member ranking（枚数）
    const memberMap = {};
    for (const r of records) {
      memberMap[r.memberName] = (memberMap[r.memberName] || 0) + r.flyerCount;
    }
    const memberRanking = Object.entries(memberMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // 開拓者ランキング：市区町村ごとに「翌日まで」の登録を有効として最初の投函者を特定
    // ルール：その市区町村の最初の投函日から翌日（+1日）23:59までに登録された記録のみ有効
    const sortedByDate = [...records].sort((a, b) => {
      if (a.postedDate !== b.postedDate) return a.postedDate < b.postedDate ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });
    // 市区町村ごとの最初の投函日を取得
    const firstDateMap = {};
    for (const r of sortedByDate) {
      if (!firstDateMap[r.municipalityId]) firstDateMap[r.municipalityId] = r.postedDate;
    }
    // 翌日までに登録されたものの中で最も古い記録の投函者を開拓者とする
    const pioneerMap = {};
    for (const r of sortedByDate) {
      const firstDate = firstDateMap[r.municipalityId];
      if (!firstDate) continue;
      // 翌日の日付文字列を計算
      const nextDay = new Date(firstDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split("T")[0];
      if (r.postedDate <= nextDayStr && !pioneerMap[r.municipalityId]) {
        pioneerMap[r.municipalityId] = r.memberName;
      }
    }
    const pioneerCountMap = {};
    for (const name of Object.values(pioneerMap)) {
      pioneerCountMap[name] = (pioneerCountMap[name] || 0) + 1;
    }
    const pioneerRanking = Object.entries(pioneerCountMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // 制覇市区町村数ランキング
    const conquestMap = {};
    for (const r of records) {
      if (!conquestMap[r.memberName]) conquestMap[r.memberName] = new Set();
      conquestMap[r.memberName].add(r.municipalityId);
    }
    const conquestRanking = Object.entries(conquestMap)
      .sort((a, b) => b[1].size - a[1].size)
      .map(([name, set]) => ({ name, count: set.size }));

    // 活動日数ランキング
    const activeDaysMap = {};
    for (const r of records) {
      if (!activeDaysMap[r.memberName]) activeDaysMap[r.memberName] = new Set();
      activeDaysMap[r.memberName].add(r.postedDate);
    }
    const activeDaysRanking = Object.entries(activeDaysMap)
      .sort((a, b) => b[1].size - a[1].size)
      .map(([name, set]) => ({ name, count: set.size }));

    // メンバーごとのバッジ計算
    const allMemberNames = [...new Set(records.map(r => r.memberName))];
    const muniIdToName = {};
    for (const m of MUNICIPALITIES_DATA) muniIdToName[m.id] = m.name;

    const memberBadges = {};
    for (const name of allMemberNames) {
      const ms = {
        totalFlyers: memberMap[name] || 0,
        conquest: conquestMap[name]?.size || 0,
        pioneer: pioneerCountMap[name] || 0,
        activeDays: activeDaysMap[name]?.size || 0,
      };
      const staticBadges = calcBadges(ms);
      let lineBadges = [];
      if (stationLineMunis) {
        const conqueredNames = new Set(
          [...(conquestMap[name] || [])].map(id => muniIdToName[id]).filter(Boolean)
        );
        const completedLines = new Set(
          Object.entries(stationLineMunis)
            .filter(([, munis]) => [...munis].every(m => conqueredNames.has(m)))
            .map(([line]) => line)
        );
        lineBadges = calcLineBadges(completedLines);
      }
      memberBadges[name] = [...staticBadges, ...lineBadges];
    }

    return { totalMuni, completedMuni, totalHouseholds, totalFlyers, prefStats, memberRanking, muniMap, pioneerRanking, conquestRanking, activeDaysRanking, memberBadges };
  }, [records, stationLineMunis]);

  // トースト通知
  const [toast, setToast] = useState(null); // { message, color }
  function showToast(message, color = "#10b981") {
    setToast({ message, color });
    setTimeout(() => setToast(null), 3000);
  }

  async function addRecord(record) {
    await supabase.from("posting_records").insert({
      member_name: record.memberName,
      municipality_id: record.municipalityId,
      posted_date: record.postedDate,
      flyer_count: record.flyerCount,
      notes: record.notes,
    });
    showToast("✅ 記録しました！");
  }

  async function deleteRecord(id) {
    await supabase.from("posting_records").delete().eq("id", id);
    showToast("🗑️ 削除しました", "#ef4444");
  }

  // ① アカウント名統合：fromの全記録をtoに一括書き換え
  async function renameAccount(fromName, toName) {
    await supabase
      .from("posting_records")
      .update({ member_name: toName })
      .eq("member_name", fromName);
    showToast(`✅ 「${fromName}」を「${toName}」に統合しました`);
  }

  return (
    <div style={{ fontFamily: "'Noto Sans JP', sans-serif", minHeight: "100vh", background: "#0f172a", color: "#e2e8f0" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Oswald:wght@700&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #1e293b; }
        ::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
        input, select, textarea { font-family: inherit; }
        .tab-btn { cursor: pointer; border: none; font-family: inherit; transition: all 0.2s; }
        .tab-btn:hover { opacity: 0.85; }
        .card { background: #1e293b; border-radius: 12px; border: 1px solid #334155; }
        .btn-primary { background: #f59e0b; color: #1e293b; border: none; border-radius: 8px; padding: 12px 24px; font-weight: 700; font-size: 15px; cursor: pointer; transition: all 0.2s; }
        .btn-primary:hover { background: #fbbf24; transform: translateY(-1px); }
        .btn-danger { background: transparent; color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .btn-danger:hover { background: #ef4444; color: white; }
        .form-field { display: flex; flex-direction: column; gap: 6px; }
        .form-field label { font-size: 13px; font-weight: 600; color: #94a3b8; letter-spacing: 0.05em; }
        .form-field input, .form-field select, .form-field textarea { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 14px; outline: none; transition: border-color 0.2s; }
        .form-field input:focus, .form-field select:focus, .form-field textarea:focus { border-color: #f59e0b; }
        .progress-bar-bg { background: #334155; border-radius: 999px; overflow: hidden; }
        .progress-bar-fill { height: 100%; border-radius: 999px; transition: width 0.6s ease; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 640px) {
          .grid-2 { grid-template-columns: 1fr !important; }
          .grid-4 { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* トースト通知 */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: toast.color, color: "white", padding: "14px 28px",
          borderRadius: 12, fontWeight: 700, fontSize: 15, zIndex: 9999,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          animation: "slideIn 0.3s ease",
          whiteSpace: "nowrap",
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ background: "#f59e0b", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📮</div>
        <div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 20, fontWeight: 700, color: "#f8fafc", letterSpacing: "0.05em" }}>POSTING MANAGER</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>北関東 ポスティング進捗管理</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#94a3b8" }}>
          <span style={{ color: "#f59e0b", fontWeight: 700, fontSize: 16 }}>{Math.round(stats.completedMuni / stats.totalMuni * 100)}%</span> 完了
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ background: "#1e293b", borderBottom: "1px solid #334155", display: "flex", overflowX: "auto", padding: "0 16px" }}>
        {[
          { key: "home",     label: "🏠 ホーム" },
          { key: "map",      label: "🗾 地図" },
          { key: "station",  label: "🚉 路線" },
          { key: "ranking",  label: "🏆 ランキング" },
          { key: "mybadges", label: "🎖️ マイバッジ" },
          { key: "list",     label: "📋 一覧" },
          { key: "history",  label: "📅 履歴" },
          // { key: "settings", label: "⚙️ 設定" }, // 非表示（機能は保持）
        ].map(t => (
          <button key={t.key} className="tab-btn" onClick={() => setTab(t.key)}
            style={{
              padding: "14px 18px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
              color: tab === t.key ? "#f59e0b" : "#64748b",
              borderBottom: tab === t.key ? "2px solid #f59e0b" : "2px solid transparent",
              background: "transparent",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
            <div style={{ fontWeight: 600 }}>データを読み込み中...</div>
          </div>
        ) : (
          <>
            {tab === "home" && <Home stats={stats} onAdd={addRecord} records={records} onPrefClick={(pref) => { setTab("map"); setMapExpandedPref(pref); }} />}
            {tab === "ranking" && <Ranking stats={stats} onMemberClick={name => { setMyBadgesInitialName(name); setTab("mybadges"); }} />}
            {tab === "mybadges" && <MyBadges stats={stats} records={records} stationLineMunis={stationLineMunis} onLineClick={line => { setTab("station"); setStationInitialLine(line); }} initialName={myBadgesInitialName} onInitialNameApplied={() => setMyBadgesInitialName(null)} />}
            {tab === "map" && <MapTab stats={stats} expandedPref={mapExpandedPref} setExpandedPref={setMapExpandedPref} muniStations={muniStations} muniDanchi={MAMMOTH_DANCHI} />}
            {tab === "station" && (
              <Suspense fallback={<div style={{ textAlign: "center", padding: 60, color: "#475569" }}><div style={{ fontSize: 36, marginBottom: 12 }}>🚉</div><div style={{ fontWeight: 600 }}>読み込み中...</div></div>}>
                <StationTab stats={stats} municipalities={MUNICIPALITIES_DATA} onDataLoaded={({ lineMuniMap, muniStationsMap }) => { setStationLineMunis(lineMuniMap); setMuniStations(muniStationsMap); }} initialLine={stationInitialLine} onInitialLineApplied={() => setStationInitialLine(null)} />
              </Suspense>
            )}
            {tab === "list" && <MuniList stats={stats} />}
            {tab === "history" && <History records={records} onDelete={deleteRecord} />}
            {tab === "settings" && <Settings records={records} onRenameAccount={renameAccount} />}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Home (入力フォーム + ダッシュボード 縦並び)
// ============================================================
function Home({ stats, onAdd, records, onPrefClick }) {
  const postedMunicipalityIds = useMemo(
    () => new Set(Object.keys(stats.muniMap).map(Number)),
    [stats.muniMap]
  );
  const allMembers = useMemo(() => [...new Set(records.map(r => r.memberName))].sort(), [records]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <InputForm onAdd={onAdd} postedMunicipalityIds={postedMunicipalityIds} allMembers={allMembers} />
      <Dashboard stats={stats} onPrefClick={onPrefClick} />
    </div>
  );
}

// ============================================================
// Dashboard
// ============================================================
function Dashboard({ stats, onPrefClick }) {
  const muniPct = (stats.completedMuni / stats.totalMuni * 100).toFixed(1);
  const flyerPct = Math.min(100, (stats.totalFlyers / stats.totalHouseholds * 100)).toFixed(2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top KPIs */}
      <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { label: "完了市区町村", value: `${stats.completedMuni}/${stats.totalMuni}`, sub: `${muniPct}%`, color: "#f59e0b" },
          { label: "総投函枚数", value: stats.totalFlyers.toLocaleString(), sub: "枚", color: "#10b981" },
          { label: "世帯カバー率", value: `${flyerPct}%`, sub: `${stats.totalHouseholds.toLocaleString()}世帯中`, color: "#3b82f6" },
          { label: "参加アカウント数", value: stats.memberRanking.length, sub: "アカウントが参加中", color: "#ec4899" },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: "16px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>{kpi.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: kpi.color, fontFamily: "'Oswald', sans-serif" }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Progress bars */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 16, color: "#f8fafc" }}>都道府県別 進捗</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {PREFECTURES.map(pref => {
            const ps = stats.prefStats[pref];
            const pct = ps.total > 0 ? (ps.done / ps.total * 100) : 0;
            const col = PREF_COLORS[pref];
            return (
              <div
                key={pref}
                onClick={() => onPrefClick?.(pref)}
                style={{ cursor: onPrefClick ? "pointer" : "default", borderRadius: 8, padding: "6px 4px", transition: "background 0.15s" }}
                onMouseEnter={e => { if (onPrefClick) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ background: col.accent, color: "white", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{pref}</span>
                    <span style={{ fontSize: 13, color: "#94a3b8" }}>{ps.done}/{ps.total} 市区町村</span>
                    {onPrefClick && <span style={{ fontSize: 10, color: "#475569" }}>🗾 地図で見る</span>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: col.accent }}>{pct.toFixed(0)}%</div>
                </div>
                <div className="progress-bar-bg" style={{ height: 8 }}>
                  <div className="progress-bar-fill" style={{ width: `${pct}%`, background: col.accent }} />
                </div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  投函枚数: {ps.flyers.toLocaleString()}枚 / 世帯カバー: {ps.households > 0 ? (ps.flyers / ps.households * 100).toFixed(2) : 0}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {stats.totalFlyers === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#475569" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>まだ記録がありません</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>「✏️ 記録入力」から投函記録を追加してください</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Ranking
// ============================================================
const RANK_CONFIGS = [
  {
    key: "flyer",
    icon: "📮",
    title: "投函枚数ランキング",
    subtitle: "総投函枚数が多い順",
    color: "#f59e0b",
    unit: "枚",
    toLocale: true,
  },
  {
    key: "pioneer",
    icon: "🏴",
    title: "開拓者ランキング",
    subtitle: "誰も行ってない市区町村に初めて投函した数",
    color: "#10b981",
    unit: "市区町村",
    toLocale: false,
    note: "※ 初投函日の翌日までに登録された記録のみ有効。それ以降に遡って登録された場合は開拓者と認定されません。",
  },
  {
    key: "conquest",
    icon: "🏙️",
    title: "制覇市区町村数ランキング",
    subtitle: "投函した市区町村の数が多い順",
    color: "#3b82f6",
    unit: "市区町村",
    toLocale: false,
  },
  {
    key: "activeDays",
    icon: "📅",
    title: "活動日数ランキング",
    subtitle: "実際に活動した日数が多い順",
    color: "#ec4899",
    unit: "日",
    toLocale: false,
  },
];

const TOP_N = 3;

function RankCard({ config, data, memberBadges, onMemberClick }) {
  const [showAll, setShowAll] = useState(false);

  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 22 }}>{config.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#f8fafc" }}>{config.title}</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>{config.subtitle}</div>
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "24px 0", color: "#475569", fontSize: 13 }}>まだデータがありません</div>
      </div>
    );
  }

  const max = data[0].count;
  const visible = showAll ? data : data.slice(0, TOP_N);
  const hidden = data.length - TOP_N;

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: config.note ? 10 : 16 }}>
        <span style={{ fontSize: 22 }}>{config.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#f8fafc" }}>{config.title}</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>{config.subtitle}</div>
        </div>
        <div style={{ fontSize: 12, color: "#475569" }}>全{data.length}名</div>
      </div>
      {config.note && (
        <div style={{ background: "#0f172a", border: "1px solid #1e3a2e", borderRadius: 6, padding: "8px 12px", fontSize: 11, color: "#6ee7b7", marginBottom: 14, lineHeight: 1.6 }}>
          ⚠️ {config.note}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map((m, i) => {
          const badges = memberBadges?.[m.name] || [];
          return (
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                minWidth: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: i < 3 ? 14 : 12,
                background: i === 0 ? config.color : i === 1 ? "#94a3b8" : i === 2 ? "#cd7c2e" : "#334155",
                color: i < 3 ? "#1e293b" : "#64748b",
              }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span
                      onClick={() => onMemberClick?.(m.name)}
                      style={{ fontWeight: 600, fontSize: 14, color: "#f8fafc", cursor: "pointer", textDecoration: "underline", textDecorationColor: "#475569" }}
                    >{m.name}</span>
                    {[
                      // カテゴリごとに最高ランクのみ
                      ...Object.values(badges.reduce((acc, b) => {
                        if (!b.category) return acc;
                        if (!acc[b.category] || b.rank > acc[b.category].rank) acc[b.category] = b;
                        return acc;
                      }, {})),
                      // 路線制覇バッジ（カテゴリなし）
                      ...badges.filter(b => !b.category),
                    ].map(b => {
                      const rc = b.category ? (RANK_COLORS[b.rank] || "#94a3b8") : "#a855f7";
                      return (
                        <span key={b.id} title={`${b.category || "路線制覇"} ${b.category ? RANK_LABELS[b.rank] : ""}：${b.label}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: 2, background: rc + "22", border: `1px solid ${rc}55`, borderRadius: 5, padding: "2px 5px", cursor: "default" }}>
                          <span style={{ fontSize: 12 }}>{b.catIcon || "🚃"}</span>
                          <span style={{ color: rc, fontWeight: 900, fontSize: 9 }}>{b.category ? `R${b.rank}` : "★"}</span>
                        </span>
                      );
                    })}
                  </div>
                  <span style={{ fontWeight: 700, color: config.color, fontSize: 13, whiteSpace: "nowrap", marginLeft: 6 }}>
                    {config.toLocale ? m.count.toLocaleString() : m.count}{config.unit}
                  </span>
                </div>
                <div className="progress-bar-bg" style={{ height: 5 }}>
                  <div className="progress-bar-fill" style={{ width: `${(m.count / max * 100).toFixed(0)}%`, background: config.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* もっと見る / 折りたたむ */}
      {data.length > TOP_N && (
        <button onClick={() => setShowAll(v => !v)} style={{
          marginTop: 14, width: "100%", background: "#0f172a", border: "1px solid #334155",
          borderRadius: 8, padding: "9px 0", color: "#94a3b8", fontSize: 13, fontWeight: 600,
          cursor: "pointer", transition: "all 0.2s",
        }}
          onMouseEnter={e => e.target.style.borderColor = config.color}
          onMouseLeave={e => e.target.style.borderColor = "#334155"}
        >
          {showAll ? "▲ 折りたたむ" : `▼ もっと見る（残り${hidden}名）`}
        </button>
      )}
    </div>
  );
}

function Ranking({ stats, onMemberClick }) {
  const rankData = {
    flyer: stats.memberRanking,
    pioneer: stats.pioneerRanking,
    conquest: stats.conquestRanking,
    activeDays: stats.activeDaysRanking,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        {RANK_CONFIGS.map(config => (
          <RankCard key={config.key} config={config} data={rankData[config.key]} memberBadges={stats.memberBadges} onMemberClick={onMemberClick} />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MyBadges（マイバッジ）
// ============================================================

// カテゴリ別に次のバッジまでの進捗を計算
const BADGE_NEXT_DEFS = [
  {
    category: "投函枚数",
    icon: "📮",
    color: "#f59e0b",
    getValue: s => s.totalFlyers,
    unit: "枚",
    steps: [500, 1000, 3000, 5000, 10000, 30000],
  },
  {
    category: "制覇市区町村数",
    icon: "🏙️",
    color: "#3b82f6",
    getValue: s => s.conquest,
    unit: "市区町村",
    steps: [1, 5, 10, 20, 50],
  },
  {
    category: "開拓者回数",
    icon: "🏴",
    color: "#10b981",
    getValue: s => s.pioneer,
    unit: "地域",
    steps: [1, 3, 5, 10, 20],
  },
  {
    category: "活動日数",
    icon: "📅",
    color: "#ec4899",
    getValue: s => s.activeDays,
    unit: "日",
    steps: [3, 7, 14, 30, 60],
  },
];

function MyBadges({ stats, records, stationLineMunis, onLineClick, initialName, onInitialNameApplied }) {
  const allMembers = useMemo(() => [...new Set(records.map(r => r.memberName))].sort(), [records]);
  const [selectedName, setSelectedName] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);

  useEffect(() => {
    if (initialName) { setSelectedName(initialName); onInitialNameApplied?.(); }
  }, [initialName]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameCandidates = useMemo(() => {
    if (!selectedName.trim()) return allMembers;
    return allMembers.filter(n => n.includes(selectedName.trim()));
  }, [selectedName, allMembers]);

  // 選択アカウントの実績を計算
  const memberStats = useMemo(() => {
    if (!selectedName) return null;
    const name = selectedName.trim();
    const myRecords = records.filter(r => r.memberName === name);
    if (myRecords.length === 0) return null;

    const totalFlyers = myRecords.reduce((s, r) => s + r.flyerCount, 0);
    const conqueredIds = new Set(myRecords.map(r => r.municipalityId));
    const conquest = conqueredIds.size;
    const activeDays = new Set(myRecords.map(r => r.postedDate)).size;
    const pioneer = stats.pioneerRanking.find(p => p.name === name)?.count || 0;

    // 路線制覇チェック
    let completedLines = new Set();
    if (stationLineMunis) {
      const conqueredNames = new Set(
        [...conqueredIds].map(id => MUNICIPALITIES_DATA.find(m => m.id === id)?.name).filter(Boolean)
      );
      completedLines = new Set(
        Object.entries(stationLineMunis)
          .filter(([, munis]) => [...munis].every(m => conqueredNames.has(m)))
          .map(([line]) => line)
      );
    }

    return { totalFlyers, conquest, activeDays, pioneer, completedLines };
  }, [selectedName, records, stats.pioneerRanking, stationLineMunis]);

  const earnedBadges = memberStats ? calcBadges(memberStats) : [];
  const earnedLineBadges = memberStats ? calcLineBadges(memberStats.completedLines) : [];
  const notEarnedBadges = memberStats ? BADGE_DEFS.filter(b => !b.check(memberStats)) : [];

  // 路線制覇まであと少しリスト（残り市区町村数が少ない路線）
  const nearLineBadges = useMemo(() => {
    if (!stationLineMunis || !memberStats) return [];
    const conqueredIds = new Set(
      records.filter(r => r.memberName === selectedName.trim()).map(r => r.municipalityId)
    );
    const conqueredNames = new Set(
      [...conqueredIds].map(id => MUNICIPALITIES_DATA.find(m => m.id === id)?.name).filter(Boolean)
    );
    return Object.entries(stationLineMunis)
      .map(([lineName, munis]) => {
        const remaining = [...munis].filter(m => !conqueredNames.has(m));
        return { lineName, total: munis.size, remaining };
      })
      .filter(l => l.remaining.length > 0 && l.remaining.length <= 3)
      .sort((a, b) => a.remaining.length - b.remaining.length);
  }, [stationLineMunis, memberStats, records, selectedName]);

  return (
    <div style={{ maxWidth: 700, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* アカウント選択 */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#f8fafc", marginBottom: 12 }}>🎖️ アカウントを選択してください</div>
        <div style={{ position: "relative" }}>
          <input
            placeholder="アカウント名を入力または選択..."
            value={selectedName}
            onChange={e => { setSelectedName(e.target.value); setShowSuggest(true); }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            autoComplete="off"
            style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" }}
          />
          {showSuggest && nameCandidates.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "#1e293b", border: "1px solid #334155", borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
              {nameCandidates.map(name => (
                <div key={name} onMouseDown={() => { setSelectedName(name); setShowSuggest(false); }}
                  style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14, color: "#e2e8f0", borderBottom: "1px solid #1e293b" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#334155"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  {name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedName && !memberStats && (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "#475569" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div>「{selectedName}」の記録が見つかりません</div>
        </div>
      )}

      {memberStats && (
        <>
          {/* 獲得済みバッジ */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#f8fafc", marginBottom: 4 }}>
              ✨ 獲得済みバッジ
              <span style={{ marginLeft: 8, fontSize: 13, color: "#f59e0b", fontWeight: 900 }}>{earnedBadges.length + earnedLineBadges.length}</span>
              <span style={{ fontSize: 12, color: "#475569", fontWeight: 400 }}>個</span>
            </div>
            {earnedBadges.length === 0 && earnedLineBadges.length === 0 ? (
              <div style={{ fontSize: 13, color: "#475569", marginTop: 12 }}>まだバッジがありません。活動を続けよう！</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
                {/* カテゴリごとに最高ランクのみ表示 */}
                {Object.values(earnedBadges.reduce((acc, b) => {
                  if (!acc[b.category] || b.rank > acc[b.category].rank) acc[b.category] = b;
                  return acc;
                }, {})).map(b => {
                  const rc = RANK_COLORS[b.rank] || "#94a3b8";
                  return (
                    <div key={b.id} style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", border: `1.5px solid ${rc}55`, borderRadius: 14, padding: "14px 12px", textAlign: "center", minWidth: 104 }}>
                      <div style={{ display: "inline-block", background: rc + "22", border: `1px solid ${rc}66`, color: rc, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 900, letterSpacing: 0.5, marginBottom: 10 }}>
                        {RANK_LABELS[b.rank]}
                      </div>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>{b.catIcon}</div>
                      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>{b.category}</div>
                      <div style={{ fontWeight: 700, fontSize: 11, color: rc, lineHeight: 1.3 }}>{b.label}</div>
                    </div>
                  );
                })}
                {/* 路線制覇バッジ */}
                {earnedLineBadges.map(b => (
                  <div key={b.id} style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", border: "1.5px solid #a855f755", borderRadius: 14, padding: "14px 12px", textAlign: "center", minWidth: 104 }}>
                    <div style={{ display: "inline-block", background: "#a855f722", border: "1px solid #a855f766", color: "#a855f7", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 900, letterSpacing: 0.5, marginBottom: 10 }}>路線制覇</div>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>🚃</div>
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 3 }}>路線</div>
                    <div style={{ fontWeight: 700, fontSize: 11, color: "#a855f7", lineHeight: 1.3 }}>{b.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 次のバッジまでの進捗 */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#f8fafc", marginBottom: 16 }}>🎯 次のバッジまであと…</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {BADGE_NEXT_DEFS.map(cat => {
                const current = cat.getValue(memberStats);
                const nextStep = cat.steps.find(s => s > current);
                const prevStep = [...cat.steps].reverse().find(s => s <= current) || 0;
                if (!nextStep) return (
                  <div key={cat.category} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{cat.icon}</span>
                    <div>
                      <span style={{ fontWeight: 700, color: cat.color }}>{cat.category}</span>
                      <span style={{ fontSize: 12, color: "#10b981", marginLeft: 8 }}>🏆 全バッジ獲得済み！</span>
                    </div>
                  </div>
                );
                const progress = ((current - prevStep) / (nextStep - prevStep) * 100).toFixed(0);
                const remaining = nextStep - current;
                // 次のバッジ名を探す
                const nextBadge = BADGE_DEFS.find(b => {
                  const val = cat.getValue(memberStats);
                  return !b.check(memberStats) && b.check({ ...memberStats, [Object.keys(memberStats).find(k => cat.getValue({...memberStats, [k]: nextStep}) === nextStep)]: nextStep });
                });
                // カテゴリと対応するバッジを直接マッピング
                const catBadges = BADGE_DEFS.filter(b => b.check({ totalFlyers: cat.category === "投函枚数" ? nextStep : 0, conquest: cat.category === "制覇市区町村数" ? nextStep : 0, pioneer: cat.category === "開拓者回数" ? nextStep : 0, activeDays: cat.category === "活動日数" ? nextStep : 0 }));
                const targetBadge = catBadges[catBadges.length - 1];
                return (
                  <div key={cat.category}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{cat.icon}</span>
                        <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: 13 }}>{cat.category}</span>
                        {targetBadge && <span style={{ fontSize: 14 }}>{targetBadge.icon}</span>}
                        {targetBadge && <span style={{ fontSize: 12, color: cat.color, fontWeight: 700 }}>{targetBadge.label}</span>}
                      </div>
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>
                        <strong style={{ color: cat.color }}>{current.toLocaleString()}</strong> / {nextStep.toLocaleString()}{cat.unit}
                      </span>
                    </div>
                    <div className="progress-bar-bg" style={{ height: 8 }}>
                      <div className="progress-bar-fill" style={{ width: `${progress}%`, background: cat.color }} />
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      あと <strong style={{ color: "#f8fafc" }}>{remaining.toLocaleString()}{cat.unit}</strong> で「{targetBadge?.label}」獲得！
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 次の目標バッジ（カテゴリごとに次のランクのみ） */}
          {(() => {
            const earnedByCategory = earnedBadges.reduce((acc, b) => {
              if (!acc[b.category] || b.rank > acc[b.category].rank) acc[b.category] = b;
              return acc;
            }, {});
            const nextBadges = BADGE_DEFS.filter(b => {
              const top = earnedByCategory[b.category];
              return b.rank === (top ? top.rank + 1 : 1);
            });
            if (nextBadges.length === 0) return null;
            return (
              <div className="card" style={{ padding: 20 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#475569", marginBottom: 14 }}>🔒 次の目標バッジ</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {nextBadges.map(b => {
                    const rc = RANK_COLORS[b.rank] || "#475569";
                    return (
                      <div key={b.id} style={{ background: "#0f172a", border: "1.5px solid #1e293b", borderRadius: 14, padding: "14px 12px", textAlign: "center", minWidth: 104, opacity: 0.55 }}>
                        <div style={{ display: "inline-block", background: "#1e293b", border: "1px solid #334155", color: "#475569", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 900, letterSpacing: 0.5, marginBottom: 10 }}>
                          🔒 {RANK_LABELS[b.rank]}
                        </div>
                        <div style={{ fontSize: 28, filter: "grayscale(1)", marginBottom: 6 }}>{b.catIcon}</div>
                        <div style={{ fontSize: 10, color: "#475569", marginBottom: 3 }}>{b.category}</div>
                        <div style={{ fontWeight: 700, fontSize: 11, color: "#475569", lineHeight: 1.3 }}>{b.label}</div>
                        <div style={{ fontSize: 9, color: "#334155", marginTop: 4 }}>{b.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* もうすぐ路線制覇 */}
          {stationLineMunis && nearLineBadges.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#f8fafc", marginBottom: 12 }}>🚃 もうすぐ路線制覇！</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {nearLineBadges.map(({ lineName, remaining }) => (
                  <div key={lineName} style={{ background: "#0f172a", borderRadius: 8, padding: "8px 12px", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <span style={{ color: "#a855f7", fontWeight: 700 }}>{lineName}</span>
                      <span style={{ color: "#64748b", marginLeft: 8 }}>あと</span>
                      <span style={{ color: "#f8fafc", fontWeight: 700, margin: "0 4px" }}>{remaining.length}</span>
                      <span style={{ color: "#64748b" }}>市区町村（{remaining.slice(0, 3).join("・")}）</span>
                    </div>
                    <button onClick={() => onLineClick?.(lineName)} style={{
                      background: "#1e293b", border: "1px solid #a855f755", color: "#a855f7",
                      borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700,
                      cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                      路線を見る →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!stationLineMunis && (
            <div className="card" style={{ padding: 16, fontSize: 13, color: "#475569" }}>
              🚉 「路線」タブを一度開くと路線制覇バッジが解放されます
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Input Form
// ============================================================
function InputForm({ onAdd, postedMunicipalityIds, allMembers }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ memberName: "", prefecture: "", municipalityId: "", postedDate: today, flyerCount: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [showNameSuggest, setShowNameSuggest] = useState(false);

  // ② 入力中のアカウント名でフィルタしたサジェスト候補
  const nameCandidates = useMemo(() => {
    if (!form.memberName.trim()) return allMembers;
    return allMembers.filter(n => n.includes(form.memberName.trim()));
  }, [form.memberName, allMembers]);

  const availableMunis = useMemo(() =>
    form.prefecture ? MUNICIPALITIES_DATA.filter(m => m.prefecture === form.prefecture) : [],
    [form.prefecture]);

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val, ...(key === "prefecture" ? { municipalityId: "" } : {}) }));
    setSuggestions(null);
  }

  async function handleSubmit() {
    if (!form.memberName || !form.municipalityId || !form.postedDate || !form.flyerCount) {
      alert("アカウント名・都道府県・市区町村・日付・枚数は必須です");
      return;
    }
    setSaving(true);
    await onAdd({
      memberName: form.memberName.trim(),
      municipalityId: Number(form.municipalityId),
      postedDate: form.postedDate,
      flyerCount: Number(form.flyerCount),
      notes: form.notes,
    });
    setSaving(false);

    // 近隣おすすめを計算
    const postedMuni = MUNICIPALITIES_DATA.find(m => m.id === Number(form.municipalityId));
    if (postedMuni) {
      const neighborNames = NEIGHBORS[postedMuni.name] || [];
      const unpostedNeighbors = neighborNames
        .map(name => MUNICIPALITIES_DATA.find(m => m.name === name))
        .filter(m => m && !postedMunicipalityIds.has(m.id));
      if (unpostedNeighbors.length > 0) {
        setSuggestions({ postedName: postedMuni.name, neighbors: unpostedNeighbors });
      } else {
        setSuggestions(null);
      }
    }

    setForm({ memberName: form.memberName, prefecture: form.prefecture, municipalityId: "", postedDate: today, flyerCount: "", notes: "" });
  }

  const selectedMuni = form.municipalityId ? MUNICIPALITIES_DATA.find(m => m.id === Number(form.municipalityId)) : null;

  return (
    <div>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 20, color: "#f8fafc" }}>投函記録を追加</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-field" style={{ position: "relative" }}>
            <label>アカウント名 *</label>
            <input
              placeholder="例：田中 太郎"
              value={form.memberName}
              onChange={e => { set("memberName", e.target.value); setShowNameSuggest(true); }}
              onFocus={() => setShowNameSuggest(true)}
              onBlur={() => setTimeout(() => setShowNameSuggest(false), 150)}
              autoComplete="off"
            />
            {showNameSuggest && nameCandidates.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
                marginTop: 4, maxHeight: 180, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}>
                {nameCandidates.map(name => (
                  <div key={name}
                    onMouseDown={() => { set("memberName", name); setShowNameSuggest(false); }}
                    style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14, color: "#e2e8f0", borderBottom: "1px solid #334155" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#334155"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-field">
              <label>都道府県 *</label>
              <select value={form.prefecture} onChange={e => set("prefecture", e.target.value)}>
                <option value="">選択してください</option>
                {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>市区町村 *</label>
              <select value={form.municipalityId} onChange={e => set("municipalityId", e.target.value)} disabled={!form.prefecture}>
                <option value="">選択してください</option>
                {availableMunis.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          {selectedMuni && (
            <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#94a3b8" }}>
              📍 {selectedMuni.prefecture} {selectedMuni.name} — 世帯数: <strong style={{ color: "#f59e0b" }}>{selectedMuni.households.toLocaleString()}世帯</strong>
            </div>
          )}

          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-field">
              <label>投函日 *</label>
              <input type="date" value={form.postedDate} onChange={e => set("postedDate", e.target.value)} />
            </div>
            <div className="form-field">
              <label>投函枚数 *</label>
              <input type="number" placeholder="500" min="1" value={form.flyerCount} onChange={e => set("flyerCount", e.target.value)} />
            </div>
          </div>

          {form.flyerCount && selectedMuni && (
            <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#94a3b8" }}>
              カバー率: <strong style={{ color: "#10b981" }}>{(Number(form.flyerCount) / selectedMuni.households * 100).toFixed(1)}%</strong>（{selectedMuni.name}の世帯数比）
            </div>
          )}

          <div className="form-field">
            <label>備考（任意）</label>
            <textarea rows={2} placeholder="特記事項があれば..." value={form.notes} onChange={e => set("notes", e.target.value)} style={{ resize: "vertical" }} />
          </div>

          <button className="btn-primary" onClick={handleSubmit} disabled={saving} style={{ marginTop: 4, width: "100%", opacity: saving ? 0.7 : 1 }}>
            {saving ? "⏳ 保存中..." : "📮 記録する"}
          </button>
        </div>
      </div>

      {/* 近隣おすすめパネル */}
      {suggestions && (
        <div style={{
          marginTop: 12, borderRadius: 12, overflow: "hidden",
          border: "1px solid #f59e0b", background: "linear-gradient(135deg, #1e293b 0%, #1a2535 100%)",
          animation: "slideIn 0.4s ease",
        }}>
          <div style={{ background: "#f59e0b", padding: "10px 18px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>🗺️</span>
            <span style={{ fontWeight: 900, color: "#1e293b", fontSize: 14 }}>ついでにここもポスティングして、第一人者になろう！</span>
          </div>
          <div style={{ padding: "14px 18px" }}>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>
              <strong style={{ color: "#f59e0b" }}>{suggestions.postedName}</strong> の近隣でまだ誰もポスティングしていない地域です👇
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {suggestions.neighbors.map(m => (
                <div key={m.id} style={{
                  background: "#0f172a", border: "1px solid #334155", borderRadius: 8,
                  padding: "8px 14px", fontSize: 13,
                }}>
                  <div style={{ fontWeight: 700, color: "#f8fafc" }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{m.households.toLocaleString()}世帯</div>
                </div>
              ))}
            </div>
            <button onClick={() => setSuggestions(null)}
              style={{ marginTop: 12, background: "transparent", border: "none", color: "#475569", fontSize: 12, cursor: "pointer" }}>
              閉じる ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MapTab
// ============================================================
function MapTab({ stats, expandedPref, setExpandedPref, muniStations, muniDanchi }) {
  const postedMunicipalityIds = useMemo(
    () => new Set(Object.keys(stats.muniMap).map(Number)),
    [stats.muniMap]
  );

  // 市区町村名 → 配布済み枚数
  const muniFlyers = useMemo(() => {
    const m = {};
    for (const [idStr, data] of Object.entries(stats.muniMap)) {
      const muni = MUNICIPALITIES_DATA.find(x => x.id === Number(idStr));
      if (muni) m[muni.name] = data.count;
    }
    return m;
  }, [stats.muniMap]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#f8fafc", marginBottom: 4 }}>🗾 投函進捗マップ</div>
        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>
          投函済みエリアは都道府県カラーで表示、未投函エリアはグレーで表示されます。県をタップ→拡大、市区町村をタップ→駅情報を確認できます。<br />
          <span style={{ color: "#94a3b8" }}>
            色の濃さは世帯カバレッジ率（配布枚数÷世帯数）を示します：薄い色ほどカバレッジが低く（〜0.5%）、濃いほど高い（2%以上）です。
          </span>
        </div>
      </div>
      <Suspense fallback={
        <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🗾</div>
          <div style={{ fontWeight: 600 }}>地図コンポーネントを読み込み中...</div>
        </div>
      }>
        <MapView
          postedMunicipalityIds={postedMunicipalityIds}
          municipalitiesData={MUNICIPALITIES_DATA}
          expandedPref={expandedPref}
          setExpandedPref={setExpandedPref}
          muniStations={muniStations}
          muniDanchi={muniDanchi}
          muniFlyers={muniFlyers}
        />
      </Suspense>
    </div>
  );
}

// ============================================================
// Settings
// ============================================================
function Settings({ records, onRenameAccount }) {
  const allNames = useMemo(() => [...new Set(records.map(r => r.memberName))].sort(), [records]);
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [merging, setMerging] = useState(false);

  async function handleMerge() {
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) return;
    if (!window.confirm(`「${mergeFrom}」の全記録を「${mergeTo}」に統合します。よろしいですか？`)) return;
    setMerging(true);
    await onRenameAccount(mergeFrom, mergeTo);
    setMergeFrom("");
    setMergeTo("");
    setMerging(false);
  }

  return (
    <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#f8fafc", marginBottom: 4 }}>🔗 アカウント名の統合</div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>表記ゆれなどで分かれてしまったアカウントを1つに統合できます</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-field">
            <label>統合元（削除される名前）</label>
            <select value={mergeFrom} onChange={e => setMergeFrom(e.target.value)}
              style={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" }}>
              <option value="">選択してください</option>
              {allNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ textAlign: "center", color: "#475569", fontSize: 20 }}>↓</div>
          <div className="form-field">
            <label>統合先（残る名前）</label>
            <select value={mergeTo} onChange={e => setMergeTo(e.target.value)}
              style={{ background: "#0f172a", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" }}>
              <option value="">選択してください</option>
              {allNames.filter(n => n !== mergeFrom).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {mergeFrom && mergeTo && (
            <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#94a3b8" }}>
              「<strong style={{ color: "#ef4444" }}>{mergeFrom}</strong>」の全記録が「<strong style={{ color: "#10b981" }}>{mergeTo}</strong>」に統合されます
            </div>
          )}
          <button onClick={handleMerge} disabled={!mergeFrom || !mergeTo || merging}
            style={{ background: mergeFrom && mergeTo ? "#f59e0b" : "#334155", color: mergeFrom && mergeTo ? "#1e293b" : "#64748b", border: "none", borderRadius: 8, padding: "12px 0", fontWeight: 700, fontSize: 15, cursor: mergeFrom && mergeTo ? "pointer" : "default", width: "100%" }}>
            {merging ? "⏳ 統合中…" : "🔗 統合する"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Municipality List
// ============================================================
function MuniList({ stats }) {
  const [filterPref, setFilterPref] = useState("");
  const [showOnly, setShowOnly] = useState("all");

  const rows = useMemo(() => {
    return MUNICIPALITIES_DATA
      .filter(m => !filterPref || m.prefecture === filterPref)
      .filter(m => {
        const done = !!stats.muniMap[m.id];
        if (showOnly === "done") return done;
        if (showOnly === "undone") return !done;
        return true;
      })
      .map(m => {
        const data = stats.muniMap[m.id];
        return {
          ...m,
          flyerCount: data ? data.count : 0,
          done: !!data,
          lastDate: data ? data.lastDate : "",
          members: data ? [...data.members].join(", ") : "",
          coverage: data ? (data.count / m.households * 100).toFixed(1) : "0.0",
        };
      })
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? -1 : 1;
        return b.flyerCount - a.flyerCount;
      });
  }, [stats, filterPref, showOnly]);

  function exportCSV() {
    const headers = ["都道府県", "市区町村", "世帯数", "投函枚数", "カバー率(%)", "最終投函日", "担当アカウント", "状況"];
    const csvRows = rows.map(m => [
      m.prefecture, m.name, m.households, m.flyerCount,
      m.coverage, m.lastDate || "", m.members || "", m.done ? "完了" : "未投函",
    ]);
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(`市区町村一覧_${date}.csv`, headers, csvRows);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <select value={filterPref} onChange={e => setFilterPref(e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none" }}>
          <option value="">すべての都道府県</option>
          {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {[["all", "すべて"], ["undone", "未投函のみ"], ["done", "完了のみ"]].map(([v, l]) => (
          <button key={v} className="tab-btn" onClick={() => setShowOnly(v)}
            style={{ background: showOnly === v ? "#f59e0b" : "#1e293b", color: showOnly === v ? "#1e293b" : "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
            {l}
          </button>
        ))}
        <button onClick={exportCSV}
          style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          📥 CSV出力
        </button>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#64748b", alignSelf: "center" }}>{rows.length}件表示</div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#0f172a" }}>
                {["都道府県", "市区町村", "世帯数", "投函枚数", "カバー率", "最終投函日", "担当メンバー"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: 11, letterSpacing: "0.05em", borderBottom: "1px solid #334155", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: "1px solid #1e293b", background: i % 2 === 0 ? "transparent" : "#1e293b11" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ background: PREF_COLORS[m.prefecture].accent + "33", color: PREF_COLORS[m.prefecture].accent, borderRadius: 4, padding: "2px 6px", fontSize: 11, fontWeight: 700 }}>
                      {m.prefecture.replace("県", "")}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: m.done ? "#f8fafc" : "#64748b" }}>
                    {m.done && <span style={{ marginRight: 4 }}>✅</span>}{m.name}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{m.households.toLocaleString()}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 700, color: m.done ? "#10b981" : "#475569" }}>{m.flyerCount.toLocaleString()}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div className="progress-bar-bg" style={{ width: 50, height: 6 }}>
                        <div className="progress-bar-fill" style={{ width: `${Math.min(100, Number(m.coverage))}%`, background: Number(m.coverage) > 80 ? "#10b981" : Number(m.coverage) > 30 ? "#f59e0b" : "#3b82f6" }} />
                      </div>
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>{m.coverage}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 12 }}>{m.lastDate || "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 12, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.members || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CSV Export ユーティリティ
// ============================================================
function downloadCSV(filename, headers, rows) {
  const bom = "\uFEFF"; // Excel用BOM（文字化け防止）
  const csv = bom + [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// History
// ============================================================
function History({ records, onDelete }) {
  const [filterMember, setFilterMember] = useState("");
  const [filterPref, setFilterPref] = useState("");

  const members = useMemo(() => [...new Set(records.map(r => r.memberName))].sort(), [records]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      if (filterMember && r.memberName !== filterMember) return false;
      if (filterPref) {
        const m = MUNICIPALITIES_DATA.find(x => x.id === r.municipalityId);
        if (!m || m.prefecture !== filterPref) return false;
      }
      return true;
    });
  }, [records, filterMember, filterPref]);

  function exportCSV() {
    const headers = ["投函日", "アカウント名", "都道府県", "市区町村", "世帯数", "投函枚数", "カバー率(%)", "備考"];
    const rows = filtered.map(r => {
      const muni = MUNICIPALITIES_DATA.find(m => m.id === r.municipalityId);
      return [
        r.postedDate,
        r.memberName,
        muni ? muni.prefecture : "",
        muni ? muni.name : "",
        muni ? muni.households : "",
        r.flyerCount,
        muni ? (r.flyerCount / muni.households * 100).toFixed(1) : "",
        r.notes || "",
      ];
    });
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(`投函履歴_${date}.csv`, headers, rows);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <select value={filterPref} onChange={e => setFilterPref(e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none" }}>
          <option value="">すべての都道府県</option>
          {PREFECTURES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
          style={{ background: "#1e293b", border: "1px solid #334155", color: "#e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none" }}>
          <option value="">すべてのアカウント</option>
          {members.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={exportCSV} disabled={filtered.length === 0}
          style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: filtered.length === 0 ? 0.4 : 1 }}>
          📥 CSV出力
        </button>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#64748b", alignSelf: "center" }}>{filtered.length}件</div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#475569" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
          <div>記録がありません</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(r => {
            const muni = MUNICIPALITIES_DATA.find(m => m.id === r.municipalityId);
            return (
              <div key={r.id} className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: "#f8fafc" }}>{r.memberName}</span>
                    <span style={{ background: muni ? PREF_COLORS[muni.prefecture].accent + "33" : "#334155", color: muni ? PREF_COLORS[muni.prefecture].accent : "#94a3b8", borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 700 }}>
                      {muni ? muni.prefecture.replace("県", "") : "?"}
                    </span>
                    <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{muni ? muni.name : "不明"}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {r.postedDate} ／ <span style={{ color: "#10b981", fontWeight: 700 }}>{r.flyerCount.toLocaleString()}枚</span>
                    {muni && ` (${(r.flyerCount / muni.households * 100).toFixed(1)}%)`}
                    {r.notes && <span style={{ marginLeft: 8, color: "#475569" }}>📝 {r.notes}</span>}
                  </div>
                </div>
                <button className="btn-danger" onClick={async () => { if (window.confirm("この記録を削除しますか？")) await onDelete(r.id); }}>削除</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
