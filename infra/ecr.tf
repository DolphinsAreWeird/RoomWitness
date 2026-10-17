resource "aws_ecr_repository" "agents" {
  name = "${var.project}-agents"
}

resource "aws_ecr_repository" "express" {
  name = "${var.project}-express-backend"
}

resource "aws_ecr_repository" "nextjs" {
  name = "${var.project}-nextjs-frontend"
}
