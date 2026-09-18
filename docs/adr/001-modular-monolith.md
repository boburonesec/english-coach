# ADR 001: Modular monolith

## Status

Accepted

## Context

The MVP has several distinct responsibilities, but its contracts, workload, and team boundaries are still evolving. Independent services would add distributed failure modes, deployment coordination, and premature interface commitments.

## Decision

Build the backend as a modular monolith with explicit RealtimeSession, Conversation, Topic, Review, Coaching, and Learner boundaries as behavior arrives. Do not create microservices without a new ADR supported by measured need.

## Consequences

Local development, transactions, refactoring, and deployment remain simple. Module boundaries still require discipline. Runtime components such as API and worker may run as different processes while sharing one backend codebase; that does not make them separate product services.
