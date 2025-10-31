import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks"; // ✅ key plugin to fix spacing
import { ListenButton } from "./Common";

export const MarkdownRenderer = ({ content, className = "" }) => {
  const isChatBubble = className.includes("chat-bubble");

  const components = {
    p: ({ ...props }) => (
      <p
        className={`${
          isChatBubble
            ? "mb-0 leading-snug whitespace-pre-wrap"
            : "mb-2 leading-relaxed"
        }`}
        {...props}
      />
    ),
    ul: ({ ...props }) => (
      <ul
        className={`list-disc pl-5 ${
          isChatBubble ? "my-1 space-y-0.5" : "my-2 space-y-1"
        }`}
        {...props}
      />
    ),
    ol: ({ ...props }) => (
      <ol
        className={`list-decimal pl-5 ${
          isChatBubble ? "my-1 space-y-0.5" : "my-2 space-y-1"
        }`}
        {...props}
      />
    ),
    li: ({ ...props }) => (
      <li className={`${isChatBubble ? "mb-0.5" : "mb-1"}`} {...props} />
    ),
    code: ({ ...props }) => (
      <code className="bg-gray-200 text-red-600 px-1 py-0.5 rounded font-mono text-sm" {...props} />
    ),
    a: ({ ...props }) => (
      <a
        className="text-blue-600 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    ),
  };

  return (
    <div className={`leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]} // ✅ handles newlines better
        components={components}
      >
        {content?.trim() || ""}
      </ReactMarkdown>

      {!isChatBubble && (
        <div className="mt-4">
          <ListenButton text={content} />
        </div>
      )}
    </div>
  );
};
