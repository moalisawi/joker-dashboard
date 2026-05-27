"use client";

import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2, XCircle, TrendingUp, Users, ShieldCheck,
  BarChart3, Zap, Clock, Globe, DollarSign, AlertTriangle,
  RefreshCw, Lock, Layers, Sparkles, Target, PieChart,
  Bell, UserCheck, CreditCard, CalendarDays, TrendingDown,
  Phone, Building2, Rocket, ArrowLeft, ChevronDown,
  Eye, Award, Brain, Timer, Banknote, Activity,
  Settings, Database, LineChart, FileText,
} from "lucide-react";

// ─── Premium CSS ───────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes float-a {
    0%,100% { transform: translateY(0px) rotate(0deg) scale(1); }
    50%      { transform: translateY(-24px) rotate(4deg) scale(1.04); }
  }
  @keyframes float-b {
    0%,100% { transform: translateY(0px) rotate(0deg); }
    50%      { transform: translateY(18px) rotate(-3deg); }
  }
  @keyframes pulse-ring {
    0%,100% { box-shadow: 0 0 0 0 rgba(91,95,239,0.35); }
    50%      { box-shadow: 0 0 0 12px rgba(91,95,239,0); }
  }
  @keyframes shimmer-bg {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes gradient-shift {
    0%,100% { background-position: 0% 50%; }
    50%      { background-position: 100% 50%; }
  }
  @keyframes fade-rise {
    from { opacity: 0; transform: translateY(36px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes bar-grow {
    from { height: 0; }
  }
  .float-a { animation: float-a 7s ease-in-out infinite; }
  .float-b { animation: float-b 9s ease-in-out infinite; }
  .pulse-ring { animation: pulse-ring 2.8s ease-in-out infinite; }
  .gradient-text {
    background: linear-gradient(135deg,#818CF8,#5B5FEF,#A78BFA,#60A5FA,#818CF8);
    background-size: 300% 300%;
    animation: gradient-shift 5s ease infinite;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }
  .reveal {
    opacity: 0;
    transform: translateY(40px);
    transition: opacity 0.75s cubic-bezier(.22,1,.36,1), transform 0.75s cubic-bezier(.22,1,.36,1);
  }
  .reveal.in  { opacity: 1; transform: translateY(0); }
  .reveal-d1  { transition-delay: .08s; }
  .reveal-d2  { transition-delay: .17s; }
  .reveal-d3  { transition-delay: .26s; }
  .reveal-d4  { transition-delay: .35s; }
  .reveal-d5  { transition-delay: .44s; }
  .reveal-d6  { transition-delay: .53s; }
  .bar-grow   { animation: bar-grow .8s ease-out both; }
  .card-hover { transition: transform .2s ease, box-shadow .2s ease; }
  .card-hover:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(15,23,42,.10) !important; }
  * { box-sizing: border-box; }
`;

// ─── Scroll reveal hook ────────────────────────────────────────────────────────
function useInjectStyles(css: string) {
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = css;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, [css]);
}

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function Counter({ to, prefix = "", suffix = "", duration = 1800, active }: {
  to: number; prefix?: string; suffix?: string; duration?: number; active: boolean;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const p = Math.min((Date.now() - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * to));
      if (p >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [active, to, duration]);
  return <>{prefix}{val.toLocaleString()}{suffix}</>;
}

// ─── Mock data ─────────────────────────────────────────────────────────────────
const EMPLOYEES = [
  { name: "محمد يوسف",  role: "مبيعات",  subs: 47, rev: "$3,420", renewal: 88, trend: "+12%", c: "#5B5FEF", bg: "#EEF0FF" },
  { name: "نورا أحمد",  role: "مبيعات",  subs: 38, rev: "$2,890", renewal: 82, trend: "+8%",  c: "#22C55E", bg: "#ECFDF3" },
  { name: "عمر خالد",   role: "متابعة",  subs: 31, rev: "$2,150", renewal: 79, trend: "+5%",  c: "#F59E0B", bg: "#FFFBEB" },
  { name: "ليلى سمير",  role: "متابعة",  subs: 26, rev: "$1,780", renewal: 91, trend: "+15%", c: "#8B5CF6", bg: "#F5F3FF" },
];

// ─── Small reusables ───────────────────────────────────────────────────────────
function Badge({ children, color = "#5B5FEF", bg = "#EEF0FF", border = "rgba(91,95,239,.20)" }: {
  children: React.ReactNode; color?: string; bg?: string; border?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 mb-5 text-[12.5px] font-bold"
      style={{ background: bg, color, border: `1px solid ${border}` }}>
      {children}
    </div>
  );
}

function H2Light({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="text-center mb-14">
      <h2 className="reveal font-black text-[28px] md:text-[37px] leading-tight mb-4"
        style={{ color: "#111827", letterSpacing: "-.026em" }}>{children}</h2>
      {sub && <p className="reveal reveal-d1 text-[15px] max-w-[520px] mx-auto" style={{ color: "#6B7280" }}>{sub}</p>}
    </div>
  );
}

function H2Dark({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="text-center mb-14">
      <h2 className="reveal font-black text-[28px] md:text-[37px] leading-tight mb-4"
        style={{ color: "#FFFFFF", letterSpacing: "-.026em" }}>{children}</h2>
      {sub && <p className="reveal reveal-d1 text-[15px] max-w-[520px] mx-auto" style={{ color: "#94A3B8" }}>{sub}</p>}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function PitchPage() {
  useReveal();
  useInjectStyles(STYLES);

  // counters visibility
  const counterRef = useRef<HTMLDivElement>(null);
  const [countersOn, setCountersOn] = useState(false);
  useEffect(() => {
    const el = counterRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setCountersOn(true); io.disconnect(); } }, { threshold: .5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo',Inter,system-ui,sans-serif", background: "#F5F7FB", color: "#111827" }}>

      {/* ══════════════════════════════════════════════════════════════════
          §1  HERO — Cinematic hook
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background: "linear-gradient(160deg,#060C1A 0%,#0D1628 45%,#121E38 75%,#0A1020 100%)", minHeight: "100vh", position: "relative", overflow: "hidden" }}
        className="flex flex-col justify-center items-center pt-20 pb-16 px-6">

        {/* Animated orbs */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <div className="float-a" style={{ position: "absolute", top: "8%", right: "3%", width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle,rgba(91,95,239,.18) 0%,transparent 68%)" }} />
          <div className="float-b" style={{ position: "absolute", bottom: "10%", left: "5%", width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle,rgba(79,70,229,.12) 0%,transparent 68%)" }} />
          <div style={{ position: "absolute", top: "38%", left: "35%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(91,95,239,.06) 0%,transparent 68%)" }} />
          {/* Grid lines */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(91,95,239,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(91,95,239,.05) 1px,transparent 1px)", backgroundSize: "64px 64px" }} />
        </div>

        <div className="relative max-w-[1060px] mx-auto text-center">
          {/* Live badge */}
          <div className="reveal inline-flex items-center gap-2 rounded-full px-5 py-2 mb-8 text-[13px] font-semibold"
            style={{ background: "rgba(91,95,239,.12)", border: "1px solid rgba(91,95,239,.30)", color: "#A5B4FC", backdropFilter: "blur(10px)" }}>
            <Sparkles size={14} />
            نظام إدارة ذكي لأكاديميات التغذية
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", display: "inline-block", boxShadow: "0 0 6px #22C55E" }} />
          </div>

          {/* Headline */}
          <h1 className="reveal reveal-d1 font-black mb-6"
            style={{ fontSize: "clamp(36px,6.5vw,72px)", lineHeight: 1.1, letterSpacing: "-.045em" }}>
            <span style={{ color: "#FFFFFF" }}>بيانات مشروعك مبعثرة.</span>
            <br />
            <span className="gradient-text">وقتك يضيع. أرباحك تتسرّب.</span>
          </h1>

          <p className="reveal reveal-d2 max-w-[600px] mx-auto mb-12 leading-relaxed"
            style={{ fontSize: 17, color: "#94A3B8" }}>
            Joker Dashboard يحوّل إدارة مشروعك من فوضى يومية إلى نظام ذكي مبني على بيانات حقيقية —
            كل شيء من مكان واحد، في ثوانٍ.
          </p>

          {/* CTA row */}
          <div className="reveal reveal-d3 flex flex-wrap justify-center gap-4 mb-20">
            <a href="/login" className="inline-flex items-center gap-2 px-8 py-4 rounded-[14px] font-bold card-hover"
              style={{ background: "#5B5FEF", color: "#FFFFFF", fontSize: 15, boxShadow: "0 10px 32px rgba(91,95,239,.50)" }}>
              <Rocket size={18} /> جرّب النظام الآن
            </a>
            <a href="#showcase" className="inline-flex items-center gap-2 px-8 py-4 rounded-[14px] font-semibold"
              style={{ background: "rgba(255,255,255,.06)", color: "#E2E8F0", fontSize: 15, border: "1px solid rgba(255,255,255,.12)", backdropFilter: "blur(8px)" }}>
              شوف كيف يشتغل <ArrowLeft size={16} />
            </a>
          </div>

          {/* Animated KPI strip */}
          <div ref={counterRef} className="reveal reveal-d4 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-[900px] mx-auto">
            {([
              { icon: <Users size={18} />,      to: 248,   suffix: "+",   label: "مشترك مُدار",          c: "#818CF8" },
              { icon: <RefreshCw size={18} />,   to: 87,    suffix: "%",   label: "معدل التجديد",         c: "#34D399" },
              { icon: <DollarSign size={18} />,  to: 14820, prefix: "$",   label: "إيرادات مُتتبَّعة",    c: "#FBBF24" },
              { icon: <Zap size={18} />,         to: 2,     prefix: "< ",  suffix: "s", label: "وصول فوري للبيانات", c: "#F87171" },
            ] as const).map((s, i) => (
              <div key={i} className="rounded-[20px] p-5 text-center"
                style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", backdropFilter: "blur(8px)" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, color: s.c }}>{s.icon}</div>
                <div className="font-black text-[24px] mb-1" style={{ color: s.c }}>
                  <Counter to={s.to} prefix={"prefix" in s ? s.prefix : ""} suffix={"suffix" in s ? s.suffix : ""} active={countersOn} />
                </div>
                <div style={{ fontSize: 12, color: "#64748B" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1" style={{ color: "#334155" }}>
          <span style={{ fontSize: 11 }}>اسكرول للأسفل</span>
          <ChevronDown size={15} />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          §2  REALITY CHECK — Pain section
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background: "#FFFFFF" }} className="py-24">
        <div className="max-w-[1060px] mx-auto px-6">
          <div className="text-center mb-14">
            <Badge color="#EF4444" bg="#FEF2F2" border="rgba(239,68,68,.20)">
              <AlertTriangle size={13} /> الواقع الحالي
            </Badge>
            <H2Light sub="أغلب أكاديميات التغذية تعمل هكذا — وهذا بالضبط ما يحدّ من نموها">
              هل هذا يصف يومك الآن؟
            </H2Light>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { n:"01", icon:<Clock size={22}/>,        title:"3+ ساعات يومياً تهدر",       desc:"تتبع يدوي في إكسل — من دفع، من لم يدفع، من اشتراكه ينتهي. نفس الدورة كل يوم بلا توقف." },
              { n:"02", icon:<TrendingDown size={22}/>,  title:"تجديدات تضيع بصمت",          desc:"مشتركون لا يجددون فقط لأن أحداً لم يتواصل معهم في الوقت المناسب — وهذا مال يخرج من جيبك." },
              { n:"03", icon:<Users size={22}/>,         title:"فريق بلا متابعة حقيقية",      desc:"ما تعرف من يشتغل فعلاً ومن يضيع الوقت — الأرقام مبعثرة ولا مرجع مشترك واضح." },
              { n:"04", icon:<BarChart3 size={22}/>,     title:"قرارات بالحدس لا الأرقام",   desc:"تتخذ قرارات تسويقية ومالية بدون بيانات دقيقة — لأن التقارير إما غير موجودة أو غير موثوقة." },
              { n:"05", icon:<DollarSign size={22}/>,    title:"مالية ضبابية يومياً",         desc:"كم جنيت هذا الشهر فعلياً؟ كم المتأخر؟ كم الإيراد الصافي؟ — ما في إجابة سريعة وواضحة." },
              { n:"06", icon:<ShieldCheck size={22}/>,   title:"بيانات العملاء بلا حماية",   desc:"جوجل شيت مشترك بين الموظفين — كل شخص يرى كل شيء. لا صلاحيات، لا أمان، لا خصوصية." },
            ].map((p, i) => (
              <div key={i} className={`reveal reveal-d${(i%3)+1} card-hover rounded-[22px] p-6 relative overflow-hidden`}
                style={{ background:"#FAFBFF", border:"1px solid #EEF2F7", boxShadow:"0 2px 12px rgba(15,23,42,.04)" }}>
                <span style={{ position:"absolute", top:14, left:18, fontWeight:900, fontSize:40, color:"rgba(239,68,68,.06)", lineHeight:1 }}>{p.n}</span>
                <div className="w-11 h-11 rounded-[12px] flex items-center justify-center mb-4"
                  style={{ background:"#FEF2F2", color:"#EF4444" }}>{p.icon}</div>
                <h3 className="font-bold mb-2" style={{ fontSize:15, color:"#111827" }}>{p.title}</h3>
                <p style={{ fontSize:13.5, color:"#6B7280", lineHeight:1.65 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          §3  TRANSFORMATION — Before ↔ After
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background:"linear-gradient(180deg,#F5F7FB 0%,#EEF0FF 100%)" }} className="py-24">
        <div className="max-w-[1060px] mx-auto px-6">
          <div className="text-center mb-14">
            <Badge><Sparkles size={13} /> التحوّل</Badge>
            <H2Light sub="فرق حقيقي، ملموس، من اليوم الأول">
              من فوضى يومية إلى نظام مبني على بيانات
            </H2Light>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* BEFORE */}
            <div className="reveal rounded-[24px] p-8"
              style={{ background:"#FFFFFF", border:"1px solid #FEE2E2", boxShadow:"0 4px 24px rgba(239,68,68,.06)" }}>
              <div className="flex items-center gap-3 mb-7">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background:"#FEF2F2" }}>
                  <XCircle size={18} color="#EF4444" />
                </div>
                <span className="font-black" style={{ fontSize:15, color:"#EF4444" }}>قبل النظام — الواقع الحالي</span>
              </div>
              {["إكسل وجوجل شيت بدون أي أتمتة","كل موظف يدخل البيانات بطريقته","تتبع المدفوعات يدوياً كل يوم","لا تنبيهات — تجديدات تنسى وتضيع","تقارير تستغرق ساعات للإعداد","لا رؤية لأداء الفريق","قرارات بدون أرقام حقيقية"].map((t,i)=>(
                <div key={i} className="flex items-center gap-3 py-2.5 border-b" style={{ borderColor:"#FEF2F2" }}>
                  <XCircle size={15} color="#EF4444" style={{ flexShrink:0 }} />
                  <span style={{ fontSize:13.5, color:"#9CA3AF" }}>{t}</span>
                </div>
              ))}
            </div>

            {/* AFTER */}
            <div className="reveal reveal-d2 rounded-[24px] p-8"
              style={{ background:"linear-gradient(145deg,#0B1020,#1A2745)", border:"1px solid rgba(91,95,239,.25)", boxShadow:"0 8px 36px rgba(91,95,239,.15)" }}>
              <div className="flex items-center gap-3 mb-7">
                <div className="w-8 h-8 rounded-full flex items-center justify-center pulse-ring" style={{ background:"rgba(34,197,94,.15)", border:"1px solid rgba(34,197,94,.30)" }}>
                  <CheckCircle2 size={18} color="#22C55E" />
                </div>
                <span className="font-black" style={{ fontSize:15, color:"#22C55E" }}>مع Joker Dashboard</span>
              </div>
              {["نظام مركزي واحد لكل البيانات","كل موظف يرى فقط ما يخصه","تتبع مدفوعات آني بجميع العملات","تنبيهات تلقائية قبل انتهاء أي اشتراك","تقارير فورية بنقرة واحدة","لوحة أداء الفريق في لحظتها","قرارات مبنية على تحليلات حقيقية"].map((t,i)=>(
                <div key={i} className="flex items-center gap-3 py-2.5 border-b" style={{ borderColor:"rgba(255,255,255,.06)" }}>
                  <CheckCircle2 size={15} color="#22C55E" style={{ flexShrink:0 }} />
                  <span style={{ fontSize:13.5, color:"#CBD5E1" }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          §4  DASHBOARD SHOWCASE — Live mockup
      ══════════════════════════════════════════════════════════════════ */}
      <section id="showcase" style={{ background:"#F5F7FB" }} className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-14">
            <Badge><Eye size={13} /> معاينة النظام</Badge>
            <H2Light sub="بدل ما تفتح 7 أدوات مختلفة — شاشة واحدة تعطيك الصورة كاملة">
              كل شيء أمامك. في ثوانٍ.
            </H2Light>
          </div>

          <div className="reveal rounded-[28px] overflow-hidden"
            style={{ background:"#FFFFFF", boxShadow:"0 36px 90px rgba(15,23,42,.14)", border:"1px solid #E5E7EB" }}>
            {/* Browser chrome */}
            <div className="flex items-center justify-between px-6 py-3.5" style={{ background:"#F8FAFC", borderBottom:"1px solid #E5E7EB" }}>
              <div className="flex items-center gap-2">
                {["#FF5F57","#FFBD2E","#28C840"].map((c,i)=>(
                  <div key={i} style={{ width:12, height:12, borderRadius:"50%", background:c }} />
                ))}
              </div>
              <div className="rounded-[8px] px-5 py-1.5" style={{ background:"#FFFFFF", border:"1px solid #E5E7EB", fontSize:12, color:"#9CA3AF" }}>
                dashboard.joker.app
              </div>
              <div className="flex items-center gap-2">
                <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#5B5FEF,#818CF8)" }} />
                <span style={{ fontSize:12, fontWeight:600, color:"#374151" }}>محمد — المالك</span>
              </div>
            </div>

            {/* Dashboard body */}
            <div className="p-6" style={{ background:"#F5F7FB" }}>
              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {[
                  { label:"إجمالي المشتركين", val:"248", chg:"+12%", icon:<Users size={15}/>,      c:"#5B5FEF", bg:"#EEF0FF" },
                  { label:"نشطون الآن",        val:"189", chg:"+8%",  icon:<Activity size={15}/>,   c:"#22C55E", bg:"#ECFDF3" },
                  { label:"الإيرادات (USD)",   val:"$14,820", chg:"+23%", icon:<DollarSign size={15}/>, c:"#F59E0B", bg:"#FFFBEB" },
                  { label:"معدل التجديد",      val:"87%", chg:"+5%",  icon:<RefreshCw size={15}/>,  c:"#8B5CF6", bg:"#F5F3FF" },
                ].map((k,i)=>(
                  <div key={i} className="rounded-[18px] p-4" style={{ background:"#FFFFFF", border:"1px solid #EEF2F7", boxShadow:"0 2px 8px rgba(15,23,42,.04)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span style={{ fontSize:11, color:"#9CA3AF", fontWeight:600 }}>{k.label}</span>
                      <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ background:k.bg, color:k.c }}>{k.icon}</div>
                    </div>
                    <div className="font-black" style={{ fontSize:21, color:"#111827" }}>{k.val}</div>
                    <div style={{ fontSize:11, color:"#22C55E", fontWeight:600, marginTop:3 }}>{k.chg} هذا الشهر</div>
                  </div>
                ))}
              </div>

              {/* Charts row */}
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                {/* Bar chart */}
                <div className="md:col-span-2 rounded-[18px] p-5" style={{ background:"#FFFFFF", border:"1px solid #EEF2F7" }}>
                  <div className="flex items-center justify-between mb-4">
                    <span style={{ fontWeight:700, fontSize:13, color:"#111827" }}>الإيرادات الشهرية</span>
                    <span className="rounded-full px-3 py-1" style={{ background:"#EEF0FF", color:"#5B5FEF", fontSize:11, fontWeight:700 }}>آخر 6 أشهر</span>
                  </div>
                  <div className="flex items-end gap-2" style={{ height:88 }}>
                    {([42,60,53,75,68,88] as number[]).map((h,i)=>(
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t-[4px]"
                          style={{ height:`${h}%`, background:i===5?"linear-gradient(180deg,#5B5FEF,#4F46E5)":"#EEF0FF" }} />
                        <span style={{ fontSize:10, color:"#9CA3AF" }}>{["ديس","يناي","فبر","مار","أبر","ماي"][i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Status donut */}
                <div className="rounded-[18px] p-5" style={{ background:"#FFFFFF", border:"1px solid #EEF2F7" }}>
                  <span style={{ fontWeight:700, fontSize:13, color:"#111827", display:"block", marginBottom:16 }}>حالة الاشتراكات</span>
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {[
                      { label:"نشط",          val:189, pct:76, c:"#22C55E" },
                      { label:"ينتهي قريباً", val:28,  pct:11, c:"#F59E0B" },
                      { label:"منتهي",        val:18,  pct:7,  c:"#EF4444" },
                      { label:"موقوف",        val:13,  pct:6,  c:"#94A3B8" },
                    ].map((s,i)=>(
                      <div key={i}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:4 }}>
                          <span style={{ color:"#374151", fontWeight:600 }}>{s.label}</span>
                          <span style={{ color:"#9CA3AF" }}>{s.val}</span>
                        </div>
                        <div className="rounded-full" style={{ background:"#F1F5F9", height:6 }}>
                          <div className="rounded-full" style={{ height:"100%", width:`${s.pct}%`, background:s.c }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mini table */}
              <div className="rounded-[18px] overflow-hidden" style={{ background:"#FFFFFF", border:"1px solid #EEF2F7" }}>
                <div className="grid grid-cols-5 px-5 py-3" style={{ background:"#F8FAFC", borderBottom:"1px solid #EEF2F7" }}>
                  {["المشترك","الباقة","الحالة","مدفوع","أيام"].map((h,i)=>(
                    <span key={i} style={{ fontSize:11.5, fontWeight:700, color:"#9CA3AF" }}>{h}</span>
                  ))}
                </div>
                {[
                  { name:"أحمد محمد العلي",    pkg:"ذهبية", status:"نشط",          paid:"$150", days:45 },
                  { name:"سارة خالد المنصور",  pkg:"فضية",  status:"ينتهي قريباً", paid:"$80",  days:7  },
                  { name:"يوسف إبراهيم الحمد", pkg:"ذهبية", status:"نشط",          paid:"$150", days:58 },
                ].map((r,i)=>(
                  <div key={i} className="grid grid-cols-5 px-5 py-3 border-t" style={{ borderColor:"#F3F4F6" }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"#111827" }}>{r.name}</span>
                    <span style={{ fontSize:13, color:"#6B7280" }}>{r.pkg}</span>
                    <span>
                      <span className="rounded-full px-2.5 py-0.5" style={{ fontSize:11, fontWeight:700, background:r.status==="نشط"?"#ECFDF3":"#FFFBEB", color:r.status==="نشط"?"#22C55E":"#F59E0B" }}>
                        {r.status}
                      </span>
                    </span>
                    <span style={{ fontSize:13, fontWeight:700, color:"#22C55E" }}>{r.paid}</span>
                    <span style={{ fontSize:13, color:"#6B7280" }}>{r.days} يوم</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          §5  BUSINESS BENEFITS — 6 outcomes
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background:"linear-gradient(145deg,#0B1020 0%,#1A2745 100%)" }} className="py-24">
        <div className="max-w-[1060px] mx-auto px-6">
          <div className="text-center mb-14">
            <Badge color="#818CF8" bg="rgba(91,95,239,.12)" border="rgba(91,95,239,.25)">
              <Target size={13} /> تأثير حقيقي
            </Badge>
            <H2Dark sub="مش مجرد تنظيم — قرار تجاري ذكي يعكس نفسه على الأرباح">
              6 نتائج تشعر بها من الأسبوع الأول
            </H2Dark>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon:<Timer size={24}/>,    metric:"3+ ساعات",   c:"#818CF8", title:"وقت يعود إليك كل يوم",         desc:"لا بحث يدوي، لا مراجعة ملفات. الأجوبة أمامك فوراً بدون أي جهد." },
              { icon:<TrendingUp size={24}/>, metric:"↑ 30%",    c:"#34D399", title:"معدل التجديد يرتفع",            desc:"تنبيهات تلقائية قبل انتهاء كل اشتراك — لا تجديد يضيع بسبب نسيان." },
              { icon:<Eye size={24}/>,       metric:"360°",      c:"#FBBF24", title:"رؤية كاملة للمشروع",            desc:"كل البيانات في لوحة واحدة — مشتركون، موظفون، إيرادات. لا مفاجآت." },
              { icon:<Award size={24}/>,     metric:"دقة 100%",  c:"#F87171", title:"اعرف مين يشتغل فعلاً",          desc:"أداء كل موظف بالأرقام — تكافئ الأفضل وتعرف من يحتاج دعم." },
              { icon:<Brain size={24}/>,     metric:"بيانات لا حدس", c:"#60A5FA", title:"قرارات مبنية على أرقام",   desc:"تحليلات فورية تخبرك أين الفرص وأين الخسارة — قبل أن تتفاقم." },
              { icon:<Building2 size={24}/>, metric:"Enterprise", c:"#A78BFA", title:"هيبة واحترافية حقيقية",        desc:"نظام بمستوى المؤسسات الكبيرة — يعطي انطباعاً احترافياً لعملاءك وفريقك." },
            ].map((b,i)=>(
              <div key={i} className={`reveal reveal-d${(i%3)+1} card-hover rounded-[22px] p-6`}
                style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)" }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:18 }}>
                  <div className="w-12 h-12 rounded-[14px] flex items-center justify-center" style={{ background:`${b.c}18`, color:b.c }}>{b.icon}</div>
                  <span className="font-black" style={{ fontSize:14, color:b.c }}>{b.metric}</span>
                </div>
                <h3 className="font-bold mb-2" style={{ fontSize:15.5, color:"#FFFFFF" }}>{b.title}</h3>
                <p style={{ fontSize:13.5, color:"#94A3B8", lineHeight:1.65 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          §6  EMPLOYEE PERFORMANCE — Team analytics
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background:"#FFFFFF" }} className="py-24">
        <div className="max-w-[1060px] mx-auto px-6">
          <div className="text-center mb-14">
            <Badge color="#8B5CF6" bg="#F5F3FF" border="rgba(139,92,246,.20)">
              <Users size={13} /> إدارة الفريق
            </Badge>
            <H2Light sub="بدل التخمين — أرقام واضحة لكل موظف، لحظة بلحظة">
              اعرف بالضبط مين يبيع ومين لا
            </H2Light>
          </div>

          {/* Performance table */}
          <div className="reveal rounded-[24px] overflow-hidden mb-5"
            style={{ border:"1px solid #EEF2F7", boxShadow:"0 8px 32px rgba(15,23,42,.06)" }}>
            <div className="grid grid-cols-5 px-6 py-4" style={{ background:"#F8FAFC", borderBottom:"1px solid #EEF2F7" }}>
              {["الموظف","عدد المشتركين","الإيرادات","معدل التجديد","النمو"].map((h,i)=>(
                <span key={i} style={{ fontSize:12, fontWeight:700, color:"#9CA3AF" }}>{h}</span>
              ))}
            </div>
            {EMPLOYEES.map((e,i)=>(
              <div key={i} className="grid grid-cols-5 px-6 py-4 items-center border-t"
                style={{ borderColor:"#F3F4F6", background:i%2===0?"#FFFFFF":"#FAFBFF" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:14, background:e.bg, color:e.c }}>
                    {e.name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13.5, color:"#111827" }}>{e.name}</div>
                    <div style={{ fontSize:11, color:"#9CA3AF" }}>{e.role}</div>
                  </div>
                </div>
                <span style={{ fontWeight:700, fontSize:14, color:"#111827" }}>{e.subs}</span>
                <span style={{ fontWeight:700, fontSize:14, color:"#22C55E" }}>{e.rev}</span>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ flex:1, height:6, borderRadius:999, background:"#F1F5F9", maxWidth:72 }}>
                    <div style={{ height:"100%", borderRadius:999, width:`${e.renewal}%`, background:e.renewal>=85?"#22C55E":"#F59E0B" }} />
                  </div>
                  <span style={{ fontSize:12, fontWeight:600, color:"#374151" }}>{e.renewal}%</span>
                </div>
                <span style={{ fontSize:13, fontWeight:700, color:"#22C55E" }}>{e.trend}</span>
              </div>
            ))}
            <div className="grid grid-cols-5 px-6 py-4 border-t" style={{ background:"#F8FAFC", borderColor:"#EEF2F7" }}>
              <span style={{ fontSize:12, fontWeight:700, color:"#9CA3AF" }}>الإجمالي</span>
              <span style={{ fontWeight:900, fontSize:14, color:"#5B5FEF" }}>142</span>
              <span style={{ fontWeight:900, fontSize:14, color:"#22C55E" }}>$10,240</span>
              <span style={{ fontWeight:900, fontSize:14, color:"#8B5CF6" }}>85% متوسط</span>
              <span style={{ fontWeight:900, fontSize:14, color:"#22C55E" }}>+10%</span>
            </div>
          </div>

          {/* Insight cards */}
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon:<Award size={19}/>,      c:"#F59E0B", bg:"#FFFBEB", title:"الأفضل أداءً هذا الشهر", val:"محمد يوسف",  sub:"$3,420 إيرادات · 47 مشترك" },
              { icon:<TrendingUp size={19}/>,  c:"#22C55E", bg:"#ECFDF3", title:"أعلى معدل تجديد",         val:"ليلى سمير",  sub:"91% تجديد · +15% نمو" },
              { icon:<Target size={19}/>,      c:"#F59E0B", bg:"#FFFBEB", title:"فرصة للتطوير",            val:"عمر خالد",   sub:"79% تجديد · يحتاج متابعة" },
            ].map((c,i)=>(
              <div key={i} className={`reveal reveal-d${i+1} rounded-[20px] p-5 flex items-center gap-4`}
                style={{ background:c.bg, border:`1px solid ${c.c}25` }}>
                <div style={{ width:40, height:40, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:"#FFFFFF", color:c.c }}>
                  {c.icon}
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:"#9CA3AF", marginBottom:2 }}>{c.title}</div>
                  <div style={{ fontWeight:700, fontSize:14, color:"#111827" }}>{c.val}</div>
                  <div style={{ fontSize:12, color:"#6B7280" }}>{c.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          §7  FINANCIAL TRACKING — Trust section
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background:"linear-gradient(180deg,#F5F7FB 0%,#EEF0FF 100%)" }} className="py-24">
        <div className="max-w-[1060px] mx-auto px-6">
          <div className="text-center mb-14">
            <Badge color="#22C55E" bg="#ECFDF3" border="rgba(34,197,94,.20)">
              <DollarSign size={13} /> التتبع المالي
            </Badge>
            <H2Light sub="كل دفعة مسجلة، كل دين محفوظ، كل تقرير جاهز في ثانية">
              مالية مشروعك واضحة — لا غموض، لا مفاجآت
            </H2Light>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-5">
            {/* Revenue card */}
            <div className="reveal rounded-[24px] p-7"
              style={{ background:"linear-gradient(145deg,#0B1020,#1A2745)", border:"1px solid rgba(91,95,239,.20)", boxShadow:"0 8px 32px rgba(91,95,239,.12)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <span style={{ fontSize:13, color:"#94A3B8" }}>الإيرادات الصافية — مايو 2026</span>
                <span className="rounded-full px-3 py-1" style={{ fontSize:11, fontWeight:700, background:"rgba(34,197,94,.12)", color:"#34D399" }}>+23% عن السابق</span>
              </div>
              <div className="font-black mb-1" style={{ fontSize:46, color:"#FFFFFF", letterSpacing:"-.045em" }}>$14,820</div>
              <div style={{ fontSize:13, color:"#64748B", marginBottom:22 }}>بعد خصم الاسترداد والمدفوعات المعلقة</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label:"محصَّل", val:"$12,400", c:"#34D399" },
                  { label:"معلق",   val:"$2,420",  c:"#FBBF24" },
                  { label:"مسترد",  val:"$0",       c:"#F87171" },
                ].map((f,i)=>(
                  <div key={i} className="rounded-[14px] p-3 text-center" style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.06)" }}>
                    <div className="font-black" style={{ fontSize:15, color:f.c, marginBottom:2 }}>{f.val}</div>
                    <div style={{ fontSize:11, color:"#64748B" }}>{f.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Multi-currency */}
            <div className="reveal reveal-d2 rounded-[24px] p-7" style={{ background:"#FFFFFF", border:"1px solid #EEF2F7", boxShadow:"0 4px 24px rgba(15,23,42,.05)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
                <Globe size={18} color="#5B5FEF" />
                <span style={{ fontWeight:700, fontSize:14, color:"#111827" }}>تتبع متعدد العملات</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {[
                  { cur:"USD", sym:"$",    amt:"14,820",  pct:72, c:"#5B5FEF" },
                  { cur:"EGP", sym:"ج.م",  amt:"185,400", pct:18, c:"#22C55E" },
                  { cur:"JOD", sym:"د.أ",  amt:"4,200",   pct:7,  c:"#F59E0B" },
                  { cur:"ILS", sym:"₪",    amt:"2,800",   pct:3,  c:"#8B5CF6" },
                ].map((c,i)=>(
                  <div key={i}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:6 }}>
                      <span style={{ fontWeight:600, color:"#374151" }}>{c.cur}</span>
                      <span style={{ fontWeight:700, color:c.c }}>{c.sym} {c.amt}</span>
                    </div>
                    <div className="rounded-full" style={{ background:"#F1F5F9", height:7 }}>
                      <div className="rounded-full" style={{ height:"100%", width:`${c.pct}%`, background:c.c }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-[12px] p-4 flex items-center gap-3 mt-5" style={{ background:"#F8FAFC" }}>
                <Lock size={15} color="#5B5FEF" />
                <span style={{ fontSize:12.5, color:"#6B7280" }}>سعر الصرف مقفل وقت الدفع — لا تغيير بأثر رجعي</span>
              </div>
            </div>
          </div>

          {/* Trust strips */}
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { icon:<FileText size={17}/>,    text:"سجل مالي لا يُحذف أبداً" },
              { icon:<ShieldCheck size={17}/>, text:"كل عملية موثقة بمن قام بها" },
              { icon:<CreditCard size={17}/>,  text:"دفع بالتقسيط مدعوم بالكامل" },
              { icon:<RefreshCw size={17}/>,   text:"استرداد واضح ومتتبَّع" },
            ].map((t,i)=>(
              <div key={i} className={`reveal reveal-d${i+1} rounded-[16px] p-4 flex items-center gap-3`}
                style={{ background:"#FFFFFF", border:"1px solid #EEF2F7" }}>
                <div style={{ width:36, height:36, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:"#EEF0FF", color:"#5B5FEF" }}>
                  {t.icon}
                </div>
                <span style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          §8  FEATURES — 6 cards
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background:"#FFFFFF" }} className="py-24">
        <div className="max-w-[1060px] mx-auto px-6">
          <div className="text-center mb-14">
            <Badge><Layers size={13} /> المميزات الأساسية</Badge>
            <H2Light sub="بُني خصيصاً لأكاديميات التغذية — ليس حلاً عاماً">
              نظام واحد يغني عن 6 أدوات
            </H2Light>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon:<BarChart3 size={21}/>,  c:"#5B5FEF", bg:"#EEF0FF", title:"لوحة تحكم مركزية",  points:["كل KPIs في مكان واحد","تحديث لحظي بدون refresh","تنبيهات ذكية تلقائية"] },
              { icon:<Users size={21}/>,      c:"#22C55E", bg:"#ECFDF3", title:"إدارة المشتركين",     points:["بحث فوري بالاسم أو الهاتف","تتبع كامل للتجديدات","تاريخ كل مشترك من اليوم الأول"] },
              { icon:<UserCheck size={21}/>,  c:"#8B5CF6", bg:"#F5F3FF", title:"إدارة الفريق",        points:["صلاحيات مخصصة لكل موظف","كل موظف يرى فقط عملاءه","تتبع الأداء فردياً"] },
              { icon:<DollarSign size={21}/>, c:"#F59E0B", bg:"#FFFBEB", title:"التتبع المالي",       points:["دفع كامل أو بالتقسيط","4 عملات مع سعر مقفل","تقارير مالية فورية"] },
              { icon:<Bell size={21}/>,       c:"#EF4444", bg:"#FEF2F2", title:"تنبيهات ذكية",        points:["قبل انتهاء أي اشتراك","للدفعات المتأخرة","للتجديدات المعلقة"] },
              { icon:<ShieldCheck size={21}/>,c:"#06B6D4", bg:"#ECFEFF", title:"الأمان والصلاحيات",  points:["أمان مستوى enterprise","سجل audit لكل عملية","حماية بيانات العملاء"] },
            ].map((f,i)=>(
              <div key={i} className={`reveal reveal-d${(i%3)+1} card-hover rounded-[22px] p-6`}
                style={{ background:"#FAFBFF", border:"1px solid #EEF2F7", boxShadow:"0 2px 12px rgba(15,23,42,.04)" }}>
                <div style={{ width:48, height:48, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", background:f.bg, color:f.c, marginBottom:18 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontWeight:700, fontSize:15.5, color:"#111827", marginBottom:14 }}>{f.title}</h3>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {f.points.map((p,j)=>(
                    <div key={j} style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <CheckCircle2 size={14} color={f.c} style={{ flexShrink:0 }} />
                      <span style={{ fontSize:13, color:"#6B7280" }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          §9  SCALABILITY — Future vision
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background:"linear-gradient(145deg,#0B1020 0%,#1A2745 100%)" }} className="py-24">
        <div className="max-w-[1060px] mx-auto px-6">
          <div className="text-center mb-14">
            <Badge color="#818CF8" bg="rgba(91,95,239,.12)" border="rgba(91,95,239,.25)">
              <Rocket size={13} /> قابلية التوسع
            </Badge>
            <H2Dark sub="ما تشتريه اليوم يكبر مع مشروعك غداً">
              استثمار يحمي مستقبلك
            </H2Dark>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mb-6">
            {[
              { icon:<Globe size={22}/>,     c:"#818CF8", title:"تطبيق موبايل",       desc:"إدارة كاملة لمشروعك من هاتفك في أي مكان وأي وقت.", tag:"قريباً" },
              { icon:<Zap size={22}/>,       c:"#34D399", title:"أتمتة التواصل",      desc:"رسائل تذكير تلقائية عند اقتراب انتهاء اشتراكات العملاء.", tag:"قريباً" },
              { icon:<Layers size={22}/>,    c:"#FBBF24", title:"إدارة الفروع",       desc:"أكثر من موقع أو فرع من نظام واحد مركزي.", tag:"مستقبلي" },
              { icon:<PieChart size={22}/>,  c:"#F87171", title:"ذكاء اصطناعي",       desc:"توقعات احتمالية التجديد ونقاط الضعف بالأداء قبل أن تحدث.", tag:"مستقبلي" },
            ].map((r,i)=>(
              <div key={i} className={`reveal reveal-d${(i%2)+1} rounded-[22px] p-6 flex gap-5`}
                style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)" }}>
                <div style={{ width:48, height:48, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, background:`${r.c}18`, color:r.c }}>
                  {r.icon}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <h3 style={{ fontWeight:700, fontSize:15, color:"#FFFFFF" }}>{r.title}</h3>
                    <span className="rounded-full px-2.5 py-1" style={{ fontSize:11, fontWeight:700, background:r.tag==="قريباً"?"rgba(91,95,239,.20)":"rgba(139,92,246,.20)", color:r.tag==="قريباً"?"#818CF8":"#A78BFA" }}>
                      {r.tag}
                    </span>
                  </div>
                  <p style={{ fontSize:13.5, color:"#94A3B8", lineHeight:1.65 }}>{r.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="reveal rounded-[22px] p-7 text-center"
            style={{ background:"rgba(91,95,239,.06)", border:"1px solid rgba(91,95,239,.15)" }}>
            <Database size={28} color="#818CF8" style={{ margin:"0 auto 12px" }} />
            <h3 style={{ fontWeight:700, fontSize:16, color:"#FFFFFF", marginBottom:8 }}>مبني على Firebase / Google Cloud</h3>
            <p style={{ fontSize:13.5, color:"#94A3B8" }}>
              بنية تحتية عالمية — نفس المنصة التي تستخدمها شركات Fortune 500.{" "}
              <span style={{ color:"#818CF8" }}>لا حد أقصى للنمو.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          §10 FINAL CTA — Conversion section
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{ background:"linear-gradient(160deg,#060C1A 0%,#0D1628 50%,#121E38 100%)", position:"relative", overflow:"hidden" }}
        className="py-28 text-center">
        <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
          <div className="float-a" style={{ position:"absolute", top:"-120px", right:"-120px", width:560, height:560, borderRadius:"50%", background:"radial-gradient(circle,rgba(91,95,239,.12) 0%,transparent 70%)" }} />
          <div className="float-b" style={{ position:"absolute", bottom:"-80px", left:"-80px", width:420, height:420, borderRadius:"50%", background:"radial-gradient(circle,rgba(79,70,229,.10) 0%,transparent 70%)" }} />
          <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(91,95,239,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(91,95,239,.04) 1px,transparent 1px)", backgroundSize:"64px 64px" }} />
        </div>

        <div className="relative max-w-[760px] mx-auto px-6">
          <div className="reveal w-16 h-16 rounded-[20px] flex items-center justify-center mx-auto mb-8 pulse-ring"
            style={{ background:"rgba(91,95,239,.18)", border:"1px solid rgba(91,95,239,.30)" }}>
            <Zap size={30} color="#818CF8" />
          </div>

          <h2 className="reveal reveal-d1 font-black mb-5"
            style={{ fontSize:"clamp(28px,5vw,50px)", letterSpacing:"-.038em", color:"#FFFFFF", lineHeight:1.15 }}>
            مشروعك يستحق أكثر من
            <br />
            <span className="gradient-text">جوجل شيت وواتساب</span>
          </h2>

          <p className="reveal reveal-d2 mb-10 leading-relaxed" style={{ fontSize:16, color:"#94A3B8" }}>
            النظام جاهز. الإعداد لا يأخذ يوماً كاملاً.
            التدريب مشمول. والنتائج تبدأ من الأسبوع الأول.
          </p>

          <div className="reveal reveal-d3 flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
            <a href="/login" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-9 py-4 rounded-[14px] font-bold card-hover"
              style={{ background:"#5B5FEF", color:"#FFFFFF", fontSize:16, boxShadow:"0 14px 40px rgba(91,95,239,.52)" }}>
              <Rocket size={19} /> ابدأ الآن
            </a>
            <a href="tel:" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-9 py-4 rounded-[14px] font-semibold"
              style={{ background:"rgba(255,255,255,.06)", color:"#E2E8F0", fontSize:16, border:"1px solid rgba(255,255,255,.12)" }}>
              <Phone size={18} /> تواصل للاستفسار
            </a>
          </div>

          <div className="reveal reveal-d4 flex flex-wrap items-center justify-center gap-6">
            {["بيانات آمنة 100%","دعم متواصل","إعداد سريع","قابل للتوسع"].map((t,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:7 }}>
                <CheckCircle2 size={14} color="#22C55E" />
                <span style={{ fontSize:13, color:"#64748B" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center" style={{ background:"#060C1A", borderTop:"1px solid rgba(255,255,255,.05)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:6 }}>
          <div style={{ width:30, height:30, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:13, background:"#5B5FEF", color:"#FFFFFF" }}>J</div>
          <span style={{ fontWeight:700, fontSize:15, color:"#FFFFFF" }}>Joker Dashboard</span>
        </div>
        <p style={{ fontSize:12, color:"#1E293B" }}>نظام إدارة ذكي لأكاديميات التغذية · 2026</p>
      </footer>
    </div>
  );
}
