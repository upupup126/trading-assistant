package api

import (
	"github.com/gin-gonic/gin"
	
	"trading-assistant/go-service/internal/config"
	"trading-assistant/go-service/internal/handler"
	"trading-assistant/go-service/internal/middleware"
)

type Handlers struct {
	Auth      *handler.AuthHandler
	Health    *handler.HealthHandler
	WebSocket *handler.WebSocketHandler
	AI        *AIHandler
	Trading   *handler.TradingHandler
	Strategy  *handler.StrategyHandler
}

func SetupRoutes(router *gin.Engine, cfg *config.Config, handlers *Handlers) {
	// 健康检查路由（无需认证）
	router.GET("/health", handlers.Health.HealthCheck)
	router.GET("/health/ready", handlers.Health.ReadinessCheck)
	router.GET("/health/live", handlers.Health.LivenessCheck)
	
	// API版本1
	v1 := router.Group("/api/v1")
	{
		// 公开路由
		public := v1.Group("/")
		{
			// 认证相关
			auth := public.Group("/auth")
			{
				auth.POST("/login", handlers.Auth.Login)
				auth.POST("/register", handlers.Auth.Register)
				auth.POST("/refresh", handlers.Auth.RefreshToken)
			}
			
			// 公开的市场数据（可选）
			// market := public.Group("/market")
			// {
			//     market.GET("/overview", handlers.Market.GetOverview)
			//     market.GET("/stocks/search", handlers.Stock.Search)
			// }
		}
		
		// 需要认证的路由
		protected := v1.Group("/")
		protected.Use(middleware.JWTAuth(cfg.JWT.Secret))
		{
			// 用户相关
			users := protected.Group("/users")
			{
				users.GET("/profile", handlers.Auth.GetProfile)
				users.PUT("/profile", func(c *gin.Context) {
					// TODO: 实现更新用户资料
					c.JSON(200, gin.H{"message": "Update profile - TODO"})
				})
				users.POST("/change-password", handlers.Auth.ChangePassword)
				users.POST("/logout", handlers.Auth.Logout)
			}
			
			// 交易相关（需要交易权限）
			trading := protected.Group("/trading")
			trading.Use(middleware.TradingPermission(), middleware.RiskControl())
			{
				trading.GET("/positions", handlers.Trading.GetPositions)
				trading.POST("/positions", handlers.Trading.AddPosition)
				trading.DELETE("/positions/:id", handlers.Trading.DeletePosition)
				trading.POST("/execute", handlers.Trading.RecordTrade)
				trading.GET("/history", handlers.Trading.GetTradeHistory)
				trading.GET("/fund", handlers.Trading.GetFund)
				trading.PUT("/fund", handlers.Trading.UpdateFund)
				trading.GET("/portfolio", handlers.Trading.GetPortfolioSummary)
				trading.GET("/stocks/search", handlers.Trading.SearchStocks)

			// 交易策略管理
			trading.GET("/strategies", handlers.Strategy.GetStrategies)
			trading.POST("/strategies", handlers.Strategy.CreateStrategy)
			trading.PUT("/strategies/:id", handlers.Strategy.UpdateStrategy)
			trading.DELETE("/strategies/:id", handlers.Strategy.DeleteStrategy)
			trading.GET("/strategies/builtin", handlers.Strategy.GetBuiltinStrategies)

			// 策略提醒
			trading.GET("/strategy-alerts", handlers.Strategy.GetAlerts)
			trading.PUT("/strategy-alerts/:id/read", handlers.Strategy.MarkAlertRead)
			trading.PUT("/strategy-alerts/read-all", handlers.Strategy.MarkAllAlertsRead)
			trading.GET("/strategy-alerts/unread-count", handlers.Strategy.GetUnreadAlertCount)

			// 通知静音
			trading.POST("/strategy-alerts/mute", handlers.Strategy.MuteAlert)
			trading.POST("/strategy-alerts/unmute", handlers.Strategy.UnmuteAlert)
			trading.GET("/strategy-alerts/mutes", handlers.Strategy.GetMutedAlerts)

			// 回测
			trading.POST("/backtest", handlers.Strategy.RunBacktest)
			}
			
			// AI分析相关
			ai := protected.Group("/ai")
			{
				// 市场分析
				ai.POST("/market-trend", handlers.AI.AnalyzeMarketTrend)
				ai.GET("/market-overview", handlers.AI.GetMarketOverview)

				// 个股分析
				ai.POST("/stock-opportunity", handlers.AI.AnalyzeStockOpportunity)
				ai.GET("/stock/:symbol/quote", handlers.AI.GetStockQuote)
				ai.GET("/stock/:symbol/history", handlers.AI.GetStockHistory)
			ai.GET("/stock/:symbol/minute", handlers.AI.GetMinuteData)

			// 在线搜索股票
			ai.GET("/stocks/search", handlers.AI.SearchStocksOnline)

			// 板块热点轮动
			ai.GET("/sector/hotspot", handlers.AI.GetSectorHotspot)

				// 风险评估
				ai.POST("/risk-assessment", handlers.AI.AssessPortfolioRisk)

				// 交易建议
				ai.POST("/trading-advice", handlers.AI.GenerateTradingAdvice)

				// 分析历史
				ai.GET("/history", handlers.AI.GetAnalysisHistory)
				ai.GET("/analysis/:id", handlers.AI.GetAnalysisDetail)

				// 健康检查
				ai.GET("/health", handlers.AI.HealthCheck)
			}
			
			// WebSocket相关
			ws := protected.Group("/ws")
			{
				ws.GET("/connect", handlers.WebSocket.HandleWebSocket)
				ws.GET("/users", handlers.WebSocket.GetConnectedUsers)
				ws.GET("/rooms/:room/users", handlers.WebSocket.GetRoomUsers)
			}
			
			// 关注列表
			watchlist := protected.Group("/watchlist")
			{
				watchlist.GET("/", func(c *gin.Context) {
					// TODO: 实现获取关注列表
					c.JSON(200, gin.H{"message": "Get watchlist - TODO"})
				})
				watchlist.POST("/", func(c *gin.Context) {
					// TODO: 实现添加到关注列表
					c.JSON(200, gin.H{"message": "Add to watchlist - TODO"})
				})
				watchlist.DELETE("/:symbol", func(c *gin.Context) {
					// TODO: 实现从关注列表移除
					c.JSON(200, gin.H{"message": "Remove from watchlist - TODO"})
				})
			}
			
			// 复盘分析
			journal := protected.Group("/journal")
			{
				journal.GET("/", func(c *gin.Context) {
					// TODO: 实现获取交易日志
					c.JSON(200, gin.H{"message": "Get trading journal - TODO"})
				})
				journal.POST("/", func(c *gin.Context) {
					// TODO: 实现创建交易日志
					c.JSON(200, gin.H{"message": "Create trading journal - TODO"})
				})
				journal.PUT("/:id", func(c *gin.Context) {
					// TODO: 实现更新交易日志
					c.JSON(200, gin.H{"message": "Update trading journal - TODO"})
				})
			}
		}
	}
	
	// API版本2（未来扩展）
	v2 := router.Group("/api/v2")
	{
		v2.GET("/status", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"message": "API v2 coming soon",
				"version": "2.0.0",
			})
		})
	}
}