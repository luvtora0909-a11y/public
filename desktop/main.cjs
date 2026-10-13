const { app, BrowserWindow, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
let service;
app.whenReady().then(async () => {
  const root = app.getPath('userData');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const vaultFile = path.join(root, 'credentials.enc');
  const vault = {
    persistent: safeStorage.isEncryptionAvailable(),
    async read() {
      if (!fs.existsSync(vaultFile)) return {};
      if (!safeStorage.isEncryptionAvailable()) throw new Error('macOS 安全存储不可用');
      return JSON.parse(safeStorage.decryptString(fs.readFileSync(vaultFile)));
    },
    async write(data) {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('无法安全保存凭证，请检查 macOS 钥匙串');
      const tmp = vaultFile + '.tmp';
      fs.writeFileSync(tmp, safeStorage.encryptString(JSON.stringify(data)), { mode: 0o600 });
      fs.renameSync(tmp, vaultFile);
    }
  };
  const { createService } = await import('../src/server.js');
  service = await createService({ dataDir: root, vault });
  const open = () => {
    const win = new BrowserWindow({ width: 1380, height: 920, minWidth: 1050, minHeight: 720, title: 'Luvtora 运营中心', backgroundColor: '#f6f5f1', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== service.url) event.preventDefault(); });
    win.loadURL(service.url);
  };
  open();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) open(); });
}).catch(error => { console.error(error.message); app.quit(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => service?.server.close());
