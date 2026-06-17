# API Contract Review Examples

## HTTP status semantics

Avoid returning successful HTTP status for failed business operations.

Avoid:

```java
return ResponseEntity.ok(new ErrorResponse("USER_NOT_FOUND", "User not found"));
```

Prefer:

```java
return ResponseEntity.status(HttpStatus.NOT_FOUND)
    .body(new ErrorResponse("USER_NOT_FOUND", "User not found"));
```

## Stable error response

Keep one error shape across controllers.

```java
public record ErrorResponse(
    String code,
    String message,
    Map<String, String> details,
    String traceId
) {}
```

## Versioned endpoint

Do not mix unrelated version strategies without reason.

```java
@RestController
@RequestMapping("/api/v1/users")
class UserControllerV1 {
    @GetMapping("/{id}")
    UserResponse findById(@PathVariable Long id) {
        return userService.findV1(id);
    }
}
```

## Pagination contract

Document page base, size limit, sort format, and empty result behavior.

```java
public record PageResponse<T>(
    List<T> items,
    int page,
    int size,
    long totalElements,
    int totalPages
) {}
```
