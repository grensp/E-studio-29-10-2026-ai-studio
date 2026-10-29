import React from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div className="text-lg font-bold text-slate-800">{title}</div>
      <div className="mt-2 max-w-md text-sm text-slate-600">{description}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
