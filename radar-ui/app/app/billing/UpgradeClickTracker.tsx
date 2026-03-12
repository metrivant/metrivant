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
    <div onClick={() => capture("upgrade_clicked", { source })}>
      {children}
    </div>
  );
}
