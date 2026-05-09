"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, CheckCheck, ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { notificationService } from "@/services/notification.service";
import NotificationCard from "./NotificationCard";

interface NotificationDropdownProps {
  onClose: () => void;
}

export default function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { user }          = useAuthStore();
  const { notifications, markReadLocally, markAllReadLocally, archiveLocally } =
    useNotificationStore();

  const ref = useRef<HTMLDivElement>(null);
  const uid = user?.uid ?? "";

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const recent = notifications.slice(0, 8);
  const unread = notifications.filter((n) => !n.readBy?.includes(uid));

  function handleMarkRead(id: string) {
    markReadLocally(id, uid);
    notificationService.markAsRead(id, uid).catch(console.warn);
  }

  function handleMarkAll() {
    const ids = unread.map((n) => n.id);
    markAllReadLocally(uid);
    notificationService.markAllAsRead(ids, uid).catch(console.warn);
  }

  function handleArchive(id: string) {
    archiveLocally(id);
    notificationService.archiveNotification(id).catch(console.warn);
  }

  return (
    // The panel sits outside the sidebar via fixed positioning so it can overflow
    <div
      ref={ref}
      className="fixed z-[60] bg-white rounded-2xl shadow-2xl border border-slate-200
        w-[360px] max-h-[600px] flex flex-col overflow-hidden"
      style={{
        // Position to the left of the sidebar (which is w-64 = 256px on the right)
        right: "272px",
        top:   "16px",
      }}
    >
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-slate-500" />
          <span className="font-bold text-slate-800 text-sm">الإشعارات</span>
          {unread.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-bold min-w-[18px] text-center">
              {unread.length > 99 ? "99+" : unread.length}
            </span>
          )}
        </div>
        {unread.length > 0 && (
          <button
            onClick={handleMarkAll}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition"
          >
            <CheckCheck size={13} />
            قراءة الكل
          </button>
        )}
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {recent.length === 0 ? (
          <div className="py-10 text-center">
            <Bell size={28} className="text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">لا توجد إشعارات</p>
          </div>
        ) : (
          recent.map((n) => (
            <NotificationCard
              key={n.id}
              notification={n}
              currentUid={uid}
              onMarkRead={handleMarkRead}
              onArchive={handleArchive}
              compact
            />
          ))
        )}
      </div>

      {/* footer */}
      <div className="shrink-0 border-t border-slate-100 px-4 py-2.5">
        <Link
          href="/notifications"
          onClick={onClose}
          className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-semibold transition"
        >
          عرض كل الإشعارات
          <ArrowLeft size={14} />
        </Link>
      </div>
    </div>
  );
}
