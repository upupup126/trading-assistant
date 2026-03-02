package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"

	"trading-assistant/go-service/internal/model"
	"trading-assistant/go-service/internal/repository"
)

type StrategyService struct {
	strategyRepo     repository.StrategyRepository
	pythonServiceURL string
	stopChan         chan struct{}
}

func NewStrategyService(strategyRepo repository.StrategyRepository, pythonServiceURL string) *StrategyService {
	return &StrategyService{
		strategyRepo:     strategyRepo,
		pythonServiceURL: pythonServiceURL,
		stopChan:         make(chan struct{}),
	}
}

// ============ 请求/响应类型 ============

type CreateStrategyRequest struct {
	StockSymbol        string   `json:"stock_symbol" binding:"required"`
	StockName          string   `json:"stock_name" binding:"required"`
	Name               string   `json:"name" binding:"required"`
	StrategyType       string   `json:"strategy_type" binding:"required,oneof=SHORT MID LONG"`
	BuiltinStrategyIDs []string `json:"builtin_strategy_ids"`
	CustomRules        string   `json:"custom_rules"`
	AlertEnabled       *bool    `json:"alert_enabled"`
	Notes              string   `json:"notes"`
}

type UpdateStrategyRequest struct {
	Name               *string  `json:"name"`
	StrategyType       *string  `json:"strategy_type"`
	BuiltinStrategyIDs []string `json:"builtin_strategy_ids"`
	CustomRules        *string  `json:"custom_rules"`
	AlertEnabled       *bool    `json:"alert_enabled"`
	Status             *string  `json:"status"`
	Notes              *string  `json:"notes"`
}

type StrategyResponse struct {
	ID                 string   `json:"id"`
	StockSymbol        string   `json:"stock_symbol"`
	StockName          string   `json:"stock_name"`
	Name               string   `json:"name"`
	StrategyType       string   `json:"strategy_type"`
	BuiltinStrategyIDs []string `json:"builtin_strategy_ids"`
	CustomRules        string   `json:"custom_rules"`
	AlertEnabled       bool     `json:"alert_enabled"`
	Status             string   `json:"status"`
	Notes              *string  `json:"notes"`
	CreatedAt          string   `json:"created_at"`
	UpdatedAt          string   `json:"updated_at"`
}

type AlertResponse struct {
	ID                string  `json:"id"`
	StrategyID        string  `json:"strategy_id"`
	StockSymbol       string  `json:"stock_symbol"`
	StockName         string  `json:"stock_name"`
	AlertType         string  `json:"alert_type"`
	TriggeredStrategy *string `json:"triggered_strategy"`
	Message           string  `json:"message"`
	Details           *string `json:"details"`
	IsRead            bool    `json:"is_read"`
	CreatedAt         string  `json:"created_at"`
}

type BacktestRequest struct {
	StockSymbol        string   `json:"stock_symbol" binding:"required"`
	BuiltinStrategyIDs []string `json:"builtin_strategy_ids"`
	CustomRules        string   `json:"custom_rules"`
	StartDate          string   `json:"start_date"`
	EndDate            string   `json:"end_date"`
	InitialCapital     float64  `json:"initial_capital,omitempty"`
}

// BuiltinStrategyInfo 内置策略信息
type BuiltinStrategyInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
	BuyLogic    string `json:"buy_logic"`
	SellLogic   string `json:"sell_logic"`
}

// ============ 内置策略定义 ============

