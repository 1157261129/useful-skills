# Java SOLID Principles Examples

## SRP extraction

Avoid:

```java
class UserService {
    void register(CreateUserRequest request) {}
}
```

Prefer:

```java
class UserService {
    private final UserValidator validator;
    private final UserRepository users;
    private final WelcomeEmailSender emails;
    private final UserAuditLogger audit;
}
```

## OCP with strategy

```java
interface DiscountStrategy {
    Money apply(Money subtotal);
}

class LoyaltyDiscount implements DiscountStrategy {
    public Money apply(Money subtotal) {
        return subtotal.multiply("0.95");
    }
}
```

## ISP split

Avoid:

```java
interface Worker {
    void work();
    void eat();
    void manage();
}
```

Prefer:

```java
interface Workable { void work(); }
interface Feedable { void eat(); }
interface Manageable { void manage(); }
```

## DIP port

```java
class OrderService {
    private final OrderRepository orders;
    private final NotificationSender notifications;
}
```
