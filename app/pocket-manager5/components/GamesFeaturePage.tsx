"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Gamepad2, Trophy, Target, Users, TrendingUp, Star, Clock, Award, Lock, CheckCircle, Play, BookOpen, GraduationCap } from "lucide-react";
import type { FeatureMeta } from "../featureRegistry";
import type { FormSlug } from "../forms/formRegistry";

interface GamesFeaturePageProps {
  feature: FeatureMeta;
  docUrl?: string;
  relatedForms: Array<{ slug: FormSlug; title: string; feature: string }>;
  shopNumber: string | null;
}

interface GameStats {
  totalPlayers: number;
  totalGamesPlayed: number;
  averageScore: number;
  topPlayer: string;
  recentActivity: Array<{
    player: string;
    game: string;
    score: number;
    timestamp: string;
  }>;
}

interface TrainingLevel {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'available' | 'locked' | 'completed';
  questions: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  route: string;
  prerequisites: string[];
}

interface GameMode {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'available' | 'locked' | 'coming-soon';
  players: string;
  duration: string;
  reward: string;
}

// Training progression levels based on existing training paths
const TRAINING_LEVELS: TrainingLevel[] = [
  {
    id: 'hood-training',
    title: 'Hood Training',
    description: 'Master vehicle hood operations, safety checks, and maintenance procedures.',
    icon: Target,
    status: 'available',
    questions: 10,
    difficulty: 'beginner',
    route: '/games/hood-training',
    prerequisites: []
  },
  {
    id: 'pit-tech',
    title: 'Pit Technician Fundamentals',
    description: 'Learn essential pit technician responsibilities and service bay procedures.',
    icon: Users,
    status: 'locked',
    questions: 10,
    difficulty: 'beginner',
    route: '/games/pit-tech',
    prerequisites: ['hood-training']
  },
  {
    id: 'service-writer-rules',
    title: 'Service Writer Rules',
    description: 'Master customer communication, repair order management, and service coordination.',
    icon: BookOpen,
    status: 'locked',
    questions: 10,
    difficulty: 'intermediate',
    route: '/games/service-writer-rules',
    prerequisites: ['pit-tech']
  },
  {
    id: 'fuel-filter-procedures',
    title: 'Fuel Filter Procedures',
    description: 'Learn fuel system maintenance, filter replacement, and contamination prevention.',
    icon: TrendingUp,
    status: 'locked',
    questions: 10,
    difficulty: 'intermediate',
    route: '/games/fuel-filter-procedures',
    prerequisites: ['service-writer-rules']
  },
  {
    id: 'brand-standards',
    title: 'Brand Standards',
    description: 'Understand Take 5 brand consistency, customer experience, and operational standards.',
    icon: Star,
    status: 'locked',
    questions: 10,
    difficulty: 'intermediate',
    route: '/games/brand-standards',
    prerequisites: ['fuel-filter-procedures']
  },
  {
    id: 'fleet-program',
    title: 'Fleet Program Management',
    description: 'Master fleet maintenance programs, preventive care, and bulk service agreements.',
    icon: Award,
    status: 'locked',
    questions: 10,
    difficulty: 'advanced',
    route: '/games/fleet-program',
    prerequisites: ['brand-standards']
  },
  {
    id: 'ybr-scenarios',
    title: 'YBR Scenarios',
    description: 'Handle complex customer scenarios, problem-solving, and service recommendations.',
    icon: GraduationCap,
    status: 'locked',
    questions: 10,
    difficulty: 'advanced',
    route: '/games/ybr-scenarios',
    prerequisites: ['fleet-program']
  }
];

const GAME_MODES: GameMode[] = [
  {
    id: 'training-progression',
    title: 'Training Mastery Challenge',
    description: 'Complete all training modules in sequence to become a Take 5 expert. Each level unlocks the next in this comprehensive learning journey.',
    icon: GraduationCap,
    status: 'available',
    players: 'Single Player',
    duration: '30-45 min',
    reward: '500 coins + Certification'
  },
  {
    id: 'head-to-head',
    title: 'Head-to-Head Battle',
    description: 'Challenge another employee in real-time Jeopardy-style competition with buzzers and timers.',
    icon: Users,
    status: 'locked',
    players: '2 Players',
    duration: '10-15 min',
    reward: '100 coins + XP'
  },
  {
    id: 'shop-tycoon',
    title: 'Shop Tycoon',
    description: 'Build and manage your virtual Take 5 shop empire with upgrades, customers, and progression.',
    icon: TrendingUp,
    status: 'locked',
    players: 'Single Player',
    duration: 'Ongoing',
    reward: 'Passive coins'
  }
];

