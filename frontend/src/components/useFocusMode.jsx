import { useState, useEffect } from 'react';

export default function useFocusMode(initialState = false) {
  const [isFocusMode, setIsFocusMode] = useState(initialState);

  useEffect(() => {
    if (isFocusMode) {
      document.body.classList.add('focus-mode-active');
    } else {
      document.body.classList.remove('focus-mode-active');
    }

    return () => {
      document.body.classList.remove('focus-mode-active');
    };
  }, [isFocusMode]);

  const toggleFocusMode = () => setIsFocusMode(prev => !prev);

  return { isFocusMode, toggleFocusMode };
}
