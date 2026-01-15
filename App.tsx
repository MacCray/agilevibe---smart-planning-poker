
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Gun from 'gun';
import {
  AppView,
  User,
  PokerSession,
  Task
} from './types';
import { DEFAULT_DECK, STORAGE_KEYS } from './constants';
import PokerCard from './components/PokerCard';
import ParticipantList from './components/ParticipantList';
import EstimationChart from './components/EstimationChart';
import {
  Users,
  Send,
  RefreshCcw,
  Eye,
  Trophy,
  Edit3,
  UserCheck,
  ShieldCheck,
  EyeOff,
  Plus,
  Trash2,
  Settings2,
  LogOut,
  Link as LinkIcon,
  Check
} from 'lucide-react';

// Initialize Gun with public relay peers
const gun = Gun(['https://gun-manhattan.herokuapp.com/gun']);

const App: React.FC = () => {
  // --- Room Management ---
  const getRoomId = () => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace('#', ''));
    return params.get('room') || 'default-room';
  };

  const [roomId] = useState(getRoomId());
  const room = useMemo(() => gun.get('agilevibe').get(roomId), [roomId]);

  // --- State ---
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<'voter' | 'admin' | 'observer'>('voter');
  const [session, setSession] = useState<PokerSession>({
    id: roomId,
    name: 'Team Planning',
    currentTask: { id: '1', title: '', description: '' },
    revealed: false,
    participants: [],
    deck: DEFAULT_DECK
  });

  const [newCardValue, setNewCardValue] = useState('');
  const [copied, setCopied] = useState(false);

  // References for synchronization logic
  const sessionRef = useRef(session);
  const currentUserRef = useRef(currentUser);

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
      // Update our presence in Gun
      room.get('participants').get(currentUser.id).put(currentUser);
    }
  }, [currentUser, room]);

  // --- Real-time Sync with Gun ---
  useEffect(() => {
    // 1. Sync Task & Session State
    room.get('state').on((data) => {
      if (!data) return;
      setSession(prev => ({
        ...prev,
        currentTask: data.currentTask ? JSON.parse(data.currentTask) : prev.currentTask,
        revealed: !!data.revealed,
        deck: data.deck ? JSON.parse(data.deck) : prev.deck
      }));
    });

    // 2. Sync Participants
    room.get('participants').map().on((user, id) => {
      if (!id) return;
      setSession(prev => {
        const otherParticipants = prev.participants.filter(p => p.id !== id);
        if (!user) return { ...prev, participants: otherParticipants };

        // Convert to our User interface (Gun might return objects with meta)
        const typedUser: User = {
          id: user.id,
          name: user.name,
          role: user.role,
          currentVote: user.currentVote === undefined ? null : user.currentVote
        };

        return { ...prev, participants: [...otherParticipants, typedUser] };
      });
    });

    return () => {
      room.get('state').off();
      room.get('participants').off();
    };
  }, [room]);

  // Presence Cleanup
  useEffect(() => {
    const handleUnload = () => {
      if (currentUserRef.current) {
        // We set it to null in Gun to signal we left
        room.get('participants').get(currentUserRef.current.id).put(null);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [room]);

  // --- Initialization ---
  useEffect(() => {
    // Ensure URL has room ID
    if (!window.location.hash.includes('room=')) {
      const newRoomId = Math.random().toString(36).substr(2, 6);
      window.location.hash = `room=${newRoomId}`;
      window.location.reload();
      return;
    }

    const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
    if (savedUser) {
      const user = JSON.parse(savedUser) as User;
      setCurrentUser(user);
      setView(AppView.SESSION);
    }
  }, []);

  const onJoin = (name: string) => {
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      role: selectedRole,
      currentVote: null
    };
    setCurrentUser(newUser);
    setView(AppView.SESSION);
  };

  const onLogout = () => {
    if (currentUser) {
      room.get('participants').get(currentUser.id).put(null);
    }
    localStorage.removeItem(STORAGE_KEYS.USER);
    setCurrentUser(null);
    setView(AppView.LANDING);
  };

  const onVote = (vote: string) => {
    if (!currentUser || currentUser.role === 'observer') return;
    setCurrentUser(prev => prev ? ({ ...prev, currentVote: vote }) : null);
  };

  const onReveal = () => {
    room.get('state').get('revealed').put(true);
  };

  const onReset = () => {
    // Reset votes for everyone in Gun
    sessionRef.current.participants.forEach(p => {
      room.get('participants').get(p.id).get('currentVote').put(null);
    });

    room.get('state').put({ revealed: false });

    if (currentUser) {
      setCurrentUser({ ...currentUser, currentVote: null });
    }
  };

  const onUpdateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = (formData.get('title') as string) || '';
    const description = (formData.get('description') as string) || '';

    const newTask: Task = { id: Date.now().toString(), title, description };

    // Reset votes when task changes
    sessionRef.current.participants.forEach(p => {
      room.get('participants').get(p.id).get('currentVote').put(null);
    });

    room.get('state').put({
      currentTask: JSON.stringify(newTask),
      revealed: false
    });

    if (currentUser) {
      setCurrentUser({ ...currentUser, currentVote: null });
    }
    e.currentTarget.reset();
  };

  const onAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardValue || session.deck.includes(newCardValue)) return;
    const newDeck = [...session.deck, newCardValue].sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);
      if (isNaN(numA) || isNaN(numB)) return a.localeCompare(b);
      return numA - numB;
    });
    room.get('state').get('deck').put(JSON.stringify(newDeck));
    setNewCardValue('');
  };

  const onRemoveCard = (val: string) => {
    const newDeck = session.deck.filter(c => c !== val);
    room.get('state').get('deck').put(JSON.stringify(newDeck));
  };

  const toggleRole = () => {
    if (!currentUser) return;
    let nextRole: 'admin' | 'voter' | 'observer';
    if (currentUser.role === 'voter') nextRole = 'admin';
    else if (currentUser.role === 'admin') nextRole = 'observer';
    else nextRole = 'voter';

    setCurrentUser({ ...currentUser, role: nextRole });
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const voteList = useMemo(() =>
    session.participants.map(p => p.currentVote).filter(v => v !== null && v !== undefined) as string[]
  , [session.participants]);

  const average = useMemo(() => {
    const numericVotes = voteList.filter(v => !isNaN(Number(v))).map(Number);
    return numericVotes.length === 0 ? 0 : (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1);
  }, [voteList]);

  const myVote = useMemo(() => {
    return session.participants.find(p => p.id === currentUser?.id)?.currentVote;
  }, [session.participants, currentUser]);

  if (view === AppView.LANDING) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-xl border border-slate-100">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white mb-6">
              <Trophy size={32} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">AgileVibe</h1>
            <p className="mt-2 text-slate-500">Global real-time Planning Poker.</p>
          </div>

          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
               <button onClick={() => setSelectedRole('voter')} className={`flex flex-col items-center gap-1 py-3 px-1 rounded-lg transition-all ${selectedRole === 'voter' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><UserCheck size={18} /><span className="text-[10px] font-bold uppercase">Voter</span></button>
               <button onClick={() => setSelectedRole('admin')} className={`flex flex-col items-center gap-1 py-3 px-1 rounded-lg transition-all ${selectedRole === 'admin' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><ShieldCheck size={18} /><span className="text-[10px] font-bold uppercase">Admin</span></button>
               <button onClick={() => setSelectedRole('observer')} className={`flex flex-col items-center gap-1 py-3 px-1 rounded-lg transition-all ${selectedRole === 'observer' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><Eye size={18} /><span className="text-[10px] font-bold uppercase">Observer</span></button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); onJoin(new FormData(e.currentTarget).get('name') as string); }} className="space-y-6">
              <input name="name" type="text" required className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Your Display Name" />
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg transform hover:scale-[1.02]">
                Join Session
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
            <span className="text-xl font-bold text-slate-900">AgileVibe</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={copyInviteLink}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${copied ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {copied ? <Check size={14}/> : <LinkIcon size={14}/>}
              {copied ? 'Copied!' : 'Invite Link'}
            </button>
            <div className="h-8 w-px bg-slate-200 mx-1"></div>
            <span className="hidden sm:block text-sm font-semibold text-slate-900">{currentUser?.name}</span>
            <button onClick={onLogout} className="text-slate-400 hover:text-red-500 p-2"><LogOut size={20}/></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="mb-4">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mb-2 inline-block">Task</span>
                <h2 className="text-2xl font-bold text-slate-900">{session.currentTask?.title || 'Waiting...'}</h2>
              </div>
              <p className="text-slate-700 leading-relaxed mb-6 whitespace-pre-wrap">{session.currentTask?.description || 'No description provided.'}</p>

              {currentUser?.role === 'admin' && (
                <div className="border-t pt-6 mt-6">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4"><Edit3 size={16}/> New Task</h3>
                  <form onSubmit={onUpdateTask} className="grid gap-4">
                    <input name="title" required placeholder="Task Title" className="w-full px-4 py-2 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                    <textarea name="description" placeholder="Task description..." className="w-full px-4 py-2 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button type="submit" className="bg-indigo-600 text-white py-2 px-6 rounded-xl font-bold hover:bg-indigo-700 w-fit">Set Task</button>
                  </form>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2"><Users size={20} className="text-slate-400"/> {currentUser?.role === 'observer' ? 'Observers view' : 'Select Estimate'}</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-4">
                {session.deck.map(val => (
                  <PokerCard
                    key={val}
                    value={val}
                    selected={myVote === val}
                    onSelect={onVote}
                    disabled={session.revealed || currentUser?.role === 'observer'}
                  />
                ))}
              </div>
            </div>

            {session.revealed && (
              <div className="bg-white rounded-2xl shadow-md border-l-4 border-indigo-500 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="text-center">
                    <p className="text-sm text-slate-500 font-medium mb-1">Average</p>
                    <p className="text-5xl font-extrabold text-indigo-600">{average}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-slate-500 font-medium mb-4">Results</p>
                    <EstimationChart votes={voteList} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100">
              <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-6">Controls</h3>
              <div className="space-y-3">
                <button
                  onClick={onReveal}
                  disabled={session.revealed || voteList.length === 0}
                  className="w-full flex items-center justify-center gap-3 py-3 bg-white text-indigo-900 rounded-xl font-bold hover:bg-indigo-50 disabled:opacity-50 transition-all shadow-sm"
                >
                  <Eye size={18}/> Reveal Votes
                </button>
                <button
                  onClick={onReset}
                  className="w-full flex items-center justify-center gap-3 py-3 bg-indigo-800 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all border border-indigo-700"
                >
                  <RefreshCcw size={18}/> Reset Round
                </button>
              </div>

              {currentUser?.role === 'admin' && (
                <div className="mt-6 pt-6 border-t border-indigo-800 space-y-4">
                  <h4 className="text-[10px] font-bold text-indigo-300 uppercase flex items-center gap-2"><Settings2 size={12}/> Custom Deck</h4>
                  <form onSubmit={onAddCard} className="flex gap-2">
                    <input value={newCardValue} onChange={(e) => setNewCardValue(e.target.value)} placeholder="New card..." className="flex-1 bg-indigo-950 border border-indigo-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500" />
                    <button type="submit" className="bg-indigo-600 p-1.5 rounded-lg hover:bg-indigo-500"><Plus size={16}/></button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    {session.deck.map(val => (
                      <div key={val} className="group relative bg-indigo-950 border border-indigo-700 rounded px-2 py-1 text-[10px] font-bold">
                        {val}
                        <button onClick={() => onRemoveCard(val)} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={8}/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={toggleRole} className="w-full mt-6 text-[10px] font-bold text-indigo-300 hover:text-white transition-colors uppercase flex justify-center items-center gap-2">
                <RefreshCcw size={10}/> Change Role: {currentUser?.role}
              </button>
            </div>
            <ParticipantList participants={session.participants} revealed={session.revealed} currentUserId={currentUser?.id || ''} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
