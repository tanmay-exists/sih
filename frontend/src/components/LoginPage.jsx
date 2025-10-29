// src/components/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { Button } from "./Common";
import { motion } from "framer-motion";
import { Brain, User, UserCog, LogIn } from "lucide-react";
import axios from "axios";

export const LoginPage = ({ onLogin }) => {
  /* ---------- state ---------- */
  const [view, setView] = useState("landing");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [class_, setClass_] = useState("");
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);

  /* ---------- Google SSO callback ---------- */
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

  /* ---------- API calls ---------- */
  const handleLogin = async () => {
    try {
      const { data } = await axios.post("http://localhost:8000/auth/login", {
        email,
        password,
      });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", role);
      onLogin(role);
    } catch (err) {
      setError("Login failed. Check email and password.");
    }
  };

  const handleRegister = async () => {
    try {
      const { data } = await axios.post("http://localhost:8000/auth/register", {
        email,
        firstName,
        lastName,
        password,
        class_,
      });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", role);
      onLogin(role);
    } catch (err) {
      // FastAPI returns {detail: "..."} on error
      const msg =
        err?.response?.data?.detail || "Registration failed. Try again.";
      setError(msg);
    }
  };

  const handleGoogleSSO = async () => {
    try {
      const { data } = await axios.get(
        `http://localhost:8000/auth/google?role=${role}`
      );
      window.location.href = data.authorization_url;
    } catch (err) {
      setError("Failed to initiate Google SSO.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    isRegister ? handleRegister() : handleLogin();
  };

  const toggleForm = () => {
    setIsRegister(!isRegister);
    setError("");
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setClass_("");
  };

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole);
    setView("login");
    setError("");
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setClass_("");
    setIsRegister(false);
  };

  /* ---------- Landing view ---------- */
  if (view === "landing") {
    return (
      <div className="min-h-screen w-full text-white overflow-hidden">
        <div
          className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1620428268482-cf1851a36764?q=80&w=2832&auto=format&fit=crop')`,
          }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

          <div className="relative z-10 text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mb-6 flex justify-center items-center gap-3 text-4xl font-bold text-orange-400"
            >
              <Brain className="w-10 h-10" />
              <h1>NeuroLearn</h1>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-5xl md:text-7xl font-extrabold tracking-tight"
            >
              Unlock Your <span className="text-orange-400">Deep Focus</span>.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="mt-4 max-w-2xl mx-auto text-lg text-gray-200"
            >
              The intelligent study partner that monitors your attention and
              helps you study smarter, not harder.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6"
            >
              <Button
                onClick={() => handleRoleSelect("student")}
                className="w-64 bg-orange-500 hover:bg-orange-600 text-white text-lg py-3 flex items-center justify-center gap-2 rounded-xl shadow-lg"
                icon={<User className="h-6 w-6" />}
              >
                Login as Student
              </Button>
              <Button
                onClick={() => handleRoleSelect("teacher")}
                className="w-64 bg-amber-400 hover:bg-amber-500 text-gray-800 text-lg py-3 flex items-center justify-center gap-2 rounded-xl shadow-lg"
                icon={<UserCog className="h-6 w-6" />}
              >
                Login as Teacher
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Login / Register form ---------- */
  return (
    <div className="min-h-screen w-full text-white overflow-hidden">
      <div
        className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1620428268482-cf1851a36764?q=80&w=2832&auto=format&fit=crop')`,
        }}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>

        <div className="relative z-10 text-center max-w-lg w-full mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-6 flex justify-center items-center gap-3 text-3xl font-bold text-orange-400"
          >
            <Brain className="w-10 h-10" />
            <h1>NeuroLearn</h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white/10 backdrop-blur-lg p-10 rounded-3xl shadow-xl border border-white/20"
          >
            <h2 className="text-2xl font-bold text-orange-300 mb-6">
              {isRegister
                ? `Register as ${role.charAt(0).toUpperCase() + role.slice(1)}`
                : `Login as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:outline-none focus:ring-2 focus:ring-orange-400"
                required
              />

              {/* Register‑only fields */}
              {isRegister && (
                <>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    required
                  />
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    required
                  />
                  <input
                    type="text"
                    value={class_}
                    onChange={(e) => setClass_(e.target.value)}
                    placeholder="Class (e.g. 10)"
                    className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    required
                  />
                </>
              )}

              {/* Password */}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full p-3 rounded-lg bg-white/20 text-white placeholder-gray-300 border border-white/30 focus:outline-none focus:ring-2 focus:ring-orange-400"
                required
              />

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white text-lg py-3 rounded-xl flex items-center justify-center gap-2"
                icon={<LogIn className="h-6 w-6" />}
                disabled={
                  !email ||
                  !password ||
                  (isRegister && (!firstName || !lastName || !class_))
                }
              >
                {isRegister ? "Register" : "Login"}
              </Button>
            </form>

            {/* Google SSO */}
            <button
              onClick={handleGoogleSSO}
              className="w-full mt-5 bg-white hover:bg-gray-100 text-gray-800 py-3 flex items-center justify-center rounded-xl shadow-md transition"
            >
              <span className="flex items-center gap-2">
                Sign in with
                <svg className="h-6 w-6" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.20-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              </span>
            </button>

            <p className="text-sm text-gray-300 mt-4">
              {isRegister ? "Already have an account?" : "Don't have an account?"}
              <button
                onClick={toggleForm}
                className="ml-1 text-orange-400 hover:text-orange-500 font-semibold underline"
              >
                {isRegister ? "Login" : "Register"}
              </button>
            </p>

            <button
              onClick={() => setView("landing")}
              className="mt-4 text-orange-400 hover:text-orange-500 text-sm underline"
            >
              Back to Role Selection
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
