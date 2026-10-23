locals {
  # NTT rule: AI must run on Bedrock — Groq/Typhoon are not allowed (see
  # docs/NTT_official_requirements.md and docs/handoff_tuey.md). The earlier
  # blanket SCP deny on bedrock:InvokeModel only ever covered native models;
  # retested 2026-10-24 and Amazon Nova now invokes successfully (text +
  # vision, confirmed live). Anthropic models remain blocked separately —
  # that path routes through an AWS Marketplace subscription this account's
  # role isn't authorized for (matches "Marketplace is blocked" in the
  # onboarding rules) — so Nova, not Claude, is the compliant model family
  # here. Groq/Gemini wiring (data sources below, unreferenced) is left
  # in place only as a last-resort manual fallback, not for normal use.
  bedrock_env = {
    VLM_PROVIDER = "bedrock"
    LLM_PROVIDER = "bedrock"
  }

  groq_secrets = [
    { name = "LLM_API_KEY", valueFrom = data.aws_ssm_parameter.groq_api_key.arn }
  ]
  gemini_secrets = [
    { name = "GEMINI_API_KEYS", valueFrom = data.aws_ssm_parameter.gemini_api_keys.arn }
  ]

  agents = {
    "agent01-cv" = {
      port          = 8001
      module        = "services.agent01_service:app"
      extra_env     = local.bedrock_env
      extra_secrets = []
    }
    "agent02-contract" = {
      port          = 8002
      module        = "services.agent02_service:app"
      extra_env     = local.bedrock_env
      extra_secrets = []
    }
    "agent03-legal" = {
      port          = 8003
      module        = "services.agent03_service:app"
      extra_env     = local.bedrock_env
      extra_secrets = []
    }
    "agent04-docs" = {
      port          = 8004
      module        = "services.agent04_service:app"
      extra_env     = merge(local.bedrock_env, { AUDIT_BUCKET = aws_s3_bucket.audit.bucket })
      extra_secrets = []
    }
  }
  ns = "${var.project}.internal"
}

data "aws_ssm_parameter" "groq_api_key" {
  name = "/roomwitness/groq_api_key"
}

data "aws_ssm_parameter" "gemini_api_keys" {
  name = "/roomwitness/gemini_api_keys"
}

resource "aws_ecs_task_definition" "agents" {
  for_each                 = local.agents
  family                   = "${var.project}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.exec.arn
  task_role_arn             = aws_iam_role.agents_task.arn

  container_definitions = jsonencode([{
    name      = each.key
    image     = "${aws_ecr_repository.agents.repository_url}:latest"
    essential = true
    command   = ["python", "-m", "uvicorn", each.value.module, "--host", "0.0.0.0", "--port", tostring(each.value.port)]
    portMappings = [{
      containerPort = each.value.port
      name          = each.key
    }]
    environment = concat([
      { name = "AWS_REGION", value = var.aws_region },
      { name = "BEDROCK_MODEL_ID", value = var.bedrock_model_id },
    ], [for k, v in each.value.extra_env : { name = k, value = v }])
    secrets = each.value.extra_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.agents[each.key].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = each.key
      }
    }
  }])
}

resource "aws_ecs_service" "agents" {
  for_each        = local.agents
  name            = "${var.project}-${each.key}"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.agents[each.key].arn
  desired_count   = 1
  launch_type     = "FARGATE"
  enable_execute_command = true

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.services.id]
    assign_public_ip = true
  }

  service_registries {
    registry_arn = aws_service_discovery_service.agents[each.key].arn
  }
}

# ── express-backend ──────────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "express" {
  family                   = "${var.project}-express-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.exec.arn
  task_role_arn            = aws_iam_role.web_task.arn

  container_definitions = jsonencode([{
    name      = "express-backend"
    image     = "${aws_ecr_repository.express.repository_url}:latest"
    essential = true
    portMappings = [{ containerPort = 3001, name = "express-backend" }]
    environment = [
      { name = "PORT", value = "3001" },
      { name = "AGENT_01_URL", value = "http://agent01-cv.${local.ns}:8001" },
      { name = "AGENT_02_URL", value = "http://agent02-contract.${local.ns}:8002" },
      { name = "AGENT_03_URL", value = "http://agent03-legal.${local.ns}:8003" },
      { name = "AGENT_04_URL", value = "http://agent04-docs.${local.ns}:8004" },
      { name = "MAX_FILE_SIZE_MB", value = "20" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.agents["express-backend"].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "express-backend"
      }
    }
  }])
}

resource "aws_ecs_service" "express" {
  name            = "${var.project}-express-backend"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.express.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  enable_execute_command = true

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.services.id]
    assign_public_ip = true
  }

  service_registries {
    registry_arn = aws_service_discovery_service.agents["express-backend"].arn
  }

  depends_on = [aws_ecs_service.agents]
}

# ── nextjs-frontend ───────────────────────────────────────────────────────────

resource "aws_ecs_task_definition" "nextjs" {
  family                   = "${var.project}-nextjs-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.exec.arn
  task_role_arn            = aws_iam_role.web_task.arn

  container_definitions = jsonencode([{
    name      = "nextjs-frontend"
    image     = "${aws_ecr_repository.nextjs.repository_url}:latest"
    essential = true
    portMappings = [{ containerPort = 3000, name = "nextjs-frontend" }]
    environment = [
      { name = "BACKEND_URL", value = "http://express-backend.${local.ns}:3001" },
      { name = "PORT", value = "3000" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.agents["nextjs-frontend"].name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "nextjs-frontend"
      }
    }
  }])
}

resource "aws_ecs_service" "nextjs" {
  name            = "${var.project}-nextjs-frontend"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.nextjs.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  enable_execute_command = true

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.services.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.nextjs.arn
    container_name    = "nextjs-frontend"
    container_port    = 3000
  }

  # No service_registries — nextjs isn't discovered by anything internally,
  # only reached via the ALB. Classic Cloud Map DNS (unlike Service Connect)
  # needs no client-side opt-in: any task resolves *.roomwitness.internal
  # via the VPC's standard DNS resolver automatically.
  depends_on = [aws_ecs_service.express, aws_lb_listener.http]
}
