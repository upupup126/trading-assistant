package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TradingStrategy 用户交易策略模型
type TradingStrategy struct {
	ID                 uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID             uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index"`
	StockSymbol        string    `json:"stock_symbol" gorm:"not null;size:20;index"`
	StockName          string    `json:"stock_name" gorm:"not null;size:100"`
	Name               string    `json:"name" gorm:"not null;size:200"`
	StrategyType       string    `json:"strategy_type" gorm:"not null;size:20"` // SHORT, MID, LONG
	BuiltinStrategyIDs string    `json:"builtin_strategy_ids" gorm:"type:jsonb;default:'[]'"`
	CustomRules        string    `json:"custom_rules" gorm:"type:jsonb;default:'[]'"`
	AlertEnabled       bool      `json:"alert_enabled" gorm:"default:true"`
	Status             string    `json:"status" gorm:"default:'ACTIVE';size:20"` // ACTIVE, PAUSED, EXPIRED
	Notes              *string   `json:"notes"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`

	// 关联
	User           User            `json:"user,omitempty" gorm:"foreignKey:UserID"`
	StrategyAlerts []StrategyAlert `json:"strategy_alerts,omitempty" gorm:"foreignKey:StrategyID"`
}

// StrategyAlert 策略提醒记录模型
type StrategyAlert struct {
	ID                uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	StrategyID        uuid.UUID `json:"strategy_id" gorm:"type:uuid;not null;index"`
	UserID            uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index"`
	StockSymbol       string    `json:"stock_symbol" gorm:"not null;size:20"`
	AlertType         string    `json:"alert_type" gorm:"not null;size:20"` // BUY_SIGNAL, SELL_SIGNAL
	TriggeredStrategy *string   `json:"triggered_strategy" gorm:"size:50"`
	Message           string    `json:"message" gorm:"not null"`
	Details           *string   `json:"details" gorm:"type:jsonb"`
	IsRead            bool      `json:"is_read" gorm:"default:false;index"`
	CreatedAt         time.Time `json:"created_at"`

	// 关联
	Strategy TradingStrategy `json:"strategy,omitempty" gorm:"foreignKey:StrategyID"`
	User     User            `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

// BacktestResult 回测结果缓存模型
type BacktestResult struct {
	ID             uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	StockSymbol    string    `json:"stock_symbol" gorm:"not null;size:20;uniqueIndex:idx_backtest_symbol_hash"`
	StrategyConfig string    `json:"strategy_config" gorm:"type:jsonb;not null"`
	ConfigHash     string    `json:"config_hash" gorm:"not null;size:64;uniqueIndex:idx_backtest_symbol_hash"`
	ResultData     string    `json:"result_data" gorm:"type:jsonb;not null"`
	CreatedAt      time.Time `json:"created_at"`
}

// BeforeCreate GORM钩子
func (ts *TradingStrategy) BeforeCreate(tx *gorm.DB) error {
	if ts.ID == uuid.Nil {
		ts.ID = uuid.New()
	}
	return nil
}

func (sa *StrategyAlert) BeforeCreate(tx *gorm.DB) error {
	if sa.ID == uuid.Nil {
		sa.ID = uuid.New()
	}
	return nil
}

func (br *BacktestResult) BeforeCreate(tx *gorm.DB) error {
	if br.ID == uuid.Nil {
		br.ID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (TradingStrategy) TableName() string {
	return "trading_strategies"
}

func (StrategyAlert) TableName() string {
	return "strategy_alerts"
}

func (BacktestResult) TableName() string {
	return "backtest_results"
}
