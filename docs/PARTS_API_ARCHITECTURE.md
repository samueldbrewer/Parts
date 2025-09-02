# Parts API Architecture Map

## System Architecture Overview

```mermaid
graph TB
    subgraph "Client Layer"
        MW[Mobile/Web App]
        API[Voice Assistant]
        TI[Third-party Integrations]
    end

    subgraph "API Gateway"
        GW[API Gateway/Load Balancer]
        AUTH[Auth Middleware]
        RL[Rate Limiter]
    end

    subgraph "Core Service Patterns"
        subgraph "Pattern A: Visual AI Analysis"
            VA[Visual Analysis Service]
            VA --> VISION[OpenAI Vision API]
            VA --> OCR[OCR Processing]
            VA --> IMG_STORE[(Image Storage)]
        end

        subgraph "Pattern B: Cross-Reference"
            CR[Cross-Ref Service]
            CR --> XREF_DB[(Cross-Ref DB)]
            CR --> CACHE_CR[Redis Cache]
        end

        subgraph "Pattern C: Market Data"
            MD[Market Data Service]
            MD --> SERP[SERP API]
            MD --> PRICE_CACHE[Price Cache]
            MD --> SUP_AGG[Supplier Aggregator]
        end

        subgraph "Pattern D: Model Lookup"
            ML[Model Service]
            ML --> MODEL_DB[(Model DB)]
            ML --> PARTS_DB[(Parts DB)]
            ML --> PDF_PROC[PDF Processor]
        end

        subgraph "Pattern E: AI Analysis"
            AI[AI Analysis Service]
            AI --> GPT[OpenAI GPT-4]
            AI --> HIST_DB[(Historical DB)]
            AI --> PRED[Prediction Engine]
        end

        subgraph "Pattern F: Spec Matching"
            SM[Spec Match Service]
            SM --> SPEC_DB[(Specs DB)]
            SM --> FUZZY[Fuzzy Matcher]
            SM --> VAL[AI Validator]
        end

        subgraph "Pattern G: Bulk Operations"
            BO[Bulk Service]
            BO --> QUEUE[Job Queue]
            BO --> AGG[Aggregator]
            BO --> OPT[Optimizer]
        end
    end

    subgraph "Data Layer"
        PG[(PostgreSQL)]
        REDIS[(Redis)]
        S3[(S3/Storage)]
        ES[(ElasticSearch)]
    end

    subgraph "External Services"
        OAI[OpenAI APIs]
        SERP_API[SERP API]
        MFG[Manufacturer APIs]
        SUP[Supplier APIs]
    end

    MW --> GW
    API --> GW
    TI --> GW
    GW --> AUTH
    AUTH --> RL
    RL --> VA
    RL --> CR
    RL --> MD
    RL --> ML
    RL --> AI
    RL --> SM
    RL --> BO

    VA --> PG
    CR --> PG
    MD --> REDIS
    ML --> PG
    AI --> PG
    SM --> ES
    BO --> REDIS

    VA --> S3
    ML --> S3
```

## Endpoint Pattern Mapping

```mermaid
graph LR
    subgraph "Visual AI Pattern A"
        E1[1. identify/visual]
        E2[2. identify/nameplate]
        E4[4. compare/visual]
        E31[31. identify/damaged]
    end

    subgraph "Cross-Reference Pattern B"
        E8[8. superseded]
        E9[9. cross-reference/multi]
        E10[10. universal]
        E11[11. oem-to-aftermarket]
    end

    subgraph "Market Data Pattern C"
        E13[13. where-to-buy]
        E14[14. price-compare]
        E15[15. local-stock]
        E16[16. lead-time]
        E37[37. quote/emergency]
    end

    subgraph "Model Lookup Pattern D"
        E17[17. parts-list]
        E21[21. parts/filters]
        E22[22. parts/wear-items]
        E23[23. parts/electrical]
        E24[24. parts/mechanical]
    end

    subgraph "AI Analysis Pattern E"
        E19[19. common-failures]
        E28[28. predict/failure]
        E29[29. recommend/upgrade]
        E35[35. repair-vs-replace]
    end

    subgraph "Spec Matching Pattern F"
        E5[5. specs]
        E6[6. dimensions]
        E7[7. compatibility]
        E12[12. match/specs]
    end

    subgraph "Bulk Ops Pattern G"
        E25[25. bulk-quote]
        E26[26. kit-builder]
        E27[27. parts/seasonal]
    end
```

## Data Flow Example: Part Identification Journey

```mermaid
sequenceDiagram
    participant U as User
    participant API as API Gateway
    participant VA as Visual Analysis
    participant AI as OpenAI Vision
    participant CR as Cross-Ref Service
    participant MD as Market Data
    participant SERP as SERP API
    participant DB as Database

    U->>API: Upload part photo
    API->>VA: Process image
    VA->>AI: Analyze image
    AI-->>VA: Part details extracted
    VA->>DB: Search for matches
    DB-->>VA: Potential matches
    VA->>CR: Get cross-references
    CR-->>VA: Alternative parts
    VA->>MD: Get pricing/availability
    MD->>SERP: Search suppliers
    SERP-->>MD: Real-time data
    MD-->>VA: Aggregated results
    VA-->>API: Complete part info
    API-->>U: Part identified with options
```

