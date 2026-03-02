package database

import (
	"fmt"
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	
	"trading-assistant/go-service/internal/config"
	"trading-assistant/go-service/internal/model"
)

type Database struct {
	DB *gorm.DB
}

func NewDatabase(cfg *config.Config) (*Database, error) {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%d sslmode=%s TimeZone=%s",
		cfg.Database.Host,
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.DBName,
		cfg.Database.Port,
		cfg.Database.SSLMode,
		cfg.Database.TimeZone,
	)
	
	// 配置GORM日志级别
	var logLevel logger.LogLevel
	if cfg.Environment == "production" {
		logLevel = logger.Error
	} else {
		logLevel = logger.Info
	}
	
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	
	// 配置连接池
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get database instance: %w", err)
	}
	
	// 设置连接池参数
	sqlDB.SetMaxIdleConns(10)           // 最大空闲连接数
	sqlDB.SetMaxOpenConns(100)          // 最大打开连接数
	sqlDB.SetConnMaxLifetime(time.Hour) // 连接最大生存时间
	
	// 测试连接
	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}
	
	// 自动迁移
	if err := autoMigrate(db); err != nil {
		return nil, fmt.Errorf("failed to migrate database: %w", err)
	}
	
	log.Println("Database connected and migrated successfully")
	
	return &Database{DB: db}, nil
}

func autoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&model.User{},
		&model.UserSettings{},
		&model.Stock{},
		&model.MarketData{},
		&model.UserWatchlist{},
		&model.TradingPlan{},
		&model.TradeExecution{},
		&model.Position{},
		&model.AccountFund{},
		&model.TradingJournal{},
		&model.AIAnalysis{},
		&model.SmartAlert{},
		&model.AlertHistory{},
		&model.SystemConfig{},
		&model.TradingStrategy{},
		&model.StrategyAlert{},
		&model.BacktestResult{},
		&model.AlertMute{},
	)
}

// WithTransaction 事务管理
func (d *Database) WithTransaction(fn func(*gorm.DB) error) error {
	tx := d.DB.Begin()
	if tx.Error != nil {
		return tx.Error
	}
	
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()
	
	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}
	
	return tx.Commit().Error
}

// Close 关闭数据库连接
func (d *Database) Close() error {
	sqlDB, err := d.DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// Health 健康检查
func (d *Database) Health() error {
	sqlDB, err := d.DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Ping()
}