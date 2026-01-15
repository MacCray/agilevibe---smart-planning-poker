
import React from 'react';

interface PokerCardProps {
  value: string;
  selected: boolean;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

const PokerCard: React.FC<PokerCardProps> = ({ value, selected, onSelect, disabled }) => {
  return (
    <button
      onClick={() => !disabled && onSelect(value)}
      disabled={disabled}
      className={`
        relative w-16 h-24 md:w-20 md:h-28 rounded-xl border-2 transition-all duration-200 transform
        flex items-center justify-center text-xl md:text-2xl font-bold shadow-sm
        ${selected 
          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 -translate-y-2 shadow-indigo-200 shadow-lg' 
          : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/30'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <div className="absolute top-2 left-2 text-xs opacity-40">{value}</div>
      <span>{value}</span>
      <div className="absolute bottom-2 right-2 text-xs opacity-40 rotate-180">{value}</div>
    </button>
  );
};

export default PokerCard;
