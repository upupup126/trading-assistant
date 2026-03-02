package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"trading-assistant/go-service/internal/model"
	"trading-assistant/go-service/internal/repository"
)

type TradingService struct {
	tradingRepo repository.TradingRepository
	db          *gorm.DB
}

func NewTradingService(tradingRepo repository.TradingRepository, db *gorm.DB) *TradingService {
	return &TradingService{
		tradingRepo: tradingRepo,
		db:          db,
	}
}

// ============ 请求/响应类型 ============

type AddPositionRequest struct {
	Symbol   string `json:"symbol" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Exchange string `json:"exchange" binding:"required"`
	Account  string `json:"account"`
	Quantity int    `json:"quantity" binding:"required,min=1"`
	AvgCost  float64 `json:"avg_cost" binding:"required,gt=0"`
}

type RecordTradeRequest struct {
	Symbol     string  `json:"symbol" binding:"required"`
	Name       string  `json:"name" binding:"required"`
	Exchange   string  `json:"exchange" binding:"required"`
	Account    string  `json:"account"`
	TradeType  string  `json:"trade_type" binding:"required,oneof=BUY SELL"`
	Quantity   int     `json:"quantity" binding:"required,min=1"`
	Price      float64 `json:"price" binding:"required,gt=0"`
	Commission float64 `json:"commission"`
	Notes      string  `json:"notes"`
}

type UpdateFundRequest struct {
	Account       string  `json:"account"`
	TotalCapital  float64 `json:"total_capital" binding:"min=0"`
	AvailableCash float64 `json:"available_cash" binding:"min=0"`
}

type PositionResponse struct {
	ID            string   `json:"id"`
	Symbol        string   `json:"symbol"`
	StockName     string   `json:"stock_name"`
	Exchange      string   `json:"exchange"`
	Account       string   `json:"account"`
	Quantity      int      `json:"quantity"`
	AvgCost       float64  `json:"avg_cost"`
	TotalCost     float64  `json:"total_cost"`
	CurrentPrice  *float64 `json:"current_price"`
	UnrealizedPnL *float64 `json:"unrealized_pnl"`
	RealizedPnL   float64  `json:"realized_pnl"`
	CreatedAt     string   `json:"created_at"`
	UpdatedAt     string   `json:"updated_at"`
}

type TradeExecutionResponse struct {
	ID            string  `json:"id"`
	Symbol        string  `json:"symbol"`
	StockName     string  `json:"stock_name"`
	Account       string  `json:"account"`
	TradeType     string  `json:"trade_type"`
	Quantity      int     `json:"quantity"`
	Price         float64 `json:"price"`
	TotalAmount   float64 `json:"total_amount"`
	Commission    float64 `json:"commission"`
	ExecutionType string  `json:"execution_type"`
	Notes         *string `json:"notes"`
	ExecutedAt    string  `json:"executed_at"`
}

type FundResponse struct {
	Account       string  `json:"account"`
	TotalCapital  float64 `json:"total_capital"`
	AvailableCash float64 `json:"available_cash"`
	PositionValue float64 `json:"position_value"`
	TotalAssets   float64 `json:"total_assets"`
}

type PortfolioSummary struct {
	Funds     []FundResponse     `json:"funds"`
	Positions []PositionResponse `json:"positions"`
}

type StockSearchResult struct {
	Symbol   string `json:"symbol"`
	Name     string `json:"name"`
	Exchange string `json:"exchange"`
}

// ============ 交易计划请求/响应类型 ============

type CreatePlanRequest struct {
	Symbol      string   `json:"symbol" binding:"required"`
	Name        string   `json:"name" binding:"required"`
	Exchange    string   `json:"exchange" binding:"required"`
	PlanType    string   `json:"plan_type" binding:"required,oneof=BUY SELL"`
	TargetPrice float64  `json:"target_price" binding:"required,gt=0"`
	StopLoss    *float64 `json:"stop_loss"`
	TakeProfit  *float64 `json:"take_profit"`
	Quantity    int      `json:"quantity" binding:"required,min=1"`
	Reasoning   string   `json:"reasoning"`
	Priority    string   `json:"priority"`
	AlertID     *string  `json:"alert_id"`
}

type UpdatePlanStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=ACTIVE EXECUTED CANCELLED EXPIRED"`
}

