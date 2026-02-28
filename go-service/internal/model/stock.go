package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Stock 股票信息模型
type Stock struct {
	ID        uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	Symbol    string         `json:"symbol" gorm:"uniqueIndex;not null;size:20"`
	Name      string         `json:"name" gorm:"not null;size:100"`
	Exchange  string         `json:"exchange" gorm:"not null;size:20"`
	Sector    *string        `json:"sector" gorm:"size:50"`
	MarketCap *int64         `json:"market_cap"`
	IsActive  bool           `json:"is_active" gorm:"default:true"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联
	TradingPlans   []TradingPlan   `json:"trading_plans,omitempty" gorm:"foreignKey:StockID"`
	TradeExecutions []TradeExecution `json:"trade_executions,omitempty" gorm:"foreignKey:StockID"`
	Positions      []Position      `json:"positions,omitempty" gorm:"foreignKey:StockID"`
	MarketData     []MarketData    `json:"market_data,omitempty" gorm:"foreignKey:StockID"`
	SmartAlerts    []SmartAlert    `json:"smart_alerts,omitempty" gorm:"foreignKey:StockID"`
}

// MarketData 市场数据模型
type MarketData struct {
	ID            uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	StockID       uuid.UUID `json:"stock_id" gorm:"type:uuid;not null"`
	Price         float64   `json:"price" gorm:"type:decimal(10,4);not null"`
	Volume        *int64    `json:"volume"`
	ChangeAmount  *float64  `json:"change_amount" gorm:"type:decimal(10,4)"`
	ChangePercent *float64  `json:"change_percent" gorm:"type:decimal(5,2)"`
	High          *float64  `json:"high" gorm:"type:decimal(10,4)"`
	Low           *float64  `json:"low" gorm:"type:decimal(10,4)"`
	Open          *float64  `json:"open" gorm:"type:decimal(10,4)"`
	PreviousClose *float64  `json:"previous_close" gorm:"type:decimal(10,4)"`
	MarketCap     *int64    `json:"market_cap"`
	DataSource    *string   `json:"data_source" gorm:"size:50"`
	Timestamp     time.Time `json:"timestamp" gorm:"default:CURRENT_TIMESTAMP"`

	// 关联
	Stock Stock `json:"stock,omitempty" gorm:"foreignKey:StockID"`
}

// UserWatchlist 用户关注股票模型
type UserWatchlist struct {
	ID        uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID    uuid.UUID `json:"user_id" gorm:"type:uuid;not null"`
	StockID   uuid.UUID `json:"stock_id" gorm:"type:uuid;not null"`
	Notes     *string   `json:"notes"`
	CreatedAt time.Time `json:"created_at"`

	// 关联
	User  User  `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Stock Stock `json:"stock,omitempty" gorm:"foreignKey:StockID"`
}

// BeforeCreate GORM钩子
func (s *Stock) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}

func (md *MarketData) BeforeCreate(tx *gorm.DB) error {
	if md.ID == uuid.Nil {
		md.ID = uuid.New()
	}
	return nil
}

func (uw *UserWatchlist) BeforeCreate(tx *gorm.DB) error {
	if uw.ID == uuid.Nil {
		uw.ID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (Stock) TableName() string {
	return "stocks"
}

func (MarketData) TableName() string {
	return "market_data"
}

func (UserWatchlist) TableName() string {
	return "user_watchlists"
}