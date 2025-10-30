import React from 'react';

const Card = ({ children, className = '', ...props }) => {
  return (
    <div className={`card bg-surface p-5 ${className}`} {...props}>
      {children}
    </div>
  );
};

export default Card;
