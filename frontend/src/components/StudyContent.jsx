import React, { useState } from "react";
import { Card, Button } from "./Common";

export const StudyContent = ({ lesson, type, videoRef }) => {
  const [currentPage, setCurrentPage] = useState(0);

  if (!lesson) return null;

  const contentTitle = lesson.lessonTitle || lesson.title || "Lesson Content";

  // --- VIDEO CONTENT ---
  if (type === "video") {
    return (
      <Card className="w-full bg-amber-50 p-6 rounded-xl shadow-lg border border-amber-200">
        <div>
          <h2 className="text-xl font-bold text-orange-800 mb-4">{contentTitle} (Video)</h2>
          <div className="aspect-video w-full max-w-4xl mx-auto">
            <iframe
              ref={videoRef}
              src={`${lesson.videoUrl}?enablejsapi=1&autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full rounded-lg"
            />
          </div>
        </div>
      </Card>
    );
  }

  // --- ARTICLE CONTENT ---
  if (type === "article") {
    // ✅ Case 1: If backend provides text content
    if (lesson.articleContent) {
      const articlePages = lesson.articleContent.split("\n\n");
      return (
        <Card className="w-full bg-amber-50 p-6 rounded-xl shadow-lg border border-amber-200">
          <div>
            <h2 className="text-xl font-bold text-orange-800 mb-3">{contentTitle} (Article)</h2>
            <p className="text-warmGray-700 leading-relaxed text-left mb-4 min-h-[12rem] whitespace-pre-line">
              {articlePages[currentPage]}
            </p>
            <div className="flex justify-between items-center mt-4">
              <Button
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={currentPage === 0}
                className="bg-amber-400 hover:bg-amber-500 text-warmGray-800 px-6 py-3 rounded-lg"
              >
                Back
              </Button>
              <span className="text-sm font-semibold text-warmGray-800">
                Page {currentPage + 1} of {articlePages.length}
              </span>
              <Button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage >= articlePages.length - 1}
                className="bg-amber-400 hover:bg-amber-500 text-warmGray-800 px-6 py-3 rounded-lg"
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      );
    }

    // ✅ Case 2: If only article URL is provided (like kitabcd)
    if (lesson.articleUrl) {
      return (
        <Card className="w-full bg-white p-0 rounded-xl shadow-lg border border-amber-200 overflow-hidden">
          <iframe
            src={lesson.articleUrl}
            title="Lesson Article"
            className="w-full h-[800px] rounded-lg"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          ></iframe>
        </Card>
      );
    }

    // ✅ Fallback if nothing available
    return (
      <Card className="w-full bg-amber-50 p-6 rounded-xl shadow-lg border border-amber-200">
        <p className="text-warmGray-700">No article available for this lesson.</p>
      </Card>
    );
  }

  return null;
};
