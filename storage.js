'use strict';

/**
 * storage.js - IndexedDB Manager for high-capacity photo storage
 * Project: Corporación K-9 Seguridad
 */

const DB_NAME = 'K9PatrimonialPhotos';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

const PhotoDB = {
  db: null,

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async savePhoto(evalId, sectionKey, index, data) {
    await this.init();
    const id = `${evalId}_${sectionKey}_${index}`;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ id, evalId, sectionKey, index, data });
      request.onsuccess = () => resolve(id);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getPhoto(evalId, sectionKey, index) {
    await this.init();
    const id = `${evalId}_${sectionKey}_${index}`;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ? request.result.data : null);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async getAllPhotosForEval(evalId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result || [];
        resolve(all.filter(p => p.evalId === evalId));
      };
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async deletePhoto(evalId, sectionKey, index) {
    await this.init();
    const id = `${evalId}_${sectionKey}_${index}`;
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  },

  async deletePhotosForEval(evalId) {
    await this.init();
    const photos = await this.getAllPhotosForEval(evalId);
    const transaction = this.db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const p of photos) {
      store.delete(p.id);
    }
    return new Promise((resolve) => {
      transaction.oncomplete = () => resolve();
    });
  },

  /**
   * Helps with Exporting: Returns all photos as a simple object mapping id to data
   */
  async exportPhotos(evalId) {
    const photos = await this.getAllPhotosForEval(evalId);
    const map = {};
    photos.forEach(p => { map[p.id] = p.data; });
    return map;
  },

  /**
   * Helps with Importing: Bulk save photos from an object
   */
  async importPhotos(photosMap) {
    await this.init();
    const transaction = this.db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const id in photosMap) {
      const [evalId, sectionKey, index] = id.split('_');
      store.put({ id, evalId, sectionKey, index: parseInt(index), data: photosMap[id] });
    }
    return new Promise((resolve) => {
      transaction.oncomplete = () => resolve();
    });
  }
};
