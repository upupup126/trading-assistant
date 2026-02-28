package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AIAnalysis AI分析记录模型
type AIAnalysis struct {
	ID               uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID           *uuid.UUID `json:"user_id" gorm:"type:uuid"`
	StockID          *uuid.UUID `json:"stock_id" gorm:"type:uuid"`
	AnalysisType     string     `json:"analysis_type" gorm:"not null;size:50"` // MARKET_OVERVIEW, STOCK_ANALYSIS, RISK_ASSESSMENT, STRATEGY_ADVICE
	Prompt           string     `json:"prompt" gorm:"not null"`
	Result           string     `json:"result" gorm:"type:jsonb;not null"`
	ConfidenceScore  *float64   `json:"confidence_score" gorm:"type:decimal(3,2)"`
	ModelVersion     *string    `json:"model_version" gorm:"size:50"`
	ProcessingTimeMs *int       `json:"processing_time_ms"`
	CreatedAt        time.Time  `json:"created_at"`

	// 关联
	User  *User  `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Stock *Stock `json:"stock,omitempty" gorm:"foreignKey:StockID"`
}

// SmartAlert 智能提醒模型
type SmartAlert struct {
	ID                uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID            uuid.UUID  `json:"user_id" gorm:"type:uuid;not null"`
	StockID           *uuid.UUID `json:"stock_id" gorm:"type:uuid"`
	AlertType         string     `json:"alert_type" gorm:"not null;size:50"` // PRICE_TARGET, VOLUME_SPIKE, NEWS_SENTIMENT, AI_SIGNAL
	Conditions        string     `json:"conditions" gorm:"type:jsonb;not null"`
	MessageTemplate   *string    `json:"message_template"`
	IsActive          bool       `json:"is_active" gorm:"default:true"`
	TriggerCount      int        `json:"trigger_count" gorm:"default:0"`
	LastTriggeredAt   *time.Time `json:"last_triggered_at"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`

	// 关联
	User         User           `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Stock        *Stock         `json:"stock,omitempty" gorm:"foreignKey:StockID"`
	AlertHistory []AlertHistory `json:"alert_history,omitempty" gorm:"foreignKey:AlertID"`
}

// AlertHistory 提醒历史模型
type AlertHistory struct {
	ID             uuid.UUID  `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	AlertID        uuid.UUID  `json:"alert_id" gorm:"type:uuid;not null"`
	UserID         uuid.UUID  `json:"user_id" gorm:"type:uuid;not null"`
	Message        string     `json:"message" gorm:"not null"`
	DeliveryMethod string     `json:"delivery_method" gorm:"not null;size:20"` // EMAIL, SMS, PUSH, WEBSOCKET
	DeliveryStatus string     `json:"delivery_status" gorm:"default:'PENDING';size:20"` // PENDING, SENT, DELIVERED, FAILED
	TriggeredAt    time.Time  `json:"triggered_at" gorm:"default:CURRENT_TIMESTAMP"`
	DeliveredAt    *time.Time `json:"delivered_at"`

	// 关联
	Alert SmartAlert `json:"alert,omitempty" gorm:"foreignKey:AlertID"`
	User  User       `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

// SystemConfig 系统配置模型
type SystemConfig struct {
	ID          uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	ConfigKey   string    `json:"config_key" gorm:"uniqueIndex;not null;size:100"`
	ConfigValue string    `json:"config_value" gorm:"type:jsonb;not null"`
	Description *string   `json:"description"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// BeforeCreate GORM钩子
func (ai *AIAnalysis) BeforeCreate(tx *gorm.DB) error {
	if ai.ID == uuid.Nil {
		ai.ID = uuid.New()
	}
	return nil
}

func (sa *SmartAlert) BeforeCreate(tx *gorm.DB) error {
	if sa.ID == uuid.Nil {
		sa.ID = uuid.New()
	}
	return nil
}

func (ah *AlertHistory) BeforeCreate(tx *gorm.DB) error {
	if ah.ID == uuid.Nil {
		ah.ID = uuid.New()
	}
	return nil
}

func (sc *SystemConfig) BeforeCreate(tx *gorm.DB) error {
	if sc.ID == uuid.Nil {
		sc.ID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (AIAnalysis) TableName() string {
	return "ai_analyses"
}

func (SmartAlert) TableName() string {
	return "smart_alerts"
}

func (AlertHistory) TableName() string {
	return "alert_history"
}

func (SystemConfig) TableName() string {
	return "system_configs"
}