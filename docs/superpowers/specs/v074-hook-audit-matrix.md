# v0.7.4 Hook Audit Matrix

> **Generated:** 2026-05-11  
> **Baseline:** `docs/superpowers/specs/v074-baseline-perf.txt`

## 14 Hook Karar Matrisi

| Hook | Event | Avg ms | CC Lifecycle? | MCP Karşılığı | Karar | Gerekçe |
|------|-------|--------|---------------|---------------|-------|---------|
| mindlore-session-focus | SessionStart | 360 | ✅ | Yok | KALSIN | CC session init'e bağlı; MCP bu event'i tetikleyemez |
| mindlore-search | UserPromptSubmit | 31 | ✅ | mindlore_search | HYBRID | Hook prompt intercept yapar, MCP tool bağımsız erişim sunar; iki katman tamamlayıcı |
| mindlore-decision-detector | UserPromptSubmit | 1 | ✅ | Yok | KALSIN | Prompt intercept + side-effect; MCP tool state'ini okuyamaz |
| mindlore-index | FileChanged | 9 | ✅ | Yok | KALSIN | CC FileChanged event'ine bağımlı; dosya değişikliğini CC bildirir |
| mindlore-fts5-sync | FileChanged | 3 | ✅ | Yok | KALSIN | CC FileChanged event'ine bağımlı; FTS5 index sync tetikler |
| mindlore-session-end | SessionEnd | 419 | ✅ | Yok | KALSIN | CC session lifecycle'ına bağlı; cleanup + delta write |
| mindlore-pre-compact | PreCompact | N/A | ✅ | Yok | KALSIN | CC compaction öncesi event; MCP bu event'i göremez |
| mindlore-post-compact | PostCompact | N/A | ✅ | Yok | KALSIN | CC compaction sonrası event; maintenance window tetikler |
| mindlore-read-guard | PreToolUse(Read) | 27 | ✅ | Yok | KALSIN | Tool intercept; read tool argümanlarını CC hook state'inden alır |
| mindlore-post-read | PostToolUse(Read) | 8 | ✅ | Yok | KALSIN | Tool intercept; post-read processing + telemetry |
| mindlore-dont-repeat | PreToolUse(Write\|Edit) | 7 | ✅ | Yok | KALSIN | Tool intercept; write/edit tool argümanlarını kontrol eder |
| mindlore-cwd-changed | CwdChanged | N/A | ✅ | Yok | KALSIN | CC CwdChanged event'ine bağımlı; working directory değişimini izler |
| mindlore-model-router | PreToolUse(Agent) | 1 | ✅ | Yok | KALSIN | Tool intercept; agent model selection logic |
| mindlore-research-guard | PreToolUse(Agent) | 15 | ✅ | Yok | KALSIN | Tool intercept; research guard + cost control |

> **N/A (no telemetry):** `mindlore-pre-compact`, `mindlore-post-compact`, `mindlore-cwd-changed` — bu hook'lar nadir çalışan event'lere bağlı olduğu için baseline perf ölçümünde telemetry kaydı oluşmadı.

## Karar Özeti

| Karar | Sayı | Hook'lar |
|-------|------|----------|
| KALSIN | 13 | Tümü except search |
| HYBRID | 1 | mindlore-search |
| MCP → taşı | 0 | — |
| Kaldır | 0 | — |

## CLI → MCP Araştırma Sonucu

14 hook'un tamamı CC (Claude Code) lifecycle event'lerine bağlı:
- **SessionStart / SessionEnd:** Oturum başlangıç/bitiş event'leri
- **UserPromptSubmit:** Kullanıcı prompt gönderimi
- **PreToolUse / PostToolUse:** Tool çağrısı öncesi/sonrası intercept
- **FileChanged / CwdChanged:** Dosya/dizin değişikliği event'leri
- **PreCompact / PostCompact:** Compaction event'leri

MCP server bu event'leri tetikleyemez — sadece tool çağrısı (request/response) yapabilir.  
Hook'lar CC lifecycle entegrasyon noktası, MCP tool'lar bağımsız erişim noktası.  
**İki katman tamamlayıcıdır, ikame değil.**

## Riskler

| Risk | Mitigation |
|------|-----------|
| mindlore-search latency 31ms (budget 50ms) | HYBRID kalır; MCP tool bağımsız erişim sağlar, hook prompt intercept'i korur |
| mindlore-session-focus mean 360ms (budget 100ms) | SessionStart'ta ağır inject var; P18 budget aşımı sadece warning, telemetry flag |
| mindlore-session-end mean 419ms (budget 100ms) | SessionEnd'te delta write + cleanup; P18 budget aşımı sadece warning, telemetry flag |

## Sonuç

v0.7.4 release kapsamında **hiçbir hook MCP'ye taşınmıyor.**  
Tüm 14 hook CC lifecycle bağımlılığı nedeniyle yerinde kalıyor.  
`mindlore-search` HYBRID olarak sınıflandırıldı — hem hook (CC intercept) hem MCP tool (bağımsız erişim) olarak devam eder.

---

*Audit completed as part of v0.7.4 Debt Zero + Latency release.*
