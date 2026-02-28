package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// AIClient Python AI服务客户端
type AIClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewAIClient 创建AI客户端
func NewAIClient(baseURL string) *AIClient {
	return &AIClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// MarketAnalysisRequest 市场分析请求
type MarketAnalysisRequest struct {
	Symbols      []string `json:"symbols,omitempty"`
	AnalysisType string   `json:"analysis_type"`
}

// MarketAnalysisResponse 市场分析响应
type MarketAnalysisResponse struct {
	AnalysisID      string   `json:"analysis_id"`
	MarketSentiment string   `json:"market_sentiment"`
	HotSectors      []string `json:"hot_sectors"`
	KeyInsights     []string `json:"key_insights"`
	MarketSummary   string   `json:"market_summary"`
	ConfidenceScore float64  `json:"confidence_score"`
	GeneratedAt     string   `json:"generated_at"`
}

// StockAnalysisRequest 个股分析请求
type StockAnalysisRequest struct {
	Symbol      string                 `json:"symbol"`
	UserContext map[string]interface{} `json:"user_context,omitempty"`
}

// StockAnalysisResponse 个股分析响应
type StockAnalysisResponse struct {
	AnalysisID        string   `json:"analysis_id"`
	Symbol            string   `json:"symbol"`
	Recommendation    string   `json:"recommendation"`
	TargetPrice       *float64 `json:"target_price"`
	SupportLevels     []float64 `json:"support_levels"`
	ResistanceLevels  []float64 `json:"resistance_levels"`
	KeyFactors        []string `json:"key_factors"`
	RiskFactors       []string `json:"risk_factors"`
	OpportunityScore  float64  `json:"opportunity_score"`
	RiskScore         float64  `json:"risk_score"`
	ConfidenceScore   float64  `json:"confidence_score"`
	GeneratedAt       string   `json:"generated_at"`
}

// RiskAssessmentRequest 风险评估请求
type RiskAssessmentRequest struct {
	Portfolio   map[string]float64     `json:"portfolio"`
	UserProfile map[string]interface{} `json:"user_profile,omitempty"`
}

// RiskAssessmentResponse 风险评估响应
type RiskAssessmentResponse struct {
	AssessmentID          string             `json:"assessment_id"`
	PortfolioRiskLevel    string             `json:"portfolio_risk_level"`
	DiversificationScore  float64            `json:"diversification_score"`
	VolatilityScore       float64            `json:"volatility_score"`
	SectorConcentration   map[string]float64 `json:"sector_concentration"`
	RiskMetrics           map[string]float64 `json:"risk_metrics"`
	Recommendations       []string           `json:"recommendations"`
	GeneratedAt           string             `json:"generated_at"`
}

// TradingAdviceRequest 交易建议请求
type TradingAdviceRequest struct {
	Symbol      string                 `json:"symbol"`
	PlanContext map[string]interface{} `json:"plan_context"`
}

// TradingAdviceResponse 交易建议响应
type TradingAdviceResponse struct {
	AdviceID        string   `json:"advice_id"`
	Symbol          string   `json:"symbol"`
	Action          string   `json:"action"`
	Reasoning       string   `json:"reasoning"`
	EntryPrice      *float64 `json:"entry_price"`
	StopLoss        *float64 `json:"stop_loss"`
	TakeProfit      *float64 `json:"take_profit"`
	PositionSize    *float64 `json:"position_size"`
	TimeHorizon     string   `json:"time_horizon"`
	ConfidenceLevel float64  `json:"confidence_level"`
	GeneratedAt     string   `json:"generated_at"`
}

// StockQuote 股票行情
type StockQuote struct {
	Symbol        string  `json:"symbol"`
	Name          string  `json:"name"`
	Price         float64 `json:"price"`
	Open          float64 `json:"open"`
	High          float64 `json:"high"`
	Low           float64 `json:"low"`
	Volume        int64   `json:"volume"`
	Change        float64 `json:"change"`
	ChangePercent float64 `json:"change_percent"`
	MarketCap     int64   `json:"market_cap"`
	PERatio       float64 `json:"pe_ratio"`
	Timestamp     string  `json:"timestamp"`
}

// MarketOverview 市场概览
type MarketOverview struct {
	Indices           map[string]IndexData  `json:"indices"`
	MarketStats       MarketStats           `json:"market_stats"`
	SectorPerformance map[string]float64    `json:"sector_performance"`
	Timestamp         string                `json:"timestamp"`
}

// IndexData 指数数据
type IndexData struct {
	Price         float64 `json:"price"`
	Change        float64 `json:"change"`
	ChangePercent float64 `json:"change_percent"`
	Volume        int64   `json:"volume"`
}

// MarketStats 市场统计
type MarketStats struct {
	TotalVolume     int64 `json:"total_volume"`
	AdvancingStocks int   `json:"advancing_stocks"`
	DecliningStocks int   `json:"declining_stocks"`
	UnchangedStocks int   `json:"unchanged_stocks"`
}

// doRequest 执行HTTP请求
func (c *AIClient) doRequest(ctx context.Context, method, path string, body interface{}, result interface{}) error {
	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonData)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reqBody)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error %d: %s", resp.StatusCode, string(bodyBytes))
	}

	if result != nil {
		if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
			return fmt.Errorf("decode response: %w", err)
		}
	}

	return nil
}

