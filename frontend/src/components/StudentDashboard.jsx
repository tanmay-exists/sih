// StudentDashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import { Header, ListenButton } from "./Common";
import useFocusMode from "./useFocusMode";
import useWebSocketStream from "./useWebSocketStream";
import { AnimatePresence } from "framer-motion";
import { QuizGame } from "./QuizGame";
import { HeadsetAlert } from "./Components";
import axios from "axios";
import { IdleLayout, SelectingSubjectLayout, SelectingLessonLayout, FinishedLayout } from "./DashboardLayouts";
import { ActiveSession } from "./ActiveSession";

export const StudentDashboard = ({ onLogout, accessibility }) => {
  const [sessionState, setSessionState] = useState("idle");
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
  const [showFocusAlert, setShowFocusAlert] = useState(null); // This is for warnings
  const [showHeadsetAlert, setShowHeadsetAlert] = useState(false);
  const [history, setHistory] = useState({ recent_sessions: [], recent_quizzes: [] });
  const [quizSubject, setQuizSubject] = useState(null);
  const [studyLesson, setStudyLesson] = useState(null);
  const [studyContentType, setStudyContentType] = useState("video");
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
  const lowFocusAlertCounterRef = useRef(0);
  const isAlertOpenRef = useRef(false);
  const lastLowFocusTriggerRef = useRef(0);
  const token = localStorage.getItem("token");
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Dedicated state for the fun fact modal
  const [showFunFact, setShowFunFact] = useState(false);
  // State to hold the pre-fetched fact
  const [prefetchedFunFact, setPrefetchedFunFact] = useState(null);

  const selectedSubject = subjects.find((s) => s.subject === selectedSubjectName);
  const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

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
    saveHistory((prev) => ({
      ...prev,
      __lastSavedFinishedAt: sessionTime,
      recent_sessions: [
        ...(prev.recent_sessions || []),
        {
          timestamp: new Date(),
          duration: sessionTime,
          eventsCount: sessionEvents.length,
          subject: selectedSubjectName || "General",
        },
      ],
    }));
    setSessionState("finished");
    setQuizSubject(selectedSubjectName || "GK");
  };

  const restartSession = () => {
    console.log("Restarting session, resetting counter to 0");
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
    lowFocusAlertCounterRef.current = 0;
    isAlertOpenRef.current = false;
    lastLowFocusTriggerRef.current = 0;
    
    setShowFunFact(false);
    // Reset pre-fetched fact
    setPrefetchedFunFact(null);
  };
  
  // New function to pre-fetch the fun fact
  const prefetchFunFact = async (lessonId) => {
    if (!lessonId) return;
    try {
      console.log("Pre-fetching fun fact...");
      const response = await axios.get(
        `http://localhost:8000/tools/fun-fact/${lessonId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPrefetchedFunFact(response.data.fun_fact);
      console.log("Fun fact pre-fetched!");
    } catch (err) {
      console.error("Error pre-fetching fun fact:", err);
      // If it fails, we'll just show the fallback later
      setPrefetchedFunFact("Couldn't fetch a fun fact, but please take a moment to refocus!");
    }
  };

  const startStudySession = (lesson) => {
    console.log("Starting study session, resetting counter to 0");
    restartSession();
    setSelectedSubjectName(selectedSubjectName); // This was a bug, should be the param
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
    
    // Call the pre-fetch function as soon as the session starts
    prefetchFunFact(lesson.lessonId);
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

  const handleRefocusQuizFinish = (result) => {
    console.log("Quiz finished, resetting counter to 0");
    const subjectName = selectedSubjectName || "GK";
    const withSubject = { timestamp: new Date(), subject: subjectName, score: `${result.score}/${result.total}` };
    saveHistory((prev) => ({
      ...prev,
      recent_quizzes: [...(prev.recent_quizzes || []), withSubject],
    }));
    setShowRefocusQuiz(false);
    setShowFocusAlert(null);
    isAlertOpenRef.current = false;
    setAttention(60); // Reset to a "grace" value
    lastVerdictTimeRef.current = Date.now();
    lowFocusAlertCounterRef.current = 0;
    lastLowFocusTriggerRef.current = 0;
  };

  const handleFocusAlertClose = () => {
    console.log(`Closing alert, counter at: ${lowFocusAlertCounterRef.current}`);
    setShowFocusAlert(null);
    isAlertOpenRef.current = false;
  };

  // New handler to close the fun fact modal
  const handleFunFactClose = () => {
    console.log(`Closing fun fact`);
    setShowFunFact(false);
    isAlertOpenRef.current = false;
    // We don't reset the content, in case it pops up again
  };


  // --- MODIFIED ALERT LOGIC ---
  useEffect(() => {
    console.log("Alert useEffect triggered");
    if (sessionState !== "active" || attention === null) {
      console.log("Skipping alert logic: session not active or attention null");
      return;
    }

    const now = Date.now();
    const timeSinceLastTrigger = now - lastLowFocusTriggerRef.current;

    // 7-second debounce for new low-focus events
    if (timeSinceLastTrigger < 7000) {
      console.log(`Debounce active, time since last trigger: ${timeSinceLastTrigger}ms`);
      return;
    }

    console.log(`Processing attention: ${attention}, Counter: ${lowFocusAlertCounterRef.current}, AlertOpen: ${isAlertOpenRef.current}, Quiz: ${showRefocusQuiz}`);

    // --- FIX 1: Set threshold to 75 ---
    if (attention >= 75) {
      // Focus is good
      if (showFocusAlert) {
        console.log("Focus regained, clearing alert");
        setShowFocusAlert(null);
        isAlertOpenRef.current = false; // Reset the flag
      }
      
      // --- FIX 2: Removed counter reset. Counter only resets after 4th warning. ---

      // This is the key fix for the stuck flag
      // If focus is good AND no modals are active, the ref MUST be false.
      if (!showFunFact && !showFocusAlert && !showRefocusQuiz) {
          if (isAlertOpenRef.current) {
             console.log("Focus is good and no modals are open, resetting alert flag.");
             isAlertOpenRef.current = false;
          }
      }
    } else {
      // Focus is low ( < 75 )
      // Update check to include new showFunFact state
      if (isAlertOpenRef.current || showRefocusQuiz || showFunFact) {
        console.log("Alert, quiz, or fun fact modal already open, skipping");
        return;
      }

      lowFocusAlertCounterRef.current += 1;
      lastLowFocusTriggerRef.current = now;

      console.log(`Low focus detected, counter incremented to: ${lowFocusAlertCounterRef.current}`);

      // Replace quiz trigger with fun fact trigger
      if (lowFocusAlertCounterRef.current >= 4) {
        console.log("Triggering fun fact, resetting counter to 0");
        setShowFunFact(true); // <-- Show the new modal
        lowFocusAlertCounterRef.current = 0; // <-- Counter resets HERE, after triggering
        isAlertOpenRef.current = true; // Block other alerts
      } else {
        console.log(`Showing alert: Warning ${lowFocusAlertCounterRef.current}/3`);
        setShowFocusAlert(
          `Your attention dropped! Please refocus. (Warning ${lowFocusAlertCounterRef.current}/3)`
        );
        isAlertOpenRef.current = true;
      }
    }
  // Update dependency array
  }, [attention, sessionState, showRefocusQuiz, showFunFact]);
  // --- END MODIFIED ---

  // Logging and focus streak
  useEffect(() => {
    if (sessionState !== "active") return;
    const logInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastLog = now - lastLogTimeRef.current;
      if (attention !== null) {
        // --- FIX 3: Set streak threshold to 75 ---
        if (attention < 75) { 
          setFocusStreak(0);
          lastVerdictTimeRef.current = now;
        } else {
          const timeSinceVerdict = now - lastVerdictTimeRef.current;
          setFocusStreak(Math.floor(timeSinceVerdict / 1000));
        }
      }
      if (timeSinceLastLog >= 5000) {
        // --- FIX 4: Set logging threshold to 75 ---
        const eventType = attention >= 75 ? "FOCUSED" : "NOT FOCUSED";
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

  // Fetch curriculum, Fetch history, Generate summary
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

  useEffect(() => {
    if (sessionState !== "active" || !studyLesson || !studyLesson.lessonId) return;
    const lessonId = studyLesson.lessonId;
    const fetchSummary = async () => {
      try {
        const apiUrl = `http://localhost:8000/tools/summarize-and-quiz/${lessonId}`;
        const response = await axios.get(apiUrl, {
          headers: { Authorization: `Bearer ${token}` },
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

  
  // We no longer need the useEffect that fetched the fact when the modal opened.
  // It is now pre-fetched.
  
  // --- MODIFIED ATTENTION CALCULATION ---
  useEffect(() => {
    if (sessionState !== "active" || eegData.length === 0) return;
    const now = Date.now();
    const timeSinceLastUpdate = now - lastAttentionUpdateRef.current;
    // 4-second throttle
    if (timeSinceLastUpdate < 4000) return;
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
    console.log(`Calculated attention: ${attentionScore}`);
    setAttention(attentionScore);
    setAttentionHistory((prev) => [...prev, { timestamp: Date.now(), attention: attentionScore }]);
  }, [eegData, sessionState]);
  // --- END MODIFIED ---

  // --- MODIFIED IFRAME HANDLING ---
  useEffect(() => {
    // --- FIX 5: Added showFunFact to the check and dependency array ---
    if ((showRefocusQuiz || showFocusAlert || showFunFact) && playerIframeRef.current?.contentWindow) {
      try {
        console.log("Attempting to pause video via postMessage");
        playerIframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
          "*" // Replace with specific origin if known, e.g., "https://www.youtube.com"
        );
      } catch (err) {
        console.error("Error in postMessage to iframe:", err);
      }
      if (document.fullscreenElement) {
        console.log("Exiting fullscreen");
        document.exitFullscreen().catch((err) => console.error("Error exiting fullscreen:", err));
      }
    }
  }, [showRefocusQuiz, showFocusAlert, showFunFact]); // Added showFunFact
  // --- END MODIFIED ---

  // Render logic
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
  if (sessionState === "finished") {
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
        onCloseFocusAlert={handleFocusAlertClose}
        
        showFunFact={showFunFact}
        // Pass the pre-fetched fact. If it's not ready, show "Generating..."
        funFactContent={prefetchedFunFact || "Generating..."}
        onCloseFunFact={handleFunFactClose}

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
