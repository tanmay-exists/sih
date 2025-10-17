import React from "react";
import { Card } from "./Common"; // Adjust path as needed
import { IconAlertTriangle } from "./Icons";
import { motion } from "framer-motion";
import { QuizGame } from "./QuizGame"; // Adjust path as needed
export const RefocusQuizModal = ({ subject, onFinish, attention }) => {
  const [quizResult, setQuizResult] = React.useState(null); // Track result to prevent multiple finishes
  const handleQuizFinish = (result) => {
    if (quizResult) return; // Prevent duplicate calls
    setQuizResult(result);
    onFinish(result);
  };
  if (quizResult) return null; // Hide entire modal content after finish (parent AnimatePresence will exit)
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-2xl">
        <Card className="!border-theme-accent">
          <div className="text-center mb-4">
            <div className="flex justify-center items-center gap-3 text-theme-accent"><IconAlertTriangle className="w-8 h-8" /><h2 className="text-2xl font-bold">Attention is Low!</h2></div>
            <p className="text-theme-text/80 mt-2">Let's take a quick break and sharpen your focus with a 5-question quiz.</p>
          </div>
          <QuizGame subject={subject} attention={attention} onFinish={handleQuizFinish} focusStats={() => null} />
        </Card>
      </motion.div>
    </div>
  );
};
