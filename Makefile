.PHONY: all check-env bootstrap control-plane infra deploy web destroy cost sync clean test-provision help

help:
	@echo "TryBase CLI Commands:"
	@echo "  make check-env      Verify workstation dependencies (terraform, aws, docker, node, jq)"
	@echo "  make bootstrap      Provision S3 & DynamoDB remote state backend"
	@echo "  make control-plane  Deploy Supabase migrations & Edge Functions (Command 1/2)"
	@echo "  make infra          Deploy AWS Fleet with Terraform (Command 2/2)"
	@echo "  make web            Start the local React web dashboard (UI)"
	@echo "  make cost           Forecast cloud infrastructure costs with Infracost"
	@echo "  make destroy        Tear down AWS Fleet infrastructure cleanly"
	@echo "  make all            Deploy both Control Plane and AWS Fleet"
	@echo "  make sync           Sync remote tenant state from S3 to local Git"
	@echo "  make test-provision Test provisioning workloads (WORKLOAD=hello|n8n|dify|agent|all)"
	@echo "  make clean-test-tenants Tear down ephemeral test tenants safely"
	@echo "  make clean          Clean orphaned AWS Lambda ENIs"

check-env:
	@./check-env.sh

bootstrap:
	@echo "\n\033[1;36m🚀 Bootstrapping Terraform Remote State Backend (S3 & DynamoDB)...\033[0m"
	@cd terraform/setup-backend && terraform init && terraform apply -auto-approve
	@echo "\n\033[1;32m✅ Remote state backend is ready.\033[0m\n"

control-plane:
	@./deploy-control-plane.sh $(REF)$(URL)

infra:
	@./deploy-infra.sh

deploy: infra

web:
	@echo "\n\033[1;36m🚀 Starting TryBase Web Dashboard...\033[0m"
	@echo "  ➜ Local Console: \033[1;32mhttp://localhost:5173/\033[0m"
	@echo "  ➜ Documentation: \033[1;32mhttp://localhost:5173/docs\033[0m\n"
	@cd web && ([ -d node_modules ] || npm install) && npm run dev

destroy:
	@./destroy-infra.sh

cost:
	@if command -v infracost >/dev/null 2>&1; then \
		infracost breakdown --path terraform/; \
	else \
		echo "\n\033[1;33m⚠️  Infracost is not installed.\033[0m"; \
		echo "Install Infracost (Apache 2.0) to forecast exact cloud costs:"; \
		echo "  brew install infracost   (macOS)"; \
		echo "  curl -fsSL https://raw.githubusercontent.com/infracost/infracost/master/scripts/install.sh | sh  (Linux)"; \
		echo "Then run: 'infracost auth login' and retry 'make cost'.\n"; \
	fi

all: control-plane infra

sync:
	@./sync-tenants.sh

test-provision:
	@./tests/test_api_provisioning.sh $(WORKLOAD)

clean-test-tenants:
	@./teardown-test-tenants.sh $(TENANT)

clean:
	@./cleanup-enis.sh