// AnalyzeMarketTrend 分析市场趋势
func (c *AIClient) AnalyzeMarketTrend(ctx context.Context, req *MarketAnalysisRequest) (*MarketAnalysisResponse, error) {
	var result MarketAnalysisResponse
	err := c.doRequest(ctx, "POST", "/api/ai/market-trend", req, &result)
	if err != nil {
		return nil, fmt.Errorf("analyze market trend: %w", err)
	}
	return &result, nil
}

// AnalyzeStockOpportunity 分析个股机会
func (c *AIClient) AnalyzeStockOpportunity(ctx context.Context, req *StockAnalysisRequest) (*StockAnalysisResponse, error) {
	var result StockAnalysisResponse
	err := c.doRequest(ctx, "POST", "/api/ai/stock-opportunity", req, &result)
	if err != nil {
		return nil, fmt.Errorf("analyze stock opportunity: %w", err)
	}
	return &result, nil
}

// AssessPortfolioRisk 评估投资组合风险
func (c *AIClient) AssessPortfolioRisk(ctx context.Context, req *RiskAssessmentRequest) (*RiskAssessmentResponse, error) {
	var result RiskAssessmentResponse
	err := c.doRequest(ctx, "POST", "/api/ai/risk-assessment", req, &result)
	if err != nil {
		return nil, fmt.Errorf("assess portfolio risk: %w", err)
	}
	return &result, nil
}

// GenerateTradingAdvice 生成交易建议
func (c *AIClient) GenerateTradingAdvice(ctx context.Context, req *TradingAdviceRequest) (*TradingAdviceResponse, error) {
	var result TradingAdviceResponse
	err := c.doRequest(ctx, "POST", "/api/ai/trading-advice", req, &result)
	if err != nil {
		return nil, fmt.Errorf("generate trading advice: %w", err)
	}
	return &result, nil
}

// GetMarketOverview 获取市场概览
func (c *AIClient) GetMarketOverview(ctx context.Context) (*MarketOverview, error) {
	var result MarketOverview
	err := c.doRequest(ctx, "GET", "/api/ai/market-overview", nil, &result)
	if err != nil {
		return nil, fmt.Errorf("get market overview: %w", err)
	}
	return &result, nil
}

// GetStockQuote 获取股票行情
func (c *AIClient) GetStockQuote(ctx context.Context, symbol string) (*StockQuote, error) {
	var result StockQuote
	path := fmt.Sprintf("/api/ai/stock/%s/quote", symbol)
	err := c.doRequest(ctx, "GET", path, nil, &result)
	if err != nil {
		return nil, fmt.Errorf("get stock quote: %w", err)
	}
	return &result, nil
}

// HealthCheck 健康检查
func (c *AIClient) HealthCheck(ctx context.Context) error {
	var result map[string]interface{}
	err := c.doRequest(ctx, "GET", "/api/ai/health", nil, &result)
	if err != nil {
		return fmt.Errorf("health check: %w", err)
	}
	return nil
}