// DashboardLayouts.jsx
import React, { useState } from "react";
import { Card, Button, Header } from "./Common";
import { SessionSummary } from "./SessionSummary";
import { AnimatePresence } from "framer-motion";
import { HeadsetAlert } from "./Components";

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

  const tabClasses = (tabName) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
      activeTab === tabName
        ? "bg-amber-100 text-orange-700 border-orange-500"
        : "text-warmGray-500 hover:text-orange-700 border-transparent hover:border-amber-300"
    }`;

  // Data is already reversed in the main component logic, but we'll ensure it's latest-first here for clarity.
  const sortedRecentQuizzes = history.recent_quizzes.slice(-10);
  const sortedRecentSessions = history.recent_sessions.slice(-10);

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-2xl font-semibold text-orange-800 mb-4 shrink-0">Your History</h3>
      <div className="flex border-b border-amber-200 shrink-0">
        <button onClick={() => setActiveTab("quizzes")} className={tabClasses("quizzes")}>
          Recent Quizzes
        </button>
        <button onClick={() => setActiveTab("sessions")} className={tabClasses("sessions")}>
          Recent Sessions
        </button>
      </div>

      <div className="flex-grow overflow-y-auto pt-4 pr-2">
        {activeTab === "quizzes" && (
          <div>
            {sortedRecentQuizzes.length === 0 ? (
              <p className="text-base text-warmGray-500 p-2">No quizzes yet.</p>
            ) : (
              sortedRecentQuizzes.map((q, i) => (
                <div
                  key={i}
                  className="text-base flex justify-between bg-amber-100/50 px-4 py-3 rounded-lg border border-amber-200 mb-3"
                >
                  <span>{formatDateTime(q.timestamp)}</span>
                  <span className="font-semibold">
                    {q.subject}: {q.score}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "sessions" && (
          <div>
            {sortedRecentSessions.length === 0 ? (
              <p className="text-base text-warmGray-500 p-2">No sessions yet.</p>
            ) : (
              sortedRecentSessions.map((s, i) => (
                <div
                  key={i}
                  className="text-base flex justify-between bg-amber-100/50 px-4 py-3 rounded-lg border border-amber-200 mb-3"
                >
                  <span>{formatDateTime(s.timestamp)}</span>
                  <span className="font-semibold">{formatTime(s.duration)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Idle State Layout (Updated to use HistoryTabs) ---
export const IdleLayout = ({ onLogout, accessibility, errorMessage, subjects, history, setSessionState, setShowHeadsetAlert, showHeadsetAlert }) => (
  <>
    <Header
      user="Student"
      role="Learner"
      onLogout={onLogout}
      accessibility={accessibility}
      className="h-24 bg-orange-100 text-amber-900 shadow-md"
    />
    <div className="min-h-screen flex items-center justify-center bg-warmGray-100 relative">
      <img
        src="https://png.pngtree.com/thumb_back/fw800/background/20240104/pngtree-trendy-doodle-texture-flat-vector-illustration-of-hand-drawn-abstract-shapes-image_13915914.png"
        alt="Ready to Begin background"
        className="absolute inset-0 w-full h-full z-0 opacity-5 object-cover pointer-events-none"
      />
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-5 gap-10 p-8 z-10">
        <Card className="bg-amber-50 text-center lg:col-span-3 p-10 flex flex-col justify-center rounded-xl shadow-lg border border-amber-200">
          <h2 className="text-4xl font-bold text-orange-800 mb-6">Ready to Begin?</h2>
          <p className="text-base text-warmGray-700 mb-8">Start a new session to track your attention while you study.</p>
          {errorMessage && <p className="text-red-600 mb-4">{errorMessage}</p>}
          {subjects.length === 0 && !errorMessage && (
            <p className="text-warmGray-700 mb-4">No curriculum available for your class.</p>
          )}
          <Button
            onClick={() => setSessionState("selecting-subject")}
            className="bg-orange-500 hover:bg-orange-600 text-white w-full max-w-sm mx-auto px-6 py-3 text-lg rounded-lg"
            disabled={subjects.length === 0}
          >
            Start Study Session
          </Button>
        </Card>
        {/* History Card with Tabs */}
        <Card className="bg-amber-50 lg:col-span-2 p-6 flex flex-col h-[500px] rounded-xl shadow-lg border border-amber-200">
          <HistoryTabs history={history} />
        </Card>
      </div>
      <AnimatePresence>{showHeadsetAlert && <HeadsetAlert onClose={() => setShowHeadsetAlert(false)} />}</AnimatePresence>
    </div>
  </>
);

// --- Selecting Subject Layout ---
export const SelectingSubjectLayout = ({ onLogout, accessibility, errorMessage, subjects, setSelectedSubjectName, setSessionState, restartSession }) => (
  <div className="min-h-screen pt-32 bg-warmGray-100 relative">
    <Header
      user="Student"
      role="Learner"
      onLogout={onLogout}
      accessibility={accessibility}
      className="h-24 bg-orange-100 text-amber-900 shadow-md"
    />
    <main className="container mx-auto px-8 py-10 max-w-4xl relative z-10">
      <Card className="bg-amber-50 text-center p-8 rounded-xl shadow-lg border border-amber-200">
        <h2 className="text-3xl font-bold text-orange-800 mb-4">Step 1: Choose a Subject</h2>
        <p className="text-base text-warmGray-700 mb-8">Select a subject to see the available lessons.</p>
        {errorMessage && <p className="text-red-600 mb-4">{errorMessage}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {subjects.map((s) => (
            <Button
              key={s.subject}
              onClick={() => {
                setSelectedSubjectName(s.subject);
                setSessionState("selecting-lesson");
              }}
              className={`bg-yellow-500 hover:bg-orange-500 text-white px-6 py-3 text-lg rounded-lg`}
            >
              {s.subject}
            </Button>
          ))}
        </div>
        <Button
          onClick={restartSession}
          className="bg-red-500 hover:bg-red-600 text-white w-full mt-8 px-6 py-3 text-lg rounded-lg"
        >
          Back to Home
        </Button>
      </Card>
    </main>
  </div>
);

// --- Selecting Lesson Layout ---
export const SelectingLessonLayout = ({ onLogout, accessibility, selectedSubject, selectedSubjectName, startStudySession, setSessionState }) => (
  <div className="min-h-screen pt-32 bg-warmGray-100 relative">
    <Header
      user="Student"
      role="Learner"
      onLogout={onLogout}
      accessibility={accessibility}
      className="h-24 bg-orange-100 text-amber-900 shadow-md"
    />
    <main className="container mx-auto px-8 py-10 max-w-4xl relative z-10">
      {/* Back Button */}
      <div className="mb-4">
        <button
          onClick={() => setSessionState("selecting-subject")}
          className="flex items-center gap-2 text-orange-600 bg-yellow-100 hover:text-orange-600 bg-transparent border-none outline-none transition-colors rounded-full p-4 pr-6"
          title="Go Back"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"
            />
          </svg>
          <span>Back</span>
        </button>
      </div>

      <Card className="bg-amber-50 p-8 rounded-xl shadow-lg border border-gray-100">
        <h2 className="text-3xl font-bold text-orange-800 mb-6 text-center">
          Step 2: Choose a Lesson for {selectedSubjectName}
        </h2>
        <p className="text-base text-warmGray-700 mb-8 text-center">
          Start your focused study session by selecting a lesson.
        </p>

        <div className="space-y-4">
          {selectedSubject && selectedSubject.lessons.length > 0 ? (
            selectedSubject.lessons.map((lesson) => (
              <Button
                key={lesson.lessonId}
                onClick={() => startStudySession(lesson)}
                className="w-full text-left bg-orange-400 hover:bg-orange-500 text-white px-6 py-4 text-lg rounded-lg transition-colors"
              >
                {lesson.lessonTitle}
              </Button>
            ))
          ) : (
            <p className="text-center text-warmGray-500">No lessons available for this subject.</p>
          )}
        </div>
      </Card>
    </main>
  </div>
);

// --- Finished State Layout ---
export const FinishedLayout = ({ onLogout, accessibility, sessionTime, sessionEvents, restartSession, setSessionState, selectedSubjectName, attentionHistory, attention }) => (
  <>
    <Header
      user="Student"
      role="Learner"
      onLogout={onLogout}
      accessibility={accessibility}
      className="h-24 bg-orange-100 text-amber-900 shadow-md"
    />
    <div className="min-h-screen flex items-center justify-center bg-warmGray-100 relative">
      <img
        src="https://png.pngtree.com/thumb_back/fw800/background/20240104/pngtree-trendy-doodle-texture-flat-vector-illustration-of-hand-drawn-abstract-shapes-image_13915914.png"
        alt="Session summary background"
        className="absolute inset-0 w-full h-full z-0 opacity-5 object-cover pointer-events-none"
      />
      <div className="container mx-auto px-8 py-10 relative z-10">
        <SessionSummary
          sessionTime={sessionTime}
          sessionEvents={sessionEvents}
          onGoHome={restartSession}
          onStartNew={() => setSessionState("selecting-subject")}
          onTakeQuiz={() => {
            setSessionState("quiz"); // Note: quizSubject state is set in StudentDashboard before render
          }}
          attentionHistory={attentionHistory}
          attention={attention}
        />
      </div>
    </div>
  </>
);
