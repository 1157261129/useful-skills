# Test Quality Examples

## Arrange Act Assert

```java
@Test
void createsActiveUser() {
    CreateUserRequest request = new CreateUserRequest("a@example.com");

    UserResponse response = service.create(request);

    assertThat(response.email()).isEqualTo("a@example.com");
    assertThat(response.status()).isEqualTo(UserStatus.ACTIVE);
}
```

## Exception assertion

```java
@Test
void rejectsDuplicateEmail() {
    repository.save(existingUser("a@example.com"));

    assertThatThrownBy(() -> service.create(new CreateUserRequest("a@example.com")))
        .isInstanceOf(DuplicateEmailException.class)
        .hasMessageContaining("a@example.com");
}
```

## Parameterized boundary test

```java
@ParameterizedTest
@ValueSource(strings = {"", "bad", "missing-at.example.com"})
void rejectsInvalidEmail(String email) {
    assertThatThrownBy(() -> new EmailAddress(email))
        .isInstanceOf(IllegalArgumentException.class);
}
```

## Soft assertions

```java
assertSoftly(softly -> {
    softly.assertThat(response.id()).isNotNull();
    softly.assertThat(response.email()).isEqualTo("a@example.com");
    softly.assertThat(response.status()).isEqualTo(UserStatus.ACTIVE);
});
```
