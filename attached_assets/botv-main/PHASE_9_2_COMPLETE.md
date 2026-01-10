# Phase 9.2: Continuous Risk Scoring & Response - Complete Documentation

## Overview

Phase 9.2 implements real-time, user-specific risk scoring with automated response mechanisms. This sub-phase combines metrics from Phases 8 and 9.1 to deliver continuous risk evaluation and intelligent response triggering.

**Key Features**:
- Real-time risk scoring across 4 dimensions (transaction, fraud, compliance, behavior)
- Intelligent weighting system (compliance 35%, fraud 30%, transaction 20%, behavior 15%)
- Automated response triggering (account suspension, limit reduction, monitoring)
- Historical trend tracking for pattern analysis
- Bulk scoring for batch operations

**Delivery**: 700+ lines across 3 production services + 20+ integration tests

---

## Architecture

### Risk Scoring Service

#### Components

**Risk Dimensions** (4 weighted components):

1. **Transaction Risk** (20% weight)
   - Factors:
     - Error rate: Failed transactions / total transactions
     - Transaction frequency: Count in last 1 hour
     - Failure pattern detection
   - Calculation:
     ```
     risk = min(error_rate + frequent_txn_bonus + failure_bonus, 100)
     ```

2. **Fraud Risk** (30% weight)
   - Factors:
     - Recent fraud flags (last 1 hour)
     - Critical severity flags (score > 75)
     - Historical pattern (7-day total)
     - Average fraud score
   - Calculation:
     ```
     risk = min(
       (recent_flags * 5) + (critical * 30) + 
       (pattern_detected * 15) + (avg_score / 2),
       100
     )
     ```

3. **Compliance Risk** (35% weight) - HIGHEST PRIORITY
   - Factors:
     - KYC status (verified, failed, missing)
     - AML flags
     - Self-exclusion status
     - Historical violations
   - Calculation:
     ```
     risk = min(
       (kyc_failed * 40) + (kyc_missing * 30) + 
       (has_aml * 50) + (is_excluded * 100),
       100
     )
     ```

4. **Behavior Risk** (15% weight)
   - Factors:
     - Account age (new accounts > 7 days)
     - Session frequency
     - Betting patterns
     - Rapid activity escalation
   - Calculation:
     ```
     risk = min(
       (new_account * 20) + (high_activity * 15) + 
       (rapid_escalation * 40),
       100
     )
     ```

**Overall Risk Score**:
```
overall = (transaction * 0.2) + (fraud * 0.3) + 
          (compliance * 0.35) + (behavior * 0.15)
```

**Risk Levels & Actions**:

| Score | Level | Recommendation | Actions |
|-------|-------|----------------|---------|
| 0-25 | Low | ALLOW | None |
| 26-50 | Medium | MONITOR | Enhanced monitoring |
| 51-75 | High | RESTRICT | Betting limits reduced by 50% |
| 76-100 | Critical | BLOCK | Account suspended |

### API Endpoints (`/api/v1/risk`)

**Risk Scoring** (4 endpoints):
```
GET /score/{user_id}                - Get current risk breakdown
POST /score/{user_id}/action        - Trigger automated response
GET /trend/{user_id}?days=30        - Historical trend analysis
POST /score/bulk                    - Score multiple users
```

**Response Format**:
```json
{
  "status": "success",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": { ... }
}
```

---

## Risk Calculation Details

### Transaction Risk Calculation

```python
async def calculate_transaction_risk(user_id) -> int:
    # Get last 1 hour transactions
    count = get_transactions(user_id, last_1h)
    failed = get_failed_transactions(user_id, last_1h)
    
    # Calculate error rate
    error_rate = (failed / count) * 100 if count > 0 else 0
    
    # Bonus points
    frequent = 10 if count > 50 else 0
    high_failure = 20 if error_rate > 20% else 0
    
    return min(error_rate + frequent + high_failure, 100)
```

**Example Scenarios**:
- 0 failed / 50 transactions → 0% error rate → Score: 10 (frequent bonus)
- 10 failed / 50 transactions → 20% error rate → Score: 30
- 15 failed / 50 transactions → 30% error rate + high failure bonus → Score: 50

### Fraud Risk Calculation

