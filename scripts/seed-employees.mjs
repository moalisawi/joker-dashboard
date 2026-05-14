/**
 * seed-employees.mjs
 * ينشئ حسابات ميدو وميار وحنان عبر API الموظفين
 *
 * الاستخدام:
 *   node scripts/seed-employees.mjs
 *
 * سيطلب منك كلمة مرورك (المالك) ثم ينشئ الحسابات الثلاثة.
 */

import { createInterface } from "readline";
import { createServer }    from "http";

const API_KEY   = "AIzaSyAB_RIpmKxbTpVXDpMWsLUMCxafocxjwaQ";
const BASE_URL  = "http://localhost:3000";
const OWNER_EMAIL = "zoromedo2000@gmail.com";

const EMPLOYEES = [
  { fullName: "ميدو",  email: "medo@joker.com",  password: "Temp@1234", employeeRole: "sales", department: "مبيعات" },
  { fullName: "ميار",  email: "mayar@joker.com",  password: "Temp@1234", employeeRole: "sales", department: "مبيعات" },
  { fullName: "حنان",  email: "hanan@joker.com",  password: "Temp@1234", employeeRole: "sales", department: "مبيعات" },
];

// ── اقرأ كلمة المرور من stdin بدون إظهارها ────────────────────────────────────
function readPassword(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(prompt);
    rl.stdoutMuted = true;
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    rl._writeToOutput = (s) => {
      if (!rl.stdoutMuted) process.stdout.write(s);
    };
  });
}

// ── تسجيل دخول المالك ─────────────────────────────────────────────────────────
async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`تسجيل الدخول فشل: ${data.error?.message ?? res.status}`);
  return data.idToken;
}

// ── إنشاء موظف واحد ───────────────────────────────────────────────────────────
async function createEmployee(token, emp) {
  const res = await fetch(`${BASE_URL}/api/employees/create`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(emp),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.uid;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== seed-employees ===\n");

  // قبول كلمة المرور من متغير بيئة أو stdin تفاعلي
  const password = process.env.OWNER_PASSWORD
    ?? await readPassword(`كلمة مرورك (${OWNER_EMAIL}): `);

  let token;
  try {
    token = await signIn(OWNER_EMAIL, password);
    console.log("✓ تم تسجيل الدخول\n");
  } catch (e) {
    console.error("✕", e.message);
    process.exit(1);
  }

  let ok = 0;
  for (const emp of EMPLOYEES) {
    process.stdout.write(`  إنشاء ${emp.fullName} (${emp.email}) ... `);
    try {
      const uid = await createEmployee(token, emp);
      console.log(`✓  uid: ${uid}`);
      ok++;
    } catch (e) {
      console.log(`✕  ${e.message}`);
    }
  }

  console.log(`\n${ok}/${EMPLOYEES.length} حسابات أُنشئت بنجاح.`);
  if (ok > 0) {
    console.log("\nكلمة المرور المؤقتة لجميعهم: Temp@1234");
    console.log("الإحصائيات ستظهر تلقائياً لأن أسماءهم مطابقة لحقل 'convincedBy' في بيانات المشتركين.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
