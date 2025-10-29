import React, { useState, useEffect } from "react";
import { Card, Button } from "./Common";

export const StudyContent = ({ lesson, type, videoRef }) => {
  // State for article pagination is now inside the specific article instance
  const [currentPage, setCurrentPage] = useState(0);

  // We REMOVED the useEffect that resets currentPage, 
  // as the parent now uses a unique `key` for the article instance, 
  // ensuring it is recreated only when the lesson changes, not when the tab switches.

  // Ensure lesson is valid before rendering
  if (!lesson) return null;

  // Article content logic (Remains the same, using split pagination)
  const mockArticleContent = "Lesson article content placeholder. This is the first page.\n\nThis is the second page of the article, simulating a page break.\n\nFinally, the third page with some more details.";
  // Ensure you update the backend to populate lesson.articleContent!
  const articlePages = lesson.articleContent ? lesson.articleContent.split('\n\n') : mockArticleContent.split('\n\n');

  const contentTitle = lesson.lessonTitle || lesson.title || "Lesson Content"; // Use the correct title field

  // --- Video Content (Return this when type is 'video') ---
  if (type === 'video') {
    // NOTE: Ensure lesson.videoUrl is the EMBED URL (e.g., https://www.youtube.com/embed/VIDEO_ID)
    // as discussed in previous steps, to avoid X-Frame-Options errors.
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

  // --- Article Content (Return this when type is 'article') ---
  if (type === 'article') {
    return (
      <Card className="w-full bg-amber-50 p-6 rounded-xl shadow-lg border border-amber-200">
        <div>
          <h2 className="text-xl font-bold text-orange-800 mb-3">{contentTitle} (Article)</h2>
          <p className="text-warmGray-700 leading-relaxed text-left mb-4 min-h-[12rem]">{articlePages[currentPage]}</p>
          <div className="flex justify-between items-center mt-4">
            <Button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0} className="bg-amber-400 hover:bg-amber-500 text-warmGray-800 px-6 py-3 rounded-lg">Back</Button>
            <span className="text-sm font-semibold text-warmGray-800">Page {currentPage + 1} of {articlePages.length}</span>
            <Button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= articlePages.length - 1} className="bg-amber-400 hover:bg-amber-500 text-warmGray-800 px-6 py-3 rounded-lg">Next</Button>
          </div>
        </div>
      </Card>
    );
  }
  
  return null;
};
