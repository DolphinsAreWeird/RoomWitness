output "frontend_url" {
  value = "http://${aws_lb.this.dns_name}/app"
}

output "alb_dns_name" {
  value = aws_lb.this.dns_name
}

output "ecr_agents_url" {
  value = aws_ecr_repository.agents.repository_url
}

output "ecr_express_url" {
  value = aws_ecr_repository.express.repository_url
}

output "ecr_nextjs_url" {
  value = aws_ecr_repository.nextjs.repository_url
}
