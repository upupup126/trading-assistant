package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"trading-assistant/go-service/internal/service"
)

type TradingHandler struct {
	tradingService *service.TradingService
}

func NewTradingHandler(tradingService *service.TradingService) *TradingHandler {
	return &TradingHandler{
		tradingService: tradingService,
	}
}

func (h *TradingHandler) getUserID(c *gin.Context) (uuid.UUID, bool) {
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

// GetPositions 获取持仓列表
func (h *TradingHandler) GetPositions(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	account := c.Query("account")

	positions, err := h.tradingService.GetPositions(c.Request.Context(), userID, account)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "GET_POSITIONS_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       positions,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// AddPosition 手动添加持仓
func (h *TradingHandler) AddPosition(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	var req service.AddPositionRequest
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

	position, err := h.tradingService.AddPosition(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "ADD_POSITION_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success":    true,
		"data":       position,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// DeletePosition 删除持仓
func (h *TradingHandler) DeletePosition(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	positionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_POSITION_ID",
				"message": "Invalid position ID format",
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	if err := h.tradingService.DeletePosition(c.Request.Context(), userID, positionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "DELETE_POSITION_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       gin.H{"message": "Position deleted successfully"},
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// RecordTrade 记录交易
func (h *TradingHandler) RecordTrade(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	var req service.RecordTradeRequest
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

	execution, err := h.tradingService.RecordTrade(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "RECORD_TRADE_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success":    true,
		"data":       execution,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// GetTradeHistory 获取交易历史
func (h *TradingHandler) GetTradeHistory(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	account := c.Query("account")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit <= 0 || limit > 100 {
		limit = 20
	}

	executions, total, err := h.tradingService.GetTradeHistory(c.Request.Context(), userID, account, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "GET_TRADE_HISTORY_FAILED",
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
			"executions": executions,
			"total":      total,
			"limit":      limit,
			"offset":     offset,
		},
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// GetFund 获取资金情况
func (h *TradingHandler) GetFund(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	account := c.Query("account")

	fund, err := h.tradingService.GetFund(c.Request.Context(), userID, account)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "GET_FUND_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       fund,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// UpdateFund 更新资金设置
func (h *TradingHandler) UpdateFund(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	var req service.UpdateFundRequest
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

	fund, err := h.tradingService.UpdateFund(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "UPDATE_FUND_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       fund,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// GetPortfolioSummary 获取投资组合概览
func (h *TradingHandler) GetPortfolioSummary(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	account := c.Query("account")

	summary, err := h.tradingService.GetPortfolioSummary(c.Request.Context(), userID, account)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "GET_PORTFOLIO_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       summary,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// SearchStocks 搜索股票
func (h *TradingHandler) SearchStocks(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "MISSING_QUERY",
				"message": "Search query parameter 'q' is required",
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	results, err := h.tradingService.SearchStocks(c.Request.Context(), query, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "SEARCH_STOCKS_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       results,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// ============ 交易计划 ============

// GetPlans 获取交易计划列表
func (h *TradingHandler) GetPlans(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	status := c.Query("status")

	plans, err := h.tradingService.GetPlans(c.Request.Context(), userID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "GET_PLANS_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       plans,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// GetPlanByID 获取单个交易计划
func (h *TradingHandler) GetPlanByID(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	planID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_PLAN_ID",
				"message": "Invalid plan ID format",
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	plan, err := h.tradingService.GetPlanByID(c.Request.Context(), userID, planID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "PLAN_NOT_FOUND",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       plan,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// CreatePlan 创建交易计划
func (h *TradingHandler) CreatePlan(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	var req service.CreatePlanRequest
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

	plan, err := h.tradingService.CreatePlan(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "CREATE_PLAN_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success":    true,
		"data":       plan,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}

// UpdatePlanStatus 更新交易计划状态
func (h *TradingHandler) UpdatePlanStatus(c *gin.Context) {
	userID, ok := h.getUserID(c)
	if !ok {
		return
	}

	planID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_PLAN_ID",
				"message": "Invalid plan ID format",
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	var req service.UpdatePlanStatusRequest
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

	plan, err := h.tradingService.UpdatePlanStatus(c.Request.Context(), userID, planID, req.Status)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "UPDATE_PLAN_FAILED",
				"message": err.Error(),
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":    true,
		"data":       plan,
		"timestamp":  time.Now().Unix(),
		"request_id": c.GetString("request_id"),
	})
}
