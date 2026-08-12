# ١٢ أغسطس ٢٠٢٦ — نشر قواعد وفهارس دفتر الفوترة

سجل ما صار حيّاً على `joker-prod`، وكيف تتراجع عنه.

## ما نُشر

بأمر المستخدم الصريح، وبالترتيب الذي يفرضه
[`SECURITY-HARDENING-2026-08.md`](./SECURITY-HARDENING-2026-08.md): **الفهارس أولاً ثم
القواعد**. عكس الترتيب — نشر قاعدة تعتمد على فهرس غير مبني — يجعل الاستعلام يفشل
بـ permission-denied فيبدو الأمر كفقدان بيانات.

| # | الأمر | النتيجة |
|---|---|---|
| ١ | `firebase deploy --only firestore:rules,firestore:indexes --dry-run` | `rules file compiled successfully` |
| ٢ | `firebase deploy --only firestore:indexes` | `deployed indexes ... successfully` |
| ٣ | `firebase deploy --only firestore:rules` | `released rules firestore.rules to cloud.firestore` |

### القواعد

ستة مطابقات جديدة، **كلها إضافة صرفة**: `git diff` أظهر ٦١ سطراً مضافاً و**صفر سطر
محذوف**. لم تُمَس أي قاعدة قائمة، فلا يمكن لهذا النشر أن يضيّق وصولاً كان مفتوحاً —
وهو الاتجاه الآمن الوحيد المقبول هنا.

- `subscriptionCycles` · `invoices` · `installments` · `paymentAdjustments`
  — قراءة `isStaff() || ownsBillingRow()`، وكل الكتابات `if false`
- `settlementBatches` — قراءة `isStaff()` فقط (لا يوجد نطاق موظف يُطبَّق على
  مصالحة تشمل كل طرق الدفع)
- `counters` — `read, write: if false` بالكامل: التسلسل يُقرأ ويُزاد داخل نفس
  المعاملة التي تصدر الفاتورة، ولا شيء في الواجهة له سبب لرؤيته

الدالة المساعدة `ownsBillingRow()` تعبير `return` واحد بلا `if` — القيد الذي عطّل
النشر ثلاثة أشهر في أغسطس ٢٠٢٥. تحقّق منه سكربت قبل النشر وأكّده الـ dry-run.

### الفهارس

٦ فهارس مركّبة لمجموعات الفوترة + فهرسان على `payments`. المؤكَّد على الخادم بعد النشر:

```
subscriptionCycles  subscriberId ASC, cycleNumber DESC
invoices            subscriberId ASC, issueDate DESC
invoices            status ASC, dueDate ASC
installments        invoiceId ASC, installmentNumber ASC
installments        subscriberId ASC, dueDate ASC
installments        status ASC, dueDate ASC
payments            paymentMethodId ASC, date ASC      ← تحتاجه /api/payments/reconcile
payments            receiptStatus ASC, date DESC
```

**فهرس واحد فقط مطلوب فعلياً اليوم**: `payments (paymentMethodId, date)` الذي يستعمله
مسار المصالحة. الباقي استباقي — كل استعلامات الواجهة حقل واحد مع ترتيب في الذاكرة،
تحديداً كي لا يفشل شيء قبل بناء الفهارس.

## ما تغيّر سلوكياً بعد النشر

قبله كانت قاعدة الرفض الشاملة `match /{document=**}` تحجب المجموعات الجديدة عن
**الجميع بمن فيهم المالك**، والكتابة تنجح (Admin SDK يتجاوز القواعد) بينما القراءة
تُرفض. بعده:

- تبويب «الفوترة» يعرض الفاتورة وجدول الأقساط الحقيقيين بدل البديل المُعاد بناؤه
- لوحة «التسويات» في تبويب الدفعات تظهر
- صفحة `/finance` تعرض الأقساط والفواتير بدل أصفار
- الموظف يرى فوترة مشتركيه فقط، عبر `convincedByUid` المُدنرَل الذي يكتبه الخادم

## التراجع

القواعد والفهارس مستقلة. **الفهارس لا تحتاج تراجعاً** — فهرس زائد لا يكسر شيئاً،
يكلّف تخزيناً فقط.

للقواعد، من وحدة تحكم Firebase:
Firestore → Rules → History → اختر الإصدار السابق لـ ١٢ أغسطس ٢٠٢٦ → Restore.

أو من الطرفية:

```bash
git stash && npx firebase deploy --only firestore:rules --project joker-prod && git stash pop
```

التراجع يعيد المجموعات الست إلى الحجب الشامل. **لا يفقد بياناً**: الوثائق مكتوبة
بـ Admin SDK وتبقى، والواجهة تسقط تلقائياً إلى العرض المُعاد بناؤه من ملخّص المشترك
عبر `legacyToCurrentCycleView()`، مع لافتة تقول إن السبب قواعد غير منشورة لا قِدَم
المشترك.

## ما لم يُنشر

- **الكود** — لم يُدفع ولم يُنشر على Vercel. القواعد وحدها هي ما صار حيّاً.
- **`backfill-subscription-cycles.mjs`** — لم يُشغَّل بـ `--apply`. اختياري:
  المشتركون الأقدم يعملون بلا دورات عبر `legacyToCurrentCycleView()`.

## نقطة تحقّق باقية

تعذّر قراءة الـ ruleset الحيّ نصياً للمقارنة بايت-ببايت (لا يوجد
`gcloud auth print-access-token` في هذه البيئة، ولا يعرض `firebase-tools` أمراً
لجلب القواعد المنشورة). الدليل المتاح هو رسالة `released rules ... to cloud.firestore`
من الـ CLI — وهي خطوة الإصدار نفسها، تفشل بصوت عالٍ ولا تنشر عند أي خطأ. للتأكيد
البصري: Firebase Console → Firestore → Rules.
