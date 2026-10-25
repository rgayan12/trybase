#!/bin/bash
set -e

# ==============================================================================
# TryBase: Tear Down Test Tenants
# Safely destroys ephemeral test tenants created by `make test-provision`
# without touching the core infrastructure (VPC, RDS, ALB, ECS Cluster).
# ==============================================================================

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

SPECIFIC_TENANT="$1"
S3_BUCKET="n8n-hosting-saas-tfstate"
TF_DIR="terraform"

echo -e "\n${BOLD}${RED}🧹 TryBase Test Tenant Teardown${RESET}\n"

# 1. Sync remote tenant configs first
if [ -f "./sync-tenants.sh" ]; then
    ./sync-tenants.sh
fi

cd "$TF_DIR"

# Ensure all downloaded modules are registered
echo "Registering modules with Terraform..."
terraform get > /dev/null 2>&1 || terraform init -reconfigure -backend=false > /dev/null 2>&1

# 2. Identify target files and modules
if [ -n "$SPECIFIC_TENANT" ] && [ "$SPECIFIC_TENANT" != "-y" ] && [ "$SPECIFIC_TENANT" != "--force" ]; then
    FILES=$(ls -1 tenant_${SPECIFIC_TENANT}.tf 2>/dev/null || true)
    if [ -z "$FILES" ]; then
        echo -e "${RED}❌ No tenant configuration found matching '${SPECIFIC_TENANT}'.${RESET}"
        exit 1
    fi
else
    FILES=$(ls -1 tenant_test-*.tf 2>/dev/null || true)
    if [ -z "$FILES" ]; then
        echo -e "${GREEN}✓ No test tenant configuration files found.${RESET}\n"
        exit 0
    fi
fi

echo -e "Found the following test tenant(s) to tear down:"
for f in $FILES; do
    echo -e "  ↳ ${YELLOW}${f}${RESET}"
done
echo ""

# 3. Confirmation prompt
if [ "$1" != "-y" ] && [ "$1" != "--force" ] && [ "$2" != "-y" ] && [ "$2" != "--force" ]; then
    read -p "Are you sure you want to destroy these test tenants? (y/N): " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo -e "\n${CYAN}Teardown cancelled.${RESET}\n"
        exit 0
    fi
fi

# 4. Build Terraform destroy targets
TARGET_ARGS=()
for f in $FILES; do
    TENANT_SLUG=$(echo "$f" | sed -e 's/^tenant_//' -e 's/\.tf$//')
    TARGET_ARGS+=("-target=module.${TENANT_SLUG}")
    
    # If it's an n8n tenant, also target its SecretsManager resources
    if grep -q "key_${TENANT_SLUG}" "$f"; then
        TARGET_ARGS+=("-target=aws_secretsmanager_secret.key_${TENANT_SLUG}")
        TARGET_ARGS+=("-target=aws_secretsmanager_secret_version.key_${TENANT_SLUG}")
        TARGET_ARGS+=("-target=random_password.key_${TENANT_SLUG}")
    fi
done

# Also check for any orphaned test modules in state
STATE_ORPHANS=$(terraform state list 2>/dev/null | grep -E '^module\.test-' | awk -F'.' '{print $1"."$2}' | sort -u || true)
for orphan in $STATE_ORPHANS; do
    if [[ ! " ${TARGET_ARGS[@]} " =~ " -target=${orphan} " ]]; then
        TARGET_ARGS+=("-target=${orphan}")
    fi
done

echo -e "\n${BOLD}Destroying cloud resources with Terraform...${RESET}"
terraform destroy "${TARGET_ARGS[@]}" -auto-approve

# 5. Clean up local files and remote S3 records
echo -e "\n${BOLD}Removing tenant configuration files...${RESET}"
for f in $FILES; do
    rm -f "$f"
    echo -e "  ✓ Removed local ${CYAN}${f}${RESET}"
    aws s3 rm "s3://${S3_BUCKET}/tenants/${f}" 2>/dev/null || true
    echo -e "  ✓ Removed S3 record ${CYAN}s3://${S3_BUCKET}/tenants/${f}${RESET}"
done

cd ..

echo -e "\n${GREEN}✅ Test tenants successfully torn down! Core infrastructure preserved.${RESET}\n"
