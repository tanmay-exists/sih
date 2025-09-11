import React, { useMemo } from 'react';
import { Card, Button } from './Common';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export const SessionSummary = ({ sessionTime, sessionEvents, onGoHome, onStartNew, onTakeQuiz, attentionHistory, attention }) => {
  const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  const analysis = useMemo(() => {
    // Log attentionHistory for debugging
    console.log("SessionSummary: attentionHistory length:", attentionHistory.length, "data:", attentionHistory);

    // Use attentionHistory for average attention and graph
    const validHistory = attentionHistory.filter(e => typeof e.attention === 'number' && !isNaN(e.attention));
    
    // Calculate average attention from attentionHistory, fallback to current attention
    const averageAttention = validHistory.length > 0
      ? validHistory.reduce((sum, point) => sum + point.attention, 0) / validHistory.length
      : (typeof attention === 'number' && !isNaN(attention) ? Math.round(attention) : 0);

    // Prepare attentionData for the graph from attentionHistory
    // **FIX:** Removed .reverse() to show timeline in chronological order (start to end)
    let attentionData = validHistory.map(e => ({
      time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      attention: e.attention,
    }));

    // Ensure at least one data point for the graph
    if (attentionData.length === 0) {
      attentionData = [{
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        attention: 0,
      }];
    }

    console.log("SessionSummary: attentionData length:", attentionData.length, "data:", attentionData);

    // Determine insight based on average attention
    let bestContentType = "You maintained a consistent and balanced focus. Well done!";
    if (averageAttention > 70) {
      bestContentType = "You excelled with interactive content. Quizzes and activities seem to boost your focus significantly!";
    } else if (averageAttention < 50) {
      bestContentType = "Your focus was low during this session. Try minimizing distractions or taking short breaks to improve attention.";
    } else {
      bestContentType = "Your focus varied during the session. Consistent engagement with the material can help maintain steady attention.";
    }

    return { attentionData, bestContentType, averageAttention };
  }, [attentionHistory, attention]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-theme-bg">
      <img
                        src="https://png.pngtree.com/thumb_back/fw800/background/20240104/pngtree-trendy-doodle-texture-flat-vector-illustration-of-hand-drawn-abstract-shapes-image_13915914.png"
                        alt="Ready to Begin background"
                        className="absolute inset-0 w-full h-full opacity-5 object-cover opacity-30 pointer-events-none"
                    />
      <Card className="w-full max-w-4xl text-center z-20">
        <h2 className="text-3xl font-bold text-theme-primary mb-4">Focus Session Complete!</h2>
        <p className="text-xl text-theme-text/80 mb-6">Total Time: <strong>{formatTime(sessionTime)}</strong></p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mb-8">
          <div className="bg-theme-surface/50 p-4 rounded-lg border border-theme-border">
            <h3 className="font-bold text-lg text-theme-primary mb-2">Performance Insight</h3>
            <p className="text-theme-text/90 leading-relaxed">{analysis.bestContentType}</p>
            <p className="text-theme-text/90 mt-2">Average Attention: <strong>{Math.round(analysis.averageAttention)}%</strong></p>
          </div>
          <div className="bg-theme-surface/50 p-4 rounded-lg border border-theme-border">
            <h3 className="font-bold text-lg text-theme-primary mb-2">Attention Timeline</h3>
            <div className="h-48 text-xs"> {/* Increased height for better visibility */}
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analysis.attentionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAttention" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="time" 
                    stroke="var(--color-text)" 
                    tick={{ fill: 'var(--color-text)' }} 
                    interval="preserveStartEnd" 
                    tickFormatter={(time) => time.split(':').slice(0, 2).join(':')} // Show HH:MM
                    minTickGap={50} // Prevent overcrowding
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    stroke="var(--color-text)" 
                    tick={{ fill: 'var(--color-text)' }} 
                    tickFormatter={(value) => `${value}%`} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }} 
                    labelFormatter={(label) => label} 
                    formatter={(value) => [`${value}%`, 'Attention']} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="attention" 
                    stroke="var(--color-primary)" 
                    fillOpacity={1} 
                    fill="url(#colorAttention)" 
                    strokeWidth={2} 
                    dot={false} // Remove dots for smoother line
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button onClick={onGoHome} className="bg-theme-secondary/80 hover:bg-theme-secondary w-full !text-theme-text">
            Go to Home
          </Button>
          <Button onClick={onStartNew} className="bg-theme-primary hover:bg-theme-primary/90 w-full">
            Start New Session
          </Button>
          <Button onClick={onTakeQuiz} className="bg-theme-accent hover:bg-theme-accent/90 w-full">
            Take a Quiz
          </Button>
        </div>
      </Card>
    </div>
  );
};
