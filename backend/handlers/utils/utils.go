package utils

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"bomber/backend/models"
)

// GenerateClientID creates a unique client identifier
func GenerateClientID() string {
	bytes := make([]byte, 8)
	rand.Read(bytes)
	return "client_" + hex.EncodeToString(bytes)
}

// GenerateMessageID creates a unique message identifier
func GenerateMessageID() string {
	bytes := make([]byte, 4)
	rand.Read(bytes)
	return "msg_" + hex.EncodeToString(bytes)
}

// CreateJoinMessage creates a join message for global chat
func CreateJoinMessage(nickname string) models.ChatMessage {
	return CreateSystemMessage(fmt.Sprintf("%s joined the chat", nickname))
}

// CreateLeaveMessage creates a leave message for global chat
func CreateLeaveMessage(nickname string) models.ChatMessage {
	return CreateSystemMessage(fmt.Sprintf("%s left the chat", nickname))
}

// GenerateGameMap creates a basic game map for Bomberman
func GenerateGameMap() [][]int {
	// Simple 13x11 map (standard Bomberman size)
	gameMap := make([][]int, 11)
	for i := range gameMap {
		gameMap[i] = make([]int, 13)
	}

	// Fill with basic pattern (walls, destructible blocks, empty spaces)
	// 0 = empty, 1 = wall, 2 = destructible block
	for row := 0; row < 11; row++ {
		for col := 0; col < 13; col++ {
			if row%2 == 1 && col%2 == 1 {
				gameMap[row][col] = 1 // Permanent walls
			} else if (row == 0 || row == 1 || row == 9 || row == 10) && (col == 0 || col == 1 || col == 11 || col == 12) {
				gameMap[row][col] = 0 // Player spawn areas
			} else {
				gameMap[row][col] = 2 // Destructible blocks
			}
		}
	}

	return gameMap
}

// SendMessage sends a message to a specific client
func SendMessage(client *models.Client, message *models.WebSocketMessage) {
	if !client.IsActive {
		return
	}

	data := MarshalMessage(message)
	if data != nil {
		select {
		case client.Send <- data:
		default:
			// Channel is blocked, client probably disconnected
			close(client.Send)
			client.IsActive = false
		}
	}
}

// SendError sends an error message to a client
func SendError(client *models.Client, errorMsg string) {
	errorMessage := &models.WebSocketMessage{
		Type: "error",
		Payload: map[string]interface{}{
			"message":   errorMsg,
			"timestamp": time.Now(),
		},
	}
	SendMessage(client, errorMessage)
}

// MarshalMessage converts a WebSocketMessage to JSON bytes
func MarshalMessage(message *models.WebSocketMessage) []byte {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return nil
	}
	return data
}

// ValidateNickname checks if a nickname is valid
func ValidateNickname(nickname string) bool {
	nickname = strings.TrimSpace(nickname)
	return len(nickname) >= 2 && len(nickname) <= 20
}

// CreateSystemMessage creates a system message for global chat
func CreateSystemMessage(content string) models.ChatMessage {
	return models.ChatMessage{
		ID:        GenerateMessageID(),
		PlayerID:  "system",
		Nickname:  "System",
		Message:   content,
		Timestamp: time.Now(),
		Type:      "system",
	}
}

// LogClientAction logs client-related actions
func LogClientAction(clientID, action, details string) {
	log.Printf("[CLIENT:%s] %s - %s", clientID, action, details)
}
