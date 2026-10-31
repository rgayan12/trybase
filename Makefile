.PHONY: all doctor check-env bootstrap control-plane infra deploy up web destroy cost sync clean test-provision help

help:
	@echo "TryBase Unified CLI & Make Commands:"
	@echo "  trybase doctor        (or make doctor)        Verify workstation dependencies"
	@echo "  trybase bootstrap     (or make bootstrap)     Provision S3 & DynamoDB remote state backend"
	@echo "  trybase control-plane (or make control-plane) Deploy Supabase migrations & Edge Functions"
	@echo "  trybase infra         (or make infra)         Deploy AWS Fleet with Terraform"
	@echo "  trybase up            (or make up)            One-shot deploy: Control Plane + AWS Fleet"
	@echo "  trybase web           (or make web)           Start the local React web dashboard & docs"
	@echo "  trybase cost          (or make cost)          Forecast cloud infrastructure spend with Infracost"
	@echo "  trybase destroy       (or make destroy)       Tear down AWS Fleet infrastructure cleanly"
	@echo "  trybase sync          (or make sync)          Sync remote tenant state from S3 to local Git"

doctor:
	@command -v trybase >/dev/null 2>&1 && trybase doctor || ./check-env.sh

check-env: doctor

bootstrap:
	@command -v trybase >/dev/null 2>&1 && trybase bootstrap || (cd terraform/setup-backend && terraform init && terraform apply -auto-approve)

control-plane:
	@command -v trybase >/dev/null 2>&1 && trybase control-plane $(REF)$(URL) || ./deploy-control-plane.sh $(REF)$(URL)

infra:
	@command -v trybase >/dev/null 2>&1 && trybase infra || ./deploy-infra.sh

deploy: infra

up:
	@command -v trybase >/dev/null 2>&1 && trybase up || (./deploy-control-plane.sh && ./deploy-infra.sh)

all: up

web:
	@command -v trybase >/dev/null 2>&1 && trybase web || (cd web && ([ -d node_modules ] || npm install) && npm run dev)

destroy:
	@command -v trybase >/dev/null 2>&1 && trybase destroy || ./destroy-infra.sh

cost:
	@command -v trybase >/dev/null 2>&1 && trybase cost || (infracost breakdown --path terraform/)

sync:
	@command -v trybase >/dev/null 2>&1 && trybase sync || ./sync-tenants.sh

cli:
	@echo "\n\033[1;36m🔨 Building & linking TryBase CLI (@trybase/cli)...\033[0m"
	@npm --prefix packages/trybase-cli run build
	@npm --prefix packages/trybase-cli link
	@echo "\n\033[1;32m✅ TryBase CLI is up to date and linked globally.\033[0m\n"

test-provision:
	@./tests/test_api_provisioning.sh $(WORKLOAD)

clean-test-tenants:
	@./teardown-test-tenants.sh $(TENANT)

clean:
	@./cleanup-enis.sh
