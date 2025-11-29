// StudentDashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import { Header, ListenButton, Button, Card } from "./Common";
import useFocusMode from "./useFocusMode";
import useWebSocketStream from "./useWebSocketStream";
import { AnimatePresence, motion } from "framer-motion";
import { QuizGame } from "./QuizGame";
import { HeadsetAlert } from "./Components";
import axios from "axios";
import { Trophy, Star, X, Sparkles, ThumbsUp } from "lucide-react"; 
import {
  IdleLayout,
  SelectingSubjectLayout,
  SelectingLessonLayout,
  FinishedLayout,
} from "./DashboardLayouts";
import { ActiveSession } from "./ActiveSession";

// --- Gaze processing constants ---
const GAZE_FRAME_RATE = 5;
const GAZE_VIDEO_WIDTH = 320;
const GAZE_VIDEO_HEIGHT = 240;
const GAZE_UNFOCUSED_DURATION = 5000;

// --- Appreciation Modal Component ---
const AppreciationModal = ({ onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md">
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-sm w-full relative"
    >
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-orange-400 to-amber-500" />
      <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-white/20 rounded-full blur-xl" />
      
      <div className="relative p-8 text-center pt-12">
        <div className="mx-auto w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20 mb-6 relative">
          <Trophy className="w-10 h-10 text-amber-500" />
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-2 border-dashed border-orange-200 rounded-full" 
          />
          <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 fill-yellow-400 animate-bounce" />
        </div>

        <h2 className="text-2xl font-black text-stone-800 mb-2">Excellent Focus!</h2>
        <p className="text-stone-500 text-sm font-medium leading-relaxed mb-8">
          You've been in the zone for the last 4 minutes. Your beta brainwaves indicate high productivity. Keep it up!
        </p>

        <Button 
          onClick={onClose} 
          className="w-full justify-center py-4 text-lg shadow-xl shadow-orange-500/20 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
          icon={<ThumbsUp className="w-5 h-5" />}
        >
          I'm crushing it!
        </Button>
      </div>
    </motion.div>
  </div>
);

export const StudentDashboard = ({ onLogout, accessibility }) => {
  const [sessionState, setSessionState] = useState("idle");
  const [sessionTime, setSessionTime] = useState(0);
  const { isFocusMode, toggleFocusMode } = useFocusMode();
  const playerIframeRef = useRef(null);

  const { eegData, connectionStatus, latestVerdict, latestGaze, sendGazeFrame } =
    useWebSocketStream(sessionState === "active" || sessionState === "quiz");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const gazeIntervalRef = useRef(null);

  const [attention, setAttention] = useState(null);
  const [focusStreak, setFocusStreak] = useState(0);
  const [sessionEvents, setSessionEvents] = useState([]);
  const [attentionHistory, setAttentionHistory] = useState([]);
  const [showRefocusQuiz, setShowRefocusQuiz] = useState(false);
  const [showFocusAlert, setShowFocusAlert] = useState(null);
  const [showHeadsetAlert, setShowHeadsetAlert] = useState(false);
  const [showAppreciationModal, setShowAppreciationModal] = useState(false);
  
  const [history, setHistory] = useState({
    recent_sessions: [],
    recent_quizzes: [],
  });
  const [quizSubject, setQuizSubject] = useState(null);
  const [studyLesson, setStudyLesson] = useState(null);
  const [studyContentType, setStudyContentType] = useState("video");
  const [selectedSubjectName, setSelectedSubjectName] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [summary, setSummary] = useState("");
  const [mcqs, setMcqs] = useState([]);
  const [chatQuery, setChatQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState(null);
  
  const [username, setUsername] = useState("Student"); 

  const sessionTimeRef = useRef(0);
  const lastVerdictTimeRef = useRef(Date.now());
  const lastLogTimeRef = useRef(Date.now());
  const lastAttentionUpdateRef = useRef(Date.now());
  const lowFocusAlertCounterRef = useRef(0);
  const isAlertOpenRef = useRef(false);
  const lastLowFocusTriggerRef = useRef(0);
  const lastProcessedVerdictTimestampRef = useRef(null);
  // --- NEW: Ref to track the last time a popup (FunFact/Quiz/Appreciation) was shown ---
  const lastInterventionTimeRef = useRef(0);
  
  const token = localStorage.getItem("token");
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [showFunFact, setShowFunFact] = useState(false);
  const [prefetchedFunFact, setPrefetchedFunFact] = useState(null);

  const [isGazeFocused, setIsGazeFocused] = useState(true);
  const badGazeStartTimeRef = useRef(null);

  const selectedSubject = subjects.find(
    (s) => s.subject === selectedSubjectName
  );
  const formatTime = (seconds) =>
    `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  // --- Profile Fetch ---
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await axios.get("http://localhost:8000/users/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const displayName = data.name?.firstName || data.username || "Student";
        setUsername(displayName);
      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    };
    if (token) fetchProfile();
  }, [token]);

  // --- GAZE FUNCTIONS ---
  const startGazeTracking = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: GAZE_VIDEO_WIDTH, height: GAZE_VIDEO_HEIGHT },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      if (gazeIntervalRef.current) {
        clearInterval(gazeIntervalRef.current);
      }
      gazeIntervalRef.current = setInterval(() => {
        captureAndSendFrame();
      }, 1000 / GAZE_FRAME_RATE);
    } catch (err) {
      console.error("Error starting gaze tracking:", err);
      setErrorMessage("Camera permission denied. Eye-tracking will not work.");
    }
  };

  const stopGazeTracking = () => {
    if (gazeIntervalRef.current) {
      clearInterval(gazeIntervalRef.current);
      gazeIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const captureAndSendFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 3) {
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, GAZE_VIDEO_WIDTH, GAZE_VIDEO_HEIGHT);
      const frameData = canvas.toDataURL("image/jpeg", 0.5);
      sendGazeFrame(frameData);
    }
  };

  const saveHistory = async (updater) => {
    try {
      const next = typeof updater === "function" ? updater(history) : updater;
      setHistory(next); 
      setErrorMessage(null);

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
    } catch (err) {
      console.error("Error saving history:", err);
      setErrorMessage("Note: History saved locally but couldn't reach server.");
    }
  };

  const endSession = async () => {
    setSessionEvents((prev) => [
      {
        timestamp: Date.now(),
        event: "Session Ended",
        attention: attention !== null ? Math.round(attention) : 0,
        verdict: "N/A",
      },
      ...prev,
    ]);
    
    await saveHistory((prev) => ({
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
    stopGazeTracking();
  };

  const restartSession = () => {
    console.log("Restarting session, resetting counter to 0");
    setStudyLesson(null);
    setStudyContentType("video");
    setSelectedSubjectName(null);
    setShowRefocusQuiz(false);
    setShowFocusAlert(null);
    setShowHeadsetAlert(false);
    setShowAppreciationModal(false);
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
    lastProcessedVerdictTimestampRef.current = null;
    lastInterventionTimeRef.current = 0; // Reset intervention timer

    setShowFunFact(false);
    setPrefetchedFunFact(null);
    stopGazeTracking();

    setIsGazeFocused(true);
    badGazeStartTimeRef.current = null;
  };

  const prefetchFunFact = async (lessonId) => {
    if (!lessonId) return;
    try {
      const response = await axios.get(
        `http://localhost:8000/tools/fun-fact/${lessonId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPrefetchedFunFact(response.data.fun_fact);
    } catch (err) {
      console.error("Error pre-fetching fun fact:", err);
      setPrefetchedFunFact(
        "Couldn't fetch a fun fact, but please take a moment to refocus!"
      );
    }
  };

  const startStudySession = (lesson) => {
    const currentSubjectName = selectedSubjectName;
    restartSession();
    setSelectedSubjectName(currentSubjectName);
    
    setStudyLesson(lesson);
    setStudyContentType("video");
    setSessionState("active");
    const now = Date.now();
    setSessionEvents([
      { timestamp: now, event: "Session Started", attention: 0, verdict: "N/A" },
    ]);
    lastLogTimeRef.current = now;
    lastAttentionUpdateRef.current = now;
    setChatHistory([
      {
        role: "assistant",
        content: `Hi! I'm ready to answer any questions about "${lesson.lessonTitle}". Just ask!`,
      },
    ]);

    prefetchFunFact(lesson.lessonId);
    startGazeTracking();
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
        {
          query: currentQuery,
          lesson_id: studyLesson ? studyLesson.lessonId : "GK",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const assistantMessage = {
        role: "assistant",
        content: response.data.response,
      };
      setChatHistory((prev) => [...prev, assistantMessage]);
      setErrorMessage(null);
    } catch (err) {
      console.error("Error in chatbot:", err);
      const errorMessage = {
        role: "assistant",
        content: "Sorry, I couldn't process your query. Try again!",
      };
      setChatHistory((prev) => [...prev, errorMessage]);
      setErrorMessage("Failed to process chat query. Please try again.");
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleRefocusQuizFinish = (result) => {
    console.log("Quiz finished");
    const subjectName = selectedSubjectName || "GK";
    const withSubject = {
      timestamp: new Date(),
      subject: subjectName,
      score: `${result.score}/${result.total}`,
    };
    saveHistory((prev) => ({
      ...prev,
      recent_quizzes: [...(prev.recent_quizzes || []), withSubject],
    }));
    setShowRefocusQuiz(false);
    setShowFocusAlert(null);
    isAlertOpenRef.current = false;
    setAttention(75); // Reset to a "grace" value slightly higher to avoid immediate re-trigger
    lastVerdictTimeRef.current = Date.now();
    lowFocusAlertCounterRef.current = 0;
    lastLowFocusTriggerRef.current = 0;
    
    setIsGazeFocused(true);
    badGazeStartTimeRef.current = null;
    
    // Update intervention time so we don't trigger another alert immediately
    lastInterventionTimeRef.current = Date.now();
  };

  const handleFocusAlertClose = () => {
    setShowFocusAlert(null);
    isAlertOpenRef.current = false;
  };

  const handleFunFactClose = () => {
    setShowFunFact(false);
    isAlertOpenRef.current = false;
    setIsGazeFocused(true);
    badGazeStartTimeRef.current = null;
    // Update intervention time
    lastInterventionTimeRef.current = Date.now();
  };

  // --- VERDICT HANDLER ---
  useEffect(() => {
    if (sessionState !== "active" || !latestVerdict) return;

    if (latestVerdict.timestamp === lastProcessedVerdictTimestampRef.current) return;
    
    lastProcessedVerdictTimestampRef.current = latestVerdict.timestamp;

    console.log("Received new verdict:", latestVerdict.state);

    if (latestVerdict.state === "FOCUSED") {
        // Show Appreciation
        if (!showRefocusQuiz && !showFunFact) {
            setShowAppreciationModal(true);
            isAlertOpenRef.current = true;
            // Mark intervention time so we don't annoy them right after with a low focus alert
            lastInterventionTimeRef.current = Date.now();
        }
    } else {
        // "NOT FOCUSED" - Trigger Quiz
        if (!showAppreciationModal && !showFunFact) {
            setShowRefocusQuiz(true);
            isAlertOpenRef.current = true;
            lastInterventionTimeRef.current = Date.now();
        }
    }

  }, [latestVerdict, sessionState, showRefocusQuiz, showFunFact, showAppreciationModal]);
  
  // --- Gaze Focus Timer ---
  useEffect(() => {
    if (sessionState !== "active") {
      setIsGazeFocused(true);
      badGazeStartTimeRef.current = null;
      return;
    }

    const interval = setInterval(() => {
      const gazeStatus = latestGaze?.status;
      const isGazeBad = gazeStatus !== 'Looking Center' && gazeStatus !== 'N/A';
      const now = Date.now();

      if (isGazeBad) {
        if (!badGazeStartTimeRef.current) {
          badGazeStartTimeRef.current = now;
        } else {
          if (now - badGazeStartTimeRef.current > GAZE_UNFOCUSED_DURATION) {
            if (isGazeFocused) {
              console.log("GAZE: Unfocused for 5 seconds!");
              setIsGazeFocused(false);
            }
          }
        }
      } else {
        if (!isGazeFocused) {
          console.log("GAZE: Refocused!");
          setIsGazeFocused(true);
        }
        badGazeStartTimeRef.current = null;
      }
    }, 1000);

    return () => clearInterval(interval);

  }, [sessionState, latestGaze, isGazeFocused]);


  // --- MODIFIED ALERT LOGIC WITH COOLDOWN ---
  useEffect(() => {
    if (sessionState !== "active" || attention === null) return;

    const now = Date.now();
    const timeSinceLastTrigger = now - lastLowFocusTriggerRef.current;
    
    // --- UPDATED THRESHOLD: 70 ---
    const eegIsFocused = attention >= 70;
    const isFocused = eegIsFocused && isGazeFocused;

    if (timeSinceLastTrigger < 7000) return;

    if (isFocused) {
      if (showFocusAlert) {
        setShowFocusAlert(null);
        isAlertOpenRef.current = false;
      }
      if (!showFunFact && !showFocusAlert && !showRefocusQuiz && !showAppreciationModal) {
        if (isAlertOpenRef.current) isAlertOpenRef.current = false;
      }
    } else {
      // Focus is LOW
      if (isAlertOpenRef.current || showRefocusQuiz || showFunFact || showAppreciationModal) {
        return;
      }

      // --- NEW: Cooldown Check (30 seconds) ---
      // If we showed a Fun Fact, Quiz, or Appreciation recently, ignore low focus
      if (Date.now() - lastInterventionTimeRef.current < 30000) {
        console.log("In cooldown period, ignoring low focus.");
        return; 
      }

      lowFocusAlertCounterRef.current += 1;
      lastLowFocusTriggerRef.current = now;

      if (lowFocusAlertCounterRef.current >= 4) {
        setShowFunFact(true);
        lowFocusAlertCounterRef.current = 0;
        isAlertOpenRef.current = true;
        // Mark intervention
        lastInterventionTimeRef.current = Date.now();
      } else {
        let alertMessage = `Your attention dropped! Please refocus. (Warning ${lowFocusAlertCounterRef.current}/3)`;
        if (!eegIsFocused && !isGazeFocused) {
          alertMessage = `EEG and Gaze show low focus! Please refocus. (Warning ${lowFocusAlertCounterRef.current}/3)`;
        } else if (!isGazeFocused) {
          alertMessage = `Please look at the screen to maintain focus. (Warning ${lowFocusAlertCounterRef.current}/3)`;
        }
        setShowFocusAlert(alertMessage);
        isAlertOpenRef.current = true;
      }
    }
  }, [attention, isGazeFocused, sessionState, showRefocusQuiz, showFunFact, showAppreciationModal]);

  // Logging
  useEffect(() => {
    if (sessionState !== "active" || attention === null) return;

    // --- UPDATED THRESHOLD: 70 ---
    const eegIsFocused = attention >= 70; 
    const isFocused = eegIsFocused && isGazeFocused;

    const logInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastLog = now - lastLogTimeRef.current;
      
      if (attention !== null) {
        if (!isFocused) {
          setFocusStreak(0);
          lastVerdictTimeRef.current = now;
        } else {
          const timeSinceVerdict = now - lastVerdictTimeRef.current;
          setFocusStreak(Math.floor(timeSinceVerdict / 1000));
        }
      }

      if (timeSinceLastLog >= 5000) {
        const eventType = isFocused ? "FOCUSED" : "NOT FOCUSED";
        
        let eventDetail = eventType;
        if (eventType === 'NOT FOCUSED') {
          if (!eegIsFocused && !isGazeFocused) eventDetail = "LOW (EEG+GAZE)";
          else if (!eegIsFocused) eventDetail = "LOW (EEG)";
          else if (!isGazeFocused) eventDetail = "LOW (GAZE)";
        }

        setSessionEvents((prev) => [
          {
            timestamp: now,
            event: eventDetail,
            attention: attention !== null ? Math.round(attention) : 0,
            verdict: eventType,
          },
          ...prev,
        ]);
        lastLogTimeRef.current = now;
      }
    }, 1000);
    
    return () => clearInterval(logInterval);
  }, [sessionState, attention, isGazeFocused]);

  // Session timer
  useEffect(() => {
    if (sessionState !== "active") return;
    const timer = setInterval(() => {
      setSessionTime((t) => t + 1);
      sessionTimeRef.current += 1;
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionState]);

  // Data Fetching Hooks...
  useEffect(() => {
    const fetchCurriculum = async () => {
      try {
        const response = await axios.get(
          "http://localhost:8000/curriculum/my",
          { headers: { Authorization: `Bearer ${token}` } }
        );
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
        setErrorMessage("Failed to load curriculum. Please try again later.");
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
        setErrorMessage("Failed to load history.");
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
        setErrorMessage("Failed to load summary/quiz.");
      }
    };
    fetchSummary();
  }, [sessionState, studyLesson, token]);

  // Attention Calc
  useEffect(() => {
    if (sessionState !== "active" || eegData.length === 0) return;
    const now = Date.now();
    const timeSinceLastUpdate = now - lastAttentionUpdateRef.current;
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
    setAttention(attentionScore);
    setAttentionHistory((prev) => [
      ...prev,
      { timestamp: Date.now(), attention: attentionScore },
    ]);
  }, [eegData, sessionState]);

  // Iframe Handling
  useEffect(() => {
    if (
      (showRefocusQuiz || showFocusAlert || showFunFact || showAppreciationModal) &&
      playerIframeRef.current?.contentWindow
    ) {
      try {
        playerIframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
          "*"
        );
      } catch (err) {
        console.error("Error in postMessage to iframe:", err);
      }
      if (document.fullscreenElement) {
        document
          .exitFullscreen()
          .catch((err) => console.error("Error exiting fullscreen:", err));
      }
    }
  }, [showRefocusQuiz, showFocusAlert, showFunFact, showAppreciationModal]);

  // Render logic...
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
        username={username}
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
        username={username}
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
        username={username}
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
        username={username}
      />
    );
  }
  if (sessionState === "quiz") {
    return (
      <div className="min-h-screen bg-stone-50 pt-28 pb-12 selection:bg-orange-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-orange-50 via-amber-50 to-stone-100 opacity-80 pointer-events-none" />
        <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-orange-300/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-10%] w-[30rem] h-[30rem] bg-amber-200/20 rounded-full blur-[80px] pointer-events-none" />
        
        <Header
          user={username}
          role="Learner"
          onLogout={onLogout}
          accessibility={accessibility}
        />
        <main className="container mx-auto px-4 md:px-8 max-w-4xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <QuizGame
              subject={quizSubject}
              questions={mcqs}
              attention={attention}
              onFinish={async (result) => {
                const withSubject = {
                  timestamp: new Date(),
                  subject: quizSubject,
                  score: `${result.score}/${result.total}`,
                };
                await saveHistory((prev) => ({
                  ...prev,
                  recent_quizzes: [...(prev.recent_quizzes || []), withSubject],
                }));
                restartSession();
              }}
              focusStats={() => ({
                avg:
                  attentionHistory.reduce((sum, d) => sum + d.attention, 0) /
                  (attentionHistory.length || 1),
                max: Math.max(...attentionHistory.map((d) => d.attention)),
                min: Math.min(...attentionHistory.map((d) => d.attention)),
              })}
            />
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showAppreciationModal && (
          <AppreciationModal onClose={() => {
              setShowAppreciationModal(false);
              isAlertOpenRef.current = false;
              lastInterventionTimeRef.current = Date.now();
          }} />
        )}
      </AnimatePresence>

      <div style={{ display: "none" }}>
        <video
          ref={videoRef}
          width={GAZE_VIDEO_WIDTH}
          height={GAZE_VIDEO_HEIGHT}
          autoPlay
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          width={GAZE_VIDEO_WIDTH}
          height={GAZE_VIDEO_HEIGHT}
        />
      </div>

      <Header
        user={username}
        role="Learner"
        onLogout={onLogout}
        accessibility={accessibility}
        focusMode={{ isFocusMode, toggleFocusMode }}
        attention={attention}
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
        gazeStatus={latestGaze?.status || "N/A"}
      />
    </>
  );
};
