# Java Clean Code Examples

## Guard clauses

Reduce nesting when early exits make the normal path clearer.
This is the preferred guard clause shape when it improves scanability.

Avoid:

```java
void activate(User user) {
    if (user != null) {
        if (!user.isActive()) {
            user.activate();
            audit.record(user.id());
        }
    }
}
```

Prefer:

```java
void activate(User user) {
    if (user == null || user.isActive()) {
        return;
    }
    user.activate();
    audit.record(user.id());
}
```

## Avoid flag arguments

Split different behavior into named methods.

Avoid:

```java
invoicePrinter.print(invoice, true);
```

Prefer:

```java
invoicePrinter.printPreview(invoice);
invoicePrinter.printFinal(invoice);
```

## Extract meaningful duplication

Extract repeated domain validation, not coincidental line similarity.

```java
final class EmailAddress {
    private final String value;

    EmailAddress(String value) {
        if (!value.matches("^[^@]+@[^@]+\\.[^@]+$")) {
            throw new IllegalArgumentException("Invalid email");
        }
        this.value = value;
    }
}
```
