
import React from 'react';
import { User } from '../types';
import { Shield, Eye, User as UserIcon } from 'lucide-react';

interface ParticipantListProps {
  participants: User[];
  revealed: boolean;
  currentUserId: string;
}

const ParticipantList: React.FC<ParticipantListProps> = ({ participants, revealed, currentUserId }) => {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield size={10} className="text-indigo-500" />;
      case 'observer': return <Eye size={10} className="text-slate-400" />;
      default: return <UserIcon size={10} className="text-slate-400" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Participants</h3>
      <div className="space-y-3">
        {participants.map((user) => (
          <div key={user.id} className="flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white transition-colors
                ${user.id === currentUserId ? 'bg-indigo-600 ring-4 ring-indigo-50' : 'bg-slate-400'}`}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {user.name} {user.id === currentUserId && <span className="text-indigo-500 text-[10px] font-bold ml-1">YOU</span>}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {getRoleIcon(user.role)}
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{user.role}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {user.role === 'observer' ? (
                <span className="text-[10px] text-slate-300 font-bold uppercase">Watching</span>
              ) : revealed ? (
                <div className={`w-8 h-8 rounded border-2 flex items-center justify-center font-bold text-sm transition-all
                  ${user.currentVote ? 'border-indigo-500 bg-indigo-50 text-indigo-700 scale-110 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  {user.currentVote || '-'}
                </div>
              ) : (
                user.currentVote ? (
                  <div className="bg-green-100 text-green-600 p-1.5 rounded-full animate-bounce">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-200 animate-pulse"></div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ParticipantList;
