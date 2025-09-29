import React, { useState, useEffect, useRef } from "react";
import { Card, Button, Header, MetricCard, ListenButton } from "./Common"; // Adjust path as needed
import { SessionSummary } from "./SessionSummary"; // Adjust path as needed
import useDemoStream from "./useDemoStream"; // Adjust path as needed
import useFocusMode from "./useFocusMode"; // Adjust path as needed
import { motion, AnimatePresence } from "framer-motion";
import { QuizGame } from "./QuizGame"; // Adjust path as needed
import { StudyContent } from "./StudyContent";
import { RefocusQuizModal } from "./RefocusQuizModal";
import { EegStreamChart, SessionLog, DynamicFeedbackPanel, FocusAlert, HeadsetAlert } from "./Components";
import { STUDY_MATERIALS } from "./Utils";

export const StudentDashboard = ({ onLogout, accessibility }) => {
  const [sessionState, setSessionState] = useState('idle');
  const [sessionTime, setSessionTime] = useState(0);
  const { isFocusMode, toggleFocusMode } = useFocusMode();

  const playerIframeRef = useRef(null);

  const { eegData } = useDemoStream(sessionState === 'active' || sessionState === 'quiz');

  const [attention, setAttention] = useState(95);
  const [focusStreak, setFocusStreak] = useState(0);
  const [sessionEvents, setSessionEvents] = useState([]);
  const [attentionHistory, setAttentionHistory] = useState([]);
  const [showRefocusQuiz, setShowRefocusQuiz] = useState(false);
  const [showFocusAlert, setShowFocusAlert] = useState(null); // Track alert message or null
  const [showHeadsetAlert, setShowHeadsetAlert] = useState(false); // Track headset alert

  const [history, setHistory] = useState(() => { try { const r = localStorage.getItem('neurolearn_history'); return r ? JSON.parse(r) : { s: [], q: [] }; } catch (_) { return { s: [], q: [] }; } });
  const [quizSubject, setQuizSubject] = useState('Math');
  const [studySubject, setStudySubject] = useState(null);
  const [studyContentType, setStudyContentType] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const sessionTimeRef = useRef(0);

  // Trigger HeadsetAlert on idle state load
  useEffect(() => {
    if (sessionState === 'idle') {
      setShowHeadsetAlert(true);
    } else {
      setShowHeadsetAlert(false);
    }
  }, [sessionState]);

  // Pause video for refocus quiz
  useEffect(() => {
    if (showRefocusQuiz && playerIframeRef.current?.contentWindow) {
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
  }, [showRefocusQuiz]);

  // Pause video for focus alerts
  useEffect(() => {
    if (showFocusAlert && playerIframeRef.current?.contentWindow) {
      try {
        playerIframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
          "*"
        );
      } catch {}
    }
  }, [showFocusAlert]);

  // Manage attention and notifications
  useEffect(() => {
    if (sessionState !== 'active') return;

    const interval = setInterval(() => {
      setAttention(prevAttention => {
        if (showRefocusQuiz) return prevAttention;
        const newAttention = Math.max(0, prevAttention - 1);

        setFocusStreak(currentStreak => {
          if (newAttention >= 60) {
            return currentStreak + 1;
          } else {
            if (currentStreak > 5) {
              setSessionEvents(prev => [{ timestamp: Date.now(), event: `Focus Streak Lost (${currentStreak}s)`, attention: Math.round(newAttention) }, ...prev]);
            }
            return 0;
          }
        });

        if (sessionTimeRef.current % 10 === 0 && sessionTimeRef.current > 0) {
          const eventType = newAttention >= 75 ? "Peak Focus" : "Major Distraction";
          setSessionEvents(prev => [{ timestamp: Date.now(), event: eventType, attention: Math.round(newAttention) }, ...prev]);
        }

        return newAttention;
      });

      setAttentionHistory(prev => [...prev, { timestamp: Date.now(), attention }]);
      setSessionTime(t => t + 1);
      sessionTimeRef.current += 1;

      // Show focus alerts at 8, 20, and 32 seconds
      if (sessionTimeRef.current === 8) {
        setShowFocusAlert("Your focus is slipping! Take a deep breath and refocus on the material.");
        setTimeout(() => setShowFocusAlert(null), 3000);
      } else if (sessionTimeRef.current === 20) {
        setShowFocusAlert("Stay engaged! Keep your attention on the content to maximize learning.");
        setTimeout(() => setShowFocusAlert(null), 3000);
      } else if (sessionTimeRef.current === 32) {
        setShowFocusAlert("Your focus is decreasing. Try adjusting your posture or taking a quick stretch.");
        setTimeout(() => setShowFocusAlert(null), 3000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionState, showRefocusQuiz, attention]);

  // Trigger refocus quiz at 50% attention
  useEffect(() => {
    if (sessionState === 'active' && !showRefocusQuiz && attention < 50 && attention > 0) {
      setShowRefocusQuiz(true);
    }
  }, [attention, sessionState, showRefocusQuiz]);

  const endSession = () => setSessionState('finished');

  const restartSession = () => {
    setStudySubject(null);
    setStudyContentType(null);
    setSelectedSubject(null);
    setShowRefocusQuiz(false);
    setShowFocusAlert(null);
    setShowHeadsetAlert(false);
    setSessionState('idle');
    setAttention(95);
    setFocusStreak(0);
    setSessionEvents([]);
    setAttentionHistory([]);
    setSessionTime(0);
    sessionTimeRef.current = 0;
  };

  const startStudySession = (subject, type) => {
    restartSession();
    setStudySubject(subject);
    setStudyContentType(type);
    setSelectedSubject(null);
    setSessionState('active');
    setSessionEvents([{ timestamp: Date.now(), event: "Session Started", attention: 95 }]);
  };

  const saveHistory = (updater) => {
    setHistory(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem('neurolearn_history', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const formatDateTime = (timestamp) => { const d = new Date(timestamp); return `${d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}, ${d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})}`; };

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
              <div className="mt-6">
                <Button 
                  onClick={() => setSessionState('selecting-subject')} 
                  className="bg-orange-500 hover:bg-orange-600 text-white w-full max-w-sm mx-auto px-6 py-3 text-lg rounded-lg"
                >
                  Start Study Session
                </Button>
              </div>
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
          {showHeadsetAlert && (
            <HeadsetAlert 
              onClose={() => {
                setShowHeadsetAlert(false);
              }} 
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  if (sessionState === 'selecting-subject') {
    const subjects = Object.keys(STUDY_MATERIALS);
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
                    key={s} 
                    onClick={() => setSelectedSubject(s)} 
                    className={`${selectedSubject === s ? 'bg-orange-500 text-white' : 'bg-amber-400 hover:bg-amber-500 text-warmGray-800'} px-6 py-3 text-lg rounded-lg`}
                  >
                    {s}
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
            <Button onClick={restartSession} className="bg-red-500 hover:bg-red-600 text-warmGray-800 w-full mt-8 px-6 py-3 text-lg rounded-lg">Cancel</Button>
          </Card>
        </main>
      </div>
    );
  }

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
                if (studySubject) {
                  setQuizSubject(studySubject);
                  setSessionState('quiz');
                } else {
                  setSessionState('quiz-subject');
                }
              }}
              attentionHistory={attentionHistory}
              attention={attention}
            />
          </div>
        </div>
      </>
    );
  }

  if (sessionState === 'quiz' || sessionState === 'quiz-subject') {
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

  return (
    <div className="min-h-screen pt-32 bg-warmGray-100">
      <Header user="Student" role="Learner" onLogout={onLogout} accessibility={accessibility} focusMode={{ isFocusMode, toggleFocusMode }} className="h-24 bg-orange-100 text-amber-900 shadow-md" />
      <AnimatePresence>
        {showRefocusQuiz && (
          <RefocusQuizModal
            subject={studySubject || 'GK'}
            attention={attention}
            onFinish={(result) => {
              const withSubject = { ...result, subject: studySubject || 'GK' };
              saveHistory(prev => ({ ...prev, quizzes: [...(prev.quizzes || []), withSubject] }));
              setShowRefocusQuiz(false);
              setAttention(75);
            }}
          />
        )}
        {showFocusAlert && (
          <FocusAlert message={showFocusAlert} onClose={() => setShowFocusAlert(null)} />
        )}
      </AnimatePresence>
      <main className="container mx-auto px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <MetricCard title="Session Time" value={formatTime(sessionTime)} />
          <MetricCard title="Attention" value={attention.toFixed(0)} unit="%" />
          <MetricCard title="Focus Streak" value={focusStreak.toFixed(0)} unit="s" />
          <Card className="flex items-center justify-center">
            <Button onClick={endSession} className="bg-red-500 hover:bg-amber-500 text-warmGray-800 w-full">End Session</Button>
          </Card>
        </div>
        <div className="mb-6">
          <StudyContent subject={studySubject} type={studyContentType} videoRef={playerIframeRef} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><EegStreamChart data={eegData} /></div>
          <div className="space-y-6">
            <DynamicFeedbackPanel attention={attention} streak={focusStreak} />
            <SessionLog events={sessionEvents} />
          </div>
        </div>
      </main>
    </div>
  );
};