type PlanResponse struct {
	ID             string   `json:"id"`
	StockSymbol    string   `json:"stock_symbol"`
	StockName      string   `json:"stock_name"`
	PlanType       string   `json:"plan_type"`
	TargetPrice    float64  `json:"target_price"`
	StopLoss       *float64 `json:"stop_loss"`
	TakeProfit     *float64 `json:"take_profit"`
	Quantity       int      `json:"quantity"`
	Reasoning      *string  `json:"reasoning"`
	AIConfidence   *float64 `json:"ai_confidence"`
	Status         string   `json:"status"`
	Priority       string   `json:"priority"`
	ExpectedReturn *float64 `json:"expected_return"`
	MaxRisk        *float64 `json:"max_risk"`
	AlertID        *string  `json:"alert_id"`
	CreatedAt      string   `json:"created_at"`
	UpdatedAt      string   `json:"updated_at"`
	ExecutedAt     *string  `json:"executed_at"`
	ExpiresAt      *string  `json:"expires_at"`
}

// ============ 持仓管理 ============

func (s *TradingService) GetPositions(ctx context.Context, userID uuid.UUID, account string) ([]PositionResponse, error) {
	positions, err := s.tradingRepo.GetPositions(ctx, userID, account)
	if err != nil {
		return nil, err
	}

	result := make([]PositionResponse, len(positions))
	for i, p := range positions {
		result[i] = positionToResponse(&p)
	}
	return result, nil
}

func (s *TradingService) AddPosition(ctx context.Context, userID uuid.UUID, req *AddPositionRequest) (*PositionResponse, error) {
	stock, err := s.ensureStock(ctx, req.Symbol, req.Name, req.Exchange)
	if err != nil {
		return nil, err
	}

	existing, err := s.tradingRepo.GetPositionByStock(ctx, userID, stock.ID, req.Account)
	if err != nil {
		return nil, err
	}

	if existing != nil {
		totalQty := existing.Quantity + req.Quantity
		totalCost := existing.TotalCost + float64(req.Quantity)*req.AvgCost
		existing.Quantity = totalQty
		existing.AvgCost = roundTo4(totalCost / float64(totalQty))
		existing.TotalCost = roundTo2(totalCost)

		if err := s.tradingRepo.UpdatePosition(ctx, existing); err != nil {
			return nil, err
		}
		resp := positionToResponse(existing)
		return &resp, nil
	}

	position := &model.Position{
		UserID:    userID,
		StockID:   stock.ID,
		Account:   req.Account,
		Quantity:  req.Quantity,
		AvgCost:   req.AvgCost,
		TotalCost: roundTo2(float64(req.Quantity) * req.AvgCost),
	}

	if err := s.tradingRepo.CreatePosition(ctx, position); err != nil {
		return nil, err
	}

	position.Stock = *stock
	resp := positionToResponse(position)
	return &resp, nil
}

func (s *TradingService) DeletePosition(ctx context.Context, userID uuid.UUID, positionID uuid.UUID) error {
	return s.tradingRepo.DeletePosition(ctx, positionID, userID)
}

// ============ 交易记录 ============

