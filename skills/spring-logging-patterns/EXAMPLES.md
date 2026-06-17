# Spring Logging Patterns Examples

## Parameterized logging

Avoid:

```java
log.info("订单已创建 | Order created " + order.getId() + " for " + user.getId());
```

Prefer:

```java
log.info("订单已创建 | Order created orderId={} userId={}", order.getId(), user.getId());
```

## MDC request context

```java
class RequestContextFilter extends OncePerRequestFilter {
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        try {
            MDC.put("requestId", request.getHeader("X-Request-Id"));
            chain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
```

## Log once at boundary

```java
@RestControllerAdvice
class GlobalExceptionHandler {
    @ExceptionHandler(OrderException.class)
    ResponseEntity<ErrorResponse> handle(OrderException ex) {
        log.warn("订单请求失败 | Order request failed orderId={} code={}", ex.orderId(), ex.code(), ex);
        return ResponseEntity.badRequest().body(ErrorResponse.from(ex));
    }
}
```
