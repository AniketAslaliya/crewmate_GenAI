import React from 'react';

const Input = ({ className = '', ...props }) => {
  return (
    <input
      className={`input w-full text-sm text-primary placeholder:text-muted ${className} motion-safe`}
      {...props}
    />
  );
};

export default Input;
