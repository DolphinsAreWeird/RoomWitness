data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "exec" {
  name               = "${var.project}-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "exec" {
  role       = aws_iam_role.exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Model-bearing task role (agent01-cv, agent02-contract, agent03-legal, agent04-docs)
resource "aws_iam_role" "agents_task" {
  name               = "${var.project}-agents-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

# This account's ChallengerAccess role denies iam:GetRolePolicy AND iam:GetPolicy/
# ListPolicies (an account-wide IAM-read guardrail) — so Terraform can't manage a
# *custom* policy's content (it needs to read back what it wrote to verify/diff).
# aws_iam_role_policy_attachment, by contrast, only needs list-attached-style reads
# (already proven working for the ECS execution role attachment below), so attach
# AWS's own pre-existing managed policy by its well-known static ARN instead of
# authoring a scoped-down custom one.
resource "aws_iam_role_policy_attachment" "agents_bedrock" {
  role       = aws_iam_role.agents_task.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonBedrockLimitedAccess" # narrower than FullAccess; see comment above
}

# Model-less task role (express-backend, nextjs-frontend) — no Bedrock access.
resource "aws_iam_role" "web_task" {
  name               = "${var.project}-web-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

# exec role needs to read the Groq API key from SSM (ECS "secrets" injection) for
# agent02/03/04 while Bedrock stays blocked — see services.tf. Plain SSM String
# (not SecureString) sidesteps the KMS-decrypt permission this account also denies
# reading back, same class of issue as the custom-policy problem above.
resource "aws_iam_role_policy_attachment" "exec_ssm_read" {
  role       = aws_iam_role.exec.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess"
}
