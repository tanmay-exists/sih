// MarkdownRenderer.jsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks"; 
import { ListenButton, Button } from "./Common";
import { Copy } from "lucide-react";

export const MarkdownRenderer = ({ content, className = "" }) => {
  const isChatBubble = className.includes("chat-bubble");

  const components = {
    // --- Headings (Only styled significantly in standard view) ---
    h1: ({ ...props }) => (
      <h1 className={`font-extrabold ${isChatBubble ? "text-lg mb-1" : "text-2xl text-gray-900 mb-4 border-b border-orange-100 pb-2"}`} {...props} />
    ),
    h2: ({ ...props }) => (
      <h2 className={`font-bold ${isChatBubble ? "text-base mb-1" : "text-xl text-gray-800 mt-6 mb-3"}`} {...props} />
    ),
    h3: ({ ...props }) => (
      <h3 className={`font-bold ${isChatBubble ? "text-sm mb-1" : "text-lg text-gray-800 mt-4 mb-2"}`} {...props} />
    ),

    // --- Paragraphs ---
    p: ({ ...props }) => (
      <p
        className={`${
          isChatBubble
            ? "mb-1 last:mb-0 leading-snug whitespace-pre-wrap" // Inherit color for chat bubbles (white or gray)
            : "mb-4 leading-relaxed text-gray-700"
        }`}
        {...props}
      />
    ),

    // --- Lists ---
    ul: ({ ...props }) => (
      <ul
        className={`list-disc pl-5 ${
          isChatBubble ? "my-1 space-y-0.5 marker:text-current" : "my-4 space-y-2 marker:text-orange-500"
        }`}
        {...props}
      />
    ),
    ol: ({ ...props }) => (
      <ol
        className={`list-decimal pl-5 ${
          isChatBubble ? "my-1 space-y-0.5 marker:text-current" : "my-4 space-y-2 marker:text-orange-500 font-bold"
        }`}
        {...props}
      />
    ),
    li: ({ ...props }) => (
      <li className={`${isChatBubble ? "pl-1" : "pl-2 font-normal text-gray-700"}`} {...props} />
    ),

    // --- Emphasis & Decorators ---
    strong: ({ ...props }) => (
      <strong className="font-bold text-current opacity-90" {...props} />
    ),
    blockquote: ({ ...props }) => (
      <blockquote 
        className={`${
            isChatBubble 
            ? "border-l-2 border-white/50 pl-2 italic my-1" 
            : "border-l-4 border-orange-300 bg-orange-50/50 p-4 rounded-r-lg italic text-gray-600 my-4"
        }`} 
        {...props} 
      />
    ),

    // --- Code ---
    code: ({ inline, className, children, ...props }) => {
      // Inline code
      if (inline) {
        return (
          <code 
            className={`${
                isChatBubble 
                ? "bg-black/10 px-1 py-0.5 rounded font-mono text-xs" 
                : "bg-gray-100 text-orange-600 px-1.5 py-0.5 rounded font-mono text-sm border border-gray-200"
            }`} 
            {...props}
          >
            {children}
          </code>
        );
      }
      // Block code
      return (
        <div className={`rounded-lg overflow-hidden my-3 ${isChatBubble ? "bg-black/20" : "bg-gray-900 shadow-md"}`}>
            <div className="flex justify-between items-center px-3 py-1 bg-white/5 border-b border-white/10">
                <span className="text-[10px] text-gray-400 font-mono uppercase">Code</span>
            </div>
            <pre className="p-3 overflow-x-auto">
                <code className="font-mono text-sm text-gray-100" {...props}>
                    {children}
                </code>
            </pre>
        </div>
      );
    },

    // --- Links ---
    a: ({ ...props }) => (
      <a
        className={`${
            isChatBubble 
            ? "underline decoration-white/50 hover:opacity-80" 
            : "text-orange-600 hover:text-orange-700 font-medium hover:underline decoration-orange-300 underline-offset-2 transition-colors"
        }`}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    ),
  };

  return (
    <div className={`text-base ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
      >
        {content?.trim() || ""}
      </ReactMarkdown>

      {/* Show listen button only for main content, not inside small chat bubbles (parent handles that) */}
      {!isChatBubble && (
        <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
          <ListenButton text={content} className="hover:bg-gray-100 text-gray-500" />
        </div>
      )}
    </div>
  );
};