```python
async def calculate_fraud_risk(user_id) -> int:
    # Recent and historical flags
    recent = count_flags(user_id, last_1h)
    critical = count_flags(user_id, last_1h, score > 75)
    week_total = count_flags(user_id, last_7d)
    avg_score = average_score(user_id)
    
    pattern_detected = 1 if week_total > 5 else 0
    
    return min(
        (recent * 5) + (critical * 30) +
        (pattern_detected * 15) + (avg_score / 2),
        100
    )
```

**Example Scenarios**:
- 0 flags last hour → Score: 0
- 2 critical flags → Score: 60
- 10 flags in 7 days + avg score 60 → Score: 45 (pattern) + 30 (score) = 75

### Compliance Risk Calculation

```python
async def calculate_compliance_risk(user_id) -> int:
    # Check KYC status
    kyc_status = get_last_kyc_event(user_id)
    aml_flags = count_aml_flags(user_id)
    is_excluded = check_self_exclusion(user_id)
    
    kyc_failed = 40 if kyc_status == FAILED else 0
    kyc_missing = 30 if kyc_status == None else 0
    has_aml = 50 if aml_flags > 0 else 0
    excluded = 100 if is_excluded else 0
    
    return min(
        kyc_failed + kyc_missing + has_aml + excluded,
        100
    )
```

**Example Scenarios**:
- Verified KYC, no AML, not excluded → Score: 0
- Failed KYC → Score: 40
- Self-excluded → Score: 100 (CRITICAL)
- Failed KYC + AML flag → Score: 90

### Behavior Risk Calculation

```python
async def calculate_behavior_risk(user_id) -> int:
    # Check account age and activity
    user = get_user(user_id)
    sessions = count_game_results(user_id, last_24h)
    
    new_account = 20 if user.created < 7 days ago else 0
    high_activity = 15 if sessions > 100 else 0
    rapid_escalation = 40 if sessions > 500 and new_account else 0
    
    return min(
        new_account + high_activity + rapid_escalation,
        100
    )
```

**Example Scenarios**:
- Old account, normal activity → Score: 0
- New account → Score: 20
- New account + 600 sessions in 24h → Score: 60 (escalation)

---

## Automated Response Actions

### Response Mapping

**ALLOW (Score 0-25)**:
- No actions
- Normal operation

**MONITOR (Score 26-50)**:
- Enable enhanced logging
- Flag for manual review
- Increased audit logging

**RESTRICT (Score 51-75)**:
- Reduce betting limits by 50%
- Daily bet limit halved
- Weekly bet limit halved
- Require additional verification
- Send compliance notice

**BLOCK (Score 76-100)**:
- Suspend account immediately
- Prevent all transactions
- Alert fraud/compliance team
- Escalate to executive dashboard
- Prevent withdrawal requests

### Automated Trigger Workflow

```
Risk Score Calculated
         ↓
    Score ≥ 26?
    ↙ (Yes)         ↘ (No)
Create Alert        Allow
   ↓
Score ≥ 51?
   ↙ (Yes)         ↘ (No)
Reduce Limits       Monitor
   ↓
Score ≥ 76?
   ↙ (Yes)         ↘ (No)
Suspend Account     Restrict
   ↓
Log Response
   ↓
Update Risk History
   ↓
Complete
```

---

## Database Schema Additions

### risk_scores_history Table
- id (serial PK)
- user_id (int FK)
- overall_score (int 0-100)
- transaction_risk (int)
- fraud_risk (int)
- compliance_risk (int)
- behavior_risk (int)
- recommendation (varchar: allow, monitor, restrict, block)
- calculated_at (timestamp)
- created_at (timestamp default)

**Indexes**:
- user_id, calculated_at
- overall_score (for reporting)

---

## Integration Examples

### Get User Risk Score

```bash
curl -H "Authorization: Bearer TOKEN" \
  https://api.langsense.com/api/v1/risk/score/123
```

**Response**:
```json
{
  "status": "success",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "user_id": 123,
    "overall_score": 65,
    "level": "high",
    "recommendation": "restrict",
    "breakdown": {
      "transaction_risk": 35,
      "fraud_risk": 72,
      "compliance_risk": 58,
      "behavior_risk": 25
    }
  }
}
```

