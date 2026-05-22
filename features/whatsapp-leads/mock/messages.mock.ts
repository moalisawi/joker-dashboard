import { Timestamp } from "firebase/firestore";
import type { WhatsappMessage } from "@/types/whatsapp-lead";

function ts(daysAgo: number, hour: number, minute = 0): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return Timestamp.fromDate(d);
}

let _seq = 1;
function msgId() {
  return `msg_${String(_seq++).padStart(4, "0")}`;
}

// Mutable so sendMessage can push to it
export const MOCK_MESSAGES: WhatsappMessage[] = [
  // ── lead_001: أحمد عبدالله ────────────────────────────────────────────
  { id: msgId(), leadId: "lead_001", direction: "inbound",  body: "السلام عليكم، رأيت إعلانكم وأنا مهتم بالاشتراك في أكاديمية التغذية.",          timestamp: ts(0, 8, 15), status: "read" },
  { id: msgId(), leadId: "lead_001", direction: "outbound", body: "وعليكم السلام! أهلاً بك في أكاديمية جوكر للتغذية 💪 كيف يمكنني مساعدتك؟",       timestamp: ts(0, 8, 20), status: "read" },
  { id: msgId(), leadId: "lead_001", direction: "inbound",  body: "أريد معرفة تفاصيل الباقة الذهبية — ما الذي تشمله تحديداً؟",                    timestamp: ts(0, 8, 45), status: "read" },
  { id: msgId(), leadId: "lead_001", direction: "outbound", body: "الباقة الذهبية تشمل: برنامج غذائي مخصص، متابعة أسبوعية مع مختص، وتقارير تقدم شهرية. السعر 299 ريال/شهر.", timestamp: ts(0, 9, 0), status: "read" },
  { id: msgId(), leadId: "lead_001", direction: "inbound",  body: "مهتم جداً بالباقة الذهبية، متى يمكن البدء؟",                                  timestamp: ts(0, 9, 40), status: "read" },
  { id: msgId(), leadId: "lead_001", direction: "outbound", body: "يمكنك البدء فوراً بعد إتمام الاشتراك. سأرسل لك رابط الدفع الآن 🙌",          timestamp: ts(0, 9, 45), status: "delivered" },
  { id: msgId(), leadId: "lead_001", direction: "outbound", body: "ملاحظة: العميل أحمد مهتم جداً — نسّق معه قبل الساعة 12 ظهراً", isInternalNote: true, timestamp: ts(0, 9, 50), status: "read" },

  // ── lead_002: محمد حسن ────────────────────────────────────────────────
  { id: msgId(), leadId: "lead_002", direction: "inbound",  body: "مساء الخير، سمعت عن أكاديمية التغذية من صديق. هل تقبلون اشتراكات جديدة؟",     timestamp: ts(0, 7, 0),  status: "read" },
  { id: msgId(), leadId: "lead_002", direction: "outbound", body: "مساء النور! بالطبع نرحب بك 😊 أخبرني هدفك الصحي لأقترح الباقة الأنسب لك.",    timestamp: ts(0, 7, 10), status: "read" },
  { id: msgId(), leadId: "lead_002", direction: "inbound",  body: "أريد إنقاص الوزن 15 كيلو خلال 3 أشهر.",                                        timestamp: ts(0, 7, 25), status: "read" },
  { id: msgId(), leadId: "lead_002", direction: "outbound", body: "هدف رائع وقابل للتحقيق! نوصيك بالباقة الفضية مع متابعة تفصيلية. السعر 199 ريال/شهر.", timestamp: ts(0, 8, 0), status: "read" },
  { id: msgId(), leadId: "lead_002", direction: "inbound",  body: "ممتاز، جاهز للدفع. كيف أتمم الاشتراك؟",                                        timestamp: ts(0, 10, 30), status: "read" },
  { id: msgId(), leadId: "lead_002", direction: "outbound", body: "أرسل لك رابط الدفع الآن. بعد التأكيد يبدأ برنامجك خلال 24 ساعة.",              timestamp: ts(0, 10, 35), status: "read" },
  { id: msgId(), leadId: "lead_002", direction: "outbound", body: "تأكيد: العميل جاهز للدفع — تابع معه عملية الاشتراك فوراً", isInternalNote: true, timestamp: ts(0, 10, 40), status: "read" },

  // ── lead_003: سارة الخطيب ────────────────────────────────────────────
  { id: msgId(), leadId: "lead_003", direction: "inbound",  body: "أهلاً، لدي سؤال: هل البرنامج مناسب للمرأة الحامل؟",                            timestamp: ts(0, 6, 30), status: "read" },
  { id: msgId(), leadId: "lead_003", direction: "outbound", body: "أهلاً بك! يجب استشارة الطبيب أولاً، لكن لدينا خبراء متخصصين في تغذية الحوامل.", timestamp: ts(0, 7, 0),  status: "read" },
  { id: msgId(), leadId: "lead_003", direction: "inbound",  body: "شكراً، سأتشاور مع الطبيبة أولاً.",                                               timestamp: ts(0, 8, 0),  status: "read" },
  { id: msgId(), leadId: "lead_003", direction: "outbound", body: "بالتوفيق! نحن هنا عند جاهزيتك 💚",                                              timestamp: ts(0, 8, 5),  status: "read" },
  { id: msgId(), leadId: "lead_003", direction: "inbound",  body: "أحتاج وقتاً للتفكير، تواصل معي غداً من فضلك.",                                   timestamp: ts(0, 11, 0), status: "read" },
  { id: msgId(), leadId: "lead_003", direction: "outbound", body: "بالتأكيد سنتواصل معك غداً إن شاء الله 🙏",                                      timestamp: ts(0, 11, 5), status: "read" },

  // ── lead_004: مجهول (PS-WB) ───────────────────────────────────────────
  { id: msgId(), leadId: "lead_004", direction: "inbound",  body: "السلام عليكم، ما هي تفاصيل الاشتراك؟",                                           timestamp: ts(0, 9, 0),  status: "read" },
  { id: msgId(), leadId: "lead_004", direction: "outbound", body: "وعليكم السلام! لدينا ثلاث باقات. أرسل لك الكتالوج التفصيلي الآن.",              timestamp: ts(0, 9, 5),  status: "delivered" },

  // ── lead_005: فاطمة النعيمي ──────────────────────────────────────────
  { id: msgId(), leadId: "lead_005", direction: "inbound",  body: "مرحباً، هل يوجد عرض عائلي لأكثر من شخص؟",                                       timestamp: ts(0, 8, 45), status: "read" },
  { id: msgId(), leadId: "lead_005", direction: "outbound", body: "أهلاً فاطمة! نعم لدينا خصم 20% عند اشتراك فردين من نفس العائلة 🌟",              timestamp: ts(0, 9, 0),  status: "read" },
  { id: msgId(), leadId: "lead_005", direction: "inbound",  body: "رائع! أنا وزوجي نريد الاشتراك معاً. ما التفاصيل؟",                               timestamp: ts(0, 10, 0), status: "read" },
  { id: msgId(), leadId: "lead_005", direction: "outbound", body: "ممتاز! الباقة الزوجية = 450 ريال/شهر بدلاً من 598. سأرسل العقد.", timestamp: ts(0, 10, 15), status: "read" },
  { id: msgId(), leadId: "lead_005", direction: "inbound",  body: "هل هناك عرض لأكثر من شخص في نفس العائلة؟",                                       timestamp: ts(0, 12, 15), status: "read" },
  { id: msgId(), leadId: "lead_005", direction: "outbound", body: "للثلاثة أفراد فأكثر خصم 30%. تواصلي معنا لتفاصيل خاصة.",                        timestamp: ts(0, 12, 20), status: "sent" },
  // attachment example
  { id: msgId(), leadId: "lead_005", direction: "outbound", body: "صورة جدول الأسعار العائلية",                                                      timestamp: ts(0, 12, 25), status: "sent", attachmentType: "image", attachmentUrl: "https://picsum.photos/seed/family-plan/400/250" },

  // ── lead_006: عبدالرحمن العنزي ───────────────────────────────────────
  { id: msgId(), leadId: "lead_006", direction: "inbound",  body: "السلام، أريد الاشتراك في الباقة الذهبية.",                                         timestamp: ts(0, 7, 30), status: "read" },
  { id: msgId(), leadId: "lead_006", direction: "outbound", body: "أهلاً عبدالرحمن! سعيد بإقدامك. إليك رقم حسابنا في بنك الكويت الوطني.",           timestamp: ts(0, 8, 0),  status: "read" },
  { id: msgId(), leadId: "lead_006", direction: "inbound",  body: "هل تقبل KNET؟",                                                                    timestamp: ts(0, 9, 0),  status: "read" },
  { id: msgId(), leadId: "lead_006", direction: "outbound", body: "نعم نقبل KNET وبطاقات الفيزا والماستركارد.",                                       timestamp: ts(0, 9, 10), status: "read" },
  { id: msgId(), leadId: "lead_006", direction: "inbound",  body: "أرسل لي رقم الحساب لإتمام الدفع.",                                                 timestamp: ts(0, 13, 0), status: "read" },
  { id: msgId(), leadId: "lead_006", direction: "outbound", body: "تم الإرسال على رقمك. بمجرد استلام الإيصال نفعّل حسابك فوراً ✅",                  timestamp: ts(0, 13, 5), status: "delivered" },

  // ── lead_007: نورة الشمري (yesterday) ───────────────────────────────
  { id: msgId(), leadId: "lead_007", direction: "inbound",  body: "مرحباً، ما الفرق بين الباقة الفضية والذهبية؟",                                    timestamp: ts(1, 10, 0),  status: "read" },
  { id: msgId(), leadId: "lead_007", direction: "outbound", body: "الفضية: برنامج غذائي + متابعة شهرية. الذهبية: تشمل إضافةً إلى ذلك جلسات تحفيزية + قياسات أسبوعية.", timestamp: ts(1, 10, 15), status: "read" },
  { id: msgId(), leadId: "lead_007", direction: "inbound",  body: "وما الفرق في السعر؟",                                                              timestamp: ts(1, 11, 0),  status: "read" },
  { id: msgId(), leadId: "lead_007", direction: "outbound", body: "الفضية 199 ريال، الذهبية 299 ريال شهرياً. نوصيك بالذهبية للنتائج الأسرع.",       timestamp: ts(1, 11, 10), status: "read" },
  { id: msgId(), leadId: "lead_007", direction: "inbound",  body: "حسناً سأفكر وأرد عليكم.",                                                          timestamp: ts(1, 13, 0),  status: "read" },
  { id: msgId(), leadId: "lead_007", direction: "outbound", body: "بالتأكيد نحن هنا لأي استفسار 💪",                                                  timestamp: ts(1, 13, 5),  status: "read" },
  { id: msgId(), leadId: "lead_007", direction: "inbound",  body: "ما الفرق بين الباقتين الفضية والذهبية؟",                                           timestamp: ts(1, 15, 30), status: "read" },

  // ── lead_008: يوسف إبراهيم (yesterday) ─────────────────────────────
  { id: msgId(), leadId: "lead_008", direction: "inbound",  body: "أهلاً، سمعت عنكم من صديق. ما هي الأسعار؟",                                        timestamp: ts(1, 9, 0),  status: "read" },
  { id: msgId(), leadId: "lead_008", direction: "outbound", body: "مرحباً يوسف! أسعارنا تبدأ من 199 ريال/شهر. أيّ مدينة أنت؟",                       timestamp: ts(1, 9, 15), status: "read" },
  { id: msgId(), leadId: "lead_008", direction: "inbound",  body: "أنا من القاهرة.",                                                                   timestamp: ts(1, 10, 0), status: "read" },
  { id: msgId(), leadId: "lead_008", direction: "outbound", body: "ممتاز! البرنامج متاح عبر الإنترنت لجميع الدول. هل لديك أهداف معينة؟",              timestamp: ts(1, 10, 10), status: "read" },
  { id: msgId(), leadId: "lead_008", direction: "inbound",  body: "سأتواصل معكم بعد نهاية الأسبوع.",                                                  timestamp: ts(1, 18, 0), status: "read" },
  { id: msgId(), leadId: "lead_008", direction: "outbound", body: "تفضل في أي وقت 🙏",                                                                 timestamp: ts(1, 18, 5), status: "read" },

  // ── lead_009: رنا أبو عمر (yesterday) ──────────────────────────────
  { id: msgId(), leadId: "lead_009", direction: "inbound",  body: "مرحبا، كيف يمكنني الاشتراك؟",                                                      timestamp: ts(1, 14, 0), status: "read" },
  { id: msgId(), leadId: "lead_009", direction: "outbound", body: "أهلاً رنا! الاشتراك يتم عبر الموقع أو مباشرةً معنا. أيهما تفضلين؟",               timestamp: ts(1, 14, 2), status: "delivered" },

  // ── lead_010: خالد المطيري (2 days ago) ─────────────────────────────
  { id: msgId(), leadId: "lead_010", direction: "inbound",  body: "مساء الخير، أنا مهتم بالاشتراك.",                                                   timestamp: ts(2, 11, 0),  status: "read" },
  { id: msgId(), leadId: "lead_010", direction: "outbound", body: "مساء النور! تفضل أخبرني ماذا تريد تحقيقه.",                                         timestamp: ts(2, 11, 15), status: "read" },
  { id: msgId(), leadId: "lead_010", direction: "inbound",  body: "أريد بناء العضلات مع تحسين التغذية.",                                               timestamp: ts(2, 12, 0),  status: "read" },
  { id: msgId(), leadId: "lead_010", direction: "outbound", body: "مثالي! لدينا برنامج متخصص في الكتلة العضلية. سأرسل تفاصيله.",                      timestamp: ts(2, 12, 10), status: "read" },
  { id: msgId(), leadId: "lead_010", direction: "inbound",  body: "ممتاز، سأدفع عن طريق الفودافون كاش.",                                               timestamp: ts(2, 16, 45), status: "read" },
  { id: msgId(), leadId: "lead_010", direction: "outbound", body: "رائع! أرسل لك رقم فودافون كاش الخاص بنا الآن.",                                    timestamp: ts(2, 16, 50), status: "read" },
  // attachment
  { id: msgId(), leadId: "lead_010", direction: "outbound", body: "معلومات الدفع", timestamp: ts(2, 16, 55), status: "read", attachmentType: "image", attachmentUrl: "https://picsum.photos/seed/payment-qr/300/300" },

  // ── lead_011: لمى الحسن (2 days ago) ────────────────────────────────
  { id: msgId(), leadId: "lead_011", direction: "inbound",  body: "أهلاً، هل تقبلون الدفع بالتقسيط؟",                                                 timestamp: ts(2, 8, 0),  status: "read" },
  { id: msgId(), leadId: "lead_011", direction: "outbound", body: "أهلاً لمى! نعم لدينا خيار تقسيط 3 أشهر بدون فوائد للباقة الذهبية.",                timestamp: ts(2, 8, 15), status: "read" },
  { id: msgId(), leadId: "lead_011", direction: "inbound",  body: "وكيف يكون التقسيط؟",                                                               timestamp: ts(2, 9, 0),  status: "read" },
  { id: msgId(), leadId: "lead_011", direction: "outbound", body: "الباقة الذهبية 299 ريال/شهر — أو دفعة واحدة 799 ريال للثلاثة أشهر توفيراً.",       timestamp: ts(2, 9, 15), status: "read" },
  { id: msgId(), leadId: "lead_011", direction: "inbound",  body: "هل تقبلون الدفع بالتقسيط؟",                                                         timestamp: ts(2, 13, 20), status: "read" },

  // ── lead_012: سلطان الكعبي (2 days ago, retargeting) ───────────────
  { id: msgId(), leadId: "lead_012", direction: "inbound",  body: "وصلني رسالتكم — هل ما زال العرض سارياً؟",                                          timestamp: ts(2, 17, 0), status: "read" },
  { id: msgId(), leadId: "lead_012", direction: "outbound", body: "أهلاً سلطان! نعم العرض الخاص لا يزال متاحاً حتى نهاية الشهر.",                     timestamp: ts(2, 17, 5), status: "read" },
  { id: msgId(), leadId: "lead_012", direction: "inbound",  body: "نحاول التواصل مجدداً — هل تغيّر رأيك؟",                                             timestamp: ts(2, 17, 0), status: "read" },

  // ── lead_013: منى الرشيد (3 days ago) ──────────────────────────────
  { id: msgId(), leadId: "lead_013", direction: "inbound",  body: "أريد معرفة المزيد عن البرنامج.",                                                    timestamp: ts(3, 12, 0), status: "read" },
  { id: msgId(), leadId: "lead_013", direction: "outbound", body: "أهلاً! برنامجنا يعمل على 3 محاور: تغذية، نشاط بدني، وصحة نفسية 🌱",               timestamp: ts(3, 12, 1), status: "delivered" },

  // ── lead_014: كريم عادل (3 days ago) ────────────────────────────────
  { id: msgId(), leadId: "lead_014", direction: "inbound",  body: "مرحباً، هل يمكنني رؤية نتائج المشتركين السابقين؟",                                  timestamp: ts(3, 10, 0),  status: "read" },
  { id: msgId(), leadId: "lead_014", direction: "outbound", body: "بالتأكيد! إليك بعض قصص النجاح من مشتركينا.",                                        timestamp: ts(3, 10, 10), status: "read" },
  { id: msgId(), leadId: "lead_014", direction: "inbound",  body: "ممتاز، هل يمكنني الدفع عبر إنستاباي؟",                                              timestamp: ts(3, 15, 30), status: "read" },
  { id: msgId(), leadId: "lead_014", direction: "outbound", body: "نعم نقبل إنستاباي على الرقم الآتي: 01012345678",                                    timestamp: ts(3, 15, 40), status: "read" },
  { id: msgId(), leadId: "lead_014", direction: "outbound", body: "تأكيد دفع إنستاباي — بانتظار الإيصال من كريم", isInternalNote: true,               timestamp: ts(3, 15, 45), status: "read" },

  // ── lead_015: نادين سلامة (3 days ago) ─────────────────────────────
  { id: msgId(), leadId: "lead_015", direction: "inbound",  body: "أهلاً، ما هو البرنامج الغذائي المقدَّم مع الاشتراك؟",                               timestamp: ts(3, 7, 0),  status: "read" },
  { id: msgId(), leadId: "lead_015", direction: "outbound", body: "أهلاً نادين! البرنامج يشمل خطة وجبات يومية مخصصة لأهدافك وظروفك الصحية.",           timestamp: ts(3, 7, 10), status: "read" },
  { id: msgId(), leadId: "lead_015", direction: "inbound",  body: "هل البرنامج مناسب لحالة السكري من النوع الثاني؟",                                    timestamp: ts(3, 8, 0),  status: "read" },
  { id: msgId(), leadId: "lead_015", direction: "outbound", body: "نعم لدينا برنامج متخصص للمرضى بالسكري. يعمل معهم اختصاصيو تغذية طبية.",             timestamp: ts(3, 8, 15), status: "read" },
  { id: msgId(), leadId: "lead_015", direction: "inbound",  body: "ما هو البرنامج الغذائي المقدَّم معه؟",                                               timestamp: ts(3, 11, 0), status: "read" },

  // ── lead_016: بندر القحطاني (4 days ago) ────────────────────────────
  { id: msgId(), leadId: "lead_016", direction: "inbound",  body: "أرغب في الاشتراك لكن لديّ استفسار أولاً.",                                           timestamp: ts(4, 9, 0),  status: "read" },
  { id: msgId(), leadId: "lead_016", direction: "outbound", body: "تفضل بندر، أنا هنا للإجابة.",                                                        timestamp: ts(4, 9, 5),  status: "read" },
  { id: msgId(), leadId: "lead_016", direction: "inbound",  body: "هل يمكن تجميد الاشتراك لمدة شهر في حال السفر؟",                                      timestamp: ts(4, 10, 0), status: "read" },
  { id: msgId(), leadId: "lead_016", direction: "outbound", body: "نعم نوفر التجميد مرة واحدة خلال فترة الاشتراك لمدة تصل إلى 30 يوماً.",              timestamp: ts(4, 10, 15), status: "read" },
  { id: msgId(), leadId: "lead_016", direction: "inbound",  body: "سأرسل لك الإيصال غداً إن شاء الله.",                                                 timestamp: ts(4, 19, 0), status: "read" },
  { id: msgId(), leadId: "lead_016", direction: "outbound", body: "في انتظاره، شكراً جزيلاً 🙏",                                                        timestamp: ts(4, 19, 5), status: "read" },

  // ── lead_017: مجهول (AE, 4 days ago) ────────────────────────────────
  { id: msgId(), leadId: "lead_017", direction: "inbound",  body: "هل البرنامج مناسب لمن يعاني من السكري؟",                                             timestamp: ts(4, 13, 0), status: "read" },
  { id: msgId(), leadId: "lead_017", direction: "outbound", body: "نعم! لدينا خبراء متخصصين في تغذية مرضى السكري. أخبرنا بالنوع ونوع العلاج.",         timestamp: ts(4, 13, 3), status: "delivered" },

  // ── lead_018: علاء الدين النابلسي (5 days ago) ───────────────────────
  { id: msgId(), leadId: "lead_018", direction: "inbound",  body: "أنا طالب جامعي، هل هناك خصم للطلاب؟",                                               timestamp: ts(5, 8, 0),  status: "read" },
  { id: msgId(), leadId: "lead_018", direction: "outbound", body: "أهلاً! نعم لدينا خصم 15% للطلاب عند تقديم هوية جامعية.",                             timestamp: ts(5, 8, 15), status: "read" },
  { id: msgId(), leadId: "lead_018", direction: "inbound",  body: "رائع، كيف أُثبت أنني طالب؟",                                                         timestamp: ts(5, 9, 0),  status: "read" },
  { id: msgId(), leadId: "lead_018", direction: "outbound", body: "أرسل لنا صورة من هوية الجامعة وسيُطبَّق الخصم فوراً.",                               timestamp: ts(5, 9, 10), status: "read" },
  { id: msgId(), leadId: "lead_018", direction: "inbound",  body: "هل هناك خصم للطلاب؟",                                                                 timestamp: ts(5, 12, 30), status: "read" },

  // ── lead_019: شيماء العتيبي (6 days ago) ────────────────────────────
  { id: msgId(), leadId: "lead_019", direction: "inbound",  body: "السلام عليكم، أرغب في الاشتراك في الباقة الذهبية.",                                  timestamp: ts(6, 10, 0),  status: "read" },
  { id: msgId(), leadId: "lead_019", direction: "outbound", body: "وعليكم السلام شيماء! يسعدنا انضمامك. إليك تفاصيل الباقة الذهبية.",                   timestamp: ts(6, 10, 10), status: "read" },
  { id: msgId(), leadId: "lead_019", direction: "inbound",  body: "ما طريقة الدفع المتاحة في الكويت؟",                                                   timestamp: ts(6, 11, 0),  status: "read" },
  { id: msgId(), leadId: "lead_019", direction: "outbound", body: "نقبل: KNET، بطاقات فيزا/ماستر، وتحويل بنكي.",                                         timestamp: ts(6, 11, 10), status: "read" },
  { id: msgId(), leadId: "lead_019", direction: "inbound",  body: "موافق على كل شيء، أرسل لي تفاصيل الدفع.",                                             timestamp: ts(6, 16, 0),  status: "read" },
  { id: msgId(), leadId: "lead_019", direction: "outbound", body: "تم إرسال تفاصيل الدفع على رقمك. نتطلع لانضمامك! 🌟",                                 timestamp: ts(6, 16, 5),  status: "read" },

  // ── lead_020: جاد مرعي (6 days ago, retargeting) ────────────────────
  { id: msgId(), leadId: "lead_020", direction: "inbound",  body: "وصلتني رسالتكم، كنت مشغولاً.",                                                       timestamp: ts(6, 14, 0), status: "read" },
  { id: msgId(), leadId: "lead_020", direction: "outbound", body: "لا بأس جاد! نحن هنا. هل لا يزال الاشتراك في خططك؟",                                  timestamp: ts(6, 14, 5), status: "read" },
  { id: msgId(), leadId: "lead_020", direction: "inbound",  body: "مرحباً مجدداً، هل تفكر في الاشتراك؟",                                                 timestamp: ts(6, 14, 0), status: "read" },

  // ── lead_021: تركي الدوسري (today, retargeting) ──────────────────────
  { id: msgId(), leadId: "lead_021", direction: "outbound", body: "مرحباً تركي، تواصلنا قبل أسبوعين. هل أنت مستعد للانضمام الآن؟",                    timestamp: ts(0, 8, 0), status: "read" },
  { id: msgId(), leadId: "lead_021", direction: "inbound",  body: "مرحباً، كنت منشغلاً بالسفر.",                                                        timestamp: ts(0, 8, 5), status: "read" },
  { id: msgId(), leadId: "lead_021", direction: "outbound", body: "مرحبا، تواصلنا قبل أسبوعين — هل قررت؟",                                              timestamp: ts(0, 8, 0), status: "read" },

  // ── lead_022: هدى السيد (today, retargeting) ─────────────────────────
  { id: msgId(), leadId: "lead_022", direction: "outbound", body: "أهلاً هدى، نذكّرك بعرضنا الخاص على باقة التجديد. ما رأيك؟",                         timestamp: ts(0, 10, 45), status: "read" },
  { id: msgId(), leadId: "lead_022", direction: "inbound",  body: "ذكّرناك بعرض التجديد، هل أنت مهتم الآن؟",                                            timestamp: ts(0, 10, 45), status: "read" },

  // ── lead_023: ريم العمري (8 days) ────────────────────────────────────
  { id: msgId(), leadId: "lead_023", direction: "inbound",  body: "مهتمة بالبرنامج، هل يشمل النظام الغذائي الكامل؟",                                   timestamp: ts(8, 9, 0),  status: "read" },
  { id: msgId(), leadId: "lead_023", direction: "outbound", body: "نعم ريم! يشمل خطة وجبات يومية كاملة مع بدائل للحساسيات الغذائية.",                   timestamp: ts(8, 9, 15), status: "read" },
  { id: msgId(), leadId: "lead_023", direction: "inbound",  body: "مهتمة بالبرنامج، هل يشمل النظام الغذائي؟",                                           timestamp: ts(8, 11, 0), status: "read" },

  // ── lead_024: عمرو سعيد (9 days) ─────────────────────────────────────
  { id: msgId(), leadId: "lead_024", direction: "inbound",  body: "جاهز، أرسل التفاصيل.",                                                                timestamp: ts(9, 10, 0), status: "read" },
  { id: msgId(), leadId: "lead_024", direction: "outbound", body: "رائع عمرو! إليك رابط الدفع ومعلومات الاشتراك الكاملة.",                               timestamp: ts(9, 10, 5), status: "read" },
  { id: msgId(), leadId: "lead_024", direction: "inbound",  body: "وصلني، شكراً.",                                                                       timestamp: ts(9, 15, 0), status: "read" },

  // ── lead_025: فيصل البدر (11 days) ──────────────────────────────────
  { id: msgId(), leadId: "lead_025", direction: "inbound",  body: "أريد معرفة البرنامج قبل الاشتراك.",                                                   timestamp: ts(11, 8, 0),  status: "read" },
  { id: msgId(), leadId: "lead_025", direction: "outbound", body: "أهلاً فيصل! برنامجنا مدته 12 أسبوعاً مع متابعة فردية.",                               timestamp: ts(11, 8, 15), status: "read" },
  { id: msgId(), leadId: "lead_025", direction: "inbound",  body: "سأرد عليك قريباً إن شاء الله.",                                                       timestamp: ts(11, 14, 30), status: "read" },

  // ── lead_026: دلال المنصور (13 days) ────────────────────────────────
  { id: msgId(), leadId: "lead_026", direction: "inbound",  body: "كيف أشترك؟",                                                                          timestamp: ts(13, 11, 0), status: "read" },
  { id: msgId(), leadId: "lead_026", direction: "outbound", body: "أهلاً دلال! يمكنك الاشتراك عبر الواتساب معنا مباشرةً أو عبر موقعنا.",                timestamp: ts(13, 11, 2), status: "delivered" },

  // ── lead_027: جمال حمدان (15 days) ─────────────────────────────────
  { id: msgId(), leadId: "lead_027", direction: "inbound",  body: "هل يمكن تخصيص البرنامج لأهدافي الخاصة؟",                                             timestamp: ts(15, 9, 0),  status: "read" },
  { id: msgId(), leadId: "lead_027", direction: "outbound", body: "بالطبع! كل برنامج نصممه بناءً على أهداف وتحليل جسم المشترك.",                        timestamp: ts(15, 9, 15), status: "read" },
  { id: msgId(), leadId: "lead_027", direction: "inbound",  body: "هل يمكن تخصيص البرنامج لأهدافي؟",                                                    timestamp: ts(15, 13, 0), status: "read" },

  // ── lead_028: نسرين حمد (16 days) ───────────────────────────────────
  { id: msgId(), leadId: "lead_028", direction: "outbound", body: "أهلاً نسرين، مرّ وقت منذ آخر تواصل. نودّ معرفة ما إذا كنت لا تزالين مهتمة.",       timestamp: ts(16, 15, 0), status: "read" },
  { id: msgId(), leadId: "lead_028", direction: "inbound",  body: "إعادة التواصل بعد شهر من عدم الرد.",                                                  timestamp: ts(16, 15, 0), status: "read" },

  // ── lead_029: لطيفة المري (18 days) ─────────────────────────────────
  { id: msgId(), leadId: "lead_029", direction: "inbound",  body: "مرحباً، كيف يتم الدفع وهل هناك رابط؟",                                               timestamp: ts(18, 8, 0),  status: "read" },
  { id: msgId(), leadId: "lead_029", direction: "outbound", body: "أهلاً لطيفة! إليك رابط الدفع الآمن. يمكنك الدفع بالبطاقة أو التحويل.",               timestamp: ts(18, 8, 10), status: "read" },
  { id: msgId(), leadId: "lead_029", direction: "inbound",  body: "كيف أدفع؟ هل هناك رابط؟",                                                             timestamp: ts(18, 12, 0), status: "read" },

  // ── lead_030: حمد الزهراني (20 days) ────────────────────────────────
  { id: msgId(), leadId: "lead_030", direction: "inbound",  body: "ما هي نتائج البرنامج المتوقعة خلال شهر واحد؟",                                       timestamp: ts(20, 9, 0),  status: "read" },
  { id: msgId(), leadId: "lead_030", direction: "outbound", body: "خلال الشهر الأول: تحسن في مستوى الطاقة، انخفاض 3-5 كيلو (حسب الحالة)، ونتائج واضحة في القياسات.", timestamp: ts(20, 12, 0), status: "read" },
  { id: msgId(), leadId: "lead_030", direction: "inbound",  body: "ما هي نتائج البرنامج المتوقعة خلال شهر؟",                                             timestamp: ts(20, 16, 0), status: "read" },
];
