// الجسر بين صفحة البرنامج والحاسبة: بس حفظ النسخ الاحتياطية بالمجلد المختار.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("mdDesk", {
  isDesk: true,
  getDir: () => ipcRenderer.invoke("dk:getDir"),
  pickDir: () => ipcRenderer.invoke("dk:pickDir"),
  write: (name, text) => ipcRenderer.invoke("dk:write", name, text),
  openDir: () => ipcRenderer.invoke("dk:openDir")
});
