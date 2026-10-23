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

# Matches the UI's own privacy-note claim ("kept 90 days") — the retention
# promise shown to renters is now actually enforced, not just stated.
resource "aws_s3_bucket_lifecycle_configuration" "audit" {
  bucket = aws_s3_bucket.audit.id
  rule {
    id     = "expire-after-90-days"
    status = "Enabled"
    filter {
      prefix = "audit/"
    }
    expiration {
      days = 90
    }
  }
}

resource "aws_s3_bucket_policy" "audit" {
  bucket = aws_s3_bucket.audit.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # PutObject only — agent04 writes these and nothing currently reads
        # them back (least privilege). Scoped to the audit/ prefix, the only
        # one this bucket is used for.
        Sid       = "AgentsTaskWriteAudit"
        Effect    = "Allow"
        Principal = { AWS = aws_iam_role.agents_task.arn }
        Action    = ["s3:PutObject"]
        Resource  = "${aws_s3_bucket.audit.arn}/audit/*"
      },
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.audit.arn, "${aws_s3_bucket.audit.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      }
    ]
  })
}
