import React, { useState, useEffect } from "react";
import { Card, Button, Header, IconDownload, MetricCard, ListenButton } from "./Common";
import { SessionSummary } from "./SessionSummary";
import useDemoStream from "./useDemoStream";
import useFocusMode from "./useFocusMode";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { QuizGame } from "./QuizGame";

// --- NEW, MODERN SVG ICONS ---
const IconBrainCircuit = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.573L16.5 21.75l-.398-1.177a3.375 3.375 0 00-2.456-2.456L12.75 18l1.177-.398a3.375 3.375 0 002.456-2.456L16.5 14.25l.398 1.177a3.375 3.375 0 002.456 2.456L20.25 18l-1.177.398a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
);

const IconUserModern = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
);

const IconTeacherModern = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
);

const IconSettings = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-1.007 1.11-1.226.55-.22 1.156-.22 1.706 0 .55.22 1.02.684 1.11 1.226l.094.542c.063.372.363.633.742.742l.542.094c.542.09.94.56 1.226 1.11.22.55.22 1.156 0 1.706-.22.55-.684 1.02-1.226 1.11l-.542.094c-.372.063-.633.363-.742.742l-.094.542c-.09.542-.56 1.007-1.11 1.226-.55.22-1.156.22-1.706 0-.55-.22-1.02-.684-1.11-1.226l-.094-.542c-.063-.372-.363-.633-.742-.742l-.542-.094c-.542-.09-1.007-.56-1.226-1.11-.22-.55-.22-1.156 0-1.706.22-.55.684 1.02 1.226 1.11l.542.094c.372-.063.633-.363.742-.742l.094-.542z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

// --- NEW ICON for the alert dialog ---
const IconAlertTriangle = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);



