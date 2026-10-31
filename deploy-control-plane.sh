#!/bin/bash
set -e

# ==============================================================================
# TryBase: Deploy Control Plane (Command 1 of 2)
# Applies Supabase database migrations, deploys Edge Functions, and prepares config.
# ==============================================================================

BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "\n${BOLD}${CYAN}🚀 [1/2] Deploying TryBase Control Plane (Supabase)...${RESET}\n"

# 1. Check for Supabase CLI
if command -v supabase &> /dev/null; then
    SUPABASE_CMD="supabase"
else
    echo -e "${YELLOW}ℹ️  Local supabase CLI not found. Falling back to npx...${RESET}"
    SUPABASE_CMD="npx -y supabase"
fi

extract_ref() {
    local input="$1"
    echo "$input" | sed -E 's|.*https://([a-zA-Z0-9_-]+)\.supabase\.co.*|\1|' \
                  | sed -E 's|.*https://supabase\.com/dashboard/project/([a-zA-Z0-9_-]+).*|\1|' \
                  | tr -d '[:space:]'
}

# 2. Check Supabase CLI Authentication
echo -e "${BOLD}Checking Supabase CLI authentication...${RESET}"
if ! $SUPABASE_CMD projects list >/dev/null 2>&1; then
    echo -e "${YELLOW}🔑 You are not logged into the Supabase CLI.${RESET}"
    echo -e "Starting Supabase CLI login... (or set SUPABASE_ACCESS_TOKEN)\n"
    $SUPABASE_CMD login
fi
echo -e "${GREEN}✅ Authenticated with Supabase CLI.${RESET}"

# 3. Check Project Linking
TFVARS="terraform/terraform.tfvars"
EXPECTED_REF=""
REF_SOURCE=""

# Check command line argument or environment variable first
CLI_INPUT="${1:-$PROJECT_REF}"
CLI_INPUT="${CLI_INPUT:-$SUPABASE_URL}"
if [ -n "$CLI_INPUT" ]; then
    EXPECTED_REF=$(extract_ref "$CLI_INPUT")
    REF_SOURCE="command-line argument"
fi

if [ -z "$EXPECTED_REF" ] && [ -f "$TFVARS" ]; then
    EXPECTED_REF=$(grep -E "^[[:space:]]*supabase_url" "$TFVARS" 2>/dev/null | sed -E 's/.*https:\/\/([a-zA-Z0-9_-]+)\.supabase\.co.*/\1/' || true)
    if [ -n "$EXPECTED_REF" ]; then
        REF_SOURCE="terraform/terraform.tfvars"
    fi
fi

# Fallback to web/.env.local if not set in terraform.tfvars
if [ -z "$EXPECTED_REF" ] && [ -f "web/.env.local" ]; then
    CANDIDATE_REF=$(grep -E "^[[:space:]]*(VITE_)?SUPABASE_URL" "web/.env.local" 2>/dev/null | sed -E 's/.*https:\/\/([a-zA-Z0-9_-]+)\.supabase\.co.*/\1/' || true)
    if [ -n "$CANDIDATE_REF" ] && [ "$CANDIDATE_REF" != "your-project" ]; then
        EXPECTED_REF="$CANDIDATE_REF"
        REF_SOURCE="web/.env.local"
    fi
fi

CURRENT_REF=""
if [ -f "supabase/.temp/project-ref" ]; then
    CURRENT_REF=$(cat supabase/.temp/project-ref 2>/dev/null || echo "")
fi

echo -e "${BOLD}Checking Supabase project connection...${RESET}"

# Verify if cached project has been removed from Supabase
if [ -n "$CURRENT_REF" ]; then
    if ! $SUPABASE_CMD projects list 2>/dev/null | grep -q "$CURRENT_REF"; then
        echo -e "${YELLOW}⚠️  Project '${CURRENT_REF}' has been removed from Supabase.${RESET}"
        rm -rf supabase/.temp
        CURRENT_REF=""
        EXPECTED_REF=""
    fi
fi

# If expected ref differs from current cached ref, clean stale cache
if [ -n "$EXPECTED_REF" ] && [ -n "$CURRENT_REF" ] && [ "$EXPECTED_REF" != "$CURRENT_REF" ]; then
    echo -e "${YELLOW}Detected project change (${EXPECTED_REF} from ${REF_SOURCE} vs cached ${CURRENT_REF}). Resetting stale project cache...${RESET}"
    rm -rf supabase/.temp
    CURRENT_REF=""
fi

prompt_for_url() {
    echo -e "${YELLOW}Please enter your Supabase Project Reference ID or full URL:${RESET}"
    echo -e "e.g. ${CYAN}https://<project-ref>.supabase.co${RESET} or ${CYAN}https://supabase.com/dashboard/project/<project-ref>${RESET}\n"
    read -p "Enter Supabase Project Ref or URL: " USER_INPUT
    PROJECT_REF=$(extract_ref "$USER_INPUT")
    if [ -z "$PROJECT_REF" ]; then
        echo -e "${RED}❌ Error: A valid Project Reference or URL is required.${RESET}"
        exit 1
    fi
    rm -rf supabase/.temp
    echo -e "\nLinking to project ${CYAN}$PROJECT_REF${RESET}..."
    $SUPABASE_CMD link --project-ref "$PROJECT_REF"
}

