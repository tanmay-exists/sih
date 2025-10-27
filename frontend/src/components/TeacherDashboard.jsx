import React, { useState, useEffect } from "react";
import { Header, MetricCard } from "./Common";
import { ClassRoster, ClassAttentionChart, ModelSummary, ExportTool } from "./Components";

export const TeacherDashboard = ({ onLogout, accessibility }) => {
  const [students, setStudents] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/neuro/ws/eeg?token=${token}`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'verdict') {
          setStudents(prev => {
            const student = {
              name: data.student_name || `Student ${data.session}`,
              attention: data.beta_activity !== 'N/A' ? parseFloat(data.beta_activity) : (data.focus_state === 'FOCUSED' ? 90 : 50),
              status: data.focus_state === 'FOCUSED' ? 'Focused' : data.focus_state === 'ENGAGED' ? 'Engaged' : 'Distracted'
            };
            const existing = prev.find(s => s.name === student.name);
            if (existing) {
              return prev.map(s => s.name === student.name ? student : s);
            }
            return [...prev, student];
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    ws.onclose = () => console.log('WebSocket closed');
    return () => ws.close();
  }, [token]);

  const avgAttention = students.length > 0 ? students.reduce((acc, s) => acc + s.attention, 0) / students.length : 0;

  return (
    <div className="min-h-screen pt-24 bg-warmGray-100">
      <Header user="Teacher" role="Admin" onLogout={onLogout} accessibility={accessibility} className="h-24 bg-orange-100 text-amber-900 shadow-md" />
      <main className="container mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <img
          src="https://png.pngtree.com/thumb_back/fw800/background/20240104/pngtree-trendy-doodle-texture-flat-vector-illustration-of-hand-drawn-abstract-shapes-image_13915914.png"
          alt="Ready to Begin background"
          className="absolute inset-0 w-full h-full z-0 opacity-5 object-cover pointer-events-none"
        />
        <div className="lg:col-span-2 z-10">
          <MetricCard title="Live Class Average Attention" value={avgAttention.toFixed(1)} unit="%" />
        </div>
        <ClassRoster students={students} />
        <ClassAttentionChart students={students} />
        <ModelSummary />
        <ExportTool />
      </main>
    </div>
  );
};
