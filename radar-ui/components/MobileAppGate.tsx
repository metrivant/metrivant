"use client";

// Mobile gate disabled — mobile and desktop both have full app access.
// The app uses responsive Tailwind classes (MobileNav, md:hidden, etc.)
// to serve separate desktop and mobile layouts from the same routes.

export default function MobileAppGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
