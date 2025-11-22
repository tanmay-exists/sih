// TeacherDashboard.jsx
import React, { useState, useEffect } from "react";
import { Header, MetricCard, Button } from "./Common";
import { ClassRoster, StudentDetailView, ExportTool } from "./Components";
import { Users, Clock, GraduationCap, ArrowLeft } from "lucide-react";

// --- Mock Data Generator (Restored) ---
const generateMockClassData = () => {
  const subjects = ["Math", "Science", "History", "English"];
  return Array.from({ length: 12 }).map((_, i) => ({
    id: `mock-student-${i}`,
    name: ["Alice", "Bob", "Charlie", "Diana", "Ethan", "Fiona", "George", "Hannah", "Ian", "Julia", "Kevin", "Liam"][i],
    email: `student${i}@example.com`,
    sessions: Array.from({ length: 5 }).map(() => ({
      timestamp: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
      duration: Math.floor(Math.random() * 3000) + 300, // Seconds
    })),
    quizzes: Array.from({ length: 8 }).map(() => {
      const total = 10;
      const score = Math.floor(Math.random() * 5) + 5;
      return {
        timestamp: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
        subject: subjects[Math.floor(Math.random() * subjects.length)],
        score: `${score}/${total}` // Matches format expected by UI
      };
    })
  }));
};

export const TeacherDashboard = ({ onLogout, accessibility }) => {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Scroll to top whenever the view changes (Student selected or deselected)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedStudent]);

  useEffect(() => {
    const fetchClassData = async () => {
      const token = localStorage.getItem("token");
      let realStudents = [];

      // 1. Fetch Real Data
      try {
        const response = await fetch("http://localhost:8000/teacher/dashboard", {
          headers: { 
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        if (response.ok) {
          const data = await response.json();
          // Map Backend Data to UI Structure
          realStudents = data.roster.map(s => ({
            id: s.id,
            name: s.name,
            email: s.email,
            sessions: s.history.sessions.map(sess => ({
              timestamp: sess.date, 
              duration: sess.duration
            })),
            quizzes: s.history.quizzes.map(q => ({
              timestamp: q.date,
              subject: q.subject,
              score: q.raw_score 
            }))
          }));
        }
      } catch (error) {
        console.warn("Could not fetch real data, using mock data only.", error);
      }

      // 2. Generate Mock Data
      const mockStudents = generateMockClassData();

      // 3. Merge Real + Mock Data
      setStudents([...realStudents, ...mockStudents]);
      setLoading(false);
    };

    fetchClassData();
  }, []);

  // --- Aggregation Logic ---
  const totalClassSessions = students.reduce((acc, s) => acc + s.sessions.length, 0);
  const totalDurationSeconds = students.reduce((acc, s) => acc + s.sessions.reduce((sum, sess) => sum + sess.duration, 0), 0);
  const avgDurationMins = totalClassSessions ? (totalDurationSeconds / totalClassSessions / 60).toFixed(1) : 0;

  // Calculate Global Quiz Average
  let totalQuizScore = 0;
  let totalQuizzes = 0;
  students.forEach(s => {
    s.quizzes.forEach(q => {
      // Handle potential "N/A" or bad data
      if(typeof q.score === 'string' && q.score.includes('/')) {
        const [earned, possible] = q.score.split('/').map(Number);
        if (possible > 0) {
            totalQuizScore += (earned / possible) * 100;
            totalQuizzes++;
        }
      }
    });
  });
  const classAvgScore = totalQuizzes ? (totalQuizScore / totalQuizzes).toFixed(1) : 0;

  // --- Filtering ---
  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warmGray-50">
        <div className="animate-pulse text-orange-600 font-semibold text-lg">Loading Class Data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 bg-warmGray-50">
      <Header 
        user="Teacher" 
        role="Admin" 
        onLogout={onLogout} 
        accessibility={accessibility} 
      />
      
      <main className="container mx-auto px-6 py-8">
        {/* Background Decoration */}
        <div className="fixed inset-0 z-0 opacity-5 pointer-events-none">
           <div className="absolute top-0 left-0 w-64 h-64 bg-orange-300 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
           <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
        </div>

        {selectedStudent ? (
          // --- INDIVIDUAL STUDENT VIEW ---
          <div className="relative z-10 space-y-6">
            <Button 
              onClick={() => setSelectedStudent(null)} 
              className="bg-orange-500 text-orange-800 border border-orange-200 hover:bg-orange-400 mb-4"
              icon={<ArrowLeft className="w-5 h-5" />}
            >
              Back to Class Roster
            </Button>
            <StudentDetailView student={selectedStudent} />
            <ExportTool data={[selectedStudent]} type="single" />
          </div>
        ) : (
          // --- CLASS OVERVIEW VIEW ---
          <div className="relative z-10 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
              <div>
                <h1 className="text-3xl font-bold text-orange-900">Class Dashboard</h1>
                <p className="text-warmGray-600 mt-1">Overview of student engagement and performance.</p>
              </div>
              <div className="relative w-full md:w-64">
                <input 
                  type="text" 
                  placeholder="Search students..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-4 pr-10 py-2 rounded-xl border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white/80 backdrop-blur-sm"
                />
              </div>
            </div>

            {/* Top Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <MetricCard 
                title="Avg Session Duration" 
                value={avgDurationMins} 
                unit="min" 
                icon={<Clock className="w-6 h-6 text-orange-600" />}
              />
              <MetricCard 
                title="Class Avg Quiz Score" 
                value={classAvgScore} 
                unit="%" 
                icon={<GraduationCap className="w-6 h-6 text-orange-600" />}
              />
              <MetricCard 
                title="Total Active Students" 
                value={students.length} 
                unit="" 
                icon={<Users className="w-6 h-6 text-orange-600" />}
              />
            </div>

            <div className="grid grid-cols-1 gap-8">
              <ClassRoster 
                students={filteredStudents} 
                onStudentClick={setSelectedStudent} 
              />
              <ExportTool data={students} type="class" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
