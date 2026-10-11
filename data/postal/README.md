# Indian postal reference

Copyright Department of Posts, Government of India. Reused under the Government Open Data License - India. Source: https://www.data.gov.in/resource/all-india-pincode-directory-till-last-month

The government download was unavailable during acquisition. The snapshot was fetched from the pinned republish recorded in `provenance.json`. This is a reference snapshot, not a real-time verification service, and is not endorsed by the Department of Posts.

The gzip file contains deduplicated `[state, district, postal locality, PIN]` tuples. Office suffixes (B.O/S.O/H.O) are removed for display. Coordinates are discarded. Office names describe postal localities rather than exact city boundaries. Administrative names may reflect older boundaries; consult India Post when the directory does not match a new locality.

Coverage: 156,940 tuples, 36 states/UTs, 737 state/district combinations and 19,300 distinct PINs. Metadata includes retrieval date, immutable mirror commit and original SHA-256. Updating the reference requires replacing the compressed file, updating provenance and the server version, and rerunning postal coverage and compatibility tests. Do not publish a partial sample as nationwide coverage.

Run `scripts/provision-postal.mts` to install and activate the immutable snapshot in PostgreSQL. Lookup and validation use the active database version without live provider calls. Refresh tooling and reviewed city aliases are documented in `docs/MEMBER_FOUNDATION.md`. The browser receives selected location lists via `/api/member/locations` (or `/api/locations`); it never downloads this dataset.
