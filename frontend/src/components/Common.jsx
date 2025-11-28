// Common.jsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Settings, Volume2, VolumeX, LogOut, LayoutTemplate, Type } from "lucide-react";
import useTTS from "./useTTS";

// --- Reusable Card Component ---
export const Card = ({ children, className = "", onClick }) => (
  <motion.div
    onClick={onClick}
    className={`bg-white border border-orange-200 rounded-3xl p-4 shadow-xl shadow-orange-900/5 backdrop-blur-sm ${className}`}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    whileHover={onClick ? { 
      y: -4, 
      borderColor: "rgb(251 146 60)", // orange-400
      boxShadow: "0 20px 25px -5px rgb(234 88 12 / 0.15), 0 8px 10px -6px rgb(234 88 12 / 0.1)" 
    } : {}}
  >
    {children}
  </motion.div>
);

// --- Metric Card (Fixed: No Double Icon) ---
export const MetricCard = ({ title, value, unit, className = "", icon }) => (
  <Card className={`relative overflow-hidden bg-gradient-to-br from-white to-orange-50/50 ${className}`}>
    <div className="flex flex-col h-full justify-between relative z-10">
      <div className="flex items-center gap-2 mb-3">
        {icon && (
          <div className="p-2 bg-orange-100 rounded-xl text-orange-700 shadow-sm border border-orange-200">
            {React.cloneElement(icon, { size: 18 })}
          </div>
        )}
        <h3 className="text-[11px] font-bold text-orange-900/60 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="flex items-baseline gap-1">
        <p className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
          {value}
        </p>
        <span className="text-lg text-orange-400 font-medium font-mono">{unit}</span>
      </div>
    </div>
  </Card>
);

// --- Button Component ---
export const Button = ({ children, onClick, className = "", icon, disabled, variant = "primary" }) => {
  const hasCustomBg = className.includes("bg-");

  const variants = {
    primary: hasCustomBg 
      ? "text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 border-transparent hover:-translate-y-0.5"
      : "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg shadow-orange-600/20 hover:shadow-orange-600/30 border-orange-500 hover:-translate-y-0.5",
    
    outline: "bg-white text-orange-900 border-orange-200 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 shadow-sm",
    ghost: "bg-transparent text-stone-600 hover:bg-orange-100/50 hover:text-orange-700 border-transparent shadow-none",
    danger: "bg-red-500 text-white hover:bg-red-600 border-red-500 hover:shadow-lg hover:shadow-red-500/10"
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 
        flex items-center justify-center gap-2 border
        ${variants[variant] || variants.primary}
        ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
        ${className}
      `}
      whileTap={!disabled ? { scale: 0.98 } : {}}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </motion.button>
  );
};

// --- Listen Button (Fixed: Simple structure to prevent ghosting) ---
export const ListenButton = ({ text, className = "" }) => {
  const { speak, cancel, isSpeaking } = useTTS();
  const handleToggleSpeech = (e) => {
    e.stopPropagation();
    if (isSpeaking) {
      cancel();
    } else {
      speak(text);
    }
  };
  return (
    <button
      onClick={handleToggleSpeech}
      className={`p-2 rounded-full transition-colors inline-flex items-center justify-center ${
        isSpeaking 
        ? "bg-orange-100 text-orange-700 ring-1 ring-orange-200" 
        : "text-stone-400 hover:bg-orange-50 hover:text-orange-600"
      } ${className}`}
      aria-label={isSpeaking ? "Stop reading" : "Read text aloud"}
    >
      {isSpeaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>
  );
};

// --- Header ---
export const Header = ({ user, role, onLogout, accessibility }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 p-4 pointer-events-none">
      <div className="pointer-events-auto container mx-auto bg-white/95 backdrop-blur-xl border border-orange-100 ring-1 ring-orange-900/5 rounded-2xl shadow-xl shadow-orange-900/5 px-6 py-3 flex justify-between items-center transition-all duration-300">
        
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-2.5 rounded-xl shadow-lg shadow-orange-500/20 group-hover:rotate-12 transition-transform duration-300">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-stone-800">
            Neuro<span className="text-orange-600">Learn</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center">
            <span className="text-sm font-bold text-stone-800">Welcome, {user}</span>
          </div>
          
          {accessibility && (
            <div className="relative">
              <motion.button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`p-2 rounded-xl transition-all border ${isSettingsOpen ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-stone-50 border-stone-100 text-stone-500 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-100'}`}
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <Settings className="h-5 w-5" />
              </motion.button>
              <AnimatePresence>
                {isSettingsOpen && <AccessibilityPanel accessibility={accessibility} onClose={() => setIsSettingsOpen(false)} />}
              </AnimatePresence>
            </div>
          )}
          
          <div className="h-8 w-[2px] bg-stone-400 mx-1 hidden sm:block"></div>

          <Button 
            onClick={onLogout} 
            variant="danger"
            className="hidden sm:flex text-xs px-4 py-2 hover:bg-red-50 hover:text-white border border-transparent"
            icon={<LogOut className="w-4 h-4" />}
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};

// --- Accessibility Panel ---
const AccessibilityPanel = ({ accessibility }) => {
  const { theme, setTheme, fontSize, setFontSize, letterSpacing, setLetterSpacing, fontFamily, setFontFamily } = accessibility;

  const SettingSection = ({ icon, label, value, options, setter }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
        {icon}
        {label}
      </div>
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setter(opt.value)}
            className={`flex-1 text-[11px] py-1.5 px-2 rounded-lg transition-all font-semibold ${
              value === opt.value 
                ? "bg-white text-orange-700 shadow-sm ring-1 ring-orange-900/5" 
                : "text-stone-500 hover:text-stone-700 hover:bg-stone-200/50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2 }}
      className="absolute right-0 mt-3 w-72 bg-white/95 backdrop-blur-xl border border-orange-100 ring-1 ring-orange-900/5 rounded-2xl shadow-2xl p-5 origin-top-right z-50 pointer-events-auto"
    >
      <div className="mb-4 pb-4 border-b border-orange-50">
        <h3 className="font-bold text-stone-900">Display Settings</h3>
        <p className="text-xs text-stone-500">Customize your learning interface.</p>
      </div>
      
      <div className="space-y-5">
        <SettingSection
          icon={<LayoutTemplate className="w-3 h-3" />}
          label="Theme"
          value={theme}
          setter={setTheme}
          options={[
            { value: "root", label: "Light" },
            { value: "theme-orange", label: "Warm" },
            { value: "theme-yellow", label: "Focus" },
          ]}
        />
        <SettingSection
          icon={<Type className="w-3 h-3" />}
          label="Font Size"
          value={fontSize}
          setter={setFontSize}
          options={[
            { value: "text-base", label: "Aa" },
            { value: "text-lg", label: "Aa+" },
            { value: "text-xl", label: "Aa++" },
          ]}
        />
        <SettingSection
          icon={<Type className="w-3 h-3 rotate-90" />}
          label="Spacing"
          value={letterSpacing}
          setter={setLetterSpacing}
          options={[
            { value: "tracking-normal", label: "Norm" },
            { value: "tracking-wide", label: "Wide" },
          ]}
        />
        <SettingSection
          icon={<Brain className="w-3 h-3" />}
          label="Typeface"
          value={fontFamily}
          setter={setFontFamily}
          options={[
            { value: "font-sans", label: "Modern" },
            { value: "font-lexend", label: "Dyslexia" },
          ]}
        />
      </div>
    </motion.div>
  );
};
