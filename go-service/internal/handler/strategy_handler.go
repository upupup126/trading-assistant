package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"trading-assistant/go-service/internal/service"
)

type StrategyHandler struct {
	strategyService *service.StrategyService
}

func NewStrategyHandler(strategyService *service.StrategyService) *StrategyHandler {
	return &StrategyHandler{
		strategyService: strategyService,
	}
}

func (h *StrategyHandler) getUserID(c *gin.Context) (uuid.UUID, bool) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "USER_NOT_AUTHENTICATED",
				"message": "User not authenticated",
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return uuid.Nil, false
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_USER_ID",
				"message": "Invalid user ID format",
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return uuid.Nil, false
	}

	return userID, true
}

// GetBuiltinStrategies 获取内置策略列表
func (h *StrategyHandler) GetBuiltinStrategies(c *gin.Context) {
	strategies := service.GetBuiltinStrategies()
	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       strategies,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// GetStrategies 获取用户策略列表
func (h *StrategyHandler) GetStrategies(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	strategies, err := h.strategyService.GetStrategies(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "GET_STRATEGIES_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       strategies,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// CreateStrategy 创建策略
func (h *StrategyHandler) CreateStrategy(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	var req service.CreateStrategyRequest
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

	strategy, err := h.strategyService.CreateStrategy(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CREATE_STRATEGY_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success":    true,
		"data":       strategy,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// UpdateStrategy 更新策略
func (h *StrategyHandler) UpdateStrategy(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	strategyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_STRATEGY_ID",
				"message": "Invalid strategy ID format",
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	var req service.UpdateStrategyRequest
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

	strategy, err := h.strategyService.UpdateStrategy(c.Request.Context(), userID, strategyID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "UPDATE_STRATEGY_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       strategy,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// DeleteStrategy 删除策略
func (h *StrategyHandler) DeleteStrategy(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	strategyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_STRATEGY_ID",
				"message": "Invalid strategy ID format",
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	if err := h.strategyService.DeleteStrategy(c.Request.Context(), userID, strategyID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "DELETE_STRATEGY_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       gin.H{"message": "Strategy deleted successfully"},
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// GetAlerts 获取提醒列表
func (h *StrategyHandler) GetAlerts(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	unreadOnly := c.Query("unread_only") == "true"
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit <= 0 || limit > 100 {
		limit = 20
	}

	alerts, total, err := h.strategyService.GetAlerts(c.Request.Context(), userID, unreadOnly, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "GET_ALERTS_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"alerts": alerts,
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// MarkAlertRead 标记提醒已读
func (h *StrategyHandler) MarkAlertRead(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	alertID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_ALERT_ID",
				"message": "Invalid alert ID format",
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	if err := h.strategyService.MarkAlertRead(c.Request.Context(), userID, alertID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "MARK_READ_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       gin.H{"message": "Alert marked as read"},
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// MarkAllAlertsRead 标记所有提醒已读
func (h *StrategyHandler) MarkAllAlertsRead(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	if err := h.strategyService.MarkAllAlertsRead(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "MARK_ALL_READ_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       gin.H{"message": "All alerts marked as read"},
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// GetUnreadAlertCount 获取未读提醒数量
func (h *StrategyHandler) GetUnreadAlertCount(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	count, err := h.strategyService.GetUnreadAlertCount(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "GET_COUNT_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       gin.H{"count": count},
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// RunBacktest 执行回测
func (h *StrategyHandler) RunBacktest(c *gin.Context) {
	var req service.BacktestRequest
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

	result, err := h.strategyService.RunBacktest(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "BACKTEST_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.Data(http.StatusOK, "application/json", result)
}
