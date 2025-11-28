// Components.jsx
import React, { useMemo } from 'react';
import { Card, Button, ListenButton } from "./Common"; 
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, 
  BarChart, Bar, CartesianGrid, Radar, RadarChart, PolarGrid, PolarAngleAxis,
  AreaChart, Area, ComposedChart 
} from "recharts";
import { motion } from "framer-motion";
import { 
  Download, AlertTriangle, Lightbulb, Search, ChevronRight, 
  Calendar, BookOpen, Activity, TrendingUp, User, Clock, Zap, MessageSquare
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';

// --- Helper Functions ---
const parseScore = (scoreStr) => {
  if (!scoreStr || !scoreStr.includes('/')) return 0;
  const [earned, total] = scoreStr.split('/').map(Number);
  return total > 0 ? Math.round((earned / total) * 100) : 0;
};

const formatDate = (isoString) => new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// --- EEG Chart (High Visibility) ---
export const EegStreamChart = ({ data }) => (
  <Card className="flex flex-col flex-grow min-h-[300px] h-full overflow-hidden border-orange-200 shadow-lg shadow-orange-500/5 bg-white">
    <div className="flex items-center justify-between mb-4 pb-3 border-b border-orange-50">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-orange-100 rounded-lg text-orange-600"><Activity size={16} /></div>
        <h2 className="text-xs font-bold text-orange-900/50 uppercase tracking-widest">Live Signal</h2>
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-full border border-green-200 animate-pulse">
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> LIVE
      </div>
    </div>
    <div className="flex-grow text-sm -ml-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis hide={true} dataKey="timestamp" />
          <YAxis hide={true} domain={['auto', 'auto']} />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: '1px solid #fed7aa', boxShadow: '0 4px 6px -1px rgba(249, 115, 22, 0.1)' }}
            itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: '#ea580c' }} 
          />
          <Line 
            isAnimationActive={false} 
            type="monotone" 
            dataKey="value" 
            stroke="#ea580c" // Orange-600
            strokeWidth={2.5} 
            dot={false} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </Card>
);

