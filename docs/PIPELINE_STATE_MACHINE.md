# PIPELINE STATE MACHINE

## Snapshots
pending:
sections_extracted = false

complete:
sections_extracted = true

---

## Section Diffs

ready for signal detection:
status = 'confirmed'
signal_detected = false
is_noise = false

---

## Signals

pending interpretation:
status = 'pending'

interpreting:
status = 'interpreting'

done:
status = 'interpreted'