if [ -z "$CURRENT_REF" ]; then
    if [ -n "$EXPECTED_REF" ]; then
        PROJECT_REF="$EXPECTED_REF"
        echo -e "Using Supabase project ref from ${REF_SOURCE}: ${CYAN}$PROJECT_REF${RESET}"
        set +e
        $SUPABASE_CMD link --project-ref "$PROJECT_REF"
        LINK_EXIT=$?
        set -e
        if [ $LINK_EXIT -ne 0 ]; then
            prompt_for_url
        fi
    else
        prompt_for_url
    fi

    # Keep web/.env.local and terraform.tfvars in sync with the active linked ref
    if [ -f "web/.env.local" ] && grep -q "SUPABASE_URL" "web/.env.local"; then
        sed -i '' -E "s|https://[a-zA-Z0-9_-]+\.supabase\.co|https://${PROJECT_REF}.supabase.co|g" web/.env.local 2>/dev/null || true
    fi
    if [ -f "terraform/terraform.tfvars" ] && grep -q "supabase_url" "terraform/terraform.tfvars"; then
        sed -i '' -E "s|https://[a-zA-Z0-9_-]+\.supabase\.co|https://${PROJECT_REF}.supabase.co|g" terraform/terraform.tfvars 2>/dev/null || true
    fi
else
    PROJECT_REF="$CURRENT_REF"
    echo -e "✅ Found linked project: ${CYAN}${PROJECT_REF}${RESET}"
fi

# 3. Apply Database Migrations (Workspaces table, RLS policies)
echo -e "\n${BOLD}Applying database migrations to Supabase...${RESET}"
set +e
$SUPABASE_CMD db push
PUSH_EXIT=$?
set -e

if [ $PUSH_EXIT -ne 0 ]; then
    echo -e "\n${YELLOW}⚠️  Migration failed. The project resource may have been removed.${RESET}"
    prompt_for_url
    # Update config files
    if [ -f "web/.env.local" ] && grep -q "SUPABASE_URL" "web/.env.local"; then
        sed -i '' -E "s|https://[a-zA-Z0-9_-]+\.supabase\.co|https://${PROJECT_REF}.supabase.co|g" web/.env.local 2>/dev/null || true
    fi
    if [ -f "terraform/terraform.tfvars" ] && grep -q "supabase_url" "terraform/terraform.tfvars"; then
        sed -i '' -E "s|https://[a-zA-Z0-9_-]+\.supabase\.co|https://${PROJECT_REF}.supabase.co|g" terraform/terraform.tfvars 2>/dev/null || true
    fi
    echo -e "\n${BOLD}Retrying database migrations to ${CYAN}${PROJECT_REF}${RESET}...${RESET}"
    $SUPABASE_CMD db push
fi
echo -e "${GREEN}✅ Database migrations applied successfully.${RESET}"

# 4. Deploy Edge Functions
echo -e "\n${BOLD}Deploying Supabase Edge Functions...${RESET}"

echo -e "  → Deploying on-provision-success..."
$SUPABASE_CMD functions deploy on-provision-success --no-verify-jwt

echo -e "  → Deploying verify-checkout..."
$SUPABASE_CMD functions deploy verify-checkout --no-verify-jwt

echo -e "  → Deploying create-portal-session..."
$SUPABASE_CMD functions deploy create-portal-session

echo -e "${GREEN}✅ All Edge Functions deployed successfully.${RESET}"

# 5. Check / Set Environment Secrets
echo -e "\n${BOLD}Checking Edge Function secrets...${RESET}"
echo -e "Tip: You can set Stripe & Resend keys anytime with:"
echo -e "  ${CYAN}supabase secrets set STRIPE_SECRET_KEY=sk_... RESEND_API_KEY=re_...${RESET}"

# 6. Synchronize configuration to terraform.tfvars
TFVARS="terraform/terraform.tfvars"
if [ ! -f "$TFVARS" ]; then
    echo -e "\nCreating ${CYAN}$TFVARS${RESET} from example template..."
    cp terraform/terraform.tfvars.example "$TFVARS"
fi

if [ -n "$PROJECT_REF" ]; then
    SUPA_URL="https://${PROJECT_REF}.supabase.co"
    # Update supabase_url in terraform.tfvars if present
    if grep -q "supabase_url" "$TFVARS"; then
        sed -i.bak "s|supabase_url.*=.*|supabase_url   = \"$SUPA_URL\"|g" "$TFVARS" && rm -f "${TFVARS}.bak"
    else
        echo -e "\nsupabase_url   = \"$SUPA_URL\"" >> "$TFVARS"
    fi
    echo -e "✅ Updated ${CYAN}$TFVARS${RESET} with supabase_url = ${CYAN}$SUPA_URL${RESET}"
fi

echo -e "\n=================================================================="
echo -e "${BOLD}${GREEN}🎉 Step 1 Complete: Control Plane is Live!${RESET}"
echo -e "=================================================================="
echo -e "Next step: Deploy your AWS fleet infrastructure with:"
echo -e "\n  ${BOLD}${CYAN}./deploy-infra.sh${RESET}\n  or ${BOLD}${GREEN}make infra${RESET}\n"