func (s *TradingService) RecordTrade(ctx context.Context, userID uuid.UUID, req *RecordTradeRequest) (*TradeExecutionResponse, error) {
	stock, err := s.ensureStock(ctx, req.Symbol, req.Name, req.Exchange)
	if err != nil {
		return nil, err
	}

	totalAmount := roundTo2(float64(req.Quantity) * req.Price)

	var notes *string
	if req.Notes != "" {
		notes = &req.Notes
	}

	execution := &model.TradeExecution{
		UserID:        userID,
		StockID:       stock.ID,
		Account:       req.Account,
		TradeType:     req.TradeType,
		Quantity:      req.Quantity,
		Price:         req.Price,
		TotalAmount:   totalAmount,
		Commission:    req.Commission,
		ExecutionType: "MANUAL",
		Notes:         notes,
		ExecutedAt:    time.Now(),
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(execution).Error; err != nil {
			return err
		}

		if err := s.updatePositionAfterTrade(ctx, tx, userID, stock, req); err != nil {
			return err
		}

		if err := s.updateFundAfterTrade(ctx, tx, userID, req.Account, req.TradeType, totalAmount, req.Commission); err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	execution.Stock = *stock
	resp := tradeExecutionToResponse(execution)
	return &resp, nil
}

func (s *TradingService) GetTradeHistory(ctx context.Context, userID uuid.UUID, account string, limit, offset int) ([]TradeExecutionResponse, int64, error) {
	executions, total, err := s.tradingRepo.GetTradeExecutions(ctx, userID, account, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	result := make([]TradeExecutionResponse, len(executions))
	for i, e := range executions {
		result[i] = tradeExecutionToResponse(&e)
	}
	return result, total, nil
}

// ============ 资金管理 ============

func (s *TradingService) GetFund(ctx context.Context, userID uuid.UUID, account string) (*FundResponse, error) {
	fund, err := s.tradingRepo.EnsureAccountFund(ctx, userID, account)
	if err != nil {
		return nil, err
	}

	positions, err := s.tradingRepo.GetPositions(ctx, userID, account)
	if err != nil {
		return nil, err
	}

	positionValue := 0.0
	for _, p := range positions {
		positionValue += p.TotalCost
	}

	return &FundResponse{
		Account:       account,
		TotalCapital:  fund.TotalCapital,
		AvailableCash: fund.AvailableCash,
		PositionValue: roundTo2(positionValue),
		TotalAssets:   roundTo2(fund.AvailableCash + positionValue),
	}, nil
}

func (s *TradingService) UpdateFund(ctx context.Context, userID uuid.UUID, req *UpdateFundRequest) (*FundResponse, error) {
	_, err := s.tradingRepo.EnsureAccountFund(ctx, userID, req.Account)
	if err != nil {
		return nil, err
	}

	if err := s.tradingRepo.UpdateAccountFund(ctx, userID, req.Account, req.TotalCapital, req.AvailableCash); err != nil {
		return nil, err
	}

	return s.GetFund(ctx, userID, req.Account)
}

// GetAllFunds 获取所有账户的资金情况
func (s *TradingService) GetAllFunds(ctx context.Context, userID uuid.UUID) ([]FundResponse, error) {
	funds, err := s.tradingRepo.GetAllAccountFunds(ctx, userID)
	if err != nil {
		return nil, err
	}

	result := make([]FundResponse, len(funds))
	for i, f := range funds {
		positions, err := s.tradingRepo.GetPositions(ctx, userID, f.Account)
		if err != nil {
			return nil, err
		}
		positionValue := 0.0
		for _, p := range positions {
			positionValue += p.TotalCost
		}
		result[i] = FundResponse{
			Account:       f.Account,
			TotalCapital:  f.TotalCapital,
			AvailableCash: f.AvailableCash,
			PositionValue: roundTo2(positionValue),
			TotalAssets:   roundTo2(f.AvailableCash + positionValue),
		}
	}
	return result, nil
}

// ============ 组合概览 ============

func (s *TradingService) GetPortfolioSummary(ctx context.Context, userID uuid.UUID, account string) (*PortfolioSummary, error) {
	var funds []FundResponse

	if account != "" {
		fund, err := s.GetFund(ctx, userID, account)
		if err != nil {
			return nil, err
		}
		funds = []FundResponse{*fund}
	} else {
		var err error
		funds, err = s.GetAllFunds(ctx, userID)
		if err != nil {
			return nil, err
		}
	}

	positions, err := s.GetPositions(ctx, userID, account)
	if err != nil {
		return nil, err
	}

	return &PortfolioSummary{
		Funds:     funds,
		Positions: positions,
	}, nil
}

// ============ 交易计划管理 ============

func (s *TradingService) GetPlans(ctx context.Context, userID uuid.UUID, status string) ([]PlanResponse, error) {
	plans, err := s.tradingRepo.GetPlans(ctx, userID, status)
	if err != nil {
		return nil, err
	}

	result := make([]PlanResponse, len(plans))
	for i, p := range plans {
		result[i] = planToResponse(&p)
	}
	return result, nil
}

func (s *TradingService) GetPlanByID(ctx context.Context, userID uuid.UUID, planID uuid.UUID) (*PlanResponse, error) {
	plan, err := s.tradingRepo.GetPlanByID(ctx, planID, userID)
	if err != nil {
		return nil, err
	}
	if plan == nil {
		return nil, errors.New("plan not found")
	}
	resp := planToResponse(plan)
	return &resp, nil
}

func (s *TradingService) CreatePlan(ctx context.Context, userID uuid.UUID, req *CreatePlanRequest) (*PlanResponse, error) {
	stock, err := s.ensureStock(ctx, req.Symbol, req.Name, req.Exchange)
	if err != nil {
		return nil, err
	}

	priority := req.Priority
	if priority == "" {
		priority = "MEDIUM"
	}

	var reasoning *string
	if req.Reasoning != "" {
		reasoning = &req.Reasoning
	}

	var alertID *uuid.UUID
	if req.AlertID != nil && *req.AlertID != "" {
		parsed, err := uuid.Parse(*req.AlertID)
		if err == nil {
			alertID = &parsed
		}
	}

	plan := &model.TradingPlan{
		UserID:      userID,
		StockID:     stock.ID,
		AlertID:     alertID,
		PlanType:    req.PlanType,
		TargetPrice: req.TargetPrice,
		StopLoss:    req.StopLoss,
		TakeProfit:  req.TakeProfit,
		Quantity:    req.Quantity,
		Reasoning:   reasoning,
		Status:      "ACTIVE",
		Priority:    priority,
	}

	if err := s.tradingRepo.CreatePlan(ctx, plan); err != nil {
		return nil, err
	}

	plan.Stock = *stock
	resp := planToResponse(plan)
	return &resp, nil
}

func (s *TradingService) UpdatePlanStatus(ctx context.Context, userID uuid.UUID, planID uuid.UUID, status string) (*PlanResponse, error) {
	plan, err := s.tradingRepo.GetPlanByID(ctx, planID, userID)
	if err != nil {
		return nil, err
	}
	if plan == nil {
		return nil, errors.New("plan not found")
	}

	plan.Status = status
	if status == "EXECUTED" {
		now := time.Now()
		plan.ExecutedAt = &now
	}

	if err := s.tradingRepo.UpdatePlan(ctx, plan); err != nil {
		return nil, err
	}

	resp := planToResponse(plan)
	return &resp, nil
}

func (s *TradingService) GetPlansBySymbol(ctx context.Context, userID uuid.UUID, symbol string) ([]PlanResponse, error) {
	plans, err := s.tradingRepo.GetPlansBySymbol(ctx, userID, symbol)
	if err != nil {
		return nil, err
	}
	result := make([]PlanResponse, len(plans))
	for i, p := range plans {
		result[i] = planToResponse(&p)
	}
	return result, nil
}

// CreatePlanFromSignal 从策略信号自动创建交易计划（供 StrategyService 调用）
func (s *TradingService) CreatePlanFromSignal(ctx context.Context, userID uuid.UUID, stockSymbol, stockName, alertType string, alertID uuid.UUID, targetPrice float64) error {
	stock, err := s.ensureStock(ctx, stockSymbol, stockName, "")
	if err != nil {
		return fmt.Errorf("ensure stock failed: %w", err)
	}

	planType := "BUY"
	if alertType == "SELL_SIGNAL" {
		planType = "SELL"
	}

	// 查找持仓来决定默认数量
	quantity := 100 // 默认 100 股
	positions, _ := s.tradingRepo.GetPositions(ctx, userID, "")
	for _, pos := range positions {
		if pos.Stock.Symbol == stockSymbol {
			if planType == "SELL" {
				quantity = pos.Quantity // 卖出时默认全部持仓
			}
			break
		}
	}

	// 计算止损止盈
	var stopLoss, takeProfit *float64
	if planType == "BUY" {
		sl := roundTo4(targetPrice * 0.92)  // 止损 -8%
		tp := roundTo4(targetPrice * 1.15)   // 止盈 +15%
		stopLoss = &sl
		takeProfit = &tp
	} else {
		sl := roundTo4(targetPrice * 1.05)   // 卖出止损（反弹5%取消）
		stopLoss = &sl
	}

	reasoning := fmt.Sprintf("策略信号自动生成: %s", alertType)

	plan := &model.TradingPlan{
		UserID:      userID,
		StockID:     stock.ID,
		AlertID:     &alertID,
		PlanType:    planType,
		TargetPrice: targetPrice,
		StopLoss:    stopLoss,
		TakeProfit:  takeProfit,
		Quantity:    quantity,
		Reasoning:   &reasoning,
		Status:      "ACTIVE",
		Priority:    "HIGH",
	}

	return s.tradingRepo.CreatePlan(ctx, plan)
}

// ============ 股票搜索 ============

func (s *TradingService) SearchStocks(ctx context.Context, query string, limit int) ([]StockSearchResult, error) {
	if limit <= 0 || limit > 20 {
		limit = 10
	}

	stocks, err := s.tradingRepo.SearchStocks(ctx, query, limit)
	if err != nil {
		return nil, err
	}

	result := make([]StockSearchResult, len(stocks))
	for i, st := range stocks {
		result[i] = StockSearchResult{
			Symbol:   st.Symbol,
			Name:     st.Name,
			Exchange: st.Exchange,
		}
	}
	return result, nil
}

// ============ 内部方法 ============

func (s *TradingService) ensureStock(ctx context.Context, symbol, name, exchange string) (*model.Stock, error) {
	stock, err := s.tradingRepo.GetStockBySymbol(ctx, symbol)
	if err != nil {
		return nil, err
	}
	if stock != nil {
		return stock, nil
	}

	newStock := &model.Stock{
		Symbol:   symbol,
		Name:     name,
		Exchange: exchange,
		IsActive: true,
	}
	if err := s.tradingRepo.CreateStock(ctx, newStock); err != nil {
		return nil, err
	}
	return newStock, nil
}

func (s *TradingService) updatePositionAfterTrade(ctx context.Context, tx *gorm.DB, userID uuid.UUID, stock *model.Stock, req *RecordTradeRequest) error {
	var position model.Position
	err := tx.First(&position, "user_id = ? AND stock_id = ? AND account = ?", userID, stock.ID, req.Account).Error

	if req.TradeType == "BUY" {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			position = model.Position{
				UserID:    userID,
				StockID:   stock.ID,
				Account:   req.Account,
				Quantity:  req.Quantity,
				AvgCost:   req.Price,
				TotalCost: roundTo2(float64(req.Quantity) * req.Price),
			}
			return tx.Create(&position).Error
		} else if err != nil {
			return err
		}

		totalQty := position.Quantity + req.Quantity
		totalCost := position.TotalCost + float64(req.Quantity)*req.Price
		position.Quantity = totalQty
		position.AvgCost = roundTo4(totalCost / float64(totalQty))
		position.TotalCost = roundTo2(totalCost)
		return tx.Save(&position).Error

	} else {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("no position found for this stock")
		} else if err != nil {
			return err
		}

		if req.Quantity > position.Quantity {
			return errors.New("insufficient position quantity")
		}

		realizedPnL := float64(req.Quantity) * (req.Price - position.AvgCost)
		position.RealizedPnL += roundTo2(realizedPnL)
		position.Quantity -= req.Quantity
		position.TotalCost = roundTo2(float64(position.Quantity) * position.AvgCost)

		if position.Quantity == 0 {
			return tx.Delete(&position).Error
		}
		return tx.Save(&position).Error
	}
}

