"use client";

// Kept for backward compatibility — delegates to useHeartbeat which runs
// both the 30s RTDB presence update and the 60s Firestore REST heartbeat.
export { useHeartbeat as useSessionHeartbeat } from "@/hooks/useHeartbeat";
