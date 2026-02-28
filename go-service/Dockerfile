# Build stage
FROM golang:1.23-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

# Use Chinese Go proxy mirror
ENV GOPROXY=https://goproxy.cn,https://goproxy.io,direct
ENV GONOSUMCHECK=*

COPY go.mod ./
RUN go mod download 2>/dev/null || true

COPY . .

RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -o /trading-go-service ./cmd/server/main.go

# Runtime stage
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /trading-go-service .

EXPOSE 8080

CMD ["./trading-go-service"]
