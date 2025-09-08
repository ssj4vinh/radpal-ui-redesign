// Cache localStorage reads to avoid synchronous disk access
const cache = new Map<string, string | null>()

export const localStorageCache = {
  getItem(key: string): string | null {
    if (cache.has(key)) {
      return cache.get(key) || null
    }
    const value = localStorage.getItem(key)
    cache.set(key, value)
    return value
  },
  
  setItem(key: string, value: string): void {
    cache.set(key, value)
    // Use requestIdleCallback for non-critical writes
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        localStorage.setItem(key, value)
      })
    } else {
      setTimeout(() => {
        localStorage.setItem(key, value)
      }, 0)
    }
  },
  
  removeItem(key: string): void {
    cache.delete(key)
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        localStorage.removeItem(key)
      })
    } else {
      setTimeout(() => {
        localStorage.removeItem(key)
      }, 0)
    }
  },
  
  clear(): void {
    cache.clear()
  }
}