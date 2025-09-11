import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, ListenButton } from './Common';

// --- No changes needed in this section ---
const SUBJECT_QUESTION_BANK = {
  Math: [
    { question: "What is 5 + 7?", options: ["10", "11", "12", "13"], answer: "12" },
    { question: "What is 9 - 4?", options: ["3", "4", "5", "6"], answer: "5" },
    { question: "What is 6 × 7?", options: ["42", "36", "40", "49"], answer: "42" },
    { question: "What is 56 ÷ 8?", options: ["6", "7", "8", "9"], answer: "7" },
    { question: "What is 15 + 9?", options: ["23", "24", "25", "26"], answer: "24" },
  ],
  Science: [
    { question: "Water freezes at what temperature (°C)?", options: ["-10", "0", "10", "32"], answer: "0" },
    { question: "Which gas do plants absorb?", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Helium"], answer: "Carbon Dioxide" },
    { question: "Earth is the ___ planet from the sun.", options: ["2nd", "3rd", "4th", "5th"], answer: "3rd" },
    { question: "Humans breathe in?", options: ["Carbon Dioxide", "Oxygen", "Hydrogen", "Neon"], answer: "Oxygen" },
    { question: "The boiling point of water at sea level (°C)?", options: ["50", "80", "100", "120"], answer: "100" },
  ],
  English: [
    { question: "Choose the synonym of 'Happy'", options: ["Sad", "Joyful", "Angry", "Tired"], answer: "Joyful" },
    { question: "Choose the antonym of 'Begin'", options: ["Start", "Commence", "End", "Open"], answer: "End" },
    { question: "Fill in: She ___ to school.", options: ["go", "goes", "gone", "going"], answer: "goes" },
    { question: "Plural of 'Child' is?", options: ["Childs", "Childes", "Children", "Childrens"], answer: "Children" },
    { question: "Past tense of 'Eat' is?", options: ["Ate", "Eaten", "Eat", "Eating"], answer: "Ate" },
  ],
  GK: [
    { question: "Capital of India?", options: ["Mumbai", "Delhi", "Kolkata", "Chennai"], answer: "Delhi" },
    { question: "How many continents?", options: ["5", "6", "7", "8"], answer: "7" },
    { question: "Largest ocean?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: "Pacific" },
    { question: "Tallest mountain?", options: ["K2", "Everest", "Kangchenjunga", "Lhotse"], answer: "Everest" },
    { question: "National animal of India?", options: ["Lion", "Elephant", "Tiger", "Peacock"], answer: "Tiger" },
  ],
};

const transitionVariants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};
// ---------------------------------------------


export const QuizGame = ({ subject = 'Math', onFinish, attention, focusStats }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);

  const questions = useMemo(() => SUBJECT_QUESTION_BANK[subject] || SUBJECT_QUESTION_BANK.Math, [subject]);
  const currentQuestion = useMemo(() => questions[currentQuestionIndex], [currentQuestionIndex, questions]);
  const isQuizFinished = currentQuestionIndex >= questions.length;

  const handleAnswer = (option) => {
    if (selectedAnswer) return; // Prevent multiple answers
    setSelectedAnswer(option);
    const correct = option === currentQuestion.answer;
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
  };

  const getButtonClass = (option) => {
    if (selectedAnswer === null) return 'bg-theme-secondary/50 hover:bg-theme-secondary/80';
    if (option === currentQuestion.answer) return 'bg-green-500 text-white';
    if (option === selectedAnswer && !isCorrect) return 'bg-red-500 text-white';
    return 'bg-theme-border opacity-50';
  };

  const getPerformanceMessage = (score, total) => {
    const percentage = (score / total) * 100;
    if (percentage === 100) return "You aced it! Perfect score and laser-sharp focus! 🎉";
    if (percentage >= 80) return "Fantastic job! Your hard work is paying off. Keep it up! ✨";
    if (percentage >= 60) return "Well done! A solid performance. You're on the right track! 👍";
    return "Nice effort! Every quiz is a chance to learn. Review the material and try again. 🧠";
  };

  if (isQuizFinished) {
    // FIX 1: Call the `focusStats` function to get the actual statistics object.
    const calculatedFocusStats = focusStats();
    const performanceMessage = getPerformanceMessage(score, questions.length);

    return (
      <Card className="text-center">
        <h2 className="text-3xl font-bold text-theme-primary mb-3">Quiz Complete!</h2>
        <p className="text-xl text-theme-text mb-2">Subject: <strong>{subject}</strong></p>
        <p className="text-2xl font-extrabold text-theme-primary mb-6">Your Score: <span className="text-green-500">{score}</span> / {questions.length}</p>
        <p className="text-theme-text/80 mb-8 max-w-sm mx-auto">{performanceMessage}</p>

        {/* FIX 2: Check if the *calculated* stats object exists before rendering this block. */}
        {calculatedFocusStats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mb-8">
            <Card className="p-4 bg-theme-surface/50 border border-theme-border">
              <p className="text-sm text-theme-text/70">Average Attention</p>
              <p className="text-2xl font-bold text-theme-primary flex items-center gap-2">
                <span className="text-green-400">📊</span>
                {/* FIX 3: Use the properties from the calculated object. */}
                {calculatedFocusStats.avg.toFixed(0)}%
              </p>
            </Card>
            <Card className="p-4 bg-theme-surface/50 border border-theme-border">
              <p className="text-sm text-theme-text/70">Peak Focus</p>
              <p className="text-2xl font-bold text-theme-primary flex items-center gap-2">
                <span className="text-blue-400">⚡</span>
                {calculatedFocusStats.max.toFixed(0)}%
              </p>
            </Card>
            <Card className="p-4 bg-theme-surface/50 border border-theme-border">
              <p className="text-sm text-theme-text/70">Lowest Point</p>
              <p className="text-2xl font-bold text-theme-primary flex items-center gap-2">
                <span className="text-red-400">📉</span>
                {calculatedFocusStats.min.toFixed(0)}%
              </p>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button onClick={restartQuiz} className="bg-theme-secondary/80 hover:opacity-90 w-full !text-theme-text">
            Retake Quiz
          </Button>
          <Button onClick={() => onFinish && onFinish({ subject, score, total: questions.length, completedAt: Date.now(), focusStats: calculatedFocusStats })} className="bg-theme-primary hover:opacity-90 w-full">
            Finish
          </Button>
        </div>
      </Card>
    );
  }

  // --- No changes needed in this section ---
  return (
    <Card>
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-semibold text-theme-primary">{subject} Quiz</h2>
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
          <p className="text-lg text-theme-text/90 leading-relaxed mb-6 min-h-[6rem]">{currentQuestion.question}</p>
          <div className="space-y-3">
            {currentQuestion.options.map(option => (
              <Button
                key={option}
                onClick={() => handleAnswer(option)}
                className={`w-full !text-theme-text !justify-start !text-left text-base transition-all duration-300 ${getButtonClass(option)}`}
                disabled={selectedAnswer !== null}
              >
                {option}
              </Button>
            ))}
            <Button
              onClick={handleSkip}
              className="w-full bg-theme-accent/50 hover:bg-theme-accent/80 !text-theme-text text-base"
              disabled={selectedAnswer !== null}
            >
              Skip Question
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
      {typeof attention === 'number' && attention < 40 && (
        <p className="text-center text-sm text-theme-accent mt-4">Attention is low. Take a deep breath and refocus.</p>
      )}
    </Card>
  );
};
// ---------------------------------------------
