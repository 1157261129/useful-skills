# Security Audit Examples

## Parameterized query

Avoid:

```java
String jpql = "select u from User u where u.email = '" + email + "'";
```

Prefer:

```java
TypedQuery<User> query = entityManager.createQuery(
    "select u from User u where u.email = :email", User.class);
query.setParameter("email", email);
```

## Validate dynamic identifiers

```java
private static final Set<String> ALLOWED_SORTS = Set.of("createdAt", "email", "status");

Sort sortBy(String field) {
    if (!ALLOWED_SORTS.contains(field)) {
        throw new IllegalArgumentException("Unsupported sort field");
    }
    return Sort.by(field);
}
```

## Authorization is object-specific

```java
Document document = repository.findById(id).orElseThrow();
if (!document.ownerId().equals(currentUser.id())) {
    throw new AccessDeniedException("Document does not belong to current user");
}
```

## Disable unsafe Jackson default typing

```java
ObjectMapper mapper = new ObjectMapper();
mapper.deactivateDefaultTyping();
```