func (s *TradingService) updateFundAfterTrade(ctx context.Context, tx *gorm.DB, userID uuid.UUID, account, tradeType string, totalAmount, commission float64) error {
	var fund model.AccountFund
	if err := tx.First(&fund, "user_id = ? AND account = ?", userID, account).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}

	if tradeType == "BUY" {
		fund.AvailableCash -= (totalAmount + commission)
	} else {
		fund.AvailableCash += (totalAmount - commission)
	}

	return tx.Save(&fund).Error
}

// ============ 辅助函数 ============

func positionToResponse(p *model.Position) PositionResponse {
	return PositionResponse{
		ID:            p.ID.String(),
		Symbol:        p.Stock.Symbol,
		StockName:     p.Stock.Name,
		Exchange:      p.Stock.Exchange,
		Account:       p.Account,
		Quantity:      p.Quantity,
		AvgCost:       p.AvgCost,
		TotalCost:     p.TotalCost,
		CurrentPrice:  p.CurrentPrice,
		UnrealizedPnL: p.UnrealizedPnL,
		RealizedPnL:   p.RealizedPnL,
		CreatedAt:     p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:     p.UpdatedAt.Format(time.RFC3339),
	}
}

func tradeExecutionToResponse(e *model.TradeExecution) TradeExecutionResponse {
	return TradeExecutionResponse{
		ID:            e.ID.String(),
		Symbol:        e.Stock.Symbol,
		StockName:     e.Stock.Name,
		Account:       e.Account,
		TradeType:     e.TradeType,
		Quantity:      e.Quantity,
		Price:         e.Price,
		TotalAmount:   e.TotalAmount,
		Commission:    e.Commission,
		ExecutionType: e.ExecutionType,
		Notes:         e.Notes,
		ExecutedAt:    e.ExecutedAt.Format(time.RFC3339),
	}
}

