package service

import (
	"context"
	"fmt"
	"log"

	"trading-assistant/go-service/internal/client"
	"trading-assistant/go-service/internal/model"
	"gorm.io/gorm"
)

// AIService AI分析服务
type AIService struct {
	aiClient *client.AIClient
	db       *gorm.DB
}

// NewAIService 创建AI服务
func NewAIService(aiClient *client.AIClient, db *gorm.DB) *AIService {
	return &AIService{
		aiClient: aiClient,
		db:       db,
	}
}

// AnalyzeMarketTrend 分析市场趋势
func (s *AIService) AnalyzeMarketTrend(ctx context.Context, userID string, symbols []string) (map[string]interface{}, error) {
	req := &client.MarketAnalysisRequest{
		Symbols:      symbols,
		AnalysisType: "comprehensive",
	}

	aiResult, err := s.aiClient.AnalyzeMarketTrend(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("AI analysis failed: %w", err)
	}

	// 保存分析记录
	analysis := &model.AIAnalysis{
		AnalysisType: "MARKET_TREND",
		Prompt:       fmt.Sprintf("market trend analysis for symbols: %v", symbols),
		Result:       fmt.Sprintf(`{"market_sentiment":"%s","confidence_score":%f}`, aiResult.MarketSentiment, aiResult.ConfidenceScore),
	}
	if err := s.db.Create(analysis).Error; err != nil {
		log.Printf("Failed to save analysis result: %v", err)
	}

	return map[string]interface{}{
		"analysis_id":      aiResult.AnalysisID,
		"market_sentiment": aiResult.MarketSentiment,
		"hot_sectors":      aiResult.HotSectors,
		"key_insights":     aiResult.KeyInsights,
		"market_summary":   aiResult.MarketSummary,
		"confidence_score": aiResult.ConfidenceScore,
	}, nil
}

// AnalyzeStockOpportunity 分析个股机会
func (s *AIService) AnalyzeStockOpportunity(ctx context.Context, userID string, symbol string, userContext map[string]interface{}) (map[string]interface{}, error) {
	req := &client.StockAnalysisRequest{
		Symbol:      symbol,
		UserContext: userContext,
	}

	aiResult, err := s.aiClient.AnalyzeStockOpportunity(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("AI analysis failed: %w", err)
	}

	// 保存分析记录
	analysis := &model.AIAnalysis{
		AnalysisType: "STOCK_OPPORTUNITY",
		Prompt:       fmt.Sprintf("stock opportunity analysis for %s", symbol),
		Result:       fmt.Sprintf(`{"recommendation":"%s","confidence_score":%f}`, aiResult.Recommendation, aiResult.ConfidenceScore),
	}
	if err := s.db.Create(analysis).Error; err != nil {
		log.Printf("Failed to save analysis result: %v", err)
	}

	return map[string]interface{}{
		"analysis_id":       aiResult.AnalysisID,
		"symbol":            aiResult.Symbol,
		"recommendation":    aiResult.Recommendation,
		"target_price":      aiResult.TargetPrice,
		"support_levels":    aiResult.SupportLevels,
		"resistance_levels": aiResult.ResistanceLevels,
		"key_factors":       aiResult.KeyFactors,
		"risk_factors":      aiResult.RiskFactors,
		"opportunity_score": aiResult.OpportunityScore,
		"risk_score":        aiResult.RiskScore,
		"confidence_score":  aiResult.ConfidenceScore,
	}, nil
}

// AssessPortfolioRisk 评估投资组合风险
func (s *AIService) AssessPortfolioRisk(ctx context.Context, userID string, portfolio map[string]float64) (map[string]interface{}, error) {
	req := &client.RiskAssessmentRequest{
		Portfolio: portfolio,
	}

	aiResult, err := s.aiClient.AssessPortfolioRisk(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("AI analysis failed: %w", err)
	}

	analysis := &model.AIAnalysis{
		AnalysisType: "RISK_ASSESSMENT",
		Prompt:       fmt.Sprintf("portfolio risk assessment for %v", portfolio),
		Result:       fmt.Sprintf(`{"portfolio_risk_level":"%s"}`, aiResult.PortfolioRiskLevel),
	}
	if err := s.db.Create(analysis).Error; err != nil {
		log.Printf("Failed to save analysis result: %v", err)
	}

	return map[string]interface{}{
		"assessment_id":         aiResult.AssessmentID,
		"portfolio_risk_level":  aiResult.PortfolioRiskLevel,
		"diversification_score": aiResult.DiversificationScore,
		"volatility_score":      aiResult.VolatilityScore,
		"sector_concentration":  aiResult.SectorConcentration,
		"risk_metrics":          aiResult.RiskMetrics,
		"recommendations":       aiResult.Recommendations,
	}, nil
}

