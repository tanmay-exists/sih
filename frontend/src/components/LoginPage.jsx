import React, { useState } from "react";
import { Button } from "./Common";
import { motion } from "framer-motion";
import { Brain, User, UserCog } from "lucide-react";
import axios from "axios";

export const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState("");

  const handleLogin = async () => {
    try {
      const response = await axios.post("http://localhost:8000/auth/login", {
        username,
        password,
      });
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("role", role);
      onLogin(role);
    } catch (err) {
      setError("Login failed. Check credentials.");
    }
  };

  return (
    <div className="min-h-screen w-full bg-warmGray-100 text-warmGray-800 overflow-hidden">
      <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-cover bg-center" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1620428268482-cf1851a36764?q=80&w=2832&auto=format&fit=crop')` }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div className="relative z-10 text-center text-white max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} className="mb-6 flex justify-center items-center gap-3 text-3xl font-bold text-orange-500">
            <Brain className="w-10 h-10" /> <h1 className="tracking-tight">NeuroLearn</h1>
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }} className="text-4xl md:text-6xl font-extrabold tracking-tight">Unlock Your <span className="text-orange-500">Deep Focus</span>.</motion.h2>
          <motion.p initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }} className="mt-4 max-w-2xl mx-auto text-lg md:text-xl text-gray-300">The intelligent study partner that uses BCI technology to monitor your attention, providing real-time feedback to help you study smarter, not harder.</motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }} className="mt-12 flex flex-col items-center gap-4">
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-64 p-2 rounded bg-amber-100 text-warmGray-800">
              <option value="">Select Role</option>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-64 p-2 rounded bg-amber-100 text-warmGray-800"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-64 p-2 rounded bg-amber-100 text-warmGray-800"
            />
            {error && <p className="text-red-500">{error}</p>}
            <Button onClick={handleLogin} className="w-64 bg-orange-500 hover:bg-orange-600 text-white text-lg py-3" disabled={!role || !username || !password}>
              Login
            </Button>
            <Button onClick={() => onLogin("student")} className="w-64 bg-orange-500 hover:bg-orange-600 text-white text-lg py-3" icon={<User className="mr-2 h-6 w-6" />}>Login as Student</Button>
            <Button onClick={() => onLogin("teacher")} className="w-64 bg-amber-400 hover:bg-amber-500 text-warmGray-800 text-lg py-3" icon={<UserCog className="mr-2 h-6 w-6" />}>Login as Teacher</Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
