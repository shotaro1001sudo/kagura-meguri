// デスクトップに、管理者用ページのショートカットを作る(Windows): npm run admin:shortcut
// ダブルクリックで起動し、ブラウザが開く。起動中にもう一度押すと、画面だけ開く。黒い画面(最小化)を閉じると終了する。
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** PNG をそのまま包んだ ICO(Windows Vista 以降で表示できる) */
export function pngToIco(png) {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4); // 予約・種類(アイコン)・枚数
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  head.writeUInt8(w >= 256 ? 0 : w, 6); head.writeUInt8(h >= 256 ? 0 : h, 7);
  head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
  return Buffer.concat([head, png]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.platform !== "win32") { console.log("Windows 用です"); process.exit(1); }
  // アイコンは、PC の中だけの .admin/ に置く(Git には入れない)
  mkdirSync(join(ROOT, ".admin"), { recursive: true });
  const ico = join(ROOT, ".admin", "admin.ico");
  writeFileSync(ico, pngToIco(readFileSync(join(ROOT, "assets", "favicon-48.png"))));
  const ps = `
$desk = [Environment]::GetFolderPath('Desktop')
$s = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desk ($env:LNK_NAME + '.lnk')))
$s.TargetPath = $env:LNK_TARGET
$s.WorkingDirectory = $env:LNK_DIR
$s.IconLocation = $env:LNK_ICON
$s.WindowStyle = 7
$s.Description = $env:LNK_NAME
$s.Save()
Write-Output (Join-Path $desk ($env:LNK_NAME + '.lnk'))`;
  // 日本語の名前は、文字化けしないよう、環境変数で渡す
  const out = execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], {
    encoding: "utf8",
    env: { ...process.env, LNK_NAME: "神楽めぐり 管理者用ページ", LNK_TARGET: join(ROOT, "scripts", "admin", "start.cmd"), LNK_DIR: ROOT, LNK_ICON: `${ico},0` },
  });
  console.log(`デスクトップにショートカットを作りました: ${out.trim()}`);
}
