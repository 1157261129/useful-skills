# Java Code Review Examples

## Preserve exception context

Avoid:

```java
catch (IOException ex) {
    throw new ImportException("Import failed");
}
```

Prefer:

```java
catch (IOException ex) {
    throw new ImportException("Import failed for file " + fileName, ex);
}
```

## Resource management

```java
try (InputStream input = Files.newInputStream(path)) {
    return parser.parse(input);
}
```

## Stream side effects

Avoid:

```java
List<String> names = new ArrayList<>();
users.stream().filter(User::active).forEach(user -> names.add(user.name()));
```

Prefer:

```java
List<String> names = users.stream()
    .filter(User::active)
    .map(User::name)
    .toList();
```

## Review finding format

```text
[high] src/main/java/app/OrderService.java:42: Retry can double-charge non-idempotent payment requests.
Impact: duplicate customer charges when the payment provider times out after accepting the charge.
Fix: persist an idempotency key before sending the request and reuse it for retries.
```
