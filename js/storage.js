/**
 * ============================================================================
 *  Storage.js — Capa de almacenamiento unificada para PROHS
 * ============================================================================
 *  Reemplaza a localStorage (limitado a ~5-10MB) por un backend adecuado
 *  según el entorno donde corre la app:
 *
 *   - Navegador / PWA  -> IndexedDB (varios cientos de MB, a veces GB)
 *   - Electron (Windows/Mac/Linux) -> Filesystem real vía preload.js (sin límite práctico)
 *   - Capacitor (Android/iOS)      -> Filesystem del dispositivo (sin límite práctico)
 *   - Servidor PROHS (versión hospedada, window.PROHS_CLOUD) -> API del servidor, por cuenta
 *
 *  La API pública es intencionalmente muy parecida a localStorage, pero
 *  asíncrona (devuelve Promises), para minimizar los cambios en app.js:
 *
 *     await Storage.getItem(key)          -> string | null
 *     await Storage.setItem(key, value)   -> void   (value es siempre un string)
 *     await Storage.removeItem(key)       -> void
 *     await Storage.keys()                -> string[]
 *     await Storage.getUsageInfo()        -> { usedMB, quotaMB|null, backend }
 * ============================================================================
 */
const Storage = (function () {
    'use strict';

    // -------------------------------------------------------------
    // 1) Detección de entorno
    // -------------------------------------------------------------
    function detectBackend() {
        // Versión hospedada (servidor propio con usuarios): el servidor inyecta window.PROHS_CLOUD = true
        if (typeof window !== 'undefined' && window.PROHS_CLOUD === true) return 'server';
        if (typeof window !== 'undefined' && window.prohsAPI && window.prohsAPI.storage) {
            return 'electron';
        }
        if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
            return 'capacitor';
        }
        return 'indexeddb';
    }

    const backendName = detectBackend();

    // -------------------------------------------------------------
    // 2) Backend: IndexedDB (navegador / PWA)
    // -------------------------------------------------------------
    const DB_NAME = 'prohsDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'kv';
    let _dbPromise = null;

    function idbOpen() {
        if (_dbPromise) return _dbPromise;
        _dbPromise = new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                reject(new Error('IndexedDB no está disponible en este navegador.'));
                return;
            }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return _dbPromise;
    }

    async function idbGetItem(key) {
        const db = await idbOpen();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(key);
            req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function idbSetItem(key, value) {
        const db = await idbOpen();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function idbRemoveItem(key) {
        const db = await idbOpen();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function idbKeys() {
        const db = await idbOpen();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).getAllKeys();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async function idbUsage() {
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const est = await navigator.storage.estimate();
                return {
                    usedMB: (est.usage || 0) / (1024 * 1024),
                    quotaMB: est.quota ? est.quota / (1024 * 1024) : null,
                    backend: 'indexeddb'
                };
            }
        } catch (e) { /* noop */ }
        return { usedMB: null, quotaMB: null, backend: 'indexeddb' };
    }

    // -------------------------------------------------------------
    // 3) Backend: Electron (expuesto por preload.js vía contextBridge)
    //    window.prohsAPI.storage = { getItem, setItem, removeItem, keys, usage }
    // -------------------------------------------------------------
    async function electronGetItem(key) {
        return window.prohsAPI.storage.getItem(key);
    }
    async function electronSetItem(key, value) {
        return window.prohsAPI.storage.setItem(key, value);
    }
    async function electronRemoveItem(key) {
        return window.prohsAPI.storage.removeItem(key);
    }
    async function electronKeys() {
        return window.prohsAPI.storage.keys();
    }
    async function electronUsage() {
        const info = await window.prohsAPI.storage.usage();
        return { usedMB: info.usedMB, quotaMB: null, backend: 'electron (disco local)' };
    }

    // -------------------------------------------------------------
    // 4) Backend: Capacitor (Android / iOS) — usa el plugin Filesystem
    // -------------------------------------------------------------
    const CAP_DIR = 'prohs_data';

    function capSafeFileName(key) {
        return key.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.json';
    }

    async function capEnsureDir() {
        const { Filesystem } = window.Capacitor.Plugins;
        try {
            await Filesystem.mkdir({ path: CAP_DIR, directory: 'DATA', recursive: true });
        } catch (e) { /* ya existe */ }
    }

    async function capGetItem(key) {
        const { Filesystem } = window.Capacitor.Plugins;
        try {
            const res = await Filesystem.readFile({
                path: `${CAP_DIR}/${capSafeFileName(key)}`,
                directory: 'DATA',
                encoding: 'utf8'
            });
            return res.data;
        } catch (e) {
            return null;
        }
    }

    async function capSetItem(key, value) {
        const { Filesystem } = window.Capacitor.Plugins;
        await capEnsureDir();
        await Filesystem.writeFile({
            path: `${CAP_DIR}/${capSafeFileName(key)}`,
            directory: 'DATA',
            data: value,
            encoding: 'utf8'
        });
    }

    async function capRemoveItem(key) {
        const { Filesystem } = window.Capacitor.Plugins;
        try {
            await Filesystem.deleteFile({ path: `${CAP_DIR}/${capSafeFileName(key)}`, directory: 'DATA' });
        } catch (e) { /* no existía */ }
    }

    async function capKeys() {
        const { Filesystem } = window.Capacitor.Plugins;
        try {
            const res = await Filesystem.readdir({ path: CAP_DIR, directory: 'DATA' });
            // Necesitamos mapear archivo -> key original; guardamos un índice aparte.
            const idx = await capGetIndex();
            return Object.keys(idx);
        } catch (e) {
            return [];
        }
    }

    // Índice key original <-> nombre de archivo, porque saneamos el nombre de archivo
    async function capGetIndex() {
        const raw = await capGetItem('__keyindex__');
        return raw ? JSON.parse(raw) : {};
    }
    async function capUpdateIndex(key) {
        const idx = await capGetIndex();
        if (!idx[key]) {
            idx[key] = capSafeFileName(key);
            await capSetItemRaw('__keyindex__', JSON.stringify(idx));
        }
    }
    async function capSetItemRaw(key, value) {
        const { Filesystem } = window.Capacitor.Plugins;
        await capEnsureDir();
        await Filesystem.writeFile({
            path: `${CAP_DIR}/${capSafeFileName(key)}`,
            directory: 'DATA',
            data: value,
            encoding: 'utf8'
        });
    }

    async function capUsage() {
        return { usedMB: null, quotaMB: null, backend: 'capacitor (almacenamiento del dispositivo)' };
    }


    // -------------------------------------------------------------
    // 4b) Backend: Servidor PROHS (versión hospedada con usuarios y cuentas)
    //     - Cada clave se guarda en el servidor, dentro de los datos de la cuenta.
    //     - Los adjuntos grandes (data-URI de fotos/PDF) se separan del JSON y se
    //       suben aparte (~blob~<sha256>) para no reenviar todo en cada guardado.
    //     - Escrituras: una a la vez por clave, juntando las que se acumulan.
    //     - Control de versiones (X-Base-Rev): si otra persona guardó antes,
    //       el servidor responde 409 y se le pregunta a la usuaria qué hacer.
    //     nube.js se engancha mediante Storage.cloud.hooks.
    // -------------------------------------------------------------
    const LOCAL_ONLY = { '__migrated_from_localStorage__': 1 };
    const BLOB_MIN = 20000;                       // data-URI de más de ~20 KB => adjunto aparte
    const DATAURI_RE = /data:[A-Za-z0-9.+\-]+\/[A-Za-z0-9.+\-]+(?:;[A-Za-z0-9=.+\-]+)*;base64,[A-Za-z0-9+\/=]+/g;
    const BLOB_MARK_RE = /~blob~([0-9a-f]{64})/g;
    const SRV = {
        revs: {},                 // clave -> última versión (rev) conocida del servidor
        latest: {},               // clave -> último valor escrito pendiente (lectura inmediata)
        q: {},                    // clave -> cola de escritura
        known: new Set(),         // hashes de adjuntos que sabemos que están en el servidor
        inflight: new Set(),      // promesas de escrituras en curso
        hooks: {},                // los completa nube.js
        usage: null               // { usadoBytes, cupoBytes }
    };
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // SHA-256: crypto.subtle si hay contexto seguro (https/localhost); si no, versión en JS puro.
    function sha256Js(bytes) {
        const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
        const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
        const n = bytes.length, total = ((n + 9 + 63) >> 6) << 6;
        const m = new Uint8Array(total); m.set(bytes); m[n] = 0x80;
        const dv = new DataView(m.buffer);
        dv.setUint32(total - 8, Math.floor(n / 0x20000000)); dv.setUint32(total - 4, (n << 3) >>> 0);
        const w = new Uint32Array(64);
        for (let off = 0; off < total; off += 64) {
            for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
            for (let i = 16; i < 64; i++) {
                const a = w[i-15], b = w[i-2];
                const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
                const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
                w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
            }
            let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
            for (let i = 0; i < 64; i++) {
                const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
                const ch = (e & f) ^ (~e & g);
                const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
                const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
                const mj = (a & b) ^ (a & c) ^ (b & c);
                const t2 = (S0 + mj) | 0;
                h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
            }
            H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
            H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
        }
        return Array.from(H).map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
    }
    async function sha256Hex(str) {
        const bytes = new TextEncoder().encode(str);
        if (window.crypto && crypto.subtle && crypto.subtle.digest) {
            const d = await crypto.subtle.digest('SHA-256', bytes);
            return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        return sha256Js(bytes);
    }

    class SrvError extends Error {
        constructor(status, code, msg, extra) { super(msg || code); this.status = status; this.code = code; this.extra = extra || {}; }
    }

    // Una llamada a la API. Si la sesión venció, pide volver a ingresar y reintenta;
    // si no hay conexión, reintenta unas veces.
    async function srvReq(method, path, opts) {
        opts = opts || {};
        let lastErr = null;
        for (let attempt = 0; attempt < 4; attempt++) {
            let res;
            try {
                res = await fetch('/api' + path, {
                    method, credentials: 'same-origin',
                    headers: Object.assign({ 'X-Requested-With': 'prohs' }, opts.headers || {}),
                    body: opts.body
                });
            } catch (e) {
                lastErr = e;
                if (SRV.hooks.offline) SRV.hooks.offline(true);
                await sleep(1200 * (attempt + 1));
                continue;
            }
            if (SRV.hooks.offline) SRV.hooks.offline(false);
            if (res.status === 401 && SRV.hooks.needLogin) { await SRV.hooks.needLogin(); continue; }
            return res;
        }
        throw new SrvError(0, 'sin_conexion', 'No hay conexión con el servidor.' + (lastErr ? '' : ''));
    }
    async function srvJson(res) { try { return await res.json(); } catch (e) { return {}; } }
    function srvNoteUsage(o) {
        if (o && o.usadoBytes != null) {
            SRV.usage = { usadoBytes: o.usadoBytes, cupoBytes: o.cupoBytes != null ? o.cupoBytes : (SRV.usage ? SRV.usage.cupoBytes : null) };
            if (SRV.hooks.usage) SRV.hooks.usage(SRV.usage);
        }
    }

    // ---- adjuntos ----
    // value (string JSON) -> { text sin adjuntos grandes, blobs: Map(hash -> dataURI) }
    async function srvPack(value) {
        if (typeof value !== 'string' || value.length < BLOB_MIN) return { text: value, blobs: new Map() };
        const found = new Set();
        value.replace(DATAURI_RE, m => { if (m.length >= BLOB_MIN) found.add(m); return m; });
        if (!found.size) return { text: value, blobs: new Map() };
        const hashOf = new Map(), blobs = new Map();
        for (const uri of found) {
            const h = await sha256Hex(uri);
            hashOf.set(uri, h);
            if (!SRV.known.has(h)) blobs.set(h, uri);
        }
        const text = value.replace(DATAURI_RE, m => hashOf.has(m) ? '~blob~' + hashOf.get(m) : m);
        return { text, blobs };
    }
    async function srvUploadBlobs(blobs) {
        const hashes = Array.from(blobs.keys());
        let res = await srvReq('POST', '/blobs/missing', { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hashes }) });
        if (!res.ok) throw new SrvError(res.status, 'blobs', 'No se pudo preparar la subida de adjuntos.');
        const missing = (await res.json()).missing || [];
        hashes.forEach(h => { if (missing.indexOf(h) === -1) SRV.known.add(h); });
        let done = 0;
        for (const h of missing) {
            if (SRV.hooks.progress) SRV.hooks.progress('Subiendo adjuntos', done, missing.length);
            res = await srvReq('PUT', '/blob/' + h, { headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: blobs.get(h) });
            const j = res.ok ? await res.json() : await srvJson(res);
            if (!res.ok) throw new SrvError(res.status, j.error || 'blob', j.mensaje || 'No se pudo subir un adjunto.');
            SRV.known.add(h); srvNoteUsage(j); done++;
        }
        if (missing.length && SRV.hooks.progress) SRV.hooks.progress(null);
    }
    // texto con marcadores ~blob~ -> texto con los data-URI originales
    async function srvUnpack(text) {
        if (typeof text !== 'string' || text.indexOf('~blob~') === -1) return text;
        const hashes = new Set();
        text.replace(BLOB_MARK_RE, (m, h) => { hashes.add(h); return m; });
        const list = Array.from(hashes), map = new Map();
        let next = 0, done = 0;
        async function worker() {
            while (next < list.length) {
                const h = list[next++];
                try {
                    const res = await srvReq('GET', '/blob/' + h);
                    if (res.ok) { map.set(h, await res.text()); SRV.known.add(h); }
                } catch (e) { /* queda vacío */ }
                done++;
                if (SRV.hooks.progress) SRV.hooks.progress('Cargando adjuntos', done, list.length);
            }
        }
        await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()].slice(0, Math.min(6, list.length)));
        if (SRV.hooks.progress) SRV.hooks.progress(null);
        return text.replace(BLOB_MARK_RE, (m, h) => map.has(h) ? map.get(h) : '');
    }

    // ---- lectura ----
    async function srvGetItem(key) {
        if (SRV.latest[key] !== undefined) return SRV.latest[key];
        const res = await srvReq('GET', '/kv/' + encodeURIComponent(key));
        if (res.status === 404) { delete SRV.revs[key]; return null; }
        if (!res.ok) { const j = await srvJson(res); throw new SrvError(res.status, j.error, j.mensaje || 'No se pudo leer del servidor.'); }
        const rev = res.headers.get('X-Rev');
        if (rev != null) SRV.revs[key] = Number(rev);
        return srvUnpack(await res.text());
    }

    // ---- escritura ----
    async function srvWriteOnce(key, value) {
        const S = SRV.hooks;
        if (S.readOnly && S.readOnly()) return true;               // sesión de solo lectura: no se envía nada
        let packed;
        try {
            packed = await srvPack(value);
            if (packed.blobs.size) await srvUploadBlobs(packed.blobs);
        } catch (e) { return srvFail(e); }
        for (let tries = 0; tries < 5; tries++) {
            const headers = { 'Content-Type': 'text/plain; charset=utf-8' };
            if (SRV.revs[key] != null) headers['X-Base-Rev'] = String(SRV.revs[key]);
            let res;
            try { res = await srvReq('PUT', '/kv/' + encodeURIComponent(key), { headers, body: packed.text }); }
            catch (e) { return srvFail(e); }
            const j = await srvJson(res);
            if (res.ok) {
                SRV.revs[key] = j.rev; srvNoteUsage(j);
                if (S.saved) S.saved(key, j);
                return true;
            }
            if (res.status === 409) {
                const choice = S.conflict ? await S.conflict(key, j) : 'reload';
                if (choice === 'overwrite') { SRV.revs[key] = j.rev; continue; }
                if (S.reload) S.reload();
                return false;
            }
            return srvFail(new SrvError(res.status, j.error, j.mensaje, j));
        }
        return false;
    }
    function srvFail(e) {
        console.error('[Storage/servidor]', e);
        if (SRV.hooks.writeError) SRV.hooks.writeError(e);
        return false;
    }
    function srvSet(key, value) {
        const q = SRV.q[key] || (SRV.q[key] = { value: null, waiters: [], running: false, dirty: false });
        q.value = value; q.dirty = true; SRV.latest[key] = value;
        let resolve;
        const p = new Promise(r => { resolve = r; });
        q.waiters.push(resolve);
        SRV.inflight.add(p); p.then(() => SRV.inflight.delete(p));
        if (!q.running) srvRun(key, q);
        return p;
    }
    async function srvRun(key, q) {
        q.running = true;
        if (SRV.hooks.saving) SRV.hooks.saving(true);
        try {
            while (q.dirty) {
                q.dirty = false;
                const v = q.value, ws = q.waiters; q.waiters = [];
                try { await srvWriteOnce(key, v); } catch (e) { srvFail(e); }
                ws.forEach(r => r());
            }
        } finally {
            q.running = false;
            if (!q.dirty) delete SRV.latest[key];
            if (SRV.hooks.saving && !srvBusy()) SRV.hooks.saving(false);
        }
    }
    function srvBusy() { return Object.keys(SRV.q).some(k => SRV.q[k].running || SRV.q[k].dirty); }

    async function srvRemove(key) {
        const res = await srvReq('DELETE', '/kv/' + encodeURIComponent(key));
        if (res.ok) { delete SRV.revs[key]; srvNoteUsage(await srvJson(res)); return; }
        const j = await srvJson(res);
        srvFail(new SrvError(res.status, j.error, j.mensaje, j));
    }
    async function srvKeys() {
        const res = await srvReq('GET', '/kv');
        if (!res.ok) return [];
        const j = await res.json(); srvNoteUsage(j);
        return Object.keys(j.keys || {});
    }
    async function srvUsage() {
        try {
            const res = await srvReq('GET', '/session');
            if (res.ok) {
                const j = await res.json();
                if (j.tenant) srvNoteUsage({ usadoBytes: j.tenant.usadoBytes, cupoBytes: j.tenant.cupoBytes });
            }
        } catch (e) { /* noop */ }
        const u = SRV.usage;
        if (!u) return { usedMB: null, quotaMB: null, backend: 'Nube PROHS' };
        return { usedMB: u.usadoBytes / 1048576, quotaMB: u.cupoBytes ? u.cupoBytes / 1048576 : null, backend: 'Nube PROHS' };
    }

    // -------------------------------------------------------------
    // 5) API pública unificada
    // -------------------------------------------------------------
    let _lastWrite = Promise.resolve();

    const api = {
        backendName,

        async getItem(key) {
            if (backendName === 'server') return LOCAL_ONLY[key] ? idbGetItem(key) : srvGetItem(key);
            switch (backendName) {
                case 'electron': return electronGetItem(key);
                case 'capacitor': return capGetItem(key);
                default: return idbGetItem(key);
            }
        },

        async setItem(key, value) {
            if (backendName === 'server') return LOCAL_ONLY[key] ? idbSetItem(key, value) : srvSet(key, value);
            let p;
            switch (backendName) {
                case 'electron': p = electronSetItem(key, value); break;
                case 'capacitor': p = capSetItem(key, value).then(() => capUpdateIndex(key)); break;
                default: p = idbSetItem(key, value); break;
            }
            _lastWrite = p;
            return p;
        },

        async removeItem(key) {
            if (backendName === 'server') return LOCAL_ONLY[key] ? idbRemoveItem(key) : srvRemove(key);
            switch (backendName) {
                case 'electron': return electronRemoveItem(key);
                case 'capacitor': return capRemoveItem(key);
                default: return idbRemoveItem(key);
            }
        },

        async keys() {
            if (backendName === 'server') return srvKeys();
            switch (backendName) {
                case 'electron': return electronKeys();
                case 'capacitor': return capKeys();
                default: return idbKeys();
            }
        },

        async getUsageInfo() {
            if (backendName === 'server') return srvUsage();
            switch (backendName) {
                case 'electron': return electronUsage();
                case 'capacitor': return capUsage();
                default: return idbUsage();
            }
        },

        /** Devuelve una promesa que se resuelve cuando termina la última escritura pendiente. */
        flush() {
            if (backendName === 'server') return Promise.all(Array.from(SRV.inflight)).then(() => undefined);
            return _lastWrite;
        },

        /** Sólo versión hospedada: estado interno y ganchos para nube.js */
        cloud: backendName === 'server' ? {
            hooks: SRV.hooks,
            revs: SRV.revs,
            busy: srvBusy,
            usage: () => SRV.usage,
            noteUsage: srvNoteUsage
        } : null,

        /** Migra datos existentes en localStorage (versión anterior de la app) hacia el nuevo backend. */
        async migrateFromLocalStorage() {
            try {
                if (backendName === 'server') return;   // en la nube nunca se suben datos locales del navegador
                if (typeof localStorage === 'undefined') return;
                const migratedFlagKey = '__migrated_from_localStorage__';
                const already = await api.getItem(migratedFlagKey);
                if (already) return;

                const keysToMigrate = [];
                for (let i = 0; i < localStorage.length; i++) {
                    keysToMigrate.push(localStorage.key(i));
                }
                for (const key of keysToMigrate) {
                    const value = localStorage.getItem(key);
                    if (value !== null) {
                        await api.setItem(key, value);
                    }
                }
                await api.setItem(migratedFlagKey, 'true');
                console.log(`[Storage] Migración completada: ${keysToMigrate.length} claves movidas desde localStorage.`);
            } catch (e) {
                console.error('[Storage] Error migrando datos desde localStorage:', e);
            }
        }
    };

    return api;
})();

;(function(){try{var g=typeof globalThis!=='undefined'?globalThis:this,o=g.__prohsO=g.__prohsO||[];o.push('‍​‌​​‌‌​‌​‌‌​​​​‌​‌‌‌‌​​​​‌‌​‌​​‌​‌‌​‌‌​‌​‌‌​‌​​‌​‌‌​‌‌​​​‌‌​‌​​‌​‌‌​​​​‌​‌‌​‌‌‌​​‌‌​‌‌‌‌​​‌​​​​​​‌​‌​​​​​‌‌​​‌​‌​‌‌​​​‌‌​‌‌​‌​​​​‌‌​‌​​‌​‌‌​​‌​‌​‌‌‌​‌​‌​​‌​​​​​​​‌‌​​‌‌​​‌‌​‌​​​​‌‌‌​​​​​‌‌​‌‌​​​‌‌​‌‌​​​‌‌​‌​‌​​‌‌‌​​​​​‌‌​​‌​‍','AB0zNyE+RAMbCAkKTn0IE0VbVUcWY2Z3fmUYV0A=');}catch(e){}})();