func planToResponse(p *model.TradingPlan) PlanResponse {
	resp := PlanResponse{
		ID:             p.ID.String(),
		StockSymbol:    p.Stock.Symbol,
		StockName:      p.Stock.Name,
		PlanType:       p.PlanType,
		TargetPrice:    p.TargetPrice,
		StopLoss:       p.StopLoss,
		TakeProfit:     p.TakeProfit,
		Quantity:       p.Quantity,
		Reasoning:      p.Reasoning,
		AIConfidence:   p.AIConfidence,
		Status:         p.Status,
		Priority:       p.Priority,
		ExpectedReturn: p.ExpectedReturn,
		MaxRisk:        p.MaxRisk,
		CreatedAt:      p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      p.UpdatedAt.Format(time.RFC3339),
	}
	if p.AlertID != nil {
		s := p.AlertID.String()
		resp.AlertID = &s
	}
	if p.ExecutedAt != nil {
		s := p.ExecutedAt.Format(time.RFC3339)
		resp.ExecutedAt = &s
	}
	if p.ExpiresAt != nil {
		s := p.ExpiresAt.Format(time.RFC3339)
		resp.ExpiresAt = &s
	}
	return resp
}

func roundTo2(v float64) float64 {
	return math.Round(v*100) / 100
}

func roundTo4(v float64) float64 {
	return math.Round(v*10000) / 10000
}
