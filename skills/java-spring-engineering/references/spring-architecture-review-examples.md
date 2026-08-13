# Spring Architecture Review Examples

## Domain boundary

Keep framework annotations out of core domain when the project follows clean or hexagonal architecture.

```java
@Entity
class User {
    @Id
    private Long id;
}

class User {
    private UserId id;
    private Email email;
}
```

## Port and adapter split

Let application code depend on stable ports, not infrastructure details.

```java
interface UserRepository {
    Optional<User> findById(UserId id);
}

class RegisterUserUseCase {
    private final UserRepository users;

    RegisterUserUseCase(UserRepository users) {
        this.users = users;
    }
}
```

## Utility dumping ground

Replace catch-all utility packages with cohesive owners.

```text
Avoid:
common/Utils.java

Prefer:
email/EmailAddressValidator.java
orders/OrderNumberGenerator.java
```
