import React, { useState, useEffect } from "react";
import { Card, Button } from "./Common"; // Adjust path as needed
import { STUDY_MATERIALS } from "./Utils";

export const StudyContent = ({ subject, type, videoRef }) => {
  const [currentPage, setCurrentPage] = useState(0);
  useEffect(() => { setCurrentPage(0); }, [subject]);
  if (!subject || !type) return null;
  const material = STUDY_MATERIALS[subject];
  if (!material) return <Card><p>Content not found.</p></Card>;
  const isArticle = type === 'article';
  const articlePages = isArticle ? material.article.content : [];
  return (
    <Card className="w-full">
      {isArticle ? (
        <div>
          <h2 className="text-xl font-bold text-theme-primary mb-3">{material.article.title}</h2>
          <p className="text-theme-text/90 leading-relaxed text-left mb-4 min-h-[12rem]">{articlePages[currentPage]}</p>
          <div className="flex justify-between items-center mt-4">
            <Button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0} className="bg-theme-secondary/80 hover:bg-theme-secondary !text-theme-text">Back</Button>
            <span className="text-sm font-semibold text-theme-text/80">Page {currentPage + 1} of {articlePages.length}</span>
            <Button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= articlePages.length - 1} className="bg-theme-secondary/80 hover:bg-theme-secondary !text-theme-text">Next</Button>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-bold text-theme-primary mb-4">{material.article.title} (Video)</h2>
          <div className="aspect-video w-full">
            <iframe
              ref={videoRef}
              src={`${material.video}?enablejsapi=1`}
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
