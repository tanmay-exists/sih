// StudyContent.jsx
import React, { useState } from "react";
import { Card, Button } from "./Common";
import { ArrowLeft, ArrowRight, Play, BookOpen } from "lucide-react";

export const StudyContent = ({ lesson, type, videoRef, style }) => {
  const [currentPage, setCurrentPage] = useState(0);

  if (!lesson) return null;

  const contentTitle = lesson.lessonTitle || lesson.title || "Lesson Content";

  // --- VIDEO CONTENT ---
  if (type === "video") {
    return (
      <div className="w-full h-full flex flex-col" style={style}>
        <div className="bg-black/90 rounded-2xl overflow-hidden shadow-2xl flex-grow relative group">
            <iframe
                ref={videoRef}
                src={`${lesson.videoUrl}?enablejsapi=1&autoplay=1&modestbranding=1&rel=0`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
            />
        </div>
        <div className="mt-4 flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg"><Play size={20} fill="currentColor" /></div>
            <h2 className="text-lg font-bold text-gray-800">{contentTitle}</h2>
        </div>
      </div>
    );
  }

  // --- ARTICLE CONTENT ---
  if (type === "article") {
    // ✅ Case 1: Text Content
    if (lesson.articleContent) {
      const articlePages = lesson.articleContent.split("\n\n");
      return (
        <Card className="w-full h-full flex flex-col bg-white border-gray-200 shadow-sm" style={style}>
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
             <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><BookOpen size={20} /></div>
             <h2 className="text-xl font-bold text-gray-900">{contentTitle}</h2>
          </div>
          
          <div className="flex-grow overflow-y-auto custom-scrollbar pr-4">
             <div className="prose prose-orange max-w-none text-gray-700 leading-relaxed text-lg">
                {articlePages[currentPage].split('\n').map((paragraph, idx) => (
                    <p key={idx} className="mb-4">{paragraph}</p>
                ))}
             </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
            <Button
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={currentPage === 0}
              variant="outline"
              icon={<ArrowLeft size={16} />}
            >
              Previous
            </Button>
            
            <span className="text-sm font-medium text-gray-400 font-mono bg-gray-50 px-3 py-1 rounded-md">
              Page {currentPage + 1} / {articlePages.length}
            </span>
            
            <Button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage >= articlePages.length - 1}
              variant="outline"
              className="flex-row-reverse" // Flip icon to right
              icon={<ArrowRight size={16} />}
            >
              Next
            </Button>
          </div>
        </Card>
      );
    }

    // ✅ Case 2: URL / Iframe
    if (lesson.articleUrl) {
      return (
        <div className="w-full h-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden relative">
          <iframe
            src={lesson.articleUrl}
            title="Lesson Article"
            className="w-full h-full"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      );
    }

    // ✅ Fallback
    return (
      <Card className="w-full h-64 flex items-center justify-center bg-gray-50 border-dashed border-2 border-gray-200">
        <p className="text-gray-400 font-medium">No article content available.</p>
      </Card>
    );
  }

  return null;
};
