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
  const [sessionState, setSessionState] = useState('idle');
  const [sessionTime, setSessionTime] = useState(0);
  const { isFocusMode, toggleFocusMode } = useFocusMode();
  const playerIframeRef = useRef(null);
  const { eegData, connectionStatus, latestVerdict } = useWebSocketStream(sessionState === 'active' || sessionState === 'quiz');
  const [attention, setAttention] = useState(null);
  const [focusStreak, setFocusStreak] = useState(0);
  const [sessionEvents, setSessionEvents] = useState([]);
  const [attentionHistory, setAttentionHistory] = useState([]);
  const [showRefocusQuiz, setShowRefocusQuiz] = useState(false);
  const [showFocusAlert, setShowFocusAlert] = useState(null);
  const [showHeadsetAlert, setShowHeadsetAlert] = useState(false);
  const [history, setHistory] = useState(() => {
    try {
      const r = localStorage.getItem('neurolearn_history');
      const parsed = r ? JSON.parse(r) : { s: [], q: [] };
      return { sessions: parsed.s || [], quizzes: parsed.q || [] };
    } catch (_) { return { sessions: [], quizzes: [] }; }
  });
  const [quizSubject, setQuizSubject] = useState(null);
  const [studySubject, setStudySubject] = useState(null);
  const [studyContentType, setStudyContentType] = useState('video');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [summary, setSummary] = useState("");
  const [mcqs, setMcqs] = useState([]);
  const [chatQuery, setChatQuery] = useState("");
  const [chatResponse, setChatResponse] = useState("");
  const sessionTimeRef = useRef(0);
  const lastVerdictTimeRef = useRef(Date.now());
  const lastLogTimeRef = useRef(Date.now());
  const lastAttentionUpdateRef = useRef(Date.now());
  const token = localStorage.getItem("token");

  // Fetch curriculum
  useEffect(() => {
    const fetchCurriculum = async () => {
      try {
        const response = await axios.get("http://localhost:8000/content/curriculum", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSubjects(response.data.subjects);
      } catch (err) {
        console.error("Error fetching curriculum:", err);
      }
    };
    if (token) fetchCurriculum();
  }, [token]);

  // Generate summary on session start
  useEffect(() => {
    if (sessionState !== 'active' || !studySubject) return;
    const fetchSummary = async () => {
      try {
        const response = await axios.post(
          "http://localhost:8000/tools/summarize-and-quiz",
          { lesson_id: studySubject },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSummary(response.data.summary);
        setMcqs(response.data.mcqs);
      } catch (err) {
        console.error("Error fetching summary:", err);
      }
    };
    fetchSummary();
  }, [sessionState, studySubject, token]);

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
    if (sessionState !== 'active' || eegData.length === 0) return;
    const now = Date.now();
    const timeSinceLastUpdate = now - lastAttentionUpdateRef.current;
    if (timeSinceLastUpdate < 1000) return;
    lastAttentionUpdateRef.current = now;
    const recentData = eegData.slice(-20);
    const values = recentData.map(d => Math.abs(d.value));
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    let attentionScore;
    if (mean < 100) {
      attentionScore = 100 - (mean * 0.2);
    } else if (mean < 200) {
      attentionScore = 80 - ((mean - 100) * 0.2);
    } else if (mean < 350) {
      attentionScore = 60 - ((mean - 200) * 0.2);
    } else {
      attentionScore = Math.max(10, 30 - ((mean - 350) * 0.05));
    }
    attentionScore = Math.min(100, Math.max(10, attentionScore));
    setAttention(attentionScore);
    setAttentionHistory(prev => [...prev, { timestamp: Date.now(), attention: attentionScore }]);
  }, [eegData, sessionState]);

  // Show alert for low attention
  useEffect(() => {
    if (sessionState !== 'active') return;
    if (attention !== null && attention < 50 && !showFocusAlert) {
      setShowFocusAlert("Your attention dropped! Please refocus.");
    } else if (attention >= 50 && showFocusAlert) {
      setShowFocusAlert(null);
    }
  }, [attention, sessionState, showFocusAlert]);

  // Trigger refocus quiz
  useEffect(() => {
    if (sessionState !== 'active') return;
    if (latestVerdict && latestVerdict.state !== 'FOCUSED' && !showRefocusQuiz) {
      setShowRefocusQuiz(true);
      setShowFocusAlert("Model detected low focus! Take a quick refocus quiz.");
    }
  }, [latestVerdict, sessionState, showRefocusQuiz]);

  // Logging and focus streak
  useEffect(() => {
    if (sessionState !== 'active') return;
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
        setSessionEvents(prev => [
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
    if (sessionState !== 'active') return;
    const timer = setInterval(() => {
      setSessionTime(t => t + 1);
      sessionTimeRef.current += 1;
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionState]);

  // Handlers
  const endSession = () => {
    setSessionEvents(prev => [{
      timestamp: Date.now(),
      event: "Session Ended",
      attention: attention !== null ? Math.round(attention) : 0,
      verdict: 'N/A'
    }, ...prev]);
    setSessionState('finished');
  };

  const handleRefocusQuizFinish = (result) => {
    const withSubject = { ...result, subject: studySubject || 'GK' };
    saveHistory(prev => ({ ...prev, quizzes: [...(prev.quizzes || []), withSubject] }));
    setShowRefocusQuiz(false);
    setShowFocusAlert(null);
    setAttention(60);
    lastVerdictTimeRef.current = Date.now();
  };

  const restartSession = () => {
    setStudySubject(null);
    setStudyContentType('video');
    setSelectedSubject(null);
    setShowRefocusQuiz(false);
    setShowFocusAlert(null);
    setShowHeadsetAlert(false);
    setSessionState('idle');
    setAttention(null);
    setFocusStreak(0);
    setSessionEvents([]);
    setAttentionHistory([]);
    setSessionTime(0);
    setSummary("");
    setMcqs([]);
    sessionTimeRef.current = 0;
    lastVerdictTimeRef.current = Date.now();
    lastLogTimeRef.current = Date.now();
    lastAttentionUpdateRef.current = Date.now();
  };

  const startStudySession = (subject, type) => {
    restartSession();
    setStudySubject(subject);
    setStudyContentType(type || 'video');
    setSessionState('active');
    const now = Date.now();
    setSessionEvents([{ timestamp: now, event: "Session Started", attention: 0, verdict: 'N/A' }]);
    lastLogTimeRef.current = now;
    lastAttentionUpdateRef.current = now;
  };

  const saveHistory = async (updater) => {
    setHistory(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem('neurolearn_history', JSON.stringify({ s: next.sessions || [], q: next.quizzes || [] }));
        axios.post("http://localhost:8000/history/", next, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
      return next;
    });
  };

  const handleChat = async () => {
    try {
      const response = await axios.post(
        "http://localhost:8000/tools/chatbot",
        { query: chatQuery, lesson_id: studySubject || 'GK' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setChatResponse(response.data.response);
    } catch (err) {
      console.error("Error in chatbot:", err);
      setChatResponse("Sorry, I couldn't process your query. Try again!");
    }
  };

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const formatDateTime = (timestamp) => {
    const d = new Date(timestamp);
    return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  };

  // Idle state
  if (sessionState === 'idle') {
    return (
      <>
        <Header user="Student" role="Learner" onLogout={onLogout} accessibility={accessibility} className="h-24 bg-orange-100 text-amber-900 shadow-md" />
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
              <Button
                onClick={() => setSessionState('selecting-subject')}
                className="bg-orange-500 hover:bg-orange-600 text-white w-full max-w-sm mx-auto px-6 py-3 text-lg rounded-lg"
              >
                Start Study Session
              </Button>
            </Card>
            <Card className="bg-amber-50 lg:col-span-2 p-10 flex flex-col h-[500px] rounded-xl shadow-lg border border-amber-200">
              <h3 className="text-2xl font-semibold text-orange-800 mb-6 shrink-0">Your History</h3>
              <div className="flex-grow space-y-6 overflow-y-auto pr-4">
                <div>
                  <p className="text-base font-bold text-warmGray-600 mb-3">Recent Sessions</p>
                  {(!history.sessions || history.sessions.length === 0) && <p className="text-base text-warmGray-500">No sessions yet.</p>}
                  {history.sessions?.slice(-10).reverse().map((s, i) => (
                    <div key={i} className="text-base flex justify-between bg-amber-100/50 px-4 py-3 rounded-lg border border-amber-200 mb-3">
                      <span>{formatDateTime(s.endedAt)}</span>
                      <span className="font-semibold">{Math.floor(s.duration / 60)}m {s.duration % 60}s</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-base font-bold text-warmGray-600 mb-3">Recent Quizzes</p>
                  {(!history.quizzes || history.quizzes.length === 0) && <p className="text-base text-warmGray-500">No quizzes yet.</p>}
                  {history.quizzes?.slice(-10).reverse().map((q, i) => (
                    <div key={i} className="text-base flex justify-between bg-amber-100/50 px-4 py-3 rounded-lg border border-amber-200 mb-3">
                      <span>{formatDateTime(q.completedAt)}</span>
                      <span className="font-semibold">{q.subject || 'Quiz'}: {q.score}/{q.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
        <AnimatePresence>
          {showHeadsetAlert && <HeadsetAlert onClose={() => setShowHeadsetAlert(false)} />}
        </AnimatePresence>
      </>
    );
  }

  // Selecting subject state
  if (sessionState === 'selecting-subject') {
    return (
      <div className="min-h-screen pt-32 bg-warmGray-100 relative">
        <img
          src="https://png.pngtree.com/thumb_back/fw800/background/20240104/pngtree-trendy-doodle-texture-flat-vector-illustration-of-hand-drawn-abstract-shapes-image_13915914.png"
          alt="Subject selection background"
          className="absolute inset-0 w-full h-full z-0 opacity-5 object-cover pointer-events-none"
        />
        <Header user="Student" role="Learner" onLogout={onLogout} accessibility={accessibility} className="h-24 bg-orange-100 text-amber-900 shadow-md" />
        <main className="container mx-auto px-8 py-10 max-w-4xl relative z-10">
          <Card className="bg-amber-50 text-center p-8 rounded-xl shadow-lg border border-amber-200">
            <h2 className="text-3xl font-bold text-orange-800 mb-4">Choose Your Study Material</h2>
            <p className="text-base text-warmGray-700 mb-8">Select a subject and a format to begin your session.</p>
            <div>
              <p className="text-lg font-semibold text-warmGray-800 mb-4">Step 1: Choose a Subject</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {subjects.map(s => (
                  <Button
                    key={s.name}
                    onClick={() => setSelectedSubject(s.name)}
                    className={`${selectedSubject === s.name ? 'bg-orange-500 text-white' : 'bg-amber-400 hover:bg-amber-500 text-warmGray-800'} px-6 py-3 text-lg rounded-lg`}
                  >
                    {s.name}
                  </Button>
                ))}
              </div>
            </div>
            {selectedSubject && (
              <motion.div className="mt-8" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-lg font-semibold text-warmGray-800 mb-4">Step 2: Choose a Format</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button onClick={() => startStudySession(selectedSubject, 'video')} className="bg-orange-400 hover:bg-orange-500 text-white px-6 py-3 text-lg rounded-lg">Watch a Video</Button>
                  <Button onClick={() => startStudySession(selectedSubject, 'article')} className="bg-orange-400 hover:bg-orange-500 text-white px-6 py-3 text-lg rounded-lg">Read an Article</Button>
                </div>
              </motion.div>
            )}
            <Button onClick={restartSession} className="bg-red-500 hover:bg-red-600 text-white w-full mt-8 px-6 py-3 text-lg rounded-lg">Cancel</Button>
          </Card>
        </main>
      </div>
    );
  }

  // Finished session state
  if (sessionState === 'finished') {
    if (!history.__lastSavedFinishedAt || history.__lastSavedFinishedAt !== sessionTime) {
      saveHistory(prev => ({ ...prev, __lastSavedFinishedAt: sessionTime, sessions: [...(prev.sessions || []), { duration: sessionTime, endedAt: Date.now(), eventsCount: sessionEvents.length }] }));
    }
    return (
      <>
        <Header user="Student" role="Learner" onLogout={onLogout} accessibility={accessibility} className="h-24 bg-orange-100 text-amber-900 shadow-md" />
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
              onStartNew={() => setSessionState('selecting-subject')}
              onTakeQuiz={() => {
                setQuizSubject(studySubject || 'GK');
                setSessionState('quiz');
              }}
              attentionHistory={attentionHistory}
              attention={attention}
            />
          </div>
        </div>
      </>
    );
  }

  // Quiz state
  if (sessionState === 'quiz') {
    return (
      <div className="min-h-screen pt-32 bg-warmGray-100 relative">
        <img
          src="https://png.pngtree.com/thumb_back/fw800/background/20240104/pngtree-trendy-doodle-texture-flat-vector-illustration-of-hand-drawn-abstract-shapes-image_13915914.png"
          alt="Quiz background"
          className="absolute inset-0 w-full h-full z-0 opacity-5 object-cover pointer-events-none"
        />
        <Header user="Student" role="Learner" onLogout={onLogout} accessibility={accessibility} className="h-24 bg-orange-100 text-amber-900 shadow-md" />
        <main className="container mx-auto px-8 py-10 max-w-4xl relative z-10">
          <QuizGame
            subject={quizSubject}
            questions={mcqs}
            attention={attention}
            onFinish={(result) => {
              const withSubject = { ...result, subject: quizSubject };
              saveHistory(prev => ({ ...prev, quizzes: [...(prev.quizzes || []), withSubject] }));
              restartSession();
            }}
            focusStats={() => null}
          />
        </main>
      </div>
    );
  }

  // Active study session state
  const displayAttention = attention !== null ? attention.toFixed(0) : '--';
  const currentSubject = subjects.find(s => s.name === studySubject);

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
          <RefocusQuizModal
            subject={studySubject || 'GK'}
            attention={attention || 50}
            onFinish={handleRefocusQuizFinish}
          />
        )}
        {showFocusAlert && (
          <FocusAlert message={showFocusAlert} onClose={() => setShowFocusAlert(null)} />
        )}
      </AnimatePresence>
      <main className="container mx-auto px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <MetricCard title="Session Time" value={formatTime(sessionTime)} />
          <MetricCard title="Attention" value={displayAttention} unit="%" />
          <MetricCard title="Focus Streak" value={focusStreak.toFixed(0)} unit="s" />
          <Card className="flex items-center justify-center">
            <Button onClick={endSession} className="bg-red-500 hover:bg-red-600 text-white w-full px-6 py-3 text-lg rounded-lg">End Session</Button>
          </Card>
        </div>
        <div className="mb-6">
          <div className="flex border-b border-amber-200 mb-4">
            <Button
              onClick={() => setStudyContentType('video')}
              className={`px-4 py-2 ${studyContentType === 'video' ? 'bg-orange-500 text-white' : 'bg-amber-100 text-warmGray-800'} rounded-t-lg`}
            >
              Video
            </Button>
            <Button
              onClick={() => setStudyContentType('article')}
              className={`px-4 py-2 ${studyContentType === 'article' ? 'bg-orange-500 text-white' : 'bg-amber-100 text-warmGray-800'} rounded-t-lg`}
            >
              Article
            </Button>
          </div>
          <StudyContent subject={currentSubject} type={studyContentType} videoRef={playerIframeRef} />
          {summary && (
            <Card className="mt-4 bg-amber-50 p-6 rounded-xl shadow-lg border border-amber-200">
              <h2 className="text-xl font-bold text-orange-800 mb-3">Quick Summary for the Test</h2>
              <p className="text-warmGray-700 leading-relaxed">{summary}</p>
              <ListenButton text={summary} />
            </Card>
          )}
          <Card className="mt-4 bg-amber-50 p-6 rounded-xl shadow-lg border border-amber-200">
            <h2 className="text-xl font-bold text-orange-800 mb-3">Ask NeuroLearn</h2>
            <input
              type="text"
              value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)}
              placeholder="Ask about the lesson..."
              className="w-full p-2 rounded bg-amber-100 text-warmGray-800 mb-2"
            />
            <Button onClick={handleChat} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 text-lg rounded-lg">
              Submit
            </Button>
            {chatResponse && (
              <div className="mt-4">
                <p className="text-warmGray-700">{chatResponse}</p>
                <ListenButton text={chatResponse} />
              </div>
            )}
          </Card>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><EegStreamChart data={eegData} /></div>
          <div className="space-y-6">
            <DynamicFeedbackPanel attention={attention || 0} streak={focusStreak} />
            <SessionLog events={sessionEvents} />
          </div>
        </div>
      </main>
    </div>
  );
};