// GenerateTradingAdvice 生成交易建议
func (s *AIService) GenerateTradingAdvice(ctx context.Context, userID string, symbol string, planContext map[string]interface{}) (map[string]interface{}, error) {
	req := &client.TradingAdviceRequest{
		Symbol:      symbol,
		PlanContext: planContext,
	}

	aiResult, err := s.aiClient.GenerateTradingAdvice(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("AI analysis failed: %w", err)
	}

	analysis := &model.AIAnalysis{
		AnalysisType: "TRADING_ADVICE",
		Prompt:       fmt.Sprintf("trading advice for %s", symbol),
		Result:       fmt.Sprintf(`{"action":"%s","confidence_level":%f}`, aiResult.Action, aiResult.ConfidenceLevel),
	}
	if err := s.db.Create(analysis).Error; err != nil {
		log.Printf("Failed to save analysis result: %v", err)
	}

	return map[string]interface{}{
		"advice_id":        aiResult.AdviceID,
		"symbol":           aiResult.Symbol,
		"action":           aiResult.Action,
		"reasoning":        aiResult.Reasoning,
		"entry_price":      aiResult.EntryPrice,
		"stop_loss":        aiResult.StopLoss,
		"take_profit":      aiResult.TakeProfit,
		"position_size":    aiResult.PositionSize,
		"time_horizon":     aiResult.TimeHorizon,
		"confidence_level": aiResult.ConfidenceLevel,
	}, nil
}

// GetMarketOverview 获取市场概览
func (s *AIService) GetMarketOverview(ctx context.Context) (*client.MarketOverview, error) {
	return s.aiClient.GetMarketOverview(ctx)
}

// GetStockQuote 获取股票行情
func (s *AIService) GetStockQuote(ctx context.Context, symbol string) (*client.StockQuote, error) {
	return s.aiClient.GetStockQuote(ctx, symbol)
}

// GetStockHistory 获取股票K线历史数据
func (s *AIService) GetStockHistory(ctx context.Context, symbol string, period string) (*client.StockHistoryResponse, error) {
	return s.aiClient.GetStockHistory(ctx, symbol, period)
}

// GetAnalysisHistory 获取用户分析历史
func (s *AIService) GetAnalysisHistory(ctx context.Context, userID string, limit, offset int) ([]model.AIAnalysis, error) {
	var analyses []model.AIAnalysis
	err := s.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&analyses).Error
	return analyses, err
}

// GetAnalysisByID 根据ID获取分析结果
func (s *AIService) GetAnalysisByID(ctx context.Context, analysisID string) (*model.AIAnalysis, error) {
	var analysis model.AIAnalysis
	err := s.db.Where("id = ?", analysisID).First(&analysis).Error
	if err != nil {
		return nil, err
	}
	return &analysis, nil
}

// HealthCheck 检查AI服务健康状态
func (s *AIService) HealthCheck(ctx context.Context) error {
	return s.aiClient.HealthCheck(ctx)
}

// GetMinuteData 获取分时走势数据
func (s *AIService) GetMinuteData(ctx context.Context, symbol string) (*client.MinuteDataResponse, error) {
	return s.aiClient.GetMinuteData(ctx, symbol)
}

// GetSectorHotspot 获取概念板块热点轮动数据
func (s *AIService) GetSectorHotspot(ctx context.Context, days int) (*client.SectorHotspotResponse, error) {
	return s.aiClient.GetSectorHotspot(ctx, days)
}

// SearchStocks 在线搜索股票
func (s *AIService) SearchStocks(ctx context.Context, query string, limit int) (*client.StockSearchResponse, error) {
	return s.aiClient.SearchStocks(ctx, query, limit)
}
