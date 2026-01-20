
export enum AppView {
  LANDING = 'LANDING',
  SESSION = 'SESSION'
}

export type Team = 'Java' | 'React' | 'QA';
export type ActiveTeam = Team | 'All';

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'voter';
  team: Team | null; // admin has no team
  currentVote: string | null;
  joinedAt: number; // millis since epoch; used for stable ordering
}

export interface Task {
  id: string;
  title: string;
  description: string;
}

export interface PokerSession {
  id: string;
  name: string;
  currentTask: Task | null;
  revealed: boolean;
  participants: User[];
  deck: string[];
}

export type MessageType = 
  | 'JOIN' 
  | 'VOTE' 
  | 'REVEAL' 
  | 'RESET' 
  | 'UPDATE_TASK'
  | 'UPDATE_DECK'
  | 'SYNC'
  | 'SYNC_REQ'
  | 'LEAVE';

export interface SyncMessage {
  type: MessageType;
  payload: any;
  senderId: string;
}
