"use client";

import ProtectedLayout from "@/components/layout/ProtectedLayout";
import PageHeader      from "@/components/layout/PageHeader";
import GuideContent    from "@/components/guide/GuideContent";
import { GUIDE_DATA }  from "@/lib/guide/data";

export default function GuidePage() {
  return (
    <ProtectedLayout>
      <div className="p-5 md:p-7">
        <PageHeader title="دليل الاستخدام" subtitle="كل ما تحتاج معرفته عن نظام الجوكر" />
      </div>
      <GuideContent data={GUIDE_DATA} />
    </ProtectedLayout>
  );
}
