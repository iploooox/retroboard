import type { ReactNode, HTMLAttributes } from 'react';

interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  variant?: 'gray' | 'green' | 'blue' | 'yellow' | 'red' | 'purple';
  children: ReactNode;
}

const variants = {
  gray: 'bg-slate-100 text-slate-700',
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
};

export function Badge({ variant = 'gray', children, className, ...props }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className ?? ''}`} {...props}>
      {children}
    </span>
  );
}
