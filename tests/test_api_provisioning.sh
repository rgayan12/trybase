#!/bin/bash
set -e

# ==============================================================================
# TryBase: Automated API / Step Function Workload Provisioning Test Suite
#
# Tests the 4 core workload archetypes:
#   1. hello   - Generic Container (nginxdemos/hello on private Fargate)
#   2. n8n     - Workflow automation (Schema-per-tenant on RDS)
#   3. dify    - AI Agent Studio (Dedicated DB + pgvector)
#   4. agent   - Keyless Bedrock Agent (Dedicated IAM Task Role + STS)
#
# Usage:
#   ./tests/test_api_provisioning.sh [hello|n8n|dify|agent|all]
# ==============================================================================

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

TARGET_WORKLOAD="${1:-all}"
TIMESTAMP=$(date +%s | tail -c 5)

echo -e "\n${BOLD}${CYAN}🧪 TryBase Control Plane: Automated Provisioning Test Suite${RESET}"
echo -e "Target Workload: ${YELLOW}${TARGET_WORKLOAD}${RESET}\n"

# 1. Verify AWS Authentication
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI is not authenticated. Please run 'aws configure'.${RESET}"
    exit 1
fi
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
REGION=$(aws configure get region || echo "eu-west-2")
echo -e "✓ Connected to AWS Account: ${CYAN}${ACCOUNT_ID}${RESET} (Region: ${CYAN}${REGION}${RESET})"

# 2. Locate Step Function State Machine ARN
echo -e "Finding Step Function State Machine..."
SFN_ARN=$(aws stepfunctions list-state-machines --region "$REGION" \
    --query "stateMachines[?contains(name, 'provision')].stateMachineArn | [0]" \
    --output text)

if [ -z "$SFN_ARN" ] || [ "$SFN_ARN" == "None" ]; then
    echo -e "${RED}❌ Could not locate the TryBase provisioning Step Function in region ${REGION}.${RESET}"
    echo -e "Make sure you have deployed base infrastructure using 'make deploy'."
    exit 1
fi
echo -e "✓ Found State Machine: ${CYAN}${SFN_ARN}${RESET}\n"

# 3. Determine base domain from terraform if available
BASE_DOMAIN="n8n.trybase.io"
if [ -f "terraform/terraform.tfvars" ]; then
    EXTRACTED_DOMAIN=$(grep 'base_domain' terraform/terraform.tfvars | awk -F'=' '{print $2}' | tr -d ' "' || true)
    if [ -n "$EXTRACTED_DOMAIN" ]; then
        BASE_DOMAIN="$EXTRACTED_DOMAIN"
    fi
fi

