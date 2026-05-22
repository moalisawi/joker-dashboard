'use client'

import React, { useMemo, useCallback, useState } from 'react'
import type { Subscriber } from '@/types'
import { debounce } from '@/lib/performance'

interface SubscribersTableOptimizedProps {
  subscribers: Subscriber[]
  onSelectSubscriber: (subscriber: Subscriber) => void
}

/**
 * محسّن الأداء:
 * 1. استخدام React.memo لـ prevent re-renders
 * 2. useMemo للـ expensive calculations
 * 3. useCallback لـ memoized callbacks
 * 4. pagination بدلاً من rendering كل الـ subscribers
 */

interface TableRowProps {
  subscriber: Subscriber
  onSelect: (subscriber: Subscriber) => void
}

const SubscriberRow = React.memo(({ subscriber, onSelect }: TableRowProps) => (
  <tr
    onClick={() => onSelect(subscriber)}
    className="cursor-pointer hover:bg-slate-50"
  >
    <td className="px-4 py-3 text-sm">{subscriber.name}</td>
    <td className="px-4 py-3 text-sm">{subscriber.phone}</td>
    <td className="px-4 py-3 text-sm">
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${
          subscriber.status === 'نشط'
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}
      >
        {subscriber.status}
      </span>
    </td>
    <td className="px-4 py-3 text-sm">{subscriber.daysRemaining} يوم</td>
  </tr>
))
SubscriberRow.displayName = 'SubscriberRow'

export default function SubscribersTableOptimized({
  subscribers,
  onSelectSubscriber,
}: SubscribersTableOptimizedProps) {
  const [page, setPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')

  const pageSize = 25

  // Memoized filtered and paginated data
  const paginatedData = useMemo(() => {
    const filtered = subscribers.filter((s) =>
      s.name.includes(searchTerm) || s.phone.includes(searchTerm)
    )

    const start = (page - 1) * pageSize
    const end = start + pageSize

    return {
      items: filtered.slice(start, end),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / pageSize),
    }
  }, [subscribers, searchTerm, page])

  // Debounced search handler
  const handleSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value)
      setPage(1)
    }, 300),
    []
  )

  // Memoized callback
  const handleSelectSubscriber = useCallback(
    (subscriber: Subscriber) => {
      onSelectSubscriber(subscriber)
    },
    [onSelectSubscriber]
  )

  return (
    <div className="space-y-4">
      {/* Search input */}
      <input
        type="text"
        placeholder="ابحث عن المشتركين..."
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full px-4 py-2 border rounded-lg"
      />

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="px-4 py-3 text-right text-sm font-semibold">الاسم</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">الهاتف</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">الحالة</th>
              <th className="px-4 py-3 text-right text-sm font-semibold">الأيام المتبقية</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.items.map((subscriber) => (
              <SubscriberRow
                key={subscriber.id}
                subscriber={subscriber}
                onSelect={handleSelectSubscriber}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {paginatedData.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            عرض {paginatedData.items.length} من {paginatedData.total}
          </span>
          <div className="flex gap-2">
            {Array.from({ length: paginatedData.totalPages }).map((_, i) => (
              <button
                key={i + 1}
                onClick={() => setPage(i + 1)}
                className={`px-3 py-1 rounded text-sm ${
                  page === i + 1
                    ? 'bg-black text-white'
                    : 'bg-slate-100 text-black hover:bg-slate-200'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {paginatedData.items.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          لا توجد نتائج
        </div>
      )}
    </div>
  )
}
