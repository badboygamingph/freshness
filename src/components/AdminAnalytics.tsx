import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { 
  BarChart3, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  Users, 
  Image as ImageIcon,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { AssessmentRecord, DatasetItem } from '../types/freshness';
import { getUserDatasetSummaries } from '../utils/assessmentStorage';

interface AdminAnalyticsProps {
  allAssessments: AssessmentRecord[];
  items: DatasetItem[];
}

const COLORS = {
  fresh: '#10b981',
  'semi-fresh': '#f59e0b',
  spoiled: '#ef4444',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
};

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ allAssessments, items }) => {
  const userSummaries = useMemo(() => getUserDatasetSummaries(allAssessments, items.length), [allAssessments, items.length]);

  // Classification distribution data
  const classificationData = useMemo(() => {
    const fresh = allAssessments.filter(a => a.classification === 'fresh').length;
    const semiFresh = allAssessments.filter(a => a.classification === 'semi-fresh').length;
    const spoiled = allAssessments.filter(a => a.classification === 'spoiled').length;
    return [
      { name: 'Fresh', value: fresh, color: COLORS.fresh },
      { name: 'Semi-Fresh', value: semiFresh, color: COLORS['semi-fresh'] },
      { name: 'Spoiled', value: spoiled, color: COLORS.spoiled },
    ];
  }, [allAssessments]);

  // User performance data
  const userPerformanceData = useMemo(() => {
    return userSummaries.map(summary => ({
      name: `User ${summary.evaluatorNumber}`,
      fresh: summary.freshRecords.length,
      semiFresh: summary.semiFreshRecords.length,
      spoiled: summary.spoiledRecords.length,
      total: summary.totalAssessed,
      completion: summary.completionRate,
    }));
  }, [userSummaries]);

  // Time-based data (assessments by hour)
  const timeData = useMemo(() => {
    const hourCounts: Record<number, number> = {};
    allAssessments.forEach(assessment => {
      const hour = new Date(assessment.assessed_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      count: hourCounts[i] || 0,
    }));
  }, [allAssessments]);

  // Folder distribution data
  const folderData = useMemo(() => {
    const folderCounts: Record<string, number> = {};
    allAssessments.forEach(assessment => {
      const folder = assessment.sub_folder || 'Uncategorized';
      folderCounts[folder] = (folderCounts[folder] || 0) + 1;
    });

    return Object.entries(folderCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [allAssessments]);

  // Overall stats
  const stats = useMemo(() => ({
    totalAssessments: allAssessments.length,
    totalEvaluators: userSummaries.length,
    totalImages: items.length,
    averageCompletion: userSummaries.length > 0 
      ? Math.round(userSummaries.reduce((sum, s) => sum + s.completionRate, 0) / userSummaries.length)
      : 0,
    completedEvaluators: userSummaries.filter(s => s.isCompleted).length,
  }), [allAssessments, userSummaries, items.length]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">Analytics Dashboard</h3>
            <p className="text-[11px] text-slate-500">
              Real-time insights into evaluator performance and classification trends
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Assessments</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalAssessments}</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Evaluators</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalEvaluators}</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Images</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalImages}</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Completion</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.averageCompletion}%</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Completed</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.completedEvaluators}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classification Distribution Pie Chart */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-5 h-5 text-indigo-600" />
            <h4 className="text-sm font-bold text-slate-900">Classification Distribution</h4>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={classificationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {classificationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Performance Bar Chart */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h4 className="text-sm font-bold text-slate-900">Evaluator Performance</h4>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="fresh" fill={COLORS.fresh} name="Fresh" />
                <Bar dataKey="semiFresh" fill={COLORS['semi-fresh']} name="Semi-Fresh" />
                <Bar dataKey="spoiled" fill={COLORS.spoiled} name="Spoiled" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Time-based Activity Line Chart */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h4 className="text-sm font-bold text-slate-900">Activity Over Time (24h)</h4>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke={COLORS.blue} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Folder Distribution Bar Chart */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="w-5 h-5 text-indigo-600" />
            <h4 className="text-sm font-bold text-slate-900">Top 10 Folders by Assessments</h4>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={folderData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="count" fill={COLORS.purple} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