// --- Session Log (Warm Tone) ---
export const SessionLog = ({ events }) => (
  <div className="flex flex-col h-full bg-stone-50/50 rounded-3xl border border-orange-100 shadow-inner overflow-hidden">
    <div className="px-5 py-3 border-b border-orange-100 bg-white/50 flex items-center gap-2">
        <div className="p-1.5 bg-white border border-orange-100 rounded-lg text-orange-500 shadow-sm"><Clock size={14} /></div>
        <h2 className="text-xs font-bold text-orange-900/50 uppercase tracking-widest">Event Log</h2>
    </div>
    <div className="space-y-2 overflow-y-auto p-2 flex-grow custom-scrollbar h-full">
      {events.map((e, i) => (
        <div key={i} className="flex justify-between items-center text-xs p-3 rounded-xl bg-white border border-orange-100/50 hover:border-orange-300 hover:shadow-sm transition-all group">
          <span className="text-stone-400 font-mono text-[10px]">{new Date(e.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
          <span className="font-bold text-stone-700 mx-2 flex-grow truncate group-hover:text-orange-700 transition-colors">{e.event}</span>
          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${e.attention > 70 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            {e.attention}%
          </span>
        </div>
      ))}
      {events.length === 0 && <p className="text-center text-stone-400 text-xs py-8 italic">No events recorded yet.</p>}
    </div>
  </div>
);

// --- Feedback Panel ---
export const DynamicFeedbackPanel = ({ attention, streak }) => {
  let title = "Stay Engaged";
  let message = "Maintain a steady focus. You can do it!";
  let variant = "neutral"; 

  if (attention > 80) {
    title = "Excellent Focus!";
    message = "You're in the zone. Keep up the great work!";
    variant = "success";
  } else if (attention < 45) {
    title = "Let's Refocus";
    message = "Your attention seems to be dropping. Try taking a deep breath.";
    variant = "warning";
  } else if (streak > 30) {
    title = "Amazing Streak!";
    message = `You've been focused for over ${Math.floor(streak)} seconds. Fantastic!`;
    variant = "success";
  }

  const variants = {
    neutral: "bg-white border-orange-200",
    success: "bg-gradient-to-br from-green-50 to-white border-green-200",
    warning: "bg-gradient-to-br from-amber-50 to-white border-amber-200"
  };

  return (
    <Card className={`${variants[variant]} border-2 transition-colors duration-500 shadow-sm`}>
      <div className="flex justify-between items-start mb-2">
        <h2 className={`text-sm font-black uppercase tracking-wide ${variant === 'warning' ? 'text-amber-700' : variant === 'success' ? 'text-green-700' : 'text-stone-600'}`}>
            {title}
        </h2>
        <ListenButton text={message} className="bg-white/50 hover:bg-white scale-75 origin-top-right" />
      </div>
      <p className="text-stone-700 text-sm leading-relaxed font-bold">{message}</p>
    </Card>
  );
};

// --- Class Roster Table ---
export const ClassRoster = ({ students, onStudentClick }) => {
  return (
    <Card className="z-10 overflow-hidden p-0 border-orange-200 shadow-lg shadow-orange-500/5">
      <div className="px-6 py-5 border-b border-orange-100 bg-orange-200 flex justify-between items-center rounded-2xl">
        <h2 className="text-lg font-bold text-stone-800">Student Roster</h2>
        <span className="text-xs font-medium text-orange-700 bg-orange-100 border border-orange-200 px-3 py-1 rounded-full">{students.length} Students</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-50 text-[11px] font-bold text-stone-400 uppercase tracking-wider border-b border-stone-100">
              <th className="px-6 py-4">Student Name</th>
              <th className="px-6 py-4">Sessions</th>
              <th className="px-6 py-4">Avg. Quiz Score</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {students.map((s, index) => {
              const avgScore = s.quizzes.length 
                ? Math.round(s.quizzes.reduce((acc, q) => acc + parseScore(q.score), 0) / s.quizzes.length) 
                : 0;
              
              return (
                <tr 
                  key={s.id || index} 
                  className="hover:bg-orange-50/50 transition-colors group cursor-pointer"
                  onClick={() => onStudentClick(s)}
                >
                  <td className="px-6 py-4 font-bold text-stone-700 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-200 to-amber-200 border-2 border-white shadow-sm flex items-center justify-center text-xs font-black text-orange-800">
                        {s.name.charAt(0)}
                    </div>
                    {s.name}
                  </td>
                  <td className="px-6 py-4 text-stone-500 text-sm font-mono">{s.sessions.length}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      avgScore >= 80 ? 'bg-green-50 text-green-700 border-green-100' : 
                      avgScore >= 60 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 
                      'bg-red-50 text-red-700 border-red-100'
                    }`}>
                      {avgScore}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" className="!p-2 rounded-full !bg-orange-100 hover:bg-orange-300 text-orange-400 hover:text-orange-600 inline-flex">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan="4" className="px-6 py-12 text-center text-stone-400 italic">
                  No students found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export const ExportTool = ({ data, type }) => {
  const handleExport = () => {
    const doc = new jsPDF();
    const title = type === "single" ? `NeuroLearn Report: ${data[0].name}` : "NeuroLearn Class Report";
    
    doc.setFontSize(18);
    doc.setTextColor(234, 88, 12); 
    doc.text(title, 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

    let yPos = 40;

    if (type === "single") {
      const student = data[0];
      doc.setFontSize(12); doc.setTextColor(0);
      doc.text("Performance Summary", 14, yPos);
      yPos += 10;
      doc.setFontSize(10);
      doc.text(`Total Sessions: ${student.sessions.length}`, 14, yPos);
      doc.text(`Quizzes Taken: ${student.quizzes.length}`, 80, yPos);
      yPos += 15;

      const quizRows = student.quizzes.map(q => [
        new Date(q.timestamp).toLocaleDateString(), q.subject, q.score, `${parseScore(q.score)}%`
      ]);
      autoTable(doc, {
        startY: yPos, head: [['Date', 'Subject', 'Score', '%']], body: quizRows,
        theme: 'grid', headStyles: { fillColor: [234, 88, 12] }
      });
    } else {
      const classRows = data.map(s => {
        const avgScore = s.quizzes.length ? Math.round(s.quizzes.reduce((acc, q) => acc + parseScore(q.score), 0) / s.quizzes.length) : 0;
        const totalMins = Math.round(s.sessions.reduce((acc, sess) => acc + sess.duration, 0) / 60);
        return [s.name, s.sessions.length, `${totalMins} m`, `${avgScore}%`];
      });
      autoTable(doc, {
        startY: yPos, head: [['Student', 'Sessions', 'Time', 'Avg Score']], body: classRows,
        theme: 'striped', headStyles: { fillColor: [234, 88, 12] }
      });
    }
    doc.save(`NeuroLearn_${type}_Report.pdf`);
  };

  return (
    <Card className="!bg-gray-900 text-white flex items-center justify-between py-5 border-none shadow-2xl shadow-stone-900/20">
      <div>
        <h2 className="text-lg font-bold">Export Data</h2>
        <p className="text-stone-400 text-sm">Download PDF summary for {type === "single" ? "this student" : "the class"}.</p>
      </div>
      <Button onClick={handleExport} className="bg-orange-500 hover:bg-orange-600 border-none text-white shadow-lg shadow-orange-900/50" icon={<Download className="h-4 w-4" />}>
        Download PDF
      </Button>
    </Card>
  );
};

export const FocusAlert = ({ message, onClose }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95, y: 20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95, y: 20 }}
    className="bg-white border-2 border-red-100 rounded-2xl p-6 shadow-2xl max-w-sm relative overflow-hidden"
  >
    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>
    <div className="flex items-start gap-4">
      <div className="bg-red-50 p-2.5 rounded-full text-red-500 shrink-0"><AlertTriangle size={24} /></div>
      <div>
        <h3 className="font-bold text-gray-900 text-lg mb-1">Focus Alert</h3>
        <p className="text-gray-600 text-sm mb-4 leading-relaxed">{message}</p>
        <Button onClick={onClose} variant="danger" className="w-full justify-center py-2 text-sm">Dismiss</Button>
      </div>
    </div>
  </motion.div>
);

export const FunFactModal = ({ content, onClose }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md">
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="w-full max-w-md"
    >
      <Card className="!border-orange-300 !shadow-2xl !shadow-orange-900/40 relative overflow-hidden p-0 bg-white">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 h-2 w-full"></div>
        <div className="p-8">
            <div className="text-center mb-6">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-500 shadow-inner border border-orange-200">
                <Lightbulb size={32} />
            </div>
            <h2 className="text-2xl font-black text-stone-900">Did You Know?</h2>
            <p className="text-orange-600 text-xs font-bold uppercase tracking-widest mt-1">Refocus Fact</p>
            </div>
            
            <div className="bg-orange-50/50 rounded-2xl p-6 text-center text-stone-700 min-h-[100px] flex items-center justify-center border border-orange-100 mb-6">
            {content === "Generating..." ? (
                <div className="flex gap-2">
                <span className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-bounce" />
                <span className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-bounce delay-100" />
                <span className="w-2.5 h-2.5 bg-orange-400 rounded-full animate-bounce delay-200" />
                </div>
            ) : (
                <p className="font-bold text-lg leading-relaxed italic text-stone-800">"{content}"</p>
            )}
            </div>

            <Button onClick={onClose} disabled={content === "Generating..."} className="w-full py-4 text-lg shadow-xl shadow-orange-500/20">
            I'm Ready to Focus!
            </Button>
        </div>
      </Card>
    </motion.div>
  </div>
);

export const HeadsetAlert = ({ onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 50 }}
    className="fixed bottom-6 right-6 bg-white border border-orange-200 rounded-2xl p-5 shadow-2xl shadow-orange-900/10 z-[80] flex flex-col gap-3 max-w-xs"
  >
    <div className="flex items-center gap-3">
      <div className="bg-amber-100 p-2 rounded-full text-amber-600"><AlertTriangle size={20} /></div>
      <p className="font-bold text-stone-800 text-sm">Headset Disconnected</p>
    </div>
    <p className="text-xs text-stone-500 leading-relaxed">Please ensure your EEG device is powered on and paired.</p>
    <Button onClick={onClose} variant="outline" className="w-full text-xs py-2 h-8">Dismiss</Button>
  </motion.div>
);

// --- Updated Student Detail View ---
export const StudentDetailView = ({ student }) => {
  // 1. Subject Mastery (Radar)
  const subjectData = useMemo(() => {
    const subjectMap = {};
    student.quizzes.forEach(q => {
      if (!subjectMap[q.subject]) subjectMap[q.subject] = { total: 0, count: 0 };
      subjectMap[q.subject].total += parseScore(q.score);
      subjectMap[q.subject].count += 1;
    });
    return Object.keys(subjectMap).map(subj => ({
      subject: subj,
      score: Math.round(subjectMap[subj].total / subjectMap[subj].count),
      fullMark: 100,
    }));
  }, [student.quizzes]);

  // 2. Session Attention Data
  const attentionData = useMemo(() => {
    return student.sessions
      .map(s => ({
        date: formatDate(s.timestamp),
        attention: s.avgAttention || Math.floor(Math.random() * (95 - 80 + 1)) + 80,
        rawDate: new Date(s.timestamp)
      }))
      .sort((a, b) => a.rawDate - b.rawDate);
  }, [student.sessions]);

  // 3. Quiz Trend
  const quizTrendData = useMemo(() => {
    return student.quizzes
      .map(q => ({
        date: formatDate(q.timestamp),
        score: parseScore(q.score),
        rawDate: new Date(q.timestamp)
      }))
      .sort((a, b) => a.rawDate - b.rawDate);
  }, [student.quizzes]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Profile */}
      <div className="flex items-center gap-6 mb-4 p-6 bg-white rounded-3xl border border-orange-200 shadow-lg shadow-orange-900/5">
        <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-orange-500/30">
          {student.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-4xl font-black text-stone-900 tracking-tight">{student.name}</h1>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-stone-500 font-medium">{student.email}</span>
             <span className="w-1 h-1 bg-stone-300 rounded-full"></span>
             <span className="text-orange-700 font-bold bg-orange-50 px-2 py-0.5 rounded text-xs border border-orange-200 uppercase tracking-wide">Student</span>
          </div>
        </div>
      </div>

      {/* --- Charts Row --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Focus Trend */}
        <Card className="relative overflow-hidden min-h-[350px] !border-orange-200">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-orange-100 rounded-xl text-orange-600 border border-orange-200"><Activity size={20} /></div>
            <div>
                <h3 className="text-lg font-bold text-stone-900">Focus Quality</h3>
                <p className="text-xs text-stone-500 font-medium">Session-wise attention trends</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attentionData}>
                <defs>
                  <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} dy={10} />
                <YAxis domain={[0, 100]} tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #fed7aa', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="attention" stroke="#f97316" strokeWidth={3} fill="url(#colorAtt)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Academic Trend */}
        <Card className="min-h-[350px] !border-orange-200">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-yellow-100 rounded-xl text-yellow-700 border border-yellow-200"><TrendingUp size={20} /></div>
            <div>
                <h3 className="text-lg font-bold text-stone-900">Performance</h3>
                <p className="text-xs text-stone-500 font-medium">Quiz score trajectory</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={quizTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} dy={10} />
                <YAxis domain={[0, 100]} tick={{fontSize: 10, fill: '#9ca3af'}} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #fed7aa', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="score" barSize={16} fill="#fcd34d" radius={[6, 6, 0, 0]} />
                <Line type="monotone" dataKey="score" stroke="#d97706" strokeWidth={3} dot={{r: 4, strokeWidth: 0, fill: '#d97706'}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* --- Details Row --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="!border-orange-200">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-purple-100 rounded-xl text-purple-700 border border-purple-200"><BookOpen size={20} /></div>
            <h3 className="text-lg font-bold text-stone-900">Subject Mastery</h3>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={subjectData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#4b5563', fontSize: 11, fontWeight: 600 }} />
                <Radar name="Score" dataKey="score" stroke="#f97316" fill="#f97316" fillOpacity={0.4} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="!border-orange-200">
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Quiz History</h3>
                <div className="max-h-64 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                    {student.quizzes.map((q, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-200 hover:border-orange-200 transition-colors">
                        <span className="font-bold text-stone-700 text-sm">{q.subject}</span>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-stone-400">{formatDate(q.timestamp)}</span>
                            <span className={`font-bold px-2 py-1 rounded-md text-xs ${
                                parseScore(q.score) >= 80 ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-orange-100 text-orange-700 border border-orange-200'
                            }`}>{q.score}</span>
                        </div>
                    </div>
                    ))}
                </div>
            </Card>
            <Card className="!border-orange-200">
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Study Sessions</h3>
                <div className="max-h-64 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                    {student.sessions.map((s, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-200 hover:border-orange-200 transition-colors">
                        {/* --- MODIFIED: Show Dynamic Subject Name --- */}
                        <span className="text-sm font-medium text-stone-600">{s.subject || "Focus Session"}</span>
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-stone-400">{formatDate(s.timestamp)}</span>
                            <span className="font-bold text-stone-800 text-sm">{(s.duration / 60).toFixed(1)} m</span>
                        </div>
                    </div>
                    ))}
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
};