// --- Data for the Study Content feature (Now with 3 pages per article) ---
const STUDY_MATERIALS = {
    Math: {
        video: "https://www.youtube.com/embed/_gPz_E3aA8c", // Basic Algebra
        article: {
            title: "Fundamentals of Arithmetic",
            content: [
                "Addition and subtraction are the most basic operations in math. Addition combines quantities, like finding the total of 5 + 7, which equals 12. It's like putting two groups of items together. Subtraction is the opposite; it's about taking away. For example, 9 - 4 means we start with 9 items and remove 4, leaving us with 5. These operations are fundamental to everyday calculations, from managing money to tracking time.",
                "Multiplication is essentially a shortcut for repeated addition. When we calculate 6 × 7, we are really adding 6 to itself 7 times (or vice-versa), which gives us 42. It's a powerful tool for scaling numbers and calculating areas. For instance, if a garden has 6 rows of 7 plants each, you can quickly find the total number of plants by multiplying. Mastering multiplication tables is a key step in becoming fluent in mathematics.",
                "Division is the process of splitting a number into equal parts or groups. It answers the question, 'How many times does one number fit into another?' For example, 56 ÷ 8 asks how many groups of 8 we can make from 56. The answer is 7. Division is the inverse of multiplication, just as subtraction is the inverse of addition. It's used for sharing, distributing items evenly, and calculating rates like speed (distance divided by time)."
            ]
        }
    },
    Science: {
        video: "https://www.youtube.com/embed/lQAGV7BS_08", // Photosynthesis
        article: {
            title: "Essentials of Life Science",
            content: [
                "Water is a unique substance with special properties essential for life. One of its most well-known properties is its change of state based on temperature. At sea level, pure water freezes into ice at 0° Celsius (32° Fahrenheit). When heated, its temperature rises until it reaches its boiling point at 100° Celsius (212° Fahrenheit), at which point it turns into steam. These precise temperatures are key reference points in science.",
                "Plants play a crucial role in our planet's ecosystem through a process called photosynthesis. They absorb carbon dioxide (CO2) from the atmosphere, along with water from the soil and energy from the sun. Using these ingredients, they create glucose (their food) and release oxygen as a byproduct. This is why forests are often called the 'lungs of the planet'—they take in the CO2 we exhale and produce the oxygen we need to breathe.",
                "Our planet, Earth, is the third planet from the Sun, located in a region called the 'habitable zone' where conditions are just right for liquid water and life. Humans, like all animals, depend on the oxygen produced by plants. Our respiratory system is designed to breathe in oxygen, which our bodies use to convert food into energy, and we exhale carbon dioxide as a waste product, completing a vital cycle with plants."
            ]
        }
    },
    English: {
        video: "https://www.youtube.com/embed/N-p-Qk24a-Y", // Parts of Speech
        article: {
            title: "Building Blocks of English",
            content: [
                "Words can have similar or opposite meanings. A 'synonym' is a word that means the same or nearly the same as another word. For example, 'joyful' is a synonym for 'happy.' An 'antonym' is a word with the opposite meaning. The antonym of 'begin' is 'end.' Expanding your knowledge of synonyms and antonyms is a great way to make your writing and speaking more precise and interesting.",
                "Verbs are action words, but they change form depending on the subject and tense. For subjects like 'he,' 'she,' or 'it,' we often add an '-s' to the verb in the present tense, so 'she goes to school' is correct. The 'tense' of a verb tells us when the action happened. The past tense of 'eat' is 'ate.' Understanding these rules is crucial for forming clear and grammatically correct sentences.",
                "Nouns are words for people, places, or things. Most nouns can be made plural to show there is more than one. While many nouns just add an '-s,' some are irregular. The plural of 'child' is not 'childs,' but 'children.' Learning these irregular plurals is a common step in mastering English grammar and helps avoid simple mistakes in writing."
            ]
        }
    },
    GK: { // General Knowledge
        video: "https://www.youtube.com/embed/jvdpo_a_y8k", // Solar System
        article: {
            title: "A Glimpse of Our World",
            content: [
                "Every country has a capital city that serves as the center of its government. The capital of India is New Delhi, which is part of the larger metropolis of Delhi. On a global scale, our planet is divided into large landmasses called continents. There are seven continents in total: Asia, Africa, North America, South America, Antarctica, Europe, and Australia (sometimes called Oceania).",
                "Earth's surface is mostly covered by water, which is divided into five major oceans. The largest and deepest of these is the Pacific Ocean. Our planet also features incredible mountain ranges. The tallest mountain on Earth is Mount Everest, located in the Himalayas. Its peak reaches an astonishing 8,848 meters (29,032 feet) above sea level, making it the highest point on the planet.",
                "Countries often have national symbols that represent their identity, history, and wildlife. These symbols can include a national bird, flower, or animal. The national animal of India is the majestic Tiger. Known for its power, grace, and distinctive orange coat with black stripes, the tiger is a powerful symbol of the country's rich natural heritage and conservation efforts."
            ]
        }
    }
};

// --- Component to display the study material (Now with pagination) ---
const StudyContent = ({ subject, type }) => {
    const [currentPage, setCurrentPage] = useState(0);

    // Reset to the first page if the subject changes
    useEffect(() => {
        setCurrentPage(0);
    }, [subject]);
    
    if (!subject || !type) return null;

    const material = STUDY_MATERIALS[subject];
    if (!material) return <Card><p>Content not found for this subject.</p></Card>;
    
    const isArticle = type === 'article';
    const articlePages = isArticle ? material.article.content : [];

    return (
        <Card className="w-full">
            {isArticle ? (
                <div>
                    <h2 className="text-xl font-bold text-theme-primary mb-3">{material.article.title}</h2>
                    <p className="text-theme-text/90 leading-relaxed text-left mb-4 min-h-[12rem]">
                        {articlePages[currentPage]}
                    </p>
                    <div className="flex justify-between items-center mt-4">
                        <Button
                            onClick={() => setCurrentPage(p => p - 1)}
                            disabled={currentPage === 0}
                            className="bg-theme-secondary/80 hover:bg-theme-secondary !text-theme-text"
                        >
                            Back
                        </Button>
                        <span className="text-sm font-semibold text-theme-text/80">
                            Page {currentPage + 1} of {articlePages.length}
                        </span>
                        <Button
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage >= articlePages.length - 1}
                            className="bg-theme-secondary/80 hover:bg-theme-secondary !text-theme-text"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            ) : (
                <div>
                    <h2 className="text-xl font-bold text-theme-primary mb-4">{material.article.title} (Video)</h2>
                    <div className="aspect-w-16 aspect-h-9">
                        <iframe
                            src={material.video}
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full h-full rounded-lg"
                        ></iframe>
                    </div>
                </div>
            )}
        </Card>
    );
};


