import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoginPage, StudentDashboard, TeacherDashboard } from "./components/Dashboard";
import './App.css';

export default function App() {
  const [page, setPage] = useState("login");
  const [role, setRole] = useState(null);
  
  const [theme, setTheme] = useState("root");
  const [fontSize, setFontSize] = useState("text-lg");
  const [letterSpacing, setLetterSpacing] = useState("tracking-wide");
  const [fontFamily, setFontFamily] = useState("font-sans");

  const accessibilityProps = { theme, setTheme, fontSize, setFontSize, letterSpacing, setLetterSpacing, fontFamily, setFontFamily };

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("theme-orange", "theme-yellow");
    if (theme !== "root") {
      root.classList.add(theme);
    }
  }, [theme]);

  const handleLogin = (selectedRole) => {
    setRole(selectedRole);
    setPage(selectedRole);
  };

  const handleLogout = () => {
    setRole(null);
    setPage("login");
  };

  const appClasses = `bg-theme-bg min-h-screen text-theme-text ${fontSize} ${letterSpacing} ${fontFamily}`;

  return (
    <div className={appClasses}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(141,91,45,0.1),rgba(255,255,255,0))] -z-10"></div>
      <AnimatePresence mode="wait">
        <motion.div key={page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
          {page === "login" && <LoginPage onLogin={handleLogin} />}
          {page === "student" && <StudentDashboard onLogout={handleLogout} accessibility={accessibilityProps} />}
          {page === "teacher" && <TeacherDashboard onLogout={handleLogout} accessibility={accessibilityProps} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
