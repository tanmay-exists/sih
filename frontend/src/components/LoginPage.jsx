import React from "react";
import { Button } from "./Common"; // Adjust path as needed
import { motion } from "framer-motion";
import { IconBrainCircuit, IconUserModern, IconTeacherModern } from "./Icons";

export const LoginPage = ({ onLogin }) => (
  <div className="min-h-screen w-full bg-theme-bg text-theme-text overflow-hidden">
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-cover bg-center" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1620428268482-cf1851a36764?q=80&w=2832&auto=format&fit=crop')` }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      <div className="relative z-10 text-center text-white max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="mb-6 flex justify-center items-center gap-3 text-3xl font-bold text-theme-primary"><IconBrainCircuit className="w-10 h-10" /> <h1 className="tracking-tight">NeuroLearn</h1></motion.div>
        <motion.h2 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }} className="text-4xl md:text-6xl font-extrabold tracking-tight">Unlock Your <span className="text-theme-primary">Deep Focus</span>.</motion.h2>
        <motion.p initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }} className="mt-4 max-w-2xl mx-auto text-lg md:text-xl text-gray-300">The intelligent study partner that uses BCI technology to monitor your attention, providing real-time feedback to help you study smarter, not harder.</motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }} className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button onClick={() => onLogin("student")} className="w-64 bg-theme-primary hover:bg-theme-primary/90 text-lg py-3" icon={<IconUserModern className="mr-2 h-6 w-6" />}>Login as Student</Button>
          <Button onClick={() => onLogin("teacher")} className="w-64 bg-theme-secondary hover:bg-theme-secondary/90 !text-theme-text text-lg py-3" icon={<IconTeacherModern className="mr-2 h-6 w-6" />}>Login as Teacher</Button>
        </motion.div>
      </div>
    </div>
  </div>
);
