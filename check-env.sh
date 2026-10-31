#!/bin/bash

# ==============================================================================
# TryBase: Automated Environment & Pre-Flight Dependency Checker
# ==============================================================================

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "\n${BOLD}${CYAN}🔍 Checking TryBase workstation dependencies...${RESET}\n"

ERRORS=0
WARNINGS=0

# 1. Terraform
if command -v terraform &> /dev/null; then
    TF_VER=$(terraform version | head -n 1)
    echo -e " ${GREEN}[OK]${RESET} ${BOLD}terraform found:${RESET} ${TF_VER}"
else
    echo -e " ${RED}[FAIL]${RESET} ${BOLD}terraform missing:${RESET} Install via 'brew install terraform' or https://developer.hashicorp.com/terraform/downloads"
    ERRORS=$((ERRORS + 1))
fi

# 2. AWS CLI & Authentication
if command -v aws &> /dev/null; then
    AWS_VER=$(aws --version 2>&1 | head -n 1)
    echo -e " ${GREEN}[OK]${RESET} ${BOLD}aws cli found:${RESET} ${AWS_VER}"
    
    # Check AWS Auth
    if CALLER_IDENTITY=$(aws sts get-caller-identity --output text 2>/dev/null); then
        ACCOUNT_ID=$(echo "$CALLER_IDENTITY" | awk '{print $1}')
        ARN=$(echo "$CALLER_IDENTITY" | awk '{print $2}')
        echo -e "      ${CYAN}↳ AWS Identity:${RESET} Account ${BOLD}${ACCOUNT_ID}${RESET} (${ARN})"
    else
        echo -e "      ${YELLOW}⚠️  AWS credentials not active. Run 'aws configure' before deploying infra.${RESET}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e " ${RED}[FAIL]${RESET} ${BOLD}aws cli missing:${RESET} Install via 'brew install awscli' or https://aws.amazon.com/cli/"
    ERRORS=$((ERRORS + 1))
fi

# 3. Docker
if command -v docker &> /dev/null; then
    DOCKER_VER=$(docker --version)
    echo -e " ${GREEN}[OK]${RESET} ${BOLD}docker found:${RESET} ${DOCKER_VER}"
    if docker info >/dev/null 2>&1; then
        echo -e "      ${CYAN}↳ Docker daemon is running.${RESET}"
    else
        echo -e "      ${YELLOW}⚠️  Docker daemon is not running. Please start Docker Desktop.${RESET}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e " ${RED}[FAIL]${RESET} ${BOLD}docker missing:${RESET} Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    ERRORS=$((ERRORS + 1))
fi

# 4. Node.js
if command -v node &> /dev/null; then
    NODE_VER=$(node --version)
    echo -e " ${GREEN}[OK]${RESET} ${BOLD}node found:${RESET} ${NODE_VER}"
else
    echo -e " ${RED}[FAIL]${RESET} ${BOLD}node missing:${RESET} Install Node.js v18+ via 'brew install node@20'"
    ERRORS=$((ERRORS + 1))
fi

# 5. jq
if command -v jq &> /dev/null; then
    JQ_VER=$(jq --version)
    echo -e " ${GREEN}[OK]${RESET} ${BOLD}jq found:${RESET} ${JQ_VER}"
else
    echo -e " ${RED}[FAIL]${RESET} ${BOLD}jq missing:${RESET} Install via 'brew install jq'"
    ERRORS=$((ERRORS + 1))
fi

# 6. Supabase CLI (Optional / Fallback to npx)
if command -v supabase &> /dev/null; then
    SB_VER=$(supabase --version 2>&1 | head -n 1)
    echo -e " ${GREEN}[OK]${RESET} ${BOLD}supabase cli found:${RESET} v${SB_VER}"
else
    echo -e " ${YELLOW}[WARN]${RESET} ${BOLD}supabase cli:${RESET} Not installed globally (will fallback to 'npx supabase'). Install via 'brew install supabase/tap/supabase'"
    WARNINGS=$((WARNINGS + 1))
fi

# 7. Infracost (Optional FinOps)
if command -v infracost &> /dev/null; then
    INFRA_VER=$(infracost --version 2>&1 | head -n 1)
    echo -e " ${GREEN}[OK]${RESET} ${BOLD}infracost found:${RESET} ${INFRA_VER}"
else
    echo -e " ${YELLOW}[WARN]${RESET} ${BOLD}infracost (optional):${RESET} Install via 'brew install infracost' for 'make cost' FinOps forecasting"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✅ All required dependencies satisfied! Ready to deploy TryBase.${RESET}\n"
    exit 0
else
    echo -e "${RED}${BOLD}❌ Missing $ERRORS required dependenc(ies). Please install them and try again.${RESET}\n"
    exit 1
fi
