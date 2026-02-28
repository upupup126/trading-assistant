package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"trading-assistant/go-service/internal/service"
)

// AIHandler AI分析处理器
type AIHandler struct {
	aiService *service.AIService
}

// NewAIHandler 创建AI处理器
func NewAIHandler(aiService *service.AIService) *AIHandler {
	return &AIHandler{
		aiService: aiService,
	}
}

// MarketTrendRequest 市场趋势分析请求
type MarketTrendRequest struct {
	Symbols []string `json:"symbols"`
}

// StockOpportunityRequest 个股机会分析请求
type StockOpportunityRequest struct {
	Symbol      string                 `json:"symbol" binding:"required"`
	UserContext map[string]interface{} `json:"user_context"`
}

// RiskAssessmentRequest 风险评估请求
type RiskAssessmentRequest struct {
	Portfolio map[string]float64 `json:"portfolio" binding:"required"`
}

// TradingAdviceRequest 交易建议请求
type TradingAdviceRequest struct {
	Symbol      string                 `json:"symbol" binding:"required"`
	PlanContext map[string]interface{} `json:"plan_context" binding:"required"`
}

func getAIUserID(c *gin.Context) string {
	if uid, exists := c.Get("user_id"); exists {
		switch v := uid.(type) {
		case string:
			return v
		case float64:
			return strconv.FormatFloat(v, 'f', 0, 64)
		}
	}
	return ""
}

// AnalyzeMarketTrend 分析市场趋势
func (h *AIHandler) AnalyzeMarketTrend(c *gin.Context) {
	userID := getAIUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权访问"})
		return
	}

	var req MarketTrendRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误: " + err.Error()})
		return
	}

	analysis, err := h.aiService.AnalyzeMarketTrend(c.Request.Context(), userID, req.Symbols)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "市场分析失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    analysis,
	})
}

// AnalyzeStockOpportunity 分析个股机会
func (h *AIHandler) AnalyzeStockOpportunity(c *gin.Context) {
	userID := getAIUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权访问"})
		return
	}

	var req StockOpportunityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误: " + err.Error()})
		return
	}

	analysis, err := h.aiService.AnalyzeStockOpportunity(c.Request.Context(), userID, req.Symbol, req.UserContext)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "个股分析失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    analysis,
	})
}

// AssessPortfolioRisk 评估投资组合风险
func (h *AIHandler) AssessPortfolioRisk(c *gin.Context) {
	userID := getAIUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权访问"})
		return
	}

	var req RiskAssessmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误: " + err.Error()})
		return
	}

	analysis, err := h.aiService.AssessPortfolioRisk(c.Request.Context(), userID, req.Portfolio)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "风险评估失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    analysis,
	})
}

// GenerateTradingAdvice 生成交易建议
func (h *AIHandler) GenerateTradingAdvice(c *gin.Context) {
	userID := getAIUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权访问"})
		return
	}

	var req TradingAdviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求参数错误: " + err.Error()})
		return
	}

	analysis, err := h.aiService.GenerateTradingAdvice(c.Request.Context(), userID, req.Symbol, req.PlanContext)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "交易建议生成失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    analysis,
	})
}

// GetMarketOverview 获取市场概览
func (h *AIHandler) GetMarketOverview(c *gin.Context) {
	overview, err := h.aiService.GetMarketOverview(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取市场概览失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    overview,
	})
}

// GetStockQuote 获取股票行情
func (h *AIHandler) GetStockQuote(c *gin.Context) {
	symbol := c.Param("symbol")
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "股票代码不能为空"})
		return
	}

	quote, err := h.aiService.GetStockQuote(c.Request.Context(), symbol)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取股票行情失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    quote,
	})
}

// GetAnalysisHistory 获取分析历史
func (h *AIHandler) GetAnalysisHistory(c *gin.Context) {
	userID := getAIUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未授权访问"})
		return
	}

	limit := 20
	offset := 0
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	analyses, err := h.aiService.GetAnalysisHistory(c.Request.Context(), userID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取分析历史失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"analyses": analyses,
			"limit":    limit,
			"offset":   offset,
			"count":    len(analyses),
		},
	})
}

// GetAnalysisDetail 获取分析详情
func (h *AIHandler) GetAnalysisDetail(c *gin.Context) {
	analysisID := c.Param("id")
	if analysisID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的分析ID"})
		return
	}

	analysis, err := h.aiService.GetAnalysisByID(c.Request.Context(), analysisID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取分析详情失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    analysis,
	})
}

// HealthCheck AI服务健康检查
func (h *AIHandler) HealthCheck(c *gin.Context) {
	err := h.aiService.HealthCheck(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "AI服务不可用: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "AI服务运行正常",
	})
}
