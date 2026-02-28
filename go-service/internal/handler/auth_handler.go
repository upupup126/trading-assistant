package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	
	"trading-assistant/go-service/internal/service"
)

type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{
		authService: authService,
	}
}

// Login 用户登录
func (h *AuthHandler) Login(c *gin.Context) {
	var req service.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request format",
				"details": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}
	
	response, err := h.authService.Login(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "LOGIN_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       response,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// Register 用户注册
func (h *AuthHandler) Register(c *gin.Context) {
	var req service.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request format",
				"details": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}
	
	response, err := h.authService.Register(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "REGISTRATION_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}
	
	c.JSON(http.StatusCreated, gin.H{
		"success":    true,
		"data":       response,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// RefreshToken 刷新Token
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request format",
				"details": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}
	
	tokens, err := h.authService.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "TOKEN_REFRESH_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       tokens,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// ChangePassword 修改密码
func (h *AuthHandler) ChangePassword(c *gin.Context) {
	var req struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_REQUEST",
				"message": "Invalid request format",
				"details": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}
	
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "USER_NOT_AUTHENTICATED",
				"message": "User not authenticated",
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}
	
	err := h.authService.ChangePassword(c.Request.Context(), userID, req.OldPassword, req.NewPassword)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "PASSWORD_CHANGE_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       gin.H{"message": "Password changed successfully"},
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// Logout 用户登出
func (h *AuthHandler) Logout(c *gin.Context) {
	// TODO: 实现Token黑名单或会话管理
	// 目前只是返回成功响应
	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       gin.H{"message": "Logged out successfully"},
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// GetProfile 获取用户信息
func (h *AuthHandler) GetProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	username := c.GetString("username")
	
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "USER_NOT_AUTHENTICATED",
				"message": "User not authenticated",
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}
	
	// TODO: 从数据库获取完整的用户信息
	profile := gin.H{
		"user_id":  userID,
		"username": username,
		// 可以添加更多用户信息
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       profile,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}