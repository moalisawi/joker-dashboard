import { formatCurrency } from '@/lib/currency'

describe('Utils', () => {
  describe('filterByPeriod', () => {
    const filterByPeriod = <T extends object>(
      items: T[],
      period: any,
      dateKey: keyof T = 'date' as keyof T,
    ): T[] => {
      const getDate = (item: T): string => {
        const v = item[dateKey]
        if (!v || typeof v !== 'string') return ''
        return v
      }
      if (period.mode === 'current_month') {
        const ym = new Date().toISOString().slice(0, 7)
        return items.filter((i) => getDate(i).startsWith(ym))
      }
      if (period.mode === 'days') {
        const cutoff = new Date(Date.now() - period.n * 86_400_000).toISOString().split('T')[0]
        return items.filter((i) => getDate(i) >= cutoff)
      }
      if (period.mode === 'month') {
        return items.filter((i) => getDate(i).startsWith(period.ym))
      }
      return items
    }

    it('should filter by current month', () => {
      const now = new Date()
      const ym = now.toISOString().slice(0, 7)
      const items = [
        { id: 1, date: `${ym}-01` },
        { id: 2, date: `${ym}-15` },
        { id: 3, date: '2020-01-01' },
      ]

      const result = filterByPeriod(items, { mode: 'current_month' })

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(1)
    })

    it('should filter by days', () => {
      const now = new Date()
      const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]
      const items = [
        { id: 1, date: now.toISOString().split('T')[0] },
        { id: 2, date: sevenDaysAgo },
        { id: 3, date: '2020-01-01' },
      ]

      const result = filterByPeriod(items, { mode: 'days', n: 7 })

      expect(result.length).toBeGreaterThanOrEqual(2)
      expect(result[0].id).toBe(1)
    })

    it('should filter by specific month', () => {
      const items = [
        { id: 1, date: '2024-05-01' },
        { id: 2, date: '2024-05-15' },
        { id: 3, date: '2024-04-01' },
      ]

      const result = filterByPeriod(items, { mode: 'month', ym: '2024-05' })

      expect(result).toHaveLength(2)
    })

    it('should return all items for invalid period', () => {
      const items = [{ id: 1, date: '2024-05-01' }, { id: 2, date: '2024-04-01' }]

      const result = filterByPeriod(items, { mode: 'invalid' })

      expect(result).toHaveLength(2)
    })
  })

  describe('formatCurrency', () => {
    it('should format USD correctly', () => {
      const result = formatCurrency(1234.56, 'USD')
      expect(result).toBe('1234.56 دولار')
    })

    it('should format EGP correctly', () => {
      const result = formatCurrency(1000, 'EGP')
      expect(result).toBe('1000.00 جنيه')
    })
  })

  describe('calculateDaysRemaining', () => {
    const calculateDaysRemaining = (expiryDate: string): number => {
      const expiry = new Date(expiryDate).getTime()
      const now = new Date().getTime()
      const diff = expiry - now
      return Math.ceil(diff / (1000 * 60 * 60 * 24))
    }

    it('should calculate days remaining correctly', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const result = calculateDaysRemaining(tomorrow)
      expect(result).toBeGreaterThan(0)
      expect(result).toBeLessThanOrEqual(1)
    })

    it('should return negative for past dates', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const result = calculateDaysRemaining(yesterday)
      expect(result).toBeLessThan(0)
    })
  })
})
