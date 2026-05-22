"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import NotificationDropdown from "./NotificationDropdown";

export default function NotificationBell() {
  const { user }           = useAuthStore();
  const { unreadCount }    = useNotificationStore();
  const [open, setOpen]    = useState(false);

  const uid   = user?.uid ?? "";
  const count = unreadCount(uid);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center justify-center w-8 h-8 rounded-xl
          transition-all duration-150 group
          ${open
            ? "bg-white/20 text-white"
            : "text-white/55 hover:bg-white/[0.07] hover:text-white/90"
          }`}
        title="الإشعارات"
        aria-label="الإشعارات"
      >
        <Bell size={17} />
        {count > 0 && (
          <span
            className="absolute -top-1 -left-1 min-w-[16px] h-4 px-0.5
              rounded-full bg-red-500 text-white text-[10px] font-black
              flex items-center justify-center leading-none
              ring-2 ring-[#5B5FEF]"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && <NotificationDropdown onClose={() => setOpen(false)} />}
    </div>
  );
}
