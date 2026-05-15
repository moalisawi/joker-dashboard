import { Timestamp } from "firebase/firestore";
import type { Role } from "./user";

export type DeviceType    = "desktop" | "mobile" | "tablet";
export type SessionStatus = "active" | "logged_out" | "expired" | "suspicious";

export interface LoginSession {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: Role;

  // Canonical status + legacy boolean (kept in sync)
  status:   SessionStatus;
  isActive: boolean;

  // Timestamps
  loginAt:    Timestamp;
  logoutAt?:  Timestamp;
  lastSeenAt: Timestamp;
  createdAt:  Timestamp;

  // Duration in seconds — set on logout/revoke, undefined while active
  sessionDuration?: number;

  // Network
  ipAddress: string;
  country?:  string;
  city?:     string;

  // Device
  userAgent:       string;
  browser:         string;
  browserVersion?: string;
  os:              string;
  osVersion?:      string;
  device:          DeviceType;

  // Security flags
  isSuspicious: boolean;
  revokedAt?:   Timestamp;
  revokedBy?:   string;
}

export interface FailedLoginAttempt {
  id:          string;
  email?:      string;
  ipAddress:   string;
  userAgent:   string;
  browser:     string;
  os:          string;
  device:      DeviceType;
  reason:      string;
  attemptedAt: Timestamp;
}

export interface SessionSummary {
  totalActive: number;
  onlineNow:   number;
  todayLogins: number;
  failedToday: number;
}
