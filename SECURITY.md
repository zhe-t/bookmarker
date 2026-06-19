# Security Policy

bookmark.ops runs entirely in your browser. It has no backend and sends none of
your data anywhere. The one place it makes network requests is the optional
dead-link scan, which `fetch`es your bookmarked URLs (with `mode: "no-cors"`) to
check reachability.

## Reporting a vulnerability

Please report security issues privately to **zhe@solworks.dev** rather than
opening a public issue. Include steps to reproduce and the extension version.
We'll acknowledge your report and keep you updated on a fix.

## Supported versions

This is an early-stage project; only the latest release receives security fixes.
