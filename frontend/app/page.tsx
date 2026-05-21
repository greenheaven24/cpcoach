'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  if (loading) return null;

  const features = [
    {
      icon: '🤖',
      title: 'AI-Powered Recommendations',
      desc: 'Gemini AI curates the best problems tailored to your exact topic and skill level.',
    },
    {
      icon: '🌐',
      title: 'Multi-Platform',
      desc: 'Problems from Codeforces, LeetCode, and CodeChef — all in one place.',
    },
    {
      icon: '📊',
      title: 'Track Your Progress',
      desc: 'Mark problems as solved and monitor your improvement over time.',
    },
    {
      icon: '🎯',
      title: 'Personalized Sessions',
      desc: 'Describe exactly what you want to practice in plain English.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b border-slate-100 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">CP</span>
          </div>
          <span className="font-bold text-slate-900 text-lg">CP Coach</span>
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="btn-secondary py-2 px-4 text-sm">Login</Link>
          <Link href="/register" className="btn-primary py-2 px-4 text-sm">Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <span>Powered by Google Gemini AI</span>
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold text-slate-900 leading-tight mb-6">
          Your personal<br />
          <span className="text-indigo-600">CP coach</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10">
          Tell the AI what topic you want to practice. Get 25+ curated problems from
          Codeforces, LeetCode, and CodeChef — instantly.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register" className="btn-primary text-base px-8 py-3">
            Start practicing free
          </Link>
          <Link href="/login" className="btn-secondary text-base px-8 py-3">
            I have an account
          </Link>
        </div>
      </section>

      {/* Demo prompt */}
      <section className="max-w-2xl mx-auto px-6 mb-24">
        <div className="card p-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Example prompt</p>
          <p className="text-slate-700 text-lg italic">
            "I want to practice dynamic programming on trees, medium difficulty, I'm comfortable with basic DP"
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-sm text-slate-500">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            Gemini generates 25 problems in seconds
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
            Everything you need to level up
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map(f => (
              <div key={f.title} className="card p-6">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-slate-900 text-lg mb-2">{f.title}</h3>
                <p className="text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Ready to start?</h2>
        <p className="text-slate-500 mb-8">Free to use. No credit card required.</p>
        <Link href="/register" className="btn-primary text-base px-8 py-3">
          Create your account
        </Link>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-400">
        CP Coach — Powered by Google Gemini AI
      </footer>
    </div>
  );
}
