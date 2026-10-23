# HTTPS without owning a domain: ACM can't issue a public cert for the ALB's
# own *.elb.amazonaws.com hostname (AWS controls that domain, not us), so the
# only no-domain path to HTTPS is CloudFront's own *.cloudfront.net default
# domain, which gets a managed AWS certificate automatically. TLS terminates
# at the CloudFront edge; origin traffic to the ALB stays HTTP (acceptable —
# that hop is within AWS's own network, not the public internet, which is
# what the cleartext-transport finding was actually about).
resource "aws_cloudfront_distribution" "frontend" {
  enabled = true
  comment = "${var.project} — HTTPS edge for the ALB (no custom domain)"

  origin {
    domain_name = aws_lb.this.dns_name
    origin_id   = "alb"
    custom_origin_config {
      http_port              = 80
      https_port              = 443
      origin_protocol_policy  = "http-only"
      origin_ssl_protocols    = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods         = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    # This is a dynamic app (SSR pages + POST API calls, not static assets) —
    # caching at this layer would serve stale/wrong responses, so it's fully
    # disabled and every header/cookie/query string is passed through as-is.
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # AWS managed: CachingDisabled
    origin_request_policy_id = "216adef6-5c7f-47e4-b989-5492eafa07d3" # AWS managed: AllViewer
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  price_class = "PriceClass_100" # cheapest tier — fine for a demo
}

output "https_frontend_url" {
  value = "https://${aws_cloudfront_distribution.frontend.domain_name}/app"
}
