# Pattern Rules v1

## 1. velocity_increase
Trigger when a competitor has significantly more confirmed signals in the last 30 days than in the prior 30 days.

Draft rule:
- last_30_days >= 5
- last_30_days >= 2 * prior_30_days

## 2. pricing_instability
Trigger when a competitor has 3 or more pricing-related signals in 45 days.

Signal types:
- price_point_change
- tier_change

## 3. positioning_shift_trend
Trigger when a competitor has 2 or more positioning_shift signals in 60 days.

## 4. feature_acceleration
Trigger when a competitor has 3 or more feature-related signals in 60 days.

Signal types:
- feature_launch
- feature_deprecation