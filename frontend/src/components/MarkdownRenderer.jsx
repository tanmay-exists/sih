// MarkdownRenderer.jsx
import React from 'react';
import { ListenButton } from './Common'; // Assuming ListenButton is in Common

// Minimal function to replace basic markdown for display purposes
// NOTE: For real-world use, install 'marked' or 'react-markdown'
const simpleMarkdownToHtml = (markdown) => {
  if (!markdown) return { __html: "" };

  // 1. Replace **bold** with <strong>
  let html = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 2. Replace *italics* with <em>
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // 3. Replace numbered/bullet points (\n* or \n1. ) with <ul>/<li>
  // This is a very rough implementation, but better than nothing.
  html = html.split('\n').map(line => {
    if (line.trim().startsWith('* ')) {
      return `<li>${line.trim().substring(2)}</li>`;
    }
    if (line.trim().match(/^\d+\.\s/)) {
      return `<li>${line.trim().substring(line.trim().indexOf('.') + 1).trim()}</li>`;
    }
    return `<p>${line}</p>`;
  }).join('');

  // Wrap list items in <ul> if they exist
  if (html.includes('<li>')) {
    html = `<ul>${html}</ul>`;
    html = html.replace(/<\/ul><p>/g, '</ul><p>').replace(/<\/p><ul>/g, '</p><ul>');
  }

  return { __html: html };
};

export const MarkdownRenderer = ({ content, className = '' }) => {
  // Basic check for chat messages to avoid parsing list items (since they are often single-line)
  const isChat = className.includes('chat-bubble');
  const renderedContent = isChat ? { __html: content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') } : simpleMarkdownToHtml(content);

  return (
    <div 
      className={`leading-relaxed ${className}`} 
      dangerouslySetInnerHTML={renderedContent}
    />
  );
};
