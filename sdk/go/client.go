// Package trybase provides a zero-dependency client for the TryBase Anti-Leak Daemon.
// It retrieves secrets and ephemeral RDS IAM tokens directly into memory over Linux Unix Domain Sockets.
package trybase

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

// Client interacts with the TryBase secret daemon.
type Client struct {
	socketPath string
	httpClient *http.Client
}

// DatabaseAuthToken represents an ephemeral 15-minute RDS IAM password.
type DatabaseAuthToken struct {
	DBHost     string    `json:"db_host"`
	DBPort     uint16    `json:"db_port"`
	DBUser     string    `json:"db_user"`
	DBName     string    `json:"db_name"`
	AuthToken  string    `json:"auth_token"`
	ExpiresAt  time.Time `json:"expires_at"`
	TTLSeconds int64     `json:"ttl_seconds"`
}

// NewClient returns a TryBase client connected to /var/run/trybase/secrets.sock.
func NewClient(socketPath ...string) *Client {
	path := "/var/run/trybase/secrets.sock"
	if len(socketPath) > 0 && socketPath[0] != "" {
		path = socketPath[0]
	} else if envPath := os.Getenv("TRYBASE_SOCKET_PATH"); envPath != "" {
		path = envPath
	}

	httpClient := &http.Client{
		Timeout: 3 * time.Second,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				return (&net.Dialer{}).DialContext(ctx, "unix", path)
			},
		},
	}

	return &Client{
		socketPath: path,
		httpClient: httpClient,
	}
}

// IsAvailable checks if the TryBase Unix Domain Socket exists.
func (c *Client) IsAvailable() bool {
	info, err := os.Stat(c.socketPath)
	if err != nil {
		return false
	}
	return (info.Mode() & os.ModeSocket) != 0
}

// getToken performs the IMDSv2 handshake to get an ephemeral session token.
func (c *Client) getToken(ttlSeconds int) (string, error) {
	req, err := http.NewRequest("PUT", "http://localhost/latest/api/token", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("X-TryBase-Token-TTL-Seconds", fmt.Sprintf("%d", ttlSeconds))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("TryBase handshake request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("TryBase handshake failed (HTTP %d): %s", resp.StatusCode, string(body))
	}

	tokenBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(tokenBytes)), nil
}

// GetSecrets fetches all decrypted tenant secrets into memory.
func (c *Client) GetSecrets() (map[string]string, error) {
	token, err := c.getToken(60)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("GET", "http://localhost/latest/secrets", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-TryBase-Token", token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch secrets: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to fetch secrets (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var secrets map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&secrets); err != nil {
		return nil, fmt.Errorf("failed to decode secrets JSON: %w", err)
	}

	return secrets, nil
}

// GetDatabaseToken fetches an ephemeral 15-minute RDS IAM PostgreSQL password token.
func (c *Client) GetDatabaseToken() (*DatabaseAuthToken, error) {
	token, err := c.getToken(60)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("GET", "http://localhost/latest/database/token", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-TryBase-Token", token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch database token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to generate database token (HTTP %d): %s", resp.StatusCode, string(body))
	}

	var dbToken DatabaseAuthToken
	if err := json.NewDecoder(resp.Body).Decode(&dbToken); err != nil {
		return nil, fmt.Errorf("failed to decode database token JSON: %w", err)
	}

	return &dbToken, nil
}
