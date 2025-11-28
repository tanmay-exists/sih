// DashboardLayouts.jsx
import React, { useState } from "react";
import { Card, Button, Header } from "./Common";
import { SessionSummary } from "./SessionSummary";
import { AnimatePresence, motion } from "framer-motion";
import { HeadsetAlert } from "./Components";
import { History, Clock, BookOpen, ChevronRight, ArrowLeft, PlayCircle, Trophy, Calendar } from "lucide-react";

// --- Background Component ---
const DashboardBackground = () => (
  <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-gradient-to-br from-amber-100 via-yellow-300 to-orange-400 opacity-30">
    <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-orange-300/20 rounded-full blur-[100px]" />
    <div className="absolute bottom-[10%] left-[-10%] w-[30rem] h-[30rem] bg-amber-200/30 rounded-full blur-[80px]" />
    <div className="absolute top-[40%] left-[20%] w-[20rem] h-[20rem] bg-yellow-200/20 rounded-full blur-[60px]" />
  </div>
);

// Helper to format time
const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
const formatDateTime = (timestamp) => {
  const d = new Date(timestamp);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;
};

// --- Internal Component for History Tabs in IdleLayout ---
const HistoryTabs = ({ history }) => {
  const [activeTab, setActiveTab] = useState("quizzes"); // 'quizzes' or 'sessions'

  const sortedRecentQuizzes = history.recent_quizzes.slice(-10);
  const sortedRecentSessions = history.recent_sessions.slice(-10);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-6 mt-2 px-2">
        <div className="p-2 bg-orange-100 rounded-xl text-orange-600">
            <History size={20} />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Recent Activity</h3>
      </div>

      {/* Tabs - Styled as segmented control */}
      <div className="flex p-1 bg-orange-100/50 rounded-xl mb-4">
        {['quizzes', 'sessions'].map((tab) => (
            <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-300 capitalize ${
                    activeTab === tab 
                    ? 'bg-white text-orange-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                }`}
            >
                {tab}
            </button>
        ))}
      </div>

      {/* History List with Scroll - Fixed Height */}
      <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-3 h-[400px]">
        {activeTab === "quizzes" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {sortedRecentQuizzes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <Trophy size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No quizzes taken yet.</p>
              </div>
            ) : (
              sortedRecentQuizzes.map((q, i) => (
                <div key={i} className="group flex justify-between items-center p-4 bg-yellow-100 border border-orange-200 rounded-2xl hover:bg-yellow-200 hover:border-orange-200 hover:shadow-md transition-all">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800">{q.subject}</span>
                    <span className="text-xs text-gray-700 flex items-center gap-1">
                        <Calendar size={10} /> {formatDateTime(q.timestamp)}
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-orange-50 text-orange-700 font-bold rounded-lg text-sm group-hover:bg-orange-100 transition-colors">
                    {q.score}
                  </span>
                </div>
              ))
            )}
          </motion.div>
        )}

        {activeTab === "sessions" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {sortedRecentSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <Clock size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No sessions recorded yet.</p>
              </div>
            ) : (
              sortedRecentSessions.map((s, i) => (
                <div key={i} className="group flex justify-between items-center p-4 bg-yellow-100 border border-orange-200 rounded-2xl hover:bg-yellow-200 hover:border-orange-200 hover:shadow-md transition-all">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800">{s.subject || "General Study"}</span>
                    <span className="text-xs text-gray-700 flex items-center gap-1">
                        <Calendar size={10} /> {formatDateTime(s.timestamp)}
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-green-50 text-green-700 font-bold rounded-lg text-sm flex items-center gap-1">
                    <Clock size={12} /> {formatTime(s.duration)}
                  </span>
                </div>
              ))
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

// --- Idle State Layout ---
export const IdleLayout = ({ onLogout, accessibility, errorMessage, subjects, history, setSessionState, setShowHeadsetAlert, showHeadsetAlert, username }) => (
  <>
    <DashboardBackground />
    <Header
      user={username}
      role="Learner"
      onLogout={onLogout}
      accessibility={accessibility}
    />
    <div className="min-h-screen flex items-center justify-center pt-20 px-4 md:px-8 relative z-10">
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Welcome Card */}
        <div className="lg:col-span-7 flex flex-col justify-center">
            <Card className="p-8 md:p-12 border-orange-100 bg-white/80 backdrop-blur-xl shadow-2xl shadow-orange-100">
                <div className="mb-6 inline-flex p-3 bg-orange-100 rounded-2xl text-orange-600 shadow-sm">
                    <BookOpen size={32} />
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
                    Ready to <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500">Focus?</span>
                </h2>
                <p className="text-lg text-gray-600 mb-8 leading-relaxed max-w-lg">
                    Start a neuro-adaptive study session to track your attention and optimize your learning in real-time.
                </p>
                
                {errorMessage && (
                    <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-medium">
                        {errorMessage}
                    </div>
                )}
                
                {subjects.length === 0 && !errorMessage && (
                    <p className="text-gray-500 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        No curriculum found. Please contact your administrator.
                    </p>
                )}

                <Button
                    onClick={() => setSessionState("selecting-subject")}
                    className="w-full sm:w-auto h-14 px-8 text-lg rounded-xl shadow-xl shadow-orange-500/20 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                    disabled={subjects.length === 0}
                    icon={<PlayCircle size={20} />}
                >
                    Start New Session
                </Button>
            </Card>
        </div>

        {/* History Card */}
        <div className="lg:col-span-5 h-full">
            <Card className="h-full bg-white/60 backdrop-blur-md border-orange-50 shadow-xl shadow-orange-500/5">
                <HistoryTabs history={history} />
            </Card>
        </div>
      </div>
      
      <AnimatePresence>
        {showHeadsetAlert && <HeadsetAlert onClose={() => setShowHeadsetAlert(false)} />}
      </AnimatePresence>
    </div>
  </>
);

// --- Selecting Subject Layout ---
export const SelectingSubjectLayout = ({ onLogout, accessibility, errorMessage, subjects, setSelectedSubjectName, setSessionState, restartSession, username }) => (
  <div className="min-h-screen pt-28 pb-12 relative">
    <DashboardBackground />
    <Header
      user={username}
      role="Learner"
      onLogout={onLogout}
      accessibility={accessibility}
    />
    <main className="container mx-auto px-4 md:px-8 max-w-5xl relative z-10">
      
      <div className="mb-8">
        <button 
            onClick={restartSession}
            className="group flex items-center gap-4 text-gray-600 hover:text-orange-600 transition-colors mb-4"
        >
            <div className="p-2 bg-white/80 rounded-full shadow-sm group-hover:shadow-md transition-all">
                <ArrowLeft size={20} />
            </div>
            <span className="font-bold text-md">Back to Home</span>
        </button>
        <h2 className="text-3xl font-extrabold text-gray-900">Select a Subject</h2>
        <p className="text-gray-500 mt-2">Choose what you want to master today.</p>
      </div>

      {errorMessage && (
         <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm font-medium">
            {errorMessage}
         </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {subjects.map((s) => (
          <motion.button
            key={s.subject}
            whileHover={{ y: -4, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setSelectedSubjectName(s.subject);
              setSessionState("selecting-lesson");
            }}
            className="group relative bg-white/80 backdrop-blur-sm border border-orange-100 rounded-3xl p-8 shadow-xl shadow-gray-200/20 hover:shadow-orange-500/10 hover:border-orange-200 text-left transition-all duration-300"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity text-orange-900">
                <BookOpen size={64} />
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center text-orange-600 mb-6 group-hover:scale-110 transition-transform duration-300 shadow-inner">
               <span className="font-bold text-lg">{s.subject.charAt(0)}</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-1">{s.subject}</h3>
            <p className="text-sm text-gray-500">{s.lessons.length} Lessons Available</p>
            
            <div className="mt-6 flex items-center text-orange-600 font-bold text-sm group-hover:translate-x-2 transition-transform">
                View Lessons <ChevronRight size={16} className="ml-1" />
            </div>
          </motion.button>
        ))}
      </div>
    </main>
  </div>
);

// --- Selecting Lesson Layout ---
export const SelectingLessonLayout = ({ onLogout, accessibility, selectedSubject, selectedSubjectName, startStudySession, setSessionState, username }) => (
  <div className="min-h-screen pt-28 pb-12 relative">
    <DashboardBackground />
    <Header
      user={username}
      role="Learner"
      onLogout={onLogout}
      accessibility={accessibility}
    />
    <main className="container mx-auto px-4 md:px-8 max-w-4xl relative z-10">
      
      <div className="mb-8">
        <button 
            onClick={() => setSessionState("selecting-subject")}
            className="group flex items-center gap-4 text-gray-600 hover:text-orange-600 transition-colors mb-4"
        >
            <div className="p-2 bg-white/80 rounded-full shadow-sm group-hover:shadow-md transition-all">
                <ArrowLeft size={20} />
            </div>
            <span className="font-bold text-md">Back to Subjects</span>
        </button>
        <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-xl text-orange-600">
                <BookOpen size={24} />
            </div>
            <div>
                <h2 className="text-3xl font-extrabold text-gray-900">{selectedSubjectName}</h2>
                <p className="text-gray-500 text-sm">Select a lesson to begin your session.</p>
            </div>
        </div>
      </div>

      <Card className="bg-white/60 backdrop-blur-md border-orange-100 p-2 shadow-2xl shadow-orange-500/5">
        <div className="space-y-2">
          {selectedSubject && selectedSubject.lessons.length > 0 ? (
            selectedSubject.lessons.map((lesson, index) => (
              <motion.button
                key={lesson.lessonId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => startStudySession(lesson)}
                className="w-full flex items-center justify-between p-5 bg-white border border-gray-200 rounded-2xl hover:border-orange-200 hover:bg-orange-50/30 hover:shadow-lg hover:shadow-orange-500/5 transition-all group text-left"
              >
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold text-sm group-hover:bg-orange-500 group-hover:text-white transition-colors">
                        {index + 1}
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800 text-lg group-hover:text-orange-600 transition-colors">
                            {lesson.lessonTitle}
                        </h4>
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mt-0.5">
                            Video & Article
                        </p>
                    </div>
                </div>
                <div className="p-2 bg-gray-50 rounded-full text-gray-400 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                    <PlayCircle size={20} />
                </div>
              </motion.button>
            ))
          ) : (
            <div className="text-center py-12 text-gray-400">
                <p>No lessons available for this subject yet.</p>
            </div>
          )}
        </div>
      </Card>
    </main>
  </div>
);

// --- Finished State Layout ---
export const FinishedLayout = ({ onLogout, accessibility, sessionTime, sessionEvents, restartSession, setSessionState, selectedSubjectName, attentionHistory, attention, username }) => (
  <>
    <DashboardBackground />
    <Header
      user={username}
      role="Learner"
      onLogout={onLogout}
      accessibility={accessibility}
    />
    <div className="min-h-screen flex items-center justify-center pt-28 pb-12 relative z-10">
      <div className="container mx-auto px-4 md:px-8">
        <SessionSummary
          sessionTime={sessionTime}
          sessionEvents={sessionEvents}
          onGoHome={restartSession}
          onStartNew={() => setSessionState("selecting-subject")}
          onTakeQuiz={() => {
            setSessionState("quiz"); 
          }}
          attentionHistory={attentionHistory}
          attention={attention}
        />
      </div>
    </div>
  </>
);