## Service Communication Matrix

```mermaid
graph TD
    subgraph "Service Dependencies"
        VS[Visual Service]
        CS[Cross-Ref Service]
        MS[Market Service]
        AS[AI Service]

        VS -->|Part Numbers| CS
        VS -->|Part Numbers| MS
        CS -->|Alternatives| MS
        MS -->|Pricing Data| AS
        AS -->|Recommendations| MS
        CS -->|Validation| AS
    end
```

## Technology Stack by Pattern

| Pattern             | Primary Tech  | Secondary Tech | Data Store    | Cache |
| ------------------- | ------------- | -------------- | ------------- | ----- |
| **A: Visual AI**    | OpenAI Vision | TensorFlow     | PostgreSQL    | S3    |
| **B: Cross-Ref**    | PostgreSQL    | ElasticSearch  | PostgreSQL    | Redis |
| **C: Market Data**  | SERP API      | Scrapers       | PostgreSQL    | Redis |
| **D: Model Lookup** | PostgreSQL    | PDF Parser     | PostgreSQL    | Redis |
| **E: AI Analysis**  | OpenAI GPT-4  | Scikit-learn   | PostgreSQL    | Redis |
| **F: Spec Match**   | ElasticSearch | Fuzzy Logic    | ElasticSearch | Redis |
| **G: Bulk Ops**     | Bull Queue    | Node Workers   | PostgreSQL    | Redis |

## Scaling Strategy

```mermaid
graph LR
    subgraph "High Load Services"
        MD_SCALE[Market Data<br/>Auto-scale: 1-10 pods]
        VA_SCALE[Visual Analysis<br/>GPU nodes: 1-3]
        CR_SCALE[Cross-Ref<br/>Auto-scale: 2-8 pods]
    end

    subgraph "Medium Load Services"
        ML_SCALE[Model Lookup<br/>Fixed: 2 pods]
        SM_SCALE[Spec Match<br/>Fixed: 2 pods]
    end

    subgraph "Batch Services"
        BO_SCALE[Bulk Ops<br/>Worker pool: 1-5]
        AI_SCALE[AI Analysis<br/>Queue-based: 1-3]
    end
```

## Priority Implementation Order

```mermaid
graph TB
    subgraph "Phase 1: Core MVP"
        P1A[Pattern A: Visual ID<br/>Endpoints 1,2]
        P1C[Pattern C: Market Data<br/>Endpoints 13,14]
        P1B[Pattern B: Cross-Ref<br/>Endpoints 9,10]
    end

    subgraph "Phase 2: Enhancement"
        P2D[Pattern D: Model Data<br/>Endpoints 17,19]
        P2F[Pattern F: Spec Match<br/>Endpoints 5,12]
    end

    subgraph "Phase 3: Intelligence"
        P3E[Pattern E: AI Analysis<br/>Endpoints 28,29,35]
        P3G[Pattern G: Bulk Ops<br/>Endpoints 25,26]
    end

    P1A --> P2D
    P1C --> P2F
    P1B --> P2F
    P2D --> P3E
    P2F --> P3G
```

## Request/Response Flow

```mermaid
stateDiagram-v2
    [*] --> APIGateway
    APIGateway --> Authentication
    Authentication --> RateLimiting
    RateLimiting --> RoutePattern

    RoutePattern --> VisualAI: Image Upload
    RoutePattern --> CrossRef: Part Number
    RoutePattern --> MarketData: Price Check
    RoutePattern --> ModelLookup: Model Query
    RoutePattern --> AIAnalysis: Analysis Request
    RoutePattern --> SpecMatch: Spec Search
    RoutePattern --> BulkOps: Batch Request

    VisualAI --> ProcessImage
    ProcessImage --> EnrichData

    CrossRef --> QueryDB
    QueryDB --> EnrichData

    MarketData --> FetchPrices
    FetchPrices --> AggregateData

    EnrichData --> ResponseBuilder
    AggregateData --> ResponseBuilder

    ResponseBuilder --> [*]
```

## Caching Strategy

```mermaid
graph TD
    subgraph "Cache Layers"
        L1[CDN Cache<br/>Static Images - 24hr]
        L2[Redis Cache<br/>Prices - 1hr]
        L3[Application Cache<br/>Cross-refs - 6hr]
        L4[DB Cache<br/>Model Data - 12hr]
    end

    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> DB[(Primary DB)]
```

This architecture provides:

- **Modularity**: Each pattern can be developed/scaled independently
- **Performance**: Multiple caching layers and optimized data flows
- **Reliability**: Service isolation prevents cascade failures
- **Scalability**: Horizontal scaling for high-demand services
- **Flexibility**: Easy to add new endpoints to existing patterns
