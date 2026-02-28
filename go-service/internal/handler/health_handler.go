package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	
	"trading-assistant/go-service/internal/database"
)

type HealthHandler struct {
	db *database.Database
}

func NewHealthHandler(db *database.Database) *HealthHandler {
	return &HealthHandler{
		db: db,
	}
}

// HealthCheck 健康检查
func (h *HealthHandler) HealthCheck(c *gin.Context) {
	status := "healthy"
	checks := make(map[string]interface{})
	
	// 检查数据库连接
	if err := h.db.Health(); err != nil {
		status = "unhealthy"
		checks["database"] = map[string]interface{}{
			"status": "unhealthy",
			"error":  err.Error(),
		}
	} else {
		checks["database"] = map[string]interface{}{
			"status": "healthy",
		}
	}
	
	// TODO: 添加更多健康检查
	// - Redis连接检查
	// - 外部API检查
	// - 磁盘空间检查
	// - 内存使用检查
	
	httpStatus := http.StatusOK
	if status == "unhealthy" {
		httpStatus = http.StatusServiceUnavailable
	}
	
	c.JSON(httpStatus, gin.H{
		"status":    status,
		"timestamp": time.Now().Unix(),
		"version":   "1.0.0", // TODO: 从配置或构建信息获取
		"checks":    checks,
	})
}

// ReadinessCheck 就绪检查
func (h *HealthHandler) ReadinessCheck(c *gin.Context) {
	// 检查服务是否准备好接收请求
	ready := true
	checks := make(map[string]interface{})
	
	// 检查数据库
	if err := h.db.Health(); err != nil {
		ready = false
		checks["database"] = map[string]interface{}{
			"ready": false,
			"error": err.Error(),
		}
	} else {
		checks["database"] = map[string]interface{}{
			"ready": true,
		}
	}
	
	httpStatus := http.StatusOK
	if !ready {
		httpStatus = http.StatusServiceUnavailable
	}
	
	c.JSON(httpStatus, gin.H{
		"ready":     ready,
		"timestamp": time.Now().Unix(),
		"checks":    checks,
	})
}

// LivenessCheck 存活检查
func (h *HealthHandler) LivenessCheck(c *gin.Context) {
	// 简单的存活检查，只要服务能响应就认为是存活的
	c.JSON(http.StatusOK, gin.H{
		"alive":     true,
		"timestamp": time.Now().Unix(),
	})
}