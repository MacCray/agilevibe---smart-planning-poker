
import React from 'react';
import { User } from '../types';
import { Shield, User as UserIcon, CheckCircle2 } from 'lucide-react';

interface ParticipantListProps {
  participants: User[];
  revealed: boolean;
  currentUserId: string;
}

const ParticipantList: React.FC<ParticipantListProps> = ({ participants, revealed, currentUserId }) => {
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield size={10} className="text-indigo-500" />;
      default: return <UserIcon size={10} className="text-slate-400" />;
    }
  };

  const TEAM_ORDER: Array<Exclude<User['team'], null>> = ['Java', 'React', 'QA'];

  const voters = participants.filter(p => p.role === 'voter');
  const admins = participants.filter(p => p.role === 'admin');

  const sortedVoters = [...voters].sort((a, b) => {
    const teamA = (a.team || 'React') as Exclude<User['team'], null>;
    const teamB = (b.team || 'React') as Exclude<User['team'], null>;
    const teamCmp = TEAM_ORDER.indexOf(teamA) - TEAM_ORDER.indexOf(teamB);
    if (teamCmp !== 0) return teamCmp;

    // сначала проголосовавшие
    const votedCmp = Number(Boolean(b.currentVote)) - Number(Boolean(a.currentVote));
    if (votedCmp !== 0) return votedCmp;

    // стабильный порядок входа
    const joinedCmp = (a.joinedAt || 0) - (b.joinedAt || 0);
    if (joinedCmp !== 0) return joinedCmp;
    return a.id.localeCompare(b.id);
  });

  const groupedByTeam = TEAM_ORDER.map(team => ({
    team,
    users: sortedVoters.filter(u => (u.team || 'React') === team)
  })).filter(g => g.users.length > 0);

  const sortedAdmins = [...admins].sort((a, b) => {
    const joinedCmp = (a.joinedAt || 0) - (b.joinedAt || 0);
    if (joinedCmp !== 0) return joinedCmp;
    return a.id.localeCompare(b.id);
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Team Members</h3>
        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-500">{participants.length}</span>
      </div>
      <div className="space-y-4">
        {groupedByTeam.map(group => (
          <div key={group.team} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{group.team}</p>
              <span className="text-[10px] bg-slate-50 px-2 py-0.5 rounded-full font-bold text-slate-500">{group.users.length}</span>
            </div>
            <div className="space-y-4">
              {group.users.map((user) => (
                <div key={user.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white transition-all
                      ${user.id === currentUserId ? 'bg-indigo-600 ring-2 ring-indigo-100' : 'bg-slate-200 text-slate-500'}`}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 leading-none mb-1">
                        {user.name} {user.id === currentUserId && <span className="text-indigo-500 text-[9px] ml-1">(You)</span>}
                      </p>
                      <div className="flex items-center gap-1">
                        {getRoleIcon(user.role)}
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{user.role}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {revealed ? (
                      <div className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center font-black text-sm transition-all
                        ${user.currentVote ? 'border-indigo-500 bg-indigo-50 text-indigo-700 scale-110' : 'border-slate-100 bg-slate-50 text-slate-300'}`}>
                        {user.currentVote || '?'}
                      </div>
                    ) : (
                      user.currentVote ? (
                        <div className="flex items-center gap-1.5 text-green-500">
                          <span className="text-[10px] font-bold uppercase tracking-tight">Voted</span>
                          <CheckCircle2 size={16} fill="currentColor" className="text-white" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span className="text-[10px] font-bold uppercase tracking-tight italic">Voting...</span>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200 animate-pulse"></div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {sortedAdmins.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Admin</p>
              <span className="text-[10px] bg-slate-50 px-2 py-0.5 rounded-full font-bold text-slate-500">{sortedAdmins.length}</span>
            </div>
            <div className="space-y-4">
              {sortedAdmins.map((user) => (
                <div key={user.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white transition-all
                      ${user.id === currentUserId ? 'bg-indigo-600 ring-2 ring-indigo-100' : 'bg-slate-200 text-slate-500'}`}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 leading-none mb-1">
                        {user.name} {user.id === currentUserId && <span className="text-indigo-500 text-[9px] ml-1">(You)</span>}
                      </p>
                      <div className="flex items-center gap-1">
                        {getRoleIcon(user.role)}
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{user.role}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-300 font-bold uppercase italic">Controls</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantList;