func GetBuiltinStrategies() []BuiltinStrategyInfo {
	return []BuiltinStrategyInfo{
		{ID: "short_ma5_cross", Name: "5日均线交叉", Type: "SHORT", Description: "基于MA5和MA10的金叉死叉信号，适合短线波段操作", BuyLogic: "MA5上穿MA10（金叉）", SellLogic: "MA5下穿MA10（死叉）"},
		{ID: "short_macd_diverge", Name: "MACD金叉死叉", Type: "SHORT", Description: "基于MACD指标DIF/DEA交叉和柱状线变化", BuyLogic: "DIF上穿DEA且MACD柱由负转正", SellLogic: "DIF下穿DEA且MACD柱由正转负"},
		{ID: "short_kdj_oversold", Name: "KDJ超买超卖", Type: "SHORT", Description: "利用KDJ指标的超买超卖区域交叉信号", BuyLogic: "K值<20且K上穿D（超卖区金叉）", SellLogic: "K值>80且K下穿D（超买区死叉）"},
		{ID: "mid_ma20_trend", Name: "20日均线趋势", Type: "MID", Description: "以20日均线作为中期趋势判断依据", BuyLogic: "收盘价上穿MA20且MA20方向向上", SellLogic: "收盘价下穿MA20"},
		{ID: "mid_boll_break", Name: "布林带突破", Type: "MID", Description: "基于BOLL(20,2)通道的突破与回归策略", BuyLogic: "价格触及下轨后反弹，且带宽收窄", SellLogic: "价格触及上轨后回落"},
		{ID: "mid_vol_price", Name: "量价配合", Type: "MID", Description: "成交量与价格联动分析，放量突破确认趋势", BuyLogic: "放量突破20日均线（量>20日均量×1.5）", SellLogic: "缩量跌破20日均线"},
		{ID: "long_ma_arrange", Name: "多头排列", Type: "LONG", Description: "MA5>MA10>MA20>MA60形成多头排列，趋势确认信号", BuyLogic: "首次形成完整多头排列（MA5>MA10>MA20>MA60）", SellLogic: "多头排列被破坏（任一短期均线下穿长期均线）"},
		{ID: "long_ma250_support", Name: "年线支撑", Type: "LONG", Description: "以250日均线（年线）作为长期支撑/压力判断", BuyLogic: "价格回踩MA250获得支撑（不破年线且反弹）", SellLogic: "价格有效跌破MA250（连续3日收盘在年线下方）"},
		{ID: "long_macd_weekly", Name: "周线MACD趋势", Type: "LONG", Description: "基于周K线MACD指标判断长期趋势", BuyLogic: "周线级别DIF上穿DEA", SellLogic: "周线级别DIF下穿DEA"},
		// 仓位管理策略
		{ID: "pos_pyramid_buy", Name: "金字塔建仓", Type: "POSITION", Description: "首次建仓50%资金，二次加仓30%，三次加仓20%，分批减仓卖出", BuyLogic: "根据信号分3批建仓（50%/30%/20%）", SellLogic: "根据信号分3批减仓（50%/30%/20%）"},
		{ID: "pos_batch_buy", Name: "均匀分批建仓", Type: "POSITION", Description: "每次信号触发时等额建仓1/3，分3批完成建仓和清仓", BuyLogic: "均匀分3批建仓（各1/3资金）", SellLogic: "均匀分3批减仓（各1/3持仓）"},
		{ID: "pos_dynamic_rebalance", Name: "动态再平衡", Type: "POSITION", Description: "首次建仓60%资金，二次加仓40%，分2次减仓卖出", BuyLogic: "分2批建仓（60%/40%）", SellLogic: "分2批减仓（60%/40%）"},
	}
}

// ============ JSON helper for builtin_strategy_ids ============

func marshalStringArray(ids []string) string {
	if ids == nil {
		return "[]"
	}
	data, _ := json.Marshal(ids)
	return string(data)
}

func unmarshalStringArray(s string) []string {
	if s == "" || s == "[]" {
		return []string{}
	}
	var ids []string
	if err := json.Unmarshal([]byte(s), &ids); err != nil {
		return []string{}
	}
	return ids
}

// ensureValidJSON wraps a plain text string as a JSON string value if it's not already valid JSON.
// This is needed because custom_rules is stored as JSONB in PostgreSQL.
func ensureValidJSON(s string) string {
	if s == "" {
		return "[]"
	}
	// Check if it's already valid JSON
	if json.Valid([]byte(s)) {
		return s
	}
	// Wrap plain text as a JSON string value
	data, _ := json.Marshal(s)
	return string(data)
}

