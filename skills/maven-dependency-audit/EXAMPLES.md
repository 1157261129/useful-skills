# Maven Dependency Audit Examples

## Audit commands

```bash
mvn versions:display-dependency-updates
mvn versions:display-plugin-updates
mvn dependency:tree
mvn dependency:analyze
mvn org.owasp:dependency-check-maven:check
```

## Find why a dependency is present

```bash
mvn dependency:tree -Dincludes=commons-logging
```

## Exclude a vulnerable transitive dependency

Only exclude after identifying the parent path and testing the affected feature.

```xml
<dependency>
  <groupId>com.example</groupId>
  <artifactId>legacy-client</artifactId>
  <version>1.4.0</version>
  <exclusions>
    <exclusion>
      <groupId>commons-logging</groupId>
      <artifactId>commons-logging</artifactId>
    </exclusion>
  </exclusions>
</dependency>
```

## Conservative update batch

```bash
mvn versions:use-latest-releases -Dincludes=org.junit.jupiter
mvn test
mvn versions:commit
```
