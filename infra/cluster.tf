resource "aws_ecs_cluster" "this" {
  name = var.project
}

# Classic Cloud Map DNS-based discovery (not Service Connect — its proxy sidecar
# wasn't getting injected for a client-only task and wasn't worth more debugging
# time). Produces real private DNS A-records; any task resolves them via the VPC's
# standard DNS resolver, no per-task opt-in required.
resource "aws_service_discovery_private_dns_namespace" "this" {
  name = "${var.project}.internal"
  vpc  = data.aws_vpc.default.id
}

resource "aws_service_discovery_service" "agents" {
  for_each = toset(["agent01-cv", "agent02-contract", "agent03-legal", "agent04-docs", "express-backend"])
  name     = each.key

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.this.id
    dns_records {
      ttl  = 10
      type = "A"
    }
    routing_policy = "MULTIVALUE"
  }
}

resource "aws_cloudwatch_log_group" "agents" {
  for_each          = toset(["agent01-cv", "agent02-contract", "agent03-legal", "agent04-docs", "express-backend", "nextjs-frontend"])
  name              = "/${var.project}/${each.key}"
  retention_in_days = 7
}

# Shared security group: all services can talk to each other (Service Connect) and
# to the internet (Bedrock, ECR pulls); only the ALB can reach nextjs-frontend's port.
resource "aws_security_group" "services" {
  name_prefix = "${var.project}-services-"
  vpc_id      = data.aws_vpc.default.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group_rule" "services_self_ingress" {
  type                     = "ingress"
  from_port                = 0
  to_port                  = 65535
  protocol                 = "tcp"
  security_group_id        = aws_security_group.services.id
  source_security_group_id = aws_security_group.services.id
}

# CloudFront is the only intended public entry point (see cloudfront.tf) — the
# ALB itself accepts ingress only from CloudFront's own edge IP range, not
# 0.0.0.0/0, so the plain-HTTP origin hop never touches the public internet
# and hitting the ALB's DNS name directly no longer works.
data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "alb" {
  name_prefix = "${var.project}-alb-"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 80
    to_port          = 80
    protocol         = "tcp"
    prefix_list_ids  = [data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group_rule" "alb_to_nextjs" {
  type                     = "ingress"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.services.id
  source_security_group_id = aws_security_group.alb.id
}
