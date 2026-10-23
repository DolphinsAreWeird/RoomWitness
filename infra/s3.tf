# Audit trail for Responsible AI / safety (judging criterion 4): one JSON
# record per case — inputs, cited law, verdicts — written by agent04-docs.
# Access is granted via a bucket policy (not an IAM identity policy) because
# this account's ChallengerAccess role can write IAM policies but is denied
# reading them back, which Terraform needs to manage anything attached to
# the role itself (see iam.tf). A bucket policy is S3-side and isn't gated
# by that restriction.
resource "aws_s3_bucket" "audit" {
  bucket = "${var.project}-audit-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "audit" {
  bucket                  = aws_s3_bucket.audit.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "audit" {
  bucket = aws_s3_bucket.audit.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AgentsTaskWriteAudit"
      Effect    = "Allow"
      Principal = { AWS = aws_iam_role.agents_task.arn }
      Action    = ["s3:PutObject", "s3:GetObject"]
      Resource  = "${aws_s3_bucket.audit.arn}/*"
    }]
  })
}
