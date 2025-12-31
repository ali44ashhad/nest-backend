/**
 * Simple in-memory cache implementation for analytics data
 * TTL-based cache with automatic expiration
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class Cache {
  private cache: Map<string, CacheEntry<any>>;
  private readonly defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) {
    // Default TTL: 5 minutes
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    // Check if cache entry has expired
    if (Date.now() - cached.timestamp >= this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Delete a specific cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear cache entries matching a pattern (starts with)
   */
  clearPattern(pattern: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear expired entries manually (useful for cleanup)
   */
  clearExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.defaultTTL) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Export singleton instance
export const cache = new Cache(5 * 60 * 1000); // 5 minutes default TTL

// Cache key constants
export const CACHE_KEYS = {
  USER_STATS: 'user_stats',
  PROJECT_STATS: 'project_stats',
  LOCATION_ANALYTICS: 'location_analytics',
  ROLES_DISTRIBUTION: 'roles_distribution',
  REGISTRATION_TRENDS: (days: number) => `registration_trends_${days}`,
  ACTIVE_USERS: (days: number) => `active_users_${days}`,
  ALL_USERS: 'all_users',
  ALL_PROJECTS: 'all_projects',
  ANALYTICS_OVERVIEW: 'analytics_overview',
} as const;

