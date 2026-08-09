import Link from "next/link";
import ErrorScreen from "@/components/ui/ErrorScreen";

/**
 * 404 page. Previously an unknown URL fell through to the framework default,
 * which is untranslated and breaks the RTL Arabic experience.
 */
export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      tone="muted"
      title="الصفحة غير موجودة"
      description="الرابط الذي فتحته غير صحيح أو أن الصفحة نُقلت. تأكد من العنوان أو ارجع للوحة التحكم."
      actions={
        <Link className="jk-btn" href="/">
          العودة للوحة التحكم
        </Link>
      }
    />
  );
}
