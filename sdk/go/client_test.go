package trybase

import (
	"errors"
	"os"
	"testing"
)

func TestFailClosedInProduction(t *testing.T) {
	os.Setenv("ENV", "production")
	os.Setenv("TRYBASE_SOCKET_PATH", "/tmp/non_existent_go_test.sock")
	os.Unsetenv("TRYBASE_LOCAL_FALLBACK")
	defer func() {
		os.Unsetenv("ENV")
		os.Unsetenv("TRYBASE_SOCKET_PATH")
	}()

	client := NewClient()
	if !client.ShouldFailClosed() {
		t.Fatal("expected ShouldFailClosed() to be true in production")
	}

	_, err := LoadSecrets()
	if err == nil {
		t.Fatal("expected LoadSecrets() to fail closed with error, got nil")
	}
	if !errors.Is(err, ErrSocketUnavailable) {
		t.Fatalf("expected ErrSocketUnavailable, got: %v", err)
	}
}

func TestLocalFallbackAllowed(t *testing.T) {
	os.Setenv("TRYBASE_LOCAL_FALLBACK", "true")
	os.Setenv("TRYBASE_SOCKET_PATH", "/tmp/non_existent_go_test.sock")
	os.Setenv("GO_TEST_VAR", "go_val")
	defer func() {
		os.Unsetenv("TRYBASE_LOCAL_FALLBACK")
		os.Unsetenv("TRYBASE_SOCKET_PATH")
		os.Unsetenv("GO_TEST_VAR")
	}()

	client := NewClient()
	if client.ShouldFailClosed() {
		t.Fatal("expected ShouldFailClosed() to be false when fallback is true")
	}

	secrets, err := LoadSecrets()
	if err != nil {
		t.Fatalf("unexpected error during fallback: %v", err)
	}
	if secrets["GO_TEST_VAR"] != "go_val" {
		t.Fatalf("expected GO_TEST_VAR to be go_val, got: %s", secrets["GO_TEST_VAR"])
	}
}

func TestDatabasePasswordHook(t *testing.T) {
	client := NewClient()
	hook := client.GetDatabasePasswordHook()
	if hook == nil {
		t.Fatal("expected non-nil password hook")
	}
}
