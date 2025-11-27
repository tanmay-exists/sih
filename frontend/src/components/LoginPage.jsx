// src/components/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { Button } from "./Common";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, User, UserCog, LogIn, ArrowRight, 
  Activity, Zap, ShieldCheck, X, Sparkles 
} from "lucide-react";
import axios from "axios";

// --- 3D Dashboard Preview Component ---
const MockDashboard3D = () => {
  return (
    <motion.div
      initial={{ rotateY: -20, rotateX: 10, y: 50, opacity: 0 }}
      animate={{ rotateY: -15, rotateX: 5, y: 0, opacity: 1 }}
      transition={{ duration: 1.5, ease: "easeOut" }}
      className="relative z-10 w-full max-w-lg hidden lg:block perspective-1000 origin-center"
      style={{ perspective: "1000px" }}
    >
      <motion.div
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="relative bg-white rounded-2xl shadow-2xl shadow-orange-500/20 border border-orange-100 overflow-hidden"
        style={{ transformStyle: "preserve-3d", rotateY: -15, rotateX: 5 }}
      >
        {/* Fake Browser Header */}
        <div className="h-8 bg-warmGray-50 border-b border-orange-100 flex items-center px-4 gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
          <div className="w-3 h-3 rounded-full bg-green-400"></div>
        </div>
        {/* Fake UI Content */}
        <div className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-8 w-32 bg-orange-100 rounded-lg animate-pulse"></div>
            <div className="h-8 w-8 bg-orange-200 rounded-full"></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-gradient-to-br from-orange-50 to-white border border-orange-100 rounded-xl p-4">
              <div className="h-4 w-12 bg-orange-200 rounded mb-2"></div>
              <div className="h-8 w-20 bg-orange-500 rounded-lg"></div>
            </div>
            <div className="h-24 bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-xl p-4">
               <div className="h-4 w-12 bg-amber-200 rounded mb-2"></div>
               <div className="h-8 w-20 bg-amber-500 rounded-lg"></div>
            </div>
          </div>
          <div className="h-32 bg-warmGray-50 border border-warmGray-100 rounded-xl flex items-end p-4 gap-2">
            {[40, 70, 50, 90, 60, 80, 45].map((h, i) => (
              <div key={i} style={{ height: `${h}%` }} className="flex-1 bg-orange-400 rounded-t-sm opacity-80"></div>
            ))}
          </div>
        </div>
        
        {/* Floating Badge */}
        <motion.div 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute -right-4 top-10 bg-white p-3 rounded-xl shadow-xl border border-orange-100 flex items-center gap-3"
        >
            <div className="bg-green-100 p-2 rounded-full text-green-600"><Zap className="w-5 h-5" /></div>
            <div>
                <p className="text-xs text-gray-500">Focus State</p>
                <p className="font-bold text-gray-800">Flow (92%)</p>
            </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

// --- Animated Gradient Background ---
const GradientMesh = () => (
  <div className="fixed inset-0 z-0 overflow-hidden bg-[#FAFAF9]">
    <div className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-orange-300/20 rounded-full blur-[100px] animate-blob" />
    <div className="absolute top-[20%] left-[-10%] w-[50vw] h-[50vw] bg-amber-200/30 rounded-full blur-[100px] animate-blob animation-delay-2000" />
    <div className="absolute bottom-[-20%] right-[20%] w-[40vw] h-[40vw] bg-rose-200/20 rounded-full blur-[100px] animate-blob animation-delay-4000" />
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
  </div>
);

export const LoginPage = ({ onLogin }) => {
  /* ---------- State ---------- */
  const [view, setView] = useState("landing"); // 'landing' | 'auth' | 'role_select'
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [class_, setClass_] = useState("");
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  /* ---------- Handlers ---------- */
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    const roleParam = urlParams.get("role");
    if (token && roleParam) {
      localStorage.setItem("token", token);
      localStorage.setItem("role", roleParam);
      onLogin(roleParam);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [onLogin]);

  const handleLogin = async () => {
    try {
      const { data } = await axios.post("http://localhost:8000/auth/login", { email, password });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", role);
      onLogin(role);
    } catch (err) { setError("Login failed. Check credentials."); }
  };

  const handleRegister = async () => {
    try {
      const { data } = await axios.post("http://localhost:8000/auth/register", { email, firstName, lastName, password, class_ });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", role);
      onLogin(role);
    } catch (err) { setError(err?.response?.data?.detail || "Registration failed."); }
  };

  const handleGoogleSSO = async () => {
    try {
      const { data } = await axios.get(`http://localhost:8000/auth/google?role=${role}`);
      window.location.href = data.authorization_url;
    } catch (err) { setError("Failed to initiate SSO."); }
  };

  const handleSubmit = (e) => { e.preventDefault(); setError(""); isRegister ? handleRegister() : handleLogin(); };
  
  const openAuth = (selectedRole, mode = 'login') => {
    setRole(selectedRole);
    setView("auth");
    setError("");
    setIsRegister(mode === 'register');
  };

  const openRoleSelection = () => {
    setView("role_select");
  };

  /* ---------- Components ---------- */

  const FeatureCard = ({ icon, title, desc, delay }) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className="bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-white/50 shadow-lg hover:shadow-orange-500/10 transition-all hover:-translate-y-1"
    >
      <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 mb-3">
        {icon}
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-600 text-xs leading-relaxed">{desc}</p>
    </motion.div>
  );

  return (
    <div className="relative min-h-screen font-sans text-gray-900 selection:bg-orange-200">
      <GradientMesh />

      {/* --- Navbar --- */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView("landing")}>
          <div className="bg-gradient-to-br from-orange-500 to-amber-500 p-2 rounded-lg shadow-lg shadow-orange-500/20">
            <Brain className="text-white w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">Neuro<span className="text-orange-600">Learn</span></span>
        </div>
        <div>
            <button 
              onClick={openRoleSelection} 
              className="px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-medium hover:bg-black transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Get Started
            </button>
        </div>
      </nav>

      {/* --- Landing Content --- */}
      <AnimatePresence mode="wait">
        {view === "landing" && (
          <motion.div 
            key="landing"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 pt-28 px-6 max-w-7xl mx-auto flex flex-col h-full"
          >
            {/* Hero Section */}
            <div className="flex flex-col lg:flex-row items-center gap-8 mb-20 mt-12">
              <div className="flex-1 text-center lg:text-left">
                
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-5"
                >
                  Study at the <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-amber-500">Speed of Thought.</span>
                </motion.h1>
                
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-lg text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed"
                >
                  The first AI-powered learning platform that uses real-time BCI data to adapt learning to your focus levels. Stop wasting time; start deep learning.
                </motion.p>
                
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
                >
                  <Button 
                    onClick={() => openAuth('student', 'login')} // Default to login, register available in modal
                    className="h-14 px-8 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-lg shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    I'm a Student 
                  </Button>
                  <Button 
                    onClick={() => openAuth('teacher', 'login')}
                    className="h-14 px-8 rounded-full bg-white !text-orange-600 border border-gray-200 hover:bg-gray-50 text-lg shadow-sm whitespace-nowrap"
                  >
                    I'm a Teacher
                  </Button>
                </motion.div>
              </div>

              {/* 3D Visual */}
              <div className="flex-1 flex justify-center lg:justify-end relative w-full">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-radial from-orange-400/20 to-transparent blur-3xl -z-10"></div>
                <MockDashboard3D />
              </div>
            </div>

            {/* Features Grid - Shifted Up */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pb-12">
              <FeatureCard 
                icon={<Activity />}
                title="Real-time EEG Analytics"
                desc="Connect your headset and visualize your brainwaves instantly. We interpret Alpha and Beta waves to quantify your focus."
                delay={0.4}
              />
              <FeatureCard 
                icon={<Zap />}
                title="Adaptive Curriculum"
                desc="When your focus drops, NeuroLearn simplifies the content. When you're in 'Flow', we challenge you to accelerate learning."
                delay={0.5}
              />
              <FeatureCard 
                icon={<ShieldCheck />}
                title="Teacher Monitoring"
                desc="Educators get a live classroom view. Identify struggling students immediately without them having to raise a hand."
                delay={0.6}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Role Selection Modal (Triggered by Navbar 'Get Started') --- */}
      <AnimatePresence>
        {view === "role_select" && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 backdrop-blur-lg"
          >
             <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg p-8 rounded-3xl shadow-2xl border border-white/50 relative overflow-hidden text-center"
            >
                <button 
                    onClick={() => setView("landing")}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Get Started</h2>
                <p className="text-gray-500 mb-8">Choose your role to create your account.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button 
                        onClick={() => openAuth('student', 'register')}
                        className="group flex flex-col items-center justify-center p-6 bg-orange-50 border-2 border-orange-100 hover:border-orange-500 hover:bg-orange-100 rounded-2xl transition-all duration-300"
                    >
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                            <User className="w-8 h-8 text-orange-600" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg">Student</h3>
                        <p className="text-xs text-gray-500 mt-1">I want to learn.</p>
                    </button>

                    <button 
                        onClick={() => openAuth('teacher', 'register')}
                        className="group flex flex-col items-center justify-center p-6 bg-amber-50 border-2 border-amber-100 hover:border-amber-500 hover:bg-amber-100 rounded-2xl transition-all duration-300"
                    >
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                            <UserCog className="w-8 h-8 text-amber-600" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg">Teacher</h3>
                        <p className="text-xs text-gray-500 mt-1">Let's assess.</p>
                    </button>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Auth Form Modal (Login/Register) --- */}
      <AnimatePresence>
        {view === "auth" && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 backdrop-blur-lg"
          >
             {/* Modal Container */}
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl border border-white/50 relative overflow-hidden"
            >
                {/* Decorative blobs inside modal */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                
                <button 
                    onClick={() => setView("landing")}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center mb-6">
                    <div className="inline-flex p-3 bg-orange-50 rounded-2xl mb-4 text-orange-600">
                        {role === 'student' ? <User className="w-8 h-8" /> : <UserCog className="w-8 h-8" />}
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        {isRegister ? `Join as ${role}` : `Welcome back, ${role}`}
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        {isRegister ? "Create your account to get started." : "Enter your details to access the neural network."}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                    {/* Form Fields */}
                    {isRegister && (
                        <div className="grid grid-cols-2 gap-3">
                            <input 
                                placeholder="First Name" 
                                value={firstName} onChange={e => setFirstName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                            />
                            <input 
                                placeholder="Last Name" 
                                value={lastName} onChange={e => setLastName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                            />
                        </div>
                    )}
                    
                    <input 
                        type="email" 
                        placeholder="name@example.com" 
                        value={email} onChange={e => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                    />

                    {isRegister && (
                         <input 
                         type="text" 
                         placeholder="Class / Grade" 
                         value={class_} onChange={e => setClass_(e.target.value)}
                         className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                     />
                    )}

                    <input 
                        type="password" 
                        placeholder="Password" 
                        value={password} onChange={e => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition"
                    />

                    {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</p>}

                    <Button 
                        type="submit"
                        className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 flex justify-center gap-2"
                        icon={isRegister ? <Sparkles className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                    >
                        {isRegister ? "Create Account" : "Sign In"}
                    </Button>
                </form>

                <div className="mt-6">
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-200"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">Or continue with</span>
                        <div className="flex-grow border-t border-gray-200"></div>
                    </div>
                    <button 
                        onClick={handleGoogleSSO}
                        className="w-full mt-2 py-3 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.20-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        Google
                    </button>
                </div>

                <p className="mt-6 text-center text-gray-500 text-sm">
                    {isRegister ? "Already a member?" : "New to NeuroLearn?"}
                    <button onClick={() => { setIsRegister(!isRegister); setError(""); }} className="ml-1 text-orange-600 font-bold hover:underline">
                        {isRegister ? "Sign In" : "Register"}
                    </button>
                </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
