import os
import unittest
from unittest.mock import MagicMock, patch
from trybase_secrets import TryBaseClient, TryBaseError, load_secrets


class TestTryBasePythonClient(unittest.TestCase):
    def setUp(self):
        self.original_env = dict(os.environ)

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.original_env)

    def test_fail_closed_in_production(self):
        """Production environment must fail closed when socket does not exist."""
        os.environ["ENVIRONMENT"] = "production"
        os.environ["TRYBASE_SOCKET_PATH"] = "/tmp/non_existent_socket_test.sock"
        os.environ.pop("TRYBASE_LOCAL_FALLBACK", None)

        client = TryBaseClient()
        self.assertTrue(client.should_fail_closed())
        with self.assertRaises(TryBaseError) as ctx:
            load_secrets()
        self.assertIn("must fail closed", str(ctx.exception))

    def test_local_fallback_allowed(self):
        """When TRYBASE_LOCAL_FALLBACK=true, local environment fallback is permitted."""
        os.environ["TRYBASE_LOCAL_FALLBACK"] = "true"
        os.environ["TRYBASE_SOCKET_PATH"] = "/tmp/non_existent_socket_test.sock"
        os.environ["LOCAL_TEST_VAR"] = "local_value"

        client = TryBaseClient()
        self.assertFalse(client.should_fail_closed())
        secrets = load_secrets()
        self.assertEqual(secrets.get("LOCAL_TEST_VAR"), "local_value")

    def test_session_token_caching(self):
        """Session tokens must be cached in memory during their TTL to avoid excessive PUT requests."""
        client = TryBaseClient(socket_path="/var/run/trybase/secrets.sock")
        
        with patch.object(client, "_get_connection") as mock_get_conn:
            mock_conn = MagicMock()
            mock_res = MagicMock()
            mock_res.status = 200
            mock_res.read.return_value = b"test_session_token_abc"
            mock_conn.getresponse.return_value = mock_res
            mock_get_conn.return_value = mock_conn

            # First call fetches token via PUT
            token1 = client.get_session_token(ttl_seconds=60)
            self.assertEqual(token1, "test_session_token_abc")
            self.assertEqual(mock_conn.request.call_count, 1)

            # Second call within TTL reuses cached token (no second PUT request!)
            token2 = client.get_session_token(ttl_seconds=60)
            self.assertEqual(token2, "test_session_token_abc")
            self.assertEqual(mock_conn.request.call_count, 1)

    def test_scoped_secret_loading(self):
        """TRYBASE_SECRET_KEYS must only fetch the declared keys individually."""
        os.environ["TRYBASE_SECRET_KEYS"] = "KEY1,KEY2"
        
        with patch.object(TryBaseClient, "is_available", return_value=True):
            with patch.object(TryBaseClient, "get_secret") as mock_get_secret:
                mock_get_secret.side_effect = lambda k: f"val_for_{k}"
                secrets = load_secrets()
                self.assertEqual(secrets, {"KEY1": "val_for_KEY1", "KEY2": "val_for_KEY2"})
                self.assertEqual(mock_get_secret.call_count, 2)

    def test_database_connection_params_enforces_tls(self):
        """Database connection params must enforce verify-full TLS and inject RDS IAM credentials."""
        client = TryBaseClient()
        mock_token_info = {
            "db_host": "postgres.internal.vpc",
            "db_port": 5432,
            "db_user": "usr_python_app",
            "db_name": "trybase_db",
            "auth_token": "sigv4_token_xyz",
            "ttl_seconds": 900,
        }
        with patch.object(client, "get_database_token", return_value=mock_token_info):
            params = client.get_database_connection_params({"CONN_MAX_AGE": 600})
            self.assertEqual(params["password"], "sigv4_token_xyz")
            self.assertEqual(params["host"], "postgres.internal.vpc")
            self.assertEqual(params["sslmode"], "verify-full")
            self.assertEqual(params["CONN_MAX_AGE"], 600)


if __name__ == "__main__":
    unittest.main()
