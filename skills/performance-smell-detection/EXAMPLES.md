# Performance Smell Detection Examples

## String building in loops

Avoid:

```java
String result = "";
for (Item item : items) {
    result += item.name();
}
```

Prefer:

```java
StringBuilder result = new StringBuilder();
for (Item item : items) {
    result.append(item.name());
}
```

## Precompile repeated regex

```java
private static final Pattern PHONE = Pattern.compile("\\d{3}-\\d{4}");

boolean isPhone(String value) {
    return PHONE.matcher(value).matches();
}
```

## Avoid nested scans

```java
Map<Long, Customer> customersById = customers.stream()
    .collect(Collectors.toMap(Customer::id, Function.identity()));

orders.forEach(order -> enrich(order, customersById.get(order.customerId())));
```

## Measure before changing readable code

```bash
./mvnw test
./mvnw -DskipTests package
jcmd <pid> JFR.start name=profile settings=profile duration=60s filename=app.jfr
```
