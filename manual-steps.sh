#!/bin/bash

# ------------------------------------------------------------------------------
# MANUAL STEPS FOR BOOTSTRAPPING / DEBUGGING A TENANT
# Use this script to retrieve credentials and access the RDS database
# through the Bastion jump host.
# ------------------------------------------------------------------------------

echo "--- Step 1: Get Database Credentials ---"
echo "Run the following command to retrieve the RDS master password:"
echo "aws secretsmanager get-secret-value --secret-id \$(terraform -chdir=terraform output -raw db_credentials_secret_arn) --query SecretString --output text"
echo ""
read -p "Press enter to continue after you have the password..."
echo ""

echo "--- Step 2: Connect to the Bastion Host ---"
echo "Retrieve the bastion IP with: terraform -chdir=terraform output -raw bastion_public_ip"
echo "Example SSH command:"
echo "ssh -i \"~/.ssh/your-key.pem\" ec2-user@<BASTION_IP>"
echo ""
echo "Once connected to the bastion, run the following commands:"
echo ""
echo "1. Install postgresql client on Amazon Linux 2:"
echo "   sudo amazon-linux-extras enable postgresql14"
echo "   sudo yum clean metadata"
echo "   sudo yum install -y postgresql"
echo ""
echo "2. Connect to RDS using SSL:"
echo "   PGPASSWORD='<YOUR_PASSWORD>' PGSSLMODE=require psql -h <DB_HOSTNAME> -U n8nmaster -d postgres"
echo ""
echo "3. Query or create tenant schemas:"
echo "   \\dn"
echo "   CREATE SCHEMA \"my_tenant_slug\";"
echo ""