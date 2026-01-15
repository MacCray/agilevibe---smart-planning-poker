
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { getEstimationInsight } from './services/geminiService';
import {
  Users,
  RefreshCcw,
  Eye,
  Trophy,
  Edit3,
  UserCheck,
  ShieldCheck,
  LogOut,
  BrainCircuit,
  Loader2,
  Wifi,
  WifiOff
} from 'lucide-react';

// Обновленный ключ для чистой сессии
const GLOBAL_SESSION_KEY = 'agilevibe_v5_prod';

const App: React.FC = () => {
  // Инициализация Gun с расширенным списком реле
  const gun = useMemo(() => {
    const GunLib = (window as any).Gun;
    if (!GunLib) return null;
    return new GunLib({
      peers: [
        'https://gun-manhattan.herokuapp.com/gun',
        'https://relay.peer.ooo/gun',
        'https://gun-us.herokuapp.com/gun',
        'https://gun-eu.herokuapp.com/gun',
        'https://peer.wall.org/gun'
      ],
      localStorage: true
    });
  }, []);

  const roomData = useMemo(() => gun ? gun.get(GLOBAL_SESSION_KEY) : null, [gun]);

  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<'voter' | 'admin' | 'observer'>('voter');
  const [isOnline, setIsOnline] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [session, setSession] = useState<PokerSession>({
    id: 'global',
    name: 'Team Planning',
    currentTask: { id: '1', title: 'New Task', description: 'Describe the story here...' },
    revealed: false,
    participants: [],
    deck: DEFAULT_DECK
  });

  const sessionRef = useRef(session);
  const currentUserRef = useRef(currentUser);

  useEffect(() => { sessionRef.current = session; }, [session]);

  // Регистрация и обновление своего присутствия
  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser && roomData) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
      roomData.get('participants').get(currentUser.id).put({
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
        currentVote: currentUser.currentVote || null,
        lastSeen: Date.now()
      });
    }
  }, [currentUser, roomData]);

  useEffect(() => {
    if (!roomData) return;

    setIsOnline(true);

    // Слушаем статус раскрытия через объект с меткой времени (для 100% срабатывания)
    roomData.get('revealed_state').on((data: any) => {
      if (data && data.val !== undefined) {
        setSession(prev => ({ ...prev, revealed: !!data.val }));
      }
    });

    // Слушаем текущую задачу
    roomData.get('task_state').on((data: any) => {
      if (data && data.payload) {
        try {
          const task = JSON.parse(data.payload);
          setSession(prev => ({ ...prev, currentTask: task }));
        } catch (e) {
          console.error("Task sync error", e);
        }
      }
    });

    // Синхронизация участников
    roomData.get('participants').map().on((user: any, id: string) => {
      if (!id || id === 'undefined' || id === 'null') return;

      setSession(prev => {
        const others = prev.participants.filter(p => p.id !== id);

        // Удаляем тех, кто пропал из сети (40 сек)
        if (!user || (user.lastSeen && Date.now() - user.lastSeen > 40000)) {
           return { ...prev, participants: others };
        }

        const typedUser: User = {
          id: user.id || id,
          name: user.name || 'Unknown',
          role: user.role || 'voter',
          currentVote: (user.currentVote === undefined || user.currentVote === null) ? null : String(user.currentVote)
        };

        return { ...prev, participants: [...others, typedUser] };
      });
    });

    // Heartbeat для отображения присутствия
    const heartbeat = setInterval(() => {
      if (currentUserRef.current && roomData) {
        roomData.get('participants').get(currentUserRef.current.id).get('lastSeen').put(Date.now());
      }
    }, 10000);

    return () => {
      roomData.get('revealed_state').off();
      roomData.get('task_state').off();
      roomData.get('participants').off();
      clearInterval(heartbeat);
    };
  }, [roomData]);

  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
      setView(AppView.SESSION);
    }
  }, []);

  const onJoin = (name: string) => {
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: name.trim() || 'Guest',
      role: selectedRole,
      currentVote: null
    };
    setCurrentUser(newUser);
    setView(AppView.SESSION);
  };

  const onLogout = () => {
    if (currentUser && roomData) {
      roomData.get('participants').get(currentUser.id).put(null);
    }
    localStorage.removeItem(STORAGE_KEYS.USER);
    setCurrentUser(null);
    setView(AppView.LANDING);
  };

  const onVote = (vote: string) => {
    if (!currentUser || currentUser.role === 'observer' || session.revealed || !roomData) return;
    const voteValue = currentUser.currentVote === vote ? null : vote;
    setCurrentUser(prev => prev ? ({ ...prev, currentVote: voteValue }) : null);
    roomData.get('participants').get(currentUser.id).get('currentVote').put(voteValue);
  };

  const onReveal = () => {
    if (roomData) {
      // Отправляем объект с TS, чтобы спровоцировать событие .on() у всех участников
      roomData.get('revealed_state').put({ val: true, ts: Date.now() });
    }
  };

  const onReset = () => {
    if (!roomData) return;

    // Сброс голосов в БД
    sessionRef.current.participants.forEach(p => {
      roomData.get('participants').get(p.id).get('currentVote').put(null);
    });

    // Сброс состояния раскрытия
    roomData.get('revealed_state').put({ val: false, ts: Date.now() });
    setAiInsight(null);

    if (currentUser) {
      setCurrentUser({ ...currentUser, currentVote: null });
    }
  };

  const onUpdateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!roomData) return;
    const formData = new FormData(e.currentTarget);
    const title = (formData.get('title') as string) || 'New Task';
    const description = (formData.get('description') as string) || '';
    const newTask: Task = { id: Date.now().toString(), title, description };

    onReset();
    roomData.get('task_state').put({ payload: JSON.stringify(newTask), ts: Date.now() });
    e.currentTarget.reset();
  };

  const handleAiAnalysis = async () => {
    if (!session.currentTask) return;
    setIsAnalyzing(true);
    const votes = session.participants
      .map(p => p.currentVote)
      .filter((v): v is string => v !== null);

    const insight = await getEstimationInsight(
      session.currentTask.title,
      session.currentTask.description,
      votes
    );
    setAiInsight(insight);
    setIsAnalyzing(false);
  };

  const voteList = useMemo(() =>
    session.participants.map(p => p.currentVote).filter(v => v !== null && v !== undefined) as string[]
  , [session.participants]);

  const average = useMemo(() => {
    const numericVotes = voteList.filter(v => !isNaN(Number(v))).map(Number);
    return numericVotes.length === 0 ? 0 : (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1);
  }, [voteList]);

  if (view === AppView.LANDING) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-xl border border-slate-100">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white mb-6">
              <Trophy size={32} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">AgileVibe</h1>
            <p className="mt-2 text-slate-500">Global Planning Poker Session</p>
          </div>

          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
               <button onClick={() => setSelectedRole('voter')} className={`flex flex-col items-center gap-1 py-3 rounded-lg transition-all ${selectedRole === 'voter' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><UserCheck size={18} /><span className="text-[10px] font-bold uppercase">Voter</span></button>
               <button onClick={() => setSelectedRole('admin')} className={`flex flex-col items-center gap-1 py-3 rounded-lg transition-all ${selectedRole === 'admin' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><ShieldCheck size={18} /><span className="text-[10px] font-bold uppercase">Admin</span></button>
               <button onClick={() => setSelectedRole('observer')} className={`flex flex-col items-center gap-1 py-3 rounded-lg transition-all ${selectedRole === 'observer' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><Eye size={18} /><span className="text-[10px] font-bold uppercase">Viewer</span></button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); onJoin(new FormData(e.currentTarget).get('name') as string); }} className="space-y-6">
              <input name="name" type="text" required maxLength={15} className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" placeholder="Enter your name" />
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg transform hover:scale-[1.02]">
                Join Global Session
              </button>
            </form>
          </div>
          <div className="text-center text-[10px] text-slate-400 font-medium px-4">
            No rooms needed. Open this URL on multiple devices to sync instantly.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
            <span className="text-xl font-bold text-slate-900 hidden sm:block">AgileVibe</span>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${isOnline ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {isOnline ? <Wifi size={10}/> : <Loader2 size={10} className="animate-spin"/>}
              {isOnline ? 'Live Sync' : 'Connecting...'}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-sm font-bold text-slate-900 leading-tight">{currentUser?.name}</span>
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter leading-tight">{currentUser?.role}</span>
            </div>
            <button onClick={onLogout} className="text-slate-400 hover:text-red-500 p-2 transition-colors"><LogOut size={20}/></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="mb-4">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase mb-2 inline-block">Story details</span>
                <h2 className="text-2xl font-bold text-slate-900">{session.currentTask?.title}</h2>
              </div>
              <p className="text-slate-600 leading-relaxed mb-6 whitespace-pre-wrap">{session.currentTask?.description || 'No description available.'}</p>

              {currentUser?.role === 'admin' && (
                <div className="border-t pt-6 mt-6">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4"><Edit3 size={16} className="text-indigo-500"/> Edit Task</h3>
                  <form onSubmit={onUpdateTask} className="grid gap-4">
                    <input name="title" required placeholder="Task Title" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
                    <textarea name="description" placeholder="Requirements/Details..." className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all h-20" />
                    <button type="submit" className="bg-indigo-600 text-white py-2 px-6 rounded-xl font-bold hover:bg-indigo-700 transition-all w-fit shadow-md">Start New Round</button>
                  </form>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users size={20} className="text-indigo-500"/>
                {currentUser?.role === 'observer' ? 'Progress' : 'Pick your card'}
              </h3>
              <div className="flex flex-wrap gap-4">
                {session.deck.map(val => (
                  <PokerCard
                    key={val}
                    value={val}
                    selected={currentUser?.currentVote === val}
                    onSelect={onVote}
                    disabled={session.revealed || currentUser?.role === 'observer'}
                  />
                ))}
              </div>
            </div>

            {session.revealed && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white rounded-2xl shadow-lg border-l-4 border-indigo-500 p-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                    <div className="text-center border-r border-slate-100">
                      <p className="text-xs text-slate-400 font-bold uppercase mb-1">Average</p>
                      <p className="text-6xl font-black text-indigo-600">{average}</p>
                    </div>
                    <div className="md:col-span-2">
                      <EstimationChart votes={voteList} />
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-indigo-900 font-bold">
                        <BrainCircuit size={20} />
                        Gemini AI Coaching
                      </div>
                      <button
                        onClick={handleAiAnalysis}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                      >
                        {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                        Analyze Votes
                      </button>
                    </div>
                    {aiInsight ? (
                      <p className="text-indigo-800 text-sm leading-relaxed italic">"{aiInsight}"</p>
                    ) : (
                      <p className="text-indigo-400 text-sm italic">Analyze to see AI insights on consensus or variance.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-6">Game Control</h3>
              <div className="space-y-3">
                <button
                  onClick={onReveal}
                  disabled={session.revealed || voteList.length === 0}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-800 transition-all shadow-lg"
                >
                  <Eye size={20}/> Reveal Results
                </button>
                <button
                  onClick={onReset}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-all border border-slate-700"
                >
                  <RefreshCcw size={20}/> Clear Votes
                </button>
              </div>
            </div>

            <ParticipantList
              participants={session.participants}
              revealed={session.revealed}
              currentUserId={currentUser?.id || ''}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
