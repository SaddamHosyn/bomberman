package models

const (
	// Lobby related messages
	MSG_JOIN_LOBBY = "join_lobby"

	MSG_LOBBY_UPDATE  = "lobby_update"
	MSG_PLAYER_JOINED = "player_joined"
	MSG_PLAYER_LEFT   = "player_left"
	MSG_LOBBY_STATUS  = "lobby_status"

	// Chat related messages
	MSG_CHAT_MESSAGE = "chat_message"

	// Game related messages
	MSG_GAME_START        = "game_start"
	MSG_GAME_STATE_UPDATE = "game_state_update" // Renamed from MSG_GAME_UPDATE
	MSG_GAME_END          = "game_end"

	MSG_PLAYER_MOVE = "player_move"
	MSG_PLACE_BOMB  = "place_bomb"

	// System messages
	MSG_ERROR   = "error"
	MSG_SUCCESS = "success"
	MSG_PING    = "ping"
	MSG_PONG    = "pong"
)
