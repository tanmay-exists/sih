// ActiveSession.jsx
import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, MetricCard, ListenButton } from "./Common";
import { EegStreamChart, SessionLog, DynamicFeedbackPanel, FocusAlert, HeadsetAlert } from "./Components";
import { StudyContent } from "./StudyContent";
import { RefocusQuizModal } from "./RefocusQuizModal";
import { MarkdownRenderer } from "./MarkdownRenderer"; // NEW IMPORT

// Content sliding animation variants (left/right)
const slideVariants = {
  initialLeft: { x: -24, opacity: 0 },
  initialRight: { x: 24, opacity: 0 },
  animate: { x: 0, opacity: 1 },
};

const tabs = [
  { id: "video", label: "Video" },
  { id: "article", label: "Article" },
];

// Helper to format time
const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

export const ActiveSession = ({ 
  sessionState, studyLesson, studyContentType, setStudyContentType,
  sessionTime, attention, focusStreak, endSession,
  summary, mcqs,
  showRefocusQuiz, showFocusAlert, handleRefocusQuizFinish, setShowFocusAlert,
  selectedSubjectName,
  eegData, sessionEvents,
  chatHistory, chatQuery, setChatQuery, isChatLoading, handleChat,
  playerIframeRef
}) => {
  const displayAttention = attention !== null ? attention.toFixed(0) : "--";
  const chatEndRef = useRef(null);

  // Scroll to bottom of chat
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const onTabClick = (id) => {
    if (id !== studyContentType) {
      setStudyContentType(id);
    }
  };

  return (
    <div className="min-h-screen pt-32 bg-warmGray-100">
      <AnimatePresence>
        {showRefocusQuiz && (
          <RefocusQuizModal subject={selectedSubjectName || "GK"} attention={attention || 50} onFinish={handleRefocusQuizFinish} />
        )}
        {showFocusAlert && <FocusAlert message={showFocusAlert} onClose={() => setShowFocusAlert(null)} />}
      </AnimatePresence>

      <main className="container mx-auto px-8 py-10">
        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <MetricCard title="Session Time" value={formatTime(sessionTime)} />
          <MetricCard title="Attention" value={displayAttention} unit="%" />
          <MetricCard title="Focus Streak" value={focusStreak.toFixed(0)} unit="s" />
          <Card className="flex items-center justify-center">
            <Button
              onClick={endSession}
              className="bg-red-500 hover:bg-red-600 text-white w-full px-6 py-3 text-lg rounded-lg"
            >
              End Session
            </Button>
          </Card>
        </div>

        {/* Content Toggle and Viewer */}
        <div className="mb-6">
          <div className="relative inline-flex bg-amber-200 rounded-full p-1">
            <div className="flex relative">
              {tabs.map((t) => {
                const isActive = studyContentType === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onTabClick(t.id)}
                    className={`relative z-10 px-6 md:px-8 py-2 md:py-3 text-sm md:text-base font-medium rounded-full transition-colors ${
                      isActive ? "text-amber-900" : "text-amber-700 hover:text-amber-800"
                    }`}
                    style={{ WebkitTapHighlightColor: "transparent" }}
                    aria-pressed={isActive}
                  >
                    {t.label}
                    {isActive && (
                      <motion.span
                        layoutId="tab-pill"
                        className="absolute inset-0 -z-10 bg-white rounded-full shadow"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative mt-6 overflow-hidden">
            {/* Video Content */}
            <motion.div
              key="video-pane"
              initial={false}
              animate={studyContentType === "video" ? "animate" : "initialRight"}
              variants={slideVariants}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={`${studyContentType === "video" ? "relative" : "absolute top-0 left-0 w-full"} ${
                studyContentType === "video" ? "pointer-events-auto" : "pointer-events-none"
              }`}
              style={{
                visibility: studyContentType === "video" ? "visible" : "hidden",
              }}
              aria-hidden={studyContentType !== "video"}
            >
              <StudyContent lesson={studyLesson} type="video" videoRef={playerIframeRef} />
            </motion.div>

            {/* Article Content */}
            <motion.div
              key="article-pane"
              initial={false}
              animate={studyContentType === "article" ? "animate" : "initialLeft"}
              variants={slideVariants}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={`${studyContentType === "article" ? "relative" : "absolute top-0 left-0 w-full"} ${
                studyContentType === "article" ? "pointer-events-auto" : "pointer-events-none"
              }`}
              style={{
                visibility: studyContentType === "article" ? "visible" : "hidden",
              }}
              aria-hidden={studyContentType !== "article"}
            >
              <StudyContent lesson={studyLesson} type="article" videoRef={null} />
            </motion.div>
          </div>
        </div>

        {/* AI Summary - FIXED WITH MARKDOWN RENDERER */}
        {summary && (
          <Card className="mt-4 bg-amber-50 p-6 rounded-xl shadow-lg border border-amber-200">
            <h2 className="text-xl font-bold text-orange-800 mb-3">Quick Summary for the Test</h2>
            <MarkdownRenderer content={summary} /> {/* <--- FIX HERE */}
            <ListenButton text={summary} />
          </Card>
        )}

        {/* Chatbot with corrected arrow directions and bubble pointers */}
        <Card className="mt-6 bg-amber-50 p-0 rounded-xl shadow-lg border border-amber-200 flex flex-col" style={{ height: "500px" }}>
          <h2 className="text-xl font-bold text-orange-800 p-4 border-b border-amber-200 shrink-0">Ask NeuroLearn</h2>

          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {chatHistory.map((msg, index) => {
              const isUser = msg.role === "user";
              return (
                <div key={index} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`relative max-w-xs md:max-w-md p-3 rounded-lg shadow-sm ${
                      isUser ? "bg-orange-500 text-white" : "bg-amber-100 text-warmGray-800 border border-amber-200"
                    }`}
                  >
                    {/* Bubble pointer */}
                    <span
                      className={`absolute top-4 ${
                        isUser ? "right-[-6px]" : "left-[-6px]"
                      } w-0 h-0 border-y-[6px] border-y-transparent ${
                        isUser ? "border-l-[6px] border-l-orange-500" : "border-r-[6px] border-r-amber-100"
                      }`}
                    />
                    {/* <p className="text-sm md:text-base whitespace-pre-wrap">{msg.content}</p> <--- OLD CODE */}
                    <MarkdownRenderer content={msg.content} className="text-sm md:text-base whitespace-pre-wrap chat-bubble" /> {/* <--- FIX HERE */}

                    {!isUser && (
                      <div className="mt-2 pt-2 border-t border-amber-300/50">
                        <ListenButton text={msg.content} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isChatLoading && (
              <div className="flex justify-start">
                <div className="p-3 rounded-lg bg-amber-100 text-warmGray-800 border border-amber-200">
                  <div className="flex space-x-1">
                    <span className="h-2 w-2 bg-amber-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                    <span className="h-2 w-2 bg-amber-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                    <span className="h-2 w-2 bg-amber-400 rounded-full animate-pulse"></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <div className="p-4 border-t border-amber-200 bg-amber-50/80 rounded-b-xl shrink-0">
            <div className="flex space-x-2">
              <input
                type="text"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isChatLoading && handleChat()}
                placeholder="Ask about the lesson..."
                className="flex-1 p-3 rounded-lg bg-white text-warmGray-800 border border-amber-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
                disabled={isChatLoading}
              />
              <Button
                onClick={handleChat}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-lg disabled:opacity-50 transition-colors"
                disabled={isChatLoading || !chatQuery.trim()}
                title="Send"
              >
                {/* Right-facing send for user action */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </Button>
            </div>
          </div>
        </Card>

        {/* EEG & Feedback Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2">
            <EegStreamChart data={eegData} />
          </div>
          <div className="space-y-6">
            <DynamicFeedbackPanel attention={attention || 0} streak={focusStreak} />
            <SessionLog events={sessionEvents} />
          </div>
        </div>
      </main>
    </div>
  );
};
