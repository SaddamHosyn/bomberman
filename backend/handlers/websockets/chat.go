package websockets

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"bomber/backend/handlers/utils"
	"bomber/backend/models"
)

// Global chat history storage
var (
	globalChatHistory []models.ChatMessage
	chatMutex         sync.RWMutex
)

// handleChatMessage processes chat messages
func handleChatMessage(client *models.Client, message *models.WebSocketMessage, manager *WebSocketManager) {
	var chatRequest models.ChatMessageRequest
	DataBytes, _ := json.Marshal(message.Data)
	if err := json.Unmarshal(DataBytes, &chatRequest); err != nil {
		utils.SendError(client, "Invalid chat message")
		return
	}

	// Validate chat message
	if !validateChatMessage(chatRequest.Message) {
		utils.SendError(client, "Invalid chat message content")
		return
	}

	// Create chat message
	chatMessage := models.ChatMessage{
		ID:        utils.GenerateMessageID(),
		PlayerID:  client.ID,
		Nickname:  client.Nickname,
		Message:   chatRequest.Message,
		Timestamp: time.Now(),
		Type:      "chat",
	}

	// Add to global chat history and broadcast
	addChatMessageToGlobal(manager, chatMessage)

	log.Printf("Chat message from %s: %s", client.Nickname, chatRequest.Message)
}

// addChatMessageToGlobal adds a chat message to global history and broadcasts it
func addChatMessageToGlobal(manager *WebSocketManager, chatMessage models.ChatMessage) {
	chatMutex.Lock()
	globalChatHistory = append(globalChatHistory, chatMessage)
	// Keep only last 100 messages to prevent memory issues
	if len(globalChatHistory) > 100 {
		globalChatHistory = globalChatHistory[len(globalChatHistory)-100:]
	}
	chatMutex.Unlock()

	// Create broadcast message
	broadcastData := models.WebSocketMessage{
		Type: "chat_message",
		Data: map[string]interface{}{
			"message": chatMessage,
		},
	}

	// Broadcast to all clients
	manager.Hub.Broadcast <- &broadcastData
}

// addSystemMessageToGlobal adds a system message to global chat and broadcasts it
func addSystemMessageToGlobal(manager *WebSocketManager, message string) {
	systemMessage := utils.CreateSystemMessage(message)
	addChatMessageToGlobal(manager, systemMessage)
}

// addJoinMessageToGlobal adds a join message to global chat
func addJoinMessageToGlobal(manager *WebSocketManager, nickname string) {
	joinMessage := utils.CreateJoinMessage(nickname)
	addChatMessageToGlobal(manager, joinMessage)
}

// addLeaveMessageToGlobal adds a leave message to global chat
func addLeaveMessageToGlobal(manager *WebSocketManager, nickname string) {
	leaveMessage := utils.CreateLeaveMessage(nickname)
	addChatMessageToGlobal(manager, leaveMessage)
}

// getChatHistory returns the global chat history
func getChatHistory() []models.ChatMessage {
	chatMutex.RLock()
	defer chatMutex.RUnlock()

	// Return a copy of the history
	history := make([]models.ChatMessage, len(globalChatHistory))
	copy(history, globalChatHistory)
	return history
}

// sendChatHistory sends the chat history to a specific client
func sendChatHistory(client *models.Client, manager *WebSocketManager) {
	history := getChatHistory()

	message := models.WebSocketMessage{
		Type: "chat_history",
		Data: map[string]interface{}{
			"history": history,
		},
	}

	utils.SendMessage(client, &message)
}

// validateChatMessage validates a chat message before processing
func validateChatMessage(message string) bool {
	// Check if message is empty
	if len(message) == 0 {
		return false
	}

	// Check message length (max 500 characters)
	if len(message) > 500 {
		return false
	}

	// Add more validation rules as needed
	// For example: profanity filter, spam detection, etc.

	return true
}

// handleChatHistory processes chat history requests
func handleChatHistory(client *models.Client, message *models.WebSocketMessage, manager *WebSocketManager) {
	sendChatHistory(client, manager)
}
