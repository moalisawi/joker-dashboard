"use client";
export const dynamic = "force-dynamic";

import ProtectedLayout from "@/components/layout/ProtectedLayout";
import GuideContent    from "@/components/guide/GuideContent";
import { GUIDE_DATA }  from "@/lib/guide/data";

export default function GuidePage() {
  return (
    <ProtectedLayout>
      <GuideContent data={GUIDE_DATA} />
    </ProtectedLayout>
  );
}