// unwrapJSONString attempts to unwrap a JSON string value back to plain text.
// If the value is a JSON string (e.g. "\"hello\""), it returns "hello".
// Otherwise it returns the original string as-is.
func unwrapJSONString(s string) string {
	if s == "" || s == "[]" {
		return ""
	}
	var text string
	if err := json.Unmarshal([]byte(s), &text); err == nil {
		return text
	}
	return s
}

// ============ 策略 CRUD ============

func (s *StrategyService) GetStrategies(ctx context.Context, userID uuid.UUID) ([]StrategyResponse, error) {
	strategies, err := s.strategyRepo.GetStrategies(ctx, userID)
	if err != nil {
		return nil, err
	}

	result := make([]StrategyResponse, len(strategies))
	for i, st := range strategies {
		result[i] = strategyToResponse(&st)
	}
	return result, nil
}

func (s *StrategyService) CreateStrategy(ctx context.Context, userID uuid.UUID, req *CreateStrategyRequest) (*StrategyResponse, error) {
	alertEnabled := true
	if req.AlertEnabled != nil {
		alertEnabled = *req.AlertEnabled
	}

	customRules := ensureValidJSON(req.CustomRules)

	var notes *string
	if req.Notes != "" {
		notes = &req.Notes
	}

	strategy := &model.TradingStrategy{
		UserID:             userID,
		StockSymbol:        req.StockSymbol,
		StockName:          req.StockName,
		Name:               req.Name,
		StrategyType:       req.StrategyType,
		BuiltinStrategyIDs: marshalStringArray(req.BuiltinStrategyIDs),
		CustomRules:        customRules,
		AlertEnabled:       alertEnabled,
		Status:             "ACTIVE",
		Notes:              notes,
	}

	if err := s.strategyRepo.CreateStrategy(ctx, strategy); err != nil {
		return nil, err
	}

	resp := strategyToResponse(strategy)
	return &resp, nil
}

