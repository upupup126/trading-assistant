package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"trading-assistant/go-service/internal/model"
)

type StrategyRepository interface {
	// 策略 CRUD
	GetStrategies(ctx context.Context, userID uuid.UUID) ([]model.TradingStrategy, error)
	GetStrategyByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*model.TradingStrategy, error)
	CreateStrategy(ctx context.Context, strategy *model.TradingStrategy) error
	UpdateStrategy(ctx context.Context, strategy *model.TradingStrategy) error
	DeleteStrategy(ctx context.Context, id uuid.UUID, userID uuid.UUID) error

	// 获取所有活跃策略（定时任务用）
	GetAllActiveStrategies(ctx context.Context) ([]model.TradingStrategy, error)

	// 策略提醒
	GetAlerts(ctx context.Context, userID uuid.UUID, unreadOnly bool, limit, offset int) ([]model.StrategyAlert, int64, error)
	CreateAlert(ctx context.Context, alert *model.StrategyAlert) error
	MarkAlertRead(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
	MarkAllAlertsRead(ctx context.Context, userID uuid.UUID) error
	GetUnreadAlertCount(ctx context.Context, userID uuid.UUID) (int64, error)

	// 通知静音
	MuteAlert(ctx context.Context, mute *model.AlertMute) error
	UnmuteAlert(ctx context.Context, userID uuid.UUID, stockSymbol, alertType, muteDate string) error
	IsMuted(ctx context.Context, userID uuid.UUID, stockSymbol, alertType, muteDate string) (bool, error)
	GetMutedAlerts(ctx context.Context, userID uuid.UUID, muteDate string) ([]model.AlertMute, error)

	// 回测结果缓存
	GetBacktestResult(ctx context.Context, symbol string, configHash string) (*model.BacktestResult, error)
	SaveBacktestResult(ctx context.Context, result *model.BacktestResult) error
}

type strategyRepository struct {
	db *gorm.DB
}

func NewStrategyRepository(db *gorm.DB) StrategyRepository {
	return &strategyRepository{db: db}
}

// ============ 策略 CRUD ============

func (r *strategyRepository) GetStrategies(ctx context.Context, userID uuid.UUID) ([]model.TradingStrategy, error) {
	var strategies []model.TradingStrategy
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&strategies).Error
	return strategies, err
}

func (r *strategyRepository) GetStrategyByID(ctx context.Context, id uuid.UUID, userID uuid.UUID) (*model.TradingStrategy, error) {
	var strategy model.TradingStrategy
	err := r.db.WithContext(ctx).
		First(&strategy, "id = ? AND user_id = ?", id, userID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &strategy, nil
}

func (r *strategyRepository) CreateStrategy(ctx context.Context, strategy *model.TradingStrategy) error {
	return r.db.WithContext(ctx).Create(strategy).Error
}

func (r *strategyRepository) UpdateStrategy(ctx context.Context, strategy *model.TradingStrategy) error {
	return r.db.WithContext(ctx).Save(strategy).Error
}

func (r *strategyRepository) DeleteStrategy(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", id, userID).
		Delete(&model.TradingStrategy{}).Error
}

func (r *strategyRepository) GetAllActiveStrategies(ctx context.Context) ([]model.TradingStrategy, error) {
	var strategies []model.TradingStrategy
	err := r.db.WithContext(ctx).
		Where("status = ? AND alert_enabled = ?", "ACTIVE", true).
		Find(&strategies).Error
	return strategies, err
}

// ============ 策略提醒 ============

func (r *strategyRepository) GetAlerts(ctx context.Context, userID uuid.UUID, unreadOnly bool, limit, offset int) ([]model.StrategyAlert, int64, error) {
	var alerts []model.StrategyAlert
	var total int64

	query := r.db.WithContext(ctx).Model(&model.StrategyAlert{}).Where("user_id = ?", userID)
	if unreadOnly {
		query = query.Where("is_read = ?", false)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Scopes(func(db *gorm.DB) *gorm.DB {
			if unreadOnly {
				return db.Where("is_read = ?", false)
			}
			return db
		}).
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&alerts).Error

	return alerts, total, err
}

func (r *strategyRepository) CreateAlert(ctx context.Context, alert *model.StrategyAlert) error {
	return r.db.WithContext(ctx).Create(alert).Error
}

func (r *strategyRepository) MarkAlertRead(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&model.StrategyAlert{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_read", true).Error
}

func (r *strategyRepository) MarkAllAlertsRead(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&model.StrategyAlert{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Update("is_read", true).Error
}

func (r *strategyRepository) GetUnreadAlertCount(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&model.StrategyAlert{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Count(&count).Error
	return count, err
}

// ============ 通知静音 ============

func (r *strategyRepository) MuteAlert(ctx context.Context, mute *model.AlertMute) error {
	return r.db.WithContext(ctx).
		Where("user_id = ? AND stock_symbol = ? AND alert_type = ? AND mute_date = ?",
			mute.UserID, mute.StockSymbol, mute.AlertType, mute.MuteDate).
		FirstOrCreate(mute).Error
}

func (r *strategyRepository) UnmuteAlert(ctx context.Context, userID uuid.UUID, stockSymbol, alertType, muteDate string) error {
	return r.db.WithContext(ctx).
		Where("user_id = ? AND stock_symbol = ? AND alert_type = ? AND mute_date = ?",
			userID, stockSymbol, alertType, muteDate).
		Delete(&model.AlertMute{}).Error
}

func (r *strategyRepository) IsMuted(ctx context.Context, userID uuid.UUID, stockSymbol, alertType, muteDate string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&model.AlertMute{}).
		Where("user_id = ? AND stock_symbol = ? AND alert_type = ? AND mute_date = ?",
			userID, stockSymbol, alertType, muteDate).
		Count(&count).Error
	return count > 0, err
}

func (r *strategyRepository) GetMutedAlerts(ctx context.Context, userID uuid.UUID, muteDate string) ([]model.AlertMute, error) {
	var mutes []model.AlertMute
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND mute_date = ?", userID, muteDate).
		Find(&mutes).Error
	return mutes, err
}

// ============ 回测结果缓存 ============

func (r *strategyRepository) GetBacktestResult(ctx context.Context, symbol string, configHash string) (*model.BacktestResult, error) {
	var result model.BacktestResult
	err := r.db.WithContext(ctx).
		First(&result, "stock_symbol = ? AND config_hash = ?", symbol, configHash).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &result, nil
}

func (r *strategyRepository) SaveBacktestResult(ctx context.Context, result *model.BacktestResult) error {
	return r.db.WithContext(ctx).
		Where("stock_symbol = ? AND config_hash = ?", result.StockSymbol, result.ConfigHash).
		Assign(model.BacktestResult{
			StrategyConfig: result.StrategyConfig,
			ResultData:     result.ResultData,
		}).
		FirstOrCreate(result).Error
}
