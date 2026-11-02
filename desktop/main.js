// Manar Derma OS — برنامج الحاسبة.
// يفتح نفس رابط GitHub Pages (حتى توصل التحديثات تلقائيًا ويشتغل بدون نت من كاش الـ service worker)،
// ويضيف للصفحة window.mdDesk (preload.js) حتى تحفظ النسخ الاحتياطية بمجلد يختاره المستخدم على الهارد.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

const APP_URL = "https://hooobe.github.io/sahobat/";
const ORIGIN = new URL(APP_URL).origin;
const KEEP_DAYS = 90;
const BK_RE = /^ManarDerma-backup-\d{4}-\d{2}-\d{2}\.json$/;

const cfgFile = () => path.join(app.getPath("userData"), "desktop-config.json");
function readCfg() { try { return JSON.parse(fs.readFileSync(cfgFile(), "utf8")); } catch (e) { return {}; } }
function writeCfg(c) { fs.mkdirSync(path.dirname(cfgFile()), { recursive: true }); fs.writeFileSync(cfgFile(), JSON.stringify(c, null, 2)); }

// الطلبات تجي بس من صفحة البرنامج نفسها
function fromApp(e) { try { return new URL(e.senderFrame.url).origin === ORIGIN; } catch (err) { return false; } }

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 360, minHeight: 500,
    title: "Manar Derma OS",
    icon: path.join(__dirname, "build", "icon.png"),
    backgroundColor: "#F5F5F5",
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  win.maximize();
  win.loadURL(APP_URL);
  // الروابط الخارجية (واتساب، برامج الروابط…) تنفتح بالمتصفح
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(ORIGIN + "/") || url.startsWith("blob:") || url === "about:blank") return { action: "allow" };
    shell.openExternal(url); return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(ORIGIN + "/")) { e.preventDefault(); shell.openExternal(url); }
  });
  win.webContents.on("did-fail-load", (e, code, desc, url, isMain) => {
    if (isMain && code !== -3) setTimeout(() => win && win.loadURL(APP_URL), 5000);
  });
}

ipcMain.handle("dk:getDir", (e) => fromApp(e) ? (readCfg().dir || null) : null);

ipcMain.handle("dk:pickDir", async (e) => {
  if (!fromApp(e)) return null;
  const r = await dialog.showOpenDialog(win, {
    title: "اختار مكان حفظ النسخ الاحتياطية (الهارد)",
    defaultPath: readCfg().dir || app.getPath("documents"),
    properties: ["openDirectory", "createDirectory"]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const dir = path.join(r.filePaths[0], path.basename(r.filePaths[0]) === "Manar Derma Backups" ? "" : "Manar Derma Backups");
  fs.mkdirSync(dir, { recursive: true });
  writeCfg({ ...readCfg(), dir });
  return dir;
});

ipcMain.handle("dk:write", async (e, name, text) => {
  if (!fromApp(e)) return { ok: false, err: "denied" };
  const dir = readCfg().dir;
  if (!dir) return { ok: false, err: "nodir" };
  if (!BK_RE.test(String(name)) || typeof text !== "string") return { ok: false, err: "bad" };
  // إذا الهارد مفصول ما نسوي المجلد من جديد بمكان غلط
  if (!fs.existsSync(path.dirname(dir)) && !fs.existsSync(dir)) return { ok: false, err: "missing" };
  try {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name), tmp = file + ".tmp";
    await fs.promises.writeFile(tmp, text, "utf8");
    await fs.promises.rename(tmp, file);
    const old = fs.readdirSync(dir).filter((f) => BK_RE.test(f)).sort().reverse().slice(KEEP_DAYS);
    old.forEach((f) => { try { fs.unlinkSync(path.join(dir, f)); } catch (err) {} });
    return { ok: true, path: file };
  } catch (err) { return { ok: false, err: String(err.code || err.message || err) }; }
});

ipcMain.handle("dk:openDir", (e) => { const d = readCfg().dir; if (fromApp(e) && d) shell.openPath(d); });

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => { Menu.setApplicationMenu(null); createWindow(); });
  app.on("window-all-closed", () => app.quit());
}
