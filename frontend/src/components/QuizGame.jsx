// QuizGame.jsx
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, ListenButton } from './Common';

const transitionVariants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

export const QuizGame = ({ subject = 'Math', questions, onFinish, attention, focusStats }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [isFinished, setIsFinished] = useState(false);
  const currentQuestion = useMemo(() => questions[currentQuestionIndex], [currentQuestionIndex, questions]);
  const isQuizFinished = currentQuestionIndex >= questions.length;

  // Function to determine the correct answer based on question structure
  const getCorrectAnswerText = (question) => {
    // --- CORRECTION START ---
    // The API response uses 'correct' for the index, so we use it here.
    const answerSource = question.correct; 

    if (!question || !question.options || answerSource === undefined || answerSource === null) return null;

    // 1. Check if the answer is a numerical index (e.g., 0, 1, 2)
    // This handles the API's current format where 'correct' is a number index.
    const answerIndex = Number(answerSource);
    if (!isNaN(answerIndex) && answerIndex >= 0 && answerIndex < question.options.length) {
      return question.options[answerIndex];
    }

    // 2. Fallback for if the API returned the text string directly (less likely based on your data)
    if (typeof answerSource === 'string' && question.options.includes(answerSource)) {
      return answerSource;
    }

    // Fallback to whatever the value is, though it will likely fail comparison if it's an index
    return String(answerSource); // Convert to string for safer comparison elsewhere
    // --- CORRECTION END ---
  };

  const handleAnswer = (option) => {
    if (selectedAnswer) return;
    setSelectedAnswer(option);

    // --- FIX APPLIED HERE: Use the robust function to find the correct answer text ---
    const correctAnswerText = getCorrectAnswerText(currentQuestion);
    const correct = option === correctAnswerText;
    // --------------------------------------------------------------------------------

    setIsCorrect(correct);
    if (correct) {
      setScore(s => s + 1);
    }
    setTimeout(() => {
      setSelectedAnswer(null);
      setIsCorrect(null);
      setCurrentQuestionIndex(i => i + 1);
    }, 1000);
  };

  const handleSkip = () => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    setCurrentQuestionIndex(i => i + 1);
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setScore(0);
    setIsFinished(false);
  };

  const getButtonClass = (option) => {
    const correctAnswerText = getCorrectAnswerText(currentQuestion);

    if (selectedAnswer === null) return 'bg-amber-400 hover:bg-amber-500 text-warmGray-800';
    
    // Highlight the correct answer
    if (option === correctAnswerText) return 'bg-green-500 text-white';
    
    // Highlight the user's incorrect answer
    if (option === selectedAnswer && option !== correctAnswerText) return 'bg-red-500 text-white';

    // Dim unselected options
    return 'bg-amber-200 opacity-50 text-warmGray-800';
  };

  const getPerformanceMessage = (score, total) => {
    const percentage = (score / total) * 100;
    if (percentage === 100) return "You aced it! Perfect score and laser-sharp focus! 🎉";
    if (percentage >= 80) return "Fantastic job! Your hard work is paying off. Keep it up! ✨";
    if (percentage >= 60) return "Well done! A solid performance. You're on the right track! 👍";
    return "Nice effort! Every quiz is a chance to learn. Review the material and try again. 🧠";
  };

  const handleFinish = () => {
    if (isFinished || !onFinish) return;
    const calculatedFocusStats = focusStats ? focusStats() : null;
    setIsFinished(true);
    onFinish({ subject, score, total: questions.length, completedAt: Date.now(), focusStats: calculatedFocusStats });
  };

  if (isQuizFinished) {
    const calculatedFocusStats = focusStats ? focusStats() : null;
    const performanceMessage = getPerformanceMessage(score, questions.length);
    return (
      <Card className="bg-amber-50 text-center p-8 rounded-xl shadow-lg border border-amber-200">
        <h2 className="text-3xl font-bold text-orange-800 mb-4">Quiz Complete!</h2>
        <p className="text-xl text-warmGray-700 mb-2">Subject: <strong>{subject}</strong></p>
        <p className="text-2xl font-extrabold text-orange-800 mb-6">
          Your Score: <span className="text-green-500">{score}</span> / {questions.length}
        </p>
        <p className="text-warmGray-700 mb-8 max-w-sm mx-auto">{performanceMessage}</p>
        {calculatedFocusStats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mb-8">
            <Card className="p-4 bg-amber-100 border border-amber-200 rounded-lg">
              <p className="text-sm text-warmGray-600">Average Attention</p>
              <p className="text-2xl font-bold text-orange-800 flex items-center gap-2">
                <span className="text-green-500">📊</span>
                {calculatedFocusStats.avg.toFixed(0)}%
              </p>
            </Card>
            <Card className="p-4 bg-amber-100 border border-amber-200 rounded-lg">
              <p className="text-sm text-warmGray-600">Peak Focus</p>
              <p className="text-2xl font-bold text-orange-800 flex items-center gap-2">
                <span className="text-blue-500">⚡</span>
                {calculatedFocusStats.max.toFixed(0)}%
              </p>
            </Card>
            <Card className="p-4 bg-amber-100 border border-amber-200 rounded-lg">
              <p className="text-sm text-warmGray-600">Lowest Point</p>
              <p className="text-2xl font-bold text-orange-800 flex items-center gap-2">
                <span className="text-red-500">📉</span>
                {calculatedFocusStats.min.toFixed(0)}%
              </p>
            </Card>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            onClick={restartQuiz}
            className="bg-amber-400 hover:bg-amber-500 text-warmGray-800 w-full px-6 py-3 text-lg rounded-lg hover:scale-105 transition-transform"
          >
            Retake Quiz
          </Button>
          <Button
            onClick={handleFinish}
            disabled={isFinished}
            className="bg-orange-500 hover:bg-orange-600 text-white w-full px-6 py-3 text-lg rounded-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            Finish
          </Button>
        </div>
      </Card>
    );
  }
  return (
    <Card className="bg-amber-50 p-8 rounded-xl shadow-lg border border-amber-200">
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-semibold text-orange-800">{subject} Quiz</h2>
        <ListenButton text={currentQuestion.question} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestionIndex}
          variants={transitionVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <p className="text-lg text-warmGray-800 leading-relaxed mb-6 min-h-[6rem]">{currentQuestion.question}</p>
          <div className="space-y-4">
            {currentQuestion.options.map(option => (
              <Button
                key={option}
                onClick={() => handleAnswer(option)}
                className={`w-full text-warmGray-800 justify-start text-left text-base transition-all duration-300 ${getButtonClass(option)} rounded-lg hover:scale-105 disabled:hover:scale-100`}
                disabled={selectedAnswer !== null}
              >
                {option}
              </Button>
            ))}
            <Button
              onClick={handleSkip}
              className="w-full bg-red-500 hover:bg-red-600 text-white text-base rounded-lg hover:scale-105 transition-transform disabled:hover:scale-100"
              disabled={selectedAnswer !== null}
            >
              Skip Question
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
      {typeof attention === 'number' && attention < 40 && !isQuizFinished && !isFinished && (
        <p className="text-center text-sm text-orange-600 mt-4">Attention is low. Take a deep breath and refocus.</p>
      )}
    </Card>
  );
};
