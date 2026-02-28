package config

import (
	"log"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	// 服务配置
	Environment string
	Port        string
	
	// 数据库配置
	Database DatabaseConfig
	
	// Redis配置
	Redis RedisConfig
	
	// JWT配置
	JWT JWTConfig
	
	// AI服务配置
	AI AIConfig
	
	// 外部API配置
	ExternalAPI ExternalAPIConfig
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
	TimeZone string
}

type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

type JWTConfig struct {
	Secret    string
	ExpiresIn time.Duration
}

type AIConfig struct {
	PythonServiceURL string
	Timeout          time.Duration
}

type ExternalAPIConfig struct {
	StockAPIKey string
	Timeout     time.Duration
}

func Load() *Config {
	// 加载.env文件
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	return &Config{
		Environment: getEnv("NODE_ENV", "development"),
		Port:        getEnv("GO_SERVICE_PORT", "8080"),
		
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnvAsInt("DB_PORT", 5432),
			User:     getEnv("DB_USER", "trading_user"),
			Password: getEnv("DB_PASSWORD", "trading_password"),
			DBName:   getEnv("DB_NAME", "trading_assistant"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
			TimeZone: getEnv("DB_TIMEZONE", "UTC"),
		},
		
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnvAsInt("REDIS_PORT", 6379),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvAsInt("REDIS_DB", 0),
		},
		
		JWT: JWTConfig{
			Secret:    getEnv("JWT_SECRET", "your-super-secret-jwt-key-here"),
			ExpiresIn: getEnvAsDuration("JWT_EXPIRES_IN", "24h"),
		},
		
		AI: AIConfig{
			PythonServiceURL: getEnv("PYTHON_SERVICE_URL", "http://localhost:8000"),
			Timeout:          getEnvAsDuration("AI_TIMEOUT", "30s"),
		},
		
		ExternalAPI: ExternalAPIConfig{
			StockAPIKey: getEnv("STOCK_API_KEY", ""),
			Timeout:     getEnvAsDuration("EXTERNAL_API_TIMEOUT", "10s"),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsDuration(key string, defaultValue string) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	if duration, err := time.ParseDuration(defaultValue); err == nil {
		return duration
	}
	return 24 * time.Hour // 默认24小时
}