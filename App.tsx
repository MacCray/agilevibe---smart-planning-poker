
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  AppView, 
  User, 
  PokerSession, 
  SyncMessage, 
  MessageType 
} from './types';
import { DEFAULT_DECK, BROADCAST_CHANNEL_NAME } from './constants';
import PokerCard from './components/PokerCard';
import ParticipantList from './components/ParticipantList';
import EstimationChart from './components/EstimationChart';
import { getEstimationInsight } from './services/geminiService';
import { 
  Users, 
  Send, 
  RefreshCcw, 
  Eye, 
  Sparkles,
  Trophy,
  Edit3,
  UserCheck,
  ShieldCheck,
  EyeOff,
  Plus,
  Trash2,
  Settings2
} from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [view, setView] = useState<AppView>(AppView.LANDING);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<'voter' | 'admin' | 'observer'>('voter');
  const [session, setSession] = useState<PokerSession>({
    id: 'default-room',
    name: 'Team Planning',
    currentTask: { id: '1', title: '', description: '' },
    revealed: false,
    participants: [],
    deck: DEFAULT_DECK
  });
  const [newCardValue, setNewCardValue] = useState('');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const sessionRef = useRef(session);
  const currentUserRef = useRef(currentUser);
  
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const channel = useMemo(() => new BroadcastChannel(BROADCAST_CHANNEL_NAME), []);

  const handleMessage = useCallback((msg: SyncMessage) => {
    switch (msg.type) {
      case 'SYNC_REQ':
        if (sessionRef.current.participants.length > 0) {
          channel.postMessage({ 
            type: 'SYNC', 
            payload: sessionRef.current, 
            senderId: 'system' 
          });
        }
        break;
      case 'SYNC':
        setSession(prev => {
          const incomingSession = msg.payload as PokerSession;
          const me = currentUserRef.current;
          if (!me) return prev;
          
          let mergedParticipants = [...incomingSession.participants];
          const existingMeIndex = mergedParticipants.findIndex(p => p.id === me.id);
          
          if (existingMeIndex === -1) {
            mergedParticipants.push(me);
          } else {
            mergedParticipants[existingMeIndex] = me;
          }
          
          return {
            ...incomingSession,
            participants: mergedParticipants
          };
        });
        break;
      case 'JOIN':
        setSession(prev => {
          const exists = prev.participants.find(p => p.id === msg.payload.id);
          if (exists) {
            return {
              ...prev,
              participants: prev.participants.map(p => p.id === msg.payload.id ? msg.payload : p)
            };
          }
          return { ...prev, participants: [...prev.participants, msg.payload] };
        });
        break;
      case 'VOTE':
        setSession(prev => ({
          ...prev,
          participants: prev.participants.map(p => 
            p.id === msg.payload.userId ? { ...p, currentVote: msg.payload.vote } : p
          )
        }));
        break;
      case 'REVEAL':
        setSession(prev => ({ ...prev, revealed: true }));
        break;
      case 'RESET':
        setSession(prev => ({
          ...prev,
          revealed: false,
          participants: prev.participants.map(p => ({ ...p, currentVote: null }))
        }));
        break;
      case 'UPDATE_TASK':
        setSession(prev => ({
          ...prev,
          currentTask: msg.payload,
          revealed: false,
          participants: prev.participants.map(p => ({ ...p, currentVote: null }))
        }));
        break;
      case 'UPDATE_DECK':
        setSession(prev => ({ ...prev, deck: msg.payload }));
        break;
    }
  }, [channel]);

  useEffect(() => {
    channel.onmessage = (event) => handleMessage(event.data);
    return () => channel.close();
  }, [channel, handleMessage]);

  const sendMessage = useCallback((type: MessageType, payload: any) => {
    const user = currentUserRef.current;
    if (!user) return;
    const msg: SyncMessage = { type, payload, senderId: user.id };
    channel.postMessage(msg);
    handleMessage(msg);
  }, [channel, handleMessage]);

  const onJoin = (name: string) => {
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      role: selectedRole,
      currentVote: null
    };
    
    setCurrentUser(newUser);
    currentUserRef.current = newUser;
    
    setSession(prev => ({
      ...prev,
      participants: [...prev.participants, newUser]
    }));
    
    setView(AppView.SESSION);
    
    channel.postMessage({ type: 'JOIN', payload: newUser, senderId: newUser.id });
    channel.postMessage({ type: 'SYNC_REQ', payload: null, senderId: newUser.id });
  };

  const onVote = (vote: string) => {
    if (!currentUser || currentUser.role === 'observer') return;
    sendMessage('VOTE', { userId: currentUser.id, vote });
  };

  const onReveal = () => sendMessage('REVEAL', null);
  const onReset = () => {
    setAiInsight(null);
    sendMessage('RESET', null);
  };

  const onUpdateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = (formData.get('title') as string) || '';
    const description = (formData.get('description') as string) || '';
    setAiInsight(null);
    sendMessage('UPDATE_TASK', { id: Date.now().toString(), title, description });
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
    sendMessage('UPDATE_DECK', newDeck);
    setNewCardValue('');
  };

  const onRemoveCard = (val: string) => {
    const newDeck = session.deck.filter(c => c !== val);
    sendMessage('UPDATE_DECK', newDeck);
  };

  const toggleRole = () => {
    if (!currentUser) return;
    let nextRole: 'admin' | 'voter' | 'observer';
    if (currentUser.role === 'voter') nextRole = 'admin';
    else if (currentUser.role === 'admin') nextRole = 'observer';
    else nextRole = 'voter';

    const updatedUser = { ...currentUser, role: nextRole };
    setCurrentUser(updatedUser);
    currentUserRef.current = updatedUser;
    
    sendMessage('JOIN', updatedUser); 
  };

  const handleGetAiInsight = async () => {
    if (!session.currentTask || isAiLoading) return;
    const votes = session.participants.map(p => p.currentVote).filter(v => !!v) as string[];
    if (votes.length === 0) return;
    setIsAiLoading(true);
    const insight = await getEstimationInsight(session.currentTask.title, session.currentTask.description, votes);
    setAiInsight(insight);
    setIsAiLoading(false);
  };

  const voteList = useMemo(() => session.participants.map(p => p.currentVote).filter(v => v !== null) as string[], [session.participants]);
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
            <p className="mt-2 text-slate-500">Professional planning for custom decks.</p>
          </div>
          
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
               <button 
                onClick={() => setSelectedRole('voter')}
                className={`flex flex-col items-center gap-1 py-3 px-1 rounded-lg transition-all ${selectedRole === 'voter' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 <UserCheck size={18} />
                 <span className="text-[10px] font-bold uppercase tracking-tight">Voter</span>
               </button>
               <button 
                onClick={() => setSelectedRole('admin')}
                className={`flex flex-col items-center gap-1 py-3 px-1 rounded-lg transition-all ${selectedRole === 'admin' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 <ShieldCheck size={18} />
                 <span className="text-[10px] font-bold uppercase tracking-tight">Facilitator</span>
               </button>
               <button 
                onClick={() => setSelectedRole('observer')}
                className={`flex flex-col items-center gap-1 py-3 px-1 rounded-lg transition-all ${selectedRole === 'observer' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 <Eye size={18} />
                 <span className="text-[10px] font-bold uppercase tracking-tight">Observer</span>
               </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); onJoin(new FormData(e.currentTarget).get('name') as string); }} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Display Name</label>
                <input id="name" name="name" type="text" required className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400" placeholder="Enter your name..." />
              </div>
              <button type="submit" className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-[1.02]">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
              <span className="text-xl font-bold text-slate-900">AgileVibe</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-semibold text-slate-900">{currentUser?.name}</span>
                <span className="text-xs text-indigo-600 font-medium capitalize">{currentUser?.role}</span>
              </div>
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold border-2 border-white shadow-sm">
                {currentUser?.name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mb-2">
                      Active Task
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900">
                      {session.currentTask?.title || 'Waiting for task...'}
                    </h2>
                  </div>
                </div>
                <p className="text-slate-700 text-lg leading-relaxed mb-6 whitespace-pre-wrap">
                  {session.currentTask?.description || 'The facilitator has not set a task yet.'}
                </p>

                {currentUser?.role === 'admin' && (
                   <div className="border-t border-slate-100 pt-6">
                     <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                       <Edit3 size={16} /> Facilitator Controls
                     </h3>
                     <form onSubmit={onUpdateTask} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                          <input 
                            name="title" 
                            required 
                            defaultValue={session.currentTask?.title}
                            placeholder="Task Title (e.g. CORE-101)" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 transition-all" 
                          />
                          <textarea 
                            name="description" 
                            defaultValue={session.currentTask?.description}
                            placeholder="Task description and requirements..." 
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all" 
                          />
                        </div>
                        <button type="submit" className="flex items-center justify-center gap-2 w-full sm:w-auto py-3 px-6 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                          <Send size={14} /> Update for All
                        </button>
                     </form>
                   </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Users size={20} className="text-slate-400" />
                  {currentUser?.role === 'observer' ? 'Viewing estimates' : 'Select your estimate'}
                </h3>
              </div>
              
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
              {currentUser?.role === 'observer' && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2 text-amber-700 text-xs font-medium">
                  <EyeOff size={14} /> You are in Observer mode and cannot vote.
                </div>
              )}
            </div>

            {session.revealed && (
              <div className="bg-white rounded-2xl shadow-md border-l-4 border-indigo-500 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="text-center">
                    <p className="text-sm text-slate-500 font-medium mb-1">Average Estimate</p>
                    <p className="text-5xl font-extrabold text-indigo-600">{average}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-slate-500 font-medium mb-4">Vote Distribution</p>
                    <EstimationChart votes={voteList} />
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100">
                   <div className="flex items-center justify-between mb-4">
                     <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                       <Sparkles size={16} className="text-amber-500" />
                       AI Coach Insights
                     </h4>
                     {!aiInsight && !isAiLoading && (
                       <button onClick={handleGetAiInsight} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                         Analyze Consensus
                       </button>
                     )}
                   </div>
                   {isAiLoading ? (
                     <div className="flex items-center gap-3 text-slate-400 text-sm animate-pulse">
                        <RefreshCcw size={14} className="animate-spin" />
                        Generating coaching tips...
                     </div>
                   ) : aiInsight ? (
                     <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                       "{aiInsight}"
                     </p>
                   ) : (
                     <p className="text-xs text-slate-400">Click analyze to get AI-powered feedback.</p>
                   )}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200">
              <h3 className="text-sm font-bold uppercase tracking-widest opacity-60 mb-6">Session Actions</h3>
              <div className="space-y-3">
                <button 
                  onClick={onReveal}
                  disabled={session.revealed || voteList.length === 0 || currentUser?.role === 'observer'}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white text-indigo-900 rounded-xl font-bold shadow-sm hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Eye size={18} /> Reveal Estimates
                </button>
                <button 
                  onClick={onReset}
                  disabled={currentUser?.role === 'observer'}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-indigo-800/50 text-white rounded-xl font-bold hover:bg-indigo-800 disabled:opacity-50 transition-all border border-indigo-700/50"
                >
                  <RefreshCcw size={18} /> New Round
                </button>
              </div>

              {currentUser?.role === 'admin' && (
                <div className="mt-6 pt-6 border-t border-indigo-800/50 space-y-4">
                  <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <Settings2 size={12} /> Manage Deck
                  </h4>
                  <form onSubmit={onAddCard} className="flex gap-2">
                    <input 
                      type="text" 
                      value={newCardValue}
                      onChange={(e) => setNewCardValue(e.target.value)}
                      placeholder="Card value..." 
                      className="flex-1 bg-indigo-950/50 border border-indigo-700 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                    <button type="submit" className="bg-indigo-600 p-2 rounded-lg hover:bg-indigo-500">
                      <Plus size={16} />
                    </button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    {session.deck.map(val => (
                      <div key={val} className="group relative">
                        <div className="bg-indigo-950/50 border border-indigo-700 rounded px-2 py-1 text-[10px] font-bold">
                          {val}
                        </div>
                        <button 
                          onClick={() => onRemoveCard(val)}
                          className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={8} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-indigo-800/50">
                 <button 
                  onClick={toggleRole}
                  className="w-full text-[10px] font-bold text-indigo-300 hover:text-white transition-colors flex items-center justify-center gap-2 uppercase tracking-wider"
                 >
                   <RefreshCcw size={12}/> Cycle Role: {currentUser?.role}
                 </button>
              </div>
            </div>
            <ParticipantList participants={session.participants} revealed={session.revealed} currentUserId={currentUser?.id || ''} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
