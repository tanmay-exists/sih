// StudentDashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import { Header, ListenButton } from "./Common";
import useFocusMode from "./useFocusMode";
import useWebSocketStream from "./useWebSocketStream";
import { AnimatePresence } from "framer-motion";
import { QuizGame } from "./QuizGame";
import { HeadsetAlert } from "./Components";
import axios from "axios";
import { IdleLayout, SelectingSubjectLayout, SelectingLessonLayout, FinishedLayout } from "./DashboardLayouts"; // NEW IMPORT
import { ActiveSession } from "./ActiveSession"; // NEW IMPORT

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

  // Utility to find the currently selected subject object
  const selectedSubject = subjects.find((s) => s.subject === selectedSubjectName);
  const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  // Save History Function
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

  // End Session Logic
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
    // Save session details here, including the subject for the summary page
    saveHistory((prev) => ({
      ...prev,
      __lastSavedFinishedAt: sessionTime,
      recent_sessions: [
        ...(prev.recent_sessions || []),
        { 
          timestamp: new Date(), 
          duration: sessionTime, 
          eventsCount: sessionEvents.length,
          subject: selectedSubjectName || "General", // ADDED subject to session history
        },
      ],
    }));

    setSessionState("finished");
    setQuizSubject(selectedSubjectName || "GK"); // Prepare for optional quiz
  };

  // Restart Session Logic
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

  // Start Study Session Logic
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

  // Handle Chat Logic
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

  // Handle Refocus Quiz Finish
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


  // --- EFFECTS (Unchanged) ---
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
  }, [sessionState, studyLesson, token]);

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


  // --- RENDER LOGIC ---

  // --- Idle state
  if (sessionState === "idle") {
    return (
      <IdleLayout
        onLogout={onLogout}
        accessibility={accessibility}
        errorMessage={errorMessage}
        subjects={subjects}
        history={history}
        setSessionState={setSessionState}
        setShowHeadsetAlert={setShowHeadsetAlert}
        showHeadsetAlert={showHeadsetAlert}
      />
    );
  }

  // --- Selecting subject state
  if (sessionState === "selecting-subject") {
    return (
      <SelectingSubjectLayout
        onLogout={onLogout}
        accessibility={accessibility}
        errorMessage={errorMessage}
        subjects={subjects}
        setSelectedSubjectName={setSelectedSubjectName}
        setSessionState={setSessionState}
        restartSession={restartSession}
      />
    );
  }

  // --- Selecting lesson state
  if (sessionState === "selecting-lesson") {
    return (
      <SelectingLessonLayout
        onLogout={onLogout}
        accessibility={accessibility}
        selectedSubject={selectedSubject}
        selectedSubjectName={selectedSubjectName}
        startStudySession={startStudySession}
        setSessionState={setSessionState}
      />
    );
  }

  // --- Finished session
  if (sessionState === "finished") {
    // Ensure history is saved once after finishing
    if (!history.__lastSavedFinishedAt || history.__lastSavedFinishedAt !== sessionTime) {
      // History is already saved in endSession to include the subject name.
      // This block is simplified/removed as save is already handled in endSession (line 218)
    }

    return (
      <FinishedLayout
        onLogout={onLogout}
        accessibility={accessibility}
        sessionTime={sessionTime}
        sessionEvents={sessionEvents}
        restartSession={restartSession}
        setSessionState={setSessionState}
        selectedSubjectName={selectedSubjectName}
        attentionHistory={attentionHistory}
        attention={attention}
      />
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
            focusStats={() => ({ 
              avg: attentionHistory.reduce((sum, d) => sum + d.attention, 0) / (attentionHistory.length || 1),
              max: Math.max(...attentionHistory.map(d => d.attention)),
              min: Math.min(...attentionHistory.map(d => d.attention)),
            })}
          />
        </main>
      </div>
    );
  }

  // --- Active study session
  return (
    <>
      <Header
        user="Student"
        role="Learner"
        onLogout={onLogout}
        accessibility={accessibility}
        focusMode={{ isFocusMode, toggleFocusMode }}
        attention={attention}
        className="h-24 bg-orange-100 text-amber-900 shadow-md"
      />
      <ActiveSession
        sessionState={sessionState}
        studyLesson={studyLesson}
        studyContentType={studyContentType}
        setStudyContentType={setStudyContentType}
        sessionTime={sessionTime}
        attention={attention}
        focusStreak={focusStreak}
        endSession={endSession}
        summary={summary}
        mcqs={mcqs}
        showRefocusQuiz={showRefocusQuiz}
        showFocusAlert={showFocusAlert}
        handleRefocusQuizFinish={handleRefocusQuizFinish}
        setShowFocusAlert={setShowFocusAlert}
        selectedSubjectName={selectedSubjectName}
        eegData={eegData}
        sessionEvents={sessionEvents}
        chatHistory={chatHistory}
        chatQuery={chatQuery}
        setChatQuery={setChatQuery}
        isChatLoading={isChatLoading}
        handleChat={handleChat}
        playerIframeRef={playerIframeRef}
      />
    </>
  );
};
