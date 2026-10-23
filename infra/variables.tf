variable "aws_region"  { default = "ap-southeast-1" }
variable "aws_profile" { default = "ntt-challenge" }
variable "bedrock_model_id" {
  # Anthropic models are blocked (AWS Marketplace subscription permission
  # gap on this account). Amazon Nova is native, not Marketplace-gated, and
  # confirmed working live 2026-10-24 for both text and vision Converse calls.
  default = "apac.amazon.nova-lite-v1:0"
}
variable "project" { default = "roomwitness" }