# Define test runner function
run_workload_test() {
    local WORKLOAD="$1"
    local PRIORITY="$2"
    local TENANT_ID="test-${WORKLOAD}-${TIMESTAMP}"
    local EXEC_NAME="test-${WORKLOAD}-${TIMESTAMP}"

    echo -e "────────────────────────────────────────────────────────────────"
    echo -e "${BOLD}🚀 Starting Provisioning Test: ${CYAN}${WORKLOAD}${RESET} (Tenant: ${YELLOW}${TENANT_ID}${RESET})"
    echo -e "────────────────────────────────────────────────────────────────"

    INPUT_JSON=$(cat <<EOF
{
  "tenant_id": "$TENANT_ID",
  "workload_type": "$WORKLOAD",
  "alb_listener_rule_priority": $PRIORITY
}
EOF
)

    echo -e "Dispatching execution to Step Function..."
    EXEC_ARN=$(aws stepfunctions start-execution \
        --region "$REGION" \
        --state-machine-arn "$SFN_ARN" \
        --name "$EXEC_NAME" \
        --input "$INPUT_JSON" \
        --query 'executionArn' \
        --output text)

    echo -e "Execution ARN: ${CYAN}${EXEC_ARN}${RESET}"
    echo -e "Waiting for Step Function to orchestrate CodeBuild & Database..."

    START_TIME=$(date +%s)
    STATUS="RUNNING"

    while [ "$STATUS" == "RUNNING" ]; do
        sleep 10
        ELAPSED=$(( $(date +%s) - START_TIME ))
        STATUS=$(aws stepfunctions describe-execution --region "$REGION" --execution-arn "$EXEC_ARN" --query 'status' --output text)
        echo -e "  ↳ Status: ${YELLOW}${STATUS}${RESET} (Elapsed: ${ELAPSED}s)"
    done

    TOTAL_TIME=$(( $(date +%s) - START_TIME ))

    if [ "$STATUS" == "SUCCEEDED" ]; then
        echo -e "\n${GREEN}✅ PASS: ${WORKLOAD} provisioned successfully in ${TOTAL_TIME}s!${RESET}"
        
        SUBDOMAIN_SUFFIX="n8n"
        if [ "$WORKLOAD" == "dify" ]; then
            SUBDOMAIN_SUFFIX="dify"
        elif [ "$WORKLOAD" == "agent" ] || [ "$WORKLOAD" == "hello" ]; then
            SUBDOMAIN_SUFFIX="agent"
        fi

        ENDPOINT="https://${TENANT_ID}.${BASE_DOMAIN}"
        echo -e "Live Endpoint: ${CYAN}${ENDPOINT}${RESET}"
        ALB_HOST=$(aws elbv2 describe-load-balancers --region "$REGION" --query 'LoadBalancers[0].DNSName' --output text 2>/dev/null || echo "")
        echo -e "Probing ALB endpoint (waiting for Fargate container health check)..."
        
        PROBE_PATH="/"
        if [ "$WORKLOAD" == "dify" ]; then
            PROBE_PATH="/health"
        fi

        HTTP_CODE="000"
        for i in {1..12}; do
            HTTP_CODE=$(curl -s -k -o /dev/null -w "%{http_code}" -H "Host: ${TENANT_ID}.${BASE_DOMAIN}" "https://${ALB_HOST}${PROBE_PATH}" 2>/dev/null || echo "000")
            if [[ "$HTTP_CODE" =~ ^[23] ]]; then
                break
            fi
            sleep 5
        done
        echo -e "HTTP Response Code: ${GREEN}${HTTP_CODE}${RESET}"
        
        if [ "$WORKLOAD" == "dify" ]; then
            HEALTH_PAYLOAD=$(curl -s -k -H "Host: ${TENANT_ID}.${BASE_DOMAIN}" "https://${ALB_HOST}/health" 2>/dev/null || echo "")
            echo -e "Dify API Health Status: ${CYAN}${HEALTH_PAYLOAD}${RESET}\n"
        else
            echo ""
        fi
        return 0
    else
        echo -e "\n${RED}❌ FAIL: ${WORKLOAD} failed with status: ${STATUS}${RESET}"
        echo -e "Error Cause:"
        aws stepfunctions describe-execution --region "$REGION" --execution-arn "$EXEC_ARN" --query 'cause' --output text || true
        echo ""
        return 1
    fi
}

# Run selected tests
FAILED=0
# Use a dynamic priority range (1000-4000) to avoid collisions with existing or aborted test rules
PRIORITY_BASE=$(( (RANDOM % 3000) + 1000 ))

if [ "$TARGET_WORKLOAD" == "all" ] || [ "$TARGET_WORKLOAD" == "hello" ]; then
    run_workload_test "hello" $((PRIORITY_BASE + 1)) || FAILED=$((FAILED + 1))
fi

if [ "$TARGET_WORKLOAD" == "all" ] || [ "$TARGET_WORKLOAD" == "n8n" ]; then
    run_workload_test "n8n" $((PRIORITY_BASE + 2)) || FAILED=$((FAILED + 1))
fi

if [ "$TARGET_WORKLOAD" == "all" ] || [ "$TARGET_WORKLOAD" == "dify" ]; then
    run_workload_test "dify" $((PRIORITY_BASE + 3)) || FAILED=$((FAILED + 1))
fi

if [ "$TARGET_WORKLOAD" == "all" ] || [ "$TARGET_WORKLOAD" == "agent" ]; then
    run_workload_test "agent" $((PRIORITY_BASE + 4)) || FAILED=$((FAILED + 1))
fi

echo -e "================================================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}${BOLD}🎉 ALL PROVISIONING TESTS PASSED!${RESET}"
    exit 0
else
    echo -e "${RED}${BOLD}⚠️  ${FAILED} test(s) failed. Check logs above.${RESET}"
    exit 1
fi
