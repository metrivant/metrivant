"use client";

import { capture } from "../../../lib/posthog";

export default function UpgradeClickTracker({
  children,
  source,
}: {
  children: React.ReactNode;
  source: string;
}) {
  return (
    <div className="contents" onClick={() => capture("upgrade_clicked", { source })}>
      {children}
    </div>
  );
}
