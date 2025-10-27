import React, { useState, useEffect } from "react";
import { Card, Button } from "./Common";

export const StudyContent = ({ subject, type, videoRef }) => {
  const [currentPage, setCurrentPage] = useState(0);
  useEffect(() => { setCurrentPage(0); }, [subject]);
  if (!subject || !type) return null;
  const isArticle = type === 'article';
  const articlePages = isArticle ? subject.article.content : [];
  return (
    <Card className="w-full bg-amber-50 p-6 rounded-xl shadow-lg border border-amber-200">
      {isArticle ? (
        <div>
          <h2 className="text-xl font-bold text-orange-800 mb-3">{subject.article.title}</h2>
          <p className="text-warmGray-700 leading-relaxed text-left mb-4 min-h-[12rem]">{articlePages[currentPage]}</p>
          <div className="flex justify-between items-center mt-4">
            <Button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0} className="bg-amber-400 hover:bg-amber-500 text-warmGray-800 px-6 py-3 rounded-lg">Back</Button>
            <span className="text-sm font-semibold text-warmGray-800">Page {currentPage + 1} of {articlePages.length}</span>
            <Button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= articlePages.length - 1} className="bg-amber-400 hover:bg-amber-500 text-warmGray-800 px-6 py-3 rounded-lg">Next</Button>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-bold text-orange-800 mb-4">{subject.article.title} (Video)</h2>
          <div className="aspect-video w-full max-w-4xl mx-auto">
            <iframe
              ref={videoRef}
              src={`${subject.video_url}?enablejsapi=1&autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full rounded-lg"
            />
          </div>
        </div>
      )}
    </Card>
  );
};
