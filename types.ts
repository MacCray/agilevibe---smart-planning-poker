
export enum AppView {
  LANDING = 'LANDING',
  SESSION = 'SESSION'
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'voter' | 'observer';
  currentVote: string | null;
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
