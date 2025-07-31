package models

const (
	// Lobby related messages
	MSG_JOIN_LOBBY = "join_lobby"

	MSG_LOBBY_UPDATE  = "lobby_update"
	MSG_PLAYER_JOINED = "player_joined"
	MSG_PLAYER_LEFT   = "player_left"
	MSG_LOBBY_STATUS  = "lobby_status"
	MSG_TIMER_UPDATE  = "timer_update"

	// Chat related messages
	MSG_CHAT_MESSAGE = "chat_message"
	MSG_CHAT_HISTORY = "chat_history"

	// Game related messages
	MSG_GAME_START  = "game_start"
	MSG_GAME_UPDATE = "game_update"
	MSG_GAME_END    = "game_end"

	// System messages
	MSG_ERROR   = "error"
	MSG_SUCCESS = "success"
	MSG_PING    = "ping"
	MSG_PONG    = "pong"
)
