.PHONY: build test clean run help

# Variables
BINARY_NAME=kubilitics-ai
BIN_DIR=bin
CMD_DIR=cmd/server
VERSION=0.1.0

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build the kubilitics-ai binary
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p $(BIN_DIR)
	@go build -o $(BIN_DIR)/$(BINARY_NAME) ./$(CMD_DIR)
	@echo "✓ Binary built: $(BIN_DIR)/$(BINARY_NAME)"

test: ## Run all tests
	@echo "Running tests..."
	@go test ./... -v -cover

test-coverage: ## Run tests with coverage report
	@echo "Running tests with coverage..."
	@go test ./... -v -coverprofile=coverage.out
	@go tool cover -html=coverage.out -o coverage.html
	@echo "✓ Coverage report generated: coverage.html"

run: build ## Build and run the server
	@echo "Starting $(BINARY_NAME)..."
	@./$(BIN_DIR)/$(BINARY_NAME)

clean: ## Clean build artifacts
	@echo "Cleaning..."
	@rm -rf $(BIN_DIR)
	@rm -f coverage.out coverage.html
	@echo "✓ Clean complete"

fmt: ## Format code
	@echo "Formatting code..."
	@go fmt ./...
	@echo "✓ Code formatted"

lint: ## Run linters
	@echo "Running linters..."
	@go vet ./...
	@echo "✓ Linting complete"

tidy: ## Tidy dependencies
	@echo "Tidying dependencies..."
	@go mod tidy
	@echo "✓ Dependencies tidied"

.DEFAULT_GOAL := help
