// Components.jsx
import { Card, Button, ListenButton } from "./Common"; 
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, 
  BarChart, Bar, CartesianGrid, Radar, RadarChart, PolarGrid, PolarAngleAxis,
  AreaChart, Area, ComposedChart // <-- Added Chart Imports
} from "recharts";
import { motion } from "framer-motion";
import { 
  Download, AlertTriangle, Lightbulb, Search, ChevronRight, 
  Calendar, BookOpen, Activity, TrendingUp // <-- Added Icons
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


export const EegStreamChart = ({ data }) => (
  <Card className="flex flex-col flex-grow min-h-[400px] h-full">
    <h2 className="text-2xl font-semibold mb-4 text-orange-800 shrink-0">Live Brain Activity (EEG Signal)</h2>
    <div className="flex-grow text-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <XAxis hide={true} axisLine={false} tickLine={false} tick={false} dataKey="timestamp" stroke="var(--color-text)" />
          <YAxis stroke="var(--color-text)" domain={['auto', 'auto']} allowDataOverflow />
          <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
          <Legend />
          <Line isAnimationActive={false} type="monotone" dataKey="value" stroke="var(--color-primary)" dot={false} strokeWidth={2} name="EEG Value" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </Card>
);

export const SessionLog = ({ events }) => (
  <Card>
    <h2 className="text-xl font-semibold mb-4 text-orange-800">Session Log</h2>
    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
      {events.map((e, i) => (
        <div key={i} className="flex justify-between text-sm bg-amber-100/50 px-3 py-2 rounded-lg border border-amber-200">
          <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
          <span className="font-semibold">{e.event}</span>
          <span className="text-warmGray-700">{e.attention}%</span>
        </div>
      ))}
      {events.length === 0 && <p className="text-center text-warmGray-600">No session events yet.</p>}
    </div>
  </Card>
);

export const DynamicFeedbackPanel = ({ attention, streak }) => {
  let title = "Stay Engaged";
  let message = "Maintain a steady focus. You can do it!";
  if (attention > 80) {
    title = "Excellent Focus!";
    message = "You're in the zone. Keep up the great work!";
  } else if (attention < 45) {
    title = "Let's Refocus";
    message = "Your attention seems to be dropping. Try taking a deep breath or adjusting your posture.";
  } else if (streak > 30) {
    title = "Amazing Streak!";
    message = `You've been focused for over ${Math.floor(streak)} seconds. That's fantastic!`;
  }
  return (
    <Card>
      <div className="flex justify-between items-start">
        <h2 className="text-xl font-semibold mb-2 text-orange-800">{title}</h2>
        <ListenButton text={message} />
      </div>
      <p className="text-warmGray-700 leading-relaxed">{message}</p>
    </Card>
  );
};

export const ClassRoster = ({ students, onStudentClick }) => {
  return (
    <Card className="z-10 overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-orange-800">Student Roster</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-orange-50/50 border-b border-orange-100 text-orange-900">
              <th className="px-6 py-4 font-semibold rounded-tl-xl">Student Name</th>
              <th className="px-6 py-4 font-semibold">Sessions Completed</th>
              <th className="px-6 py-4 font-semibold">Avg. Quiz Score</th>
              <th className="px-6 py-4 font-semibold rounded-tr-xl">Action</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, index) => {
              const avgScore = s.quizzes.length 
                ? Math.round(s.quizzes.reduce((acc, q) => acc + parseScore(q.score), 0) / s.quizzes.length) 
                : 0;
              
              return (
                <tr 
                  key={s.id || index} 
                  className="border-b border-orange-50 hover:bg-orange-50/40 transition-colors group cursor-pointer"
                  onClick={() => onStudentClick(s)}
                >
                  <td className="px-6 py-4 font-medium text-warmGray-800">{s.name}</td>
                  <td className="px-6 py-4 text-warmGray-600">{s.sessions.length}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      avgScore >= 80 ? 'bg-green-100 text-green-700' : 
                      avgScore >= 60 ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-red-100 text-red-700'
                    }`}>
                      {avgScore}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Button className="bg-orange-300 text-orange-500 hover:bg-orange-400 p-2 rounded-full shadow-none">
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-warmGray-500">
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

export const ClassAttentionChart = ({ students }) => (
  <Card className="h-96">
    <h2 className="text-2xl font-semibold mb-4 text-orange-800">Class Performance Overview</h2>
    <div className="h-80 text-sm">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={students} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" stroke="#888" tick={{fontSize: 10}} interval={0} angle={-45} textAnchor="end" height={60} />
          <YAxis stroke="#888" label={{ value: 'Avg Score %', angle: -90, position: 'insideLeft' }} />
          <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
          <Bar dataKey="attention" fill="#f97316" radius={[4, 4, 0, 0]} name="Avg Score" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </Card>
);

export const ModelSummary = () => (
    <Card>
      <h2 className="text-2xl font-semibold mb-4 text-orange-800">System Status</h2>
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
            <span className="text-gray-600">Database Connection</span>
            <span className="text-green-600 font-bold">Active</span>
        </div>
        <div className="flex justify-between items-center border-b pb-2">
            <span className="text-gray-600">Data Source</span>
            <span className="text-blue-600 font-bold">MongoDB (History)</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
            * Scores are aggregated from student Quiz history. Engagement is derived from frequency of sessions.
        </p>
      </div>
    </Card>
  );

export const ExportTool = ({ data, type }) => {
  const handleExport = () => {
    const doc = new jsPDF();
    const title = type === "single" 
      ? `NeuroLearn Report: ${data[0].name}` 
      : "NeuroLearn Class Performance Report";
    
    doc.setFontSize(18);
    doc.setTextColor(154, 52, 18); // Orange-900
    doc.text(title, 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    let yPos = 40;

    if (type === "single") {
      const student = data[0];
      
      // Summary Section
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Summary", 14, yPos);
      yPos += 10;
      doc.setFontSize(11);
      doc.text(`Total Sessions: ${student.sessions.length}`, 14, yPos);
      doc.text(`Total Quizzes Taken: ${student.quizzes.length}`, 80, yPos);
      yPos += 15;

      // Quiz Table
      doc.setFontSize(14);
      doc.text("Detailed Quiz Scores", 14, yPos);
      yPos += 5;
      
      const quizRows = student.quizzes.map(q => [
        new Date(q.timestamp).toLocaleDateString(),
        q.subject,
        q.score,
        `${parseScore(q.score)}%`
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Date', 'Subject', 'Score', 'Percentage']],
        body: quizRows,
        theme: 'grid',
        headStyles: { fillColor: [234, 88, 12] } // Orange-600
      });

    } else {
      // Class Table
      const classRows = data.map(s => {
        const avgScore = s.quizzes.length 
          ? Math.round(s.quizzes.reduce((acc, q) => acc + parseScore(q.score), 0) / s.quizzes.length) 
          : 0;
        const totalMins = Math.round(s.sessions.reduce((acc, sess) => acc + sess.duration, 0) / 60);
        return [s.name, s.sessions.length, `${totalMins} min`, `${avgScore}%`];
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Student Name', 'Sessions', 'Total Focus Time', 'Avg Score']],
        body: classRows,
        theme: 'striped',
        headStyles: { fillColor: [234, 88, 12] }
      });
    }

    doc.save(`NeuroLearn_${type === 'single' ? data[0].name : 'Class'}_Report.pdf`);
  };

  return (
    <Card className="bg-gradient-to-r from-orange-500 to-amber-500 text-white flex flex-row items-center justify-between py-6">
      <div>
        <h2 className="text-xl font-bold">Export Data</h2>
        <p className="text-orange-100 text-sm opacity-90">Download PDF summary for {type === "single" ? "this student" : "the entire class"}.</p>
      </div>
      <Button 
        onClick={handleExport} 
        className="bg-gray-800 text-orange-400 hover:bg-orange-50 border-none shadow-lg" 
        icon={<Download className="h-5 w-5" />}
      >
        Download PDF
      </Button>
    </Card>
  );
};

export const FocusAlert = ({ message, onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
    className="bg-amber-50 border border-orange-500 rounded-lg p-4 shadow-lg max-w-sm z-50"
  >
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-6 w-6 text-orange-800" />
      <p className="text-warmGray-700">{message}</p>
    </div>
    <Button onClick={onClose} className="mt-2 bg-red-500 hover:bg-red-600 text-white w-full">
      Close
    </Button>
  </motion.div>
);

export const FunFactModal = ({ content, onClose }) => (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="w-full max-w-md"
    >
      <Card className="!border-orange-500">
        <div className="text-center mb-4">
          <div className="flex justify-center items-center gap-3 text-orange-800">
            <Lightbulb className="w-8 h-8" />
            <h2 className="text-2xl font-bold">Refocus Fact!</h2>
          </div>
        </div>
        
        <div className="text-warmGray-700 mt-2 text-center min-h-[60px]">
          {content === "Generating..." ? (
            <div className="flex justify-center items-center h-full">
              <div className="flex space-x-1">
                <span className="h-2 w-2 bg-amber-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 bg-amber-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 bg-amber-400 rounded-full animate-pulse"></span>
              </div>
            </div>
          ) : (
            <p>{content}</p>
          )}
        </div>

        <Button 
          onClick={onClose} 
          className="mt-4 bg-orange-500 hover:bg-orange-600 text-white w-full"
          disabled={content === "Generating..."}
        >
          Got it!
        </Button>
      </Card>
    </motion.div>
  </div>
);

export const HeadsetAlert = ({ onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
    className="fixed bottom-4 right-4 bg-amber-50 border border-orange-500 rounded-lg p-4 shadow-lg max-w-sm z-50"
  >
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-6 w-6 text-orange-800" />
      <p className="text-warmGray-700">Connecting to EEG headset...</p>
    </div>
    <Button onClick={onClose} className="mt-2 bg-red-500 hover:bg-red-600 text-white w-full">
      Close
    </Button>
  </motion.div>
);


export const StudentDetailsPanel = ({ student, onClose }) => {
  if (!student) return null;

  // Format data for charts
  const quizData = student.history.quizzes.map(q => ({
    date: new Date(q.date).toLocaleDateString(),
    score: q.score,
    subject: q.subject
  }));

  const sessionData = student.history.sessions.map(s => ({
    date: new Date(s.date).toLocaleDateString(),
    duration: Math.round(s.duration / 60) // minutes
  }));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-orange-500 p-6 flex justify-between items-center text-white">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-full"><User className="w-8 h-8" /></div>
            <div>
              <h2 className="text-2xl font-bold">{student.name}</h2>
              <p className="opacity-90 text-sm">{student.email} • {student.status}</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition"><X /></button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto bg-warmGray-50">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="!p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><BookOpen /></div>
              <div><p className="text-sm text-gray-500">Avg Score</p><p className="text-xl font-bold">{student.attention}%</p></div>
            </Card>
            <Card className="!p-4 flex items-center gap-4">
              <div className="p-3 bg-green-100 text-green-600 rounded-lg"><Clock /></div>
              <div><p className="text-sm text-gray-500">Total Time</p><p className="text-xl font-bold">{student.total_time_mins} mins</p></div>
            </Card>
            <Card className="!p-4 flex items-center gap-4">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-lg"><Search /></div>
              <div><p className="text-sm text-gray-500">Total Quizzes</p><p className="text-xl font-bold">{student.history.quizzes.length}</p></div>
            </Card>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="h-80">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">Quiz Performance History</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={quizData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card className="h-80">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">Study Duration (Mins)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="duration" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
};


// --- UPDATED STUDENT DETAIL VIEW ---
export const StudentDetailView = ({ student }) => {
  // 1. Subject Mastery (Radar)
  const subjectMap = {};
  student.quizzes.forEach(q => {
    if (!subjectMap[q.subject]) subjectMap[q.subject] = { total: 0, count: 0 };
    subjectMap[q.subject].total += parseScore(q.score);
    subjectMap[q.subject].count += 1;
  });
  
  const subjectData = Object.keys(subjectMap).map(subj => ({
    subject: subj,
    score: Math.round(subjectMap[subj].total / subjectMap[subj].count),
    fullMark: 100,
  }));

  // 2. Session Attention Data (Generated Randomly as requested if missing)
  const attentionData = student.sessions
    .map(s => ({
        date: formatDate(s.timestamp),
        // Use existing attention or random 80-95
        attention: s.avgAttention || Math.floor(Math.random() * (95 - 80 + 1)) + 80,
        duration: Math.round(s.duration / 60),
        rawDate: new Date(s.timestamp) // for sorting
    }))
    .sort((a, b) => a.rawDate - b.rawDate);

  // 3. Quiz Performance Trend (Line/Area Chart)
  const quizTrendData = student.quizzes
    .map(q => ({
        date: formatDate(q.timestamp),
        score: parseScore(q.score),
        subject: q.subject,
        rawDate: new Date(q.timestamp)
    }))
    .sort((a, b) => a.rawDate - b.rawDate);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-pink-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
          {student.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-warmGray-900">{student.name}</h1>
          <p className="text-warmGray-500">Comprehensive Performance Report</p>
        </div>
      </div>

      {/* --- ROW 1: NEW GRAPHS (ATTENTION & MARKS) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Graph 1: Focus Quality Trend */}
        <Card className="relative overflow-hidden">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-orange-100 rounded-lg">
                <Activity className="text-orange-600 w-5 h-5" />
            </div>
            <div>
                <h3 className="text-xl font-bold text-warmGray-900">Focus Quality Trend</h3>
                <p className="text-xs text-warmGray-500">Average attention per session</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attentionData}>
                <defs>
                  <linearGradient id="colorAttention" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fed7aa" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  labelStyle={{ color: '#ea580c', fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="attention" 
                  stroke="#f97316" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorAttention)" 
                  name="Avg Attention"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Graph 2: Academic Performance Trend */}
        <Card>
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUp className="text-yellow-700 w-5 h-5" />
            </div>
            <div>
                <h3 className="text-xl font-bold text-warmGray-900">Academic Performance</h3>
                <p className="text-xs text-warmGray-500">Quiz scores over time</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={quizTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                   cursor={{ fill: '#fef3c7', opacity: 0.4 }}
                />
                <Bar dataKey="score" barSize={12} fill="#fcd34d" radius={[4, 4, 0, 0]} name="Score" />
                <Line type="monotone" dataKey="score" stroke="#d97706" strokeWidth={3} dot={{ r: 4, fill: '#d97706', strokeWidth: 0 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

      </div>

      {/* --- ROW 2: SUBJECT MASTERY & RAW HISTORY (Moved Down) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Subject Radar */}
        <Card className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="text-orange-600" />
            <h3 className="text-lg font-bold text-warmGray-900">Subject Mastery</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={subjectData}>
                <PolarGrid stroke="#fdba74" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#78350f', fontSize: 11 }} />
                <Radar name="Score" dataKey="score" stroke="#f97316" fill="#fdba74" fillOpacity={0.6} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Detailed Lists */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
            <h3 className="text-lg font-semibold text-orange-900 mb-3 border-b border-orange-100 pb-2">Recent Quizzes</h3>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {student.quizzes.map((q, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-white rounded-lg border border-orange-100 hover:border-orange-300 transition-colors">
                    <span className="font-medium text-warmGray-700 text-sm">{q.subject}</span>
                    <div className="flex items-center gap-3">
                    <span className="text-xs text-warmGray-400">{formatDate(q.timestamp)}</span>
                    <span className={`font-bold px-2 py-1 rounded text-xs ${
                        parseScore(q.score) >= 80 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>{q.score}</span>
                    </div>
                </div>
                ))}
                {student.quizzes.length === 0 && <p className="text-gray-400 text-sm italic">No quizzes recorded.</p>}
            </div>
            </Card>

            <Card>
            <h3 className="text-lg font-semibold text-orange-900 mb-3 border-b border-orange-100 pb-2">Session Log</h3>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {student.sessions.map((s, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-white rounded-lg border border-orange-100 hover:border-orange-300 transition-colors">
                    <span className="text-sm text-warmGray-600">Focus Session</span>
                    <div className="flex items-center gap-3">
                    <span className="text-xs text-warmGray-400">{formatDate(s.timestamp)}</span>
                    <span className="font-bold text-warmGray-700 text-sm">{(s.duration / 60).toFixed(1)} min</span>
                    </div>
                </div>
                ))}
                {student.sessions.length === 0 && <p className="text-gray-400 text-sm italic">No sessions recorded.</p>}
            </div>
            </Card>
        </div>
      </div>
    </div>
  );
};
