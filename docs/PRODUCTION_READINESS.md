# Production Readiness Checklist

## 🎯 Caching Implementation - Production Deployment

### Infrastructure Setup
- [ ] **ElastiCache Deployment**
  - [ ] Apply Terraform configuration from `infra/terraform/staging-elasticache-example.tf`
  - [ ] Update subnet IDs and security group references
  - [ ] Configure backup retention and multi-AZ if needed
  - [ ] Note endpoint URL for application configuration

- [ ] **Network Security**
  - [ ] Redis access restricted to application subnets only
  - [ ] Security groups configured for port 6379
  - [ ] VPC peering/networking configured if cross-VPC

### Application Configuration
- [ ] **Environment Variables Set**
  ```bash
  REDIS_URL=redis://your-elasticache-endpoint:6379
  GEOCODE_TTL_MS=3600000
  WEATHER_TTL_MS=600000
  EVENTS_TTL_MS=1800000
  TRAFFIC_TTL_MS=300000
  ```

- [ ] **Admin Endpoint Security**
  ```bash
  CACHE_ADMIN_JWT_SECRET=your-secure-jwt-secret
  # Optional: CACHE_ADMIN_TOKEN=your-simple-token
  ```

- [ ] **Network Access Control**
  - [ ] Admin endpoints (`/__cache`, `/__metrics`) restricted to internal networks
  - [ ] Load balancer/ingress rules block external access to admin paths
  - [ ] VPC/security group rules configured

### Monitoring & Observability
- [ ] **Prometheus Setup**
  - [ ] ServiceMonitor applied: `kubectl apply -f infra/monitoring/service-monitor-daylight.yaml`
  - [ ] Prometheus Operator configured and running
  - [ ] Service labels match ServiceMonitor selector

- [ ] **Grafana Dashboard**
  - [ ] Import cache metrics into Grafana
  - [ ] Create dashboards for cache hit ratio, response times
  - [ ] Set up alerting for low hit ratios or high miss rates

- [ ] **Application Metrics**
  - [ ] Verify `/__metrics` endpoint accessible internally
  - [ ] Test cache metrics appearing in Prometheus
  - [ ] Validate metric labels and values

### Testing & Validation
- [ ] **Functional Testing**
  - [ ] Backend test suite passes: `npm test` (should show 7/7 pass)
  - [ ] Manual testing of cache endpoints in staging
  - [ ] Verify Redis connectivity and fallback behavior

- [ ] **Performance Testing**
  - [ ] Load test with cold cache vs warm cache
  - [ ] Measure response time improvements
  - [ ] Validate cache hit ratios under load

- [ ] **Failure Scenarios**
  - [ ] Test Redis unavailability (should fall back to memory cache)
  - [ ] Test cache invalidation operations
  - [ ] Verify admin authentication works

### Security & Compliance
- [ ] **Access Control**
  - [ ] Admin endpoints require authentication
  - [ ] JWT secrets properly secured and rotated
  - [ ] Network access properly restricted

- [ ] **Code Scanning**
  - [ ] CodeQL analysis enabled (see `docs/CODEQL_ISSUE_TEMPLATE.md`)
  - [ ] Security findings reviewed and addressed
  - [ ] Dependency vulnerability scanning enabled

### Documentation & Runbooks
- [ ] **Operational Docs**
  - [ ] Cache troubleshooting procedures documented
  - [ ] Redis failover procedures defined
  - [ ] Performance tuning guidelines created

- [ ] **Team Knowledge**
  - [ ] Cache invalidation procedures communicated
  - [ ] Monitoring dashboards accessible to team
  - [ ] Alert escalation procedures defined

## 🔍 Performance Benchmarks

### Target Metrics (Post-Implementation)
- **Cache Hit Ratio**: >70% after 24h warmup
- **API Response Time**: 80-95% reduction for cached responses
- **External API Calls**: 70%+ reduction in upstream requests
- **Memory Usage**: Monitor Redis memory consumption patterns

### Monitoring Thresholds
- **Alert if Cache Hit Ratio** < 50% for >15 minutes
- **Alert if Redis Memory** > 80% capacity
- **Alert if External API Error Rate** > 5%
- **Alert if `/__metrics` endpoint** returns 5xx for >5 minutes

## 🚨 Rollback Plan

### If Issues Occur
1. **Disable Cache** via environment variable:
   ```bash
   unset REDIS_URL  # Forces fallback to memory cache
   ```

2. **Emergency Cache Clear**:
   ```bash
   curl -X POST -H "Authorization: Bearer $JWT_TOKEN" \
        http://internal-lb/__cache -d '{"clear": true}'
   ```

3. **Full Rollback**:
   - Deploy previous version without caching code
   - External APIs will handle full load directly
   - Performance will return to pre-cache levels

## ✅ Sign-off

- [ ] **Development Team**: Code reviewed and tested
- [ ] **DevOps/SRE**: Infrastructure configured and monitored
- [ ] **Security Team**: Security controls validated
- [ ] **Product/Business**: Performance improvements validated

---
**Deployment Date**: _____________  
**Deployed By**: _____________  
**Approved By**: _____________

*Use this checklist to ensure comprehensive production deployment*
*All items should be completed before go-live*
