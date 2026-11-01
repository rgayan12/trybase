# --- authorizer.tf ---

# 1. Zip the Authorizer code
data "archive_file" "authorizer_zip" {
  type        = "zip"
  source_file = "${path.module}/../lambda/authorizer/index.mjs"
  output_path = "${path.module}/authorizer.zip"
}

# 2. Secret for Supabase JWT Key
resource "aws_secretsmanager_secret" "supabase_jwt_secret" {
  name                    = "n8n-hosting/supabase-jwt-secret"
  description             = "Supabase JWT secret for custom Lambda authorizer"
  recovery_window_in_days = 0
}

# 3. Lambda Role
resource "aws_iam_role" "authorizer_lambda" {
  name = "n8n-authorizer-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "authorizer_logs" {
  role       = aws_iam_role.authorizer_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# 4. Authorizer Lambda Function
resource "aws_lambda_function" "authorizer" {
  filename         = data.archive_file.authorizer_zip.output_path
  function_name    = "n8n-api-authorizer"
  role             = aws_iam_role.authorizer_lambda.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  architectures    = ["arm64"]
  source_code_hash = data.archive_file.authorizer_zip.output_base64sha256

  environment {
    variables = {
      # Public key coordinates for ES256 verification
      SUPABASE_JWK_X = var.supabase_jwk_x
      SUPABASE_JWK_Y = var.supabase_jwk_y
    }
  }
}

# Allow API Gateway to invoke this lambda
resource "aws_lambda_permission" "apigw_authorizer" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.authorizer.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# 5. API Gateway Authorizer Resource
resource "aws_apigatewayv2_authorizer" "supabase_custom" {
  api_id                            = aws_apigatewayv2_api.main.id
  authorizer_type                   = "REQUEST"
  authorizer_uri                    = aws_lambda_function.authorizer.invoke_arn
  identity_sources                  = ["$request.header.Authorization"]
  name                              = "supabase-custom-auth"
  authorizer_payload_format_version = "2.0"
  enable_simple_responses           = true
  authorizer_result_ttl_in_seconds  = 300
}
