import React, { useState, useEffect, useRef } from "react";
import { Card, Button, Header, MetricCard, ListenButton } from "./Common";
import { SessionSummary } from "./SessionSummary";
import useFocusMode from "./useFocusMode";
import useWebSocketStream from "./useWebSocketStream";
import { motion, AnimatePresence } from "framer-motion";
import { QuizGame } from "./QuizGame";
import { StudyContent } from "./StudyContent";
import { RefocusQuizModal } from "./RefocusQuizModal";
import { EegStreamChart, SessionLog, DynamicFeedbackPanel, FocusAlert, HeadsetAlert } from "./Components";
import axios from "axios";

export const StudentDashboard = ({ onLogout, accessibility }) => {
  const [sessionState, setSessionState] = useState("idle"); // idle, selecting-subject, selecting-lesson, active, finished, quiz
  const [sessionTime, setSessionTime] = useState(0);
  const { isFocusMode, toggleFocusMode } = useFocusMode();
  const playerIframeRef = useRef(null);
  const { eegData, connectionStatus, latestVerdict } = useWebSocketStream(
    sessionState === "active" || sessionState === "quiz"
  );
  const [attention, setAttention] = useState(null);
  const [focusStreak, setFocusStreak] = useState(0);
  const [sessionEvents, setSessionEvents] = useState([]);
  const [attentionHistory, setAttentionHistory] = useState([]);
  const [showRefocusQuiz, setShowRefocusQuiz] = useState(false);
  const [showFocusAlert, setShowFocusAlert] = useState(null);
  const [showHeadsetAlert, setShowHeadsetAlert] = useState(false);
  const [history, setHistory] = useState({ recent_sessions: [], recent_quizzes: [] });
  const [quizSubject, setQuizSubject] = useState(null);
  const [studyLesson, setStudyLesson] = useState(null);
  const [studyContentType, setStudyContentType] = useState("video"); // 'video' | 'article'
  const [selectedSubjectName, setSelectedSubjectName] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [summary, setSummary] = useState("");
  const [mcqs, setMcqs] = useState([]);
  const [chatQuery, setChatQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState(null);
  const sessionTimeRef = useRef(0);
  const lastVerdictTimeRef = useRef(Date.now());
  const lastLogTimeRef = useRef(Date.now());
  const lastAttentionUpdateRef = useRef(Date.now());
  const token = localStorage.getItem("token");

  // Chat state
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Utility to find the currently selected subject object
  const selectedSubject = subjects.find((s) => s.subject === selectedSubjectName);

  // Fetch curriculum
  useEffect(() => {
    const fetchCurriculum = async () => {
      try {
        const response = await axios.get("http://localhost:8000/curriculum/my", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSubjects(
          response.data.subjects.map((s) => ({
            subject: s.subject,
            lessons: s.lessons.map((l) => ({
              ...l,
              lessonTitle: l.lessonTitle || l.title,
              articleContent: l.articleContent || "",
            })),
          }))
        );
        setErrorMessage(null);
      } catch (err) {
        console.error("Error fetching curriculum:", err);
        setErrorMessage(
          "Failed to load curriculum. Please try again later. (Check API server logs for details)"
        );
      }
    };
    if (token) fetchCurriculum();
  }, [token]);

  // Fetch history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get("http://localhost:8000/history/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setHistory({
          recent_sessions: response.data.recent_sessions || [],
          recent_quizzes: response.data.recent_quizzes || [],
        });
        setErrorMessage(null);
      } catch (err) {
        console.error("Error fetching history:", err);
        setErrorMessage("Failed to load history. Please try again later.");
      }
    };
    if (token) fetchHistory();
  }, [token]);

  // Generate summary on session start
  useEffect(() => {
    if (sessionState !== "active" || !studyLesson || !studyLesson.lessonId) return;
    const lessonId = studyLesson.lessonId;
    const fetchSummary = async () => {
      try {
        const apiUrl = `http://localhost:8000/tools/summarize-and-quiz/${lessonId}`;
        const response = await axios.get(apiUrl, { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        setSummary(response.data.summary);
        setMcqs(response.data.mcqs);
        setErrorMessage(null);
      } catch (err) {
        console.error("Error fetching summary:", err);
        setErrorMessage("Failed to load summary/quiz. Please check the backend endpoint.");
      }
    };
    fetchSummary();
  }, [sessionState, studyLesson, token]); // ← FIXED: added studyLesson

  // Chat auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Pause video for alerts
  useEffect(() => {
    if ((showRefocusQuiz || showFocusAlert) && playerIframeRef.current?.contentWindow) {
      try {
        playerIframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
          "*"
        );
      } catch {}
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [showRefocusQuiz, showFocusAlert]);

  // Calculate attention from EEG
  useEffect(() => {
    if (sessionState !== "active" || eegData.length === 0) return;
    const now = Date.now();
    const timeSinceLastUpdate = now - lastAttentionUpdateRef.current;
    if (timeSinceLastUpdate < 1000) return;
    lastAttentionUpdateRef.current = now;
    const recentData = eegData.slice(-20);
    const values = recentData.map((d) => Math.abs(d.value));
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    let attentionScore;
    if (mean < 100) {
      attentionScore = 100 - mean * 0.2;
    } else if (mean < 200) {
      attentionScore = 80 - (mean - 100) * 0.2;
    } else if (mean < 350) {
      attentionScore = 60 - (mean - 200) * 0.2;
    } else {
      attentionScore = Math.max(10, 30 - (mean - 350) * 0.05);
    }
    attentionScore = Math.min(100, Math.max(10, attentionScore));
    setAttention(attentionScore);
    setAttentionHistory((prev) => [...prev, { timestamp: Date.now(), attention: attentionScore }]);
  }, [eegData, sessionState]);

  // Show alert for low attention
  useEffect(() => {
    if (sessionState !== "active") return;
    if (attention !== null && attention < 50 && !showFocusAlert) {
      setShowFocusAlert("Your attention dropped! Please refocus.");
    } else if (attention >= 50 && showFocusAlert) {
      setShowFocusAlert(null);
    }
  }, [attention, sessionState, showFocusAlert]);

  // Trigger refocus quiz
  useEffect(() => {
    if (sessionState !== "active") return;
    if (latestVerdict && latestVerdict.state !== "FOCUSED" && !showRefocusQuiz) {
      setShowRefocusQuiz(true);
      setShowFocusAlert("Model detected low focus! Take a quick refocus quiz.");
    }
  }, [latestVerdict, sessionState, showRefocusQuiz]);

  // Logging and focus streak
  useEffect(() => {
    if (sessionState !== "active") return;
    const logInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastLog = now - lastLogTimeRef.current;
      if (attention !== null) {
        if (attention < 50) {
          setFocusStreak(0);
          lastVerdictTimeRef.current = now;
        } else {
          const timeSinceVerdict = now - lastVerdictTimeRef.current;
          setFocusStreak(Math.floor(timeSinceVerdict / 1000));
        }
      }
      if (timeSinceLastLog >= 5000) {
        const eventType = attention >= 50 ? "FOCUSED" : "NOT FOCUSED";
        setSessionEvents((prev) => [
          {
            timestamp: now,
            event: eventType,
            attention: attention !== null ? Math.round(attention) : 0,
            verdict: eventType,
          },
          ...prev,
        ]);
        lastLogTimeRef.current = now;
      }
    }, 1000);
    return () => clearInterval(logInterval);
  }, [sessionState, attention]);

  // Session timer
  useEffect(() => {
    if (sessionState !== "active") return;
    const timer = setInterval(() => {
      setSessionTime((t) => t + 1);
      sessionTimeRef.current += 1;
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionState]);

  const endSession = () => {
    setSessionEvents((prev) => [
      {
        timestamp: Date.now(),
        event: "Session Ended",
        attention: attention !== null ? Math.round(attention) : 0,
        verdict: "N/A",
      },
      ...prev,
    ]);
    setSessionState("finished");
  };

  const handleRefocusQuizFinish = (result) => {
    const subjectName = selectedSubjectName || "GK";
    const withSubject = { timestamp: new Date(), subject: subjectName, score: `${result.score}/${result.total}` };
    saveHistory((prev) => ({
      ...prev,
      recent_quizzes: [...(prev.recent_quizzes || []), withSubject],
    }));
    setShowRefocusQuiz(false);
    setShowFocusAlert(null);
    setAttention(60);
    lastVerdictTimeRef.current = Date.now();
  };

  const restartSession = () => {
    setStudyLesson(null);
    setStudyContentType("video");
    setSelectedSubjectName(null);
    setShowRefocusQuiz(false);
    setShowFocusAlert(null);
    setShowHeadsetAlert(false);
    setSessionState("idle");
    setAttention(null);
    setFocusStreak(0);
    setSessionEvents([]);
    setAttentionHistory([]);
    setSessionTime(0);
    setSummary("");
    setMcqs([]);
    setErrorMessage(null);
    setChatHistory([]);
    setChatQuery("");
    setIsChatLoading(false);

    sessionTimeRef.current = 0;
    lastVerdictTimeRef.current = Date.now();
    lastLogTimeRef.current = Date.now();
    lastAttentionUpdateRef.current = Date.now();
  };

  const startStudySession = (lesson) => {
    restartSession();
    setSelectedSubjectName(selectedSubjectName);
    setStudyLesson(lesson);
    setStudyContentType("video");
    setSessionState("active");
    const now = Date.now();
    setSessionEvents([{ timestamp: now, event: "Session Started", attention: 0, verdict: "N/A" }]);
    lastLogTimeRef.current = now;
    lastAttentionUpdateRef.current = now;

    setChatHistory([
      {
        role: "assistant",
        content: `Hi! I'm ready to answer any questions about "${lesson.lessonTitle}". Just ask!`,
      },
    ]);
  };

  const saveHistory = async (updater) => {
    try {
      const next = typeof updater === "function" ? updater(history) : updater;
      await axios.post(
        "http://localhost:8000/history/",
        {
          sessions: next.recent_sessions || [],
          quizzes: next.recent_quizzes || [],
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setHistory(next);
      setErrorMessage(null);
    } catch (err) {
      console.error("Error saving history:", err);
      setErrorMessage("Failed to save history. Please try again.");
    }
  };

  const handleChat = async () => {
    if (!chatQuery.trim() || isChatLoading) return;
    const newUserMessage = { role: "user", content: chatQuery };
    setChatHistory((prev) => [...prev, newUserMessage]);
    const currentQuery = chatQuery;
    setChatQuery("");
    setIsChatLoading(true);

    try {
      const response = await axios.post(
        "http://localhost:8000/tools/chatbot",
        { query: currentQuery, lesson_id: studyLesson ? studyLesson.lessonId : "GK" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const assistantMessage = { role: "assistant", content: response.data.response };
      setChatHistory((prev) => [...prev, assistantMessage]);
      setErrorMessage(null);
    } catch (err) {
      console.error("Error in chatbot:", err);
      const errorMessage = { role: "assistant", content: "Sorry, I couldn't process your query. Try again!" };
      setChatHistory((prev) => [...prev, errorMessage]);
      setErrorMessage("Failed to process chat query. Please try again.");
    } finally {
      setIsChatLoading(false);
    }
  };

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const formatDateTime = (timestamp) => {
    const d = new Date(timestamp);
    return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}`;
  };

  // Sliding tab config
  const tabs = [
    { id: "video", label: "Video" },
    { id: "article", label: "Article" },
  ];

  const onTabClick = (id) => {
    if (id !== studyContentType) {
      setStudyContentType(id);
    }
  };

  // Content sliding animation variants (left/right)
  const slideVariants = {
    initialLeft: { x: -24, opacity: 0 },
    initialRight: { x: 24, opacity: 0 },
    animate: { x: 0, opacity: 1 },
  };

  // --- Idle state
  if (sessionState === "idle") {
    return (
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
            <Card className="bg-amber-50 lg:col-span-2 p-10 flex flex-col h-[500px] rounded-xl shadow-lg border border-amber-200">
              <h3 className="text-2xl font-semibold text-orange-800 mb-6 shrink-0">Your History</h3>
              <div className="flex-grow space-y-6 overflow-y-auto pr-4">
                <div>
                  <p className="text-base font-bold text-warmGray-600 mb-3">Recent Sessions</p>
                  {history.recent_sessions.length === 0 && <p className="text-base text-warmGray-500">No sessions yet.</p>}
                  {history.recent_sessions
                    .slice(-10)
                    .reverse()
                    .map((s, i) => (
                      <div
                        key={i}
                        className="text-base flex justify-between bg-amber-100/50 px-4 py-3 rounded-lg border border-amber-200 mb-3"
                      >
                        <span>{formatDateTime(s.timestamp)}</span>
                        <span className="font-semibold">{formatTime(s.duration)}</span>
                      </div>
                    ))}
                </div>
                <div>
                  <p className="text-base font-bold text-warmGray-600 mb-3">Recent Quizzes</p>
                  {history.recent_quizzes.length === 0 && (
                    <p className="text-base text-warmGray-500">No quizzes yet.</p>
                  )}
                  {history.recent_quizzes
                    .slice(-10)
                    .reverse()
                    .map((q, i) => (
                      <div
                        key={i}
                        className="text-base flex justify-between bg-amber-100/50 px-4 py-3 rounded-lg border border-amber-200 mb-3"
                      >
                        <span>{formatDateTime(q.timestamp)}</span>
                        <span className="font-semibold">
                          {q.subject}: {q.score}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </Card>
          </div>
          <AnimatePresence>{showHeadsetAlert && <HeadsetAlert onClose={() => setShowHeadsetAlert(false)} />}</AnimatePresence>
        </div>
      </>
    );
  }

  // --- Selecting subject state
  if (sessionState === "selecting-subject") {
    return (
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
  }

  // --- Selecting lesson state (fixed back arrow)
  if (sessionState === "selecting-lesson") {
    return (
      <div className="min-h-screen pt-32 bg-warmGray-100 relative">
        <Header
          user="Student"
          role="Learner"
          onLogout={onLogout}
          accessibility={accessibility}
          className="h-24 bg-orange-100 text-amber-900 shadow-md"
        />
        <main className="container mx-auto px-8 py-10 max-w-4xl relative z-10">
          {/* Back Button: solid style, sits above card, no overlap */}
          
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
  }

  // --- Finished session
  if (sessionState === "finished") {
    if (!history.__lastSavedFinishedAt || history.__lastSavedFinishedAt !== sessionTime) {
      saveHistory((prev) => ({
        ...prev,
        __lastSavedFinishedAt: sessionTime,
        recent_sessions: [
          ...(prev.recent_sessions || []),
          { timestamp: new Date(), duration: sessionTime, eventsCount: sessionEvents.length },
        ],
      }));
    }
    return (
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
                setQuizSubject(selectedSubjectName || "GK");
                setSessionState("quiz");
              }}
              attentionHistory={attentionHistory}
              attention={attention}
            />
          </div>
        </div>
      </>
    );
  }

  // --- Quiz state
  if (sessionState === "quiz") {
    return (
      <div className="min-h-screen pt-32 bg-warmGray-100 relative">
        <img
          src="https://png.pngtree.com/thumb_back/fw800/background/20240104/pngtree-trendy-doodle-texture-flat-vector-illustration-of-hand-drawn-abstract-shapes-image_13915914.png"
          alt="Quiz background"
          className="absolute inset-0 w-full h-full z-0 opacity-5 object-cover pointer-events-none"
        />
        <Header
          user="Student"
          role="Learner"
          onLogout={onLogout}
          accessibility={accessibility}
          className="h-24 bg-orange-100 text-amber-900 shadow-md"
        />
        <main className="container mx-auto px-8 py-10 max-w-4xl relative z-10">
          <QuizGame
            subject={quizSubject}
            questions={mcqs}
            attention={attention}
            onFinish={(result) => {
              const withSubject = {
                timestamp: new Date(),
                subject: quizSubject,
                score: `${result.score}/${result.total}`,
              };
              saveHistory((prev) => ({
                ...prev,
                recent_quizzes: [...(prev.recent_quizzes || []), withSubject],
              }));
              restartSession();
            }}
            focusStats={() => null}
          />
        </main>
      </div>
    );
  }

  // --- Active study session
  const displayAttention = attention !== null ? attention.toFixed(0) : "--";

  return (
    <div className="min-h-screen pt-32 bg-warmGray-100">
      <Header
        user="Student"
        role="Learner"
        onLogout={onLogout}
        accessibility={accessibility}
        focusMode={{ isFocusMode, toggleFocusMode }}
        attention={attention}
        className="h-24 bg-orange-100 text-amber-900 shadow-md"
      />
      <AnimatePresence>
        {showRefocusQuiz && (
          <RefocusQuizModal subject={selectedSubjectName || "GK"} attention={attention || 50} onFinish={handleRefocusQuizFinish} />
        )}
        {showFocusAlert && <FocusAlert message={showFocusAlert} onClose={() => setShowFocusAlert(null)} />}
      </AnimatePresence>

      <main className="container mx-auto px-8 py-10">
        {errorMessage && <p className="text-red-600 mb-4 text-center">{errorMessage}</p>}

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

        {/* Sliding Tabs: big rounded pill with animated bubble */}
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

          {/* Content Wrapper: keep both mounted to preserve state, slide visibility */}
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

        {/* AI Summary */}
        {summary && (
          <Card className="mt-4 bg-amber-50 p-6 rounded-xl shadow-lg border border-amber-200">
            <h2 className="text-xl font-bold text-orange-800 mb-3">Quick Summary for the Test</h2>
            <p className="text-warmGray-700 leading-relaxed">{summary}</p>
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
                    <p className="text-sm md:text-base whitespace-pre-wrap">{msg.content}</p>

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
