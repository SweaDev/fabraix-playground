"""Fabraix Playground — defender agent reference.

A read-only reference for how the Playground's defender agent is wired (challenge
definitions, agent loop, tool schemas, win logic). The agent reaches every
external dependency through an injected `Platform` (see `engine.adapters.base`),
which keeps it portable and host-agnostic. The live Playground is a hosted
service; this package is here to be read, not run.
"""
