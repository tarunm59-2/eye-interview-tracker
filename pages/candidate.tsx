import dynamic from "next/dynamic";
import { AuthGuard } from "@/components/AuthGuard";

const CandidateAssessment = dynamic(
  () => import("@/components/CandidateAssessment").then((mod) => mod.CandidateAssessment),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300">
        Loading...
      </main>
    ),
  },
);

export default function CandidatePage() {
  return (
    <AuthGuard role="candidate">
      <CandidateAssessment />
    </AuthGuard>
  );
}
