package websocket

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	rooms      map[string]map[*Client]bool
	mutex      sync.RWMutex
}

type Client struct {
	hub      *Hub
	conn     *websocket.Conn
	send     chan []byte
	userID   string
	username string
	rooms    map[string]bool
	mutex    sync.RWMutex
}

type Message struct {
	Type      string      `json:"type"`
	Room      string      `json:"room,omitempty"`
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp"`
	UserID    string      `json:"user_id,omitempty"`
}

const (
	// 心跳间隔
	pingPeriod = 54 * time.Second
	// 读取超时
	pongWait = 60 * time.Second
	// 写入超时
	writeWait = 10 * time.Second
	// 最大消息大小
	maxMessageSize = 512
)

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		rooms:      make(map[string]map[*Client]bool),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			h.mutex.Unlock()
			log.Printf("Client %s (%s) connected", client.username, client.userID)
			
			// 发送欢迎消息
			welcome := Message{
				Type:      "welcome",
				Data:      map[string]string{"message": "Connected successfully"},
				Timestamp: time.Now().Unix(),
			}
			client.SendMessage(welcome)
			
		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				
				// 从所有房间中移除客户端
				for room := range client.rooms {
					if clients, exists := h.rooms[room]; exists {
						delete(clients, client)
						if len(clients) == 0 {
							delete(h.rooms, room)
						}
					}
				}
				
				log.Printf("Client %s (%s) disconnected", client.username, client.userID)
			}
			h.mutex.Unlock()
			
		case message := <-h.broadcast:
			h.mutex.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mutex.RUnlock()
		}
	}
}

// BroadcastMessage 广播消息到所有客户端
func (h *Hub) BroadcastMessage(message Message) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}
	
	h.broadcast <- data
}

// BroadcastToRoom 发送消息到特定房间
func (h *Hub) BroadcastToRoom(room string, message Message) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}
	
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	
	if clients, exists := h.rooms[room]; exists {
		for client := range clients {
			select {
			case client.send <- data:
			default:
				close(client.send)
				delete(h.clients, client)
				delete(clients, client)
			}
		}
	}
}

// BroadcastToUser 发送消息给特定用户
func (h *Hub) BroadcastToUser(userID string, message Message) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}
	
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	
	for client := range h.clients {
		if client.userID == userID {
			select {
			case client.send <- data:
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
}

// GetConnectedUsers 获取在线用户列表
func (h *Hub) GetConnectedUsers() []string {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	
	users := make(map[string]bool)
	for client := range h.clients {
		users[client.userID] = true
	}
	
	userList := make([]string, 0, len(users))
	for userID := range users {
		userList = append(userList, userID)
	}
	
	return userList
}

// GetRoomUsers 获取房间内用户列表
func (h *Hub) GetRoomUsers(room string) []string {
	h.mutex.RLock()
	defer h.mutex.RUnlock()
	
	users := make(map[string]bool)
	if clients, exists := h.rooms[room]; exists {
		for client := range clients {
			users[client.userID] = true
		}
	}
	
	userList := make([]string, 0, len(users))
	for userID := range users {
		userList = append(userList, userID)
	}
	
	return userList
}

// NewClient 创建新客户端
func NewClient(hub *Hub, conn *websocket.Conn, userID, username string) *Client {
	return &Client{
		hub:      hub,
		conn:     conn,
		send:     make(chan []byte, 256),
		userID:   userID,
		username: username,
		rooms:    make(map[string]bool),
	}
}

// 客户端读取消息
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
		
		// 处理接收到的消息
		c.handleMessage(message)
	}
}

// 客户端写入消息
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
			
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// 处理消息
func (c *Client) handleMessage(data []byte) {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("Error unmarshaling message: %v", err)
		return
	}
	
	switch msg.Type {
	case "join_room":
		if room, ok := msg.Data.(string); ok {
			c.JoinRoom(room)
		}
	case "leave_room":
		if room, ok := msg.Data.(string); ok {
			c.LeaveRoom(room)
		}
	case "subscribe_stock":
		if stockSymbol, ok := msg.Data.(string); ok {
			c.JoinRoom("stock:" + stockSymbol)
		}
	case "unsubscribe_stock":
		if stockSymbol, ok := msg.Data.(string); ok {
			c.LeaveRoom("stock:" + stockSymbol)
		}
	case "subscribe_alerts":
		c.JoinRoom("alerts:" + c.userID)
	case "unsubscribe_alerts":
		c.LeaveRoom("alerts:" + c.userID)
	case "ping":
		// 响应ping消息
		pong := Message{
			Type:      "pong",
			Timestamp: time.Now().Unix(),
		}
		c.SendMessage(pong)
	}
}

// JoinRoom 加入房间
func (c *Client) JoinRoom(room string) {
	c.mutex.Lock()
	c.rooms[room] = true
	c.mutex.Unlock()
	
	c.hub.mutex.Lock()
	if c.hub.rooms[room] == nil {
		c.hub.rooms[room] = make(map[*Client]bool)
	}
	c.hub.rooms[room][c] = true
	c.hub.mutex.Unlock()
	
	log.Printf("Client %s joined room %s", c.userID, room)
	
	// 发送加入成功消息
	response := Message{
		Type:      "room_joined",
		Room:      room,
		Data:      map[string]string{"room": room},
		Timestamp: time.Now().Unix(),
	}
	c.SendMessage(response)
}

// LeaveRoom 离开房间
func (c *Client) LeaveRoom(room string) {
	c.mutex.Lock()
	delete(c.rooms, room)
	c.mutex.Unlock()
	
	c.hub.mutex.Lock()
	if clients, exists := c.hub.rooms[room]; exists {
		delete(clients, c)
		if len(clients) == 0 {
			delete(c.hub.rooms, room)
		}
	}
	c.hub.mutex.Unlock()
	
	log.Printf("Client %s left room %s", c.userID, room)
	
	// 发送离开成功消息
	response := Message{
		Type:      "room_left",
		Room:      room,
		Data:      map[string]string{"room": room},
		Timestamp: time.Now().Unix(),
	}
	c.SendMessage(response)
}

// SendMessage 发送消息给客户端
func (c *Client) SendMessage(message Message) {
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}
	
	select {
	case c.send <- data:
	default:
		close(c.send)
	}
}

// Start 启动客户端
func (c *Client) Start() {
	go c.writePump()
	go c.readPump()
	
	// 注册客户端
	c.hub.register <- c
}