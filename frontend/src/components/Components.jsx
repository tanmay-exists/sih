import { Card } from "./Common";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, BarChart, Bar } from "recharts";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { Button } from "./Common";
import jsPDF from "jspdf";

export const EegStreamChart = ({ data }) => (
  <Card className="flex flex-col flex-grow min-h-[400px] h-full">
    <h2 className="text-2xl font-semibold mb-4 text-orange-800 shrink-0">Live Brain Activity (EEG Signal)</h2>
    <div className="flex-grow text-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <XAxis hide={true} axisLine={false} tickLine={false} tick={false} dataKey="timestamp" stroke="var(--color-text)" />
          <YAxis stroke="var(--color-text)" domain={['auto', 'auto']} allowDataOverflow />
          <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
          <Legend />
          <Line isAnimationActive={false} type="monotone" dataKey="value" stroke="var(--color-primary)" dot={false} strokeWidth={2} name="EEG Value" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </Card>
);

export const SessionLog = ({ events }) => (
  <Card>
    <h2 className="text-xl font-semibold mb-4 text-orange-800">Session Log</h2>
    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
      {events.map((e, i) => (
        <div key={i} className="flex justify-between text-sm bg-amber-100/50 px-3 py-2 rounded-lg border border-amber-200">
          <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
          <span className="font-semibold">{e.event}</span>
          <span className="text-warmGray-700">{e.attention}%</span>
        </div>
      ))}
      {events.length === 0 && <p className="text-center text-warmGray-600">No session events yet.</p>}
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
        <h2 className="text-xl font-semibold mb-2 text-orange-800">{title}</h2>
        <ListenButton text={message} />
      </div>
      <p className="text-warmGray-700 leading-relaxed">{message}</p>
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
      <h2 className="text-2xl font-semibold mb-4 text-orange-800">Live Class Roster</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-amber-100/30">
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Attention %</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.name} className="border-b border-amber-200 last:border-b-0 hover:bg-amber-100/20 transition">
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
    <h2 className="text-2xl font-semibold mb-4 text-orange-800">Class Attention Overview</h2>
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
    <h2 className="text-2xl font-semibold mb-4 text-orange-800">Model Performance</h2>
    <p className="text-warmGray-700 leading-relaxed">
      Current Classifier: <strong>CNN</strong><br />
      Accuracy: <strong>97.5%</strong>
    </p>
  </Card>
);

export const ExportTool = () => {
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("NeuroLearn Session Report", 10, 10);
    doc.text("To be implemented: Add session data here.", 10, 20);
    doc.save("NeuroLearn_Report.pdf");
  };
  return (
    <Card className="flex flex-col items-center justify-center">
      <h2 className="text-2xl font-semibold mb-4 text-orange-800">Export Reports</h2>
      <Button onClick={exportPDF} className="bg-orange-500 hover:bg-orange-600 text-white" icon={<Download />}>
        Download PDF Report
      </Button>
    </Card>
  );
};
