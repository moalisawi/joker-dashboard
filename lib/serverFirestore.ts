/**
 * Firestore REST API helpers.
 * Used as a fallback when Firebase Admin SDK credentials are not configured
 * (local development). On production, the Admin SDK is preferred.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "joker-prod";
const FS_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ─── Wire format ──────────────────────────────────────────────────────────────

function toFV(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: "NULL_VALUE" };
  if (typeof v === "string")  return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v))  return { arrayValue: { values: v.map(toFV) } };
  if (typeof v === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, toFV(val)])
        ),
      },
    };
  }
  return { nullValue: "NULL_VALUE" };
}

function fromFV(v: Record<string, unknown>): unknown {
  if ("stringValue"    in v) return v.stringValue;
  if ("booleanValue"   in v) return v.booleanValue;
  if ("integerValue"   in v) return Number(v.integerValue);
  if ("doubleValue"    in v) return v.doubleValue;
  if ("nullValue"      in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) {
    const arr = (v.arrayValue as { values?: unknown[] }).values ?? [];
    return arr.map((i) => fromFV(i as Record<string, unknown>));
  }
  if ("mapValue" in v) {
    const f = (v.mapValue as { fields?: Record<string, unknown> }).fields ?? {};
    return Object.fromEntries(
      Object.entries(f).map(([k, val]) => [k, fromFV(val as Record<string, unknown>)])
    );
  }
  return null;
}

function toFields(data: Record<string, unknown>) {
  return {
    fields: Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, toFV(v)])
    ),
  };
}

function fromDoc(doc: { fields?: Record<string, unknown> }): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(doc.fields ?? {}).map(([k, v]) => [k, fromFV(v as Record<string, unknown>)])
  );
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function fsReq(
  url: string,
  method: string,
  token: string,
  body?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Firestore REST error ${res.status}`);
  }
  return res.json() as Promise<Record<string, unknown>>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Read a document. Returns null if not found. */
export async function fsGet(
  collection: string,
  id: string,
  token: string
): Promise<Record<string, unknown> | null> {
  try {
    const doc = await fsReq(`${FS_BASE}/${collection}/${id}`, "GET", token);
    return fromDoc(doc as { fields?: Record<string, unknown> });
  } catch {
    return null;
  }
}

/** Create or overwrite a document at a specific ID. */
export async function fsSet(
  collection: string,
  id: string,
  data: Record<string, unknown>,
  token: string
): Promise<void> {
  await fsReq(`${FS_BASE}/${collection}/${id}`, "PATCH", token, toFields(data));
}

/** Update specific fields of a document (field mask). */
export async function fsPatch(
  collection: string,
  id: string,
  updates: Record<string, unknown>,
  token: string
): Promise<void> {
  const mask = Object.keys(updates)
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");
  await fsReq(`${FS_BASE}/${collection}/${id}?${mask}`, "PATCH", token, toFields(updates));
}

/** Add a document with auto-generated ID. Returns the new document ID. */
export async function fsAdd(
  collection: string,
  data: Record<string, unknown>,
  token: string
): Promise<string> {
  const doc = await fsReq(`${FS_BASE}/${collection}`, "POST", token, toFields(data));
  const parts = ((doc as { name?: string }).name ?? "").split("/");
  return parts[parts.length - 1];
}

/** Returns true when Firebase Admin SDK credentials are configured. */
export function hasAdminCredentials(): boolean {
  return Boolean(
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}
