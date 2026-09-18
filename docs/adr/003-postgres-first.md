# ADR 003: PostgreSQL first

## Status

Accepted

## Context

The early product needs durable relational state for sessions, observations, coaching, and learner evidence. Its access patterns and scale are not yet proven. Adding specialized stores now would increase operations and create synchronization problems before a demonstrated need exists.

## Decision

Use PostgreSQL as the primary store with Prisma 7 when the first persistence slice is implemented. Do not add Redis, a vector database, MongoDB, Elasticsearch, or Kafka by default.

## Consequences

The system starts with one durable source of truth and can use relational constraints and transactions. Search, queues, caching, or similarity features must first use the simplest PostgreSQL-backed design that meets measured requirements. A specialized store requires evidence and an ADR; no database schema is created during repository bootstrap.