function useClassDataStream() {
    const [students, setStudents] = useState([
        { name: "Alice", attention: 76, status: "Focused" },
        { name: "Bob", attention: 62, status: "Engaged" },
        { name: "Charlie", attention: 89, status: "Focused" },
        { name: "David", attention: 35, status: "Distracted" },
        { name: "Eve", attention: 92, status: "Focused" },
    ]);

    useEffect(() => {
        const interval = setInterval(() => {
            setStudents(prevStudents =>
                prevStudents.map(s => {
                    const drift = (Math.random() - 0.45) * 10;
                    const newAttention = Math.max(10, Math.min(100, s.attention + drift));
                    const status = newAttention > 65 ? "Focused" : newAttention > 40 ? "Engaged" : "Distracted";
                    return { ...s, attention: newAttention, status };
                })
            );
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    return students;
}



// --- NEW: A modal dialog for the refocus quiz ---
const RefocusQuizModal = ({ subject, onFinish, attention }) => {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full max-w-2xl"
            >
                <Card className="!border-theme-accent">
                    <div className="text-center mb-4">
                        <div className="flex justify-center items-center gap-3 text-theme-accent">
                            <IconAlertTriangle className="w-8 h-8" />
                            <h2 className="text-2xl font-bold">Attention is Low!</h2>
                        </div>
                        <p className="text-theme-text/80 mt-2">
                            Let's take a quick break and sharpen your focus with a 5-question quiz.
                        </p>
                    </div>
                    <QuizGame
                        subject={subject}
                        attention={attention}
                        onFinish={onFinish}
                        focusStats={() => null} 
                    />
                </Card>
            </motion.div>
        </div>
    );
};


// --- NEW: Top-level App component to manage view state ---
export const App = () => {
    const [view, setView] = useState('landing'); // landing, login, student, teacher
    
    const handleLogin = (role) => {
        setView(role);
    };

    const handleLogout = () => {
        setView('landing');
    };

    if (view === 'landing') {
        return <LoginPage onLogin={handleLogin} />;
    }

    if (view === 'student') {
        return <StudentDashboard onLogout={handleLogout} />;
    }
    
    if (view === 'teacher') {
        return <TeacherDashboard onLogout={handleLogout} />;
    }

    return null; // Should not happen
};

// --- REVAMPED: Landing/Login Page ---
export const LoginPage = ({ onLogin }) => {
    return (
        <div className="min-h-screen w-full bg-theme-bg text-theme-text overflow-hidden">
            <div
                className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-cover bg-center"
                style={{ backgroundImage: `url('https://images.unsplash.com/photo-1620428268482-cf1851a36764?q=80&w=2832&auto=format&fit=crop')` }}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
                <div className="relative z-10 text-center text-white max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="mb-6 flex justify-center items-center gap-3 text-3xl font-bold text-theme-primary"
                    >
                        <IconBrainCircuit className="w-10 h-10" />
                        <h1 className="tracking-tight">NeuroLearn</h1>
                    </motion.div>
                    <motion.h2
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                        className="text-4xl md:text-6xl font-extrabold tracking-tight"
                    >
                        Unlock Your <span className="text-theme-primary">Deep Focus</span>.
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                        className="mt-4 max-w-2xl mx-auto text-lg md:text-xl text-gray-300"
                    >
                        The intelligent study partner that uses BCI technology to monitor your attention, providing real-time feedback to help you study smarter, not harder.
                    </motion.p>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
                        className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <Button
                            onClick={() => onLogin("student")}
                            className="w-64 bg-theme-primary hover:bg-theme-primary/90 text-lg py-3"
                            icon={<IconUserModern className="mr-2 h-6 w-6" />}
                        >
                            Login as Student
                        </Button>
                        <Button
                            onClick={() => onLogin("teacher")}
                            className="w-64 bg-theme-secondary hover:bg-theme-secondary/90 !text-theme-text text-lg py-3"
                            icon={<IconTeacherModern className="mr-2 h-6 w-6" />}
                        >
                            Login as Teacher
                        </Button>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export const StudentDashboard = ({ onLogout, accessibility }) => {
    const [sessionState, setSessionState] = useState('idle');
    const [sessionTime, setSessionTime] = useState(0);
    
    // --- MODIFIED: Destructure the new setAttentionTarget function ---
    const { attention, eegData, sessionEvents, focusStreak, attentionHistory, setAttentionTarget } = useDemoStream(sessionState === 'active');
    
    const { isFocusMode, toggleFocusMode } = useFocusMode();
    const [history, setHistory] = useState(() => {
        try {
            const raw = localStorage.getItem('neurolearn_history');
            return raw ? JSON.parse(raw) : { sessions: [], quizzes: [] };
        } catch (_) {
            return { sessions: [], quizzes: [] };
        }
    });
    
    const [quizSubject, setQuizSubject] = useState('Math');
    const [quizAttentionSamples, setQuizAttentionSamples] = useState([]);
    
    const [studySubject, setStudySubject] = useState(null);
    const [studyContentType, setStudyContentType] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState(null);

    const [showRefocusQuiz, setShowRefocusQuiz] = useState(false);

    useEffect(() => {
        if (sessionState !== 'active') return;
        const timer = setInterval(() => setSessionTime(t => t + 1), 1000);
        return () => clearInterval(timer);
    }, [sessionState]);

    useEffect(() => {
        if (sessionState === 'active' && !showRefocusQuiz && attention > 0 && attention <= 49) {
            setShowRefocusQuiz(true);
        }
    }, [attention, sessionState, showRefocusQuiz]);

    const endSession = () => setSessionState('finished');

    const restartSession = () => {
        setStudySubject(null);
        setStudyContentType(null);
        setSelectedSubject(null);
        setShowRefocusQuiz(false);
        setSessionState('idle');
    };
    
    const startStudySession = (subject, type) => {
        setStudySubject(subject);
        setStudyContentType(type);
        setSessionTime(0);
        setSelectedSubject(null);
        setSessionState('active');
    };

    const saveHistory = (updater) => {
        setHistory(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            try { localStorage.setItem('neurolearn_history', JSON.stringify(next)); } catch (_) {}
            return next;
        });
    };

    const formatTime = (seconds) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

    const formatDateTime = (timestamp) => {
        const date = new Date(timestamp);
        const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, ' ');
        const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${dateStr}, ${timeStr}`;
    };

    useEffect(() => {
        if (sessionState === 'quiz') setQuizAttentionSamples([]);
    }, [sessionState]);

    useEffect(() => {
        if (sessionState !== 'quiz') return;
        setQuizAttentionSamples(prev => {
            const next = [...prev, Math.max(0, Math.min(100, Number(attention) || 0))];
            return next.length > 600 ? next.slice(-600) : next;
        });
    }, [attention, sessionState]);

    if (sessionState === 'idle') {
        return (
            <>
                <Header user="Student" role="Learner" onLogout={onLogout} accessibility={accessibility} />
                <div className="min-h-screen flex items-center justify-center bg-theme-bg">
                    {/* --- FIX: Increased max-width for more space --- */}
                    <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-5 gap-8 p-6">
                        <Card className="text-center lg:col-span-3 p-8 flex flex-col justify-center">
                            <h2 className="text-3xl font-bold text-theme-primary mb-4">Ready to Begin?</h2>
                            <p className="text-theme-text/80 mb-6">Start a new session to track your attention while you study.</p>
                            <div className="mt-6">
                                <Button onClick={() => setSessionState('selecting-subject')} className="bg-theme-primary hover:bg-theme-primary/90 w-full max-w-xs mx-auto">
                                    Start Study Session
                                </Button>
                            </div>
                        </Card>
                        {/* --- FIX: Wider, vertically scrollable history box --- */}
                        <Card className="lg:col-span-2 p-8 flex flex-col h-[450px]">
                            <h3 className="text-xl font-semibold text-theme-primary mb-4 shrink-0">Your History</h3>
                            <div className="flex-grow space-y-4 overflow-y-auto pr-2">
                                <div>
                                    <p className="text-sm font-bold text-theme-text/70 mb-2">Recent Sessions</p>
                                    {history.sessions.length === 0 && <p className="text-sm text-theme-text/60">No sessions yet.</p>}
                                    {history.sessions.slice(-10).reverse().map((s, i) => (
                                        <div key={i} className="text-sm flex justify-between bg-theme-surface/50 px-3 py-2 rounded border border-theme-border mb-2">
                                            <span>{formatDateTime(s.endedAt)}</span>
                                            <span className="font-semibold">{Math.floor(s.duration / 60)}m {s.duration % 60}s</span>
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-theme-text/70 mb-2">Recent Quizzes</p>
                                    {history.quizzes.length === 0 && <p className="text-sm text-theme-text/60">No quizzes yet.</p>}
                                    {history.quizzes.slice(-10).reverse().map((q, i) => (
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
                <AnimatePresence>
                {showRefocusQuiz && (
                    <RefocusQuizModal
                        subject={studySubject || 'GK'}
                        attention={attention}
                        onFinish={(result) => {
                            const withSubject = { ...result, subject: studySubject || 'GK' };
                            saveHistory(prev => ({ ...prev, quizzes: [...prev.quizzes, withSubject] }));
                            
                            // --- FIX: Close the modal AND boost attention ---
                            setShowRefocusQuiz(false);
                            setAttentionTarget(75); // Reward with an attention boost to 75%
                        }}
                    />
                )}
            </AnimatePresence>
                <main className="container mx-auto px-6 py-8 max-w-3xl">
                    <Card className="text-center">
                        <h2 className="text-2xl font-bold text-theme-primary mb-2">Choose Your Study Material</h2>
                        <p className="text-theme-text/80 mb-6">Select a subject and a format to begin your session.</p>
                        
                        <div>
                            <p className="font-semibold text-theme-text mb-3">Step 1: Choose a Subject</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {subjects.map(s => (
                                    <Button
                                        key={s}
                                        onClick={() => setSelectedSubject(s)}
                                        className={`${selectedSubject === s ? 'bg-theme-primary' : 'bg-theme-secondary/80 hover:bg-theme-secondary'} !text-theme-text`}
                                    >
                                        {s}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {selectedSubject && (
                            <motion.div className="mt-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                <p className="font-semibold text-theme-text mb-3">Step 2: Choose a Format</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <Button onClick={() => startStudySession(selectedSubject, 'video')} className="bg-theme-primary hover:bg-theme-primary/90">
                                        Watch a Video
                                    </Button>
                                    <Button onClick={() => startStudySession(selectedSubject, 'article')} className="bg-theme-primary hover:bg-theme-primary/90">
                                        Read an Article
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                         <Button onClick={restartSession} className="bg-theme-accent hover:bg-theme-accent/90 w-full mt-6 text-gray-800">
                            Cancel
                        </Button>
                    </Card>
                </main>
            </div>
        );
    }

    if (sessionState === 'finished') {
        if (!history.__lastSavedFinishedAt || history.__lastSavedFinishedAt !== sessionTime) {
            saveHistory(prev => ({
                ...prev,
                __lastSavedFinishedAt: sessionTime,
                sessions: [...prev.sessions, { duration: sessionTime, endedAt: Date.now(), eventsCount: sessionEvents.length }]
            }));
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

    if (sessionState === 'quiz-subject') {
        return (
            <div className="min-h-screen pt-24 bg-theme-bg">
                <Header user="Student" role="Learner" onLogout={onLogout} accessibility={accessibility} />
                <main className="container mx-auto px-6 py-8 max-w-3xl">
                    <Card className="text-center">
                        <h2 className="text-2xl font-bold text-theme-primary mb-2">Choose a Subject</h2>
                        <p className="text-theme-text/80 mb-6">Pick a subject for your quick 5-question quiz.</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {['Math', 'Science', 'English', 'GK'].map(s => (
                                <Button key={s} onClick={() => { setQuizSubject(s); setSessionState('quiz'); }} className="bg-theme-secondary/80 hover:bg-theme-secondary !text-theme-text">
                                    {s}
                                </Button>
                            ))}
                        </div>
                        <Button onClick={restartSession} className="bg-theme-accent hover:bg-theme-accent/90 w-full mt-6 text-gray-800">
                            Cancel
                        </Button>
                    </Card>
                </main>
            </div>
        );
    }

    if (sessionState === 'quiz') {
        return (
            <div className="min-h-screen pt-24 bg-theme-bg">
                <Header user="Student" role="Learner" onLogout={onLogout} accessibility={accessibility} />
                <main className="container mx-auto px-6 py-8 max-w-3xl">
                    <QuizGame subject={quizSubject} attention={attention} focusStats={() => {
                        const values = quizAttentionSamples;
                        if (!values || values.length === 0) return null;
                        const sum = values.reduce((a, b) => a + b, 0);
                        return { avg: sum / values.length, max: Math.max(...values), min: Math.min(...values) };
                    }} onFinish={(result) => {
                        const withSubject = { ...result, subject: quizSubject };
                        saveHistory(prev => ({ ...prev, quizzes: [...prev.quizzes, withSubject] }));
                        restartSession();
                    }} />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 bg-theme-bg">
            <Header user="Student" role="Learner" onLogout={onLogout} accessibility={accessibility} focusMode={{ isFocusMode, toggleFocusMode }} />
            
            {/* --- NEW: Render the refocus quiz modal when needed --- */}
            <AnimatePresence>
                {showRefocusQuiz && (
                    <RefocusQuizModal
                        subject={studySubject || 'GK'} // Default to a subject if none is chosen
                        attention={attention}
                        onFinish={(result) => {
                            // Save the result of this refocus quiz to history
                            const withSubject = { ...result, subject: studySubject || 'GK' };
                            saveHistory(prev => ({ ...prev, quizzes: [...prev.quizzes, withSubject] }));
                            // Close the modal and return to the session
                            setShowRefocusQuiz(false);
                        }}
                    />
                )}
            </AnimatePresence>
            
            <main className="container mx-auto px-6 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <MetricCard title="Session Time" value={formatTime(sessionTime)} />
                    <MetricCard title="Attention" value={attention.toFixed(0)} unit="%" />
                    <MetricCard title="Focus Streak" value={focusStreak.toFixed(0)} unit="s" />
                    <Card className="flex items-center justify-center">
                        <Button onClick={endSession} className="bg-theme-accent hover:bg-theme-accent/90 w-full">
                            End Session
                        </Button>
                    </Card>
                </div>
                
                <div className="mb-6">
                    <StudyContent subject={studySubject} type={studyContentType} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <EegStreamChart data={eegData} />
                    </div>
                    <div className="space-y-6">
                        <DynamicFeedbackPanel attention={attention} streak={focusStreak} />
                        <SessionLog events={sessionEvents} />
                    </div>
                </div>
            </main>
        </div>
    );
};


export const TeacherDashboard = ({ onLogout, accessibility }) => {
    const students = useClassDataStream();
    const avgAttention = students.length > 0 ? students.reduce((acc, s) => acc + s.attention, 0) / students.length : 0;

    return (
        <div className="min-h-screen pt-24 bg-theme-bg">
            <Header user="Teacher" role="Admin" onLogout={onLogout} accessibility={accessibility} />
            <main className="container mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="lg:col-span-2">
                    <MetricCard title="Live Class Average Attention" value={avgAttention.toFixed(1)} unit="%" />
                </div>
                <ClassRoster students={students} />
                <ClassAttentionChart students={students} />
                <ModelSummary />
                <ExportTool />
            </main>
        </div>
    );
};

const EegStreamChart = ({ data }) => (
    <Card className="flex flex-col flex-grow min-h-[400px] h-full">
        <h2 className="text-2xl font-semibold mb-4 text-theme-primary shrink-0">Live Brain Activity (Beta Waves)</h2>
        <div className="flex-grow text-sm">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <XAxis dataKey="time" stroke="var(--color-text)" />
                    <YAxis stroke="var(--color-text)" domain={[0, 1]}/>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="Fp1" stroke="var(--color-primary)" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="Fp2" stroke="var(--color-accent)" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="Cz" stroke="var(--color-secondary)" dot={false} strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    </Card>
);

const SessionLog = ({ events }) => (
    <Card>
        <h2 className="text-xl font-semibold mb-4 text-theme-primary">Session Log</h2>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {events.map((e, i) => (
                <div key={i} className="flex justify-between text-sm bg-theme-surface/50 px-3 py-2 rounded-lg border border-theme-border">
                    <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
                    <span className="font-semibold">{e.event}</span>
                    <span className="text-theme-text/70">{e.attention}%</span>
                </div>
            ))}
            {events.length === 0 && <p className="text-center text-theme-text/60">No session events yet.</p>}
        </div>
    </Card>
);

const DynamicFeedbackPanel = ({ attention, streak }) => {
    let title = "Stay Engaged";
    let message = "Maintain a steady focus. You can do it!";
    if (attention > 80) {
        title = "Excellent Focus!";
        message = "You're in the zone. Keep up the great work!";
    } else if (attention < 45) {
        title = "Let's Refocus";
        message = "Your attention seems to be dropping. Try taking a deep breath or adjusting your posture.";
    } else if (streak > 30) {
        title = "Amazing Streak!";
        message = `You've been focused for over ${Math.floor(streak)} seconds. That's fantastic!`;
    }

    return (
        <Card>
            <div className="flex justify-between items-start">
                <h2 className="text-xl font-semibold mb-2 text-theme-primary">{title}</h2>
                <ListenButton text={message} />
            </div>
            <p className="text-theme-text/90 leading-relaxed">{message}</p>
        </Card>
    );
};

const ClassRoster = ({ students }) => {
    const getStatusColor = (status) => {
        if (status === "Focused") return "bg-green-500";
        if (status === "Engaged") return "bg-yellow-500";
        return "bg-red-500";
    };
    return (
        <Card>
            <h2 className="text-2xl font-semibold mb-4 text-theme-primary">Live Class Roster</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-theme-secondary/30">
                            <th className="px-4 py-3 font-semibold">Status</th>
                            <th className="px-4 py-3 font-semibold">Student</th>
                            <th className="px-4 py-3 font-semibold">Attention %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map((s) => (
                            <tr key={s.name} className="border-b border-theme-border last:border-b-0 hover:bg-theme-secondary/20 transition">
                                <td className="px-4 py-3">
                                    <span className="flex items-center gap-2">
                                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }} className={`w-3 h-3 rounded-full ${getStatusColor(s.status)}`}></motion.div>
                                        {s.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3">{s.name}</td>
                                <td className="px-4 py-3 font-bold">{s.attention.toFixed(1)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

const ClassAttentionChart = ({ students }) => (
    <Card>
        <h2 className="text-2xl font-semibold mb-4 text-theme-primary">Class Attention Overview</h2>
        <div className="h-80 text-sm">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={students}>
                    <XAxis dataKey="name" stroke="var(--color-text)" />
                    <YAxis stroke="var(--color-text)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
                    <Bar dataKey="attention" fill="var(--color-primary)" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    </Card>
);

const ModelSummary = () => (
    <Card>
        <h2 className="text-2xl font-semibold mb-4 text-theme-primary">Model Performance</h2>
        <p className="text-theme-text/90 leading-relaxed">
            Current Classifier: <strong>Random Forest</strong>
            <br />
            Accuracy: <strong>82%</strong> | Recall: <strong>78%</strong>
        </p>
    </Card>
);

const ExportTool = () => (
    <Card className="flex flex-col items-center justify-center">
        <h2 className="text-2xl font-semibold mb-4 text-theme-primary">Export Reports</h2>
        <Button className="bg-theme-primary hover:bg-theme-primary/90" icon={<IconDownload />}>
            Download PDF Report
        </Button>
    </Card>
);