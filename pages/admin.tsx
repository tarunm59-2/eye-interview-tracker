import { useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/auth-client";
import { getScoreLabel } from "@/lib/scoring";
import type { Assessment, CandidateSummary } from "@/lib/types";

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function AdminWorkspace() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch<{ candidates: CandidateSummary[] }>("/api/candidates"),
      apiFetch<{ assessments: Assessment[] }>("/api/assessments"),
    ])
      .then(([c, a]) => {
        setCandidates(c.candidates);
        setAssessments(a.assessments);
        setSelectedId(c.candidates[0]?.user.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, []);

  const selected = candidates.find((c) => c.user.id === selectedId) ?? null;
  const selectedAssessments = useMemo(
    () => assessments.filter((a) => a.candidateId === selectedId),
    [assessments, selectedId],
  );

  const byDay = useMemo(() => {
    const groups = new Map<string, Assessment[]>();
    for (const item of selectedAssessments) {
      const key = dayKey(item.createdAt);
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [selectedAssessments]);

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <NavBar user={user} />
        <h1 className="mb-2 text-3xl font-bold">Admin overview</h1>
        <p className="mb-6 text-slate-400">
          View every candidate and how they operate day to day through integrity assessments.
        </p>
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl bg-slate-800 p-4 lg:col-span-1">
            <h2 className="mb-3 font-semibold">Candidates</h2>
            <ul className="space-y-2">
              {candidates.map((item) => (
                <li key={item.user.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.user.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left ${
                      selectedId === item.user.id ? "bg-blue-600" : "bg-slate-700 hover:bg-slate-600"
                    }`}
                  >
                    <div className="font-medium">{item.user.name}</div>
                    <div className="text-xs text-slate-300">
                      {item.user.email} · {item.todayCount} today · avg{" "}
                      {item.averageScore ?? "—"}
                    </div>
                  </button>
                </li>
              ))}
              {candidates.length === 0 && (
                <li className="text-sm text-slate-400">No candidates registered yet.</li>
              )}
            </ul>
          </section>
          <section className="rounded-2xl bg-slate-800 p-4 lg:col-span-2">
            {!selected ? (
              <p className="text-slate-400">Select a candidate to inspect daily activity.</p>
            ) : (
              <>
                <h2 className="text-xl font-semibold">{selected.user.name}</h2>
                <p className="mb-4 text-sm text-slate-400">
                  {selected.user.email} · {selected.assessmentCount} assessments · last seen{" "}
                  {selected.lastAssessmentAt
                    ? new Date(selected.lastAssessmentAt).toLocaleString()
                    : "never"}
                </p>
                {byDay.length === 0 && (
                  <p className="text-slate-400">No integrity assessments submitted.</p>
                )}
                <div className="space-y-4">
                  {byDay.map(([day, items]) => {
                    const avg = Math.round(
                      items.reduce((sum, item) => sum + item.metrics.score, 0) / items.length,
                    );
                    return (
                      <div key={day} className="rounded-xl bg-slate-700 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="font-medium">{day}</h3>
                          <span className="text-sm text-slate-300">
                            {items.length} check-ins · avg {avg} ({getScoreLabel(avg)})
                          </span>
                        </div>
                        <ul className="space-y-3">
                          {items.map((item) => (
                            <li key={item.id} className="flex gap-3 text-sm">
                              {item.snapshot && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.snapshot}
                                  alt=""
                                  className="h-16 w-20 rounded object-cover"
                                />
                              )}
                              <div>
                                <div>
                                  {new Date(item.createdAt).toLocaleTimeString()} · score{" "}
                                  {item.metrics.score} · {item.dominantExpression}
                                </div>
                                <div className="text-slate-400">
                                  stability {item.metrics.stability} · engagement{" "}
                                  {item.metrics.engagement} · composure {item.metrics.composure} ·
                                  authenticity {item.metrics.authenticity}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard role="admin">
      <AdminWorkspace />
    </AuthGuard>
  );
}
