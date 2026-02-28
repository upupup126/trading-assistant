package service

import (
	"context"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"trading-assistant/go-service/internal/model"
	"trading-assistant/go-service/internal/repository"
)

type AuthService struct {
	userRepo      repository.UserRepository
	secretKey     string
	tokenExpiry   time.Duration
	refreshExpiry time.Duration
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

type Claims struct {
	UserID   string   `json:"user_id"`
	Username string   `json:"username"`
	Email    string   `json:"email"`
	Roles    []string `json:"roles"`
	jwt.RegisteredClaims
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	FullName string `json:"full_name"`
}

type LoginResponse struct {
	User   *UserInfo  `json:"user"`
	Tokens *TokenPair `json:"tokens"`
}

type UserInfo struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
}

func NewAuthService(userRepo repository.UserRepository, secretKey string) *AuthService {
	return &AuthService{
		userRepo:      userRepo,
		secretKey:     secretKey,
		tokenExpiry:   24 * time.Hour,
		refreshExpiry: 7 * 24 * time.Hour,
	}
}

// Login 用户登录
func (s *AuthService) Login(ctx context.Context, req *LoginRequest) (*LoginResponse, error) {
	// 查找用户
	user, err := s.userRepo.GetByUsername(ctx, req.Username)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid username or password")
		}
		return nil, err
	}
	
	// 检查用户是否激活
	if !user.IsActive {
		return nil, errors.New("account is disabled")
	}
	
	// 验证密码
	if !s.CheckPassword(req.Password, user.PasswordHash) {
		return nil, errors.New("invalid username or password")
	}
	
	// 生成Token
	tokens, err := s.GenerateTokenPair(user.ID.String(), user.Username, user.Email, []string{"user"})
	if err != nil {
		return nil, err
	}
	
	// 更新最后登录时间
	if err := s.userRepo.UpdateLastLogin(ctx, user.ID); err != nil {
		// 记录错误但不影响登录流程
		// TODO: 添加日志记录
	}
	
	return &LoginResponse{
		User: &UserInfo{
			ID:       user.ID.String(),
			Username: user.Username,
			Email:    user.Email,
			FullName: getStringValue(user.FullName),
		},
		Tokens: tokens,
	}, nil
}

// Register 用户注册
func (s *AuthService) Register(ctx context.Context, req *RegisterRequest) (*LoginResponse, error) {
	// 检查用户名是否已存在
	if _, err := s.userRepo.GetByUsername(ctx, req.Username); err == nil {
		return nil, errors.New("username already exists")
	}
	
	// 检查邮箱是否已存在
	if _, err := s.userRepo.GetByEmail(ctx, req.Email); err == nil {
		return nil, errors.New("email already exists")
	}
	
	// 哈希密码
	hashedPassword, err := s.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}
	
	// 创建用户
	user := &model.User{
		ID:           uuid.New(),
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: hashedPassword,
		FullName:     getStringPointer(req.FullName),
		IsActive:     true,
		EmailVerified: false,
	}
	
	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}
	
	// 生成Token
	tokens, err := s.GenerateTokenPair(user.ID.String(), user.Username, user.Email, []string{"user"})
	if err != nil {
		return nil, err
	}
	
	return &LoginResponse{
		User: &UserInfo{
			ID:       user.ID.String(),
			Username: user.Username,
			Email:    user.Email,
			FullName: getStringValue(user.FullName),
		},
		Tokens: tokens,
	}, nil
}

// GenerateTokenPair 生成Token对
func (s *AuthService) GenerateTokenPair(userID, username, email string, roles []string) (*TokenPair, error) {
	// 访问Token
	accessClaims := Claims{
		UserID:   userID,
		Username: username,
		Email:    email,
		Roles:    roles,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.tokenExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "trading-assistant",
			Subject:   userID,
		},
	}
	
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString([]byte(s.secretKey))
	if err != nil {
		return nil, err
	}
	
	// 刷新Token
	refreshClaims := Claims{
		UserID:   userID,
		Username: username,
		Email:    email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.refreshExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "trading-assistant",
			Subject:   userID,
		},
	}
	
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString([]byte(s.secretKey))
	if err != nil {
		return nil, err
	}
	
	return &TokenPair{
		AccessToken:  accessTokenString,
		RefreshToken: refreshTokenString,
		ExpiresIn:    int64(s.tokenExpiry.Seconds()),
		TokenType:    "Bearer",
	}, nil
}

// ValidateToken 验证Token
func (s *AuthService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.secretKey), nil
	})
	
	if err != nil {
		return nil, err
	}
	
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	
	return nil, errors.New("invalid token")
}

// RefreshToken 刷新Token
func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	claims, err := s.ValidateToken(refreshToken)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}
	
	// 验证用户是否仍然存在且激活
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return nil, errors.New("invalid user ID")
	}
	
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, errors.New("user not found")
	}
	
	if !user.IsActive {
		return nil, errors.New("account is disabled")
	}
	
	// 生成新的Token对
	return s.GenerateTokenPair(user.ID.String(), user.Username, user.Email, []string{"user"})
}

// HashPassword 密码哈希
func (s *AuthService) HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword 验证密码
func (s *AuthService) CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// ChangePassword 修改密码
func (s *AuthService) ChangePassword(ctx context.Context, userID string, oldPassword, newPassword string) error {
	// 解析用户ID
	uid, err := uuid.Parse(userID)
	if err != nil {
		return errors.New("invalid user ID")
	}
	
	// 获取用户信息
	user, err := s.userRepo.GetByID(ctx, uid)
	if err != nil {
		return errors.New("user not found")
	}
	
	// 验证旧密码
	if !s.CheckPassword(oldPassword, user.PasswordHash) {
		return errors.New("invalid old password")
	}
	
	// 哈希新密码
	hashedPassword, err := s.HashPassword(newPassword)
	if err != nil {
		return err
	}
	
	// 更新密码
	user.PasswordHash = hashedPassword
	return s.userRepo.Update(ctx, user)
}

// 辅助函数
func getStringPointer(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func getStringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}