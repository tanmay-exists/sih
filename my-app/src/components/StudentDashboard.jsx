import React, { useState, useEffect, useRef } from "react";
import { Card, Button, Header, MetricCard, ListenButton } from "./Common"; // Adjust path as needed
import { SessionSummary } from "./SessionSummary"; // Adjust path as needed
import useDemoStream from "./useDemoStream"; // Adjust path as needed
import useFocusMode from "./useFocusMode"; // Adjust path as needed
import { motion, AnimatePresence } from "framer-motion";
import { QuizGame } from "./QuizGame"; // Adjust path as needed
import { StudyContent } from "./StudyContent";
import { RefocusQuizModal } from "./RefocusQuizModal";
import { EegStreamChart, SessionLog, DynamicFeedbackPanel, FocusAlert } from "./Components";
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

  const [history, setHistory] = useState(() => { try { const r = localStorage.getItem('neurolearn_history'); return r ? JSON.parse(r) : { s: [], q: [] }; } catch (_) { return { s: [], q: [] }; } });
  const [quizSubject, setQuizSubject] = useState('Math');
  const [studySubject, setStudySubject] = useState(null);
  const [studyContentType, setStudyContentType] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const sessionTimeRef = useRef(0);

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
        setTimeout(() => setShowFocusAlert(null), 5000);
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
        <Header user="Student" role="Learner" onLogout={onLogout} accessibility={accessibility} />
        <div className="min-h-screen flex items-center justify-center bg-theme-bg">
          <img
            src="https://png.pngtree.com/thumb_back/fw800/background/20240104/pngtree-trendy-doodle-texture-flat-vector-illustration-of-hand-drawn-abstract-shapes-image_13915914.png"
            alt="Ready to Begin background"
            className="absolute inset-0 w-full h-full z-0 opacity-5 object-cover opacity-30 pointer-events-none"
          />
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-5 gap-8 p-6">
            <Card className="text-center lg:col-span-3 p-8 flex flex-col justify-center">
              <h2 className="text-3xl font-bold text-theme-primary mb-4">Ready to Begin?</h2>
              <p className="text-theme-text/80 mb-6">Start a new session to track your attention while you study.</p>
              <div className="mt-6"><Button onClick={() => setSessionState('selecting-subject')} className="bg-theme-primary hover:bg-theme-primary/90 w-full max-w-xs mx-auto">Start Study Session</Button></div>
            </Card>
            <Card className="lg:col-span-2 p-8 flex flex-col h-[450px]">
              <h3 className="text-xl font-semibold text-theme-primary mb-4 shrink-0">Your History</h3>
              <div className="flex-grow space-y-4 overflow-y-auto pr-2">
                <div>
                  <p className="text-sm font-bold text-theme-text/70 mb-2">Recent Sessions</p>
                  {(!history.sessions || history.sessions.length === 0) && <p className="text-sm text-theme-text/60">No sessions yet.</p>}
                  {history.sessions?.slice(-10).reverse().map((s, i) => (
                    <div key={i} className="text-sm flex justify-between bg-theme-surface/50 px-3 py-2 rounded border border-theme-border mb-2">
                      <span>{formatDateTime(s.endedAt)}</span>
                      <span className="font-semibold">{Math.floor(s.duration / 60)}m {s.duration % 60}s</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-bold text-theme-text/70 mb-2">Recent Quizzes</p>
                  {(!history.quizzes || history.quizzes.length === 0) && <p className="text-sm text-theme-text/60">No quizzes yet.</p>}
                  {history.quizzes?.slice(-10).reverse().map((q, i) => (
                    <div key={i} className="text-sm flex justify-between bg-theme-surface/50 px-3 py-2 rounded border border-theme-border mb-2">
                      <span>{formatDateTime(q.completedAt)}</span>
                      <span className="font-semibold">{q.subject || 'Quiz'}: {q.score}/{q.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </>
    );
  }

  if (sessionState === 'selecting-subject') {
    const subjects = Object.keys(STUDY_MATERIALS);
    return (
      <div className="min-h-screen pt-24 bg-theme-bg">
        <Header user="Student" role="Learner" onLogout={onLogout} accessibility={accessibility} />
        <main className="container mx-auto px-6 py-8 max-w-3xl">
          <Card className="text-center">
            <h2 className="text-2xl font-bold text-theme-primary mb-2">Choose Your Study Material</h2>
            <p className="text-theme-text/80 mb-6">Select a subject and a format to begin your session.</p>
            <div>
              <p className="font-semibold text-theme-text mb-3">Step 1: Choose a Subject</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {subjects.map(s => (
                  <Button key={s} onClick={() => setSelectedSubject(s)} className={`${selectedSubject === s ? 'bg-theme-primary' : 'bg-theme-secondary/80 hover:bg-theme-secondary'} !text-theme-text`}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            {selectedSubject && (
              <motion.div className="mt-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <p className="font-semibold text-theme-text mb-3">Step 2: Choose a Format</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button onClick={() => startStudySession(selectedSubject, 'video')} className="bg-theme-primary hover:bg-theme-primary/90">Watch a Video</Button>
                  <Button onClick={() => startStudySession(selectedSubject, 'article')} className="bg-theme-primary hover:bg-theme-primary/90">Read an Article</Button>
                </div>
              </motion.div>
            )}
            <Button onClick={restartSession} className="bg-theme-accent hover:bg-theme-accent/90 w-full mt-6 text-gray-800">Cancel</Button>
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
        <Header user="Student" role="Learner" onLogout={onLogout} accessibility={accessibility} />
        <div className="container mx-auto px-6 py-8">
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
      </>
    );
  }

  if (sessionState === 'quiz' || sessionState === 'quiz-subject') {
    return (
      <div className="min-h-screen pt-24 bg-theme-bg">
        <Header user="Student" role="Learner" onLogout={onLogout} accessibility={accessibility} />
        <main className="container mx-auto px-6 py-8 max-w-3xl">
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
    <div className="min-h-screen pt-24 bg-theme-bg">
      <Header user="Student" role="Learner" onLogout={onLogout} accessibility={accessibility} focusMode={{ isFocusMode, toggleFocusMode }} />
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
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <MetricCard title="Session Time" value={formatTime(sessionTime)} />
          <MetricCard title="Attention" value={attention.toFixed(0)} unit="%" />
          <MetricCard title="Focus Streak" value={focusStreak.toFixed(0)} unit="s" />
          <Card className="flex items-center justify-center">
            <Button onClick={endSession} className="bg-theme-accent hover:bg-theme-accent/90 w-full">End Session</Button>
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
