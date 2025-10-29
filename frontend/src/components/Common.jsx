import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Settings, User, UserCog, Volume2, VolumeX } from "lucide-react";
import useTTS from "./useTTS";

export const Card = ({ children, className = "" }) => (
  <motion.div
    className={`bg-theme-surface border border-theme-border rounded-2xl p-6 shadow-md ${className}`}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    {children}
  </motion.div>
);

export const MetricCard = ({ title, value, unit, className = "" }) => (
  <Card className={`text-center ${className}`}>
    <h3 className="text-lg font-semibold text-theme-primary/80">{title}</h3>
    <p className="text-4xl font-bold text-theme-text">
      {value}<span className="text-2xl text-theme-text/70 ml-1">{unit}</span>
    </p>
  </Card>
);

export const Button = ({ children, onClick, className = "", icon, disabled }) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    className={`px-6 py-3 font-semibold text-white rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-3 text-lg ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    whileHover={!disabled ? { scale: 1.05, y: -2 } : {}}
    whileTap={!disabled ? { scale: 0.95 } : {}}
  >
    {icon && <span>{icon}</span>}
    <span>{children}</span>
  </motion.button>
);

export const ListenButton = ({ text, className = "" }) => {
  const { speak, cancel, isSpeaking } = useTTS();
  const handleToggleSpeech = () => {
    if (isSpeaking) {
      cancel();
    } else {
      speak(text);
    }
  };
  return (
    <button
      onClick={handleToggleSpeech}
      className={`p-2 rounded-full transition-colors hover:bg-theme-border/50 ${className}`}
      aria-label={isSpeaking ? "Stop reading" : "Read text aloud"}
    >
      {isSpeaking ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
    </button>
  );
};

export const Header = ({ user, role, onLogout, accessibility, focusMode, attention }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isFocusMode, toggleFocusMode } = focusMode || {};

  return (
    <header className="fixed top-0 left-0 right-0 bg-theme-surface/80 backdrop-blur-lg border-b border-theme-border z-50">
      <div className="container mx-auto px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3 text-theme-primary">
          <Brain className="h-6 w-6" />
          <h1 className="text-2xl font-bold">NeuroLearn</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-theme-text hidden sm:block text-lg">
            Welcome, {user} ({role === "Learner" ? <User className="inline h-5 w-5" /> : <UserCog className="inline h-5 w-5" />})
          </span>
          {accessibility && (
            <div className="relative">
              <motion.button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="p-2 rounded-full hover:bg-theme-border/50 transition-colors"
                aria-label="Open accessibility settings"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Settings className="h-6 w-6" />
              </motion.button>
              <AnimatePresence>
                {isSettingsOpen && <AccessibilityPanel accessibility={accessibility} />}
              </AnimatePresence>
            </div>
          )}
          <Button onClick={onLogout} className="bg-theme-accent hover:bg-theme-accent/90 text-sm py-2 px-4">
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};

const AccessibilityPanel = ({ accessibility }) => {
  const { theme, setTheme, fontSize, setFontSize, letterSpacing, setLetterSpacing, fontFamily, setFontFamily } = accessibility;

  const SettingButton = ({ label, value, options, setter }) => (
    <div>
      <label className="text-xs font-semibold text-theme-text/70">{label}</label>
      <div className="flex gap-1 mt-1">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => setter(opt.value)}
            className={`flex-1 text-xs rounded py-1 transition-colors ${value === opt.value ? 'bg-theme-primary text-white' : 'bg-theme-border/50 hover:bg-theme-border'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute right-0 mt-2 w-64 bg-theme-surface border border-theme-border rounded-lg shadow-xl p-3 origin-top-right space-y-4"
    >
      <div>
        <p className="text-sm font-bold text-theme-primary">Accessibility</p>
        <p className="text-xs text-theme-text/70 mb-2 border-b border-theme-border pb-2">Customize your experience.</p>
      </div>
      <SettingButton
        label="Theme"
        value={theme}
        setter={setTheme}
        options={[{ value: 'root', label: 'Peach' }, { value: 'theme-orange', label: 'Orange' }, { value: 'theme-yellow', label: 'Yellow' }]}
      />
      <SettingButton
        label="Font Size"
        value={fontSize}
        setter={setFontSize}
        options={[{ value: 'text-base', label: 'S' }, { value: 'text-lg', label: 'M' }, { value: 'text-xl', label: 'L' }]}
      />
      <SettingButton
        label="Letter Spacing"
        value={letterSpacing}
        setter={setLetterSpacing}
        options={[{ value: 'tracking-normal', label: 'Std' }, { value: 'tracking-wide', label: 'Wide' }, { value: 'tracking-wider', label: 'Max' }]}
      />
      <SettingButton
        label="Font Family"
        value={fontFamily}
        setter={setFontFamily}
        options={[{ value: 'font-sans', label: 'Default' }, { value: 'font-lexend', label: 'Dyslexia Friendly' }]}
      />
    </motion.div>
  );
};
