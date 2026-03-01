package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User 用户模型
type User struct {
	ID            uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	Username      string         `json:"username" gorm:"uniqueIndex;not null;size:50"`
	Email         string         `json:"email" gorm:"uniqueIndex;not null;size:100"`
	PasswordHash  string         `json:"-" gorm:"not null;size:255"`
	FullName      *string        `json:"full_name" gorm:"size:100"`
	Phone         *string        `json:"phone" gorm:"size:20"`
	AvatarURL     *string        `json:"avatar_url"`
	IsActive      bool           `json:"is_active" gorm:"default:true"`
	EmailVerified bool           `json:"email_verified" gorm:"default:false"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	LastLoginAt   *time.Time     `json:"last_login_at"`
	DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联
	Settings      *UserSettings   `json:"settings,omitempty" gorm:"foreignKey:UserID"`
	TradingPlans  []TradingPlan   `json:"trading_plans,omitempty" gorm:"foreignKey:UserID"`
	Positions     []Position      `json:"positions,omitempty" gorm:"foreignKey:UserID"`
	SmartAlerts   []SmartAlert    `json:"smart_alerts,omitempty" gorm:"foreignKey:UserID"`
	Watchlists    []UserWatchlist `json:"watchlists,omitempty" gorm:"foreignKey:UserID"`
}

// UserSettings 用户设置模型
type UserSettings struct {
	ID                      uuid.UUID `json:"id" gorm:"type:uuid;primary_key;default:uuid_generate_v4()"`
	UserID                  uuid.UUID `json:"user_id" gorm:"type:uuid;not null"`
	RiskTolerance          string    `json:"risk_tolerance" gorm:"default:'MEDIUM';size:20"`
	DefaultPositionSize    float64   `json:"default_position_size" gorm:"type:decimal(10,2);default:1000.00"`
	MaxDailyLoss           float64   `json:"max_daily_loss" gorm:"type:decimal(10,2);default:500.00"`
	TotalCapital           float64   `json:"total_capital" gorm:"type:decimal(14,2);default:0"`
	AvailableCash          float64   `json:"available_cash" gorm:"type:decimal(14,2);default:0"`
	NotificationPreferences string    `json:"notification_preferences" gorm:"type:jsonb;default:'{}'"`
	TradingHours           string    `json:"trading_hours" gorm:"type:jsonb;default:'{\"start\": \"09:30\", \"end\": \"15:00\"}'"`
	Timezone               string    `json:"timezone" gorm:"default:'Asia/Shanghai';size:50"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`

	// 关联（使用指针避免循环引用）
	User *User `json:"-" gorm:"foreignKey:UserID"`
}

// BeforeCreate GORM钩子 - 创建前生成UUID
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

func (us *UserSettings) BeforeCreate(tx *gorm.DB) error {
	if us.ID == uuid.Nil {
		us.ID = uuid.New()
	}
	return nil
}

// TableName 指定表名
func (User) TableName() string {
	return "users"
}

func (UserSettings) TableName() string {
	return "user_settings"
}