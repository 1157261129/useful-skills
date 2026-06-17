# Java Design Patterns Examples

## Strategy

Use Strategy when algorithms vary and each variant is real.

```java
interface DiscountPolicy {
    Money apply(Money subtotal);
}

class PercentageDiscount implements DiscountPolicy {
    public Money apply(Money subtotal) {
        return subtotal.multiply("0.90");
    }
}

class CheckoutService {
    private final DiscountPolicy discountPolicy;

    CheckoutService(DiscountPolicy discountPolicy) {
        this.discountPolicy = discountPolicy;
    }
}
```

## Adapter

Keep external API models at the boundary.

```java
interface PaymentGateway {
    PaymentResult charge(PaymentRequest request);
}

class LegacyPaymentAdapter implements PaymentGateway {
    private final LegacyPaymentClient client;

    public PaymentResult charge(PaymentRequest request) {
        LegacyCharge charge = new LegacyCharge(request.amount().toCents());
        LegacyReceipt receipt = client.submit(charge);
        return new PaymentResult(receipt.approved(), receipt.reference());
    }
}
```

## Avoid unnecessary singleton

```java
class CurrencyRates {
    static final CurrencyRates INSTANCE = new CurrencyRates();
}

@Service
class CurrencyRateService {}
```