func (s *StrategyService) UpdateStrategy(ctx context.Context, userID uuid.UUID, id uuid.UUID, req *UpdateStrategyRequest) (*StrategyResponse, error) {
	strategy, err := s.strategyRepo.GetStrategyByID(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	if strategy == nil {
		return nil, fmt.Errorf("strategy not found")
	}

	if req.Name != nil {
		strategy.Name = *req.Name
	}
	if req.StrategyType != nil {
		strategy.StrategyType = *req.StrategyType
	}
	if req.BuiltinStrategyIDs != nil {
		strategy.BuiltinStrategyIDs = marshalStringArray(req.BuiltinStrategyIDs)
	}
	if req.CustomRules != nil {
		strategy.CustomRules = ensureValidJSON(*req.CustomRules)
	}
	if req.AlertEnabled != nil {
		strategy.AlertEnabled = *req.AlertEnabled
	}
	if req.Status != nil {
		strategy.Status = *req.Status
	}
	if req.Notes != nil {
		strategy.Notes = req.Notes
	}

	if err := s.strategyRepo.UpdateStrategy(ctx, strategy); err != nil {
		return nil, err
	}

	resp := strategyToResponse(strategy)
	return &resp, nil
}

func (s *StrategyService) DeleteStrategy(ctx context.Context, userID uuid.UUID, id uuid.UUID) error {
	strategy, err := s.strategyRepo.GetStrategyByID(ctx, id, userID)
	if err != nil {
		return err
	}
	if strategy == nil {
		return fmt.Errorf("strategy not found")
	}
	return s.strategyRepo.DeleteStrategy(ctx, id, userID)
}

// ============ 提醒管理 ============

func (s *StrategyService) GetAlerts(ctx context.Context, userID uuid.UUID, unreadOnly bool, limit, offset int) ([]AlertResponse, int64, error) {
	alerts, total, err := s.strategyRepo.GetAlerts(ctx, userID, unreadOnly, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	result := make([]AlertResponse, len(alerts))
	for i, a := range alerts {
		result[i] = alertToResponse(&a)
	}
	return result, total, nil
}

func (s *StrategyService) MarkAlertRead(ctx context.Context, userID uuid.UUID, id uuid.UUID) error {
	return s.strategyRepo.MarkAlertRead(ctx, id, userID)
}

func (s *StrategyService) MarkAllAlertsRead(ctx context.Context, userID uuid.UUID) error {
	return s.strategyRepo.MarkAllAlertsRead(ctx, userID)
}

func (s *StrategyService) GetUnreadAlertCount(ctx context.Context, userID uuid.UUID) (int64, error) {
	return s.strategyRepo.GetUnreadAlertCount(ctx, userID)
}

// ============ 通知静音 ============

func (s *StrategyService) MuteAlert(ctx context.Context, userID uuid.UUID, stockSymbol, alertType string) error {
	today := time.Now().In(time.FixedZone("CST", 8*3600)).Format("2006-01-02")
	mute := &model.AlertMute{
		UserID:      userID,
		StockSymbol: stockSymbol,
		AlertType:   alertType,
		MuteDate:    today,
	}
	return s.strategyRepo.MuteAlert(ctx, mute)
}

func (s *StrategyService) UnmuteAlert(ctx context.Context, userID uuid.UUID, stockSymbol, alertType string) error {
	today := time.Now().In(time.FixedZone("CST", 8*3600)).Format("2006-01-02")
	return s.strategyRepo.UnmuteAlert(ctx, userID, stockSymbol, alertType, today)
}

func (s *StrategyService) GetMutedAlerts(ctx context.Context, userID uuid.UUID) ([]model.AlertMute, error) {
	today := time.Now().In(time.FixedZone("CST", 8*3600)).Format("2006-01-02")
	return s.strategyRepo.GetMutedAlerts(ctx, userID, today)
}

// ============ 回测（转发到 Python 服务） ============

func (s *StrategyService) RunBacktest(ctx context.Context, req *BacktestRequest) (json.RawMessage, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal backtest request: %w", err)
	}

	url := fmt.Sprintf("%s/api/strategy/backtest", s.pythonServiceURL)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create backtest request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("backtest request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read backtest response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("backtest service returned status %d: %s", resp.StatusCode, string(respBody))
	}

	return json.RawMessage(respBody), nil
}

// ============ 策略信号检查（转发到 Python 服务） ============

func (s *StrategyService) CheckSignals(ctx context.Context, strategies []model.TradingStrategy) error {
	if len(strategies) == 0 {
		return nil
	}

	type checkItem struct {
		StrategyID         string   `json:"strategy_id"`
		UserID             string   `json:"user_id"`
		StockSymbol        string   `json:"stock_symbol"`
		StockName          string   `json:"stock_name"`
		BuiltinStrategyIDs []string `json:"builtin_strategy_ids"`
		CustomRules        string   `json:"custom_rules"`
	}

	items := make([]checkItem, len(strategies))
	for i, st := range strategies {
		items[i] = checkItem{
			StrategyID:         st.ID.String(),
			UserID:             st.UserID.String(),
			StockSymbol:        st.StockSymbol,
			StockName:          st.StockName,
			BuiltinStrategyIDs: unmarshalStringArray(st.BuiltinStrategyIDs),
			CustomRules:        st.CustomRules,
		}
	}

	body, err := json.Marshal(map[string]interface{}{"strategies": items})
	if err != nil {
		return fmt.Errorf("failed to marshal check request: %w", err)
	}

	url := fmt.Sprintf("%s/api/strategy/check-signals", s.pythonServiceURL)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create check request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("check signals request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read check response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("check service returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Signals []struct {
			StrategyID        string `json:"strategy_id"`
			UserID            string `json:"user_id"`
			StockSymbol       string `json:"stock_symbol"`
			StockName         string `json:"stock_name"`
			AlertType         string `json:"alert_type"`
			TriggeredStrategy string `json:"triggered_strategy"`
			Message           string `json:"message"`
			Details           string `json:"details"`
		} `json:"signals"`
	}

	if err := json.Unmarshal(respBody, &result); err != nil {
		return fmt.Errorf("failed to parse check response: %w", err)
	}

	today := time.Now().In(time.FixedZone("CST", 8*3600)).Format("2006-01-02")

	for _, sig := range result.Signals {
		strategyID, _ := uuid.Parse(sig.StrategyID)
		userID, _ := uuid.Parse(sig.UserID)

		// 检查是否已被用户静音（同一股票+同一信号类型+当天）
		muted, err := s.strategyRepo.IsMuted(ctx, userID, sig.StockSymbol, sig.AlertType, today)
		if err != nil {
			log.Printf("Failed to check mute status: %v", err)
		}
		if muted {
			log.Printf("Alert muted for user %s, stock %s, type %s", sig.UserID, sig.StockSymbol, sig.AlertType)
			continue
		}

		triggeredStrategy := sig.TriggeredStrategy
		details := sig.Details

		alert := &model.StrategyAlert{
			StrategyID:        strategyID,
			UserID:            userID,
			StockSymbol:       sig.StockSymbol,
			StockName:         sig.StockName,
			AlertType:         sig.AlertType,
			TriggeredStrategy: &triggeredStrategy,
			Message:           sig.Message,
			Details:           &details,
			IsRead:            false,
		}

		if err := s.strategyRepo.CreateAlert(ctx, alert); err != nil {
			log.Printf("Failed to create alert for strategy %s: %v", sig.StrategyID, err)
		}
	}

	if len(result.Signals) > 0 {
		log.Printf("Strategy check completed: %d signals generated", len(result.Signals))
	}

	return nil
}

// ============ 定时任务 ============

func (s *StrategyService) StartScheduler() {
	go func() {
		log.Println("Strategy signal checker scheduler started")
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				if isTradingTime() {
					s.runSignalCheck()
				}
			case <-s.stopChan:
				log.Println("Strategy signal checker scheduler stopped")
				return
			}
		}
	}()
}

