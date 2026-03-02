package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TradingPlan 交易计划模型
type TradingPlan struct {
	ID             uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID         uuid.UUID  `json:"user_id" gorm:"type:uuid;not null"`
	StockID        uuid.UUID  `json:"stock_id" gorm:"type:uuid;not null"`
	AlertID        *uuid.UUID `json:"alert_id" gorm:"type:uuid"`
	PlanType       string     `json:"plan_type" gorm:"not null;size:20"` // BUY, SELL
	TargetPrice    float64    `json:"target_price" gorm:"type:decimal(10,4);not null"`
	StopLoss       *float64   `json:"stop_loss" gorm:"type:decimal(10,4)"`
	TakeProfit     *float64   `json:"take_profit" gorm:"type:decimal(10,4)"`
	Quantity       int        `json:"quantity" gorm:"not null"`
	Reasoning      *string    `json:"reasoning"`
	AIConfidence   *float64   `json:"ai_confidence" gorm:"type:decimal(3,2)"`
	Status         string     `json:"status" gorm:"default:'ACTIVE';size:20"` // ACTIVE, EXECUTED, CANCELLED, EXPIRED
	Priority       string     `json:"priority" gorm:"default:'MEDIUM';size:20"` // LOW, MEDIUM, HIGH
	ExpectedReturn *float64   `json:"expected_return" gorm:"type:decimal(5,2)"`
	MaxRisk        *float64   `json:"max_risk" gorm:"type:decimal(5,2)"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	ExecutedAt     *time.Time `json:"executed_at"`
	ExpiresAt      *time.Time `json:"expires_at"`

	// 关联
	User            User             `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Stock           Stock            `json:"stock,omitempty" gorm:"foreignKey:StockID"`
	TradeExecutions []TradeExecution `json:"trade_executions,omitempty" gorm:"foreignKey:TradingPlanID"`
}

// TradeExecution 交易执行记录模型
type TradeExecution struct {
	ID              uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID          uuid.UUID  `json:"user_id" gorm:"type:uuid;not null"`
	TradingPlanID   *uuid.UUID `json:"trading_plan_id" gorm:"type:uuid"`
	StockID         uuid.UUID  `json:"stock_id" gorm:"type:uuid;not null"`
	Account         string     `json:"account" gorm:"size:50;default:'';index"`
	TradeType       string     `json:"trade_type" gorm:"not null;size:20"` // BUY, SELL
	Quantity        int        `json:"quantity" gorm:"not null"`
	Price           float64    `json:"price" gorm:"type:decimal(10,4);not null"`
	TotalAmount     float64    `json:"total_amount" gorm:"type:decimal(12,2);not null"`
	Commission      float64    `json:"commission" gorm:"type:decimal(8,2);default:0"`
	ExecutionType   string     `json:"execution_type" gorm:"default:'MANUAL';size:20"` // MANUAL, AUTO, AI_SUGGESTED
	Notes           *string    `json:"notes"`
	ExecutedAt      time.Time  `json:"executed_at" gorm:"default:CURRENT_TIMESTAMP"`

	// 关联
	User        User         `json:"user,omitempty" gorm:"foreignKey:UserID"`
	TradingPlan *TradingPlan `json:"trading_plan,omitempty" gorm:"foreignKey:TradingPlanID"`
	Stock       Stock        `json:"stock,omitempty" gorm:"foreignKey:StockID"`
	Journal     *TradingJournal `json:"journal,omitempty" gorm:"foreignKey:TradeExecutionID"`
}

// Position 持仓模型
type Position struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID        uuid.UUID `json:"user_id" gorm:"type:uuid;not null;uniqueIndex:idx_positions_user_stock_account"`
	StockID       uuid.UUID `json:"stock_id" gorm:"type:uuid;not null;uniqueIndex:idx_positions_user_stock_account"`
	Account       string    `json:"account" gorm:"size:50;default:'';uniqueIndex:idx_positions_user_stock_account"`
	Quantity      int       `json:"quantity" gorm:"not null"`
	AvgCost       float64   `json:"avg_cost" gorm:"type:decimal(10,4);not null"`
	TotalCost     float64   `json:"total_cost" gorm:"type:decimal(12,2);not null"`
	CurrentPrice  *float64  `json:"current_price" gorm:"type:decimal(10,4)"`
	UnrealizedPnL *float64  `json:"unrealized_pnl" gorm:"type:decimal(12,2)"`
	RealizedPnL   float64   `json:"realized_pnl" gorm:"type:decimal(12,2);default:0"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	// 关联
	User  User  `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Stock Stock `json:"stock,omitempty" gorm:"foreignKey:StockID"`
}

// AccountFund 账户资金模型（每个用户每个账户独立的资金记录）
type AccountFund struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID        uuid.UUID `json:"user_id" gorm:"type:uuid;not null"`
	Account       string    `json:"account" gorm:"size:50;not null"`
	TotalCapital  float64   `json:"total_capital" gorm:"type:decimal(14,2);default:0"`
	AvailableCash float64   `json:"available_cash" gorm:"type:decimal(14,2);default:0"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	// 关联
	User *User `json:"-" gorm:"foreignKey:UserID"`
}

// TradingJournal 交易日志模型（复盘分析）
type TradingJournal struct {
	ID                uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID            uuid.UUID  `json:"user_id" gorm:"type:uuid;not null"`
	TradeExecutionID  *uuid.UUID `json:"trade_execution_id" gorm:"type:uuid"`
	EntryReason       *string    `json:"entry_reason"`
	ExitReason        *string    `json:"exit_reason"`
	EmotionsBefore    *string    `json:"emotions_before"`
	EmotionsAfter     *string    `json:"emotions_after"`
	LessonsLearned    *string    `json:"lessons_learned"`
	PerformanceRating *int       `json:"performance_rating"` // 1-5
	AIAnalysis        *string    `json:"ai_analysis" gorm:"type:jsonb"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`

	// 关联
	User           User            `json:"user,omitempty" gorm:"foreignKey:UserID"`
	TradeExecution *TradeExecution `json:"trade_execution,omitempty" gorm:"foreignKey:TradeExecutionID"`
}

// BeforeCreate GORM钩子
func (tp *TradingPlan) BeforeCreate(tx *gorm.DB) error {
	if tp.ID == uuid.Nil {
		tp.ID = uuid.New()
	}
	return nil
}

func (te *TradeExecution) BeforeCreate(tx *gorm.DB) error {
	if te.ID == uuid.Nil {
		te.ID = uuid.New()
	}
	return nil
}

func (p *Position) BeforeCreate(tx *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}

func (af *AccountFund) BeforeCreate(tx *gorm.DB) error {
	if af.ID == uuid.Nil {
		af.ID = uuid.New()
	}
	return nil
}

func (tj *TradingJournal) BeforeCreate(tx *gorm.DB) error {
	if tj.ID == uuid.Nil {
		tj.ID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (TradingPlan) TableName() string {
	return "trading_plans"
}

func (TradeExecution) TableName() string {
	return "trade_executions"
}

func (Position) TableName() string {
	return "positions"
}

func (AccountFund) TableName() string {
	return "account_funds"
}

func (TradingJournal) TableName() string {
	return "trading_journals"
}