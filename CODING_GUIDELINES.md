# 🏗️ CP-MatchMaker Coding Guidelines & Architectural Standards

This document serves as the absolute source of truth for architectural patterns and coding standards in this project. All AI agents, contributors, and developers **MUST** adhere to these rules strictly. No exceptions.

## 1. Controller Layer (`api/controllers`)
The Controller's **ONLY** responsibility is to receive HTTP requests, extract parameters/body, call the appropriate Service layer, and return the HTTP response.
- **NO Business Logic**: Do not write any business logic, data formatting, or complex validation here.
- **NO Try-Catch Blocks**: Do not use `try-catch` inside the controller. Let the Service layer handle it and return a standardized `ResponseData` object.
- **NO Database Calls**: Never call a Repository directly from the Controller.
- **Authorization**: Ensure all controllers or necessary endpoints use `@Authorized()` from `routing-controllers` unless explicitly meant to be public.
- **Response Format**: Always return responses by inspecting the Service's `responseCode`. Use the exact format: `res.status(serviceResponse.responseCode).send({ success: true/false, data: serviceResponse.data })`.

## 2. Service Layer (`domain/services`)
The Service layer contains **ALL** business logic, orchestrates different repositories, and handles errors.
- **Try-Catch Blocks**: Every service method MUST have a `try-catch` block.
- **Standardized Returns**: Always return `ResponseData.build(...)` using codes from `RESPONSE_CODES` and messages from `RESPONSE_MESSAGES` (found in `ResponseDTO.ts`). Do not throw raw errors back to the controller.
- **Error Handling**: Log errors inside the catch block (`console.error('[ServiceName] methodName error:', error.message)`) and return a controlled failure response (`ResponseData.build(RESPONSE_CODES.FAILURE, RESPONSE_MESSAGES.SOMETHING_WENT_WRONG)`).

## 3. Repository Layer (`infrastructure/database/repositories`)
The Repository is the **ONLY** place where database interactions (TypeORM queries, `find`, `save`, `createQueryBuilder`) happen.
- **Custom Queries**: If you need to query the database for something specific (e.g., fetching a user's last accepted submission), write a dedicated method in the corresponding Repository (e.g., `SubmissionRepository.ts`).
- **Do Not Leak Queries**: Never write `AppDataSource.getRepository(...)` inside a Controller or Service (unless managing complex transactions via `QueryRunner` in a Service). Use the exported repository instances.

## 4. DTOs (Data Transfer Objects) (`domain/classes`)
All structured data must have a defined type/class.
- **Explicit Types**: Every request body, response payload, and complex internal object MUST have a corresponding DTO defined in the `domain/classes` folder (e.g., `ProblemDTO.ts`, `ResponseDTO.ts`, `AuthDTO.ts`).
- **No `any` Payloads**: Avoid returning raw anonymous objects `{ ... }`. Map data to DTOs before returning them from the Service layer.

## 5. Generic Code Rules
- **DRY (Don't Repeat Yourself)**: Write modular, reusable, and highly optimized code.
- **Read Before Editing**: Always read the latest file version using `view_file` before attempting any `replace` operations to avoid formatting mismatches.
- **Response Codes**: Always refer to `ResponseDTO.ts`. If a specific `RESPONSE_CODE` or `RESPONSE_MESSAGE` is missing for a new scenario, **add it to the constants** rather than hardcoding numbers/strings in your logic.
- **No Shortcuts**: Maintain industry-level standards at all times. Do not skip these guidelines even for small features.
