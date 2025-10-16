import React, { useEffect } from "react";
import { Card, Button, IconDownload, ListenButton } from "./Common"; // Adjust path as needed
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from "recharts";
import { motion } from "framer-motion";

export const EegStreamChart = ({ data }) => (
  <Card className="flex flex-col flex-grow min-h-[400px] h-full">
    <h2 className="text-2xl font-semibold mb-4 text-theme-primary shrink-0">Live Brain Activity (Beta Waves)</h2>
    <div className="flex-grow text-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <XAxis dataKey="time" stroke="var(--color-text)" />
          <YAxis stroke="var(--color-text)" domain={[-2, 2]} allowDataOverflow />
          <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
          <Legend />
          <Line isAnimationActive={false} type="monotone" dataKey="Fp1" stroke="var(--color-primary)" dot={false} strokeWidth={2} />
          <Line isAnimationActive={false} type="monotone" dataKey="Fp2" stroke="var(--color-accent)" dot={false} strokeWidth={2} />
          <Line isAnimationActive={false} type="monotone" dataKey="Cz" stroke="var(--color-secondary)" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </Card>
);

export const SessionLog = ({ events }) => (
  <Card>
    <h2 className="text-xl font-semibold mb-4 text-theme-primary">Session Log</h2>
    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
      {events.map((e, i) => (
        <div key={i} className="flex justify-between text-sm bg-theme-surface/50 px-3 py-2 rounded-lg border border-theme-border">
          <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
          <span className="font-semibold">{e.event}</span>
          <span className="text-theme-text/70">{e.attention}%</span>
        </div>
      ))}
      {events.length === 0 && <p className="text-center text-theme-text/60">No session events yet.</p>}
    </div>
  </Card>
);

export const DynamicFeedbackPanel = ({ attention, streak }) => {
  let title = "Stay Engaged";
  let message = "Maintain a steady focus. You can do it!";
  if (attention > 80) {
    title = "Excellent Focus!";
    message = "You're in the zone. Keep up the great work!";
  } else if (attention < 45) {
    title = "Let's Refocus";
    message = "Your attention seems to be dropping. Try taking a deep breath or adjusting your posture.";
  } else if (streak > 30) {
    title = "Amazing Streak!";
    message = `You've been focused for over ${Math.floor(streak)} seconds. That's fantastic!`;
  }
  return (
    <Card>
      <div className="flex justify-between items-start">
        <h2 className="text-xl font-semibold mb-2 text-theme-primary">{title}</h2>
        <ListenButton text={message} />
      </div>
      <p className="text-theme-text/90 leading-relaxed">{message}</p>
    </Card>
  );
};

export const ClassRoster = ({ students }) => {
  const getStatusColor = (status) => {
    if (status === "Focused") return "bg-green-500";
    if (status === "Engaged") return "bg-yellow-500";
    return "bg-red-500";
  };
  return (
    <Card>
      <h2 className="text-2xl font-semibold mb-4 text-theme-primary">Live Class Roster</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-theme-secondary/30">
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Attention %</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.name} className="border-b border-theme-border last:border-b-0 hover:bg-theme-secondary/20 transition">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }} className={`w-3 h-3 rounded-full ${getStatusColor(s.status)}`}></motion.div>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3">{s.name}</td>
                <td className="px-4 py-3 font-bold">{s.attention.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export const ClassAttentionChart = ({ students }) => (
  <Card>
    <h2 className="text-2xl font-semibold mb-4 text-theme-primary">Class Attention Overview</h2>
    <div className="h-80 text-sm">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={students}>
          <XAxis dataKey="name" stroke="var(--color-text)" />
          <YAxis stroke="var(--color-text)" />
          <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
          <Bar dataKey="attention" fill="var(--color-primary)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </Card>
);

export const ModelSummary = () => (
  <Card>
    <h2 className="text-2xl font-semibold mb-4 text-theme-primary">Model Performance</h2>
    <p className="text-theme-text/90 leading-relaxed">
      Current Classifier: <strong>SVM</strong><br />
      Accuracy: <strong>82%</strong> | Recall: <strong>78%</strong>
    </p>
  </Card>
);

export const ExportTool = () => (
  <Card className="flex flex-col items-center justify-center">
    <h2 className="text-2xl font-semibold mb-4 text-theme-primary">Export Reports</h2>
    <Button className="bg-theme-primary hover:bg-theme-primary/90" icon={<IconDownload />}>Download PDF Report</Button>
  </Card>
);

export const FocusAlert = ({ message, onClose }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ duration: 0.5 }}
    className="fixed inset-0 flex items-center justify-center z-[1000] p-4"
  >
    <div className="bg-theme-surface border border-theme-primary/50 rounded-lg shadow-2xl p-6 max-w-md w-full backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-theme-primary mb-2 text-center">Focus Alert</h3>
      <p className="text-theme-text/90 text-center mb-4">{message}</p>
      <div className="flex justify-center">
        <Button
          onClick={onClose}
          className="bg-theme-primary hover:bg-theme-primary/90 text-theme-text px-4 py-2 rounded"
        >
          Got It
        </Button>
      </div>
    </div>
  </motion.div>
);


export const HeadsetAlert = ({ onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(), 7000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="fixed top-20 inset-x-0 flex justify-center z-[1000] px-4"
      onClick={onClose}
    >
      <div className="bg-yellow-500 text-white rounded-full px-6 py-4 flex items-center justify-center gap-2 shadow-lg max-w-sm w-full sm:w-auto">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
          />
        </svg>
        <span className="text-md font-medium">Ensure to connect headset</span>
      </div>
    </motion.div>
  );
};