func (s *StrategyService) StopScheduler() {
	close(s.stopChan)
}

func (s *StrategyService) runSignalCheck() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	strategies, err := s.strategyRepo.GetAllActiveStrategies(ctx)
	if err != nil {
		log.Printf("Failed to get active strategies: %v", err)
		return
	}

	if len(strategies) == 0 {
		return
	}

	if err := s.CheckSignals(ctx, strategies); err != nil {
		log.Printf("Failed to check signals: %v", err)
	}
}

func isTradingTime() bool {
	now := time.Now().UTC().Add(8 * time.Hour)
	weekday := now.Weekday()
	if weekday == time.Saturday || weekday == time.Sunday {
		return false
	}
	t := now.Hour()*100 + now.Minute()
	return (t >= 930 && t <= 1130) || (t >= 1300 && t <= 1500)
}

// ============ 辅助函数 ============

func strategyToResponse(st *model.TradingStrategy) StrategyResponse {
	return StrategyResponse{
		ID:                 st.ID.String(),
		StockSymbol:        st.StockSymbol,
		StockName:          st.StockName,
		Name:               st.Name,
		StrategyType:       st.StrategyType,
		BuiltinStrategyIDs: unmarshalStringArray(st.BuiltinStrategyIDs),
		CustomRules:        unwrapJSONString(st.CustomRules),
		AlertEnabled:       st.AlertEnabled,
		Status:             st.Status,
		Notes:              st.Notes,
		CreatedAt:          st.CreatedAt.Format(time.RFC3339),
		UpdatedAt:          st.UpdatedAt.Format(time.RFC3339),
	}
}

func alertToResponse(a *model.StrategyAlert) AlertResponse {
	return AlertResponse{
		ID:                a.ID.String(),
		StrategyID:        a.StrategyID.String(),
		StockSymbol:       a.StockSymbol,
		StockName:         a.StockName,
		AlertType:         a.AlertType,
		TriggeredStrategy: a.TriggeredStrategy,
		Message:           a.Message,
		Details:           a.Details,
		IsRead:            a.IsRead,
		CreatedAt:         a.CreatedAt.Format(time.RFC3339),
	}
}
