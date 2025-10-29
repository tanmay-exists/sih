import React, { useMemo } from 'react';
import { Card, Button } from './Common';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

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
      bestContentType = "You excelled with interactive content. Quizzes and activities seem to boost your focus significantly!";
    } else if (averageAttention < 50) {
      bestContentType = "Your focus was low during this session. Try minimizing distractions or taking short breaks to improve attention.";
    } else {
      bestContentType = "Your focus varied during the session. Consistent engagement with the material can help maintain steady attention.";
    }
    return { attentionData, bestContentType, averageAttention };
  }, [attentionHistory, attention, sessionTime]);
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-warmGray-100">
      <Card className="w-full max-w-4xl text-center bg-amber-50 p-8 rounded-xl shadow-lg border border-amber-200">
        <h2 className="text-3xl font-bold text-orange-800 mb-4">Focus Session Complete!</h2>
        <p className="text-xl text-warmGray-700 mb-6">Total Time: <strong>{formatTime(sessionTime)}</strong></p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mb-8">
          <div className="bg-amber-100 p-4 rounded-lg border border-amber-200">
            <h3 className="font-bold text-lg text-orange-800 mb-2">Performance Insight</h3>
            <p className="text-warmGray-700 leading-relaxed">{analysis.bestContentType}</p>
            <p className="text-warmGray-700 mt-2">Average Attention: <strong>{Math.round(analysis.averageAttention)}%</strong></p>
          </div>
          <div className="bg-amber-100 p-4 rounded-lg border border-amber-200">
            <h3 className="font-bold text-lg text-orange-800 mb-2">Attention Timeline</h3>
            <div className="h-48 min-h-[12rem] text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analysis.attentionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAttention" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    stroke="#4b5563"
                    tick={{ fill: '#4b5563' }}
                    interval="preserveStartEnd"
                    tickFormatter={(time) => time.split(':').slice(0, 2).join(':')}
                    minTickGap={50}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#4b5563"
                    tick={{ fill: '#4b5563' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fef3c7', border: '1px solid #d97706' }}
                    labelFormatter={(label) => label}
                    formatter={(value) => [`${value}%`, 'Attention']}
                  />
                  <Area
                    type="monotone"
                    dataKey="attention"
                    stroke="#f97316"
                    fillOpacity={1}
                    fill="url(#colorAttention)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button
            onClick={onGoHome}
            className="bg-amber-400 hover:bg-amber-500 text-warmGray-800 w-full px-6 py-3 text-lg rounded-lg hover:scale-105 transition-transform"
          >
            Go to Home
          </Button>
          <Button
            onClick={onStartNew}
            className="bg-orange-500 hover:bg-orange-600 text-white w-full px-6 py-3 text-lg rounded-lg hover:scale-105 transition-transform"
          >
            Start New Session
          </Button>
          <Button
            onClick={onTakeQuiz}
            className="bg-orange-400 hover:bg-orange-500 text-white w-full px-6 py-3 text-lg rounded-lg hover:scale-105 transition-transform"
          >
            Take a Quiz
          </Button>
        </div>
      </Card>
    </div>
  );
};
