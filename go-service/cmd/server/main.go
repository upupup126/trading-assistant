package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	
	"trading-assistant/go-service/internal/api"
	"trading-assistant/go-service/internal/client"
	"trading-assistant/go-service/internal/config"
	"trading-assistant/go-service/internal/database"
	"trading-assistant/go-service/internal/handler"
	"trading-assistant/go-service/internal/middleware"
	"trading-assistant/go-service/internal/repository"
	"trading-assistant/go-service/internal/service"
	"trading-assistant/go-service/internal/websocket"
)

func main() {
	// 加载配置
	cfg := config.Load()
	
	// 设置Gin模式
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	
	// 初始化数据库
	db, err := database.NewDatabase(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()
	
	// 初始化WebSocket Hub
	wsHub := websocket.NewHub()
	go wsHub.Run()
	
	// 初始化AI客户端
	aiClient := client.NewAIClient(cfg.AI.PythonServiceURL)
	
	// 初始化仓库层
	userRepo := repository.NewUserRepository(db.DB)
	tradingRepo := repository.NewTradingRepository(db.DB)
	strategyRepo := repository.NewStrategyRepository(db.DB)
	
	// 初始化服务层
	authService := service.NewAuthService(userRepo, cfg.JWT.Secret)
	aiService := service.NewAIService(aiClient, db.DB)
	tradingService := service.NewTradingService(tradingRepo, db.DB)
	strategyService := service.NewStrategyService(strategyRepo, cfg.AI.PythonServiceURL)
	
	// 启动策略信号检查定时器
	strategyService.StartScheduler()
	
	// 初始化处理器
	handlers := &api.Handlers{
		Auth:      handler.NewAuthHandler(authService),
		Health:    handler.NewHealthHandler(db),
		WebSocket: handler.NewWebSocketHandler(wsHub),
		AI:        api.NewAIHandler(aiService),
		Trading:   handler.NewTradingHandler(tradingService),
		Strategy:  handler.NewStrategyHandler(strategyService),
	}
	
	// 创建路由器
	router := setupRouter(cfg, handlers)
	
	// 启动HTTP服务器
	srv := &http.Server{
		Addr:           ":" + cfg.Port,
		Handler:        router,
		ReadTimeout:    30 * time.Second,
		WriteTimeout:   30 * time.Second,
		MaxHeaderBytes: 1 << 20, // 1MB
	}
	
	// 优雅关闭
	gracefulShutdown(srv, db, wsHub)
}

func setupRouter(cfg *config.Config, handlers *api.Handlers) *gin.Engine {
	router := gin.New()
	
	// 全局中间件
	router.Use(
		middleware.Logger(),
		middleware.Recovery(),
		middleware.CORS(),
		middleware.RateLimit(),
		middleware.RequestID(),
	)
	
	// 设置路由
	api.SetupRoutes(router, cfg, handlers)
	
	return router
}

func gracefulShutdown(srv *http.Server, db *database.Database, wsHub *websocket.Hub) {
	// 启动服务器
	go func() {
		log.Printf("Server starting on port %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()
	
	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	
	log.Println("Shutting down server...")
	
	// 设置关闭超时
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	// 关闭HTTP服务器
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}
	
	// 关闭数据库连接
	if err := db.Close(); err != nil {
		log.Printf("Failed to close database: %v", err)
	}
	
	// TODO: 关闭WebSocket连接
	// wsHub.Shutdown()
	
	log.Println("Server exited")
}