package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"trading-assistant/go-service/internal/model"
)

type TradingRepository interface {
	// 持仓
	GetPositions(ctx context.Context, userID uuid.UUID, account string) ([]model.Position, error)
	GetPositionByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*model.Position, error)
	GetPositionByStock(ctx context.Context, userID uuid.UUID, stockID uuid.UUID, account string) (*model.Position, error)
	CreatePosition(ctx context.Context, position *model.Position) error
	UpdatePosition(ctx context.Context, position *model.Position) error
	DeletePosition(ctx context.Context, id uuid.UUID, userID uuid.UUID) error

	// 交易记录
	GetTradeExecutions(ctx context.Context, userID uuid.UUID, account string, limit, offset int) ([]model.TradeExecution, int64, error)
	CreateTradeExecution(ctx context.Context, execution *model.TradeExecution) error

	// 股票
	GetStockBySymbol(ctx context.Context, symbol string) (*model.Stock, error)
	CreateStock(ctx context.Context, stock *model.Stock) error
	SearchStocks(ctx context.Context, query string, limit int) ([]model.Stock, error)

	// 账户资金
	GetAccountFund(ctx context.Context, userID uuid.UUID, account string) (*model.AccountFund, error)
	UpdateAccountFund(ctx context.Context, userID uuid.UUID, account string, totalCapital, availableCash float64) error
	EnsureAccountFund(ctx context.Context, userID uuid.UUID, account string) (*model.AccountFund, error)
	GetAllAccountFunds(ctx context.Context, userID uuid.UUID) ([]model.AccountFund, error)

	// 兼容旧资金（UserSettings）
	GetUserSettings(ctx context.Context, userID uuid.UUID) (*model.UserSettings, error)
	EnsureUserSettings(ctx context.Context, userID uuid.UUID) (*model.UserSettings, error)
}

type tradingRepository struct {
	db *gorm.DB
}

func NewTradingRepository(db *gorm.DB) TradingRepository {
	return &tradingRepository{db: db}
}

// ============ 持仓 ============

func (r *tradingRepository) GetPositions(ctx context.Context, userID uuid.UUID, account string) ([]model.Position, error) {
	var positions []model.Position
	query := r.db.WithContext(ctx).
		Preload("Stock").
		Where("user_id = ? AND quantity > 0", userID)

	if account != "" {
		query = query.Where("account = ?", account)
	}

	err := query.Order("updated_at DESC").Find(&positions).Error
	return positions, err
}

func (r *tradingRepository) GetPositionByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*model.Position, error) {
	var position model.Position
	err := r.db.WithContext(ctx).
		Preload("Stock").
		First(&position, "id = ? AND user_id = ?", id, userID).Error
	if err != nil {
		return nil, err
	}
	return &position, nil
}

func (r *tradingRepository) GetPositionByStock(ctx context.Context, userID uuid.UUID, stockID uuid.UUID, account string) (*model.Position, error) {
	var position model.Position
	err := r.db.WithContext(ctx).
		Preload("Stock").
		First(&position, "user_id = ? AND stock_id = ? AND account = ?", userID, stockID, account).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &position, nil
}

func (r *tradingRepository) CreatePosition(ctx context.Context, position *model.Position) error {
	return r.db.WithContext(ctx).Create(position).Error
}

func (r *tradingRepository) UpdatePosition(ctx context.Context, position *model.Position) error {
	return r.db.WithContext(ctx).Save(position).Error
}

func (r *tradingRepository) DeletePosition(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&model.Position{}).Error
}

// ============ 交易记录 ============

func (r *tradingRepository) GetTradeExecutions(ctx context.Context, userID uuid.UUID, account string, limit, offset int) ([]model.TradeExecution, int64, error) {
	var executions []model.TradeExecution
	var total int64

	countQuery := r.db.WithContext(ctx).
		Model(&model.TradeExecution{}).
		Where("user_id = ?", userID)
	if account != "" {
		countQuery = countQuery.Where("account = ?", account)
	}
	if err := countQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	dataQuery := r.db.WithContext(ctx).
		Preload("Stock").
		Where("user_id = ?", userID)
	if account != "" {
		dataQuery = dataQuery.Where("account = ?", account)
	}

	err := dataQuery.
		Order("executed_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&executions).Error

	return executions, total, err
}

func (r *tradingRepository) CreateTradeExecution(ctx context.Context, execution *model.TradeExecution) error {
	return r.db.WithContext(ctx).Create(execution).Error
}

// ============ 股票 ============

func (r *tradingRepository) GetStockBySymbol(ctx context.Context, symbol string) (*model.Stock, error) {
	var stock model.Stock
	err := r.db.WithContext(ctx).First(&stock, "symbol = ?", symbol).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &stock, nil
}

func (r *tradingRepository) CreateStock(ctx context.Context, stock *model.Stock) error {
	return r.db.WithContext(ctx).Create(stock).Error
}

func (r *tradingRepository) SearchStocks(ctx context.Context, query string, limit int) ([]model.Stock, error) {
	var stocks []model.Stock
	err := r.db.WithContext(ctx).
		Where("symbol ILIKE ? OR name ILIKE ?", "%"+query+"%", "%"+query+"%").
		Where("is_active = true").
		Limit(limit).
		Find(&stocks).Error
	return stocks, err
}

// ============ 账户资金 ============

func (r *tradingRepository) GetAccountFund(ctx context.Context, userID uuid.UUID, account string) (*model.AccountFund, error) {
	var fund model.AccountFund
	err := r.db.WithContext(ctx).First(&fund, "user_id = ? AND account = ?", userID, account).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &fund, nil
}

func (r *tradingRepository) UpdateAccountFund(ctx context.Context, userID uuid.UUID, account string, totalCapital, availableCash float64) error {
	return r.db.WithContext(ctx).
		Model(&model.AccountFund{}).
		Where("user_id = ? AND account = ?", userID, account).
		Updates(map[string]interface{}{
			"total_capital":  totalCapital,
			"available_cash": availableCash,
		}).Error
}

func (r *tradingRepository) EnsureAccountFund(ctx context.Context, userID uuid.UUID, account string) (*model.AccountFund, error) {
	fund, err := r.GetAccountFund(ctx, userID, account)
	if err != nil {
		return nil, err
	}
	if fund != nil {
		return fund, nil
	}

	newFund := &model.AccountFund{
		ID:      uuid.New(),
		UserID:  userID,
		Account: account,
	}
	if err := r.db.WithContext(ctx).Create(newFund).Error; err != nil {
		return nil, err
	}
	return newFund, nil
}

func (r *tradingRepository) GetAllAccountFunds(ctx context.Context, userID uuid.UUID) ([]model.AccountFund, error) {
	var funds []model.AccountFund
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("account ASC").
		Find(&funds).Error
	return funds, err
}

// ============ 兼容旧资金（UserSettings） ============

func (r *tradingRepository) GetUserSettings(ctx context.Context, userID uuid.UUID) (*model.UserSettings, error) {
	var settings model.UserSettings
	err := r.db.WithContext(ctx).First(&settings, "user_id = ?", userID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &settings, nil
}

func (r *tradingRepository) EnsureUserSettings(ctx context.Context, userID uuid.UUID) (*model.UserSettings, error) {
	settings, err := r.GetUserSettings(ctx, userID)
	if err != nil {
		return nil, err
	}
	if settings != nil {
		return settings, nil
	}

	newSettings := &model.UserSettings{
		ID:     uuid.New(),
		UserID: userID,
	}
	if err := r.db.WithContext(ctx).Create(newSettings).Error; err != nil {
		return nil, err
	}
	return newSettings, nil
}
