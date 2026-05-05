import React, { memo } from 'react';
import { formatFieldValue } from '../utils/infractionFormatters';

interface DataRowProps {
  icon?: React.ComponentType<{ size: number }>;
  label: string;
  value: any;
  mono?: boolean;
  justify?: boolean;
}

const DataRowComponent: React.FC<DataRowProps> = ({
  icon: Icon,
  label,
  value,
  mono = false,
  justify = false,
}) => {
  if (value === null || value === undefined || value === '' || value === '—') return null;

  const displayValue = formatFieldValue(value, label);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[240px_minmax(0,1fr)] items-start text-sm py-1.5 gap-1 sm:gap-3 border-b border-white/5 last:border-b-0">
      <span className="text-slate-300 flex items-center gap-1.5 font-semibold uppercase text-sm tracking-wide">
        {Icon && <Icon size={12} />} {label}:
      </span>
      <span
        className={`${mono ? 'font-mono font-semibold' : 'font-medium'} text-slate-100 sm:text-right break-words uppercase text-sm ${justify ? 'sm:text-justify' : ''}`}
      >
        {displayValue}
      </span>
    </div>
  );
};

export const DataRow = memo(DataRowComponent);
