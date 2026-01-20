
export const DEFAULT_DECK = Array.from({ length: 20 }, (_, i) => String(i + 1));

export const STORAGE_KEYS = {
  USER: 'agilevibe_user',
  SESSION: 'agilevibe_session_id'
};

export const BROADCAST_CHANNEL_NAME = 'agile_poker_sync';
