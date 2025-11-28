// SessionSummary.jsx
import React, { useMemo } from 'react';
import { Card, Button } from './Common';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Trophy, Clock, Activity, Home, RotateCcw, PlayCircle, Zap } from 'lucide-react';

export const SessionSummary = ({ sessionTime, sessionEvents, onGoHome, onStartNew, onTakeQuiz, attentionHistory, attention }) => {
  const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  
  const analysis = useMemo(() => {
    const validHistory = attentionHistory.filter(e => typeof e.attention === 'number' && !isNaN(e.attention));
    const averageAttention = validHistory.length > 0
      ? validHistory.reduce((sum, point) => sum + point.attention, 0) / validHistory.length
      : (typeof attention === 'number' && !isNaN(attention) ? Math.round(attention) : 0);
    
    let attentionData = validHistory.map(e => ({
      time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      attention: e.attention,
    }));

    // Fallback simulation if no data (for demo purposes)
    if (attentionData.length === 0) {
      const sessionStart = Date.now() - (sessionTime * 1000);
      const numPoints = Math.max(10, Math.floor(sessionTime / 5));
      const baseAttention = typeof attention === 'number' && !isNaN(attention) ? attention : 50;
      attentionData = Array.from({ length: numPoints }, (_, i) => {
        const progress = i / (numPoints - 1);
        let simulatedAttention = baseAttention;
        if (progress < 0.3) {
          simulatedAttention = baseAttention + (20 * (1 - progress / 0.3));
        } else if (progress < 0.7) {
          simulatedAttention = baseAttention - (10 * Math.sin(progress * Math.PI));
        } else {
          simulatedAttention = baseAttention + (10 * ((progress - 0.7) / 0.3));
        }
        simulatedAttention = Math.max(0, Math.min(100, simulatedAttention));
        return {
          time: new Date(sessionStart + (i * (sessionTime * 1000 / (numPoints - 1)))).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          attention: Math.round(simulatedAttention),
        };
      });
    }

    let bestContentType = "You maintained a consistent and balanced focus. Well done!";
    if (averageAttention > 70) {
      bestContentType = "You excelled with interactive content. Quizzes and activities boost your focus significantly!";
    } else if (averageAttention < 50) {
      bestContentType = "Focus was lower than usual. Try shorter sessions or minimizing external distractions.";
    } else {
      bestContentType = "Your focus varied. Regular engagement with the material can help maintain steady attention.";
    }
    return { attentionData, bestContentType, averageAttention };
  }, [attentionHistory, attention, sessionTime]);

  return (
    <Card className="w-full max-w-5xl mx-auto p-0 border-0 bg-white/90 backdrop-blur-xl shadow-2xl overflow-hidden">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-center text-white rounded-2xl">
        <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-md shadow-inner">
            <Trophy size={32} className="text-white" />
        </div>
        <h2 className="text-3xl font-extrabold mb-1">Session Complete!</h2>
        <p className="opacity-90 font-medium">Great job sticking with your study plan.</p>
      </div>

      <div className="p-8">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100 flex items-center gap-4">
                <div className="p-3 bg-white rounded-xl text-orange-600 shadow-sm"><Clock size={24} /></div>
                <div>
                    <p className="text-xs font-bold text-orange-400 uppercase tracking-wide">Total Time</p>
                    <p className="text-2xl font-black text-gray-900">{formatTime(sessionTime)}</p>
                </div>
            </div>
            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex items-center gap-4">
                <div className="p-3 bg-white rounded-xl text-blue-600 shadow-sm"><Activity size={24} /></div>
                <div>
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-wide">Avg Attention</p>
                    <p className="text-2xl font-black text-gray-900">{Math.round(analysis.averageAttention)}%</p>
                </div>
            </div>
            <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100 flex items-center gap-4">
                <div className="p-3 bg-white rounded-xl text-purple-600 shadow-sm"><Zap size={24} /></div>
                <div>
                    <p className="text-xs font-bold text-purple-400 uppercase tracking-wide">Focus Score</p>
                    <p className="text-2xl font-black text-gray-900">{Math.min(100, Math.round(analysis.averageAttention * 1.1))}</p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Insight Column */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 h-full">
                <h3 className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
                    <span className="text-xl">💡</span> AI Insight
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                    {analysis.bestContentType}
                </p>
            </div>
          </div>

          {/* Chart Column */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-lg text-gray-900 mb-4">Attention Timeline</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analysis.attentionData}>
                  <defs>
                    <linearGradient id="colorSummary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="time" stroke="#9ca3af" tick={{ fontSize: 10 }} tickFormatter={(time) => time.split(':').slice(0, 2).join(':')} interval="preserveStartEnd" />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} tickFormatter={(val) => `${val}%`} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="attention" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorSummary)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 border-t border-gray-100">
          <Button onClick={onGoHome} variant="ghost" className="text-gray-500" icon={<Home size={18} />}>
            Home
          </Button>
          <Button onClick={onStartNew} variant="outline" icon={<RotateCcw size={18} />}>
            New Session
          </Button>
          <Button onClick={onTakeQuiz} className="px-8 shadow-xl shadow-orange-500/20" icon={<PlayCircle size={18} />}>
            Take Quiz
          </Button>
        </div>
      </div>
    </Card>
  );
};
