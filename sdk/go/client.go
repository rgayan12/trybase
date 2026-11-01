// Package trybase provides a zero-dependency client for the TryBase Anti-Leak Daemon.
// It retrieves secrets and ephemeral RDS IAM tokens directly into memory over Linux Unix Domain Sockets.
package trybase

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

var (
	// ErrSecretNotFound indicates that the requested key does not exist.
	ErrSecretNotFound = errors.New("trybase: secret not found")
	// ErrSocketUnavailable indicates that the TryBase Unix Domain Socket does not exist.
	ErrSocketUnavailable = errors.New("trybase: daemon socket unavailable")
)

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

// Client interacts with the TryBase secret daemon.
type Client struct {
	socketPath            string
	httpClient            *http.Client
	mu                    sync.RWMutex
	sessionToken          string
	sessionTokenExpiresAt time.Time
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
		Timeout: 4 * time.Second,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				return (&net.Dialer{Timeout: 2 * time.Second}).DialContext(ctx, "unix", path)
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

// ShouldFailClosed checks if missing socket or daemon failures must abort startup.
func (c *Client) ShouldFailClosed() bool {
	envFailClosed := os.Getenv("TRYBASE_FAIL_CLOSED")
	if envFailClosed != "" {
		s := strings.ToLower(strings.TrimSpace(envFailClosed))
		return s == "true" || s == "1" || s == "yes"
	}

	fallback := strings.ToLower(strings.TrimSpace(os.Getenv("TRYBASE_LOCAL_FALLBACK")))
	if fallback == "true" || fallback == "1" || fallback == "yes" {
		return false
	}

	envName := strings.ToLower(strings.TrimSpace(os.Getenv("ENV")))
	if envName == "" {
		envName = strings.ToLower(strings.TrimSpace(os.Getenv("ENVIRONMENT")))
	}
	if envName == "" {
		envName = strings.ToLower(strings.TrimSpace(os.Getenv("GO_ENV")))
	}

	if envName == "production" || envName == "staging" || envName == "prod" {
		return true
	}

	req := strings.ToLower(strings.TrimSpace(os.Getenv("TRYBASE_REQUIRED")))
	return req == "true" || req == "1" || req == "yes"
}

// GetSessionToken obtains or reuses a TryBase Session-Token via PUT /latest/api/token.
// Tokens are cached in memory during their TTL to minimize socket roundtrips.
func (c *Client) GetSessionToken(ttlSeconds ...int) (string, error) {
	ttl := 60
	if len(ttlSeconds) > 0 && ttlSeconds[0] > 0 {
		ttl = ttlSeconds[0]
	}

	c.mu.RLock()
	if c.sessionToken != "" && time.Now().Before(c.sessionTokenExpiresAt.Add(-5*time.Second)) {
		token := c.sessionToken
		c.mu.RUnlock()
		return token, nil
	}
	c.mu.RUnlock()

	c.mu.Lock()
	defer c.mu.Unlock()

	// Double check under write lock
	if c.sessionToken != "" && time.Now().Before(c.sessionTokenExpiresAt.Add(-5*time.Second)) {
		return c.sessionToken, nil
	}

	req, err := http.NewRequest("PUT", "http://localhost/latest/api/token", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("X-TryBase-Token-TTL-Seconds", fmt.Sprintf("%d", ttl))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("TryBase Session-Token request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("TryBase Session-Token handshake failed (HTTP %d): %s", resp.StatusCode, string(body))
	}

	tokenBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	token := strings.TrimSpace(string(tokenBytes))
	if token == "" {
		return "", errors.New("TryBase Session-Token handshake returned empty token")
	}

	c.sessionToken = token
	c.sessionTokenExpiresAt = time.Now().Add(time.Duration(ttl) * time.Second)

	return c.sessionToken, nil
}

// GetSecrets fetches all decrypted tenant secrets into memory: GET /latest/secrets.
func (c *Client) GetSecrets() (map[string]string, error) {
	token, err := c.GetSessionToken(60)
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

// GetSecret fetches a single secret: GET /latest/secrets/<key> (scoped to minimize blast radius).
func (c *Client) GetSecret(key string) (string, error) {
	token, err := c.GetSessionToken(60)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequest("GET", "http://localhost/latest/secrets/"+url.PathEscape(key), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("X-TryBase-Token", token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to fetch secret %q: %w", key, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return "", ErrSecretNotFound
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("failed to fetch secret %q (HTTP %d): %s", key, resp.StatusCode, string(body))
	}

	val, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(val)), nil
}

// GetDatabaseToken fetches an ephemeral 15-minute RDS IAM PostgreSQL password token.
func (c *Client) GetDatabaseToken() (*DatabaseAuthToken, error) {
	token, err := c.GetSessionToken(60)
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

	if dbToken.AuthToken == "" {
		return nil, errors.New("database token response missing auth_token")
	}

	return &dbToken, nil
}

// GetDatabasePasswordHook returns a callback function that returns a freshly minted
// 15-minute RDS IAM password. Perfect for connection pools (e.g. pgxpool BeforeConnect).
func (c *Client) GetDatabasePasswordHook() func() (string, error) {
	return func() (string, error) {
		token, err := c.GetDatabaseToken()
		if err != nil {
			return "", err
		}
		return token.AuthToken, nil
	}
}

// LoadSecrets is a convenience function to load configuration into memory.
// It fails closed in production, honors TRYBASE_SECRET_KEYS, and falls back to os.Environ() in local dev.
func LoadSecrets() (map[string]string, error) {
	client := NewClient()

	if !client.IsAvailable() {
		if client.ShouldFailClosed() {
			return nil, fmt.Errorf("%w: socket %q not found, production must fail closed", ErrSocketUnavailable, client.socketPath)
		}
		// Local development fallback
		envMap := make(map[string]string)
		for _, e := range os.Environ() {
			parts := strings.SplitN(e, "=", 2)
			if len(parts) == 2 {
				envMap[parts[0]] = parts[1]
			}
		}
		return envMap, nil
	}

	// Scoped secret loading
	scopedKeys := os.Getenv("TRYBASE_SECRET_KEYS")
	if scopedKeys != "" {
		keys := strings.Split(scopedKeys, ",")
		secrets := make(map[string]string)
		for _, k := range keys {
			k = strings.TrimSpace(k)
			if k == "" {
				continue
			}
			val, err := client.GetSecret(k)
			if err != nil {
				if errors.Is(err, ErrSecretNotFound) {
					continue
				}
				if client.ShouldFailClosed() {
					return nil, err
				}
			} else {
				secrets[k] = val
			}
		}
		return secrets, nil
	}

	return client.GetSecrets()
}
