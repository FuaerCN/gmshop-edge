# Provider response fixtures

These sanitized fixtures preserve the response shapes consumed by GMShop Edge without containing real account identifiers or credentials. Field names and nesting are based on the provider API contracts used by the adapters:

- Alipay trade query
- WeChat Pay native order creation and order query

Alipay and WeChat Pay fixtures contain only public response shapes. Tests
generate ephemeral RSA keys and signatures at runtime; no merchant private key,
APIv3 key, platform certificate, or production identifier belongs here.
