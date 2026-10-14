# Backend Architecture & Industry Standards (`kiro-context.md`)

## 1. Overview
This document outlines the architectural standards, patterns, and conventions established across the **CP-MatchMaker** backend codebase. All future changes and new modules must strictly adhere to these patterns.

---

## 2. File Header Convention
Every source file in the backend must include the standard author header:
```typescript
/**
 * @author : anshul-agarwal
 * @since : DD/MM/YYYY, Day
 * @desc : [Brief description of file role]
 * @note : To change this template use File | Settings | File and Code Templates.
 **/
```

---

## 3. Dependency Injection (TypeDI)
- All services and repositories are registered with TypeDI using the `@Service()` decorator.
- In controllers and application layers, use `Container.get(XService)` to resolve dependencies.
- Services do NOT instantiate other services directly via `new Service()`.
- Controllers are registered via `useContainer(Container)` in `routing-controllers` (`app.ts`).

---

## 4. Layered Architecture

```
Client / Frontend
       │
       ▼
Controllers (`backend/src/api/controllers/`)
   - Thin delegation layer
   - Parse query / params / body
   - Delegate directly to Services
   - Always return via `ResponseBuilder.send(res, serviceResponse)`
       │
       ▼
Services (`backend/src/domain/services/`)
   - All core business logic and validation
   - Return structured `ResponseData<T>`
   - Comprehensive error logging with `ErrorLoggingUtils.logError()`
   - Throw/handle `AppException`
       │
       ▼
Repositories & Infrastructure (`backend/src/infrastructure/`)
   - TypeORM repositories extending `Repository<T>`
   - Centralized RedisCache with namespacing and fallback
   - Centralized KafkaProducerClient & KafkaConsumerClient
   - Centralized WebSockets (Socket.IO) & WebRTC signaling
```

---

## 5. Unified Response Builder (`ResponseBuilder.ts`)
Controllers must never build ad-hoc JSON responses. Every controller method returns through:
```typescript
ResponseBuilder.send(res, serviceResult);
```
Standard Response Envelope:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "ERROR_CODE": null,
  "ERROR_MSG": null
}
```
For errors:
```json
{
  "success": false,
  "data": null,
  "message": null,
  "ERROR_CODE": "BAD_REQUEST",
  "ERROR_MSG": "User-facing error description"
}
```

---

## 6. Error Handling & Logging Standards
- **Zero Console Statements**: Absolutely NO `console.log`, `console.error`, or `console.warn` anywhere in production code.
- **Winston Logger**: Centralized structured logging via `logger` from `src/utils/LogglyClient.ts`.
- **ErrorLoggingUtils**:
  - In `catch` blocks:
    ```typescript
    catch (err: any) {
        ErrorLoggingUtils.logError(err, 'ServiceName', 'methodName', { contextData });
        return ResponseBuilder.badRequest(err.message);
    }
    ```
  - Automatic header sanitization for security tokens.
  - `@ErrorLoggingUtils.ErrorLogger()` decorator available for methods without try-catch blocks.
- **Custom Exceptions**:
  - `AppException` (and alias `UserServiceException`) in `src/domain/error/AppException.ts`.

---

## 7. Universal Constants
Magic numbers, hardcoded strings, TTLs, and configuration keys must be defined in the constants directory:
- `AppConstant.ts`: Universal numbers (`ZERO`, `ONE`, `TEN`, etc.), delimiters (`COMMA`, `EMPTY_STRING`), pagination defaults (`DEFAULT_PAGE`, `DEFAULT_PAGE_LIMIT`), and time units (`_SECOND_MS`, `_MINUTE_MS`, `_HOUR_MS`, `_DAY_MS`).
- `AuthConstants.ts`: Cookie names, bcrypt salt rounds, JWT expiry, cookie options.
- `CacheConstants.ts`: Redis TTLs (`cacheExpirySeconds`).
- `KafkaConstants.ts`: Kafka topic names, event definitions, client configuration.
- `RedisConstants.ts`: Cache key patterns and generators (`RedisKeys`).

---

## 8. Database & Concurrency Rules
- **Pessimistic Locking**: When locking a record for concurrency (e.g. `pessimistic_write` / `SELECT ... FOR UPDATE`), **never** join outer/nullable relations in the same query (`FOR UPDATE cannot be applied to the nullable side of an outer join`). Lock the target entity first in an isolated query, then load related entities under the active transaction.
- **Transactions**: For multi-table atomic updates (e.g. lobby join/leave, match creation, submission grading), always use `queryRunner.startTransaction()` and pass `queryRunner` to repository methods.

---

## 9. Problem Caching & Query Indexing Standards
- **Problem Details Cache-Aside**:
  - `getProblemDetails(id)` uses Redis key `problem:details:<id>` (`SEVEN_DAYS` TTL).
  - Only public example test cases (`!tc.isHidden`) are joined via `getProblemWithSamples`, preventing large hidden test cases from transferring into Node.js memory.
  - Markdown / Codeforces formatting is pre-calculated once and cached.
- **Problem List Projection Pruning**:
  - `getAllProblems` selects only lightweight columns (`id`, `title`, `difficulty`, `tags`, `timeLimit`, `memoryLimit`, `createdAt`), omitting the large `description` column.
  - User `isSolved` checks are strictly scoped to the current page problem IDs: `where: { problem: { id: In(pageProblemIds) } }`.
- **Database Indexes**:
  - `idx_problems_tags_gin`: PostgreSQL GIN index on `tags` (`text[]`) for fast `ANY(tags)` array lookups.
  - `idx_problems_difficulty_created`: Composite index on `(difficulty, "createdAt" DESC)` for pre-sorted pagination.
  - `idx_problems_title_lower`: `lower(title) varchar_pattern_ops` B-Tree index for fast prefix searching.
  - `idx_submissions_user_problem_status_date`: Composite index on `(user_id, problem_id, status, "submittedAt" DESC)` covering `pastSubmissions`, `getLastAcceptedSubmission`, and `isSolved`.
  - `idx_submissions_user_date`: Composite index on `(user_id, "submittedAt" DESC)` for instant global submission history pagination.

