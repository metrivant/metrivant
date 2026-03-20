"use client";

import dynamic from "next/dynamic";

const PipelineExperience = dynamic(
  () => import("./PipelineExperience"),
  { ssr: false, loading: () => <div className="h-screen w-full bg-[#000200]" /> }
);

export default function PipelineSection() {
  return <PipelineExperience />;
}
