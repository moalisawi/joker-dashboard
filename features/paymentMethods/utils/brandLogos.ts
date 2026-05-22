/**
 * Auto-detect brand logo + color from a payment method name.
 * Uses Clearbit Logo API for major brands; falls back to brand-color initials.
 */

export interface BrandInfo {
  logoUrl: string;
  color: string;
  bgColor: string;
}

const BRANDS: Array<{ keywords: string[]; info: BrandInfo }> = [
  // ── Egypt ──────────────────────────────────────────────────────────────
  {
    keywords: ["vodafone", "فودافون", "vodafone cash", "فودافون كاش"],
    info: { logoUrl: "https://logo.clearbit.com/vodafone.com", color: "#e60000", bgColor: "rgba(230,0,0,.10)" },
  },
  {
    keywords: ["instapay", "انستاباي", "insta pay"],
    info: { logoUrl: "https://logo.clearbit.com/instapay.com.eg", color: "#1C3FAA", bgColor: "rgba(28,63,170,.10)" },
  },
  {
    keywords: ["fawry", "فوري", "فورى"],
    info: { logoUrl: "https://logo.clearbit.com/fawry.com", color: "#F26522", bgColor: "rgba(242,101,34,.10)" },
  },
  {
    keywords: ["orange money", "اورانج موني", "orange cash"],
    info: { logoUrl: "https://logo.clearbit.com/orange.com", color: "#FF6600", bgColor: "rgba(255,102,0,.10)" },
  },
  {
    keywords: ["we cash", "وي كاش", "we pay", "وي باي"],
    info: { logoUrl: "https://logo.clearbit.com/te.eg", color: "#7B2D8B", bgColor: "rgba(123,45,139,.10)" },
  },
  {
    keywords: ["etisalat", "اتصالات cash", "اتصالات كاش"],
    info: { logoUrl: "https://logo.clearbit.com/etisalat.eg", color: "#008000", bgColor: "rgba(0,128,0,.10)" },
  },
  {
    keywords: ["cib", "سي اي بي", "تجارة دولي"],
    info: { logoUrl: "https://logo.clearbit.com/cibeg.com", color: "#003057", bgColor: "rgba(0,48,87,.10)" },
  },
  {
    keywords: ["nbe", "الأهلي المصري", "national bank of egypt", "البنك الأهلي المصري"],
    info: { logoUrl: "https://logo.clearbit.com/nbe.com.eg", color: "#006400", bgColor: "rgba(0,100,0,.10)" },
  },
  {
    keywords: ["بنك مصر", "bank misr", "banque misr"],
    info: { logoUrl: "https://logo.clearbit.com/banquemisr.com", color: "#C8102E", bgColor: "rgba(200,16,46,.10)" },
  },
  {
    keywords: ["meeza", "ميزة", "meezza"],
    info: { logoUrl: "https://logo.clearbit.com/meeza.net", color: "#B5121B", bgColor: "rgba(181,18,27,.10)" },
  },
  {
    keywords: ["aman", "أمان"],
    info: { logoUrl: "https://logo.clearbit.com/aman.com", color: "#004F9F", bgColor: "rgba(0,79,159,.10)" },
  },
  {
    keywords: ["مصرف أبو ظبي الإسلامي", "adib", "أبو ظبي الإسلامي"],
    info: { logoUrl: "https://logo.clearbit.com/adib.ae", color: "#B8892A", bgColor: "rgba(184,137,42,.10)" },
  },

  // ── Palestine ──────────────────────────────────────────────────────────
  {
    keywords: ["bank of palestine", "بنك فلسطين"],
    info: { logoUrl: "https://logo.clearbit.com/bankofpalestine.com", color: "#003B8E", bgColor: "rgba(0,59,142,.10)" },
  },
  {
    keywords: ["jawwal", "جوال", "jawwal pay"],
    info: { logoUrl: "https://logo.clearbit.com/jawwal.ps", color: "#E31837", bgColor: "rgba(227,24,55,.10)" },
  },
  {
    keywords: ["ooredoo", "أوريدو"],
    info: { logoUrl: "https://logo.clearbit.com/ooredoo.ps", color: "#E40520", bgColor: "rgba(228,5,32,.10)" },
  },
  {
    keywords: ["cairo amman", "القاهرة عمان"],
    info: { logoUrl: "https://logo.clearbit.com/cairo-amman.com", color: "#8B0000", bgColor: "rgba(139,0,0,.10)" },
  },
  {
    keywords: ["arab islamic bank", "البنك الإسلامي العربي"],
    info: { logoUrl: "https://logo.clearbit.com/aib.ps", color: "#1E5A3E", bgColor: "rgba(30,90,62,.10)" },
  },
  {
    keywords: ["palpay", "بال باي", "pal pay"],
    info: { logoUrl: "https://logo.clearbit.com/palpay.ps", color: "#0057A8", bgColor: "rgba(0,87,168,.10)" },
  },

  // ── Jordan ─────────────────────────────────────────────────────────────
  {
    keywords: ["arab bank", "البنك العربي"],
    info: { logoUrl: "https://logo.clearbit.com/arabbank.com", color: "#003087", bgColor: "rgba(0,48,135,.10)" },
  },
  {
    keywords: ["zain cash", "زين كاش", "zain pay"],
    info: { logoUrl: "https://logo.clearbit.com/jo.zain.com", color: "#C8002B", bgColor: "rgba(200,0,43,.10)" },
  },
  {
    keywords: ["cliq", "كليك", "cliq pay"],
    info: { logoUrl: "https://logo.clearbit.com/arabbank.com", color: "#009CA6", bgColor: "rgba(0,156,166,.10)" },
  },
  {
    keywords: ["dinarak", "دينارك"],
    info: { logoUrl: "https://logo.clearbit.com/dinarak.com", color: "#005BAA", bgColor: "rgba(0,91,170,.10)" },
  },
  {
    keywords: ["jordan ahli", "الأهلي الأردني"],
    info: { logoUrl: "https://logo.clearbit.com/ahli.com.jo", color: "#003A70", bgColor: "rgba(0,58,112,.10)" },
  },

  // ── Saudi Arabia ───────────────────────────────────────────────────────
  {
    keywords: ["stc pay", "stcpay", "STC"],
    info: { logoUrl: "https://logo.clearbit.com/stcpay.com.sa", color: "#7B2D8B", bgColor: "rgba(123,45,139,.10)" },
  },
  {
    keywords: ["mada", "مدى"],
    info: { logoUrl: "https://logo.clearbit.com/mada.com.sa", color: "#005E30", bgColor: "rgba(0,94,48,.10)" },
  },
  {
    keywords: ["al rajhi", "الراجحي", "مصرف الراجحي"],
    info: { logoUrl: "https://logo.clearbit.com/alrajhibank.com.sa", color: "#006C35", bgColor: "rgba(0,108,53,.10)" },
  },
  {
    keywords: ["snb", "الأهلي السعودي", "saudi national bank"],
    info: { logoUrl: "https://logo.clearbit.com/snb.com", color: "#00543C", bgColor: "rgba(0,84,60,.10)" },
  },
  {
    keywords: ["alinma", "إنماء", "alinma pay"],
    info: { logoUrl: "https://logo.clearbit.com/alinma.com", color: "#006341", bgColor: "rgba(0,99,65,.10)" },
  },

  // ── UAE ────────────────────────────────────────────────────────────────
  {
    keywords: ["fab", "first abu dhabi", "بنك أبوظبي الأول"],
    info: { logoUrl: "https://logo.clearbit.com/bankfab.com", color: "#B79D56", bgColor: "rgba(183,157,86,.10)" },
  },
  {
    keywords: ["emirates nbd", "الإمارات nbd", "enbd"],
    info: { logoUrl: "https://logo.clearbit.com/emiratesnbd.com", color: "#FDB813", bgColor: "rgba(253,184,19,.10)" },
  },

  // ── International / Global ─────────────────────────────────────────────
  {
    keywords: ["paypal"],
    info: { logoUrl: "https://logo.clearbit.com/paypal.com", color: "#003087", bgColor: "rgba(0,48,135,.10)" },
  },
  {
    keywords: ["wise", "ويز", "transferwise"],
    info: { logoUrl: "https://logo.clearbit.com/wise.com", color: "#9FE870", bgColor: "rgba(159,232,112,.12)" },
  },
  {
    keywords: ["payoneer", "بايونير"],
    info: { logoUrl: "https://logo.clearbit.com/payoneer.com", color: "#FF4800", bgColor: "rgba(255,72,0,.10)" },
  },
  {
    keywords: ["western union", "ويسترن يونيون"],
    info: { logoUrl: "https://logo.clearbit.com/westernunion.com", color: "#FFCC00", bgColor: "rgba(255,204,0,.12)" },
  },
  {
    keywords: ["moneygram", "موني جرام"],
    info: { logoUrl: "https://logo.clearbit.com/moneygram.com", color: "#E31837", bgColor: "rgba(227,24,55,.10)" },
  },
  {
    keywords: ["binance", "بينانس"],
    info: { logoUrl: "https://logo.clearbit.com/binance.com", color: "#F3BA2F", bgColor: "rgba(243,186,47,.12)" },
  },
  {
    keywords: ["usdt", "tether", "تيثر"],
    info: { logoUrl: "https://logo.clearbit.com/tether.to", color: "#26A17B", bgColor: "rgba(38,161,123,.10)" },
  },
  {
    keywords: ["bitcoin", "btc", "بيتكوين"],
    info: { logoUrl: "https://logo.clearbit.com/bitcoin.org", color: "#F7931A", bgColor: "rgba(247,147,26,.10)" },
  },
  {
    keywords: ["stripe"],
    info: { logoUrl: "https://logo.clearbit.com/stripe.com", color: "#635BFF", bgColor: "rgba(99,91,255,.10)" },
  },
  {
    keywords: ["mastercard", "ماستركارد"],
    info: { logoUrl: "https://logo.clearbit.com/mastercard.com", color: "#EB001B", bgColor: "rgba(235,0,27,.10)" },
  },
  {
    keywords: ["visa"],
    info: { logoUrl: "https://logo.clearbit.com/visa.com", color: "#1A1F71", bgColor: "rgba(26,31,113,.10)" },
  },
];

/**
 * Returns brand info if the name matches a known provider, otherwise null.
 */
export function detectBrand(name: string): BrandInfo | null {
  const lower = name.toLowerCase().trim();
  for (const brand of BRANDS) {
    if (brand.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return brand.info;
    }
  }
  return null;
}
