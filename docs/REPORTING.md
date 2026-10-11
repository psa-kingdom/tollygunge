# Operational reporting

`/admin/workspaces/reports` and `/api/staff/reports` enforce assigned staff
permissions. Event operators receive event reports, content editors receive content
totals, and communications operators receive inquiry and newsletter totals.
Ordinary accounts are denied; administrators receive all implemented reports.

Optional `from` and `to` parameters are strict calendar dates (`YYYY-MM-DD`).
The range is inclusive in Asia/Kolkata, including records at midnight and excluding
the next day's midnight. Reversed ranges and invalid calendar dates return 400.
Queries are parameterized; client parameters cannot expand permissions.

Event reports select by event start date and return the latest 200 events with
separate registration and attendance counts. Inquiry aggregates select by received
date and show current status and currently overdue follow-ups for that cohort.
These are current-state reports, not historical snapshots of status on the end date.
Content and newsletter totals remain current, independent of the date filter.
CSV filenames include the applied range; exported rows match the displayed result.
CSV cells escape formula prefixes. XLSX, detailed financial reports and saved
report presets remain pending. Payments and accredited learning hours are not inferred.
