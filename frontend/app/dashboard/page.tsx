'use client';
import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';

interface ProblemSet {
  id: string;
  topic: string;
  createdAt: string;
  problems: { id: string; solved: boolean; platform: string }[];
}

interface Stats {
  totalSets: number;
  totalProblems: number;
  solvedProblems: number;
}

const platformColors: Record<string, string> = {
  Codeforces:  'bg-blue-100 text-blue-700',
  LeetCode:    'bg-amber-100 text-amber-700',
  CodeChef:    'bg-orange-100 text-orange-700',
  AtCoder:     'bg-purple-100 text-purple-700',
  CSES:        'bg-teal-100 text-teal-700',
  SPOJ:        'bg-green-100 text-green-700',
  UVa:         'bg-slate-100 text-slate-600',
  Toph:        'bg-cyan-100 text-cyan-700',
  HackerRank:  'bg-emerald-100 text-emerald-700',
  Kattis:      'bg-rose-100 text-rose-700',
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(25);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [sets, setSets] = useState<ProblemSet[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingSets, setLoadingSets] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get('/problems').then(r => setSets(r.data)),
      api.get('/user/stats').then(r => setStats(r.data)),
    ]).finally(() => setLoadingSets(false));
  }, [user]);

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setGenError('');
    setGenerating(true);
    try {
      const { data } = await api.post('/problems/generate', { topic, count });
      setSets(prev => [data, ...prev]);
      setStats(prev => prev ? ({
        ...prev,
        totalSets: prev.totalSets + 1,
        totalProblems: prev.totalProblems + data.problems.length,
      }) : prev);
      setTopic('');
      router.push(`/problems/${data.id}`);
    } catch (err: any) {
      setGenError(err.response?.data?.error || 'Generation failed. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this problem set?')) return;
    await api.delete(`/problems/${id}`);
    setSets(prev => prev.filter(s => s.id !== id));
  };

  const getPlatformCounts = (problems: ProblemSet['problems']) => {
    const counts: Record<string, number> = {};
    problems.forEach(p => { counts[p.platform] = (counts[p.platform] || 0) + 1; });
    return counts;
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-10">
            {[
              { label: 'Problem Sets', value: stats.totalSets },
              { label: 'Total Problems', value: stats.totalProblems },
              { label: 'Solved', value: `${stats.solvedProblems} / ${stats.totalProblems}` },
            ].map(s => (
              <div key={s.label} className="card p-5 text-center">
                <div className="text-3xl font-bold text-indigo-600">{s.value}</div>
                <div className="text-sm text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Generate new set */}
        <div className="card p-6 mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Ask AI for problems</h2>
          <p className="text-slate-500 text-sm mb-5">
            Describe the topic, difficulty, or anything specific — the AI will curate problems for you.
          </p>
          <form onSubmit={handleGenerate} className="space-y-4">
            <textarea
              className="input resize-none h-24 text-base"
              placeholder={`e.g. "Dynamic programming on trees, medium difficulty" or "Graph shortest paths, I know Dijkstra but not Bellman-Ford"`}
              value={topic}
              onChange={e => setTopic(e.target.value)}
              disabled={generating}
            />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Problems:</span>
                {[15, 20, 25, 30].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={`px-3 py-1 rounded-md border transition ${count === n ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 hover:border-indigo-300'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="btn-primary ml-auto flex items-center gap-2"
                disabled={generating || !topic.trim()}
              >
                {generating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating…
                  </>
                ) : (
                  'Generate problems'
                )}
              </button>
            </div>
            {genError && <p className="text-red-600 text-sm">{genError}</p>}
          </form>
        </div>

        {/* Problem sets list */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Your problem sets</h2>
          {loadingSets ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="card p-5 animate-pulse">
                  <div className="h-5 bg-slate-200 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-slate-100 rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : sets.length === 0 ? (
            <div className="card p-12 text-center text-slate-400">
              <div className="text-4xl mb-3">🎯</div>
              <p className="font-medium">No problem sets yet</p>
              <p className="text-sm mt-1">Use the form above to generate your first set!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sets.map(set => {
                const solved = set.problems.filter(p => p.solved).length;
                const total = set.problems.length;
                const pct = total ? Math.round((solved / total) * 100) : 0;
                const platformCounts = getPlatformCounts(set.problems);

                return (
                  <div key={set.id} className="card p-5 flex items-center gap-4 hover:border-indigo-200 transition-colors">
                    <Link href={`/problems/${set.id}`} className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{set.topic}</h3>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-sm text-slate-500">{total} problems</span>
                        <span className="text-sm text-green-600 font-medium">{solved} solved ({pct}%)</span>
                        {Object.entries(platformCounts).map(([platform, count]) => (
                          <span key={platform} className={`text-xs px-2 py-0.5 rounded-full font-medium ${platformColors[platform] || 'bg-slate-100 text-slate-600'}`}>
                            {platform} {count}
                          </span>
                        ))}
                      </div>
                      {total > 0 && (
                        <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden w-48">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-400">
                        {new Date(set.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => handleDelete(set.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors p-1"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
