package utils

import (
	"bomberman-dom/backend/models"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

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
