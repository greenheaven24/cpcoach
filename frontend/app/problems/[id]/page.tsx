'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';

interface Problem {
  id: string;
  title: string;
  platform: string;
  difficulty: string;
  link: string;
  tags: string;
  description: string;
  solved: boolean;
}

interface ProblemSet {
  id: string;
  topic: string;
  createdAt: string;
  problems: Problem[];
}

const platformColors: Record<string, string> = {
  Codeforces:  'bg-blue-100 text-blue-700 border-blue-200',
  LeetCode:    'bg-amber-100 text-amber-700 border-amber-200',
  CodeChef:    'bg-orange-100 text-orange-700 border-orange-200',
  AtCoder:     'bg-purple-100 text-purple-700 border-purple-200',
  CSES:        'bg-teal-100 text-teal-700 border-teal-200',
  SPOJ:        'bg-green-100 text-green-700 border-green-200',
  UVa:         'bg-slate-100 text-slate-700 border-slate-300',
  Toph:        'bg-cyan-100 text-cyan-700 border-cyan-200',
  HackerRank:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  Kattis:      'bg-rose-100 text-rose-700 border-rose-200',
};

const platformDot: Record<string, string> = {
  Codeforces:  'bg-blue-500',
  LeetCode:    'bg-amber-500',
  CodeChef:    'bg-orange-500',
  AtCoder:     'bg-purple-500',
  CSES:        'bg-teal-500',
  SPOJ:        'bg-green-500',
  UVa:         'bg-slate-500',
  Toph:        'bg-cyan-500',
  HackerRank:  'bg-emerald-500',
  Kattis:      'bg-rose-500',
};

function getSearchUrl(platform: string, title: string): string {
  const q = encodeURIComponent(title);
  switch (platform) {
    case 'Codeforces':  return `https://codeforces.com/problemset?search=${q}`;
    case 'LeetCode':    return `https://leetcode.com/search/?q=${q}`;
    case 'CodeChef':    return `https://www.codechef.com/practice?page=0&search=${q}`;
    case 'AtCoder':     return `https://kenkoooo.com/atcoder/#/search?query=${q}`;
    case 'CSES':        return `https://cses.fi/problemset/`;
    case 'SPOJ':        return `https://www.spoj.com/search/?text=${q}`;
    case 'UVa':         return `https://onlinejudge.org/index.php?option=com_onlinejudge&Itemid=8&page=show_problem&search=${q}`;
    case 'Toph':        return `https://toph.co/problems?q=${q}`;
    case 'HackerRank':  return `https://www.hackerrank.com/search?q=${q}`;
    case 'Kattis':      return `https://open.kattis.com/problems?q=${q}`;
    default:            return `https://www.google.com/search?q=${encodeURIComponent(title + ' ' + platform + ' problem')}`;
  }
}

function difficultyColor(platform: string, diff: string): string {
  if (platform === 'LeetCode') {
    if (diff === 'Easy') return 'text-green-600 bg-green-50';
    if (diff === 'Medium') return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  }
  if (platform === 'Codeforces') {
    const n = parseInt(diff);
    if (n < 1400) return 'text-green-600 bg-green-50';
    if (n < 1900) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  }
  if (diff === 'Beginner' || diff === 'Easy') return 'text-green-600 bg-green-50';
  if (diff === 'Medium') return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
}

export default function ProblemSetPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [set, setSet] = useState<ProblemSet | null>(null);
  const [loadingSet, setLoadingSet] = useState(true);
  const [filter, setFilter] = useState<string>('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api.get(`/problems/${id}`)
      .then(r => setSet(r.data))
      .catch(() => router.replace('/dashboard'))
      .finally(() => setLoadingSet(false));
  }, [id, user, router]);

  const toggleSolved = async (problem: Problem) => {
    setToggling(problem.id);
    try {
      const { data } = await api.patch(`/problems/${id}/problems/${problem.id}`, {
        solved: !problem.solved,
      });
      setSet(prev => prev ? ({
        ...prev,
        problems: prev.problems.map(p => p.id === data.id ? { ...p, solved: data.solved } : p),
      }) : prev);
    } catch {
      // ignore
    } finally {
      setToggling(null);
    }
  };

  if (loading || !user) return null;

  if (loadingSet) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 py-10">
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card p-5 animate-pulse">
                <div className="h-5 bg-slate-200 rounded w-1/2 mb-2" />
                <div className="h-4 bg-slate-100 rounded w-1/4" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!set) return null;

  const platforms = ['All', ...Array.from(new Set(set.problems.map(p => p.platform)))];
  const filtered = filter === 'All' ? set.problems : set.problems.filter(p => p.platform === filter);
  const solved = set.problems.filter(p => p.solved).length;
  const total = set.problems.length;
  const pct = total ? Math.round((solved / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-indigo-600 flex items-center gap-1 mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">{set.topic}</h1>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>{total} problems</span>
            <span className="text-green-600 font-medium">{solved} solved ({pct}%)</span>
            <span>{new Date(set.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden w-full max-w-xs">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Platform filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {platforms.map(p => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition ${
                filter === p
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {p !== 'All' && (
                <span className={`w-2 h-2 rounded-full ${platformDot[p] || 'bg-slate-400'}`} />
              )}
              {p}
              {p !== 'All' && (
                <span className="opacity-70">
                  ({set.problems.filter(pr => pr.platform === p).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Problems list */}
        <div className="space-y-3">
          {filtered.map((problem, idx) => {
            const tags: string[] = (() => {
              try { return JSON.parse(problem.tags); } catch { return []; }
            })();
            const isExpanded = expanded === problem.id;
            const isToggling = toggling === problem.id;

            return (
              <div
                key={problem.id}
                className={`card transition-all ${problem.solved ? 'opacity-75' : ''}`}
              >
                <div className="p-4 flex items-start gap-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleSolved(problem)}
                    disabled={isToggling}
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      problem.solved
                        ? 'bg-green-500 border-green-500'
                        : 'border-slate-300 hover:border-green-400'
                    } ${isToggling ? 'opacity-50' : ''}`}
                  >
                    {problem.solved && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-xs text-slate-400 font-mono mt-0.5 shrink-0">
                        #{idx + 1}
                      </span>
                      <a
                        href={problem.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`font-semibold hover:text-indigo-600 transition-colors ${problem.solved ? 'line-through text-slate-400' : 'text-slate-900'}`}
                      >
                        {problem.title}
                      </a>
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${platformColors[problem.platform] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {problem.platform}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColor(problem.platform, problem.difficulty)}`}>
                        {problem.difficulty}
                      </span>
                      {tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={problem.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open problem directly"
                      className="text-xs btn-secondary py-1.5 px-3"
                    >
                      Solve
                    </a>
                    <a
                      href={getSearchUrl(problem.platform, problem.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Search "${problem.title}" on ${problem.platform}`}
                      className="text-xs text-slate-400 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 rounded-lg py-1.5 px-2 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                      </svg>
                    </a>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : problem.id)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded description */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-sm text-slate-600 leading-relaxed">{problem.description}</p>
                      {tags.length > 3 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {tags.slice(3).map(tag => (
                            <span key={tag} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
