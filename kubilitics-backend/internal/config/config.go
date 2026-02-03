package config

import (
	"fmt"

	"github.com/spf13/viper"
)

type Config struct {
	Port           int      `mapstructure:"port"`
	DatabasePath   string   `mapstructure:"database_path"`
	LogLevel       string   `mapstructure:"log_level"`
	AllowedOrigins []string `mapstructure:"allowed_origins"`
	KubeconfigPath string   `mapstructure:"kubeconfig_path"`
}

func Load() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("/etc/kubilitics/")
	viper.AddConfigPath("$HOME/.kubilitics")
	viper.AddConfigPath(".")

	// Defaults
	viper.SetDefault("port", 8080)
	viper.SetDefault("database_path", "./kubilitics.db")
	viper.SetDefault("log_level", "info")
	viper.SetDefault("allowed_origins", []string{"*"})
	viper.SetDefault("kubeconfig_path", "")

	// Environment variables
	viper.SetEnvPrefix("KUBILITICS")
	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config: %w", err)
		}
		// Config file not found; using defaults and env vars
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &cfg, nil
}
