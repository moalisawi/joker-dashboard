// Maps subscriber `residence` field values → PaymentMethod.country codes
const RESIDENCE_TO_PM_COUNTRY: Record<string, string> = {
  // RESIDENCE_COUNTRIES (Arabic strings)
  "فلسطين-غزة":    "PS_GAZA",
  "فلسطين-الضفة":  "PS_WB",
  "فلسطين-الداخل": "PS_48",
  // ISO codes from PHONE_COUNTRIES (pass-through)
  "EG": "EG",
  "JO": "JO",
  "SA": "SA",
  "AE": "AE",
  "SY": "SY",
  "LB": "LB",
  "PS": "PS_GAZA",
};

export function residenceToPaymentCountry(residence: string): string | null {
  return RESIDENCE_TO_PM_COUNTRY[residence] ?? null;
}

// The 4 currencies the existing payment flow understands
export const EXISTING_CURRENCIES = ["USD", "EGP", "JOD", "ILS"] as const;
export type ExistingCurrency = (typeof EXISTING_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<string, string> = {
  USD:  "دولار USD",
  EGP:  "جنيه EGP",
  JOD:  "دينار JOD",
  ILS:  "شيكل ILS",
  SAR:  "ريال SAR",
  AED:  "درهم AED",
  USDT: "تيثر USDT",
};

// Returns the intersection of method's supported currencies with the existing flow currencies.
// Falls back to all EXISTING_CURRENCIES if the intersection is empty.
export function getAllowedCurrencies(
  supportedCurrencies: string[]
): ExistingCurrency[] {
  const allowed = EXISTING_CURRENCIES.filter((c) =>
    supportedCurrencies.includes(c)
  );
  return allowed.length > 0 ? allowed : [...EXISTING_CURRENCIES];
}
