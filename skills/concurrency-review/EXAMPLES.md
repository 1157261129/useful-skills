# Concurrency Review Examples

## Spring `@Async` self-invocation

Proxy-based async behavior is bypassed when a method calls another method on the same instance.

```java
@Service
class OrderService {
    void placeOrder(Order order) {
        sendReceipt(order);
    }

    @Async
    public void sendReceipt(Order order) {
        mailer.send(order);
    }
}
```

Move async work to another bean or call through the proxy boundary.

```java
@Service
class ReceiptService {
    @Async("ioExecutor")
    public void sendReceipt(Order order) {
        mailer.send(order);
    }
}
```

## CompletableFuture timeout and error handling

```java
CompletableFuture<OrderSummary> summary =
    CompletableFuture.supplyAsync(() -> orderClient.fetch(id), ioExecutor)
        .orTimeout(2, TimeUnit.SECONDS)
        .exceptionally(ex -> OrderSummary.unavailable(id));
```

## Atomic map update

Avoid:

```java
if (!cache.containsKey(key)) {
    cache.put(key, load(key));
}
```

Prefer:

```java
cache.computeIfAbsent(key, this::load);
```
