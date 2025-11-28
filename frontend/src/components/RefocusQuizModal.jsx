// RefocusQuizModal.jsx
import React from "react";
import { Card } from "./Common";
import { AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { QuizGame } from "./QuizGame";

export const RefocusQuizModal = ({ subject, onFinish, attention }) => {
  const [quizResult, setQuizResult] = React.useState(null);

  const handleQuizFinish = (result) => {
    if (quizResult) return;
    setQuizResult(result);
    onFinish(result);
  };

  if (quizResult) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 20 }} 
        className="w-full max-w-2xl"
      >
        <Card className="!p-0 overflow-hidden shadow-2xl shadow-orange-500/20 border border-orange-100">
          {/* Header */}
          <div className="bg-orange-50 border-b border-orange-100 p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm text-orange-600">
                <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900">Attention Check!</h2>
            <p className="text-gray-600 mt-2 max-w-md">
                We noticed a dip in focus. Let's sharpen your mind with a quick 5-question quiz on <strong>{subject}</strong>.
            </p>
          </div>

          {/* Quiz Content */}
          <div className="p-6 bg-white">
             <QuizGame 
                subject={subject} 
                attention={attention} 
                onFinish={handleQuizFinish} 
                focusStats={() => null} 
             />
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
