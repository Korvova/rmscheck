const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'db.json');

let state = { devices: [], logs: [] };

function load() {
  try { state = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { state = { devices: [], logs: [] }; }
}
function persist() {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2)); } catch {}
}

function listDevices() { return state.devices; }
function listLogs(deviceId, limit = 100) {
  const arr = state.logs.filter(l => l.deviceId === deviceId);
  return arr.slice(-limit);
}
function upsertDevice(dev) {
  const i = state.devices.findIndex(d => d.id === dev.id);
  if (i >= 0) state.devices[i] = dev; else state.devices.push(dev);
  persist(); return dev;
}
function deleteDevice(id) {
  state.devices = state.devices.filter(d => d.id !== id);
  state.logs = state.logs.filter(l => l.deviceId !== id);
  persist();
}
function addLog(entry) { state.logs.push(entry); persist(); }

module.exports = { load, persist, listDevices, listLogs, upsertDevice, deleteDevice, addLog };