### Trigger Automated Response

```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
  https://api.langsense.com/api/v1/risk/score/123/action
```

**Response**:
```json
{
  "status": "success",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "user_id": 123,
    "risk_level": "high",
    "score": 65,
    "actions_taken": [
      "betting_limits_reduced"
    ],
    "escalation_reason": "High risk score 65",
    "triggered_at": "2024-01-15T10:30:00Z"
  }
}
```

### Get Risk Trend (30 days)

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://api.langsense.com/api/v1/risk/trend/123?days=30"
```

**Response**:
```json
{
  "status": "success",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "user_id": 123,
    "days": 30,
    "trend": [
      {
        "timestamp": "2024-01-14T10:00:00Z",
        "overall_score": 45,
        "transaction_risk": 30,
        "fraud_risk": 50,
        "compliance_risk": 45,
        "recommendation": "monitor"
      },
      {
        "timestamp": "2024-01-15T10:00:00Z",
        "overall_score": 65,
        "transaction_risk": 35,
        "fraud_risk": 72,
        "compliance_risk": 58,
        "recommendation": "restrict"
      }
    ]
  }
}
```

### Bulk Score Users

```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_ids": [100, 101, 102, 103]}' \
  https://api.langsense.com/api/v1/risk/score/bulk
```

**Response**:
```json
{
  "status": "success",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "total_users_scored": 4,
    "high_risk_count": 1,
    "critical_count": 0
  }
}
```

---

## Configuration & Tuning

### Adjust Risk Weights

```python
# In ContinuousRiskScoringService.__init__
overall_score = int(
    (transaction_risk * 0.15) +  # Reduced from 0.2
    (fraud_risk * 0.25) +        # Reduced from 0.3
    (compliance_risk * 0.40) +   # Increased from 0.35
    (behavior_risk * 0.20)       # Increased from 0.15
)
```

### Add Custom Scoring Factors

```python
async def calculate_custom_risk(self, session, user_id) -> int:
    # Add account status
    # Add region-based risk
    # Add device fingerprint
    # Add velocity checks
    pass
```

### Tune Response Thresholds

```python
if overall_score >= 60:  # Changed from 76
    recommendation = RiskRecommendation.BLOCK
elif overall_score >= 40:  # Changed from 51
    recommendation = RiskRecommendation.RESTRICT
elif overall_score >= 20:  # Changed from 26
    recommendation = RiskRecommendation.MONITOR
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Average Risk Score**: Should be < 30
2. **Distribution**: Most users should be in LOW category
3. **Response Actions**: Monitor account suspensions
4. **False Positives**: Track incorrect BLOCK actions
5. **Appeal Rate**: Users contesting risk assessments

### Alert Conditions

- Average score increases > 50% in 1 hour → CRITICAL
- > 5% of users in CRITICAL category → CRITICAL
- Consistent BLOCK actions → Review weights
- No compliance risk scores detected → Check queries

---

## Testing

### Test Coverage
- 20+ integration tests
- Risk calculation accuracy tests
- Response action verification
- Trend analysis validation
- Bulk operation tests
- Edge case handling

### Running Tests
```bash
pytest tests/test_phase_9_2_risk_scoring.py -v
```

---

## Backward Compatibility

✅ **Fully backward compatible**:
- No changes to existing models (except new risk_scores_history table)
- Opt-in risk scoring (not mandatory)
- Response actions gracefully degrade
- New API endpoints separate namespace

---

## Performance Considerations

### Calculation Complexity
- **Per-user**: O(n) where n = history size
- **Bulk**: O(users * history_size)
- Recommended: Run bulk scoring during low-traffic periods

### Optimization Strategies
1. Cache scores for 5 minutes
2. Batch bulk operations
3. Use indexed queries on timestamp ranges
4. Archive old history (>90 days)
5. Parallel scoring for bulk operations

---

## Next Steps (Phase 9.3)

Sub-phase 9.3 will deliver:
- User cohort analysis
- Churn prediction models
- Lifetime value modeling
- Behavior pattern clustering
- Predictive analytics

---

**Production Status**: ✅ READY FOR PRODUCTION
**Testing Status**: ✅ 20+ TESTS PASSING
**Deployment**: Follow integration guide above
