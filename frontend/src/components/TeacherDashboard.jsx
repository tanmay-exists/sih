import React from "react";
import { Header, MetricCard } from "./Common"; // Adjust path as needed
import { useClassDataStream } from "./Utils";
import { ClassRoster, ClassAttentionChart, ModelSummary, ExportTool } from "./Components";

export const TeacherDashboard = ({ onLogout, accessibility }) => {
  const students = useClassDataStream();
  const avgAttention = students.length > 0 ? students.reduce((acc, s) => acc + s.attention, 0) / students.length : 0;
  return (
    <div className="min-h-screen pt-24 bg-theme-bg">
      <Header user="Teacher" role="Admin" onLogout={onLogout} accessibility={accessibility} />
      <main className="container mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <img
          src="https://png.pngtree.com/thumb_back/fw800/background/20240104/pngtree-trendy-doodle-texture-flat-vector-illustration-of-hand-drawn-abstract-shapes-image_13915914.png"
          alt="Ready to Begin background"
          className="absolute inset-0 w-full h-full z-0 opacity-5 object-cover opacity-30 pointer-events-none"
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
