import React from 'react';

const Button = ({ children, variant = 'primary', className = '', onClick, ...props }) => {
	const base = 'inline-flex items-center justify-center font-medium focus:outline-none motion-safe';
	const variants = {
		primary: 'btn-primary text-sm',
		secondary: 'btn-secondary text-sm',
		accent: 'btn-accent text-sm',
		ghost: 'bg-transparent text-[var(--color-primary)] border border-transparent hover:border-[rgba(0,0,0,0.04)]'
	};

	const cls = `${base} ${variants[variant] || variants.primary} ${className}`;

	return (
		<button className={cls} onClick={onClick} {...props}>
			{children}
		</button>
	);
};

export default Button;
