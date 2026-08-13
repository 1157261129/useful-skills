# Spring Boot Patterns Examples

## Controller boundary

```java
@RestController
@RequestMapping("/api/users")
class UserController {
    private final UserService users;

    @PostMapping
    ResponseEntity<UserResponse> create(@Valid @RequestBody CreateUserRequest request) {
        UserResponse response = users.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
```

## Service transaction boundary

```java
@Service
@Transactional(readOnly = true)
class UserService {
    private final UserRepository users;

    @Transactional
    UserResponse create(CreateUserRequest request) {
        User user = users.save(User.from(request));
        return UserResponse.from(user);
    }
}
```

## Repository fetch optimization

```java
interface UserRepository extends JpaRepository<User, Long> {
    @EntityGraph(attributePaths = "roles")
    Optional<User> findWithRolesById(Long id);
}
```

## Typed configuration

```java
@ConfigurationProperties(prefix = "security.jwt")
@Validated
record JwtProperties(@NotBlank String issuer, @Positive long ttlSeconds) {}
```
