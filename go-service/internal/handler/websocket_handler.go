package handler

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	
	wsHub "trading-assistant/go-service/internal/websocket"
)

type WebSocketHandler struct {
	hub      *wsHub.Hub
	upgrader websocket.Upgrader
}

func NewWebSocketHandler(hub *wsHub.Hub) *WebSocketHandler {
	return &WebSocketHandler{
		hub: hub,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				// 在生产环境中应该检查Origin
				return true
			},
		},
	}
}

// HandleWebSocket 处理WebSocket连接
func (h *WebSocketHandler) HandleWebSocket(c *gin.Context) {
	// 获取用户信息
	userID := c.GetString("user_id")
	username := c.GetString("username")
	
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Authentication required for WebSocket connection",
		})
		return
	}
	
	// 升级HTTP连接为WebSocket
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade WebSocket connection: %v", err)
		return
	}
	
	// 创建客户端
	client := wsHub.NewClient(h.hub, conn, userID, username)
	
	// 启动客户端
	client.Start()
	
	log.Printf("WebSocket connection established for user %s (%s)", username, userID)
}

// BroadcastMessage 广播消息（用于其他服务调用）
func (h *WebSocketHandler) BroadcastMessage(messageType string, data interface{}) {
	message := wsHub.Message{
		Type:      messageType,
		Data:      data,
		Timestamp: 0, // 会在BroadcastMessage中设置
	}
	
	h.hub.BroadcastMessage(message)
}

// BroadcastToRoom 向房间广播消息
func (h *WebSocketHandler) BroadcastToRoom(room, messageType string, data interface{}) {
	message := wsHub.Message{
		Type:      messageType,
		Room:      room,
		Data:      data,
		Timestamp: 0, // 会在BroadcastToRoom中设置
	}
	
	h.hub.BroadcastToRoom(room, message)
}

// BroadcastToUser 向特定用户发送消息
func (h *WebSocketHandler) BroadcastToUser(userID, messageType string, data interface{}) {
	message := wsHub.Message{
		Type:      messageType,
		Data:      data,
		UserID:    userID,
		Timestamp: 0, // 会在BroadcastToUser中设置
	}
	
	h.hub.BroadcastToUser(userID, message)
}

// GetConnectedUsers 获取在线用户
func (h *WebSocketHandler) GetConnectedUsers(c *gin.Context) {
	users := h.hub.GetConnectedUsers()
	
	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       gin.H{"users": users, "count": len(users)},
		"timestamp":  0, // 会被中间件设置
		"request_id": c.GetString("request_id"),
	})
}

// GetRoomUsers 获取房间用户
func (h *WebSocketHandler) GetRoomUsers(c *gin.Context) {
	room := c.Param("room")
	if room == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_ROOM",
				"message": "Room parameter is required",
			},
			"timestamp":  0,
			"request_id": c.GetString("request_id"),
		})
		return
	}
	
	users := h.hub.GetRoomUsers(room)
	
	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       gin.H{"room": room, "users": users, "count": len(users)},
		"timestamp":  0,
		"request_id": c.GetString("request_id"),
	})
}