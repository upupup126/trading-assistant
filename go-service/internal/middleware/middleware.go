package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
)

// Logger 日志中间件
func Logger() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		logrus.WithFields(logrus.Fields{
			"status_code":  param.StatusCode,
			"latency":      param.Latency,
			"client_ip":    param.ClientIP,
			"method":       param.Method,
			"path":         param.Path,
			"user_agent":   param.Request.UserAgent(),
			"request_id":   param.Keys["request_id"],
		}).Info("HTTP Request")
		return ""
	})
}

// Recovery 恢复中间件
func Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		logrus.WithFields(logrus.Fields{
			"error":      recovered,
			"request_id": c.GetString("request_id"),
			"path":       c.Request.URL.Path,
			"method":     c.Request.Method,
		}).Error("Panic recovered")
		
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INTERNAL_SERVER_ERROR",
				"message": "Internal server error",
			},
			"timestamp":  time.Now().Unix(),
			"request_id": c.GetString("request_id"),
		})
	})
}

// CORS 跨域中间件
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		
		// 允许的域名列表
		allowedOrigins := []string{
			"http://localhost:3000",
			"http://localhost:3001",
			"http://45.40.228.140:3000",
			"http://45.40.228.140",
			"https://trading-assistant.com",
		}
		
		// 检查是否为允许的域名
		allowed := false
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				allowed = true
				break
			}
		}
		
		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
		c.Header("Access-Control-Expose-Headers", "Content-Length")
		c.Header("Access-Control-Allow-Credentials", "true")
		
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		
		c.Next()
	}
}

// RequestID 请求ID中间件
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}
		
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// RateLimit 限流中间件（简单实现）
func RateLimit() gin.HandlerFunc {
	// 这里可以集成更复杂的限流算法
	return func(c *gin.Context) {
		// 简单的IP限流检查
		clientIP := c.ClientIP()
		
		// TODO: 实现基于Redis的分布式限流
		_ = clientIP
		
		c.Next()
	}
}

// JWTAuth JWT认证中间件
func JWTAuth(secretKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "AUTH_HEADER_MISSING",
					"message": "Authorization header required",
				},
				"timestamp":  time.Now().Unix(),
				"request_id": c.GetString("request_id"),
			})
			c.Abort()
			return
		}
		
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "INVALID_TOKEN_FORMAT",
					"message": "Bearer token required",
				},
				"timestamp":  time.Now().Unix(),
				"request_id": c.GetString("request_id"),
			})
			c.Abort()
			return
		}
		
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(secretKey), nil
		})
		
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "TOKEN_INVALID",
					"message": "Invalid token",
				},
				"timestamp":  time.Now().Unix(),
				"request_id": c.GetString("request_id"),
			})
			c.Abort()
			return
		}
		
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("user_id", claims["user_id"])
			c.Set("username", claims["username"])
			if roles, ok := claims["roles"].([]interface{}); ok {
				c.Set("roles", roles)
			}
		}
		
		c.Next()
	}
}

// TradingPermission 交易权限验证中间件
func TradingPermission() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "USER_NOT_AUTHENTICATED",
					"message": "User not authenticated",
				},
				"timestamp":  time.Now().Unix(),
				"request_id": c.GetString("request_id"),
			})
			c.Abort()
			return
		}
		
		// TODO: 检查用户是否有交易权限
		// 这里可以查询数据库或缓存
		if !hasTradePermission(userID) {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "INSUFFICIENT_PERMISSIONS",
					"message": "Trading permission required",
				},
				"timestamp":  time.Now().Unix(),
				"request_id": c.GetString("request_id"),
			})
			c.Abort()
			return
		}
		
		c.Next()
	}
}

// RiskControl 风险控制中间件
func RiskControl() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "USER_NOT_AUTHENTICATED",
					"message": "User not authenticated",
				},
				"timestamp":  time.Now().Unix(),
				"request_id": c.GetString("request_id"),
			})
			c.Abort()
			return
		}
		
		// TODO: 检查用户当日交易次数和金额限制
		if exceeded, err := checkRiskLimits(userID); err != nil || exceeded {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "RISK_LIMIT_EXCEEDED",
					"message": "Risk limit exceeded",
				},
				"timestamp":  time.Now().Unix(),
				"request_id": c.GetString("request_id"),
			})
			c.Abort()
			return
		}
		
		c.Next()
	}
}

// 辅助函数 - 检查交易权限
func hasTradePermission(userID string) bool {
	// TODO: 实现实际的权限检查逻辑
	// 可以查询数据库或缓存
	return true // 临时返回true
}

// 辅助函数 - 检查风险限制
func checkRiskLimits(userID string) (bool, error) {
	// TODO: 实现实际的风险控制逻辑
	// 检查当日交易次数、金额等限制
	return false, nil // 临时返回false表示未超限
}