
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

// Уникальный ключ для этой версии синхронизации
const ROOT_KEY = 'agilevibe_v6_final';

// Инициализируем Gun вне компонента для стабильности соединения
const GunLib = (window as any).Gun;
const gun = GunLib ? new GunLib({
  peers: [
    'https://gun-manhattan.herokuapp.com/gun',
    'https://relay.peer.ooo/gun',
    'https://gun-us.herokuapp.com/gun'
  ],
  localStorage: true // Возвращаем true для надежности событий
}) : null;

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<'voter' | 'admin' | 'observer'>('voter');
  const [isOnline, setIsOnline] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Разделенное состояние для более быстрой реакции UI
  const [participants, setParticipants] = useState<Record<string, User>>({});
  const [revealed, setRevealed] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task>({
    id: '1',
    title: 'New Story',
    description: 'Describe requirements here...'
  });

  const currentUserRef = useRef<User | null>(null);
  const participantsRef = useRef(participants);

  useEffect(() => {
    currentUserRef.current = currentUser;
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
    }
  }, [currentUser]);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    if (!gun) return;
    const room = gun.get(ROOT_KEY);
    console.log('[Gun] Initializing room:', ROOT_KEY);
    setIsOnline(true);

    // 1. Слушаем статус раскрытия карт
    room.get('revealed_state').on((data: any) => {
      console.log('[Gun] revealed_state changed:', data);
      // Gun.js может возвращать данные в разных форматах
      const value = data?.val !== undefined ? data.val : (data !== null && data !== undefined ? data : false);
      setRevealed(!!value);
    });

    // Загружаем начальное состояние раскрытия
    room.get('revealed_state').once((data: any) => {
      if (data) {
        const value = data?.val !== undefined ? data.val : (data !== null && data !== undefined ? data : false);
        setRevealed(!!value);
      }
    });

    // 2. Слушаем текущую задачу
    room.get('task_state').on((data: any) => {
      console.log('[Gun] task_state changed:', data);
      if (data) {
        const payload = data.payload || data;
        if (typeof payload === 'string') {
          try {
            const task = JSON.parse(payload);
            setCurrentTask(task);
          } catch (e) { 
            console.error('[Gun] Error parsing task:', e); 
          }
        } else if (payload && payload.title) {
          setCurrentTask(payload);
        }
      }
    });

    // Загружаем начальное состояние задачи
    room.get('task_state').once((data: any) => {
      if (data) {
        const payload = data.payload || data;
        if (typeof payload === 'string') {
          try {
            const task = JSON.parse(payload);
            setCurrentTask(task);
          } catch (e) { 
            console.error('[Gun] Error parsing initial task:', e); 
          }
        } else if (payload && payload.title) {
          setCurrentTask(payload);
        }
      }
    });

    // 3. Синхронизация участников (карта id -> данные)
    room.get('participants').map().on((data: any, id: string) => {
      console.log('[Gun] participant changed:', id, data);
      if (!id || id === 'undefined') return;

      // Gun.js может возвращать null или undefined для удаленных записей
      if (!data || data === null || (data.lastSeen && Date.now() - data.lastSeen > 30000)) {
        setParticipants(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        setParticipants(prev => ({
          ...prev,
          [id]: {
            id: data.id || id,
            name: data.name || 'Anonymous',
            role: data.role || 'voter',
            currentVote: data.currentVote === null || data.currentVote === undefined ? null : String(data.currentVote)
          }
        }));
      }
    });

    // Обновляем свое присутствие в сети
    const heartbeat = setInterval(() => {
      if (currentUserRef.current) {
        room.get('participants').get(currentUserRef.current.id).put({
          ...currentUserRef.current,
          lastSeen: Date.now()
        });
      }
    }, 5000);

    return () => {
      clearInterval(heartbeat);
      room.get('revealed_state').off();
      room.get('task_state').off();
      room.get('participants').off();
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER);
    if (saved) {
      const user = JSON.parse(saved);
      setCurrentUser(user);
      setView(AppView.SESSION);
      
      // Регистрируем пользователя в Gun.js при восстановлении из localStorage
      if (gun && user) {
        const room = gun.get(ROOT_KEY);
        room.get('participants').get(user.id).put({
          ...user,
          lastSeen: Date.now()
        });
        console.log('[Gun] User restored and registered:', user.id);
      }
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
    
    // Регистрируем пользователя в Gun.js для синхронизации с другими участниками
    if (gun) {
      const room = gun.get(ROOT_KEY);
      room.get('participants').get(newUser.id).put({
        ...newUser,
        lastSeen: Date.now()
      });
      console.log('[Gun] User registered:', newUser.id);
    }
  };

  const onLogout = () => {
    if (currentUser && gun) {
      gun.get(ROOT_KEY).get('participants').get(currentUser.id).put(null);
    }
    localStorage.removeItem(STORAGE_KEYS.USER);
    setCurrentUser(null);
    setView(AppView.LANDING);
  };

  const onVote = (vote: string) => {
    if (!currentUser || currentUser.role === 'observer' || revealed || !gun) return;
    const voteValue = currentUser.currentVote === vote ? null : vote;
    const updatedUser = { ...currentUser, currentVote: voteValue };
    setCurrentUser(updatedUser);
    gun.get(ROOT_KEY).get('participants').get(currentUser.id).put({
      ...updatedUser,
      lastSeen: Date.now()
    });
  };

  const onReveal = () => {
    if (gun) {
      console.log('[Gun] Triggering reveal now');
      const room = gun.get(ROOT_KEY);
      // Используем простое значение для лучшей совместимости
      room.get('revealed_state').put(true);
      // Также обновляем локально для мгновенной реакции
      setRevealed(true);
    }
  };

  const onReset = () => {
    if (!gun) return;
    const room = gun.get(ROOT_KEY);

    // Сбрасываем голоса всем активным участникам в БД
    Object.keys(participantsRef.current).forEach(id => {
      room.get('participants').get(id).get('currentVote').put(null);
    });

    room.get('revealed_state').put(false);
    console.log('[Gun] Triggered reset: revealed=false');
    // Также обновляем локально для мгновенной реакции
    setRevealed(false);
    setAiInsight(null);
    if (currentUser) {
      setCurrentUser(prev => prev ? ({ ...prev, currentVote: null }) : null);
    }
  };

  const onUpdateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!gun) return;
    const formData = new FormData(e.currentTarget);
    const title = (formData.get('title') as string) || 'New Task';
    const description = (formData.get('description') as string) || '';
    const newTask: Task = { id: Date.now().toString(), title, description };

    onReset();
    gun.get(ROOT_KEY).get('task_state').put({ payload: JSON.stringify(newTask), ts: Date.now() });
    e.currentTarget.reset();
  };

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    const votes = Object.values(participants)
      .map(p => p.currentVote)
      .filter((v): v is string => v !== null);

    const insight = await getEstimationInsight(currentTask.title, currentTask.description, votes);
    setAiInsight(insight);
    setIsAnalyzing(false);
  };

  const participantArray = useMemo(() => Object.values(participants), [participants]);
  const voteList = useMemo(() => participantArray.map(p => p.currentVote).filter(v => v !== null) as string[], [participantArray]);
  const average = useMemo(() => {
    const nums = voteList.filter(v => !isNaN(Number(v))).map(Number);
    return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '0';
  }, [voteList]);

  if (view === AppView.LANDING) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-xl border border-slate-100">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white mb-6 animate-bounce">
              <Trophy size={32} />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">AgileVibe</h1>
            <p className="mt-2 text-slate-500">Instant Real-time Planning</p>
          </div>

          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
               <button onClick={() => setSelectedRole('voter')} className={`flex flex-col items-center gap-1 py-3 rounded-lg transition-all ${selectedRole === 'voter' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-500'}`}><UserCheck size={18} />Voter</button>
               <button onClick={() => setSelectedRole('admin')} className={`flex flex-col items-center gap-1 py-3 rounded-lg transition-all ${selectedRole === 'admin' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-500'}`}><ShieldCheck size={18} />Admin</button>
               <button onClick={() => setSelectedRole('observer')} className={`flex flex-col items-center gap-1 py-3 rounded-lg transition-all ${selectedRole === 'observer' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-500'}`}><Eye size={18} />Observer</button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); onJoin(new FormData(e.currentTarget).get('name') as string); }} className="space-y-6">
              <input name="name" type="text" required maxLength={15} className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Your name" />
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg transform hover:scale-[1.02]">
                Join Now
              </button>
            </form>
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
            <span className="text-xl font-bold text-slate-900">AgileVibe</span>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 animate-pulse'}`}>
              {isOnline ? <Wifi size={12}/> : <WifiOff size={12}/>}
              {isOnline ? 'Network: Active' : 'Offline'}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-slate-900">{currentUser?.name}</p>
              <p className="text-[10px] font-bold text-indigo-500 uppercase">{currentUser?.role}</p>
            </div>
            <button onClick={onLogout} className="text-slate-400 hover:text-red-500 p-2"><LogOut size={20}/></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="mb-4">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 uppercase mb-2 inline-block">Task info</span>
                <h2 className="text-2xl font-bold text-slate-900">{currentTask.title}</h2>
              </div>
              <p className="text-slate-600 mb-6">{currentTask.description}</p>

              {currentUser?.role === 'admin' && (
                <div className="border-t pt-6">
                  <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-indigo-600"><Edit3 size={16}/> New Round</h3>
                  <form onSubmit={onUpdateTask} className="grid gap-3">
                    <input name="title" required placeholder="Title" className="w-full px-4 py-2 border rounded-xl" />
                    <textarea name="description" placeholder="Requirements..." className="w-full px-4 py-2 border rounded-xl h-20" />
                    <button type="submit" className="bg-indigo-600 text-white py-2 px-6 rounded-xl font-bold hover:bg-indigo-700 transition-all">Update for Everyone</button>
                  </form>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800">Choose your card</h3>
              <div className="flex flex-wrap gap-3">
                {DEFAULT_DECK.map(val => (
                  <PokerCard
                    key={val}
                    value={val}
                    selected={currentUser?.currentVote === val}
                    onSelect={onVote}
                    disabled={revealed || currentUser?.role === 'observer'}
                  />
                ))}
              </div>
            </div>

            {revealed && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="bg-white rounded-2xl shadow-lg p-8 border-l-4 border-indigo-500">
                  <div className="flex items-center gap-12">
                    <div className="text-center">
                      <p className="text-xs font-bold text-slate-400 uppercase">Avg</p>
                      <p className="text-6xl font-black text-indigo-600">{average}</p>
                    </div>
                    <div className="flex-1">
                      <EstimationChart votes={voteList} />
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 font-bold text-indigo-900"><BrainCircuit/> AI Coach</div>
                    <button onClick={handleAiAnalysis} disabled={isAnalyzing} className="bg-white px-3 py-1 rounded-lg text-xs font-bold text-indigo-600 shadow-sm disabled:opacity-50">
                      {isAnalyzing ? 'Analyzing...' : 'Get Insights'}
                    </button>
                  </div>
                  <p className="text-sm text-indigo-800 italic">{aiInsight || 'Press to analyze voting patterns.'}</p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-6">Game Control</h3>
              <div className="grid gap-3">
                <button onClick={onReveal} disabled={revealed || voteList.length === 0} className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 disabled:opacity-20 disabled:grayscale">
                  <Eye size={20}/> Reveal All
                </button>
                <button onClick={onReset} className="w-full flex items-center justify-center gap-2 py-4 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700">
                  <RefreshCcw size={20}/> New Round
                </button>
              </div>
            </div>

            <ParticipantList
              participants={participantArray}
              revealed={revealed}
              currentUserId={currentUser?.id || ''}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
