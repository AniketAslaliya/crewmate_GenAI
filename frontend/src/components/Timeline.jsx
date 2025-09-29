import React from "react";
import "./timeline.css";

const Timeline = ({ timelineMarkdown }) => {
  // Parse markdown table to extract dates and events
  const parseTimelineData = (markdown) => {
    if (!markdown) return [];
    
    const rows = markdown.split('\n').filter(row => row.trim() !== '' && !row.includes('---|---'));
    // Remove header row
    rows.shift();
    
    return rows.map(row => {
      const [date, event] = row.split('|').filter(cell => cell.trim() !== '');
      return {
        date: date.trim(),
        event: event.trim()
      };
    });
  };

  const timelineData = parseTimelineData(timelineMarkdown);

  return (
    <div className="custom-timeline-container">
      <div className="custom-timeline">
        {timelineData.map((item, index) => (
          <div key={index} className="timeline-item">
            <div className="timeline-dot"></div>
            <div className="timeline-content">
              <div className="timeline-date">{item.date}</div>
              <div className="timeline-event">{item.event}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Timeline;