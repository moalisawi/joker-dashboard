# API Documentation

## نقاط النهاية الرئيسية (Endpoints)

### Subscriber Operations

#### `POST /api/subscriber-operations`

إنشاء أو تحديث عمليات المشتركين.

**الأدوار المسموحة**: Admin, Owner, Employee

**العمليات**:
- `createSubscriber`: إضافة مشترك جديد
- `updateSubscriber`: تحديث بيانات المشترك
- `deleteSubscriber`: حذف المشترك
- `addPayment`: إضافة دفعة
- `renewSubscription`: تجديد الاشتراك
- `pauseSubscription`: إيقاف الاشتراك
- `freezeSubscription`: تجميد الاشتراك
- `resumeSubscription`: استئناف الاشتراك
- `withdrawSubscription`: سحب الاشتراك

**الطلب** (Request):
```json
{
  "operation": "createSubscriber",
  "data": {
    "name": "محمد أحمد",
    "email": "example@example.com",
    "phone": "966501234567",
    "package": "gold",
    "paymentMethod": "paypal"
  }
}
```

**الرد** (Response):
```json
{
  "success": true,
  "message": "تم إنشاء المشترك بنجاح",
  "data": {
    "id": "subscriber-123",
    "name": "محمد أحمد",
    "createdAt": "2024-05-16T10:00:00Z"
  }
}
```

**رموز الأخطاء**:
- `401`: Unauthorized (رمز غير صحيح)
- `403`: Forbidden (بدون صلاحيات)
- `400`: Bad Request (بيانات غير صحيحة)
- `500`: Server Error

---

### Analytics

#### `GET /api/analytics`

الحصول على بيانات التحليلات.

**الأدوار المسموحة**: Admin, Owner

**المعاملات**:
```
GET /api/analytics?period=month&ym=2024-05
```

**الرد**:
```json
{
  "totalSubscribers": 150,
  "activeSubscribers": 120,
  "expiredSubscribers": 20,
  "totalRevenue": 5000,
  "byPaymentMethod": {
    "paypal": 2000,
    "card": 3000
  }
}
```

---

### Payments

#### `POST /api/payments`

إدارة الدفعات.

**الأدوار المسموحة**: Admin, Owner, Employee

**العمليات**:
- `recordPayment`: تسجيل دفعة
- `refund`: استرجاع دفعة
- `updatePaymentStatus`: تحديث حالة الدفعة

**الطلب**:
```json
{
  "operation": "recordPayment",
  "data": {
    "subscriberId": "sub-123",
    "amount": 100,
    "currency": "USD",
    "method": "paypal",
    "reference": "TXN-123456"
  }
}
```

---

### WhatsApp Operations

#### `POST /api/whatsapp-operations`

إدارة عمليات WhatsApp.

**الأدوار المسموحة**: Admin, Owner, Employee

**العمليات**:
- `createLead`: إنشاء عميل محتمل
- `updateLeadStatus`: تحديث حالة العميل
- `sendMessage`: إرسال رسالة

---

## المصادقة والتفويض

جميع الطلبات تحتاج:

### Headers المطلوبة:
```
Authorization: Bearer <Firebase-ID-Token>
Content-Type: application/json
```

### كيفية الحصول على الرمز:
```typescript
import { getAuth } from 'firebase/auth'

const user = getAuth().currentUser
const token = await user?.getIdToken()
```

---

## معالجة الأخطاء

### صيغة الخطأ:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "ليس لديك صلاحيات كافية لهذه العملية",
    "details": {}
  }
}
```

### أكواد الأخطاء الشائعة:
- `INVALID_TOKEN`: الرمز غير صحيح أو منتهي
- `USER_NOT_FOUND`: المستخدم غير موجود
- `INSUFFICIENT_PERMISSIONS`: صلاحيات غير كافية
- `INVALID_DATA`: البيانات المرسلة غير صحيحة
- `SUBSCRIBER_NOT_FOUND`: المشترك غير موجود
- `OPERATION_FAILED`: العملية فشلت

---

## مثال العميل (Client-Side Implementation)

```typescript
async function callSubscriberOperation(
  operation: string,
  data: any
) {
  const user = getAuth().currentUser
  if (!user) throw new Error('Not authenticated')

  const token = await user.getIdToken()

  const response = await fetch('/api/subscriber-operations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      operation,
      data,
    }),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error?.message)
  }

  return result.data
}
```

---

## معدل الحد (Rate Limiting)

- **الحد**: 100 طلب / دقيقة لكل مستخدم
- **الرد**: `429 Too Many Requests`

---

## الإصدارات المستقبلية

- [ ] Webhooks for external integrations
- [ ] GraphQL API option
- [ ] Bulk operations endpoint
- [ ] Export to CSV/Excel endpoint
