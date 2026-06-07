"""Fabraix Playground engine.

A self-contained FastAPI app + agent runtime that depends ONLY on an injected
`Platform` (see `engine.adapters.base`); it never reaches into a host
application, which keeps it portable and self-contained.
"""
