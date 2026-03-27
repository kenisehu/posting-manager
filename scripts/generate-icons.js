// アイコン PNG 生成スクリプト
// 実行: node scripts/generate-icons.js
import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, "../public/icon.svg");
const svgBuffer = readFileSync(svgPath);

const sizes = [
  { size: 192, name: "icon-192.png" },
  { size: 512, name: "icon-512.png" },
  { size: 180, name: "apple-touch-icon.png" },
];

for (const { size, name } of sizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(resolve(__dirname, "../public", name));
  console.log(`✅ ${name} (${size}x${size})`);
}
console.log("Done!");
