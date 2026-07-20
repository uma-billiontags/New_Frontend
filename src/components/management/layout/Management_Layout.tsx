// Management_Layout.tsx
import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import Management_Sidebar from "./Management_Sidebar";

interface Notification {
  id: number;
  message: string;
  time: string;
  read: boolean;
}

export default function Management_Layout() {
  // ── Notification state ───────────────────────────────────────────────────
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const saved = localStorage.getItem("crm_notifications");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("crm_notifications", JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
    localStorage.removeItem("crm_notifications");
    setShowDropdown(false);
  };

  const handleToggleDropdown = () => {
    setShowDropdown((prev) => !prev);
    if (!showDropdown) markAllRead();
  };

  return (
    <div className="db-root">
      <Management_Sidebar
        notifications={notifications}
        unreadCount={unreadCount}
        showDropdown={showDropdown}
        onToggleDropdown={handleToggleDropdown}
        onClearAll={clearAll}
        dropdownRef={dropdownRef}
      />

      {/* ── Main — no header, just the outlet ── */}
      <div className="db-main">
        <main className="db-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}