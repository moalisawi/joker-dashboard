/**
 * Performance optimization utilities
 */

/**
 * Debounce function to reduce unnecessary calls
 * مثال: عند البحث في الجدول
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function to limit function calls
 * مثال: عند scroll
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * مؤشر الأداء
 * قياس وقت العملية
 */
export class PerformanceMarker {
  private startTime: number

  constructor(public name: string) {
    this.startTime = performance.now()
  }

  end(): number {
    const duration = performance.now() - this.startTime
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${this.name}: ${duration.toFixed(2)}ms`)
    }
    return duration
  }
}

/**
 * محسّنات Firestore queries
 */
export const firestoreOptimizations = {
  /**
   * استخدم indexes للـ queries الضخمة
   */
  createIndex: (_collection: string, _fields: string[]) => {
    // No-op: index creation is done via firestore.indexes.json deployment
  },

  /**
   * pagination للـ large collections
   */
  paginate: <T extends { id: string }>(
    items: T[],
    page: number,
    pageSize: number = 50
  ) => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return {
      items: items.slice(start, end),
      total: items.length,
      page,
      pageSize,
      totalPages: Math.ceil(items.length / pageSize),
    }
  },

  /**
   * تقسيم queries الضخمة
   */
  batchQueries: (total: number, batchSize: number = 100) => {
    const batches = []
    for (let i = 0; i < total; i += batchSize) {
      batches.push({
        skip: i,
        limit: Math.min(batchSize, total - i),
      })
    }
    return batches
  },
}

/**
 * محسّنات الـ React Query
 */
export const reactQueryOptimizations = {
  /**
   * استراتيجية الـ caching
   */
  cacheConfig: {
    staleTime: 5 * 60 * 1000,        // 5 دقائق
    gcTime: 10 * 60 * 1000,          // 10 دقائق (مسبقاً cacheTime)
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
  },

  /**
   * استراتيجية الـ prefetch
   */
  prefetchConfig: {
    staleTime: 30 * 60 * 1000,       // 30 دقيقة
    gcTime: 60 * 60 * 1000,          // ساعة
  },
}

/**
 * محسّنات الـ Rendering
 */
export const renderingOptimizations = {
  /**
   * virtual scrolling للـ large lists
   * استخدم مع react-window
   */
  virtualScrollConfig: {
    itemSize: 50,                     // ارتفاع كل صف
    overscanCount: 5,                 // عدد الصفوف الإضافية للـ render
  },

  /**
   * pagination للـ tables
   */
  paginationConfig: {
    defaultPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100],
  },
}

/**
 * محسّنات الـ Bundle
 */
export const bundleOptimizations = {
  /**
   * dynamic imports
   */
  lazyComponent: (importFn: () => Promise<any>) => {
    return importFn()
  },

  /**
   * code splitting بـ route
   */
  routes: {
    dashboard: '/dashboard',
    admin: '/admin',
    analytics: '/analytics',
  },
}

/**
 * Memory leak prevention
 */
export const memoryOptimizations = {
  /**
   * cleanup في useEffect
   */
  createCleanup: (fn: () => void) => {
    return () => {
      try {
        fn()
      } catch (error) {
        console.error('Cleanup error:', error)
      }
    }
  },

  /**
   * تنظيف الـ event listeners
   */
  removeEventListeners: (element: HTMLElement, event: string, handler: EventListener) => {
    element?.removeEventListener(event, handler)
  },
}

/**
 * Image optimization
 */
export const imageOptimizations = {
  /**
   * استخدم next/image بدلاً من <img>
   */
  imageFormats: {
    webp: 'image/webp',
    jpg: 'image/jpeg',
    png: 'image/png',
  },

  /**
   * lazy loading للـ images
   */
  lazyLoadConfig: {
    loading: 'lazy' as const,
  },
}

/**
 * Font optimization
 */
export const fontOptimizations = {
  /**
   * preload fonts
   */
  preloadFont: (fontFamily: string) => {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link')
      link.href = `/fonts/${fontFamily}.woff2`
      link.rel = 'preload'
      link.as = 'font'
      link.type = 'font/woff2'
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    }
  },
}

/**
 * Network optimization
 */
export const networkOptimizations = {
  /**
   * enable service worker
   */
  enableServiceWorker: () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }
  },

  /**
   * prefetch DNS
   */
  prefetchDNS: (domain: string) => {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link')
      link.rel = 'dns-prefetch'
      link.href = `https://${domain}`
      document.head.appendChild(link)
    }
  },
}
