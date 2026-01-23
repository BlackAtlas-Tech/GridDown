/**
 * GridDown Storage - IndexedDB with localStorage fallback
 */
const Storage = (function() {
    'use strict';
    const DB_NAME = 'griddown-db', DB_VERSION = 1;
    let db = null;
    const STORES = { WAYPOINTS: 'waypoints', ROUTES: 'routes', SETTINGS: 'settings', MAP_REGIONS: 'mapRegions' };

    async function init() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) { console.warn('IndexedDB not supported'); resolve(false); return; }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => { db = req.result; resolve(true); };
            req.onupgradeneeded = (e) => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains(STORES.WAYPOINTS)) d.createObjectStore(STORES.WAYPOINTS, { keyPath: 'id' });
                if (!d.objectStoreNames.contains(STORES.ROUTES)) d.createObjectStore(STORES.ROUTES, { keyPath: 'id' });
                if (!d.objectStoreNames.contains(STORES.SETTINGS)) d.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
                if (!d.objectStoreNames.contains(STORES.MAP_REGIONS)) d.createObjectStore(STORES.MAP_REGIONS, { keyPath: 'id' });
            };
        });
    }

    const getLS = (store, key) => { try { const d = localStorage.getItem(`gd_${store}_${key}`); return d ? JSON.parse(d) : null; } catch { return null; } };
    const getAllLS = (store) => { try { const items = [], prefix = `gd_${store}_`; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(prefix)) { const d = localStorage.getItem(k); if (d) items.push(JSON.parse(d)); } } return items; } catch { return []; } };
    const putLS = (store, data) => { try { localStorage.setItem(`gd_${store}_${data.id || data.key}`, JSON.stringify(data)); return true; } catch { return false; } };
    const removeLS = (store, key) => { try { localStorage.removeItem(`gd_${store}_${key}`); } catch {} };

    async function get(store, key) {
        if (!db) return getLS(store, key);
        return new Promise((res, rej) => { const req = db.transaction(store, 'readonly').objectStore(store).get(key); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    }
    async function getAll(store) {
        if (!db) return getAllLS(store);
        return new Promise((res, rej) => { const req = db.transaction(store, 'readonly').objectStore(store).getAll(); req.onsuccess = () => res(req.result || []); req.onerror = () => rej(req.error); });
    }
    async function put(store, data) {
        if (!db) return putLS(store, data);
        return new Promise((res, rej) => { const req = db.transaction(store, 'readwrite').objectStore(store).put(data); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    }
    async function remove(store, key) {
        if (!db) return removeLS(store, key);
        return new Promise((res, rej) => { const req = db.transaction(store, 'readwrite').objectStore(store).delete(key); req.onsuccess = () => res(); req.onerror = () => rej(req.error); });
    }

    const Waypoints = {
        getAll: () => getAll(STORES.WAYPOINTS), get: (id) => get(STORES.WAYPOINTS, id),
        save: (wp) => put(STORES.WAYPOINTS, wp), delete: (id) => remove(STORES.WAYPOINTS, id),
        async saveAll(wps) { for (const wp of wps) await put(STORES.WAYPOINTS, wp); }
    };
    const Routes = {
        getAll: () => getAll(STORES.ROUTES), get: (id) => get(STORES.ROUTES, id),
        save: (r) => put(STORES.ROUTES, r), delete: (id) => remove(STORES.ROUTES, id),
        async saveAll(rs) { for (const r of rs) await put(STORES.ROUTES, r); }
    };
    const Settings = {
        async get(key, def = null) { const r = await get(STORES.SETTINGS, key); return r ? r.value : def; },
        set: (key, value) => put(STORES.SETTINGS, { key, value })
    };

    async function exportData() {
        return JSON.stringify({ version: DB_VERSION, exportedAt: new Date().toISOString(), waypoints: await Waypoints.getAll(), routes: await Routes.getAll() }, null, 2);
    }
    async function importData(json) {
        try { const data = JSON.parse(json); if (data.waypoints) await Waypoints.saveAll(data.waypoints); if (data.routes) await Routes.saveAll(data.routes); return true; } catch { return false; }
    }

    return { init, STORES, Waypoints, Routes, Settings, exportData, importData };
})();
window.Storage = Storage;
