import React from "react";
import renderBold from '../utils/renderBold';
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
      <div className="timeline-header">
        <h3 className="timeline-title">Timeline of Events</h3>
        <p className="timeline-subtitle">{timelineData.length} events found</p>
      </div>
      <div className="custom-timeline">
        {timelineData.map((item, index) => (
          <div key={index} className="timeline-item">
            <div className="timeline-dot">
              <div className="timeline-dot-inner"></div>
            </div>
            <div className="timeline-connector"></div>
            <div className="timeline-content">
              <div className="timeline-date-badge">
                <svg className="timeline-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="timeline-date">{item.date}</span>
              </div>
              <div className="timeline-event-card">
                <div className="timeline-event whitespace-pre-wrap">{renderBold(item.event)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Timeline;