// ActiveSession.jsx
import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, MetricCard, ListenButton } from "./Common";
import { 
  Clock, Zap, Target, Eye, MessageSquare, StopCircle, 
  ArrowRight, PlayCircle, BookOpen, Activity, Sparkles, Brain
} from "lucide-react";

// Import Components
import { EegStreamChart, SessionLog, DynamicFeedbackPanel, FocusAlert, FunFactModal } from "./Components";
import { StudyContent } from "./StudyContent";
import { RefocusQuizModal } from "./RefocusQuizModal";
import { MarkdownRenderer } from "./MarkdownRenderer"; 

// --- Helpers & Variants ---
const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
};

const tabs = [
  { id: "video", label: "Video Lesson" },
  { id: "article", label: "Reading Material" },
];

// --- Main Component ---
export const ActiveSession = ({
  sessionState, studyLesson, studyContentType, setStudyContentType,
  sessionTime, attention, focusStreak, endSession,
  summary, mcqs,
  showRefocusQuiz, showFocusAlert, handleRefocusQuizFinish,
  onCloseFocusAlert, 
  showFunFact, funFactContent, onCloseFunFact,
  selectedSubjectName,
  eegData, sessionEvents,
  chatHistory, chatQuery, setChatQuery, isChatLoading, handleChat,
  playerIframeRef,
  gazeStatus 
}) => {
  const displayAttention = attention !== null ? attention.toFixed(0) : "--";
  const chatHistoryRef = useRef(null);

  // Scroll to bottom of chat
  React.useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const onTabClick = (id) => {
    if (id !== studyContentType) setStudyContentType(id);
  };

  return (
    // --- LAYOUT UPDATE: Fixed Height Screen with Internal Scroll ---
    <div className="h-screen bg-stone-50 overflow-hidden flex flex-col relative selection:bg-orange-200">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-amber-200 via-yellow-100 to-orange-100 opacity-80" />
          <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-orange-300/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-[10%] left-[-10%] w-[30rem] h-[30rem] bg-amber-200/20 rounded-full blur-[80px]" />
      </div>

      {/* --- Overlays (Z-Index High) --- */}
      <AnimatePresence>
        {showRefocusQuiz && (
          <RefocusQuizModal
            subject={selectedSubjectName || "General Knowledge"}
            attention={attention || 50}
            onFinish={handleRefocusQuizFinish}
          />
        )}
        {showFocusAlert && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4">
            <FocusAlert message={showFocusAlert} onClose={onCloseFocusAlert} />
          </div>
        )}
        {showFunFact && (
          <FunFactModal
            content={funFactContent}
            onClose={onCloseFunFact}
          />
        )}
      </AnimatePresence>

      {/* --- SCROLLABLE CONTAINER --- */}
      <main className="mt-24 h-[calc(100vh-6rem)] overflow-y-auto pb-12 px-4 md:px-6 relative z-10 custom-scrollbar">
        <div className="container mx-auto">
        
        {/* =========================================================
            ROW 1: METRICS
           ========================================================= */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 mb-8 pt-4">
          <MetricCard 
            title="Session Time" 
            value={formatTime(sessionTime)} 
            icon={<Clock className="text-orange-500" />} 
          />
          <MetricCard 
            title="Attention" 
            value={displayAttention} 
            unit="%" 
            icon={<Zap className="text-orange-500" />} 
            className={attention < 50 && attention !== null ? "ring-2 ring-red-200 bg-red-50/50" : ""}
          />
          <MetricCard 
            title="Focus Streak" 
            value={focusStreak.toFixed(0)} 
            unit="s" 
            icon={<Target className="text-orange-500" />} 
          />
          
          {/* UPDATED: Eye Gaze Card using MetricCard for consistent alignment */}
          <MetricCard 
             title="Eye Gaze"
             value={gazeStatus}
             // No unit for this one, or you could move 'Gaze' here if preferred
             unit=""
             icon={<Eye className="text-orange-500" />}
             // Added text resizing logic if the status text is very long
             className={`${gazeStatus.length > 10 ? '[&_p]:!text-2xl' : ''}`}
          />
          
          {/* UPDATED: End Session Button - Darker Red Hover */}
          <Card 
            className="col-span-2 md:col-span-1 lg:col-span-1 flex items-center justify-center p-0 overflow-hidden border-red-600 group cursor-pointer !bg-red-500 hover:!bg-red-700 hover:border-red-700 transition-colors duration-200" 
            onClick={endSession}
          >
            {/* Removed the inner 'bg-red-50' div that was washing out the color */}
            <div className="relative flex flex-col items-center gap-2 text-white">
                <StopCircle className="w-8 h-8 group-hover:scale-110 transition-transform" />
                <span className="font-bold text-sm">End Session</span>
            </div>
          </Card>
        </div>

        {/* =========================================================
            ROW 2: LEARNING CONTENT
           ========================================================= */}
        <div className="flex flex-col gap-4 mb-8">
            {/* Tabs */}
            <div className="flex justify-start">
                <div className="bg-white/80 backdrop-blur-md p-2 rounded-2xl shadow-sm border border-orange-200 inline-flex">
                    {tabs.map((t) => {
                        const isActive = studyContentType === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => onTabClick(t.id)}
                                className={`relative px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                                    isActive ? "text-orange-900 shadow-sm" : "text-stone-500 hover:text-stone-700 hover:bg-white/50"
                                }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-0 bg-white rounded-xl shadow-sm border border-orange-100"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <span className="relative z-10 flex items-center gap-2">
                                    {t.id === 'video' ? <PlayCircle size={16} /> : <BookOpen size={16} />}
                                    {t.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Viewer */}
            {/* ADDED: !p-0 to eliminate white edges around the video/content */}
            <Card className="overflow-hidden relative bg-white border-2 border-orange-100 shadow-2xl shadow-orange-900/10">
                <div style={{ display: studyContentType === 'video' ? 'block' : 'none', height: '600px' }} className="w-full">
                    <StudyContent 
                        lesson={studyLesson} 
                        type="video" 
                        videoRef={playerIframeRef} 
                        style={{ height: '100%' }}
                    />
                </div>
                
                <div 
                    style={{ display: studyContentType === 'article' ? 'block' : 'none', height: '600px' }} 
                    className="w-full overflow-y-auto custom-scrollbar p-6 
                    prose prose-orange max-w-none [&_*]:max-w-none [&_div]:max-w-none [&_p]:max-w-none"
                >
                    <StudyContent 
                        lesson={studyLesson} 
                        type="article" 
                        videoRef={null} 
                    />
                </div>
            </Card>
        </div>

        {/* =========================================================
            ROW 3: SUMMARY (Left) & NEUROBOT (Right)
           ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            
            {/* LEFT: Smart Summary */}
            <Card className="bg-gradient-to-br from-white to-amber-50 border-orange-200 shadow-lg shadow-orange-500/5 h-[500px] flex flex-col p-0 overflow-hidden relative">
                {/* Sticky Header */}
                <div className="flex items-center justify-between p-5 border-b border-orange-100 bg-white/95 backdrop-blur-sm z-20">
                    <div className="flex items-center gap-2">
                        <div className="bg-orange-100 p-1.5 rounded-lg border border-orange-200">
                            <Zap className="w-5 h-5 text-orange-600" />
                        </div>
                        <h2 className="text-lg font-black text-stone-800">Smart Summary</h2>
                    </div>
                    {summary && <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-full border border-orange-100">AI Generated</span>}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white/50">
                    {summary ? (
                        <MarkdownRenderer content={summary} className="prose prose-orange prose-sm max-w-none text-stone-700 font-medium" />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                            <div className="relative">
                                <Brain className="w-16 h-16 text-orange-300 animate-pulse" />
                                <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-1 -right-1 animate-bounce" />
                            </div>
                            <h3 className="mt-4 text-lg font-bold text-stone-500">Generating Summary...</h3>
                            <p className="text-sm text-stone-400 max-w-xs mt-2">Our AI is analyzing the lesson content to provide you with concise notes.</p>
                        </div>
                    )}
                </div>
            </Card>

            {/* RIGHT: NeuroBot Chat */}
            <Card className="p-0 flex flex-col h-[500px] shadow-2xl shadow-orange-900/10 border-orange-200 bg-white">
                <div className="p-4 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20 border-2 border-white">
                            <MessageSquare size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-stone-900 text-sm">NeuroBot</h3>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-xs text-stone-500 font-medium">Online & Learning</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div ref={chatHistoryRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/50 custom-scrollbar">
                    {chatHistory.map((msg, idx) => {
                        const isUser = msg.role === "user";
                        return (
                            <motion.div 
                                key={idx} 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                            >
                                <div className={`max-w-[85%] rounded-2xl p-3.5 shadow-sm text-sm leading-relaxed ${
                                    isUser 
                                    ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-tr-none shadow-orange-500/20 font-medium" 
                                    : "bg-white text-stone-700 border border-stone-200 rounded-tl-none shadow-sm font-medium"
                                }`}>
                                    <MarkdownRenderer content={msg.content} className={isUser ? "chat-bubble" : ""} />
                                    {!isUser && (
                                        <div className="mt-2 flex justify-end opacity-70">
                                            {/* <ListenButton text={msg.content} className="hover:bg-gray-100 text-gray-400" /> */}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })}
                    {isChatLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-none p-3 shadow-sm">
                                <div className="flex gap-1.5">
                                    {[0, 1, 2].map(i => (
                                        <motion.div 
                                            key={i}
                                            animate={{ y: [0, -5, 0] }}
                                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                                            className="w-2 h-2 bg-stone-400 rounded-full"
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-3 bg-white border-t border-orange-100">
                    <div className="relative flex items-center gap-2">
                            <input
                            type="text"
                            value={chatQuery}
                            onChange={(e) => setChatQuery(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !isChatLoading && handleChat()}
                            placeholder="Ask about the lesson..."
                            className="w-full bg-stone-50 text-stone-800 text-sm rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white focus:border-orange-200 transition-all placeholder:text-stone-400 border border-stone-200 font-medium"
                            disabled={isChatLoading}
                        />
                        <button 
                            onClick={handleChat}
                            disabled={!chatQuery.trim() || isChatLoading}
                            className="absolute right-2 p-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-lg transition-all disabled:opacity-50 shadow-md shadow-orange-500/20"
                        >
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </Card>
        </div>

        {/* =========================================================
            ROW 4: EEG (Big Left) & LOGS (Stacked Right)
           ========================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. Live Brainwaves (Tall Box) */}
            <div className="h-[450px] overflow-hidden">
                <EegStreamChart data={eegData} />
            </div>

            {/* 2. Stack: Feedback & Log */}
            <div className="flex flex-col gap-6 h-[450px]">
                {/* Feedback Panel (Fixed Height) */}
                <div className="flex-none">
                    <DynamicFeedbackPanel attention={attention || 0} streak={focusStreak} />
                </div>
                
                {/* Session Log (Fills remaining space) */}
                <div className="flex-1 overflow-hidden">
                      <SessionLog events={sessionEvents} />
                </div>
            </div>

        </div>
        </div>
      </main>
    </div>
  );
};
