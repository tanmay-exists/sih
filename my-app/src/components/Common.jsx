import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useTTS from "./useTTS";

// --- ICONS ---
export const IconBrain = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.7-.6-3.3-1.7-4.5.8-.6 1.3-1.5 1.3-2.5 0-1.7-1.3-3-3-3-1.2 0-2.3.7-2.8 1.7-.6-.2-1.2-.3-1.8-.3s-1.2.1-1.8.3C9.3 2.7 8.2 2 7 2 5.3 2 4 3.3 4 5c0 1 .5 1.9 1.3 2.5C4.2 8.7 3.6 10.3 3.6 12s.6 3.3 1.7 4.5c-.8.6-1.3 1.5-1.3 2.5 0 1.7 1.3 3 3 3 1.2 0 2.3-.7 2.8-1.7.6.2 1.2.3 1.8.3s1.2-.1 1.8-.3c.5 1 1.6 1.7 2.8 1.7 1.7 0 3-1.3 3-3 0-1-.5-1.9-1.3-2.5 1.1-1.2 1.7-2.8 1.7-4.5zM12 16c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" />
  </svg>
);
export const IconUser = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.28 0 4.5-1.343 4.5-4S14.28 4 12 4s-4.5 1.343-4.5 4 2.22 4 4.5 4zM4.5 20a7.5 7.5 0 1115 0H4.5z" />
  </svg>
);
export const IconTeacher = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 7V14m0 0L3 9m9 5l9-5" />
  </svg>
);
export const IconSettings = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.983 2.21a1 1 0 011.034 0l1.59.918a1 1 0 01.386 1.332l-.51.888a7.982 7.982 0 011.98 1.146l.888-.51a1 1 0 011.332.386l.918 1.59a1 1 0 01-.386 1.332l-.888.51a7.982 7.982 0 010 2.292l.888.51a1 1 0 01.386 1.332l-.918 1.59a1 1 0 01-1.332.386l-.888-.51a7.982 7.982 0 01-1.98 1.146l.51.888a1 1 0 01-.386 1.332l-1.59.918a1 1 0 01-1.034 0l-1.59-.918a1 1 0 01-.386-1.332l.51-.888a7.982 7.982 0 01-1.98-1.146l-.888.51a1 1 0 01-1.332-.386l-.918-1.59a1 1 0 01.386-1.332l.888-.51a7.982 7.982 0 010-2.292l-.888-.51a1 1 0 01-.386-1.332l.918-1.59a1 1 0 011.332-.386l.888.51a7.982 7.982 0 011.98-1.146l-.51-.888a1 1 0 01.386-1.332l1.59-.918zM12 15a3 3 0 100-6 3 3 0 000 6z" />
  </svg>
);
export const IconDownload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
  </svg>
);
export const IconVolumeUp = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9 9 0 0119 10a9 9 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7 7 0 0017 10a7 7 0 00-2.343-5.657 1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5 5 0 0115 10a5 5 0 01-1.757 3.536 1 1 0 11-1.415-1.415A3 3 0 0013 10a3 3 0 00-.757-2.121 1 1 0 010-1.415z" clipRule="evenodd" />
  </svg>
);
export const IconVolumeOff = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);
export const IconFocus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 10l4 4" />
  </svg>
);

// --- UI COMPONENTS ---
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

export const Button = ({ children, onClick, className = "", icon }) => (
  <motion.button
    onClick={onClick}
    className={`px-6 py-3 font-semibold text-white rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-3 text-lg ${className}`}
    whileHover={{ scale: 1.05, y: -2 }}
    whileTap={{ scale: 0.95 }}
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
    <button onClick={handleToggleSpeech} className={`p-2 rounded-full transition-colors hover:bg-theme-border/50 ${className}`} aria-label={isSpeaking ? "Stop reading" : "Read text aloud"}>
      {isSpeaking ? <IconVolumeOff /> : <IconVolumeUp />}
    </button>
  );
};

export const Header = ({ user, role, onLogout, accessibility, focusMode }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isFocusMode, toggleFocusMode } = focusMode || {};

  return (
    <header className="fixed top-0 left-0 right-0 bg-theme-surface/80 backdrop-blur-lg border-b border-theme-border z-50">
      <div className="container mx-auto px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3 text-theme-primary">
          <IconBrain />
          <h1 className="text-2xl font-bold">NeuroLearn</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-theme-text hidden sm:block text-lg">
            Welcome, {user} ({role})
          </span>
          {toggleFocusMode && (
            <motion.button onClick={toggleFocusMode} className={`p-2 rounded-full transition-colors ${isFocusMode ? 'bg-theme-primary/20 text-theme-primary' : 'hover:bg-theme-border/50'}`} aria-label="Toggle Focus Mode" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <IconFocus />
            </motion.button>
          )}
          {accessibility && (
            <div className="relative">
              <motion.button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-2 rounded-full hover:bg-theme-border/50 transition-colors" aria-label="Open accessibility settings" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <IconSettings />
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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-64 bg-theme-surface border border-theme-border rounded-lg shadow-xl p-3 origin-top-right space-y-4">
      <div>
        <p className="text-sm font-bold text-theme-primary">Accessibility</p>
        <p className="text-xs text-theme-text/70 mb-2 border-b border-theme-border pb-2">Customize your experience.</p>
      </div>
      <SettingButton label="Theme" value={theme} setter={setTheme} options={[{ value: 'root', label: 'Peach' }, { value: 'theme-orange', label: 'Orange' }, { value: 'theme-yellow', label: 'Yellow' }]} />
      <SettingButton label="Font Size" value={fontSize} setter={setFontSize} options={[{ value: 'text-base', label: 'S' }, { value: 'text-lg', label: 'M' }, { value: 'text-xl', label: 'L' }]} />
      <SettingButton label="Letter Spacing" value={letterSpacing} setter={setLetterSpacing} options={[{ value: 'tracking-normal', label: 'Std' }, { value: 'tracking-wide', label: 'Wide' }, { value: 'tracking-wider', label: 'Max' }]} />
      <SettingButton label="Font Family" value={fontFamily} setter={setFontFamily} options={[{ value: 'font-sans', label: 'Default' }, { value: 'font-lexend', label: 'Dyslexia Friendly' }]} />
    </motion.div>
  );
};
