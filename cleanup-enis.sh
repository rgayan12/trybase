#!/bin/bash

# --- cleanup-enis.sh ---
# Specifically targets ENIs created by VPC-enabled Lambdas that block destruction.

SG_NAME="n8n-hosting-create-schema-lambda-sg"
REGION="${AWS_REGION:-eu-west-2}"

echo "🔍 Searching for orphaned ENIs linked to $SG_NAME..."

# 1. Get the Security Group ID
SG_ID=$(aws ec2 describe-security-groups --filters Name=group-name,Values=$SG_NAME --query "SecurityGroups[0].GroupId" --output text --region $REGION)

if [ "$SG_ID" == "None" ] || [ -z "$SG_ID" ]; then
    echo "❌ Could not find Security Group: $SG_NAME. (It might already be deleted.)"
    exit 0
fi

echo "✅ Found SG: $SG_ID"

# 2. Find all ENIs using this Security Group
ENI_IDS=$(aws ec2 describe-network-interfaces --filters Name=group-id,Values=$SG_ID --query "NetworkInterfaces[*].NetworkInterfaceId" --output text --region $REGION)

if [ -z "$ENI_IDS" ]; then
    echo "✅ No orphaned ENIs found. Terraform should be able to finish on its own."
    exit 0
fi

for ENI_ID in $ENI_IDS; do
    echo "🧨 Deleting ENI: $ENI_ID..."
    
    # Try to detach first (in case AWS hasn't released it)
    ATTACH_ID=$(aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --query "NetworkInterfaces[0].Attachment.AttachmentId" --output text --region $REGION)
    
    if [ "$ATTACH_ID" != "None" ] && [ ! -z "$ATTACH_ID" ]; then
        echo "   - Detaching first..."
        aws ec2 detach-network-interface --attachment-id $ATTACH_ID --force --region $REGION
        sleep 5
    fi

    # Delete the ENI
    aws ec2 delete-network-interface --network-interface-id $ENI_ID --region $REGION
    if [ $? -eq 0 ]; then
        echo "   - Successfully deleted $ENI_ID"
    else
        echo "   - ⚠️ Failed to delete $ENI_ID. It might still be in use by AWS."
    fi
done

echo "🏁 Cleanup finished. Try running your terraform command again!"