export function GamesFeaturePage({ feature, docUrl, relatedForms }: GamesFeaturePageProps) {
  const [gameStats, setGameStats] = useState<GameStats>({
    totalPlayers: 0,
    totalGamesPlayed: 0,
    averageScore: 0,
    topPlayer: '',
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading game stats - in real implementation, this would fetch from Supabase
    const loadGameStats = async () => {
      try {
        // Mock data - replace with actual Supabase queries
        setGameStats({
          totalPlayers: 24,
          totalGamesPlayed: 156,
          averageScore: 78,
          topPlayer: 'Sarah Johnson',
          recentActivity: [
            { player: 'Mike Chen', game: 'Hood Training', score: 95, timestamp: '2 hours ago' },
            { player: 'Lisa Rodriguez', game: 'Service Writer Rules', score: 88, timestamp: '4 hours ago' },
            { player: 'Tom Wilson', game: 'Fuel Filter Procedures', score: 92, timestamp: '6 hours ago' }
          ]
        });
      } catch (error) {
        console.error('Error loading game stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGameStats();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'available': return <Play className="h-4 w-4 text-emerald-400" />;
      case 'locked': return <Lock className="h-4 w-4 text-slate-500" />;
      default: return null;
    }
  };

  const handleLevelClick = (level: TrainingLevel) => {
    if (level.status === 'available') {
      // In a real implementation, this would navigate to the game
      console.log(`Starting level: ${level.title}`);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/pocket-manager5"
            className="inline-flex items-center gap-2 text-sm font-semibold text-pm5-teal transition hover:text-pm5-teal"
          >
            <span aria-hidden>↩</span> Back to Pocket Manager5
          </Link>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20">
              <Gamepad2 className="h-8 w-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-white">{feature.title}</h1>
              <p className="text-slate-400">{feature.summary}</p>
            </div>
          </div>
        </div>

        {/* Game Stats Overview */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-400" />
              <span className="text-sm font-medium text-slate-300">Active Players</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{gameStats.totalPlayers}</p>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-400" />
              <span className="text-sm font-medium text-slate-300">Games Played</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{gameStats.totalGamesPlayed}</p>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-400" />
              <span className="text-sm font-medium text-slate-300">Avg Score</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{gameStats.averageScore}%</p>
          </div>

          <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-purple-400" />
              <span className="text-sm font-medium text-slate-300">Top Player</span>
            </div>
            <p className="mt-2 text-lg font-bold text-white">{gameStats.topPlayer}</p>
          </div>
        </div>

        {/* Training Mastery Challenge */}
        <section className="mb-8">
          <h2 className="mb-6 text-xl font-semibold text-white">Training Mastery Challenge</h2>
          <div className="mb-6 rounded-xl border border-slate-700/60 bg-slate-900/50 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/20">
                <GraduationCap className="h-6 w-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">Complete All Training Modules</h3>
                <p className="text-sm text-slate-400 mb-4">
                  Master every aspect of Take 5 operations through our comprehensive training progression.
                  Each level builds on the previous one, ensuring you become a true expert.
                </p>
                <div className="flex items-center gap-4 text-sm text-slate-300">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Single Player
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    30-45 min
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="h-4 w-4" />
                    500 coins + Certification
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Training Levels */}
          <div className="space-y-4">
            {TRAINING_LEVELS.map((level, index) => {
              const isLast = index === TRAINING_LEVELS.length - 1;

              return (
                <div key={level.id} className="relative">
                  {/* Connection line to next level */}
                  {!isLast && (
                    <div className="absolute left-6 top-16 w-0.5 h-8 bg-slate-700"></div>
                  )}

                  <div
                    className={`rounded-xl border p-4 transition cursor-pointer ${
                      level.status === 'available'
                        ? 'border-emerald-500/50 bg-slate-900/50 hover:border-emerald-400/70 hover:bg-slate-900/70'
                        : level.status === 'completed'
                        ? 'border-green-500/50 bg-green-900/20'
                        : 'border-slate-700/40 bg-slate-900/30 opacity-60'
                    }`}
                    onClick={() => handleLevelClick(level)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Level indicator */}
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                        level.status === 'completed'
                          ? 'border-green-500 bg-green-500/20'
                          : level.status === 'available'
                          ? 'border-emerald-500 bg-emerald-500/20'
                          : 'border-slate-600 bg-slate-800/50'
                      }`}>
                        {level.status === 'completed' ? (
                          <CheckCircle className="h-6 w-6 text-green-400" />
                        ) : level.status === 'available' ? (
                          <span className="text-sm font-bold text-emerald-400">{index + 1}</span>
                        ) : (
                          <Lock className="h-5 w-5 text-slate-500" />
                        )}
                      </div>

                      {/* Level content */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-lg font-semibold text-white">{level.title}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            level.difficulty === 'beginner' ? 'bg-green-500/20 text-green-400' :
                            level.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {level.difficulty}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mb-2">{level.description}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>{level.questions} questions</span>
                          {level.prerequisites.length > 0 && (
                            <span>Requires: {level.prerequisites.map(id =>
                              TRAINING_LEVELS.find(l => l.id === id)?.title
                            ).join(', ')}</span>
                          )}
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex items-center gap-2">
                        {getStatusIcon(level.status)}
                        {level.status === 'available' && (
                          <button className="rounded-lg bg-emerald-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-emerald-500">
                            Start Level
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Other Game Modes */}
        <section className="mb-8">
          <h2 className="mb-6 text-xl font-semibold text-white">Other Game Modes</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {GAME_MODES.slice(1).map((mode) => {
              const IconComponent = mode.icon;
              return (
                <div
                  key={mode.id}
                  className={`rounded-xl border p-6 transition ${
                    mode.status === 'available'
                      ? 'border-slate-700/60 bg-slate-900/50 hover:border-emerald-500/50'
                      : mode.status === 'locked'
                      ? 'border-slate-800/40 bg-slate-900/30 opacity-60'
                      : 'border-slate-800/40 bg-slate-900/30 opacity-40'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800/60">
                      <IconComponent className="h-6 w-6 text-slate-300" />
                    </div>
                    {mode.status === 'locked' && (
                      <div className="rounded-full bg-slate-700 px-2 py-1">
                        <span className="text-xs font-medium text-slate-400">LOCKED</span>
                      </div>
                    )}
                    {mode.status === 'coming-soon' && (
                      <div className="rounded-full bg-blue-500/20 px-2 py-1">
                        <span className="text-xs font-medium text-blue-400">COMING SOON</span>
                      </div>
                    )}
                  </div>

                  <h3 className="mb-2 text-lg font-semibold text-white">{mode.title}</h3>
                  <p className="mb-4 text-sm text-slate-400">{mode.description}</p>

                  <div className="space-y-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      <span>{mode.players}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>{mode.duration}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="h-3 w-3" />
                      <span>{mode.reward}</span>
                    </div>
                  </div>

                  {mode.status === 'available' && (
                    <button className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500">
                      Play Now
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="mb-8">
          <h2 className="mb-6 text-xl font-semibold text-white">Recent Activity</h2>
          <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-6">
            {gameStats.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {gameStats.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between border-b border-slate-800/40 pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800">
                        <Trophy className="h-4 w-4 text-yellow-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{activity.player}</p>
                        <p className="text-xs text-slate-400">{activity.game}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-400">{activity.score} pts</p>
                      <p className="text-xs text-slate-500">{activity.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Gamepad2 className="mx-auto h-12 w-12 text-slate-600" />
                <p className="mt-4 text-slate-400">No recent activity</p>
              </div>
            )}
          </div>
        </section>

        {/* Feature Info */}
        <section className="rounded-3xl border border-slate-800/80 bg-slate-900/70 p-8 shadow-2xl shadow-black/30">
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Pocket Manager feature</p>
          <div className="mt-2 flex flex-wrap items-start gap-3">
            <h2 className="text-2xl font-semibold text-white">{feature.title}</h2>
            <span className="rounded-full border border-slate-800/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
              {feature.status}
            </span>
          </div>
          <p className="mt-4 text-slate-300">{feature.summary}</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {feature.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-slate-800/60 px-3 py-1 text-xs text-slate-300">
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Native route</dt>
              <dd className="mt-2 font-mono text-sm text-emerald-200">{feature.platformRoute}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Forms & Flows</dt>
              <dd className="mt-2 flex flex-wrap gap-2 text-sm text-slate-200">
                {relatedForms.length > 0
                  ? relatedForms.map((form) => (
                      <Link
                        key={form.slug}
                        href={`/pocket-manager5/forms/${form.slug}`}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-800/70 px-3 py-1 text-xs font-semibold text-pm5-teal transition hover:pm5-teal-border"
                      >
                        {form.title} ↗
                      </Link>
                    ))
                  : feature.forms?.length
                  ? feature.forms.map((formName) => <p key={formName}>{formName}</p>)
                  : <p className="text-slate-400">Documented in mobile app only.</p>}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Key hooks / data</dt>
              <dd className="mt-2 space-y-1 font-mono text-[13px] text-slate-200">
                {feature.keyHooks?.map((hook) => (
                  <p key={hook}>{hook}</p>
                )) || <p>Surface data via Pocket Manager service.</p>}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Documentation</dt>
              <dd className="mt-2 text-sm">
                {docUrl ? (
                  <Link
                    href={docUrl}
                    className="inline-flex items-center gap-1 text-pm5-teal transition hover:text-pm5-teal"
                  >
                    View docs ↗
                  </Link>
                ) : (
                  <p className="text-slate-400">Coming soon</p>
                )}
              </dd>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}