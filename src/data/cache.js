class Cache {
  constructor() {
    this.cache = {};
  }

  get(key) {
    if (this.cache.hasOwnProperty(key)) return this.cache[key];
    return null;
  }

  set(key, value, expiry) {
    this.cache[key] = value;

    setTimeout(() => {
      delete this.cache[key];
    }, expiry);
  }

  getCache() {
    return this.cache;
  }

  clear() {
    this.cache = {};
  }
}

const cacheInstance = new Cache();

module.exports = cacheInstance;