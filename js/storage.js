/* storage.js — persist books (IndexedDB) + reading state / studies (localStorage) */

const DB_NAME = 'chessbook';
const DB_VERSION = 1;
const STORE_BOOKS = 'books';

function openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode){ return db.transaction(STORE_BOOKS, mode).objectStore(STORE_BOOKS); }

export const bookStore = {
  async put(book){
    const db = await openDB();
    return new Promise((res, rej) => {
      const r = tx(db, 'readwrite').put(book);
      r.onsuccess = () => res(book);
      r.onerror = () => rej(r.error);
    });
  },
  async get(id){
    const db = await openDB();
    return new Promise((res, rej) => {
      const r = tx(db, 'readonly').get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  },
  async list(){
    const db = await openDB();
    return new Promise((res, rej) => {
      const r = tx(db, 'readonly').getAll();
      r.onsuccess = () => res((r.result || []).map(b => ({ id:b.id, name:b.name, size:b.size, addedAt:b.addedAt })));
      r.onerror = () => rej(r.error);
    });
  },
  async delete(id){
    const db = await openDB();
    return new Promise((res, rej) => {
      const r = tx(db, 'readwrite').delete(id);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  }
};

/* ---- localStorage helpers ---- */
const LS = {
  get(key, fallback){ try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, val){ try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
};

export const prefs = {
  lastBook(){ return LS.get('cb:lastBook', null); },
  setLastBook(id){ LS.set('cb:lastBook', id); },

  // per-book reading state: { page, zoom, single, split, bookmarks:[{page,label}] }
  bookState(id){ return LS.get('cb:book:' + id, { page:1, zoom:1, single:true, split:0.5, bookmarks:[] }); },
  setBookState(id, state){ LS.set('cb:book:' + id, state); },

  // auto-saved current study tree
  autoStudy(){ return LS.get('cb:autostudy', null); },
  setAutoStudy(data){ LS.set('cb:autostudy', data); },

  // named saved studies
  studies(){ return LS.get('cb:studies', {}); },
  saveStudy(name, data){ const s = this.studies(); s[name] = data; LS.set('cb:studies', s); },
  deleteStudy(name){ const s = this.studies(); delete s[name]; LS.set('cb:studies', s); }
};
